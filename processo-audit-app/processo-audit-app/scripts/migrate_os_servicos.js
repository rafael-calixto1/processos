/**
 * Migration: serviços realizados em cada OS.
 *
 *   node scripts/migrate_os_servicos.js          # aplica (idempotente)
 *   node scripts/migrate_os_servicos.js --down   # remove a tabela
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
  await conn.query('DROP TABLE IF EXISTS os_servicos');
  console.log('os_servicos removida');
} else {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS os_servicos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      os_id INT NOT NULL,
      descricao VARCHAR(255) NOT NULL,
      quantidade DECIMAL(10,2) NOT NULL DEFAULT 1,
      criado_por INT NOT NULL,
      criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_os_serv_os (os_id),
      CONSTRAINT fk_os_serv_os FOREIGN KEY (os_id) REFERENCES ordens_servico(id) ON DELETE CASCADE,
      CONSTRAINT fk_os_serv_user FOREIGN KEY (criado_por) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('os_servicos pronta');
}
await conn.end();
