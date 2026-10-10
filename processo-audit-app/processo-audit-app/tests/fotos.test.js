// Fotos de serviço: upload multipart, armazenamento privado e acesso só pela API autenticada.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';

const fotosDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fotos-teste-'));
process.env.FOTOS_DIR = fotosDir;
const { pool, prepararBanco } = await import('./helpers/db.js');
const svc = await import('../src/services/estoqueService.js');
const { diretorioFotos, detectarImagem } = await import('../src/services/fotosService.js');
const { default: osRouter } = await import('../src/routes/os.js');

let server, base, liberarBanco, almox, u1, u2, t1, t2;
const token = (u) => jwt.sign({ id: u.id, role: u.role, email: u.email }, process.env.JWT_SECRET);
const JPEG = (extra = 'foto') => Buffer.concat([Buffer.from('ffd8ffe000104a46494600010100000100010000', 'hex'), Buffer.from(extra), Buffer.from('ffd9', 'hex')]);
const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from('0000000d49484452', 'hex')]);
const HEIC = Buffer.concat([Buffer.from('00000018', 'hex'), Buffer.from('ftypheic'), Buffer.from('00000000mif1heic')]);

const mkUser = async (role, n) => {
  const email = `${role}${n}@t.local`;
  const [r] = await pool.query('INSERT INTO users (email,password,name,role) VALUES (?,?,?,?)', [email, 'x', `${role} ${n}`, role]);
  return { id: r.insertId, role, email };
};
const ins = async (sql, p) => (await pool.query(sql, p))[0].insertId;
const enviar = async (user, osId, { buffer = JPEG(), uuid = randomUUID(), nome = 'IMG_0001.jpg', tipo = 'image/jpeg', campos = {}, chave, campo = 'foto' } = {}) => {
  const fd = new FormData();
  if (buffer) fd.append(campo, new Blob([buffer], { type: tipo }), nome);
  if (uuid) fd.append('client_uuid', uuid);
  for (const [k, v] of Object.entries(campos)) fd.append(k, v);
  const r = await fetch(`${base}/os/${osId}/fotos`, {
    method: 'POST', headers: { Authorization: `Bearer ${token(user)}`, ...(chave && { 'Idempotency-Key': chave }) }, body: fd,
  });
  return { status: r.status, headers: r.headers, body: await r.json().catch(() => ({})), uuid };
};
const get = (user, path_) => fetch(base + path_, { headers: user ? { Authorization: `Bearer ${token(user)}` } : {} });
const arquivosNoDisco = () => fs.readdirSync(fotosDir);
const novaOS = (tec) => svc.criarOS({ cliente: 'C', tecnico_id: tec }, almox.id);

before(async () => {
  liberarBanco = await prepararBanco();
  almox = await mkUser('estoque', 1); u1 = await mkUser('tecnico', 1); u2 = await mkUser('tecnico', 2);
  t1 = await ins("INSERT INTO tecnicos (nome,tipo,usuario_id) VALUES ('T1','interno',?)", [u1.id]);
  t2 = await ins("INSERT INTO tecnicos (nome,tipo,usuario_id) VALUES ('T2','interno',?)", [u2.id]);
  const app = express(); app.use(express.json()); app.use('/api/os', osRouter);
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  server?.close(); await liberarBanco?.(); await pool.end();
  fs.rmSync(fotosDir, { recursive: true, force: true });
});

test('upload de JPEG: grava linha e arquivo com nome aleatório, sem expor o caminho', async () => {
  const o = await novaOS(t1);
  const r = await enviar(u1, o.id, { nome: 'minha-casa-do-cliente.jpg', campos: { tirada_em: '2026-10-10T12:00:00Z', lat: '-23.5', lng: '-46.6', legenda: 'CEO fechada' } });
  assert.equal(r.status, 201);
  assert.equal(r.body.mime, 'image/jpeg');
  assert.equal(r.body.client_uuid, r.uuid);
  assert.equal(r.body.legenda, 'CEO fechada');
  assert.equal(r.body.lat, -23.5);
  assert.equal(r.body.arquivo, undefined, 'o nome em disco não vai na resposta');
  const [[linha]] = await pool.query('SELECT * FROM os_fotos WHERE id = ?', [r.body.id]);
  assert.match(linha.arquivo, /^[0-9a-f-]{36}\.jpg$/);
  assert.ok(!linha.arquivo.includes('casa'));
  assert.ok(arquivosNoDisco().includes(linha.arquivo));
  assert.equal(fs.statSync(path.join(fotosDir, linha.arquivo)).mode & 0o777, 0o600);
});

