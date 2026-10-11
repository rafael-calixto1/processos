// Catálogos da finalização para o fluxo de campo do web: os mesmos do app, para técnico, estoque e admin.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { pool, prepararBanco } from './helpers/db.js';

const { default: osRouter } = await import('../src/routes/os.js');
const { default: mobileRouter } = await import('../src/routes/mobile.js');

let server, base, liberarBanco, admin, estoque, tecnico, outro, tId, t2Id;
const token = (u) => jwt.sign({ id: u.id, role: u.role, email: u.email }, process.env.JWT_SECRET);
const call = async (user, path) => {
  const r = await fetch(base + path, { headers: user ? { Authorization: `Bearer ${token(user)}` } : {} });
  return { status: r.status, corpo: await r.json().catch(() => ({})) };
};
const mkUser = async (role, n) => {
  const [r] = await pool.query('INSERT INTO users (email,password,name,role) VALUES (?,?,?,?)', [`${role}${n}@w.local`, 'x', `${role}${n}`, role]);
  return { id: r.insertId, role, email: `${role}${n}@w.local` };
};

before(async () => {
  liberarBanco = await prepararBanco();
  admin = await mkUser('admin', 1); estoque = await mkUser('estoque', 1); tecnico = await mkUser('tecnico', 1); outro = await mkUser('tecnico', 2);
  tId = (await pool.query("INSERT INTO tecnicos (nome,tipo,usuario_id) VALUES ('Ana','interno',?)", [tecnico.id]))[0].insertId;
  t2Id = (await pool.query("INSERT INTO tecnicos (nome,tipo,usuario_id) VALUES ('Bruno','interno',?)", [outro.id]))[0].insertId;
  await pool.query("INSERT INTO tecnicos (nome,tipo,empresa,ativo) VALUES ('Inativo','terceirizado','X',0)");
  await pool.query("INSERT INTO estoque_itens (nome,unidade) VALUES ('Cabo ativo','metros')");
  await pool.query("INSERT INTO estoque_itens (nome,unidade,ativo) VALUES ('Cabo inativo','metros',0)");
  const app = express(); app.use(express.json());
  app.use('/api/os', osRouter); app.use('/api/mobile', mobileRouter);
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { server?.close(); await liberarBanco?.(); await pool.end(); });

test('exige login', async () => {
  assert.equal((await call(null, '/os/catalogos-fechamento')).status, 401);
});

test('técnico recebe motivos, checklist, regras, itens ativos e os OUTROS técnicos ativos (nunca ele mesmo nem inativos)', async () => {
  const r = await call(tecnico, '/os/catalogos-fechamento');
  assert.equal(r.status, 200);
  const c = r.corpo;
  assert.ok(c.motivos.some((m) => m.codigo === 'route_launched'));
  assert.ok(c.checklist.some((i) => i.codigo === 'fiberLaunchedMeters' && i.obrigatorio === true && i.tipo === 'number'));
  assert.equal(c.regras.descricao_min_caracteres, 11);
  assert.deepEqual(c.tecnicos.map((t) => t.nome), ['Bruno']);
  assert.deepEqual(c.itens.map((i) => i.nome), ['Cabo ativo']);
});

test('estoque e admin recebem todos os técnicos ativos (o web escolhe quem excluir pela OS)', async () => {
  for (const u of [estoque, admin]) {
    const r = await call(u, '/os/catalogos-fechamento');
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo.tecnicos.map((t) => t.nome), ['Ana', 'Bruno']);
  }
});

test('é exatamente o que o bootstrap do app entrega nesses blocos (um catálogo só)', async () => {
  const web = (await call(tecnico, '/os/catalogos-fechamento')).corpo;
  const app = (await call(tecnico, '/mobile/bootstrap')).corpo;
  assert.deepEqual({ motivos: web.motivos, checklist: web.checklist, tecnicos: web.tecnicos, itens: web.itens, regras: web.regras },
    { motivos: app.motivos, checklist: app.checklist, tecnicos: app.tecnicos, itens: app.itens, regras: app.regras });
});

test('item desativado some do catálogo do web e do app', async () => {
  await pool.query("UPDATE os_motivos_fechamento SET ativo = 0 WHERE codigo = 'pole_obstructed'");
  const web = (await call(tecnico, '/os/catalogos-fechamento')).corpo;
  assert.ok(!web.motivos.some((m) => m.codigo === 'pole_obstructed'));
  assert.ok(!(await call(tecnico, '/mobile/bootstrap')).corpo.motivos.some((m) => m.codigo === 'pole_obstructed'));
});
