// Auditoria do Estoque sem banco: que ação cada rota das abas vira, resumos que não consultam o banco e filtros da tela.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_NAME = process.env.DB_NAME || 'processo_audit_test'; // o pool nunca é usado aqui
const { acaoDaRota, montarRegistro, montarFiltro, ACOES, ABAS } = await import('../src/services/estoque/auditoria.js');

test('acaoDaRota: cada escrita das abas do estoque vira uma ação, com o id e a tabela do "antes"', () => {
  assert.deepEqual(acaoDaRota('estoque', 'POST', '/itens'), { acao: 'item_criado', entidade: 'item', id: null, tabela: null });
  assert.deepEqual(acaoDaRota('estoque', 'PUT', '/itens/7'), { acao: 'item_editado', entidade: 'item', id: 7, tabela: 'estoque_itens' });
  for (const [m, p, a] of [['POST', '/compras', 'entrada'], ['PUT', '/lotes/3', 'lote_renomeado'], ['POST', '/lotes/3/descartar', 'lote_descartado'],
    ['DELETE', '/lotes/3', 'lote_excluido'], ['POST', '/retiradas', 'retirada'], ['POST', '/devolucoes', 'devolucao'],
    ['POST', '/devolucoes/9/aprovar', 'devolucao_aprovada'], ['POST', '/devolucoes/9/negar', 'devolucao_negada']]) {
    assert.equal(acaoDaRota('estoque', m, p).acao, a, `${m} ${p}`);
  }
  assert.equal(acaoDaRota('tecnicos', 'POST', '/').acao, 'tecnico_criado');
  assert.deepEqual(acaoDaRota('fornecedores', 'PUT', '/2'), { acao: 'fornecedor_editado', entidade: 'fornecedor', id: 2, tabela: 'fornecedores' });
  assert.equal(acaoDaRota('equipamentos', 'POST', '/4/saida').acao, 'equipamento_emprestado');
  assert.equal(acaoDaRota('equipamentos', 'POST', '/4/devolucao').acao, 'equipamento_devolvido');
});

test('acaoDaRota: consultas não registram; escrita sem nome ainda fica como "outra"', () => {
  for (const p of ['/itens', '/itens/7', '/patrimonio', '/posse', '/posse/minha', '/lotes/ABC', '/devolucoes', '/auditoria']) {
    assert.equal(acaoDaRota('estoque', 'GET', p), null, p);
  }
  assert.equal(acaoDaRota('equipamentos', 'GET', '/4/emprestimos'), null);
  assert.equal(acaoDaRota('estoque', 'PATCH', '/algo-novo').acao, 'outra');
});

test('toda ação nomeada pertence a uma aba (filtro da tela)', () => {
  const nasAbas = new Set(Object.values(ABAS).flatMap((a) => a.acoes));
  for (const a of Object.keys(ACOES)) if (a !== 'outra') assert.ok(nasAbas.has(a), a);
});

test('montarRegistro: lote, devolução e equipamento usam o que foi lido antes', async () => {
  const lote = { id: 3, codigo: 'LOTE-BOB-0001', item_id: 5, item_nome: 'Cabo drop', unidade: 'metros', saldo_inicial: '1000.00', saldo_atual: '800.00' };
  const ren = await montarRegistro({ acao: 'lote_renomeado', entidade: 'lote', id: 3, antes: lote, body: { codigo: 'bob-a' }, resposta: { id: 3, codigo: 'BOB-A' } });
  assert.equal(ren.resumo, 'Lote renomeado: LOTE-BOB-0001 → BOB-A (Cabo drop)');
  assert.deepEqual([ren.itemId, ren.lote, ren.campos], [5, 'BOB-A', ['codigo']]);

  const desc = await montarRegistro({ acao: 'lote_descartado', entidade: 'lote', id: 3, antes: lote, body: { motivo: 'Avaria' }, resposta: { descartado: 200, saldo_atual: 600 } });
  assert.equal(desc.resumo, 'Descarte no lote LOTE-BOB-0001 (Cabo drop): 200 m — motivo: Avaria');

  const exc = await montarRegistro({ acao: 'lote_excluido', entidade: 'lote', id: 3, antes: lote });
  assert.equal(exc.resumo, 'Lote excluído: LOTE-BOB-0001 (Cabo drop, 1.000 m)');

  const dev = { id: 9, status: 'pendente', condicao: 'usado', quantidade: '3.00', unidade: 'pecas', item_nome: 'Conector', lote_codigo: 'L1', tecnico_id: 2, tecnico_nome: 'Ana', item_id: 8 };
  const neg = await montarRegistro({ acao: 'devolucao_negada', entidade: 'devolucao', id: 9, antes: dev, body: { motivo: 'Não chegou' } });
  assert.equal(neg.resumo, 'Devolução negada: 3 un Conector (lote L1) de Ana — motivo: Não chegou');
  assert.deepEqual([neg.tecnicoId, neg.itemId], [2, 8]);

  const eq = { id: 4, nome: 'Máquina de fusão', patrimonio: 'PAT-12', estado: 'bom', tecnico_id: 2, tecnico_nome: 'Ana', saida_em: '2026-10-01T10:00:00.000Z' };
  const volta = await montarRegistro({ acao: 'equipamento_devolvido', entidade: 'equipamento', id: 4, antes: eq, body: { condicao_devolucao: 'defeito' } });
  assert.equal(volta.resumo, 'Equipamento devolvido: Máquina de fusão (patrimônio PAT-12) por Ana, voltou defeito');
  assert.deepEqual(volta.campos, ['estado']);
});

test('montarFiltro: aba vira a lista de ações; só valores conhecidos entram', () => {
  const f = montarFiltro({ aba: 'devolucao', acao: 'retirada,xpto', origem: 'app', resultado: 'erro', tecnico_id: '2', lote: 'bob', de: '2026-10-01', ate: '2026-10-14' });
  assert.match(f.sql, /acao IN \(\?,\?,\?,\?,\?\)/);
  assert.ok(f.params.includes('devolucao_aprovada') && f.params.includes('retirada'));
  assert.match(f.sql, /lote_codigo LIKE \?/);
  assert.ok(f.params.includes('%BOB%'));
  assert.match(f.sql, /created_at < DATE_ADD\(\?, INTERVAL 1 DAY\)/);
  assert.deepEqual(montarFiltro({ item_id: '1 OR 1=1', aba: 'nada', resultado: 'talvez' }), { sql: '', params: [] });
});