test('PNG é aceito; HEIC, texto disfarçado de imagem e arquivo vazio são recusados', async () => {
  const o = await novaOS(t1);
  assert.equal((await enviar(u1, o.id, { buffer: PNG, nome: 'a.png', tipo: 'image/png' })).status, 201);
  const heic = await enviar(u1, o.id, { buffer: HEIC, nome: 'a.heic', tipo: 'image/heic' });
  assert.equal(heic.status, 400); assert.match(heic.body.error, /HEIC/);
  const falsa = await enviar(u1, o.id, { buffer: Buffer.from('<?php echo 1; ?> isto não é imagem nenhuma'), nome: 'a.jpg', tipo: 'image/jpeg' });
  assert.equal(falsa.status, 400); assert.match(falsa.body.error, /JPEG ou PNG/);
  assert.equal((await enviar(u1, o.id, { buffer: null })).status, 400);
  const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM os_fotos WHERE os_id = ?', [o.id]);
  assert.equal(n, 1);
});

test('client_uuid ausente ou inválido é 400; foto grande demais é 413', async () => {
  const o = await novaOS(t1);
  assert.equal((await enviar(u1, o.id, { uuid: null })).status, 400);
  assert.equal((await enviar(u1, o.id, { uuid: 'não-é-uuid' })).status, 400);
  const grande = Buffer.concat([JPEG(), Buffer.alloc(8 * 1024 * 1024)]);
  const r = await enviar(u1, o.id, { buffer: grande });
  assert.equal(r.status, 413); assert.match(r.body.error, /8 MB/);
});

test('reenviar o mesmo client_uuid não duplica foto nem arquivo (com e sem Idempotency-Key)', async () => {
  const o = await novaOS(t1);
  const antes = arquivosNoDisco().length;
  const uuid = randomUUID();
  const a = await enviar(u1, o.id, { uuid });
  const b = await enviar(u1, o.id, { uuid });
  assert.equal(a.status, 201); assert.equal(b.status, 201);
  assert.equal(b.body.repetida, true); assert.equal(b.body.id, a.body.id);

  const chave = randomUUID(); const uuid2 = randomUUID();
  const c = await enviar(u1, o.id, { uuid: uuid2, chave });
  const d = await enviar(u1, o.id, { uuid: uuid2, chave });
  assert.equal(d.body.repetida, true);
  assert.equal(d.headers.get('idempotent-replayed'), 'true');
  assert.equal(d.body.id, c.body.id);
  const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM os_fotos WHERE os_id = ?', [o.id]);
  assert.equal(n, 2);
  assert.equal(arquivosNoDisco().length - antes, 2);
  // mesma chave com outra foto: recusado
  assert.equal((await enviar(u1, o.id, { uuid: randomUUID(), chave })).status, 422);
});

test('envios simultâneos do mesmo client_uuid resultam em uma única foto', async () => {
  const o = await novaOS(t1);
  const antes = arquivosNoDisco().length;
  const uuid = randomUUID();
  const rs = await Promise.all(Array.from({ length: 4 }, () => enviar(u1, o.id, { uuid })));
  assert.ok(rs.every((r) => r.status === 201), JSON.stringify(rs.map((r) => r.status)));
  assert.equal(new Set(rs.map((r) => r.body.id)).size, 1);
  const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM os_fotos WHERE os_id = ?', [o.id]);
  assert.equal(n, 1);
  assert.equal(arquivosNoDisco().length - antes, 1);
});

