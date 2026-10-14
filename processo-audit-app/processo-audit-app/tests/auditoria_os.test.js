// Auditoria das OS e filtros da lista, sem banco: que ação cada rota vira, origem web/app, o que é guardado e os filtros.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_NAME = process.env.DB_NAME || 'processo_audit_test'; // o pool nunca é usado aqui
const { acaoDaRota, origemDe, corpoParaGuardar, montarFiltro, montarRegistro, ACOES, DEDUP_MIN } = await import('../src/services/os/auditoria.js');
const { filtrosDaLista } = await import('../src/routes/os.js');

test('acaoDaRota: cada escrita das OS vira uma ação com o id da OS', () => {
  assert.deepEqual(acaoDaRota('os', 'POST', '/'), { acao: 'criada', osId: null, itemId: null });
  assert.deepEqual(acaoDaRota('os', 'PUT', '/12'), { acao: 'editada', osId: 12, itemId: null });
  assert.deepEqual(acaoDaRota('os', 'DELETE', '/12/fotos/7'), { acao: 'foto_apagada', osId: 12, itemId: 7 });
  assert.deepEqual(acaoDaRota('os', 'DELETE', '/12/servicos/3'), { acao: 'servico_removido', osId: 12, itemId: 3 });
  for (const [m, p, a] of [['POST', '/5/lancamentos', 'lancamento'], ['POST', '/5/materiais', 'material_baixado'], ['POST', '/5/servicos', 'servico_adicionado'],
    ['POST', '/5/fotos', 'foto_enviada'], ['POST', '/5/finalizar', 'finalizada'], ['POST', '/5/iniciar', 'iniciada'], ['POST', '/5/fechar', 'concluida'],
    ['PUT', '/5/rascunho', 'rascunho_salvo'], ['POST', '/5/cancelar', 'cancelada'], ['POST', '/5/estornos', 'estorno']]) {
    assert.equal(acaoDaRota('os', m, p).acao, a, `${m} ${p}`);
    assert.equal(acaoDaRota('os', m, p).osId, 5);
  }
  assert.ok(Object.keys(ACOES).length >= 20);
});

test('acaoDaRota: abrir a OS registra; listas, fotos e a própria auditoria não', () => {
  assert.equal(acaoDaRota('os', 'GET', '/9').acao, 'visualizada');
  assert.equal(acaoDaRota('os', 'GET', '/9/').acao, 'visualizada'); // barra final é tolerada
  assert.equal(acaoDaRota('os', 'GET', '/'), null);
  assert.equal(acaoDaRota('os', 'GET', '/auditoria'), null);
  assert.equal(acaoDaRota('os', 'GET', '/9/fotos/2'), null);
  assert.equal(acaoDaRota('os', 'GET', '/9/rascunho'), null);
});

test('acaoDaRota: escrita sem nome ainda também fica (ação "outra"), catálogos e app têm as suas', () => {
  assert.deepEqual(acaoDaRota('os', 'PATCH', '/4/algo-novo'), { acao: 'outra', osId: 4, itemId: null });
  assert.equal(acaoDaRota('catalogos', 'PUT', '/motivos/3').acao, 'motivo_editado');
  assert.equal(acaoDaRota('catalogos', 'POST', '/checklist').acao, 'checklist_criado');
  assert.equal(acaoDaRota('catalogos', 'GET', '/motivos'), null);
  assert.equal(acaoDaRota('mobile', 'GET', '/bootstrap').acao, 'app_sincronizado');
  assert.ok(DEDUP_MIN.visualizada > 0 && DEDUP_MIN.app_sincronizado > 0);
});

