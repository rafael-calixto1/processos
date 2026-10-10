// Bootstrap do app, iniciar execução e sincronização incremental da lista de OS.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { pool, prepararBanco } from './helpers/db.js';

const svc = await import('../src/services/estoqueService.js');
const { default: osRouter } = await import('../src/routes/os.js');
const { default: mobileRouter } = await import('../src/routes/mobile.js');

let server, base, liberarBanco, almox, admin, u1, u2, u3, t1, t2, tInativo, cabo, conector, itemInativo;
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
  almox = await mkUser('estoque', 1); admin = await mkUser('admin', 1);
  u1 = await mkUser('tecnico', 1); u2 = await mkUser('tecnico', 2); u3 = await mkUser('tecnico', 3); // u3 sem técnico vinculado
  t1 = await ins("INSERT INTO tecnicos (nome,tipo,usuario_id) VALUES ('Ana Téc','interno',?)", [u1.id]);
  t2 = await ins("INSERT INTO tecnicos (nome,tipo,usuario_id) VALUES ('Bruno Téc','interno',?)", [u2.id]);
  tInativo = await ins("INSERT INTO tecnicos (nome,tipo,ativo) VALUES ('Carlos Inativo','interno',0)");
  await ins("INSERT INTO tecnicos (nome,tipo,empresa) VALUES ('Equipe X','terceirizado','X Ltda')");
  cabo = await ins("INSERT INTO estoque_itens (nome,categoria,unidade) VALUES ('Cabo Drop','Cabos','metros')");
  conector = await ins("INSERT INTO estoque_itens (nome,categoria,unidade) VALUES ('Conector SC','Conexão','pecas')");
  itemInativo = await ins("INSERT INTO estoque_itens (nome,unidade,ativo) VALUES ('Item Antigo','pecas',0)");
  const app = express(); app.use(express.json());
  app.use('/api/os', osRouter); app.use('/api/mobile', mobileRouter);
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { server?.close(); await liberarBanco?.(); await pool.end(); });

const novaOS = (tecnico_id, extra = {}) => svc.criarOS({ cliente: 'Cliente', tecnico_id, ...extra }, almox.id);

test('bootstrap devolve só o que é do técnico, com tipos normalizados', async () => {
  const minha = await novaOS(t1, { prazo: '2026-12-25', latitude: -23.5505, longitude: -46.6333, endereco: 'Rua A, 10', tipo_servico: 'Lançamento de rota', prioridade: 'alta' });
  const dele = await novaOS(t2);
  const { lotes: [lote] } = await svc.criarCompra({ item_id: cabo, tipo_volume: 'bobina', qtd_volumes: 1, medida_por_volume: 300 }, almox.id);
  await svc.retirar({ lote_id: lote.id, tecnico_id: t1, quantidade: 120.5 }, almox.id);
  await svc.retirar({ lote_id: lote.id, tecnico_id: t2, quantidade: 10 }, almox.id);

  const r = await call(u1, 'GET', '/mobile/bootstrap');
  assert.equal(r.status, 200);
  const b = r.body;
  assert.equal(b.tecnico.nome, 'Ana Téc');
  assert.deepEqual(b.os.map((o) => o.id), [minha.id]);
  assert.notEqual(b.os[0].id, dele.id);
  assert.equal(b.os[0].prazo, '2026-12-25'); // data pura, sem fuso
  assert.equal(typeof b.os[0].latitude, 'number');
  assert.equal(b.os[0].latitude, -23.5505);
  assert.equal(b.os[0].tem_rascunho, false);
  assert.equal(b.os[0].criado_por_nome, 'estoque 1');
  assert.equal(b.os[0].iniciado_em, null);
  assert.equal(b.posse.length, 1);
  assert.equal(b.posse[0].quantidade, 120.5);
  assert.equal(b.posse[0].lote_id, lote.id);
  assert.equal(typeof b.gerado_em, 'string');
});

