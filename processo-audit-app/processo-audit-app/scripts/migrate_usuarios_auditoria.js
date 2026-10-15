/**
 * Migration: auditoria do cadastro de usuários.
 *
 *   DB_NAME=processo_audit_test node scripts/migrate_usuarios_auditoria.js          # aplica (idempotente)
 *   DB_NAME=processo_audit_test node scripts/migrate_usuarios_auditoria.js --down   # reverte
 *
 * Pela CLI o DB_NAME precisa vir explícito no comando (o valor do .env é ignorado de propósito),
 * para nunca migrar o banco de produção por engano.
 *
 * Cria usuarios_auditoria: usuários criados, editados (nome, papel, departamentos, senha trocada), inativados e
 * trocas da própria senha — quem fez, quando, de qual IP e o que mudou. Senha nunca é guardada, só o fato de ter
 * mudado. Sem FK de propósito: o registro precisa sobreviver a qualquer mudança no usuário.
 */
import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const dbExplicito = process.env.DB_NAME; // antes do dotenv: só vale o que veio do comando
dotenv.config();

export const up = async (c) => {
  await c.query(`
    CREATE TABLE IF NOT EXISTS usuarios_auditoria (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      acao VARCHAR(30) NOT NULL,
      alvo_id INT NULL,
      alvo_nome VARCHAR(255) NULL,
      alvo_email VARCHAR(255) NULL,
      resumo VARCHAR(500) NOT NULL,
      campos_alterados VARCHAR(500) NULL,
      dados_antes LONGTEXT NULL,
      dados_depois LONGTEXT NULL,
      usuario_id INT NULL,
      usuario_email VARCHAR(255) NULL,
      usuario_nome VARCHAR(255) NULL,
      ip VARCHAR(64) NULL,
      ip_cadeia VARCHAR(255) NULL,
      user_agent VARCHAR(500) NULL,
      INDEX idx_usuaud_data (created_at),
      INDEX idx_usuaud_acao (acao, created_at),
      INDEX idx_usuaud_alvo (alvo_id, created_at),
      INDEX idx_usuaud_usuario (usuario_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
};

export const down = async (c) => {
  await c.query('DROP TABLE IF EXISTS usuarios_auditoria');
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
    console.error('Informe o banco no comando, ex.: DB_NAME=processo_audit_test node scripts/migrate_usuarios_auditoria.js');
    process.exit(1);
  }
  const conn = await connect(dbExplicito);
  try {
    console.log(`Banco: ${dbExplicito}`);
    if (process.argv.includes('--down')) {
      await down(conn);
      console.log('✅ Auditoria de usuários revertida');
    } else {
      await up(conn);
      console.log('✅ Auditoria de usuários migrada');
    }
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}
