// Finalização de OS no web: regras puras (etapas, corpo do POST /finalizar, rascunhos antigos) e o contrato com o servidor real.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';

const fotosDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fotos-webfin-'));
process.env.FOTOS_DIR = fotosDir;
const { pool, prepararBanco } = await import('./helpers/db.js');
const svc = await import('../src/services/estoqueService.js');
const { default: osRouter } = await import('../src/routes/os.js');
const F = await import('../frontend/src/pages/fieldwork/finalizacao.js');

let server, base, liberarBanco, almox, u1, t1, tPart, cabo, conector, catalogos;
const token = (u) => jwt.sign({ id: u.id, role: u.role, email: u.email }, process.env.JWT_SECRET);
const JPEG = Buffer.concat([Buffer.from('ffd8ffe000104a46494600010100000100010000', 'hex'), Buffer.from('foto'), Buffer.from('ffd9', 'hex')]);
const call = async (user, method, p, body, headers = {}) => {
  const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token(user)}`, ...headers }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, corpo: await r.json().catch(() => ({})) };
};
const mkUser = async (role, n) => {
  const [r] = await pool.query('INSERT INTO users (email,password,name,role) VALUES (?,?,?,?)', [`${role}${n}@w.local`, 'x', `${role} ${n}`, role]);
  return { id: r.insertId, role, email: `${role}${n}@w.local` };
};
const ins = async (sql, p) => (await pool.query(sql, p))[0].insertId;

before(async () => {
  liberarBanco = await prepararBanco();
  almox = await mkUser('estoque', 1); u1 = await mkUser('tecnico', 1);
  t1 = await ins("INSERT INTO tecnicos (nome,tipo,usuario_id) VALUES ('Ana','interno',?)", [u1.id]);
  tPart = await ins("INSERT INTO tecnicos (nome,tipo,empresa) VALUES ('Equipe Apoio','terceirizado','Apoio Ltda')");
  cabo = await ins("INSERT INTO estoque_itens (nome,unidade) VALUES ('Cabo Drop','metros')");
  conector = await ins("INSERT INTO estoque_itens (nome,unidade) VALUES ('Conector SC','pecas')");
  const app = express(); app.use(express.json()); app.use('/api/os', osRouter);
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://127.0.0.1:${server.address().port}/api`;
  catalogos = (await call(u1, 'GET', '/os/catalogos-fechamento')).corpo;
});
after(async () => { server?.close(); await liberarBanco?.(); await pool.end(); fs.rmSync(fotosDir, { recursive: true, force: true }); });

/* ───────── regras puras ───────── */
const vazio = () => ({
  status: 'in_execution', startedAt: '2026-10-11T12:00:00.000Z', closedAt: null, description: '', closingReasonId: null, interventionLocation: null, checklistAnswers: {},
  usedMaterials: { wereUsed: null, lines: [] }, removedMaterials: { wereRemoved: null, lines: [] }, crewMemberIds: [], finalizeUuid: null,
});
const CAT = {
  motivos: [{ id: 1, codigo: 'route_launched', rotulo: 'Rota lançada' }, { id: 2, codigo: 'pole_obstructed', rotulo: 'Poste obstruído' }],
  checklist: [
    { codigo: 'metros', rotulo: 'Metros', tipo: 'number', unidade: 'm', obrigatorio: true }, { codigo: 'vedada', rotulo: 'Vedada?', tipo: 'boolean', unidade: null, obrigatorio: true },
    { codigo: 'obs', rotulo: 'Obs', tipo: 'text', unidade: null, obrigatorio: false },
  ],
  tecnicos: [], itens: [], regras: F.REGRAS_PADRAO,
};
const ORDEM = { launches: [{ id: 1 }], photos: [{ id: 5, client_uuid: '11111111-1111-4111-8111-111111111111' }] };
const completo = () => ({
  ...vazio(), description: 'Lançados 120 m entre PL-1 e PL-2', closingReasonId: 'route_launched',
  interventionLocation: { lat: -23.5, lng: -46.3, source: 'gps', accuracyMeters: 7, capturedAt: '2026-10-11T12:30:00.000Z' },
  checklistAnswers: { metros: '120,5', vedada: true }, removedMaterials: { wereRemoved: false, lines: [] },
});

test('etapas: descrição precisa ter 11 ou mais caracteres (a regra vem do servidor)', () => {
  const c = (d) => F.getStepCompletion({ ...vazio(), description: d }, ORDEM, CAT)['description'];
  assert.equal(c('1234567890'), false); assert.equal(c('12345678901'), true); assert.equal(c('   curta   '), false);
  assert.equal(F.getStepCompletion({ ...vazio(), description: '1234567' }, ORDEM, { ...CAT, regras: { ...F.REGRAS_PADRAO, descricao_min_caracteres: 5 } })['description'], true);
});

