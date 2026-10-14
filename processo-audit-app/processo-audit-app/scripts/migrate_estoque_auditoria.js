/**
 * Migration: auditoria do Estoque.
 *
 *   DB_NAME=processo_audit_test node scripts/migrate_estoque_auditoria.js          # aplica (idempotente)
 *   DB_NAME=processo_audit_test node scripts/migrate_estoque_auditoria.js --down   # reverte
 *
 * Pela CLI o DB_NAME precisa vir explícito no comando (o valor do .env é ignorado de propósito),
 * para nunca migrar o banco de produção por engano.
 *
 * Cria estoque_auditoria: tudo o que é feito nas abas do Estoque (itens, entradas, lotes, retiradas, devoluções e
 * aprovações, técnicos, fornecedores e equipamentos) — quem, quando, de onde (web/app), de qual IP, o que mudou e se deu
 * certo. Sem FK de propósito: o registro precisa sobreviver a qualquer exclusão (lote, item, técnico, usuário).
 */
import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const dbExplicito = process.env.DB_NAME; // antes do dotenv: só vale o que veio do comando
dotenv.config();

export const up = async (c) => {
  await c.query(`
    CREATE TABLE IF NOT EXISTS estoque_auditoria (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      acao VARCHAR(30) NOT NULL,
      entidade VARCHAR(20) NOT NULL,
      entidade_id INT NULL,
      item_id INT NULL,
      tecnico_id INT NULL,
      lote_codigo VARCHAR(40) NULL,
      resumo VARCHAR(500) NOT NULL,
      campos_alterados VARCHAR(500) NULL,
      dados_antes LONGTEXT NULL,
      dados_depois LONGTEXT NULL,
      resultado VARCHAR(10) NOT NULL DEFAULT 'ok',
      http_status SMALLINT NULL,
      erro VARCHAR(500) NULL,
      repetida TINYINT(1) NOT NULL DEFAULT 0,
      origem VARCHAR(10) NOT NULL DEFAULT 'outro',
      usuario_id INT NULL,
      usuario_email VARCHAR(255) NULL,
      usuario_nome VARCHAR(255) NULL,
      usuario_papel VARCHAR(20) NULL,
      ip VARCHAR(64) NULL,
      ip_cadeia VARCHAR(255) NULL,
      user_agent VARCHAR(500) NULL,
      metodo VARCHAR(8) NULL,
      rota VARCHAR(255) NULL,
      INDEX idx_estaud_data (created_at),
      INDEX idx_estaud_acao (acao, created_at),
      INDEX idx_estaud_entidade (entidade, entidade_id),
      INDEX idx_estaud_item (item_id, created_at),
      INDEX idx_estaud_tecnico (tecnico_id, created_at),
      INDEX idx_estaud_lote (lote_codigo),
      INDEX idx_estaud_usuario (usuario_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
};

export const down = async (c) => {
  await c.query('DROP TABLE IF EXISTS estoque_auditoria');
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
    console.error('Informe o banco no comando, ex.: DB_NAME=processo_audit_test node scripts/migrate_estoque_auditoria.js');
    process.exit(1);
  }
  const conn = await connect(dbExplicito);
  try {
    console.log(`Banco: ${dbExplicito}`);
    if (process.argv.includes('--down')) {
      await down(conn);
      console.log('✅ Auditoria do Estoque revertida');
    } else {
      await up(conn);
      console.log('✅ Auditoria do Estoque migrada');
    }
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}
