/**
 * Migration: na Frota nada é apagado, só inativado.
 *
 *   DB_NAME=processo_audit_test node scripts/migrate_frota_inativacao.js          # aplica (idempotente)
 *   DB_NAME=processo_audit_test node scripts/migrate_frota_inativacao.js --down   # reverte
 *
 * Pela CLI o DB_NAME precisa vir explícito no comando (o valor do .env é ignorado de propósito),
 * para nunca migrar o banco de produção por engano.
 *
 * Veículos e tipos de manutenção já tinham `status`; aqui ganham a mesma coluna motoristas,
 * abastecimentos, trocas de óleo/pneu e o histórico de manutenção. Registro inativo continua
 * na lista (com filtro), mas sai dos painéis, custos e do cálculo de manutenção preventiva.
 */
import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const dbExplicito = process.env.DB_NAME; // antes do dotenv: só vale o que veio do comando
dotenv.config();

export const TABELAS = [
  'fleet_drivers',
  'fleet_fueling',
  'fleet_oil_changes',
  'fleet_tire_changes',
  'fleet_maintenance_history',
];

const temStatus = async (c, tabela) => {
  const [rows] = await c.query(
    `SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'status'`,
    [tabela]
  );
  return rows.length > 0;
};

export const up = async (c) => {
  for (const t of TABELAS) {
    if (await temStatus(c, t)) continue;
    await c.query(`ALTER TABLE ${t} ADD COLUMN status ENUM('active','inactive') NOT NULL DEFAULT 'active'`);
  }
};

export const down = async (c) => {
  for (const t of TABELAS) {
    if (await temStatus(c, t)) await c.query(`ALTER TABLE ${t} DROP COLUMN status`);
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
    console.error('Informe o banco no comando, ex.: DB_NAME=processo_audit_test node scripts/migrate_frota_inativacao.js');
    process.exit(1);
  }
  const conn = await connect(dbExplicito);
  try {
    console.log(`Banco: ${dbExplicito}`);
    if (process.argv.includes('--down')) {
      await down(conn);
      console.log('✅ Inativação da Frota revertida');
    } else {
      await up(conn);
      console.log('✅ Inativação da Frota migrada');
    }
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}
