// Administração dos catálogos da finalização (motivos e checklist): só admin, nada apagado, código fixo, o app enxerga as mudanças.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { pool, prepararBanco } from './helpers/db.js';

const { default: catalogosRouter, codigoDoRotulo } = await import('../src/routes/catalogosOs.js');
const { default: mobileRouter } = await import('../src/routes/mobile.js');

let server, base, liberarBanco, admin, estoque, tecnico;
const token = (u) => jwt.sign({ id: u.id, role: u.role, email: u.email }, process.env.JWT_SECRET);
const call = async (user, method, path, body) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(user && { Authorization: `Bearer ${token(user)}` }) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, corpo: await r.json().catch(() => ({})) };
};
const mkUser = async (role) => {
  const [r] = await pool.query('INSERT INTO users (email,password,name,role) VALUES (?,?,?,?)', [`${role}@c.local`, 'x', role, role]);
  return { id: r.insertId, role, email: `${role}@c.local` };
};

before(async () => {
  liberarBanco = await prepararBanco();
  admin = await mkUser('admin'); estoque = await mkUser('estoque'); tecnico = await mkUser('tecnico');
  await pool.query("INSERT INTO tecnicos (nome,tipo,usuario_id) VALUES ('Téc','interno',?)", [tecnico.id]);
  const app = express(); app.use(express.json());
  app.use('/api/os-catalogos', catalogosRouter); app.use('/api/mobile', mobileRouter);
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { server?.close(); await liberarBanco?.(); await pool.end(); });

const bootstrap = async () => (await call(tecnico, 'GET', '/mobile/bootstrap')).corpo;

test('só admin administra: estoque e técnico levam 403, anônimo 401', async () => {
  for (const rota of ['/os-catalogos/motivos', '/os-catalogos/checklist']) {
    assert.equal((await call(admin, 'GET', rota)).status, 200);
    assert.equal((await call(estoque, 'GET', rota)).status, 403);
    assert.equal((await call(tecnico, 'GET', rota)).status, 403);
    assert.equal((await call(null, 'GET', rota)).status, 401);
  }
  assert.equal((await call(estoque, 'POST', '/os-catalogos/motivos', { rotulo: 'Motivo novo' })).status, 403);
  assert.equal((await call(tecnico, 'PUT', '/os-catalogos/checklist/1', { ativo: false })).status, 403);
});

test('lista os catálogos semeados, incluindo desativados, com ordem e uso', async () => {
  const m = (await call(admin, 'GET', '/os-catalogos/motivos')).corpo;
  assert.ok(m.length >= 3);
  assert.ok(m.every((x) => typeof x.ativo === 'boolean' && x.usos === 0));
  assert.ok(m.some((x) => x.codigo === 'route_launched'));
  const c = (await call(admin, 'GET', '/os-catalogos/checklist')).corpo;
  assert.ok(c.some((x) => x.codigo === 'fiberLaunchedMeters' && x.tipo === 'number' && x.obrigatorio === true));
});

test('motivo novo: código gerado do nome (sem acento), fica no fim da ordem e o app o recebe na próxima sincronização', async () => {
  const antes = (await bootstrap()).motivos.length;
  const r = await call(admin, 'POST', '/os-catalogos/motivos', { rotulo: '  Cliente ausente — reagendar  ' });
  assert.equal(r.status, 201);
  assert.equal(r.corpo.codigo, 'cliente_ausente_reagendar');
  assert.equal(r.corpo.rotulo, 'Cliente ausente — reagendar'); // aparado
  assert.equal(r.corpo.ativo, true);
  const lista = (await call(admin, 'GET', '/os-catalogos/motivos')).corpo;
  assert.equal(lista.at(-1).id, r.corpo.id);
  const app = await bootstrap();
  assert.equal(app.motivos.length, antes + 1);
  assert.ok(app.motivos.some((x) => x.codigo === 'cliente_ausente_reagendar'));
});

test('código repetido dá 409; código inválido e nome curto/longo dão 400', async () => {
  assert.equal((await call(admin, 'POST', '/os-catalogos/motivos', { rotulo: 'Cliente ausente reagendar' })).status, 409); // mesmo código gerado
  assert.equal((await call(admin, 'POST', '/os-catalogos/motivos', { rotulo: 'Outro nome', codigo: 'route_launched' })).status, 409);
  assert.equal((await call(admin, 'POST', '/os-catalogos/motivos', { rotulo: 'Outro nome', codigo: '1inválido!' })).status, 400);
  assert.equal((await call(admin, 'POST', '/os-catalogos/motivos', { rotulo: 'ab' })).status, 400);
  assert.equal((await call(admin, 'POST', '/os-catalogos/motivos', { rotulo: 'x'.repeat(161) })).status, 400);
  assert.equal((await call(admin, 'POST', '/os-catalogos/motivos', {})).status, 400);
  assert.equal((await call(admin, 'POST', '/os-catalogos/motivos', { rotulo: 'Ordem ruim', ordem: -1 })).status, 400);
});

test('editar motivo: nome e ordem mudam; o código NÃO muda; desativar tira do app; reativar traz de volta', async () => {
  const novo = (await call(admin, 'POST', '/os-catalogos/motivos', { rotulo: 'Motivo para editar' })).corpo;
  const e = await call(admin, 'PUT', `/os-catalogos/motivos/${novo.id}`, { rotulo: 'Motivo editado', ordem: 1 });
  assert.equal(e.status, 200);
  assert.deepEqual([e.corpo.rotulo, e.corpo.ordem, e.corpo.codigo], ['Motivo editado', 1, 'motivo_para_editar']);
  const tentativa = await call(admin, 'PUT', `/os-catalogos/motivos/${novo.id}`, { codigo: 'outro', rotulo: 'Nome que não pode valer' });
  assert.equal(tentativa.status, 400);
  assert.match(tentativa.corpo.error, /código não pode ser alterado/);
  const [[depois]] = await pool.query('SELECT codigo, rotulo FROM os_motivos_fechamento WHERE id = ?', [novo.id]);
  assert.deepEqual(depois, { codigo: 'motivo_para_editar', rotulo: 'Motivo editado' }); // nada foi gravado, nem o nome que veio junto
  assert.equal((await call(admin, 'PUT', `/os-catalogos/motivos/${novo.id}`, { ativo: false })).status, 200);
  assert.ok(!(await bootstrap()).motivos.some((x) => x.id === novo.id));
  assert.equal((await call(admin, 'PUT', `/os-catalogos/motivos/${novo.id}`, { ativo: true })).status, 200);
  assert.ok((await bootstrap()).motivos.some((x) => x.id === novo.id && x.rotulo === 'Motivo editado'));
  assert.equal((await call(admin, 'PUT', '/os-catalogos/motivos/999999', { rotulo: 'Nada' })).status, 404);
  assert.equal((await call(admin, 'PUT', `/os-catalogos/motivos/${novo.id}`, {})).status, 400); // nada para alterar
  assert.equal((await call(admin, 'PUT', `/os-catalogos/motivos/${novo.id}`, { ativo: 'talvez' })).status, 400);
});

test('nunca deixa o app sem motivo: o último motivo ativo não pode ser desativado', async () => {
  const todos = (await call(admin, 'GET', '/os-catalogos/motivos')).corpo.filter((m) => m.ativo);
  for (const m of todos.slice(0, -1)) assert.equal((await call(admin, 'PUT', `/os-catalogos/motivos/${m.id}`, { ativo: false })).status, 200);
  const ultimo = todos.at(-1);
  const r = await call(admin, 'PUT', `/os-catalogos/motivos/${ultimo.id}`, { ativo: false });
  assert.equal(r.status, 409);
  assert.match(r.corpo.error, /ao menos um motivo ativo/);
  assert.equal((await bootstrap()).motivos.length, 1);
  for (const m of todos.slice(0, -1)) await call(admin, 'PUT', `/os-catalogos/motivos/${m.id}`, { ativo: true }); // devolve ao estado anterior
});

test('checklist: cria item sim/não, número com unidade e texto; tipo e unidade são validados', async () => {
  const sn = await call(admin, 'POST', '/os-catalogos/checklist', { rotulo: 'Poste identificado?', tipo: 'boolean', obrigatorio: true });
  assert.equal(sn.status, 201);
  assert.deepEqual([sn.corpo.tipo, sn.corpo.obrigatorio, sn.corpo.unidade], ['boolean', true, null]);
  const nu = await call(admin, 'POST', '/os-catalogos/checklist', { rotulo: 'Sobra de cabo deixada', tipo: 'number', unidade: 'm' });
  assert.deepEqual([nu.status, nu.corpo.unidade, nu.corpo.obrigatorio], [201, 'm', false]);
  assert.equal((await call(admin, 'POST', '/os-catalogos/checklist', { rotulo: 'Observação do poste', tipo: 'text' })).status, 201);
  assert.equal((await call(admin, 'POST', '/os-catalogos/checklist', { rotulo: 'Sem tipo' })).status, 400);
  assert.equal((await call(admin, 'POST', '/os-catalogos/checklist', { rotulo: 'Tipo ruim', tipo: 'foto' })).status, 400);
  assert.equal((await call(admin, 'POST', '/os-catalogos/checklist', { rotulo: 'Unidade em texto', tipo: 'text', unidade: 'm' })).status, 400);
  assert.equal((await call(admin, 'POST', '/os-catalogos/checklist', { rotulo: 'Unidade enorme', tipo: 'number', unidade: 'x'.repeat(11) })).status, 400);
  const app = (await bootstrap()).checklist;
  assert.ok(app.some((c) => c.codigo === 'poste_identificado' && c.obrigatorio === true));
});

test('checklist: editar nome/obrigatoriedade/ordem; tipo e código não mudam; desativar tira do app', async () => {
  const it = (await call(admin, 'POST', '/os-catalogos/checklist', { rotulo: 'Item editável', tipo: 'number', unidade: 'm' })).corpo;
  const e = await call(admin, 'PUT', `/os-catalogos/checklist/${it.id}`, { rotulo: 'Item editado', obrigatorio: true, ordem: 2, unidade: 'cm' });
  assert.deepEqual([e.status, e.corpo.rotulo, e.corpo.obrigatorio, e.corpo.ordem, e.corpo.unidade, e.corpo.codigo], [200, 'Item editado', true, 2, 'cm', 'item_editavel']);
  const troca = await call(admin, 'PUT', `/os-catalogos/checklist/${it.id}`, { tipo: 'text', rotulo: 'Nome que não pode valer' });
  assert.equal(troca.status, 400);
  assert.match(troca.corpo.error, /tipo de resposta não pode ser alterado/);
  const [[igual]] = await pool.query('SELECT tipo, rotulo FROM os_checklist_itens WHERE id = ?', [it.id]);
  assert.deepEqual(igual, { tipo: 'number', rotulo: 'Item editado' });
  assert.equal((await call(admin, 'PUT', `/os-catalogos/checklist/${it.id}`, { tipo: 'number', rotulo: 'Item editado de novo' })).status, 200); // mesmo tipo: tudo bem
  assert.equal((await call(admin, 'PUT', `/os-catalogos/checklist/${it.id}`, { codigo: 'outro', ativo: true })).status, 400);
  assert.equal((await call(admin, 'PUT', `/os-catalogos/checklist/${it.id}`, { ativo: false })).status, 200);
  assert.ok(!(await bootstrap()).checklist.some((c) => c.id === it.id));
  assert.equal((await call(admin, 'PUT', '/os-catalogos/checklist/999999', { rotulo: 'Nada aqui' })).status, 404);
});

test('rótulo editado não reescreve fechamentos antigos e motivo em uso aparece com a contagem', async () => {
  const [[m]] = await pool.query("SELECT id FROM os_motivos_fechamento WHERE codigo = 'route_launched'");
  const [[tec]] = await pool.query('SELECT id FROM tecnicos LIMIT 1');
  const [os] = await pool.query("INSERT INTO ordens_servico (numero, cliente, status, tecnico_id, criado_por) VALUES (9001, 'C', 'concluida', ?, ?)", [tec.id, admin.id]);
  await pool.query(`INSERT INTO os_fechamentos (os_id, descricao, motivo_id, motivo_rotulo, local_lat, local_lng, local_origem, checklist, participantes, materiais_usados, materiais_retirados, client_uuid, finalizado_por)
    VALUES (?, 'descricao de teste longa', ?, 'Rota lançada com sucesso', -23.5, -46.3, 'gps', '[]', '[]', 0, 0, UUID(), ?)`, [os.insertId, m.id, admin.id]);
  await call(admin, 'PUT', `/os-catalogos/motivos/${m.id}`, { rotulo: 'Rota concluída (novo nome)' });
  const [[f]] = await pool.query('SELECT motivo_rotulo FROM os_fechamentos WHERE os_id = ?', [os.insertId]);
  assert.equal(f.motivo_rotulo, 'Rota lançada com sucesso'); // o histórico guardou uma cópia
  const lista = (await call(admin, 'GET', '/os-catalogos/motivos')).corpo;
  assert.equal(lista.find((x) => x.id === m.id).usos, 1);
});

test('codigoDoRotulo: sem acento, minúsculas, símbolos viram _ e há limite de tamanho', () => {
  assert.equal(codigoDoRotulo('Rota lançada com sucesso'), 'rota_lancada_com_sucesso');
  assert.equal(codigoDoRotulo('  ÁÉÍ — ÓÚ!! '), 'aei_ou');
  assert.equal(codigoDoRotulo('a'.repeat(100)).length, 60);
});
