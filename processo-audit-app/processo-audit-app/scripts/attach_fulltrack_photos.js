// ---------------------------------------------------------------------------
// Anexa as Fotos de Instrução aos passos dos processos FULLTRACK.
//
//   node scripts/attach_fulltrack_photos.js <pasta-base> [--dry-run]
//
// <pasta-base> é o equivalente local de "G:\Meu Drive\segundo cerebro".
// O script procura cada imagem pelo caminho relativo do Anexo A e, se não
// achar, faz uma busca recursiva pelo nome do arquivo dentro da pasta-base.
//
// Copia a imagem para uploads/process_steps/ com o mesmo padrão de nome do
// multer e grava a URL relativa em steps.photo_url. Só toca em passos cujo
// photo_url ainda está vazio — rodar de novo não duplica arquivos.
// ---------------------------------------------------------------------------

import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { processes, PHOTO_PATHS, DEPARTMENT_NAME } from './fulltrack_data.js';

dotenv.config();

const BASE_DIR = process.argv[2];
const DRY_RUN = process.argv.includes('--dry-run');
const DEST_DIR = 'uploads/process_steps';
const ALLOWED = /\.(jpe?g|png|webp)$/i;
const MAX_BYTES = 5 * 1024 * 1024;

if (!BASE_DIR) {
  console.error('Uso: node scripts/attach_fulltrack_photos.js <pasta-base> [--dry-run]');
  console.error('Ex.: node scripts/attach_fulltrack_photos.js /root/fulltrack-imagens');
  process.exit(1);
}
if (!fs.existsSync(BASE_DIR)) {
  console.error(`Pasta-base não encontrada: ${BASE_DIR}`);
  process.exit(1);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'processo_audit',
  waitForConnections: true,
  connectionLimit: 10,
});

// Índice nome-de-arquivo -> caminho, para o fallback de busca recursiva
const byBasename = new Map();
(function indexDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) indexDir(full);
    else if (!byBasename.has(entry.name)) byBasename.set(entry.name, full);
  }
})(BASE_DIR);

function locate(placeholder) {
  const rel = PHOTO_PATHS[placeholder];
  if (!rel) return null;
  const direct = path.join(BASE_DIR, rel);
  if (fs.existsSync(direct)) return direct;
  return byBasename.get(path.basename(rel)) || null;
}

function copyIntoUploads(src) {
  const suffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const filename = 'template-' + suffix + path.extname(src).toLowerCase();
  fs.mkdirSync(DEST_DIR, { recursive: true });
  fs.copyFileSync(src, path.join(DEST_DIR, filename));
  return `/uploads/${path.basename(DEST_DIR)}/${filename}`;
}

async function main() {
  const [[dep]] = await pool.execute(
    'SELECT id FROM departments WHERE name = ?', [DEPARTMENT_NAME]
  );
  if (!dep) throw new Error(`Departamento "${DEPARTMENT_NAME}" não encontrado.`);

  let anexadas = 0, jaTinha = 0;
  const falhas = [];

  for (const proc of processes) {
    const [[row]] = await pool.execute(
      'SELECT id FROM processes WHERE department_id = ? AND title = ?',
      [dep.id, proc.title]
    );
    if (!row) {
      falhas.push(`${proc.title}: processo não encontrado no banco`);
      continue;
    }

    for (let i = 0; i < proc.steps.length; i++) {
      const step = proc.steps[i];
      if (!step.photo) continue;

      const [[dbStep]] = await pool.execute(
        'SELECT id, photo_url FROM steps WHERE process_id = ? AND step_number = ?',
        [row.id, i + 1]
      );
      if (!dbStep) {
        falhas.push(`${proc.title} passo ${i + 1}: passo não encontrado`);
        continue;
      }
      if (dbStep.photo_url) { jaTinha++; continue; }

      const src = locate(step.photo);
      if (!src) {
        falhas.push(`${proc.title} passo ${i + 1}: imagem não encontrada [${step.photo}]`);
        continue;
      }
      if (!ALLOWED.test(src)) {
        falhas.push(`${proc.title} passo ${i + 1}: extensão não aceita pelo sistema (${path.extname(src)})`);
        continue;
      }
      if (fs.statSync(src).size > MAX_BYTES) {
        console.warn(`  AVISO: ${path.basename(src)} passa de 5 MB (limite do upload pela tela).`);
      }

      if (DRY_RUN) {
        console.log(`  [dry-run] ${proc.title} passo ${i + 1} <- ${src}`);
        anexadas++;
        continue;
      }

      const photoUrl = copyIntoUploads(src);
      await pool.execute('UPDATE steps SET photo_url = ? WHERE id = ?', [photoUrl, dbStep.id]);
      console.log(`  ${proc.title} passo ${i + 1} <- ${photoUrl}`);
      anexadas++;
    }
  }

  console.log(`\nFotos anexadas: ${anexadas}${DRY_RUN ? ' (dry-run, nada gravado)' : ''}`);
  if (jaTinha) console.log(`Passos que já tinham foto (ignorados): ${jaTinha}`);
  if (falhas.length) {
    console.log(`\nFalhas (${falhas.length}):`);
    falhas.forEach(f => console.log(`  - ${f}`));
    process.exitCode = 1;
  }
}

main()
  .catch(err => { console.error('ERRO:', err.message); process.exitCode = 1; })
  .finally(() => pool.end());
