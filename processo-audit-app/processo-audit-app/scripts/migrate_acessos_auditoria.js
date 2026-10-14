/**
 * Migration: auditoria de acessos (logins, logouts e sessões).
 *
 *   DB_NAME=processo_audit_test node scripts/migrate_acessos_auditoria.js          # aplica (idempotente)
 *   DB_NAME=processo_audit_test node scripts/migrate_acessos_auditoria.js --down   # reverte
 *
 * Pela CLI o DB_NAME precisa vir explícito no comando (o valor do .env é ignorado de propósito),
 * para nunca migrar o banco de produção por engano.
 *
 * - acessos_sessoes: uma linha por login (web ou app): IP, quando começou, última atividade, quando e por que acabou.
 * - acessos_eventos: tudo o que acontece no acesso, inclusive tentativas de login recusadas.
 * Sem FK de propósito: o histórico precisa sobreviver ao usuário.
 */
import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const dbExplicito = process.env.DB_NAME; // antes do dotenv: só vale o que veio do comando
dotenv.config();

export const up = async (c) => {
  await c.query(`
    CREATE TABLE IF NOT EXISTS acessos_sessoes (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      sid CHAR(36) NOT NULL UNIQUE,
      origem VARCHAR(10) NOT NULL,
      usuario_id INT NULL,
      usuario_email VARCHAR(255) NULL,
      usuario_nome VARCHAR(255) NULL,
      usuario_papel VARCHAR(30) NULL,
      dispositivo VARCHAR(160) NULL,
      ip VARCHAR(64) NULL,
      ip_cadeia VARCHAR(255) NULL,
      user_agent VARCHAR(500) NULL,
      iniciada_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      ultima_atividade DATETIME(3) NULL,
      ultimo_ip VARCHAR(64) NULL,
      expira_em DATETIME(3) NULL,
      renovacoes INT NOT NULL DEFAULT 0,
      encerrada_em DATETIME(3) NULL,
      motivo_encerramento VARCHAR(30) NULL,
      encerrada_por_id INT NULL,
      encerrada_por_nome VARCHAR(255) NULL,
      INDEX idx_asess_inicio (iniciada_em),
      INDEX idx_asess_usuario (usuario_id, iniciada_em),
      INDEX idx_asess_abertas (encerrada_em, expira_em)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await c.query(`
    CREATE TABLE IF NOT EXISTS acessos_eventos (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      evento VARCHAR(30) NOT NULL,
      motivo VARCHAR(40) NULL,
      sid CHAR(36) NULL,
      origem VARCHAR(10) NULL,
      usuario_id INT NULL,
      usuario_email VARCHAR(255) NULL,
      usuario_nome VARCHAR(255) NULL,
      ip VARCHAR(64) NULL,
      ip_cadeia VARCHAR(255) NULL,
      user_agent VARCHAR(500) NULL,
      detalhe VARCHAR(500) NULL,
      INDEX idx_aev_data (created_at),
      INDEX idx_aev_evento (evento, created_at),
      INDEX idx_aev_usuario (usuario_id, created_at),
      INDEX idx_aev_sid (sid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
};

export const down = async (c) => {
  await c.query('DROP TABLE IF EXISTS acessos_eventos');
  await c.query('DROP TABLE IF EXISTS acessos_sessoes');
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
    console.error('Informe o banco no comando, ex.: DB_NAME=processo_audit_test node scripts/migrate_acessos_auditoria.js');
    process.exit(1);
  }
  const conn = await connect(dbExplicito);
  try {
    console.log(`Banco: ${dbExplicito}`);
    if (process.argv.includes('--down')) {
      await down(conn);
      console.log('✅ Auditoria de acessos revertida');
    } else {
      await up(conn);
      console.log('✅ Auditoria de acessos migrada');
    }
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}
