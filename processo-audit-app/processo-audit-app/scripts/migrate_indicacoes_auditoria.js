/**
 * Migration: auditoria do módulo Indique e Ganhe.
 *
 *   DB_NAME=processo_audit_test node scripts/migrate_indicacoes_auditoria.js          # aplica (idempotente)
 *   DB_NAME=processo_audit_test node scripts/migrate_indicacoes_auditoria.js --down   # reverte
 *
 * Pela CLI o DB_NAME precisa vir explícito no comando (o valor do .env é ignorado de propósito),
 * para nunca migrar o banco de produção por engano.
 *
 * Cria indicacao_auditoria: quem fez o quê no módulo (criou, editou, cancelou, apagou, mudou
 * configuração), de onde veio a informação (painel, portal público, webhook ou sincronização com o
 * Hubsoft) e o IP. Sem FK para indicacoes de propósito: o registro precisa sobreviver quando a
 * indicação é apagada (indicacao_eventos é apagado junto com ela).
 */
import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const dbExplicito = process.env.DB_NAME; // antes do dotenv: só vale o que veio do comando
dotenv.config();

export const up = async (c) => {
  await c.query(`
    CREATE TABLE IF NOT EXISTS indicacao_auditoria (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      acao VARCHAR(40) NOT NULL,
      origem VARCHAR(30) NOT NULL,
      entidade VARCHAR(30) NOT NULL DEFAULT 'indicacao',
      id_indicacao INT NULL,
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
      INDEX idx_aud_data (created_at),
      INDEX idx_aud_acao (acao, created_at),
      INDEX idx_aud_origem (origem, created_at),
      INDEX idx_aud_indicacao (id_indicacao),
      INDEX idx_aud_usuario (usuario_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
};

export const down = async (c) => {
  await c.query('DROP TABLE IF EXISTS indicacao_auditoria');
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
    console.error('Informe o banco no comando, ex.: DB_NAME=processo_audit_test node scripts/migrate_indicacoes_auditoria.js');
    process.exit(1);
  }
  const conn = await connect(dbExplicito);
  try {
    console.log(`Banco: ${dbExplicito}`);
    if (process.argv.includes('--down')) {
      await down(conn);
      console.log('✅ Auditoria do Indique e Ganhe revertida');
    } else {
      await up(conn);
      console.log('✅ Auditoria do Indique e Ganhe migrada');
    }
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}
