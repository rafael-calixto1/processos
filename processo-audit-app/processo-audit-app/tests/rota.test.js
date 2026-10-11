// Rota do trecho no lançamento (até 25 pontos + caminho) e validação de GET /geo/rota (sem depender de internet).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { pool, prepararBanco } from './helpers/db.js';

const svc = await import('../src/services/estoqueService.js');
const { default: osRouter } = await import('../src/routes/os.js');
const { default: geoRouter } = await import('../src/routes/geo.js');

let server, base, liberarBanco, almox, u1, t1, cabo;
const token = (u) => jwt.sign({ id: u.id, role: u.role, email: u.email }, process.env.JWT_SECRET);
const call = async (user, method, path, body, headers = {}) => {
  const r = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', ...(user && { Authorization: `Bearer ${token(user)}` }), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const mkUser = async (role, n) => {
  const [r] = await pool.query('INSERT INTO users (email,password,name,role) VALUES (?,?,?,?)', [`${role}${n}@t.local`, 'x', `${role} ${n}`, role]);
  return { id: r.insertId, role, email: `${role}${n}@t.local` };
};
const ins = async (sql, p) => (await pool.query(sql, p))[0].insertId;

before(async () => {
  liberarBanco = await prepararBanco();
  almox = await mkUser('estoque', 1); u1 = await mkUser('tecnico', 1);
  t1 = await ins("INSERT INTO tecnicos (nome,tipo,usuario_id) VALUES ('Téc 1','interno',?)", [u1.id]);
  cabo = await ins("INSERT INTO estoque_itens (nome,unidade) VALUES ('Cabo Drop','metros')");
  const app = express(); app.use(express.json());
  app.use('/api/os', osRouter); app.use('/api/geo', geoRouter);
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { server?.close(); await liberarBanco?.(); await pool.end(); });

const cenario = async () => {
  const { lotes: [lote] } = await svc.criarCompra({ item_id: cabo, tipo_volume: 'bobina', qtd_volumes: 1, medida_por_volume: 1000 }, almox.id);
  await svc.retirar({ lote_id: lote.id, tecnico_id: t1, quantidade: 500 }, almox.id);
  const os = await svc.criarOS({ cliente: 'Cliente', tecnico_id: t1 }, almox.id);
  return { lote, os };
};
const pt = (i) => ({ lat: -23.5 - i * 0.001, lng: -46.3 - i * 0.001 });
const lancar = async (osId, loteId, rota, extra = {}) =>
  call(u1, 'POST', `/os/${osId}/lancamentos`, { descricao: 'Lançamento', trecho: 'A → B', materiais: [{ lote_id: loteId, quantidade: 10 }], rota, ...extra }, { 'Idempotency-Key': randomUUID() });
const rotaGuardada = async (osId) => (await call(u1, 'GET', `/os/${osId}`)).body.servicos.at(-1).rota_trecho;

test('lançamento guarda a rota (pontos, metros e caminho) e a OS a devolve igual', async () => {
  const { lote, os } = await cenario();
  const rota = { pontos: [pt(0), pt(1), pt(2)], metros: 1850.4, caminho: [[-23.5, -46.3], [-23.5005, -46.3005], [-23.502, -46.302]] };
  assert.equal((await lancar(os.id, lote.id, rota)).status, 201);
  const g = await rotaGuardada(os.id);
  assert.deepEqual(g.pontos, rota.pontos);
  assert.equal(g.metros, 1850); // arredondado
  assert.deepEqual(g.caminho, rota.caminho);
});

test('mais de 25 pontos: guarda só os 25 primeiros; caminho acima de 700 pontos é cortado', async () => {
  const { lote, os } = await cenario();
  const rota = { pontos: Array.from({ length: 30 }, (_, i) => pt(i)), metros: 5000, caminho: Array.from({ length: 800 }, (_, i) => [-23.5 - i * 1e-5, -46.3]) };
  assert.equal((await lancar(os.id, lote.id, rota)).status, 201);
  const g = await rotaGuardada(os.id);
  assert.equal(g.pontos.length, 25);
  assert.deepEqual(g.pontos[24], pt(24));
  assert.equal(g.caminho.length, 700);
});

test('exatamente 25 pontos passam inteiros', async () => {
  const { lote, os } = await cenario();
  assert.equal((await lancar(os.id, lote.id, { pontos: Array.from({ length: 25 }, (_, i) => pt(i)), metros: 10, caminho: [] })).status, 201);
  assert.equal((await rotaGuardada(os.id)).pontos.length, 25);
});

test('rota sem 2 pontos válidos não é guardada, mas o lançamento e a baixa acontecem', async () => {
  const { lote, os } = await cenario();
  assert.equal((await lancar(os.id, lote.id, { pontos: [pt(0)], metros: 10, caminho: [] })).status, 201);
  assert.equal(await rotaGuardada(os.id), null);
  assert.equal((await lancar(os.id, lote.id, { pontos: [pt(0), { lat: 95, lng: -46 }], metros: 10, caminho: [] })).status, 201); // 2º ponto impossível: sobra 1
  assert.equal(await rotaGuardada(os.id), null);
  assert.equal((await lancar(os.id, lote.id, undefined)).status, 201);
  assert.equal(await rotaGuardada(os.id), null);
});

test('ponto nulo ou vazio não vira (0, 0): é descartado', async () => {
  const { lote, os } = await cenario();
  assert.equal((await lancar(os.id, lote.id, { pontos: [pt(0), { lat: null, lng: null }, { lat: '', lng: '' }, pt(1)], metros: 10, caminho: [] })).status, 201);
  const g = await rotaGuardada(os.id);
  assert.deepEqual(g.pontos, [pt(0), pt(1)]);
});

test('caminho com lixo: só coordenadas numéricas são guardadas', async () => {
  const { lote, os } = await cenario();
  assert.equal((await lancar(os.id, lote.id, { pontos: [pt(0), pt(1)], metros: 'abc', caminho: [[-23.5, -46.3], ['x', 1], [-23.6, -46.4]] })).status, 201);
  const g = await rotaGuardada(os.id);
  assert.deepEqual(g.caminho, [[-23.5, -46.3], [-23.6, -46.4]]);
  assert.equal(g.metros, 0);
});

test('o mesmo envio repetido com a mesma chave guarda a rota uma vez só', async () => {
  const { lote, os } = await cenario();
  const h = { 'Idempotency-Key': randomUUID() };
  const corpo = { descricao: 'L', trecho: 'A → B', materiais: [{ lote_id: lote.id, quantidade: 10 }], rota: { pontos: [pt(0), pt(1)], metros: 10, caminho: [] } };
  assert.equal((await call(u1, 'POST', `/os/${os.id}/lancamentos`, corpo, h)).status, 201);
  assert.equal((await call(u1, 'POST', `/os/${os.id}/lancamentos`, corpo, h)).status, 201);
  const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM os_servicos WHERE os_id = ? AND rota_trecho IS NOT NULL', [os.id]);
  assert.equal(n, 1);
});

const pontosQuery = (pontos) => encodeURIComponent(pontos.map((p) => `${p.lat},${p.lng}`).join(';'));
test('GET /geo/rota recusa pontos inválidos antes de falar com qualquer serviço externo', async () => {
  const ruim = async (q) => (await call(u1, 'GET', `/geo/rota?pontos=${q}`)).status;
  assert.equal(await ruim(''), 400);
  assert.equal(await ruim(pontosQuery([pt(0)])), 400); // 1 ponto
  assert.equal(await ruim(pontosQuery(Array.from({ length: 26 }, (_, i) => pt(i)))), 400); // 26 pontos
  assert.equal(await ruim(pontosQuery([pt(0), { lat: 91, lng: 0 }])), 400);
  assert.equal(await ruim(pontosQuery([pt(0), { lat: 0, lng: 181 }])), 400);
  assert.equal(await ruim('abc,def;ghi,jkl'), 400);
  assert.equal(await ruim(encodeURIComponent('1,2;')), 400); // só 1 ponto depois de ignorar o vazio
});

test('GET /geo/rota exige login', async () => {
  assert.equal((await call(null, 'GET', `/geo/rota?pontos=${pontosQuery([pt(0), pt(1)])}`)).status, 401);
});
