/**
 * Migration: módulos Estoque (almoxarifado) + Ordens de Serviço.
 *
 *   node scripts/migrate_estoque.js          # aplica (idempotente)
 *   node scripts/migrate_estoque.js --down   # reverte (remove as tabelas novas e os perfis)
 *
 * Modelo de posse parcial: `estoque_lotes.saldo_atual` é o que ainda existe do lote
 * (almoxarifado + técnicos). `estoque_posse` guarda quanto de cada lote está com cada
 * técnico/equipe. Almoxarifado = saldo_atual - SUM(posse). Nenhum saldo é editado
 * diretamente: tudo é consequência de `estoque_movimentacoes`, via estoqueService.
 */
import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
dotenv.config();

const TABLES_DOWN_ORDER = [
  'equipamento_emprestimos',
  'equipamentos',
  'os_historico_status',
  'estoque_movimentacoes',
  'ordens_servico',
  'estoque_posse',
  'estoque_lotes',
  'estoque_compras',
  'estoque_itens',
  'estoque_sequencias',
  'fornecedores',
  'tecnicos',
];

export const up = async (c) => {
  await c.query(
    `ALTER TABLE users MODIFY role ENUM('admin','manager','viewer','estoque','tecnico') DEFAULT 'viewer'`
  );

  await c.query(`
    CREATE TABLE IF NOT EXISTS tecnicos (
      id INT PRIMARY KEY AUTO_INCREMENT,
      nome VARCHAR(255) NOT NULL,
      tipo ENUM('interno','terceirizado') NOT NULL DEFAULT 'interno',
      empresa VARCHAR(255) NULL,
      telefone VARCHAR(30) NULL,
      ativo TINYINT(1) NOT NULL DEFAULT 1,
      usuario_id INT NULL UNIQUE,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE SET NULL
    )`);

  await c.query(`
    CREATE TABLE IF NOT EXISTS fornecedores (
      id INT PRIMARY KEY AUTO_INCREMENT,
      nome VARCHAR(255) NOT NULL,
      cnpj VARCHAR(20) NULL,
      contato VARCHAR(255) NULL,
      ativo TINYINT(1) NOT NULL DEFAULT 1,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  await c.query(`
    CREATE TABLE IF NOT EXISTS estoque_sequencias (
      chave VARCHAR(30) PRIMARY KEY,
      valor INT NOT NULL DEFAULT 0
    )`);

  await c.query(`
    CREATE TABLE IF NOT EXISTS estoque_itens (
      id INT PRIMARY KEY AUTO_INCREMENT,
      nome VARCHAR(255) NOT NULL,
      categoria VARCHAR(100) NULL,
      unidade ENUM('metros','pecas') NOT NULL DEFAULT 'pecas',
      estoque_minimo DECIMAL(12,2) NOT NULL DEFAULT 0,
      ativo TINYINT(1) NOT NULL DEFAULT 1,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ck_item_minimo CHECK (estoque_minimo >= 0)
    )`);

  await c.query(`
    CREATE TABLE IF NOT EXISTS estoque_compras (
      id INT PRIMARY KEY AUTO_INCREMENT,
      fornecedor_id INT NULL,
      item_id INT NOT NULL,
      tipo_volume ENUM('bobina','caixa','rolo','unidade') NOT NULL,
      qtd_volumes INT NOT NULL,
      medida_por_volume DECIMAL(12,2) NOT NULL,
      nf VARCHAR(60) NULL,
      chave_idempotencia VARCHAR(80) NULL UNIQUE,
      criado_por INT NOT NULL,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id),
      FOREIGN KEY (item_id) REFERENCES estoque_itens(id),
      FOREIGN KEY (criado_por) REFERENCES users(id),
      CONSTRAINT ck_compra_qtd CHECK (qtd_volumes > 0 AND medida_por_volume > 0)
    )`);

  await c.query(`
    CREATE TABLE IF NOT EXISTS estoque_lotes (
      id INT PRIMARY KEY AUTO_INCREMENT,
      codigo VARCHAR(40) NOT NULL UNIQUE,
      item_id INT NOT NULL,
      compra_id INT NOT NULL,
      saldo_inicial DECIMAL(12,2) NOT NULL,
      saldo_atual DECIMAL(12,2) NOT NULL,
      status ENUM('ativo','esgotado') NOT NULL DEFAULT 'ativo',
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES estoque_itens(id),
      FOREIGN KEY (compra_id) REFERENCES estoque_compras(id),
      INDEX idx_lote_item (item_id),
      CONSTRAINT ck_lote_saldo CHECK (saldo_atual >= 0 AND saldo_atual <= saldo_inicial)
    )`);

  await c.query(`
    CREATE TABLE IF NOT EXISTS estoque_posse (
      lote_id INT NOT NULL,
      tecnico_id INT NOT NULL,
      quantidade DECIMAL(12,2) NOT NULL,
      PRIMARY KEY (lote_id, tecnico_id),
      FOREIGN KEY (lote_id) REFERENCES estoque_lotes(id),
      FOREIGN KEY (tecnico_id) REFERENCES tecnicos(id),
      CONSTRAINT ck_posse_qtd CHECK (quantidade >= 0)
    )`);

  await c.query(`
    CREATE TABLE IF NOT EXISTS ordens_servico (
      id INT PRIMARY KEY AUTO_INCREMENT,
      numero INT NOT NULL UNIQUE,
      cliente VARCHAR(255) NOT NULL,
      endereco VARCHAR(500) NULL,
      tipo_execucao ENUM('interno','terceirizado') NOT NULL DEFAULT 'interno',
      tecnico_id INT NOT NULL,
      prazo DATE NULL,
      prioridade ENUM('baixa','normal','alta') NOT NULL DEFAULT 'normal',
      descricao TEXT NULL,
      status ENUM('aberta','em_andamento','concluida','cancelada') NOT NULL DEFAULT 'aberta',
      criado_por INT NOT NULL,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      concluida_em TIMESTAMP NULL,
      FOREIGN KEY (tecnico_id) REFERENCES tecnicos(id),
      FOREIGN KEY (criado_por) REFERENCES users(id),
      INDEX idx_os_tecnico (tecnico_id),
      INDEX idx_os_status (status)
    )`);

  await c.query(`
    CREATE TABLE IF NOT EXISTS os_historico_status (
      id INT PRIMARY KEY AUTO_INCREMENT,
      os_id INT NOT NULL,
      de VARCHAR(20) NULL,
      para VARCHAR(20) NOT NULL,
      usuario_id INT NOT NULL,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (os_id) REFERENCES ordens_servico(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES users(id)
    )`);

  await c.query(`
    CREATE TABLE IF NOT EXISTS estoque_movimentacoes (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tipo ENUM('entrada','retirada','devolucao','baixa_os','estorno','ajuste') NOT NULL,
      lote_id INT NOT NULL,
      item_id INT NOT NULL,
      quantidade DECIMAL(12,2) NOT NULL,
      tecnico_id INT NULL,
      os_id INT NULL,
      estorno_de_id INT NULL UNIQUE,
      condicao ENUM('novo','usado') NULL,
      observacao VARCHAR(500) NULL,
      criado_por INT NOT NULL,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lote_id) REFERENCES estoque_lotes(id),
      FOREIGN KEY (item_id) REFERENCES estoque_itens(id),
      FOREIGN KEY (tecnico_id) REFERENCES tecnicos(id),
      FOREIGN KEY (os_id) REFERENCES ordens_servico(id),
      FOREIGN KEY (estorno_de_id) REFERENCES estoque_movimentacoes(id),
      FOREIGN KEY (criado_por) REFERENCES users(id),
      INDEX idx_mov_tipo_data (tipo, criado_em),
      INDEX idx_mov_os (os_id),
      INDEX idx_mov_tecnico (tecnico_id),
      CONSTRAINT ck_mov_qtd CHECK (quantidade > 0)
    )`);

  await c.query(`
    CREATE TABLE IF NOT EXISTS equipamentos (
      id INT PRIMARY KEY AUTO_INCREMENT,
      nome VARCHAR(255) NOT NULL,
      patrimonio VARCHAR(100) NULL,
      estado ENUM('novo','bom','usado','defeito') NOT NULL DEFAULT 'bom',
      ativo TINYINT(1) NOT NULL DEFAULT 1,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  await c.query(`
    CREATE TABLE IF NOT EXISTS equipamento_emprestimos (
      id INT PRIMARY KEY AUTO_INCREMENT,
      equipamento_id INT NOT NULL,
      tecnico_id INT NOT NULL,
      saida_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      devolucao_em TIMESTAMP NULL,
      condicao_saida ENUM('novo','bom','usado','defeito') NOT NULL DEFAULT 'bom',
      condicao_devolucao ENUM('novo','bom','usado','defeito') NULL,
      criado_por INT NOT NULL,
      FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id),
      FOREIGN KEY (tecnico_id) REFERENCES tecnicos(id),
      FOREIGN KEY (criado_por) REFERENCES users(id)
    )`);
};

export const down = async (c) => {
  for (const t of TABLES_DOWN_ORDER) await c.query(`DROP TABLE IF EXISTS ${t}`);
  await c.query(`UPDATE users SET role = 'viewer' WHERE role IN ('estoque','tecnico')`);
  await c.query(`ALTER TABLE users MODIFY role ENUM('admin','manager','viewer') DEFAULT 'viewer'`);
};

export const connect = (database = process.env.DB_NAME) =>
  mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
  });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const conn = await connect();
  try {
    if (process.argv.includes('--down')) {
      await down(conn);
      console.log('✅ Estoque/OS revertido');
    } else {
      await up(conn);
      console.log('✅ Estoque/OS migrado');
    }
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}