test('bootstrap: catálogos semeados, técnicos ativos sem o próprio, itens ativos e regras do servidor', async () => {
  const b = (await call(u1, 'GET', '/mobile/bootstrap')).body;
  assert.equal(b.motivos.length, 6);
  assert.equal(b.motivos[0].codigo, 'route_launched');
  assert.equal(b.checklist.length, 7);
  assert.equal(b.checklist.filter((c) => c.obrigatorio).length, 6);
  assert.equal(b.checklist[0].obrigatorio, true);
  assert.equal(b.checklist.find((c) => c.codigo === 'fieldNotes').obrigatorio, false);
  const nomes = b.tecnicos.map((t) => t.nome);
  assert.ok(nomes.includes('Bruno Téc') && nomes.includes('Equipe X'));
  assert.ok(!nomes.includes('Ana Téc'), 'não lista a si mesmo');
  assert.ok(!nomes.includes('Carlos Inativo'), 'não lista inativos');
  assert.ok(b.tecnicos.every((t) => Object.keys(t).sort().join() === 'empresa,id,nome,tipo'), 'sem telefone nem e-mail');
  assert.ok(b.itens.some((i) => i.id === cabo) && !b.itens.some((i) => i.id === itemInativo));
  assert.equal(b.regras.descricao_min_caracteres, 11);
  assert.ok(b.tipos_servico.length >= 1);
  assert.ok(Array.isArray(b.sugestoes_servicos));
});

test('bootstrap: pendentes sempre; encerradas só dos últimos 30 dias; nada de outro técnico', async () => {
  const tec = await ins("INSERT INTO tecnicos (nome,tipo,usuario_id) VALUES ('Dora Téc','interno',?)", [(await mkUser('tecnico', 4)).id]);
  const user = { id: (await pool.query('SELECT usuario_id u FROM tecnicos WHERE id = ?', [tec]))[0][0].u, role: 'tecnico' };
  const aberta = await novaOS(tec); const andamento = await novaOS(tec); const recente = await novaOS(tec); const velha = await novaOS(tec);
  await pool.query("UPDATE ordens_servico SET status = 'em_andamento' WHERE id = ?", [andamento.id]);
  await pool.query("UPDATE ordens_servico SET status = 'concluida' WHERE id = ?", [recente.id]);
  await pool.query("UPDATE ordens_servico SET status = 'concluida', atualizado_em = NOW() - INTERVAL 40 DAY WHERE id = ?", [velha.id]);
  const b = (await call(user, 'GET', '/mobile/bootstrap')).body;
  const porId = Object.fromEntries(b.os.map((o) => [o.id, o.status]));
  assert.equal(porId[aberta.id], 'aberta');
  assert.equal(porId[andamento.id], 'em_andamento');
  assert.equal(porId[recente.id], 'concluida');
  assert.equal(porId[velha.id], undefined);
  assert.deepEqual(b.os.map((o) => o.status), ['em_andamento', 'aberta', 'concluida']); // pendentes primeiro
});

test('bootstrap é só para técnico vinculado: admin/estoque e técnico sem cadastro recebem 403', async () => {
  assert.equal((await call(admin, 'GET', '/mobile/bootstrap')).status, 403);
  assert.equal((await call(almox, 'GET', '/mobile/bootstrap')).status, 403);
  const semVinculo = await call(u3, 'GET', '/mobile/bootstrap');
  assert.equal(semVinculo.status, 403);
  assert.match(semVinculo.body.error, /vinculado/);
});

test('iniciar: grava o horário do aparelho, põe em andamento e registra no histórico, uma vez só', async () => {
  const os = await novaOS(t1);
  await pool.query('UPDATE ordens_servico SET criado_em = NOW() - INTERVAL 1 HOUR WHERE id = ?', [os.id]); // aberta há 1 h
  const quando = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const a = await call(u1, 'POST', `/os/${os.id}/iniciar`, { iniciado_em: quando });
  assert.equal(a.status, 200);
  assert.equal(a.body.status, 'em_andamento');
  assert.equal(a.body.iniciado_em.slice(0, 19), quando.slice(0, 19)); // MySQL guarda em segundos
  assert.equal(a.body.repetida, undefined);

  const b = await call(u1, 'POST', `/os/${os.id}/iniciar`, { iniciado_em: new Date().toISOString() }); // reenvio com outro horário
  assert.equal(b.status, 200);
  assert.equal(b.body.repetida, true);
  assert.equal(b.body.iniciado_em, a.body.iniciado_em); // o primeiro vale
  const [h] = await pool.query("SELECT de, para FROM os_historico_status WHERE os_id = ? AND para = 'em_andamento'", [os.id]);
  assert.equal(h.length, 1);
  const [[linha]] = await pool.query('SELECT status, iniciado_em FROM ordens_servico WHERE id = ?', [os.id]);
  assert.equal(linha.status, 'em_andamento');
  assert.ok(linha.iniciado_em);
});