test('baixar a foto devolve os mesmos bytes, com cabeçalhos de privacidade', async () => {
  const o = await novaOS(t1);
  const conteudo = JPEG('conteudo-unico-123');
  const up = await enviar(u1, o.id, { buffer: conteudo });
  const r = await get(u1, `/os/${o.id}/fotos/${up.body.id}`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/jpeg');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.match(r.headers.get('cache-control'), /private/);
  assert.ok(Buffer.from(await r.arrayBuffer()).equals(conteudo));
  const lista = await (await get(u1, `/os/${o.id}/fotos`)).json();
  assert.deepEqual(lista.map((f) => f.id), [up.body.id]);
  assert.equal(lista[0].arquivo, undefined);
});

test('sem login é 401/403; técnico de outra OS não envia, não lista, não baixa e não apaga; o estoque (staff) vê', async () => {
  const o = await novaOS(t1);
  const up = await enviar(u1, o.id);
  assert.ok([401, 403].includes((await get(null, `/os/${o.id}/fotos/${up.body.id}`)).status));
  assert.equal((await enviar(u2, o.id)).status, 403);
  assert.equal((await get(u2, `/os/${o.id}/fotos`)).status, 403);
  assert.equal((await get(u2, `/os/${o.id}/fotos/${up.body.id}`)).status, 403);
  assert.equal((await fetch(`${base}/os/${o.id}/fotos/${up.body.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token(u2)}` } })).status, 403);
  assert.equal((await get(almox, `/os/${o.id}/fotos/${up.body.id}`)).status, 200);
  const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM os_fotos WHERE os_id = ?', [o.id]);
  assert.equal(n, 1);
});

test('a foto só é servida pela OS a que pertence (id de foto de outra OS dá 404)', async () => {
  const a = await novaOS(t1); const b = await novaOS(t1);
  const fa = await enviar(u1, a.id);
  assert.equal((await get(u1, `/os/${b.id}/fotos/${fa.body.id}`)).status, 404);
  assert.equal((await get(u1, `/os/${a.id}/fotos/99999999`)).status, 404);
});

test('OS encerrada: não aceita nem remove fotos, mas continua mostrando', async () => {
  const o = await novaOS(t1);
  const up = await enviar(u1, o.id);
  await svc.fecharOS({ os_id: o.id }, { id: u1.id, role: 'tecnico', tecnicoId: t1 });
  const novo = await enviar(u1, o.id);
  assert.equal(novo.status, 409);
  const del = await fetch(`${base}/os/${o.id}/fotos/${up.body.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token(u1)}` } });
  assert.equal(del.status, 409);
  assert.equal((await get(u1, `/os/${o.id}/fotos/${up.body.id}`)).status, 200);
});

test('apagar remove a linha e o arquivo; apagar de novo é 404', async () => {
  const o = await novaOS(t1);
  const up = await enviar(u1, o.id);
  const [[{ arquivo }]] = await pool.query('SELECT arquivo FROM os_fotos WHERE id = ?', [up.body.id]);
  assert.ok(arquivosNoDisco().includes(arquivo));
  const del = () => fetch(`${base}/os/${o.id}/fotos/${up.body.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token(u1)}` } });
  assert.equal((await del()).status, 200);
  assert.ok(!arquivosNoDisco().includes(arquivo));
  assert.equal((await del()).status, 404);
});

test('limite de 30 fotos por OS', async () => {
  const o = await novaOS(t1);
  for (let i = 0; i < 30; i++) {
    await pool.query("INSERT INTO os_fotos (os_id,arquivo,mime,tamanho,client_uuid,criado_por) VALUES (?,?,?,?,?,?)", [o.id, `x-${randomUUID()}.jpg`, 'image/jpeg', 10, randomUUID(), u1.id]);
  }
  const r = await enviar(u1, o.id);
  assert.equal(r.status, 400); assert.match(r.body.error, /Limite de 30/);
});

test('falha na gravação não deixa arquivo órfão (OS de outro técnico, validação, etc.)', async () => {
  const o = await novaOS(t2);
  const antes = arquivosNoDisco().length;
  await enviar(u1, o.id);
  await enviar(u1, o.id, { uuid: 'ruim' });
  assert.equal(arquivosNoDisco().length, antes);
});

test('o diretório de fotos padrão fica fora de uploads/ (que o servidor entrega como estático)', () => {
  const salvo = process.env.FOTOS_DIR; delete process.env.FOTOS_DIR;
  try {
    const padrao = diretorioFotos();
    assert.ok(!padrao.split(path.sep).includes('uploads'), padrao);
    assert.ok(padrao.endsWith(path.join('storage', 'os_fotos')));
  } finally { process.env.FOTOS_DIR = salvo; }
  assert.equal(detectarImagem(JPEG()).mime, 'image/jpeg');
  assert.equal(detectarImagem(Buffer.from('GIF89a------------')), null);
});