test('etapas: motivo precisa existir (e estar ativo) no catálogo; checklist só conta o obrigatório respondido no tipo certo', () => {
  const comp = (d) => F.getStepCompletion(d, ORDEM, CAT);
  assert.equal(comp({ ...vazio(), closingReasonId: 'route_launched' })['closing-reason'], true);
  assert.equal(comp({ ...vazio(), closingReasonId: 'motivo_que_nao_existe_mais' })['closing-reason'], false);
  assert.equal(comp({ ...vazio(), closingReasonId: null })['closing-reason'], false);
  assert.equal(comp({ ...vazio(), checklistAnswers: { metros: '10', vedada: false } })['checklists'], true);
  assert.equal(comp({ ...vazio(), checklistAnswers: { metros: '10' } })['checklists'], false);
  assert.equal(comp({ ...vazio(), checklistAnswers: { metros: '-1', vedada: true } })['checklists'], false);
  assert.equal(comp({ ...vazio(), checklistAnswers: { metros: '', vedada: true } })['checklists'], false);
  assert.equal(comp({ ...vazio(), checklistAnswers: { metros: '5', vedada: 'sim' } })['checklists'], false);
  assert.equal(F.getStepCompletion(vazio(), ORDEM, null)['checklists'], false); // catálogos ainda não chegaram
});

test('etapas: lançamentos, "não usei material" e fotos do servidor', () => {
  assert.equal(F.getStepCompletion(vazio(), { launches: [], photos: [] }, CAT)['used-materials'], false);
  assert.equal(F.getStepCompletion({ ...vazio(), usedMaterials: { wereUsed: false, lines: [] } }, { launches: [], photos: [] }, CAT)['used-materials'], true);
  assert.equal(F.getStepCompletion(vazio(), ORDEM, CAT)['used-materials'], true);
  assert.equal(F.getStepCompletion(vazio(), { launches: [], photos: [] }, CAT)['service-photos'], false);
  assert.equal(F.getStepCompletion(vazio(), ORDEM, CAT)['service-photos'], true);
});

test('materiais retirados: cada linha precisa de quantidade válida para a unidade E condição; item livre precisa de descrição', () => {
  const linha = (extra) => ({ inventoryId: 12, name: 'Cabo', unit: 'metros', quantity: '15,5', condition: 'usado', ...extra });
  const pronto = (lines, flag = true) => F.getStepCompletion({ ...vazio(), removedMaterials: { wereRemoved: flag, lines } }, ORDEM, CAT)['removed-materials'];
  assert.equal(pronto([linha()]), true);
  assert.equal(pronto([linha({ condition: null })]), false);
  assert.equal(pronto([linha({ quantity: '0' })]), false);
  assert.equal(pronto([linha({ quantity: '' })]), false);
  assert.equal(pronto([linha({ quantity: '1,234' })]), false); // metros: até 2 casas
  assert.equal(pronto([linha({ unit: 'pecas', quantity: '2' })]), true);
  assert.equal(pronto([linha({ unit: 'pecas', quantity: '2,5' })]), false); // peças: inteiro
  assert.equal(pronto([]), false);
  assert.equal(pronto([], false), true); // "nenhum material retirado"
  assert.equal(pronto([], null), false); // ainda não respondeu
  assert.equal(pronto([linha({ inventoryId: 'livre-abc', name: 'Splitter antigo', unit: 'pecas', quantity: '1' })]), true);
  assert.equal(pronto([linha({ inventoryId: 'livre-abc', name: ' ', unit: 'pecas', quantity: '1' })]), false);
});

test('canFinalize: só com todas as obrigatórias; participantes é opcional', () => {
  const d = completo();
  assert.equal(F.canFinalize(d, ORDEM, CAT), true);
  for (const quebra of [{ description: 'curta' }, { closingReasonId: null }, { interventionLocation: null }, { checklistAnswers: {} }, { removedMaterials: { wereRemoved: null, lines: [] } }]) {
    assert.equal(F.canFinalize({ ...d, ...quebra }, ORDEM, CAT), false, JSON.stringify(Object.keys(quebra)));
  }
  assert.equal(F.canFinalize(d, { launches: [{ id: 1 }], photos: [] }, CAT), false); // sem foto no servidor
  assert.equal(F.canFinalize({ ...d, crewMemberIds: [] }, ORDEM, CAT), true);
});

