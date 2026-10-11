// Rotas de upload do sistema web (processos, execução, arquivos, identidade visual, fluxo visual): caracterização do que valem hoje,
// para poder trocar a biblioteca de upload (multer 1.x depreciado → 2.x) sabendo que nada muda. Roda numa pasta temporária.
import './helpers/env.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import jwt from 'jsonwebtoken';
import { pool, prepararBanco } from './helpers/db.js';

// as rotas gravam em "uploads/..." relativo à pasta de trabalho: aponta para uma pasta temporária ANTES de importá-las
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-teste-'));
for (const d of ['archives', 'branding', 'process_steps', 'steps', 'visual_processes']) fs.mkdirSync(path.join(tmp, 'uploads', d), { recursive: true });
const cwdOriginal = process.cwd();
process.chdir(tmp);

const { default: processesRouter } = await import('../src/routes/processes.js');
const { default: brandingRouter } = await import('../src/routes/branding.js');
const { default: visualRouter } = await import('../src/routes/visual_processes.js');
const { default: executionsRouter } = await import('../src/routes/executions.js');
const { default: filesRouter } = await import('../src/routes/files.js');

let server, base, liberarBanco, admin, manager, viewer;
const token = (u) => jwt.sign({ id: u.id, role: u.role, email: u.email }, process.env.JWT_SECRET);
const mkUser = async (role) => {
  const email = `${role}@up.local`;
  const [r] = await pool.query('INSERT INTO users (email,password,name,role) VALUES (?,?,?,?)', [email, 'x', role, role]);
  return { id: r.insertId, role, email };
};
const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from('conteudo de teste')]);
const enviar = async (usuario, method, rota, campos, arquivos) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos ?? {})) { for (const x of [].concat(v)) fd.append(k, x); }
  for (const a of arquivos ?? []) fd.append(a.campo, new Blob([a.bytes ?? PNG], { type: a.tipo ?? 'image/png' }), a.nome ?? 'foto.png');
  const r = await fetch(base + rota, { method, headers: usuario ? { Authorization: `Bearer ${token(usuario)}` } : {}, body: fd });
  const texto = await r.text();
  let corpo; try { corpo = JSON.parse(texto); } catch { corpo = texto; }
  return { status: r.status, corpo };
};
const doDisco = (dir) => fs.readdirSync(path.join(tmp, 'uploads', dir));
const GRANDE = (mb) => Buffer.alloc(mb * 1024 * 1024 + 1024, 7);

