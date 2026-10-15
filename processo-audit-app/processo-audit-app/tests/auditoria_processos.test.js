// Auditoria dos Processos sem banco: que ação cada rota vira, o que mudou nos passos, resumos que não consultam o banco
// e filtros da tela.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_NAME = process.env.DB_NAME || 'processo_audit_test'; // o pool nunca é usado aqui
const { acaoDaRota, mudancasPassos, montarRegistro, montarFiltro, ACOES, ABAS } = await import('../src/services/processos/auditoria.js');

test('acaoDaRota: cada escrita e abertura de /processos e das execuções vira uma ação, com o id certo', () => {
  assert.deepEqual(acaoDaRota('GET', '/processes/12'), { acao: 'processo_aberto', processoId: 12, execucaoId: null, passoExecucaoId: null });
  assert.deepEqual(acaoDaRota('PUT', '/process/12'), { acao: 'processo_editado', processoId: 12, execucaoId: null, passoExecucaoId: null });
  for (const [m, p, a] of [['POST', '/processes', 'processo_criado'], ['POST', '/process', 'processo_criado'], ['DELETE', '/processes/3', 'processo_inativado'],
    ['POST', '/processes/upload-step-photo', 'foto_instrucao'], ['POST', '/processes/auditoria/pdf', 'pdf_exportado'],
    ['POST', '/executions/start/3', 'execucao_iniciada'], ['GET', '/executions/8', 'execucao_aberta'],
    ['PUT', '/executions/8/complete', 'execucao_finalizada'], ['PUT', '/execution/8/cancel', 'execucao_cancelada']]) {
    assert.equal(acaoDaRota(m, p).acao, a, `${m} ${p}`);
  }
  assert.equal(acaoDaRota('POST', '/executions/start/3').processoId, 3);
  assert.equal(acaoDaRota('PUT', '/executions/8/complete').execucaoId, 8);
  assert.deepEqual(acaoDaRota('PUT', '/step-executions/40/complete'), { acao: 'passo_concluido', processoId: null, execucaoId: null, passoExecucaoId: 40 });
});

test('acaoDaRota: listas e a própria auditoria não registram; fora de /processos não é com ela; escrita sem nome vira "outra"', () => {
  for (const p of ['/processes', '/process', '/processes/12/audit', '/processes/auditoria', '/executions/user/me']) {
    assert.equal(acaoDaRota('GET', p), null, p);
  }
  for (const [m, p] of [['POST', '/os'], ['PUT', '/departments/2'], ['POST', '/labels'], ['GET', '/processes-visual'], ['POST', '/visual-processes']]) {
    assert.equal(acaoDaRota(m, p), null, `${m} ${p}`);
  }
  assert.equal(acaoDaRota('PATCH', '/processes/3/algo-novo').acao, 'outra');
});

test('toda ação nomeada pertence a um grupo (filtro da tela)', () => {
  const nosGrupos = new Set(Object.values(ABAS).flatMap((a) => a.acoes));
  for (const a of Object.keys(ACOES)) if (a !== 'outra') assert.ok(nosGrupos.has(a), a);
});

test('mudancasPassos: adicionado, removido, editado e trocado de lugar; inserir no meio não conta como mover', () => {
  const p = (title, extra = {}) => ({ title, section: null, description: '', documentation_markdown: '', photo_url: null, ...extra });
  const antes = [p('Ligar ONU'), p('Testar sinal'), p('Fechar caixa')];

  const meio = mudancasPassos(antes, [p('Ligar ONU'), p('Conferir cabo'), p('Testar sinal'), p('Fechar caixa')]);
  assert.deepEqual(meio, { adicionados: [{ posicao: 2, titulo: 'Conferir cabo' }], removidos: [], editados: [], movidos: [] });

  const r = mudancasPassos(antes, [p('Testar sinal', { description: 'mínimo -25 dBm' }), p('ligar onu')]);
  assert.deepEqual(r.removidos, [{ posicao: 3, titulo: 'Fechar caixa' }]);
  assert.deepEqual(r.editados, [{ posicao: 1, titulo: 'Testar sinal', campos: ['descrição'] }]);
  assert.deepEqual(r.movidos.map((m) => m.titulo).sort(), ['Testar sinal', 'ligar onu']);
  assert.deepEqual(r.adicionados, []);

  assert.deepEqual(mudancasPassos(antes, antes), { adicionados: [], removidos: [], editados: [], movidos: [] });
});

test('montarRegistro: inativação, foto e PDF da lista montam o resumo sem consultar o banco', async () => {
  const inat = await montarRegistro({ acao: 'processo_inativado', processoId: 3, antes: { processo: { id: 3, title: 'Instalação FTTH', status: 'active', department_id: 2 } } });
  assert.equal(inat.resumo, 'Processo inativado (arquivado): "Instalação FTTH"');
  assert.deepEqual([inat.antes, inat.depois, inat.campos], [{ status: 'active' }, { status: 'archived' }, ['status']]);
  assert.equal(inat.processo.department_id, 2);

  const foto = await montarRegistro({ acao: 'foto_instrucao', resposta: { photo_url: '/uploads/process_steps/template-1.jpg' }, arquivo: { originalname: 'caixa.jpg', size: 2.5 * 1024 * 1024 } });
  assert.equal(foto.resumo, 'Foto de instrução enviada: caixa.jpg (2,5 MB)');

  const pdf = await montarRegistro({ acao: 'pdf_exportado', body: { quantidade: 7, filtros: [['Busca', '"onu"'], ['Status', 'active']] } });
  assert.equal(pdf.resumo, 'PDF da lista de processos exportado (7 processo(s)) — filtros: Busca: "onu", Status: active');
});

test('montarFiltro: grupo vira a lista de ações; só valores conhecidos entram; gerente fica nos departamentos dele', () => {
  const f = montarFiltro({ aba: 'execucoes', acao: 'processo_aberto,xpto', resultado: 'erro', processo_id: '4', departamento_id: '2', de: '2026-10-01', ate: '2026-10-15' });
  assert.match(f.sql, /acao IN \(\?,\?,\?,\?,\?\)/);
  assert.ok(f.params.includes('passo_concluido') && f.params.includes('processo_aberto') && !f.params.includes('xpto'));
  assert.match(f.sql, /processo_id = \?/);
  assert.match(f.sql, /created_at < DATE_ADD\(\?, INTERVAL 1 DAY\)/);
  assert.deepEqual(montarFiltro({ processo_id: '1 OR 1=1', aba: 'nada', resultado: 'talvez' }), { sql: '', params: [] });

  const gerente = montarFiltro({}, { departamentos: [2, 5], usuarioId: 9 });
  assert.equal(gerente.sql, 'WHERE (departamento_id IN (?,?) OR (departamento_id IS NULL AND usuario_id <=> ?))');
  assert.deepEqual(gerente.params, [2, 5, 9]);
  assert.equal(montarFiltro({}, { departamentos: [], usuarioId: 9 }).sql, 'WHERE ((departamento_id IS NULL AND usuario_id <=> ?))');
});
