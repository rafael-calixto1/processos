// Rodar: DB_NAME=processo_audit_test npm test   (usa um banco separado; nunca o de produção)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';

process.env.DB_NAME = process.env.DB_NAME || 'processo_audit_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
if (!/test/.test(process.env.DB_NAME)) throw new Error('Testes só rodam em banco com "test" no nome');

const { default: pool } = await import('../src/config/database.js');
const { up, down } = await import('../scripts/migrate_estoque.js');
const svc = await import('../src/services/estoqueService.js');
const { default: osRouter } = await import('../src/routes/os.js');
const { default: estoqueRouter } = await import('../src/routes/estoque.js');
const { tecnicosRouter } = await import('../src/routes/cadastros.js');

let server, base, admin, almox, userT1, userT2, t1, t2, equipe, itemCabo, itemConector;
const token = (u) => jwt.sign({ id: u.id, role: u.role, email: u.email }, process.env.JWT_SECRET);
const call = async (user, method, path, body) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token(user)}` },
    body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const mkUser = async (role, n) => {
  const [r] = await pool.query('INSERT INTO users (email,password,name,role) VALUES (?,?,?,?)', [`${role}${n}@t.local`, 'x', `${role} ${n}`, role]);
  return { id: r.insertId, role, email: `${role}${n}@t.local` };
};

before(async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (id INT PRIMARY KEY AUTO_INCREMENT, email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, name VARCHAR(255) NOT NULL, role ENUM('admin','manager','viewer') DEFAULT 'viewer', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  const c = await pool.getConnection();
  await down(c); await up(c); await c.query('DELETE FROM users'); c.release();

  admin = await mkUser('admin', 1); almox = await mkUser('estoque', 1);
  userT1 = await mkUser('tecnico', 1); userT2 = await mkUser('tecnico', 2);
  const ins = async (sql, p) => (await pool.query(sql, p))[0].insertId;
  t1 = await ins("INSERT INTO tecnicos (nome,tipo,usuario_id) VALUES ('Téc 1','interno',?)", [userT1.id]);
  t2 = await ins("INSERT INTO tecnicos (nome,tipo,usuario_id) VALUES ('Téc 2','interno',?)", [userT2.id]);
  equipe = await ins("INSERT INTO tecnicos (nome,tipo,empresa) VALUES ('Equipe X','terceirizado','X Ltda')");
  itemCabo = await ins("INSERT INTO estoque_itens (nome,unidade,estoque_minimo) VALUES ('Cabo Drop','metros',500)");
  itemConector = await ins("INSERT INTO estoque_itens (nome,unidade,estoque_minimo) VALUES ('Conector SC/APC','pecas',50)");

  const app = express(); app.use(express.json());
  app.use('/api/os', osRouter); app.use('/api/estoque', estoqueRouter); app.use('/api/tecnicos', tecnicosRouter);
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { server?.close(); await pool.end(); });

const novaCompra = (item, qtd, medida, extra = {}) =>
  svc.criarCompra({ item_id: item, tipo_volume: 'bobina', qtd_volumes: qtd, medida_por_volume: medida, ...extra }, almox.id);
const novaOS = async (tecnico_id) => (await svc.criarOS({ cliente: 'Cliente', tecnico_id }, almox.id));

test('compra de 3 bobinas x 1000 m gera 3 lotes únicos legíveis', async () => {
  const { lotes } = await novaCompra(itemCabo, 3, 1000);
  assert.equal(lotes.length, 3);
  assert.equal(new Set(lotes.map((l) => l.codigo)).size, 3);
  for (const l of lotes) { assert.match(l.codigo, /^LOTE-BOB-\d{4}$/); assert.equal(Number(l.saldo_atual), 1000); }
});

test('compra é idempotente com chave de idempotência', async () => {
  const a = await novaCompra(itemCabo, 1, 100, { chave_idempotencia: 'k1' });
  const b = await novaCompra(itemCabo, 1, 100, { chave_idempotencia: 'k1' });
  assert.equal(a.compra.id, b.compra.id); assert.ok(b.repetida);
  const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM estoque_lotes WHERE compra_id = ?', [a.compra.id]);
  assert.equal(n, 1);
});

test('compra rejeita volumes/medida inválidos', async () => {
  await assert.rejects(novaCompra(itemCabo, 0, 100), { status: 400 });
  await assert.rejects(novaCompra(itemCabo, 1, -5), { status: 400 });
});

test('retirada não consome estoque: saldo do lote igual, posse do técnico aumenta', async () => {
  const { lotes } = await novaCompra(itemCabo, 1, 1000);
  await svc.retirar({ codigo: lotes[0].codigo, tecnico_id: t1, quantidade: 300 }, almox.id);
  const [[l]] = await pool.query('SELECT saldo_atual FROM estoque_lotes WHERE id = ?', [lotes[0].id]);
  assert.equal(Number(l.saldo_atual), 1000);
  const [[p]] = await pool.query('SELECT quantidade FROM estoque_posse WHERE lote_id=? AND tecnico_id=?', [lotes[0].id, t1]);
  assert.equal(Number(p.quantidade), 300);
});

test('retirada não pode passar do que há no almoxarifado (saldo nunca negativo)', async () => {
  const { lotes } = await novaCompra(itemCabo, 1, 100);
  await svc.retirar({ lote_id: lotes[0].id, tecnico_id: t1, quantidade: 80 }, almox.id);
  await assert.rejects(svc.retirar({ lote_id: lotes[0].id, tecnico_id: t2, quantidade: 30 }, almox.id), { status: 400 });
  await assert.rejects(svc.retirar({ lote_id: lotes[0].id, tecnico_id: t2, quantidade: 0 }, almox.id), { status: 400 });
});

test('devolução exige condição, só devolve o que o técnico tem e volta ao almoxarifado', async () => {
  const { lotes } = await novaCompra(itemCabo, 1, 100);
  await svc.retirar({ lote_id: lotes[0].id, tecnico_id: t1, quantidade: 50 }, almox.id);
  await assert.rejects(svc.devolver({ lote_id: lotes[0].id, tecnico_id: t1, quantidade: 10 }, almox.id), { status: 400 });
  await assert.rejects(svc.devolver({ lote_id: lotes[0].id, tecnico_id: t1, quantidade: 60, condicao: 'novo' }, almox.id), { status: 400 });
  await svc.devolver({ lote_id: lotes[0].id, tecnico_id: t1, quantidade: 20, condicao: 'usado' }, almox.id);
  const [[p]] = await pool.query('SELECT quantidade FROM estoque_posse WHERE lote_id=? AND tecnico_id=?', [lotes[0].id, t1]);
  assert.equal(Number(p.quantidade), 30);
  const [[m]] = await pool.query("SELECT condicao FROM estoque_movimentacoes WHERE tipo='devolucao' AND lote_id=?", [lotes[0].id]);
  assert.equal(m.condicao, 'usado');
});

test('baixa em OS consome: sai da posse e do saldo, não volta; só de lote em posse do técnico', async () => {
  const { lotes } = await novaCompra(itemCabo, 1, 500);
  const os = await novaOS(t1);
  const actor = { id: userT1.id, role: 'tecnico', tecnicoId: t1 };
  // lote ainda no almoxarifado -> recusado
  await assert.rejects(svc.baixarEmOS({ os_id: os.id, codigo: lotes[0].codigo, quantidade: 10 }, actor), { status: 400 });
  await svc.retirar({ lote_id: lotes[0].id, tecnico_id: t1, quantidade: 100 }, almox.id);
  // lote em posse de OUTRO técnico não serve
  await svc.retirar({ lote_id: lotes[0].id, tecnico_id: t2, quantidade: 50 }, almox.id);
  await assert.rejects(svc.baixarEmOS({ os_id: os.id, codigo: lotes[0].codigo, quantidade: 101 }, actor), { status: 400 });
  const r = await svc.baixarEmOS({ os_id: os.id, codigo: lotes[0].codigo.toLowerCase(), quantidade: 40 }, actor);
  assert.equal(r.saldo_lote, 460);
  const [[p]] = await pool.query('SELECT quantidade FROM estoque_posse WHERE lote_id=? AND tecnico_id=?', [lotes[0].id, t1]);
  assert.equal(Number(p.quantidade), 60);
  const [[o]] = await pool.query('SELECT status FROM ordens_servico WHERE id=?', [os.id]);
  assert.equal(o.status, 'em_andamento');
});

test('baixas concorrentes não ultrapassam a posse (lock FOR UPDATE)', async () => {
  const { lotes } = await novaCompra(itemCabo, 1, 100);
  const os = await novaOS(t1);
  await svc.retirar({ lote_id: lotes[0].id, tecnico_id: t1, quantidade: 100 }, almox.id);
  const actor = { id: userT1.id, role: 'tecnico', tecnicoId: t1 };
  const res = await Promise.allSettled(Array.from({ length: 5 }, () =>
    svc.baixarEmOS({ os_id: os.id, lote_id: lotes[0].id, quantidade: 30 }, actor)));
  assert.equal(res.filter((r) => r.status === 'fulfilled').length, 3);
  const [[l]] = await pool.query('SELECT saldo_atual FROM estoque_lotes WHERE id=?', [lotes[0].id]);
  assert.equal(Number(l.saldo_atual), 10);
});

test('técnico não acessa nem baixa OS de outro técnico (403)', async () => {
  const osT2 = await novaOS(t2);
  assert.equal((await call(userT1, 'GET', `/os/${osT2.id}`)).status, 403);
  assert.equal((await call(userT1, 'POST', `/os/${osT2.id}/materiais`, { codigo: 'X', quantidade: 1 })).status, 403);
  assert.equal((await call(userT1, 'POST', `/os/${osT2.id}/fechar`)).status, 403);
  const lista = await call(userT1, 'GET', '/os');
  assert.ok(lista.body.every((o) => o.tecnico_nome === 'Téc 1'));
  assert.equal((await call(userT2, 'GET', `/os/${osT2.id}`)).status, 200);
});

test('técnico não acessa cadastros, itens, retiradas nem painel de estoque', async () => {
  assert.equal((await call(userT1, 'GET', '/tecnicos')).status, 403);
  assert.equal((await call(userT1, 'GET', '/estoque/itens')).status, 403);
  assert.equal((await call(userT1, 'POST', '/estoque/compras', {})).status, 403);
  assert.equal((await call(userT1, 'POST', '/estoque/retiradas', {})).status, 403);
  assert.equal((await call(userT1, 'POST', '/os', { cliente: 'x', tecnico_id: t1 })).status, 403);
  assert.equal((await call(almox, 'GET', '/estoque/itens')).status, 200);
  assert.equal((await call(admin, 'GET', '/tecnicos')).status, 200);
});

test('técnico só consulta lote que está com ele', async () => {
  const { lotes } = await novaCompra(itemCabo, 1, 100);
  assert.equal((await call(userT1, 'GET', `/estoque/lotes/${lotes[0].codigo}`)).status, 403);
  await svc.retirar({ lote_id: lotes[0].id, tecnico_id: t1, quantidade: 10 }, almox.id);
  const r = await call(userT1, 'GET', `/estoque/lotes/${lotes[0].codigo}`);
  assert.equal(r.status, 200); assert.equal(r.body.minha_posse, 10);
});

test('OS concluída é imutável: não aceita materiais, edição nem cancelamento', async () => {
  const { lotes } = await novaCompra(itemConector, 1, 100);
  await svc.retirar({ lote_id: lotes[0].id, tecnico_id: t1, quantidade: 20 }, almox.id);
  const os = await novaOS(t1);
  const actor = { id: userT1.id, role: 'tecnico', tecnicoId: t1 };
  await svc.baixarEmOS({ os_id: os.id, lote_id: lotes[0].id, quantidade: 5 }, actor);
  await svc.fecharOS({ os_id: os.id }, actor);
  await assert.rejects(svc.baixarEmOS({ os_id: os.id, lote_id: lotes[0].id, quantidade: 1 }, actor), { status: 409 });
  assert.equal((await call(almox, 'PUT', `/os/${os.id}`, { cliente: 'Outro' })).status, 409);
  assert.equal((await call(almox, 'POST', `/os/${os.id}/cancelar`)).status, 409);
  assert.ok((await svc.fecharOS({ os_id: os.id }, actor)).repetida); // idempotente
});

test('estorno: só estoque/admin, exige motivo, devolve à posse, não repete', async () => {
  const { lotes } = await novaCompra(itemCabo, 1, 200);
  await svc.retirar({ lote_id: lotes[0].id, tecnico_id: t1, quantidade: 100 }, almox.id);
  const os = await novaOS(t1);
  const actor = { id: userT1.id, role: 'tecnico', tecnicoId: t1 };
  const b = await svc.baixarEmOS({ os_id: os.id, lote_id: lotes[0].id, quantidade: 40 }, actor);
  await svc.fecharOS({ os_id: os.id }, actor);

  const path = `/os/${os.id}/estornos`;
  assert.equal((await call(userT1, 'POST', path, { movimentacao_id: b.movimentacao_id, motivo: 'x' })).status, 403);
  assert.equal((await call(almox, 'POST', path, { movimentacao_id: b.movimentacao_id })).status, 400);
  assert.equal((await call(almox, 'POST', path, { movimentacao_id: b.movimentacao_id, motivo: 'Lançado errado' })).status, 201);
  assert.equal((await call(almox, 'POST', path, { movimentacao_id: b.movimentacao_id, motivo: 'de novo' })).status, 409);

  const [[l]] = await pool.query('SELECT saldo_atual FROM estoque_lotes WHERE id=?', [lotes[0].id]);
  assert.equal(Number(l.saldo_atual), 200);
  const [[p]] = await pool.query('SELECT quantidade FROM estoque_posse WHERE lote_id=? AND tecnico_id=?', [lotes[0].id, t1]);
  assert.equal(Number(p.quantidade), 100);
  const d = await call(almox, 'GET', `/os/${os.id}`);
  assert.equal(d.body.totais.metros, 0);
});

test('constraints do banco impedem saldo negativo mesmo fora do serviço', async () => {
  const { lotes } = await novaCompra(itemCabo, 1, 10);
  await assert.rejects(pool.query('UPDATE estoque_lotes SET saldo_atual = -1 WHERE id = ?', [lotes[0].id]));
});

test('status do item: OK / BAIXO / ZERADO', () => {
  assert.equal(svc.statusItem(100, 50), 'OK');
  assert.equal(svc.statusItem(50, 50), 'OK');
  assert.equal(svc.statusItem(10, 50), 'BAIXO');
  assert.equal(svc.statusItem(0, 50), 'ZERADO');
});

test('vínculo usuário↔técnico é 1:1 e só para perfil técnico', async () => {
  const dup = await call(admin, 'POST', '/tecnicos', { nome: 'Dup', tipo: 'interno', usuario_id: userT1.id });
  assert.equal(dup.status, 409);
  const err = await call(admin, 'POST', '/tecnicos', { nome: 'Adm', tipo: 'interno', usuario_id: almox.id });
  assert.equal(err.status, 400);
});