test('origemDe: cabeçalho do app vence; sem ele decide pelo User-Agent', () => {
  assert.equal(origemDe({ headers: { 'x-cliente': 'cw-campo', 'user-agent': 'Mozilla/5.0' } }), 'app');
  assert.equal(origemDe({ headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/130' } }), 'web');
  assert.equal(origemDe({ headers: { 'user-agent': 'okhttp/4.12.0' } }), 'app');
  assert.equal(origemDe({ headers: { 'user-agent': 'CWCampo/1 CFNetwork/1490 Darwin/23.0.0' } }), 'app');
  assert.equal(origemDe({ headers: { 'user-agent': 'curl/8.5' } }), 'outro');
  assert.equal(origemDe({}), 'outro');
});

test('corpoParaGuardar: tira o caminho do mapa ponto a ponto, o rascunho inteiro e senhas', () => {
  const caminho = Array.from({ length: 500 }, (_, i) => [i, i]);
  const r = corpoParaGuardar('lancamento', { descricao: 'Lançar drop', rota: { pontos: [{ lat: 1, lng: 2 }], metros: 80, caminho }, materiais: [] });
  assert.deepEqual(r.rota, { pontos: [{ lat: 1, lng: 2 }], metros: 80, caminho_pontos: 500 });
  assert.equal(corpoParaGuardar('rascunho_salvo', { rascunho: { a: 1 } }), null);
  assert.equal(corpoParaGuardar('criada', { senha: 'x', cliente: 'A' }).senha, '***');
  assert.equal(corpoParaGuardar('criada', {}), null);
  assert.equal(corpoParaGuardar('criada', undefined), null);
});

test('montarRegistro: resumos das ações que não consultam o banco', async () => {
  const os = { id: 5, numero: 31, cliente: 'Maria', status: 'aberta' };
  assert.equal((await montarRegistro({ acao: 'visualizada', antes: { os } })).resumo, 'Abriu a OS #31 — Maria');
  const c = await montarRegistro({ acao: 'cancelada', antes: { os } });
  assert.equal(c.resumo, 'OS #31 — Maria cancelada');
  assert.deepEqual(c.antes, { status: 'aberta' });
  const s = await montarRegistro({ acao: 'servico_removido', antes: { os, item: { descricao: 'Fusão', quantidade: '2.00' } } });
  assert.equal(s.resumo, 'Serviço removido da OS #31 — Maria: Fusão × 2');
  const e = await montarRegistro({ acao: 'estorno', antes: { os, item: { item: 'Cabo drop', unidade: 'metros', lote: 'L1' } }, body: { motivo: 'Lançado errado' }, resposta: { quantidade: 10 } });
  assert.equal(e.resumo, 'Estorno na OS #31 — Maria: 10 m Cabo drop (lote L1) — motivo: Lançado errado');
  const i = await montarRegistro({ acao: 'iniciada', antes: { os }, resposta: { status: 'em_andamento', iniciado_em: '2026-10-14T12:00:00.000Z' } });
  assert.deepEqual(i.depois, { status: 'em_andamento', iniciado_em: '2026-10-14T12:00:00.000Z' });
});

test('montarFiltro da auditoria: só valores conhecidos entram, período inclui o dia final', () => {
  const f = montarFiltro({ acao: 'editada,inexistente', origem: 'app,xpto', resultado: 'erro', usuario_id: '7', os: '#31', de: '2026-10-01', ate: '2026-10-14', ip: '10.0', q: 'drop' });
  assert.match(f.sql, /acao IN \(\?\)/);
  assert.match(f.sql, /origem IN \(\?\)/);
  assert.match(f.sql, /resultado = \?/);
  assert.match(f.sql, /os_numero = \?/);
  assert.match(f.sql, /created_at < DATE_ADD\(\?, INTERVAL 1 DAY\)/);
  assert.deepEqual(f.params.slice(0, 6), ['editada', 'app', 'erro', 7, 31, '%10.0%']);
  assert.deepEqual(montarFiltro({ usuario_id: '1 OR 1=1', de: 'ontem', resultado: 'talvez' }), { sql: '', params: [] });
});

test('filtrosDaLista: ordenação só por coluna conhecida, nulos no fim, padrão por id', () => {
  assert.equal(filtrosDaLista({}).ordem, 'o.id DESC');
  assert.equal(filtrosDaLista({ ordenar: 'prazo', direcao: 'asc' }).ordem, 'o.prazo IS NULL, o.prazo ASC, o.id DESC');
  assert.equal(filtrosDaLista({ ordenar: 'concluida_em; DROP TABLE x' }).ordem, 'o.id DESC');
  assert.match(filtrosDaLista({ ordenar: 'prioridade' }).ordem, /^FIELD\(o\.prioridade/);
});

test('filtrosDaLista: busca por número, status múltiplo, períodos e atrasadas', () => {
  const f = filtrosDaLista({ q: '#31', status: 'aberta,em_andamento,lixo', prioridade: 'alta', criado_de: '2026-10-01', prazo_ate: '2026-10-31', executada_de: '2026-10-02', executada_ate: '2026-10-03', atrasadas: '1' });
  const sql = f.where.join(' AND ');
  assert.match(sql, /o\.numero = \?/);
  assert.match(sql, /o\.status IN \(\?,\?\)/);
  assert.match(sql, /o\.prazo <= \?/);
  assert.match(sql, /o\.concluida_em < DATE_ADD/);
  assert.match(sql, /o\.prazo < CURDATE\(\)/);
  assert.ok(f.params.includes(31));
  assert.ok(f.params.includes('2026-10-01 00:00:00'));
  assert.ok(f.params.includes('2026-10-31'));
  assert.deepEqual(filtrosDaLista({ criado_de: 'ontem', status: 'xpto' }).where, []);
});