test('corpo do /finalizar: nomes da API, números de verdade, checklist por código e fotos esperadas do servidor', () => {
  const d = { ...completo(), finalizeUuid: randomUUID(), crewMemberIds: [7, 9], removedMaterials: { wereRemoved: true, lines: [
    { inventoryId: 12, name: 'Cabo', unit: 'metros', quantity: '15,5', condition: 'usado' },
    { inventoryId: 'livre-x', name: ' Splitter antigo ', unit: 'pecas', quantity: '1', condition: 'novo' },
  ] }, checklistAnswers: { metros: '120,5', vedada: true, obs: '  tudo certo  ' } };
  const corpo = F.montarCorpoFinalizacao({ order: ORDEM, draft: d, catalogs: CAT, agora: new Date('2026-10-11T15:00:00Z'), dispositivo: 'Mozilla/5.0 teste' });
  assert.deepEqual(corpo, {
    client_uuid: d.finalizeUuid, descricao: 'Lançados 120 m entre PL-1 e PL-2', motivo_codigo: 'route_launched',
    local: { lat: -23.5, lng: -46.3, precisao_m: 7, origem: 'gps', endereco: null, aproximado: false, capturado_em: '2026-10-11T12:30:00.000Z' },
    checklist: { metros: 120.5, vedada: true, obs: 'tudo certo' }, materiais_usados: true, materiais_retirados: true,
    retirados: [{ item_id: 12, quantidade: 15.5, condicao: 'usado' }, { descricao: 'Splitter antigo', quantidade: 1, unidade: 'pecas', condicao: 'novo' }],
    participantes: [7, 9], fotos_esperadas: ['11111111-1111-4111-8111-111111111111'], iniciado_em: '2026-10-11T12:00:00.000Z', finalizado_em: '2026-10-11T15:00:00.000Z',
    dispositivo: 'Mozilla/5.0 teste', versao_app: 'web',
  });
  const semRetirados = F.montarCorpoFinalizacao({ order: ORDEM, draft: { ...completo(), finalizeUuid: randomUUID(), removedMaterials: { wereRemoved: false, lines: [{ inventoryId: 1, quantity: '9', condition: 'novo', unit: 'pecas' }] } }, catalogs: CAT });
  assert.deepEqual(semRetirados.retirados, []); // "nenhum retirado" não manda linhas esquecidas
  assert.equal(semRetirados.materiais_retirados, false);
  assert.equal(F.montarCorpoFinalizacao({ order: { launches: [], photos: [] }, draft: { ...completo(), finalizeUuid: randomUUID() }, catalogs: CAT }).materiais_usados, false);
  assert.equal(F.montarCorpoFinalizacao({ order: ORDEM, draft: { ...completo(), finalizeUuid: 'x', description: '  texto com espaços nas pontas  ' }, catalogs: CAT, dispositivo: 'x'.repeat(500) }).dispositivo.length, 160);
});

test('rascunho: o do web volta inteiro; o do app do celular é ignorado; sobra de versões antigas é limpa', () => {
  const salvo = F.rascunhoParaSalvar({ ...completo(), servicePhotos: [{ id: 'a', url: 'data:image/jpeg;base64,AAAA' }] });
  assert.equal(salvo.origem, 'web'); assert.equal(salvo.versao, 2); assert.ok(!('servicePhotos' in salvo)); // foto não vai no rascunho
  assert.equal(F.lerRascunho(salvo, vazio()).description, 'Lançados 120 m entre PL-1 e PL-2');
  assert.equal(F.lerRascunho({ versao: 2, origem: 'mobile', descricao: 'x' }, vazio()), null);
  assert.equal(F.lerRascunho(null, vazio()), null); assert.equal(F.lerRascunho([], vazio()), null); assert.equal(F.lerRascunho('texto', vazio()), null);
  const antigo = F.lerRascunho({
    status: 'in_execution', description: 'Rascunho antigo do web',
    servicePhotos: [{ id: 'p1', url: 'data:image/jpeg;base64,BBBB' }],
    removedMaterials: { wereRemoved: true, lines: [{ inventoryId: 'inv-cab-asu12', name: 'Cabo de mentira', unit: 'm', quantity: '3' }, { inventoryId: 14, name: 'Real', unit: 'metros', quantity: '2', condition: 'novo' }] },
    crewMemberIds: ['cr-01', 4],
  }, vazio());
  assert.equal(antigo.description, 'Rascunho antigo do web');
  assert.ok(!('servicePhotos' in antigo));
  assert.deepEqual(antigo.removedMaterials.lines.map((l) => l.inventoryId), [14]); // o item de mentira saiu
  assert.deepEqual(antigo.crewMemberIds, [4]); // o participante de mentira saiu
  assert.equal(F.lerRascunho({ removedMaterials: 'lixo', crewMemberIds: 'lixo', checklistAnswers: [] }, vazio()).removedMaterials.lines.length, 0);
});

