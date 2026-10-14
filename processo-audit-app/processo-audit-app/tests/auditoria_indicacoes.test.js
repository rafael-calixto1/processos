// Auditoria do Indique e Ganhe sem banco: diferença de campos, IP confiável e filtros da tela.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_NAME = process.env.DB_NAME || 'processo_audit_test'; // o pool nunca é usado aqui
const { diferencas, dadosRequisicao, montarFiltro, mascararCpf, recusaDaRota, ACOES } = await import('../src/services/referral/auditoria.js');

test('diferencas: ignora o que não mudou, mesmo com tipos diferentes vindos do banco e do formulário', () => {
  const antes = { valor_desconto: '10.00', status: 'pendente', nome_indicado: 'Ana', pagou_primeiro_boleto: 0, regra_ativacao: null };
  const depois = { valor_desconto: 10, status: 'cancelado', nome_indicado: 'Ana', pagou_primeiro_boleto: false, regra_ativacao: '' };
  const d = diferencas(antes, depois);
  assert.deepEqual(d.campos, ['status']);
  assert.deepEqual(d.antes, { status: 'pendente' });
  assert.deepEqual(d.depois, { status: 'cancelado' });
});

test('diferencas: compara só os campos pedidos e trata ausência como nulo', () => {
  const d = diferencas({ a: 1, b: 2 }, { a: 1, b: 3, c: 'x' }, ['b', 'c']);
  assert.deepEqual(d.campos, ['b', 'c']);
  assert.deepEqual(d.antes, { b: 2, c: null });
  assert.deepEqual(d.depois, { b: 3, c: 'x' });
});

test('dadosRequisicao: usa req.ip (trust proxy) e guarda a cadeia do X-Forwarded-For só para conferência', () => {
  const req = {
    ip: '::ffff:177.10.20.30',
    headers: { 'x-forwarded-for': '1.2.3.4, 177.10.20.30', 'user-agent': 'Mozilla/5.0' },
    socket: { remoteAddress: '::ffff:127.0.0.1' },
    userId: 7, userEmail: 'a@b.c',
  };
  assert.deepEqual(dadosRequisicao(req), {
    ip: '177.10.20.30',
    ip_cadeia: '1.2.3.4, 177.10.20.30 → 127.0.0.1',
    user_agent: 'Mozilla/5.0',
    usuario_id: 7,
    usuario_email: 'a@b.c',
  });
  assert.equal(dadosRequisicao(null).ip, null);
});

test('montarFiltro: só aceita ações e origens conhecidas e monta tudo parametrizado', () => {
  const { sql, params } = montarFiltro({
    acao: "excluida,editada,x' OR 1=1 --", origem: 'portal_publico,nada', usuario_id: '3', id_indicacao: '12abc',
    ip: '177.', de: '2026-10-01', ate: '2026-10-14', q: 'Ana',
  });
  assert.match(sql, /^WHERE acao IN \(\?,\?\) AND origem IN \(\?\) AND usuario_id = \? AND \(ip LIKE/);
  assert.ok(!sql.includes('id_indicacao'), 'número de indicação inválido deveria ser ignorado');
  assert.ok(!sql.includes('OR 1=1'));
  assert.deepEqual(params.slice(0, 4), ['excluida', 'editada', 'portal_publico', 3]);
  assert.ok(params.includes('2026-10-01 00:00:00') && params.includes('2026-10-14') && params.includes('%Ana%'));
});

test('montarFiltro: sem filtros não restringe nada e datas malformadas são ignoradas', () => {
  assert.deepEqual(montarFiltro({}), { sql: '', params: [] });
  assert.deepEqual(montarFiltro({ de: '01/10/2026', ate: 'ontem' }), { sql: '', params: [] });
});

test('mascararCpf: guarda só o final do CPF', () => {
  assert.equal(mascararCpf('123.456.789-01'), '***.***.789-01');
  assert.equal(mascararCpf('12345678901'), '***.***.789-01');
  assert.equal(mascararCpf(''), null);
  assert.equal(mascararCpf(undefined), null);
});

test('recusaDaRota: indicação recusada no portal, ação recusada no painel com o lead; leituras e webhooks não', () => {
  assert.deepEqual(recusaDaRota('POST', '/public/register-indication', 400), { acao: 'recusada_portal', origem: 'portal_publico' });
  assert.equal(recusaDaRota('POST', '/public/register-indication', 201), null);
  assert.deepEqual(recusaDaRota('PUT', '/indicacao/42', 409), { acao: 'acao_recusada', origem: 'painel', idIndicacao: 42 });
  assert.deepEqual(recusaDaRota('PATCH', '/leads/7/primeiro-boleto', 404), { acao: 'acao_recusada', origem: 'painel', idIndicacao: 7 });
  assert.deepEqual(recusaDaRota('POST', '/leads/send-to-crm', 400), { acao: 'acao_recusada', origem: 'painel', idIndicacao: null });
  assert.equal(recusaDaRota('GET', '/leads/7/historico', 404), null);
  assert.equal(recusaDaRota('POST', '/webhook/ativacao', 401), null); // o webhook já registra as recusas dele
  assert.equal(recusaDaRota('POST', '/public/referrer-info', 404), null);
  for (const a of ['visualizada', 'recusada_portal', 'acao_recusada']) assert.ok(ACOES[a], a);
});
