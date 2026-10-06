/**
 * Migration: compra com vários itens (coluna grupo_id em estoque_compras).
 *
 *   node scripts/migrate_compras_grupo.js          # aplica (idempotente)
 *   node scripts/migrate_compras_grupo.js --down   # remove a coluna
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

const [cols] = await conn.query("SHOW COLUMNS FROM estoque_compras LIKE 'grupo_id'");
if (process.argv.includes('--down')) {
  if (cols.length) await conn.query('ALTER TABLE estoque_compras DROP INDEX idx_compras_grupo, DROP COLUMN grupo_id');
  console.log('grupo_id removida');
} else {
  if (!cols.length) await conn.query('ALTER TABLE estoque_compras ADD COLUMN grupo_id VARCHAR(40) NULL AFTER chave_idempotencia, ADD INDEX idx_compras_grupo (grupo_id)');
  console.log('grupo_id pronta');
}
await conn.end();