before(async () => {
  liberarBanco = await prepararBanco();
  admin = await mkUser('admin'); manager = await mkUser('manager'); viewer = await mkUser('viewer');
  await pool.query('CREATE TABLE folders (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NOT NULL, parent_id INT NULL, user_id INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
  await pool.query('CREATE TABLE files (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NOT NULL, folder_id INT NULL, file_path VARCHAR(500) NOT NULL, file_type VARCHAR(100), file_size INT, user_id INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
  await pool.query('CREATE TABLE step_executions (id INT PRIMARY KEY AUTO_INCREMENT, completed_at DATETIME NULL, notes TEXT NULL, photo_url VARCHAR(500) NULL, completed_by INT NULL)');
  const app = express(); app.use(express.json());
  app.use('/api', processesRouter); app.use('/api', brandingRouter); app.use('/api', visualRouter); app.use('/api', executionsRouter); app.use('/api', filesRouter);
  app.use((err, req, res, next) => { res.status(err.status || 500).json({ error: err.message, code: err.code }); }); // erro de upload sai em JSON, como o app web já tratava
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { server?.close(); await liberarBanco?.(); await pool.end(); process.chdir(cwdOriginal); fs.rmSync(tmp, { recursive: true, force: true }); });

test('foto de passo (processos): admin e gerente enviam PNG e o arquivo vai para o disco; visitante e anônimo são barrados', async () => {
  const antes = doDisco('process_steps').length;
  const a = await enviar(admin, 'POST', '/processes/upload-step-photo', {}, [{ campo: 'photo' }]);
  assert.equal(a.status, 200);
  assert.match(a.corpo.photo_url, /^\/uploads\/process_steps\/template-\d+-\d+\.png$/);
  assert.ok(fs.existsSync(path.join(tmp, a.corpo.photo_url.slice(1))));
  assert.equal((await enviar(manager, 'POST', '/processes/upload-step-photo', {}, [{ campo: 'photo' }])).status, 200);
  assert.equal(doDisco('process_steps').length, antes + 2);
  assert.equal((await enviar(viewer, 'POST', '/processes/upload-step-photo', {}, [{ campo: 'photo' }])).status, 403);
  assert.equal((await enviar(null, 'POST', '/processes/upload-step-photo', {}, [{ campo: 'photo' }])).status, 401);
  assert.equal(doDisco('process_steps').length, antes + 2); // os barrados não deixaram arquivo
});

test('foto de passo: só imagem (tipo E extensão), no máximo 5 MB, campo certo; nada fica pela metade no disco', async () => {
  const antes = doDisco('process_steps').length;
  const texto = await enviar(admin, 'POST', '/processes/upload-step-photo', {}, [{ campo: 'photo', tipo: 'text/plain', nome: 'x.txt', bytes: Buffer.from('oi') }]);
  assert.ok(texto.status >= 400, 'texto recusado');
  assert.match(String(texto.corpo.error), /Apenas imagens/);
  const falsa = await enviar(admin, 'POST', '/processes/upload-step-photo', {}, [{ campo: 'photo', tipo: 'image/png', nome: 'virus.exe' }]);
  assert.ok(falsa.status >= 400, 'extensão .exe com tipo de imagem recusada');
  const grande = await enviar(admin, 'POST', '/processes/upload-step-photo', {}, [{ campo: 'photo', bytes: GRANDE(5) }]);
  assert.ok(grande.status >= 400, '5 MB + 1 KB recusado');
  assert.equal(grande.corpo.code, 'LIMIT_FILE_SIZE');
  const campoErrado = await enviar(admin, 'POST', '/processes/upload-step-photo', {}, [{ campo: 'imagem' }]);
  assert.ok(campoErrado.status >= 400);
  assert.equal(campoErrado.corpo.code, 'LIMIT_UNEXPECTED_FILE');
  assert.equal((await enviar(admin, 'POST', '/processes/upload-step-photo', {}, [])).status, 400); // sem arquivo
  assert.equal(doDisco('process_steps').length, antes);
});

test('identidade visual: só admin; PNG e SVG passam, acima de 2 MB não', async () => {
  const antes = doDisco('branding').length;
  const ok = await enviar(admin, 'POST', '/branding/upload', {}, [{ campo: 'image' }]);
  assert.equal(ok.status, 200);
  assert.match(ok.corpo.url, /^\/uploads\/branding\/branding-\d+-\d+\.png$/);
  assert.equal((await enviar(admin, 'POST', '/branding/upload', {}, [{ campo: 'image', tipo: 'image/svg+xml', nome: 'logo.svg', bytes: Buffer.from('<svg/>') }])).status, 200);
  assert.equal((await enviar(manager, 'POST', '/branding/upload', {}, [{ campo: 'image' }])).status, 403);
  const grande = await enviar(admin, 'POST', '/branding/upload', {}, [{ campo: 'image', bytes: GRANDE(2) }]);
  assert.equal(grande.corpo.code, 'LIMIT_FILE_SIZE');
  assert.equal(doDisco('branding').length, antes + 2);
});

test('fluxo visual: admin e gerente enviam; 5 MB é o limite; só imagem', async () => {
  const antes = doDisco('visual_processes').length;
  const ok = await enviar(manager, 'POST', '/visual-processes/upload', {}, [{ campo: 'image', tipo: 'image/webp', nome: 'etapa.webp' }]);
  assert.equal(ok.status, 200);
  assert.match(ok.corpo.url, /^\/uploads\/visual_processes\/stage-\d+-\d+\.webp$/);
  assert.equal((await enviar(viewer, 'POST', '/visual-processes/upload', {}, [{ campo: 'image' }])).status, 403);
  assert.equal((await enviar(admin, 'POST', '/visual-processes/upload', {}, [{ campo: 'image', bytes: GRANDE(5) }])).corpo.code, 'LIMIT_FILE_SIZE');
  assert.ok((await enviar(admin, 'POST', '/visual-processes/upload', {}, [{ campo: 'image', tipo: 'application/pdf', nome: 'a.pdf' }])).status >= 400);
  assert.equal(doDisco('visual_processes').length, antes + 1);
});

test('execução: concluir passo com foto e observação grava o caminho; sem foto grava null; passo inexistente dá 404', async () => {
  const [r] = await pool.query('INSERT INTO step_executions () VALUES ()');
  const id = r.insertId;
  const com = await enviar(viewer, 'PUT', `/step-executions/${id}/complete`, { notes: 'feito ok' }, [{ campo: 'photo' }]);
  assert.equal(com.status, 200);
  assert.match(com.corpo.photo_url, /^\/uploads\/steps\/step-\d+-\d+\.png$/);
  assert.ok(fs.existsSync(path.join(tmp, com.corpo.photo_url.slice(1))));
  const [[linha]] = await pool.query('SELECT notes, photo_url, completed_by FROM step_executions WHERE id = ?', [id]);
  assert.deepEqual({ notes: linha.notes, photo_url: linha.photo_url, completed_by: linha.completed_by }, { notes: 'feito ok', photo_url: com.corpo.photo_url, completed_by: viewer.id });
  const [r2] = await pool.query('INSERT INTO step_executions () VALUES ()');
  const sem = await enviar(admin, 'PUT', `/step-executions/${r2.insertId}/complete`, { notes: 'sem foto' }, []);
  assert.equal(sem.status, 200);
  assert.equal(sem.corpo.photo_url, null);
  assert.equal((await enviar(admin, 'PUT', '/step-executions/999999/complete', {}, [])).status, 404);
  assert.equal((await enviar(null, 'PUT', `/step-executions/${id}/complete`, {}, [{ campo: 'photo' }])).status, 401);
});

test('arquivos: envio de vários arquivos com caminhos relativos cria as pastas e grava o nome ORIGINAL (com acento) e o tamanho', async () => {
  const bytes = Buffer.from('conteúdo do relatório');
  const r = await enviar(viewer, 'POST', '/files/upload', { folder_id: 'null', paths: ['Projetos/2026/relatório.pdf', 'leia-me.txt'] }, [
    { campo: 'files', tipo: 'application/pdf', nome: 'relatório.pdf', bytes }, { campo: 'files', tipo: 'text/plain', nome: 'leia-me.txt', bytes: Buffer.from('oi') },
  ]);
  assert.equal(r.status, 201, JSON.stringify(r.corpo));
  assert.deepEqual(r.corpo.map((x) => x.name), ['relatório.pdf', 'leia-me.txt']);
  const [linhas] = await pool.query('SELECT name, file_path, file_type, file_size, user_id, folder_id FROM files ORDER BY id');
  assert.equal(linhas.length, 2);
  assert.equal(linhas[0].file_size, bytes.length);
  assert.equal(linhas[0].file_type, 'application/pdf');
  assert.equal(linhas[0].user_id, viewer.id);
  assert.ok(linhas[0].folder_id !== null, 'a pasta "Projetos/2026" foi criada');
  assert.equal(linhas[1].folder_id, null);
  for (const l of linhas) assert.ok(fs.existsSync(path.join(tmp, l.file_path.slice(1))));
  assert.match(linhas[0].file_path, /^\/uploads\/archives\/\d+-\d+-/);
  assert.equal((await enviar(null, 'POST', '/files/upload', {}, [{ campo: 'files' }])).status, 401);
});

test('arquivos: nome fora do latim (japonês, emoji) também volta inteiro', async () => {
  const r = await enviar(admin, 'POST', '/files/upload', { folder_id: 'null', paths: '日本語 😀.txt' }, [{ campo: 'files', tipo: 'text/plain', nome: '日本語 😀.txt', bytes: Buffer.from('x') }]);
  assert.equal(r.status, 201);
  assert.equal(r.corpo[0].name, '日本語 😀.txt');
});

test('arquivos: um arquivo só (caminho como texto) também funciona', async () => {
  const r = await enviar(admin, 'POST', '/files/upload', { folder_id: 'null', paths: 'unico.txt' }, [{ campo: 'files', tipo: 'text/plain', nome: 'unico.txt', bytes: Buffer.from('x') }]);
  assert.equal(r.status, 201);
  assert.equal(r.corpo.length, 1);
});
