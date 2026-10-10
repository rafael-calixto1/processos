// Idempotência de lançamentos, materiais e serviços + regras de estoque vistas pela API HTTP.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { pool, prepararBanco } from './helpers/db.js';

const svc = await import('../src/services/estoqueService.js');
const { default: osRouter } = await import('../src/routes/os.js');

let server, base, liberarBanco, almox, u1, u2, t1, t2, cabo, conectores;
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

before(async () => {
  liberarBanco = await prepararBanco();
  almox = await mkUser('estoque', 1); u1 = await mkUser('tecnico', 1); u2 = await mkUser('tecnico', 2);
  t1 = await ins("INSERT INTO tecnicos (nome,tipo,usuario_id) VALUES ('Téc 1','interno',?)", [u1.id]);
  t2 = await ins("INSERT INTO tecnicos (nome,tipo,usuario_id) VALUES ('Téc 2','interno',?)", [u2.id]);
  cabo = await ins("INSERT INTO estoque_itens (nome,unidade,estoque_minimo) VALUES ('Cabo Drop','metros',0)");
  conectores = await ins("INSERT INTO estoque_itens (nome,unidade,estoque_minimo) VALUES ('Conector','pecas',0)");
  const app = express(); app.use(express.json()); app.use('/api/os', osRouter);
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { server?.close(); await liberarBanco?.(); await pool.end(); });

// lote com `qtd` na posse do técnico + OS dele
const cenario = async ({ item = cabo, medida = 1000, posse = 500, tecnico = t1 } = {}) => {
  const { lotes } = await svc.criarCompra({ item_id: item, tipo_volume: 'bobina', qtd_volumes: 1, medida_por_volume: medida }, almox.id);
  await svc.retirar({ lote_id: lotes[0].id, tecnico_id: tecnico, quantidade: posse }, almox.id);
  const os = await svc.criarOS({ cliente: 'Cliente', tecnico_id: tecnico }, almox.id);
  return { lote: lotes[0], os };
};
const baixas = async (osId) => (await pool.query("SELECT COUNT(*) n FROM estoque_movimentacoes WHERE os_id = ? AND tipo = 'baixa_os'", [osId]))[0][0].n;
const posseDe = async (loteId, tec) => Number((await pool.query('SELECT quantidade FROM estoque_posse WHERE lote_id=? AND tecnico_id=?', [loteId, tec]))[0][0].quantidade);
const idem = () => ({ 'Idempotency-Key': randomUUID() });

test('lançamento repetido com a mesma chave baixa o estoque uma única vez e devolve a mesma resposta', async () => {
  const { lote, os } = await cenario();
  const h = idem();
  const corpo = { descricao: 'Lançamento de cabo', trecho: 'PL-1 → PL-2', materiais: [{ lote_id: lote.id, quantidade: 120 }] };
  const a = await call(u1, 'POST', `/os/${os.id}/lancamentos`, corpo, h);
  const b = await call(u1, 'POST', `/os/${os.id}/lancamentos`, corpo, h);
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.equal(b.body.repetida, true);
  assert.equal(b.headers.get('idempotent-replayed'), 'true');
  assert.equal(a.body.repetida, undefined);
  assert.equal(b.body.id, a.body.id);
  assert.equal(await baixas(os.id), 1);
  assert.equal(await posseDe(lote.id, t1), 380);
  const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM os_servicos WHERE os_id = ?', [os.id]);
  assert.equal(n, 1);
});

test('cinco retries simultâneos da mesma chave executam uma vez só', async () => {
  const { lote, os } = await cenario();
  const h = idem();
  const corpo = { descricao: 'Concorrente', materiais: [{ lote_id: lote.id, quantidade: 50 }] };
  const rs = await Promise.all(Array.from({ length: 5 }, () => call(u1, 'POST', `/os/${os.id}/lancamentos`, corpo, h)));
  assert.ok(rs.every((r) => r.status === 201), JSON.stringify(rs.map((r) => r.status)));
  assert.equal(new Set(rs.map((r) => r.body.id)).size, 1);
  assert.equal(await baixas(os.id), 1);
  assert.equal(await posseDe(lote.id, t1), 450);
});

test('materiais e serviços também são idempotentes', async () => {
  const { lote, os } = await cenario();
  const hm = idem(); const hs = idem();
  for (let i = 0; i < 3; i++) {
    assert.equal((await call(u1, 'POST', `/os/${os.id}/materiais`, { lote_id: lote.id, quantidade: 10 }, hm)).status, 201);
    assert.equal((await call(u1, 'POST', `/os/${os.id}/servicos`, { descricao: 'Vistoria' }, hs)).status, 201);
  }
  assert.equal(await baixas(os.id), 1);
  assert.equal(await posseDe(lote.id, t1), 490);
  const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM os_servicos WHERE os_id = ?', [os.id]);
  assert.equal(n, 1);
});

test('mesma chave com corpo diferente ou em outra OS é recusada (422) e não executa nada', async () => {
  const { lote, os } = await cenario();
  const outra = await svc.criarOS({ cliente: 'Outra', tecnico_id: t1 }, almox.id);
  const h = idem();
  assert.equal((await call(u1, 'POST', `/os/${os.id}/materiais`, { lote_id: lote.id, quantidade: 10 }, h)).status, 201);
  assert.equal((await call(u1, 'POST', `/os/${os.id}/materiais`, { lote_id: lote.id, quantidade: 99 }, h)).status, 422);
  assert.equal((await call(u1, 'POST', `/os/${outra.id}/materiais`, { lote_id: lote.id, quantidade: 10 }, h)).status, 422);
  assert.equal(await baixas(os.id), 1);
  assert.equal(await baixas(outra.id), 0);
});

test('falha não fica guardada: depois de corrigir a posse, o reenvio com a mesma chave funciona', async () => {
  const { lote, os } = await cenario({ posse: 30 });
  const h = idem();
  const corpo = { descricao: 'Precisa de mais', materiais: [{ lote_id: lote.id, quantidade: 80 }] };
  const falha = await call(u1, 'POST', `/os/${os.id}/lancamentos`, corpo, h);
  assert.equal(falha.status, 400);
  assert.match(falha.body.error, /posse/);
  assert.equal(await baixas(os.id), 0);
  const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM os_servicos WHERE os_id = ?', [os.id]);
  assert.equal(n, 0); // tudo ou nada: nem o serviço ficou
  const [[{ g }]] = await pool.query('SELECT COUNT(*) g FROM sync_operacoes WHERE chave = ?', [h['Idempotency-Key']]);
  assert.equal(g, 0);
  await svc.retirar({ lote_id: lote.id, tecnico_id: t1, quantidade: 100 }, almox.id); // estoque ajusta
  const ok = await call(u1, 'POST', `/os/${os.id}/lancamentos`, corpo, h);
  assert.equal(ok.status, 201);
  assert.equal(ok.body.repetida, undefined);
  assert.equal(await baixas(os.id), 1);
});

test('a chave é por usuário: outro técnico usando o mesmo texto executa a própria operação', async () => {
  const a = await cenario({ tecnico: t1 });
  const b = await cenario({ tecnico: t2 });
  const h = idem();
  const ra = await call(u1, 'POST', `/os/${a.os.id}/materiais`, { lote_id: a.lote.id, quantidade: 5 }, h);
  const rb = await call(u2, 'POST', `/os/${b.os.id}/materiais`, { lote_id: b.lote.id, quantidade: 5 }, h);
  assert.equal(ra.status, 201); assert.equal(rb.status, 201);
  assert.equal(rb.body.repetida, undefined);
  assert.notEqual(ra.body.movimentacao_id, rb.body.movimentacao_id);
  assert.equal(await baixas(a.os.id), 1);
  assert.equal(await baixas(b.os.id), 1);
});

test('Idempotency-Key malformada é 400; sem a chave tudo segue como antes (duas chamadas = duas baixas)', async () => {
  const { lote, os } = await cenario();
  assert.equal((await call(u1, 'POST', `/os/${os.id}/materiais`, { lote_id: lote.id, quantidade: 1 }, { 'Idempotency-Key': 'x' })).status, 400);
  assert.equal(await baixas(os.id), 0);
  await call(u1, 'POST', `/os/${os.id}/materiais`, { lote_id: lote.id, quantidade: 1 });
  await call(u1, 'POST', `/os/${os.id}/materiais`, { lote_id: lote.id, quantidade: 1 });
  assert.equal(await baixas(os.id), 2);
});

test('baixa acima da posse e peças fracionadas são recusadas pela API, com mensagem em pt-BR', async () => {
  const cabos = await cenario({ posse: 50 });
  const acima = await call(u1, 'POST', `/os/${cabos.os.id}/lancamentos`, { descricao: 'x', materiais: [{ lote_id: cabos.lote.id, quantidade: 50.01 }] }, idem());
  assert.equal(acima.status, 400);
  assert.match(acima.body.error, /Quantidade maior que a posse do técnico neste lote \(50\)/);
  const pecas = await cenario({ item: conectores, medida: 100, posse: 20 });
  const frac = await call(u1, 'POST', `/os/${pecas.os.id}/lancamentos`, { descricao: 'x', materiais: [{ lote_id: pecas.lote.id, quantidade: 1.5 }] }, idem());
  assert.equal(frac.status, 400);
  assert.match(frac.body.error, /número inteiro/);
  assert.equal(await baixas(cabos.os.id) + await baixas(pecas.os.id), 0);
  assert.equal(await posseDe(cabos.lote.id, t1), 50);
});

test('OS encerrada recusa novo lançamento (409) e fechar de novo é idempotente (200 repetida)', async () => {
  const { lote, os } = await cenario();
  assert.equal((await call(u1, 'POST', `/os/${os.id}/fechar`)).status, 200);
  const de_novo = await call(u1, 'POST', `/os/${os.id}/fechar`);
  assert.equal(de_novo.status, 200);
  assert.equal(de_novo.body.repetida, true);
  const lanc = await call(u1, 'POST', `/os/${os.id}/lancamentos`, { descricao: 'tarde demais', materiais: [{ lote_id: lote.id, quantidade: 1 }] }, idem());
  assert.equal(lanc.status, 409);
  assert.equal(await baixas(os.id), 0);
});

test('técnico não executa operação (nem reaproveita chave) em OS de outro técnico', async () => {
  const dele = await cenario({ tecnico: t2 });
  const h = idem();
  const r = await call(u1, 'POST', `/os/${dele.os.id}/materiais`, { lote_id: dele.lote.id, quantidade: 1 }, h);
  assert.equal(r.status, 403);
  assert.equal(await baixas(dele.os.id), 0);
});
