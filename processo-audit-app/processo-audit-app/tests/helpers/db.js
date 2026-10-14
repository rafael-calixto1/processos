// Banco de teste: recria o schema completo (o mesmo que a produção tem depois de todas as migrações).
import './env.js';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pool from '../../src/config/database.js';
import { up as migrarEstoque } from '../../scripts/migrate_estoque.js';
import { up as migrarMobile } from '../../scripts/migrate_os_mobile.js';
import { up as migrarAcessos } from '../../scripts/migrate_acessos_auditoria.js';

export { pool };

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LOCK = 'processo_audit_testes';

// Scripts antigos rodam sozinhos ao serem executados (não exportam up/down). A ordem importa:
// migrate_os_infra altera os_servicos, que precisa existir antes.
const MIGRACOES_LEGADAS = [
  'migrate_compras_grupo.js',
  'migrate_os_servicos.js',
  'migrate_os_infra.js',
  'migrate_os_rascunhos.js',
  'migrate_estoque_devolucoes.js',
];

// users como existe em produção depois de initDb + migrate_soft_delete
const criarUsers = (c) => c.query(`
  CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role ENUM('admin','manager','viewer') DEFAULT 'viewer',
    status ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

const apagarTudo = async (c) => {
  const [[{ db }]] = await c.query('SELECT DATABASE() AS db');
  if (!/test/.test(db)) throw new Error(`Recusando limpar o banco "${db}": não é de teste`);
  const [tabelas] = await c.query('SELECT TABLE_NAME AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?', [db]);
  await c.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const { n } of tabelas) await c.query(`DROP TABLE IF EXISTS \`${n}\``);
  await c.query('SET FOREIGN_KEY_CHECKS = 1');
};

/**
 * Pega o lock do banco de teste (o `node --test` roda um arquivo por processo, em paralelo, e todos
 * compartilham o mesmo banco), recria o schema do zero e devolve `liberar()` para chamar no `after`.
 */
export const prepararBanco = async () => {
  const c = await pool.getConnection();
  const [[{ ok }]] = await c.query('SELECT GET_LOCK(?, 300) AS ok', [LOCK]);
  if (ok !== 1) { c.release(); throw new Error('Outro teste está usando o banco de teste há mais de 5 minutos'); }
  try {
    await apagarTudo(c);
    await criarUsers(c);
    await migrarEstoque(c);
    for (const arquivo of MIGRACOES_LEGADAS) {
      execFileSync(process.execPath, [path.join(raiz, 'scripts', arquivo)], {
        cwd: raiz, env: { ...process.env, DB_NAME: process.env.DB_NAME }, stdio: 'pipe',
      });
    }
    await migrarMobile(c);
    await migrarAcessos(c);
  } catch (err) {
    await c.query('SELECT RELEASE_LOCK(?)', [LOCK]).catch(() => {});
    c.release();
    throw err;
  }
  return async () => {
    await c.query('SELECT RELEASE_LOCK(?)', [LOCK]).catch(() => {});
    c.release();
  };
};
