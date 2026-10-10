/**
 * Migration: app mobile dos técnicos (fechamento persistido, fotos, idempotência, sessão).
 *
 *   DB_NAME=processo_audit_test node scripts/migrate_os_mobile.js          # aplica (idempotente)
 *   DB_NAME=processo_audit_test node scripts/migrate_os_mobile.js --down   # reverte
 *
 * Pela CLI o DB_NAME precisa vir explícito no comando (o valor do .env é ignorado de propósito),
 * para nunca migrar o banco de produção por engano.
 *
 * Cria: os_motivos_fechamento, os_checklist_itens (catálogos editáveis, semeados com o conteúdo
 * que antes era mock no front), os_fechamentos (1:1 com a OS), os_fotos, os_materiais_retirados,
 * sync_operacoes (idempotência) e refresh_tokens (sessão do app); e adiciona
 * ordens_servico.iniciado_em / atualizado_em.
 */
import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const dbExplicito = process.env.DB_NAME; // antes do dotenv: só vale o que veio do comando
dotenv.config();

const TABELAS_DOWN = ['refresh_tokens', 'sync_operacoes', 'os_materiais_retirados', 'os_fotos', 'os_fechamentos', 'os_checklist_itens', 'os_motivos_fechamento'];

const MOTIVOS = [
  ['route_launched', 'Rota lançada com sucesso'],
  ['splice_enclosure_serviced', 'Caixa de emenda (CEO) reparada / vedada'],
  ['pop_maintenance_done', 'Manutenção de POP concluída'],
  ['pole_obstructed', 'Poste obstruído / sem acesso'],
  ['route_rerouted', 'Rota redirecionada por impedimento'],
  ['no_pole_permit', 'Sem autorização da concessionária do poste'],
];

// [codigo, rotulo, tipo, unidade, obrigatorio]
const CHECKLIST = [
  ['fiberLaunchedMeters', 'Metros de fibra lançados?', 'number', 'm', 1],
  ['spliceEnclosureSealed', 'A caixa de emenda foi vedada corretamente?', 'boolean', null, 1],
  ['dropClampsUsed', 'Quantidade de ferragens/alças de drop usadas?', 'number', 'un', 1],
  ['slackLoopsLeft', 'Reservas técnicas (loops) deixadas no poste?', 'number', 'un', 1],
  ['fiberTagged', 'Cabo identificado com plaqueta de rota?', 'boolean', null, 1],
  ['opticalPowerOk', 'Potência óptica dentro do orçamento de perda?', 'boolean', null, 1],
  ['fieldNotes', 'Observações da rota (opcional)', 'text', null, 0],
];

const temColuna = async (c, tabela, coluna) => {
  const [r] = await c.query(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [tabela, coluna]);
  return r.length > 0;
};

