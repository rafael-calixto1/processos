/**
 * Migration: rascunho da finalização de cada OS (progresso do técnico em campo).
 *
 *   node scripts/migrate_os_rascunhos.js          # aplica (idempotente)
 *   node scripts/migrate_os_rascunhos.js --down   # remove a tabela
 */
import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'processo_audit',
});

if (process.argv.includes('--down')) {
  await conn.query('DROP TABLE IF EXISTS os_rascunhos');
  console.log('os_rascunhos removida');
} else {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS os_rascunhos (
      os_id INT NOT NULL PRIMARY KEY,
      dados LONGTEXT NOT NULL,
      atualizado_por INT NULL,
      atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_os_rasc_os FOREIGN KEY (os_id) REFERENCES ordens_servico(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('os_rascunhos pronta');
}
await conn.end();