test('toFieldOrder: lançamentos só com material não estornado e fotos do servidor', () => {
  const o = F.toFieldOrder({ id: 7, numero: 7, cliente: 'Rota X', status: 'em_andamento', servicos: [{ id: 1, descricao: 'a', trecho: 't' }, { id: 2, descricao: 'b' }],
    materiais: [{ id: 10, servico_id: 1, item_nome: 'Cabo', lote_codigo: 'L1', quantidade: '5.00', unidade: 'metros', estorno_id: null }, { id: 11, servico_id: 2, item_nome: 'X', quantidade: 1, unidade: 'pecas', estorno_id: 3 }],
    fotos: [{ id: 4, client_uuid: 'u-4', tirada_em: '2026-10-11T10:00:00Z' }] });
  assert.equal(o.id, '7'); assert.equal(o.code, 'OS-7');
  assert.deepEqual(o.launches.map((l) => l.id), [1]); // o lançamento 2 só tinha material estornado
  assert.equal(o.launches[0].materials[0].quantity, 5);
  assert.deepEqual(o.photos, [{ id: 4, client_uuid: 'u-4', takenAt: '2026-10-11T10:00:00Z' }]);
  assert.equal(o.detailLoaded, true);
  assert.equal(F.toFieldOrder({ id: 1, numero: 1, cliente: 'L' }).detailLoaded, false); // item de lista: ainda sem detalhe
  assert.deepEqual(F.toFieldOrder({ id: 1, numero: 1, cliente: 'L' }).photos, []);
});

/* ───────── contrato com o servidor real ───────── */
const preparar = async () => {
  const o = await svc.criarOS({ cliente: 'Cliente Web', tecnico_id: t1 }, almox.id);
  const { lotes: [lote] } = await svc.criarCompra({ item_id: cabo, tipo_volume: 'bobina', qtd_volumes: 1, medida_por_volume: 1000 }, almox.id);
  await svc.retirar({ lote_id: lote.id, tecnico_id: t1, quantidade: 400 }, almox.id);
  await svc.lancarServicoComMateriais({ os_id: o.id, descricao: 'Lançamento de cabo', trecho: 'PL-1 → PL-2', materiais: [{ lote_id: lote.id, quantidade: 120 }] }, { id: u1.id, role: 'tecnico', tecnicoId: t1 });
  const uuid = randomUUID();
  const fd = new FormData();
  fd.append('foto', new Blob([JPEG], { type: 'image/jpeg' }), 'a.jpg'); fd.append('client_uuid', uuid);
  assert.equal((await fetch(`${base}/os/${o.id}/fotos`, { method: 'POST', headers: { Authorization: `Bearer ${token(u1)}`, 'Idempotency-Key': uuid }, body: fd })).status, 201);
  return o;
};
const rascunhoPronto = (extra = {}) => ({
  ...completo(), finalizeUuid: randomUUID(), crewMemberIds: [tPart],
  removedMaterials: { wereRemoved: true, lines: [{ inventoryId: conector, name: 'Conector SC', unit: 'pecas', quantity: '3', condition: 'usado' }, { inventoryId: 'livre-1', name: 'Splitter antigo', unit: 'pecas', quantity: '1', condition: 'novo' }] },
  ...extra,
});