export const up = async (c) => {
  // `tipo_servico_id` NULL = vale para todos os tipos de serviço (reservado para configurar por tipo no futuro)
  await c.query(`
    CREATE TABLE IF NOT EXISTS os_motivos_fechamento (
      id INT AUTO_INCREMENT PRIMARY KEY,
      codigo VARCHAR(60) NOT NULL UNIQUE,
      rotulo VARCHAR(160) NOT NULL,
      ordem INT NOT NULL DEFAULT 0,
      ativo TINYINT(1) NOT NULL DEFAULT 1,
      tipo_servico_id INT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await c.query(`
    CREATE TABLE IF NOT EXISTS os_checklist_itens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      codigo VARCHAR(60) NOT NULL UNIQUE,
      rotulo VARCHAR(255) NOT NULL,
      tipo ENUM('boolean','number','text') NOT NULL,
      unidade VARCHAR(10) NULL,
      obrigatorio TINYINT(1) NOT NULL DEFAULT 0,
      ordem INT NOT NULL DEFAULT 0,
      ativo TINYINT(1) NOT NULL DEFAULT 1,
      tipo_servico_id INT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  for (const [i, [codigo, rotulo]] of MOTIVOS.entries()) {
    await c.query('INSERT IGNORE INTO os_motivos_fechamento (codigo, rotulo, ordem) VALUES (?,?,?)', [codigo, rotulo, i + 1]);
  }
  for (const [i, [codigo, rotulo, tipo, unidade, obrigatorio]] of CHECKLIST.entries()) {
    await c.query('INSERT IGNORE INTO os_checklist_itens (codigo, rotulo, tipo, unidade, obrigatorio, ordem) VALUES (?,?,?,?,?,?)',
      [codigo, rotulo, tipo, unidade, obrigatorio, i + 1]);
  }

  // Fechamento da OS (1:1). Rótulos de motivo/checklist/participantes ficam copiados (snapshot): editar o catálogo depois não muda o histórico.
  await c.query(`
    CREATE TABLE IF NOT EXISTS os_fechamentos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      os_id INT NOT NULL UNIQUE,
      descricao TEXT NOT NULL,
      motivo_id INT NOT NULL,
      motivo_rotulo VARCHAR(160) NOT NULL,
      local_lat DECIMAL(10,7) NOT NULL,
      local_lng DECIMAL(10,7) NOT NULL,
      local_precisao_m INT NULL,
      local_origem ENUM('gps','address','pole_reference') NOT NULL,
      local_endereco VARCHAR(500) NULL,
      local_aproximado TINYINT(1) NOT NULL DEFAULT 0,
      local_capturado_em TIMESTAMP NULL,
      checklist LONGTEXT NOT NULL,
      participantes LONGTEXT NOT NULL,
      materiais_usados TINYINT(1) NOT NULL,
      materiais_retirados TINYINT(1) NOT NULL,
      iniciado_em TIMESTAMP NULL,
      finalizado_em TIMESTAMP NULL,
      dispositivo VARCHAR(160) NULL,
      versao_app VARCHAR(30) NULL,
      client_uuid CHAR(36) NOT NULL UNIQUE,
      finalizado_por INT NOT NULL,
      criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_fech_os FOREIGN KEY (os_id) REFERENCES ordens_servico(id),
      CONSTRAINT fk_fech_motivo FOREIGN KEY (motivo_id) REFERENCES os_motivos_fechamento(id),
      CONSTRAINT fk_fech_user FOREIGN KEY (finalizado_por) REFERENCES users(id),
      CONSTRAINT ck_fech_checklist CHECK (JSON_VALID(checklist)),
      CONSTRAINT ck_fech_particip CHECK (JSON_VALID(participantes)),
      CONSTRAINT ck_fech_local CHECK (local_lat BETWEEN -90 AND 90 AND local_lng BETWEEN -180 AND 180)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // `arquivo` é um nome aleatório dentro do diretório privado de fotos; nunca é servido como estático
  await c.query(`
    CREATE TABLE IF NOT EXISTS os_fotos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      os_id INT NOT NULL,
      arquivo VARCHAR(120) NOT NULL UNIQUE,
      mime VARCHAR(40) NOT NULL,
      tamanho INT NOT NULL,
      legenda VARCHAR(255) NULL,
      tirada_em TIMESTAMP NULL,
      lat DECIMAL(10,7) NULL,
      lng DECIMAL(10,7) NULL,
      client_uuid CHAR(36) NOT NULL UNIQUE,
      criado_por INT NOT NULL,
      criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_foto_os (os_id),
      CONSTRAINT fk_foto_os FOREIGN KEY (os_id) REFERENCES ordens_servico(id),
      CONSTRAINT fk_foto_user FOREIGN KEY (criado_por) REFERENCES users(id),
      CONSTRAINT ck_foto_tamanho CHECK (tamanho > 0)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Material retirado da rede: só informação da OS, não mexe no saldo do estoque
  await c.query(`
    CREATE TABLE IF NOT EXISTS os_materiais_retirados (
      id INT AUTO_INCREMENT PRIMARY KEY,
      os_id INT NOT NULL,
      item_id INT NULL,
      descricao VARCHAR(255) NOT NULL,
      quantidade DECIMAL(12,2) NOT NULL,
      unidade ENUM('metros','pecas') NOT NULL,
      condicao ENUM('novo','usado') NOT NULL,
      criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_retirado_os (os_id),
      CONSTRAINT fk_retirado_os FOREIGN KEY (os_id) REFERENCES ordens_servico(id),
      CONSTRAINT fk_retirado_item FOREIGN KEY (item_id) REFERENCES estoque_itens(id),
      CONSTRAINT ck_retirado_qtd CHECK (quantidade > 0)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Idempotência: a chave vale por usuário (outro usuário nunca recebe a resposta de alguém). `resposta` fica NULL
  // enquanto a operação está em andamento (a linha é criada primeiro, na mesma transação, para travar retries concorrentes).
  await c.query(`
    CREATE TABLE IF NOT EXISTS sync_operacoes (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      chave VARCHAR(80) NOT NULL,
      rota VARCHAR(160) NOT NULL,
      hash_corpo CHAR(64) NOT NULL,
      status_http SMALLINT NULL,
      resposta LONGTEXT NULL,
      criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_sync_usuario_chave (usuario_id, chave),
      INDEX idx_sync_criado (criado_em),
      CONSTRAINT fk_sync_user FOREIGN KEY (usuario_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Sessão do app: só o hash do refresh token é guardado. Cada uso troca o token (usado_em); reapresentar um já usado revoga a família.
  await c.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE,
      familia CHAR(36) NOT NULL,
      expira_em TIMESTAMP NOT NULL,
      usado_em TIMESTAMP NULL,
      revogado_em TIMESTAMP NULL,
      dispositivo VARCHAR(160) NULL,
      criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_refresh_usuario (usuario_id),
      INDEX idx_refresh_familia (familia),
      CONSTRAINT fk_refresh_user FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  if (!(await temColuna(c, 'ordens_servico', 'iniciado_em'))) {
    await c.query('ALTER TABLE ordens_servico ADD COLUMN iniciado_em TIMESTAMP NULL');
  }
  if (!(await temColuna(c, 'ordens_servico', 'atualizado_em'))) {
    await c.query('ALTER TABLE ordens_servico ADD COLUMN atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, ADD INDEX idx_os_atualizado (atualizado_em)');
  }
};

export const down = async (c) => {
  for (const t of TABELAS_DOWN) await c.query(`DROP TABLE IF EXISTS ${t}`);
  if (await temColuna(c, 'ordens_servico', 'atualizado_em')) {
    await c.query('ALTER TABLE ordens_servico DROP INDEX idx_os_atualizado, DROP COLUMN atualizado_em');
  }
  if (await temColuna(c, 'ordens_servico', 'iniciado_em')) {
    await c.query('ALTER TABLE ordens_servico DROP COLUMN iniciado_em');
  }
};

export const connect = (database) =>
  mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
  });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!dbExplicito) {
    console.error('Informe o banco no comando, ex.: DB_NAME=processo_audit_test node scripts/migrate_os_mobile.js');
    process.exit(1);
  }
  const conn = await connect(dbExplicito);
  try {
    console.log(`Banco: ${dbExplicito}`);
    if (process.argv.includes('--down')) {
      await down(conn);
      console.log('✅ App mobile (OS) revertido');
    } else {
      await up(conn);
      console.log('✅ App mobile (OS) migrado');
    }
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}
