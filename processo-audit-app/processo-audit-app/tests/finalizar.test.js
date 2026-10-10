// Finalização da OS pelo app: persiste tudo, revalida no servidor, é atômica e idempotente.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';

const fotosDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fotos-finalizar-'));
process.env.FOTOS_DIR = fotosDir;
const { pool, prepararBanco } = await import('./helpers/db.js');
const svc = await import('../src/services/estoqueService.js');
const { validarForma } = await import('../src/services/fechamentoService.js');
const { default: osRouter } = await import('../src/routes/os.js');

let server, base, liberarBanco, almox, admin, u1, u2, t1, t2, tPart, tInativo, cabo, conector;
const token = (u) => jwt.sign({ id: u.id, role: u.role, email: u.email }, process.env.JWT_SECRET);
const JPEG = Buffer.concat([Buffer.from('ffd8ffe000104a46494600010100000100010000', 'hex'), Buffer.from('foto'), Buffer.from('ffd9', 'hex')]);
const call = async (user, method, p, body, headers = {}) => {
  const r = await fetch(base + p, {
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
const foto = async (user, osId, uuid = randomUUID()) => {
  const fd = new FormData();
  fd.append('foto', new Blob([JPEG], { type: 'image/jpeg' }), 'a.jpg'); fd.append('client_uuid', uuid);
  const r = await fetch(`${base}/os/${osId}/fotos`, { method: 'POST', headers: { Authorization: `Bearer ${token(user)}` }, body: fd });
  assert.equal(r.status, 201); return uuid;
};

before(async () => {
  liberarBanco = await prepararBanco();
  almox = await mkUser('estoque', 1); admin = await mkUser('admin', 1); u1 = await mkUser('tecnico', 1); u2 = await mkUser('tecnico', 2);
  t1 = await ins("INSERT INTO tecnicos (nome,tipo,usuario_id) VALUES ('Ana','interno',?)", [u1.id]);
  t2 = await ins("INSERT INTO tecnicos (nome,tipo,usuario_id) VALUES ('Bruno','interno',?)", [u2.id]);
  tPart = await ins("INSERT INTO tecnicos (nome,tipo,empresa) VALUES ('Equipe Apoio','terceirizado','Apoio Ltda')");
  tInativo = await ins("INSERT INTO tecnicos (nome,tipo,ativo) VALUES ('Inativo','interno',0)");
  cabo = await ins("INSERT INTO estoque_itens (nome,unidade) VALUES ('Cabo Drop','metros')");
  conector = await ins("INSERT INTO estoque_itens (nome,unidade) VALUES ('Conector SC','pecas')");
  const app = express(); app.use(express.json()); app.use('/api/os', osRouter);
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  server?.close(); await liberarBanco?.(); await pool.end();
  fs.rmSync(fotosDir, { recursive: true, force: true });
});

// OS do técnico 1 pronta para finalizar: com lançamento (material baixado) e uma foto enviada
const preparar = async ({ comLancamento = true, comFoto = true } = {}) => {
  const o = await svc.criarOS({ cliente: 'Cliente X', tecnico_id: t1 }, almox.id);
  const { lotes: [lote] } = await svc.criarCompra({ item_id: cabo, tipo_volume: 'bobina', qtd_volumes: 1, medida_por_volume: 1000 }, almox.id);
  await svc.retirar({ lote_id: lote.id, tecnico_id: t1, quantidade: 400 }, almox.id);
  const actor = { id: u1.id, role: 'tecnico', tecnicoId: t1 };
  if (comLancamento) await svc.lancarServicoComMateriais({ os_id: o.id, descricao: 'Lançamento de cabo', trecho: 'PL-1 → PL-2', materiais: [{ lote_id: lote.id, quantidade: 120 }] }, actor);
  const fotoUuid = comFoto ? await foto(u1, o.id) : null;
  return { os: o, lote, fotoUuid };
};
const pacote = ({ os: o, fotoUuid }, sobrescrever = {}) => ({
  client_uuid: randomUUID(),
  descricao: 'Lançados 120 m de cabo entre PL-1 e PL-2; CEO vedada.',
  motivo_codigo: 'route_launched',
  local: { lat: -23.5505, lng: -46.6333, precisao_m: 8, origem: 'gps', capturado_em: new Date().toISOString() },
  checklist: { fiberLaunchedMeters: 120, spliceEnclosureSealed: true, dropClampsUsed: '4', slackLoopsLeft: 2, fiberTagged: true, opticalPowerOk: false, fieldNotes: '  Tudo certo  ' },
  materiais_usados: true,
  materiais_retirados: true,
  retirados: [{ item_id: cabo, quantidade: 15.5, condicao: 'usado' }, { descricao: 'Splitter 1:8 antigo', quantidade: 1, unidade: 'pecas', condicao: 'usado' }],
  participantes: [tPart, t1, tPart],
  fotos_esperadas: fotoUuid ? [fotoUuid] : [],
  iniciado_em: new Date(Date.now() - 3600 * 1000).toISOString(), finalizado_em: new Date().toISOString(),
  dispositivo: 'Pixel 7', versao_app: '1.0.0',
  ...sobrescrever,
});
const finalizar = (user, osId, body, h) => call(user, 'POST', `/os/${osId}/finalizar`, body, h);
const estadoOS = async (id) => (await pool.query('SELECT status FROM ordens_servico WHERE id = ?', [id]))[0][0].status;
const contar = async (tabela, osId) => (await pool.query(`SELECT COUNT(*) n FROM ${tabela} WHERE os_id = ?`, [osId]))[0][0].n;

test('finalizar persiste tudo, encerra a OS, apaga o rascunho e não mexe no estoque dos retirados', async () => {
  const ctx = await preparar();
  await pool.query('INSERT INTO os_rascunhos (os_id, dados, atualizado_por) VALUES (?,?,?)', [ctx.os.id, '{"status":"in_execution"}', u1.id]);
  const posseAntes = Number((await pool.query('SELECT quantidade q FROM estoque_posse WHERE lote_id=? AND tecnico_id=?', [ctx.lote.id, t1]))[0][0].q);
  const saldoAntes = Number((await pool.query('SELECT saldo_atual s FROM estoque_lotes WHERE id=?', [ctx.lote.id]))[0][0].s);

  const p = pacote(ctx);
  const r = await finalizar(u1, ctx.os.id, p);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.status, 'concluida');
  assert.ok(r.body.fechamento_id);

  const [[o]] = await pool.query('SELECT status, concluida_em, iniciado_em FROM ordens_servico WHERE id = ?', [ctx.os.id]);
  assert.equal(o.status, 'concluida'); assert.ok(o.concluida_em); assert.ok(o.iniciado_em);
  assert.equal(await contar('os_rascunhos', ctx.os.id), 0);
  const [[hist]] = await pool.query("SELECT COUNT(*) n FROM os_historico_status WHERE os_id = ? AND para = 'concluida'", [ctx.os.id]);
  assert.equal(hist.n, 1);

  const [[f]] = await pool.query('SELECT * FROM os_fechamentos WHERE os_id = ?', [ctx.os.id]);
  assert.equal(f.descricao, p.descricao);
  assert.equal(f.motivo_rotulo, 'Rota lançada com sucesso');
  assert.equal(Number(f.local_lat), -23.5505); assert.equal(f.local_origem, 'gps'); assert.equal(f.local_precisao_m, 8);
  assert.equal(f.materiais_usados, 1); assert.equal(f.materiais_retirados, 1);
  assert.equal(f.dispositivo, 'Pixel 7'); assert.equal(f.client_uuid, p.client_uuid); assert.equal(f.finalizado_por, u1.id);
  const checklist = JSON.parse(f.checklist);
  assert.equal(checklist.length, 7);
  const porCodigo = Object.fromEntries(checklist.map((c) => [c.codigo, c]));
  assert.equal(porCodigo.fiberLaunchedMeters.resposta, 120);
  assert.equal(porCodigo.fiberLaunchedMeters.rotulo, 'Metros de fibra lançados?'); // rótulo copiado
  assert.equal(porCodigo.dropClampsUsed.resposta, 4); // "4" virou número
  assert.equal(porCodigo.opticalPowerOk.resposta, false);
  assert.equal(porCodigo.fieldNotes.resposta, 'Tudo certo');
  assert.deepEqual(JSON.parse(f.participantes), [{ tecnico_id: tPart, nome: 'Equipe Apoio' }]); // sem duplicata nem o próprio técnico

  const [ret] = await pool.query('SELECT * FROM os_materiais_retirados WHERE os_id = ? ORDER BY id', [ctx.os.id]);
  assert.equal(ret.length, 2);
  assert.deepEqual([ret[0].descricao, ret[0].unidade, Number(ret[0].quantidade), ret[0].item_id], ['Cabo Drop', 'metros', 15.5, cabo]);
  assert.deepEqual([ret[1].descricao, ret[1].unidade, ret[1].condicao, ret[1].item_id], ['Splitter 1:8 antigo', 'pecas', 'usado', null]);

  // retirados são só informação: posse e saldo ficam como estavam depois do lançamento
  assert.equal(Number((await pool.query('SELECT quantidade q FROM estoque_posse WHERE lote_id=? AND tecnico_id=?', [ctx.lote.id, t1]))[0][0].q), posseAntes);
  assert.equal(Number((await pool.query('SELECT saldo_atual s FROM estoque_lotes WHERE id=?', [ctx.lote.id]))[0][0].s), saldoAntes);
  assert.equal(await contar('os_fotos', ctx.os.id), 1);
});

test('o detalhe da OS mostra fechamento, fotos e retirados ao dono e ao estoque, e nega a outro técnico', async () => {
  const ctx = await preparar();
  await finalizar(u1, ctx.os.id, pacote(ctx));
  const d = await call(u1, 'GET', `/os/${ctx.os.id}`);
  assert.equal(d.status, 200);
  assert.equal(d.body.status, 'concluida');
  assert.equal(d.body.fechamento.motivo, 'Rota lançada com sucesso');
  assert.equal(d.body.fechamento.local.lat, -23.5505);
  assert.equal(d.body.fechamento.checklist.length, 7);
  assert.equal(d.body.fechamento.finalizado_por_nome, 'tecnico 1');
  assert.equal(d.body.fotos.length, 1);
  assert.equal(d.body.fotos[0].arquivo, undefined);
  assert.equal(d.body.materiais_retirados.length, 2);
  assert.equal((await call(almox, 'GET', `/os/${ctx.os.id}`)).body.fechamento.descricao, d.body.fechamento.descricao);
  assert.equal((await call(u2, 'GET', `/os/${ctx.os.id}`)).status, 403);
  const semFechamento = await svc.criarOS({ cliente: 'Y', tecnico_id: t1 }, almox.id);
  const vazio = (await call(u1, 'GET', `/os/${semFechamento.id}`)).body;
  assert.equal(vazio.fechamento, null); assert.deepEqual(vazio.fotos, []);
});

test('reenviar a mesma finalização (com ou sem Idempotency-Key) devolve o resultado sem duplicar nada', async () => {
  const ctx = await preparar();
  const p = pacote(ctx);
  const a = await finalizar(u1, ctx.os.id, p);
  const b = await finalizar(u1, ctx.os.id, p); // sem chave: protegido pelo client_uuid
  assert.equal(b.status, 201); assert.equal(b.body.repetida, true); assert.equal(b.body.fechamento_id, a.body.fechamento_id);
  const ctx2 = await preparar(); const p2 = pacote(ctx2); const chave = { 'Idempotency-Key': randomUUID() };
  await finalizar(u1, ctx2.os.id, p2, chave);
  const d = await finalizar(u1, ctx2.os.id, p2, chave);
  assert.equal(d.body.repetida, true); assert.equal(d.headers.get('idempotent-replayed'), 'true');
  for (const c of [ctx, ctx2]) {
    assert.equal(await contar('os_fechamentos', c.os.id), 1);
    assert.equal(await contar('os_materiais_retirados', c.os.id), 2);
  }
  const [[hist]] = await pool.query("SELECT COUNT(*) n FROM os_historico_status WHERE os_id = ? AND para = 'concluida'", [ctx.os.id]);
  assert.equal(hist.n, 1);
});

test('três finalizações simultâneas da mesma OS resultam em um único fechamento', async () => {
  const ctx = await preparar();
  const p = pacote(ctx);
  const rs = await Promise.all([1, 2, 3].map(() => finalizar(u1, ctx.os.id, p)));
  assert.ok(rs.every((r) => r.status === 201), JSON.stringify(rs.map((r) => r.status)));
  assert.equal(new Set(rs.map((r) => r.body.fechamento_id)).size, 1);
  assert.equal(await contar('os_fechamentos', ctx.os.id), 1);
  assert.equal(await contar('os_materiais_retirados', ctx.os.id), 2);
});

test('pacote vazio: 400 com TODOS os problemas listados e nada é gravado', async () => {
  const ctx = await preparar({ comLancamento: false, comFoto: false });
  const r = await finalizar(u1, ctx.os.id, { client_uuid: randomUUID() });
  assert.equal(r.status, 400);
  const campos = new Set(r.body.detalhes.map((d) => d.campo));
  for (const c of ['descricao', 'motivo', 'local', 'checklist', 'materiais_usados', 'materiais_retirados', 'fotos']) assert.ok(campos.has(c), `faltou apontar ${c}`);
  assert.match(r.body.error, /não pode ser finalizada/);
  assert.match(r.body.error, /e mais \d+ problema/);
  assert.notEqual(await estadoOS(ctx.os.id), 'concluida');
  assert.equal(await contar('os_fechamentos', ctx.os.id), 0);
});

// cada regra do servidor: [nome, pacote alterado, trecho esperado em alguma mensagem]
const REGRAS = [
  ['descrição com 10 caracteres', { descricao: '1234567890' }, /Descrição muito curta/],
  ['descrição só com espaços', { descricao: '            ' }, /Descrição muito curta/],
  ['motivo inexistente', { motivo_codigo: 'nao_existe' }, /Motivo de fechamento inválido/],
  ['sem motivo', { motivo_codigo: undefined }, /Escolha o motivo/],
  ['local fora do intervalo', { local: { lat: 91, lng: 0, origem: 'gps' } }, /coordenadas inválidas/],
  ['origem do local inválida', { local: { lat: 1, lng: 1, origem: 'chute' } }, /Origem do local/],
  ['checklist obrigatório faltando', { checklist: { fiberLaunchedMeters: 1 } }, /Responda o item do checklist/],
  ['checklist booleano com texto', { checklist: { fiberLaunchedMeters: 1, spliceEnclosureSealed: 'sim', dropClampsUsed: 1, slackLoopsLeft: 1, fiberTagged: true, opticalPowerOk: true } }, /Resposta inválida no checklist: A caixa de emenda/],
  ['checklist numérico negativo', { checklist: { fiberLaunchedMeters: -5, spliceEnclosureSealed: true, dropClampsUsed: 1, slackLoopsLeft: 1, fiberTagged: true, opticalPowerOk: true } }, /Resposta inválida no checklist: Metros/],
  ['retirados sem itens', { retirados: [] }, /Liste os materiais retirados/],
  ['retirados listados mas etapa diz nenhum', { materiais_retirados: false }, /nenhum foi retirado/],
  ['retirado em peças fracionado', { retirados: [{ descricao: 'Conector', quantidade: 1.5, unidade: 'pecas', condicao: 'novo' }] }, /número inteiro/],
  ['retirado sem condição', { retirados: [{ descricao: 'Conector', quantidade: 1, unidade: 'pecas' }] }, /condição/],
  ['retirado com quantidade zero', { retirados: [{ descricao: 'Cabo', quantidade: 0, unidade: 'metros', condicao: 'novo' }] }, /maior que zero/],
  ['retirado de item inexistente', { retirados: [{ item_id: 999999, quantidade: 1, condicao: 'novo' }] }, /Item do estoque não encontrado/],
  ['participante inativo', { participantes: [tInativo] }, /não encontrado ou inativo/],
  ['flag de materiais não booleana', { materiais_usados: 'sim' }, /materiais foram usados/],
  ['foto esperada que não chegou', { fotos_esperadas: [randomUUID()] }, /ainda não chegaram/],
  ['client_uuid das fotos malformado', { fotos_esperadas: ['x'] }, /fotos esperadas inválida/],
];
for (const [nome, alteracao, esperado] of REGRAS) {
  test(`regra do servidor: ${nome}`, async () => {
    const ctx = await preparar();
    const r = await finalizar(u1, ctx.os.id, pacote(ctx, alteracao));
    assert.equal(r.status, 400, JSON.stringify(r.body));
    assert.ok(r.body.detalhes.some((d) => esperado.test(d.mensagem)), `esperava ${esperado}, veio ${JSON.stringify(r.body.detalhes)}`);
    assert.notEqual(await estadoOS(ctx.os.id), 'concluida');
    assert.equal(await contar('os_fechamentos', ctx.os.id), 0);
    assert.equal(await contar('os_materiais_retirados', ctx.os.id), 0);
  });
}

test('limites: descrição de 11 caracteres vale e coordenadas de borda (-90, 180) valem', async () => {
  const ctx = await preparar();
  const r = await finalizar(u1, ctx.os.id, pacote(ctx, { descricao: '12345678901', local: { lat: -90, lng: 180, origem: 'address', endereco: 'Rua A' } }));
  assert.equal(r.status, 201, JSON.stringify(r.body));
});

test('sem nenhuma foto enviada a OS não finaliza, e depois de enviar a foto finaliza', async () => {
  const ctx = await preparar({ comFoto: false });
  const r = await finalizar(u1, ctx.os.id, pacote(ctx));
  assert.equal(r.status, 400);
  assert.deepEqual(r.body.detalhes.map((d) => d.campo), ['fotos']);
  assert.match(r.body.detalhes[0].mensagem, /ao menos 1 foto/);
  assert.notEqual(await estadoOS(ctx.os.id), 'concluida');
  const uuid = await foto(u1, ctx.os.id);
  assert.equal((await finalizar(u1, ctx.os.id, pacote({ ...ctx, fotoUuid: uuid }))).status, 201);
});

test('materiais usados precisam bater com os lançamentos: sem lançamento não dá para dizer "usei", com lançamento não dá para dizer "não usei"', async () => {
  const sem = await preparar({ comLancamento: false });
  const a = await finalizar(u1, sem.os.id, pacote(sem, { materiais_usados: true }));
  assert.equal(a.status, 400); assert.ok(a.body.detalhes.some((d) => d.campo === 'materiais_usados'));
  assert.equal((await finalizar(u1, sem.os.id, pacote(sem, { materiais_usados: false }))).status, 201); // "não usei" sem lançamentos: ok

  const com = await preparar();
  const b = await finalizar(u1, com.os.id, pacote(com, { materiais_usados: false }));
  assert.equal(b.status, 400); assert.ok(b.body.detalhes.some((d) => /Há materiais lançados/.test(d.mensagem)));
});

test('baixa totalmente estornada não conta como material usado', async () => {
  const ctx = await preparar();
  const [[mov]] = await pool.query("SELECT id FROM estoque_movimentacoes WHERE os_id = ? AND tipo = 'baixa_os'", [ctx.os.id]);
  await svc.estornarBaixa({ movimentacao_id: mov.id, motivo: 'Lançado errado' }, almox.id);
  assert.equal((await finalizar(u1, ctx.os.id, pacote(ctx, { materiais_usados: true }))).status, 400);
  assert.equal((await finalizar(u1, ctx.os.id, pacote(ctx, { materiais_usados: false }))).status, 201);
});

test('permissões e estados: outro técnico 403, OS cancelada 409, OS já encerrada 409, uuid de outra OS 409', async () => {
  const ctx = await preparar();
  assert.equal((await finalizar(u2, ctx.os.id, pacote(ctx))).status, 403);

  const cancelada = await preparar({ comLancamento: false });
  await svc.cancelarOS({ os_id: cancelada.os.id }, almox.id);
  assert.equal((await finalizar(u1, cancelada.os.id, pacote(cancelada, { materiais_usados: false }))).status, 409);

  const web = await preparar();
  assert.equal((await call(u1, 'POST', `/os/${web.os.id}/fechar`)).status, 200); // fechada pelo fluxo antigo do web
  const tarde = await finalizar(u1, web.os.id, pacote(web));
  assert.equal(tarde.status, 409); assert.match(tarde.body.error, /encerrada/);
  assert.equal(await contar('os_fechamentos', web.os.id), 0);

  const primeira = await preparar(); const p = pacote(primeira);
  assert.equal((await finalizar(u1, primeira.os.id, p)).status, 201);
  const outraFinalizacao = await finalizar(u1, primeira.os.id, pacote(primeira)); // outro client_uuid, mesma OS
  assert.equal(outraFinalizacao.status, 409); assert.match(outraFinalizacao.body.error, /já foi finalizada/);
  const outra = await preparar();
  const roubado = await finalizar(u1, outra.os.id, pacote(outra, { client_uuid: p.client_uuid })); // uuid já usado em outra OS
  assert.equal(roubado.status, 409);
  assert.notEqual(await estadoOS(outra.os.id), 'concluida');
  assert.equal((await finalizar(u1, ctx.os.id, { ...pacote(ctx), client_uuid: 'invalido' })).status, 400);
});

test('é atômico: se algo falha no meio, nada fica gravado (OS aberta, rascunho e fechamento intactos)', async () => {
  const ctx = await preparar();
  await pool.query('INSERT INTO os_rascunhos (os_id, dados, atualizado_por) VALUES (?,?,?)', [ctx.os.id, '{"x":1}', u1.id]);
  // força uma falha depois do fechamento já inserido: a trigger recusa qualquer retirado
  await pool.query("CREATE TRIGGER trg_teste_falha BEFORE INSERT ON os_materiais_retirados FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'falha de teste'");
  const silenciar = (await import('node:test')).mock.method(console, 'error', () => {});
  try {
    const r = await finalizar(u1, ctx.os.id, pacote(ctx));
    assert.equal(r.status, 500);
  } finally {
    silenciar.mock.restore();
    await pool.query('DROP TRIGGER trg_teste_falha');
  }
  assert.notEqual(await estadoOS(ctx.os.id), 'concluida');
  assert.equal(await contar('os_fechamentos', ctx.os.id), 0);
  assert.equal(await contar('os_rascunhos', ctx.os.id), 1);
  assert.equal(await contar('os_fotos', ctx.os.id), 1);
  // e o reenvio depois do problema resolvido funciona
  assert.equal((await finalizar(u1, ctx.os.id, pacote(ctx))).status, 201);
});

test('validarForma (pura): aceita pacote bom e aponta cada campo ruim', () => {
  const bom = pacote({ os: { id: 1 }, fotoUuid: null });
  assert.deepEqual(validarForma(bom).erros, []);
  const ruim = validarForma({ descricao: 'curta', local: { lat: 'x' }, materiais_usados: 1, participantes: ['a'], fotos_esperadas: 'x' });
  assert.deepEqual([...new Set(ruim.erros.map((e) => e.campo))].sort(), ['descricao', 'fotos', 'local', 'materiais_retirados', 'materiais_usados', 'motivo', 'participantes']);
});