test('iniciar: horário absurdo é corrigido (futuro vira agora, anterior à abertura vira a abertura)', async () => {
  const futura = await novaOS(t1);
  const f = await call(u1, 'POST', `/os/${futura.id}/iniciar`, { iniciado_em: new Date(Date.now() + 3 * 3600 * 1000).toISOString() });
  assert.ok(new Date(f.body.iniciado_em) <= new Date(Date.now() + 5000));
  const antiga = await novaOS(t1);
  const a = await call(u1, 'POST', `/os/${antiga.id}/iniciar`, { iniciado_em: '2001-01-01T00:00:00Z' });
  const [[o]] = await pool.query('SELECT criado_em FROM ordens_servico WHERE id = ?', [antiga.id]);
  assert.equal(a.body.iniciado_em.slice(0, 19), new Date(o.criado_em).toISOString().slice(0, 19));
  const lixo = await novaOS(t1);
  assert.equal((await call(u1, 'POST', `/os/${lixo.id}/iniciar`, { iniciado_em: 'não é data' })).status, 200);
});

test('iniciar: OS de outro técnico é 403, encerrada é 409, e Idempotency-Key repete a resposta', async () => {
  const dele = await novaOS(t2);
  assert.equal((await call(u1, 'POST', `/os/${dele.id}/iniciar`)).status, 403);
  const [[sem]] = await pool.query('SELECT iniciado_em FROM ordens_servico WHERE id = ?', [dele.id]);
  assert.equal(sem.iniciado_em, null);

  const encerrada = await novaOS(t1);
  await svc.fecharOS({ os_id: encerrada.id }, { id: u1.id, role: 'tecnico', tecnicoId: t1 });
  assert.equal((await call(u1, 'POST', `/os/${encerrada.id}/iniciar`)).status, 409);

  const os = await novaOS(t1);
  const h = { 'Idempotency-Key': randomUUID() };
  const a = await call(u1, 'POST', `/os/${os.id}/iniciar`, {}, h);
  const b = await call(u1, 'POST', `/os/${os.id}/iniciar`, {}, h);
  assert.equal(b.body.repetida, true);
  assert.equal(b.body.iniciado_em, a.body.iniciado_em);
  assert.equal(b.headers.get('idempotent-replayed'), 'true');
});

test('GET /os?atualizado_desde devolve só o que mudou, só do técnico, e valida a data', async () => {
  const antes = await novaOS(t1);
  await pool.query('UPDATE ordens_servico SET atualizado_em = NOW() - INTERVAL 2 DAY WHERE id = ?', [antes.id]);
  const marco = new Date(Date.now() - 60 * 1000).toISOString();
  const mexida = await novaOS(t1);
  await call(u1, 'POST', `/os/${mexida.id}/iniciar`);
  const doOutro = await novaOS(t2);

  const r = await call(u1, 'GET', `/os?atualizado_desde=${encodeURIComponent(marco)}`);
  assert.equal(r.status, 200);
  const ids = r.body.map((o) => o.id);
  assert.ok(ids.includes(mexida.id));
  assert.ok(!ids.includes(antes.id), 'OS que não mudou não volta');
  assert.ok(!ids.includes(doOutro.id), 'OS de outro técnico nunca volta');
  assert.ok(r.body.every((o) => o.atualizado_em && 'iniciado_em' in o));

  const staff = await call(almox, 'GET', `/os?atualizado_desde=${encodeURIComponent(marco)}`);
  assert.ok(staff.body.map((o) => o.id).includes(doOutro.id));
  assert.equal((await call(u1, 'GET', '/os?atualizado_desde=ontem')).status, 400);
  // sem o filtro a lista segue como antes (inclusive a antiga)
  assert.ok((await call(u1, 'GET', '/os')).body.map((o) => o.id).includes(antes.id));
});

test('mudança de status atualiza atualizado_em (cancelamento/reatribuição chegam ao app pelo bootstrap)', async () => {
  const os = await novaOS(t1);
  await pool.query('UPDATE ordens_servico SET atualizado_em = NOW() - INTERVAL 3 DAY WHERE id = ?', [os.id]);
  await svc.cancelarOS({ os_id: os.id }, almox.id);
  const [[o]] = await pool.query('SELECT atualizado_em, status FROM ordens_servico WHERE id = ?', [os.id]);
  assert.equal(o.status, 'cancelada');
  assert.ok(Date.now() - new Date(o.atualizado_em).getTime() < 60 * 1000);
  const b = (await call(u1, 'GET', '/mobile/bootstrap')).body;
  assert.equal(b.os.find((x) => x.id === os.id).status, 'cancelada');
});
