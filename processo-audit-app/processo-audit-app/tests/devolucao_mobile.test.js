// Devolução pelo app: Idempotency-Key na solicitação e devoluções do técnico no bootstrap.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { pool, prepararBanco } from './helpers/db.js';

const svc = await import('../src/services/estoqueService.js');
const { default: estoqueRouter } = await import('../src/routes/estoque.js');
const { default: mobileRouter } = await import('../src/routes/mobile.js');

let server, base, liberarBanco, almox, u1, u2, t1, t2, cabo, conector;
const token = (u) => jwt.sign({ id: u.id, role: u.role, email: u.email }, process.env.JWT_SECRET);
const call = async (user, method, path, body, headers = {}) => {
  const r = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token(user)}`, ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, headers: r.headers, body: await r.json().catch(() => ({})) };
};
const mkUser = async (role, n) => {
  const email = `${role}${n}@t.local`;
  const [r] = await pool.query('INSERT INTO users (email,password,name,role) VALUES (?,?,?,?)', [email, 'x', `${role} ${n}`, role]);
  return { id: r.insertId, role, email };
};
const ins = async (sql, p) => (await pool.query(sql, p))[0].insertId;
const idem = () => ({ 'Idempotency-Key': randomUUID() });

before(async () => {
  liberarBanco = await prepararBanco();
  almox = await mkUser('estoque', 1); u1 = await mkUser('tecnico', 1); u2 = await mkUser('tecnico', 2);
  t1 = await ins("INSERT INTO tecnicos (nome,tipo,usuario_id) VALUES ('Ana','interno',?)", [u1.id]);
  t2 = await ins("INSERT INTO tecnicos (nome,tipo,usuario_id) VALUES ('Bruno','interno',?)", [u2.id]);
  cabo = await ins("INSERT INTO estoque_itens (nome,unidade) VALUES ('Cabo Drop','metros')");
  conector = await ins("INSERT INTO estoque_itens (nome,unidade) VALUES ('Conector','pecas')");
  const app = express(); app.use(express.json());
  app.use('/api/estoque', estoqueRouter); app.use('/api/mobile', mobileRouter);
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { server?.close(); await liberarBanco?.(); await pool.end(); });

const comPosse = async (item, medida, posse, tecnico = t1) => {
  const { lotes: [lote] } = await svc.criarCompra({ item_id: item, tipo_volume: 'bobina', qtd_volumes: 1, medida_por_volume: medida }, almox.id);
  await svc.retirar({ lote_id: lote.id, tecnico_id: tecnico, quantidade: posse }, almox.id);
  return lote;
};
const solicitacoes = async (loteId) => (await pool.query('SELECT COUNT(*) n FROM estoque_devolucoes WHERE lote_id = ?', [loteId]))[0][0].n;

test('solicitação repetida com a mesma chave cria uma única devolução e devolve a mesma resposta', async () => {
  const lote = await comPosse(cabo, 500, 200);
  const h = idem();
  const corpo = { lote_id: lote.id, quantidade: 50, condicao: 'usado', observacao: 'sobra' };
  const a = await call(u1, 'POST', '/estoque/devolucoes', corpo, h);
  const b = await call(u1, 'POST', '/estoque/devolucoes', corpo, h);
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.equal(b.body.repetida, true);
  assert.equal(b.headers.get('idempotent-replayed'), 'true');
  assert.equal(b.body.solicitacao_id, a.body.solicitacao_id);
  assert.equal(await solicitacoes(lote.id), 1);
});

test('cinco retries simultâneos da mesma chave abrem uma solicitação só', async () => {
  const lote = await comPosse(cabo, 500, 200);
  const h = idem();
  const corpo = { lote_id: lote.id, quantidade: 80, condicao: 'novo' };
  const rs = await Promise.all(Array.from({ length: 5 }, () => call(u1, 'POST', '/estoque/devolucoes', corpo, h)));
  assert.ok(rs.every((r) => r.status === 201), JSON.stringify(rs.map((r) => r.status)));
  assert.equal(new Set(rs.map((r) => r.body.solicitacao_id)).size, 1);
  assert.equal(await solicitacoes(lote.id), 1);
});

test('a mesma chave com outro corpo é recusada (422) e não abre solicitação', async () => {
  const lote = await comPosse(cabo, 500, 200);
  const h = idem();
  assert.equal((await call(u1, 'POST', '/estoque/devolucoes', { lote_id: lote.id, quantidade: 10, condicao: 'novo' }, h)).status, 201);
  const r = await call(u1, 'POST', '/estoque/devolucoes', { lote_id: lote.id, quantidade: 20, condicao: 'novo' }, h);
  assert.equal(r.status, 422);
  assert.equal(await solicitacoes(lote.id), 1);
});

test('sem chave o comportamento antigo continua (cada chamada é uma solicitação)', async () => {
  const lote = await comPosse(cabo, 500, 200);
  assert.equal((await call(u1, 'POST', '/estoque/devolucoes', { lote_id: lote.id, quantidade: 10, condicao: 'novo' })).status, 201);
  assert.equal((await call(u1, 'POST', '/estoque/devolucoes', { lote_id: lote.id, quantidade: 10, condicao: 'novo' })).status, 201);
  assert.equal(await solicitacoes(lote.id), 2);
});

test('recusa por regra não fica guardada: depois de corrigir, a mesma chave funciona', async () => {
  const lote = await comPosse(cabo, 500, 100);
  const h = idem();
  const ruim = await call(u1, 'POST', '/estoque/devolucoes', { lote_id: lote.id, quantidade: 150, condicao: 'novo' }, h);
  assert.equal(ruim.status, 400);
  assert.match(ruim.body.error, /apenas 100/);
  assert.equal(await solicitacoes(lote.id), 0);
  const bom = await call(u1, 'POST', '/estoque/devolucoes', { lote_id: lote.id, quantidade: 100, condicao: 'novo' }, h);
  assert.equal(bom.status, 201);
});

test('não passa do que já está pendente de devolução; peças só inteiras; condição obrigatória', async () => {
  const lote = await comPosse(cabo, 500, 100);
  assert.equal((await call(u1, 'POST', '/estoque/devolucoes', { lote_id: lote.id, quantidade: 70, condicao: 'novo' }, idem())).status, 201);
  const r = await call(u1, 'POST', '/estoque/devolucoes', { lote_id: lote.id, quantidade: 40, condicao: 'novo' }, idem());
  assert.equal(r.status, 400);
  assert.match(r.body.error, /aguardando aprovação; disponível para devolver: 30/);
  const un = await comPosse(conector, 50, 10);
  assert.equal((await call(u1, 'POST', '/estoque/devolucoes', { lote_id: un.id, quantidade: 1.5, condicao: 'novo' }, idem())).status, 400);
  assert.equal((await call(u1, 'POST', '/estoque/devolucoes', { lote_id: un.id, quantidade: 1 }, idem())).status, 400);
});

test('técnico não devolve lote que está com outro técnico', async () => {
  const lote = await comPosse(cabo, 500, 100, t2);
  const r = await call(u1, 'POST', '/estoque/devolucoes', { lote_id: lote.id, quantidade: 10, condicao: 'novo' }, idem());
  assert.equal(r.status, 400);
  assert.equal(await solicitacoes(lote.id), 0);
});

test('bootstrap traz as devoluções do técnico (pendentes e decididas) e nenhuma de outro', async () => {
  const lote = await comPosse(cabo, 500, 300);
  const outro = await comPosse(cabo, 500, 300, t2);
  const a = (await call(u1, 'POST', '/estoque/devolucoes', { lote_id: lote.id, quantidade: 10, condicao: 'novo' }, idem())).body.solicitacao_id;
  const b = (await call(u1, 'POST', '/estoque/devolucoes', { lote_id: lote.id, quantidade: 20, condicao: 'usado' }, idem())).body.solicitacao_id;
  const c = (await call(u1, 'POST', '/estoque/devolucoes', { lote_id: lote.id, quantidade: 30, condicao: 'novo' }, idem())).body.solicitacao_id;
  await call(u2, 'POST', '/estoque/devolucoes', { lote_id: outro.id, quantidade: 5, condicao: 'novo' }, idem());
  assert.equal((await call(almox, 'POST', `/estoque/devolucoes/${b}/negar`, { motivo: 'Peça danificada' })).status, 200);
  assert.equal((await call(almox, 'POST', `/estoque/devolucoes/${c}/aprovar`, {})).status, 200);

  const dev = (await call(u1, 'GET', '/mobile/bootstrap')).body.devolucoes.filter((d) => d.lote_id === lote.id);
  assert.deepEqual(dev.map((d) => d.id).sort(), [a, b, c].sort());
  assert.equal(dev[0].id, a); // pendentes primeiro
  const neg = dev.find((d) => d.id === b);
  assert.equal(neg.status, 'negada');
  assert.equal(neg.motivo_negacao, 'Peça danificada');
  assert.equal(neg.quantidade, 20);
  assert.equal(typeof neg.quantidade, 'number');
  assert.equal(dev.find((d) => d.id === c).status, 'aprovada');
  assert.equal(dev.find((d) => d.id === a).lote_codigo, lote.codigo);
  const todas = (await call(u1, 'GET', '/mobile/bootstrap')).body.devolucoes;
  assert.ok(todas.every((d) => d.lote_id !== outro.id));
});

test('bootstrap: devolução decidida há mais de 30 dias sai da lista; pendente antiga continua', async () => {
  const lote = await comPosse(cabo, 500, 300);
  const velha = (await call(u1, 'POST', '/estoque/devolucoes', { lote_id: lote.id, quantidade: 10, condicao: 'novo' }, idem())).body.solicitacao_id;
  const pendenteAntiga = (await call(u1, 'POST', '/estoque/devolucoes', { lote_id: lote.id, quantidade: 10, condicao: 'novo' }, idem())).body.solicitacao_id;
  await call(almox, 'POST', `/estoque/devolucoes/${velha}/negar`, { motivo: 'x' });
  await pool.query('UPDATE estoque_devolucoes SET revisado_em = NOW() - INTERVAL 40 DAY WHERE id = ?', [velha]);
  await pool.query('UPDATE estoque_devolucoes SET solicitado_em = NOW() - INTERVAL 40 DAY WHERE id = ?', [pendenteAntiga]);
  const ids = (await call(u1, 'GET', '/mobile/bootstrap')).body.devolucoes.map((d) => d.id);
  assert.ok(!ids.includes(velha));
  assert.ok(ids.includes(pendenteAntiga));
});
