// ---------------------------------------------------------------------------
// Cria os processos FULLTRACK (9 processos / 52 passos) a partir do manual.
//
//   node scripts/seed_fulltrack.js
//
// Idempotente: se já existir processo com o mesmo título no departamento,
// o script aborta sem gravar nada e informa quais títulos colidiram.
// As Fotos de Instrução são anexadas depois por attach_fulltrack_photos.js.
// ---------------------------------------------------------------------------

import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';
import { processes, DEPARTMENT_NAME } from './fulltrack_data.js';

dotenv.config();

const AUTHOR_EMAIL = process.env.SEED_AUTHOR_EMAIL || 'admin@empresa.com';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'processo_audit',
  waitForConnections: true,
  connectionLimit: 10,
});

async function main() {
  const [[dep]] = await pool.execute(
    'SELECT id FROM departments WHERE name = ?', [DEPARTMENT_NAME]
  );
  if (!dep) throw new Error(`Departamento "${DEPARTMENT_NAME}" não encontrado.`);

  const [[author]] = await pool.execute(
    'SELECT id FROM users WHERE email = ?', [AUTHOR_EMAIL]
  );
  if (!author) throw new Error(`Usuário autor "${AUTHOR_EMAIL}" não encontrado.`);

  // Idempotência: nenhum título pode existir ainda
  const titles = processes.map(p => p.title);
  const [existing] = await pool.query(
    'SELECT title FROM processes WHERE department_id = ? AND title IN (?)',
    [dep.id, titles]
  );
  if (existing.length) {
    console.error('ABORTADO — já existem processos com estes títulos:');
    existing.forEach(r => console.error(`  - ${r.title}`));
    console.error('Remova-os ou ajuste o script antes de rodar novamente.');
    process.exitCode = 1;
    return;
  }

  for (const proc of processes) {
    const [res] = await pool.execute(
      `INSERT INTO processes (title, description, department_id, created_by, status)
       VALUES (?, ?, ?, ?, 'active')`,
      [proc.title, proc.description, dep.id, author.id]
    );
    const processId = res.insertId;

    for (let i = 0; i < proc.steps.length; i++) {
      const step = proc.steps[i];
      await pool.execute(
        `INSERT INTO steps (process_id, step_number, title, description, section, documentation_markdown, photo_url)
         VALUES (?, ?, ?, ?, ?, '', NULL)`,
        [processId, i + 1, step.title, step.description, step.section]
      );
    }

    await pool.execute(
      `INSERT INTO audit_logs (process_id, user_id, action, old_data, new_data, ip_address, user_agent)
       VALUES (?, ?, 'CREATE', NULL, ?, '', 'scripts/seed_fulltrack.js')`,
      [processId, author.id, JSON.stringify({
        title: proc.title, description: proc.description, department_id: dep.id,
      })]
    );

    console.log(`#${processId}  ${proc.title}  (${proc.steps.length} passos)`);
  }

  console.log(`\nOK: ${processes.length} processos criados em ${DEPARTMENT_NAME}.`);
}

main()
  .catch(err => { console.error('ERRO:', err.message); process.exitCode = 1; })
  .finally(() => pool.end());