test('contrato: o corpo montado pelo web é aceito pelo servidor e TUDO fica gravado (o que o /fechar antigo perdia)', async () => {
  const o = await preparar();
  const detalhe = (await call(u1, 'GET', `/os/${o.id}`)).corpo;
  const order = F.toFieldOrder(detalhe);
  assert.equal(order.launches.length, 1); assert.equal(order.photos.length, 1);
  const cat = (await call(u1, 'GET', '/os/catalogos-fechamento')).corpo;
  const respostas = Object.fromEntries(cat.checklist.map((i) => [i.codigo, i.tipo === 'boolean' ? true : i.tipo === 'number' ? '4,5' : 'ok']));
  const draft = rascunhoPronto({ checklistAnswers: respostas, closingReasonId: 'route_launched' });
  assert.equal(F.canFinalize(draft, order, cat), true);
  const corpo = F.montarCorpoFinalizacao({ order, draft, catalogs: cat, dispositivo: 'teste' });
  const r = await call(u1, 'POST', `/os/${o.id}/finalizar`, corpo, { 'Idempotency-Key': corpo.client_uuid });
  assert.equal(r.status, 201, JSON.stringify(r.corpo));
  assert.equal(r.corpo.status, 'concluida');
  const depois = (await call(u1, 'GET', `/os/${o.id}`)).corpo;
  assert.equal(depois.status, 'concluida');
  assert.equal(depois.fechamento.motivo, 'Rota lançada com sucesso');
  assert.equal(depois.fechamento.descricao, 'Lançados 120 m entre PL-1 e PL-2');
  assert.equal(depois.fechamento.local.lat, -23.5);
  assert.deepEqual([depois.fechamento.local.origem, depois.fechamento.local.precisao_m], ['gps', 7]);
  assert.equal(depois.fechamento.versao_app, 'web');
  assert.equal(depois.fechamento.materiais_retirados, true);
  assert.equal(depois.fechamento.checklist.find((c) => c.codigo === 'fiberLaunchedMeters').resposta, 4.5); // vírgula do digitado virou número
  assert.equal(depois.materiais_retirados.length, 2);
  assert.deepEqual(depois.materiais_retirados.map((m) => m.condicao).sort(), ['novo', 'usado']);
  assert.deepEqual(depois.fechamento.participantes.map((p) => p.tecnico_id), [tPart]);
  assert.equal(depois.fotos.length, 1);
  const [[rasc]] = await pool.query('SELECT COUNT(*) n FROM os_rascunhos WHERE os_id = ?', [o.id]);
  assert.equal(rasc.n, 0);
  // reenvio (resposta perdida): mesma chave e mesmo corpo → mesma resposta, sem duplicar
  const de_novo = await call(u1, 'POST', `/os/${o.id}/finalizar`, corpo, { 'Idempotency-Key': corpo.client_uuid });
  assert.equal(de_novo.status, 201); assert.equal(de_novo.corpo.repetida, true);
  const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM os_fechamentos WHERE os_id = ?', [o.id]);
  assert.equal(n, 1);
});

test('contrato: o catálogo semeado do servidor é satisfeito pelo web (checklist obrigatório de verdade)', async () => {
  const o = await preparar();
  const order = F.toFieldOrder((await call(u1, 'GET', `/os/${o.id}`)).corpo);
  const cat = (await call(u1, 'GET', '/os/catalogos-fechamento')).corpo;
  const respostas = Object.fromEntries(cat.checklist.map((i) => [i.codigo, i.tipo === 'boolean' ? true : i.tipo === 'number' ? '4' : 'ok']));
  const draft = rascunhoPronto({ checklistAnswers: respostas, closingReasonId: cat.motivos[0].codigo });
  assert.equal(F.canFinalize(draft, order, cat), true);
  const faltando = { ...respostas }; delete faltando.spliceEnclosureSealed;
  assert.equal(F.canFinalize({ ...draft, checklistAnswers: faltando }, order, cat), false); // o web barra antes de o servidor barrar
  const corpo = F.montarCorpoFinalizacao({ order, draft, catalogs: cat });
  assert.equal((await call(u1, 'POST', `/os/${o.id}/finalizar`, corpo, { 'Idempotency-Key': corpo.client_uuid })).status, 201);
});

test('contrato: erro de regra do servidor chega com "detalhes" para o web mostrar', async () => {
  const o = await preparar();
  const order = F.toFieldOrder((await call(u1, 'GET', `/os/${o.id}`)).corpo);
  const cat = (await call(u1, 'GET', '/os/catalogos-fechamento')).corpo;
  const draft = rascunhoPronto({ closingReasonId: cat.motivos[0].codigo, checklistAnswers: Object.fromEntries(cat.checklist.map((i) => [i.codigo, i.tipo === 'boolean' ? true : i.tipo === 'number' ? '4' : 'ok'])) });
  const corpo = F.montarCorpoFinalizacao({ order, draft, catalogs: cat });
  corpo.descricao = 'curta';
  const r = await call(u1, 'POST', `/os/${o.id}/finalizar`, corpo, { 'Idempotency-Key': randomUUID() });
  assert.equal(r.status, 400);
  assert.ok(Array.isArray(r.corpo.detalhes) && r.corpo.detalhes.some((d) => d.campo === 'descricao'));
  assert.equal((await call(u1, 'GET', `/os/${o.id}`)).corpo.status !== 'concluida', true); // nada foi gravado
});
