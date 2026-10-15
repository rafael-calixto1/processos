// Auditoria da Frota sem banco: formato do que é guardado e filtros da tela.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_NAME = process.env.DB_NAME || 'processo_audit_test'; // o pool nunca é usado aqui
const { linha, montarFiltro, ENTIDADES, ACOES } = await import('../src/services/fleet/auditoria.js');
const { diferencas } = await import('../src/services/referral/auditoria.js');

test('linha: DATE do MySQL (meia-noite local) vira AAAA-MM-DD; data e hora vira ISO', () => {
  const r = linha({ id: 1, fuel_date: new Date(2026, 9, 14), created_at: new Date(2026, 9, 14, 8, 30, 5), total_cost: '250.00' });
  assert.equal(r.fuel_date, '2026-10-14');
  assert.equal(r.created_at, new Date(2026, 9, 14, 8, 30, 5).toISOString());
  assert.equal(r.total_cost, '250.00');
  assert.equal(linha(undefined), null);
});

test('linha + diferencas: edição que só reenviou os mesmos valores não acusa mudança', () => {
  const antes = linha({ id: 3, fuel_date: new Date(2026, 9, 14), total_cost: '250.00', observation: null });
  const depois = linha({ id: 3, fuel_date: new Date(2026, 9, 14), total_cost: '250.00', observation: null });
  assert.deepEqual(diferencas(antes, depois, ['fuel_date', 'total_cost', 'observation']).campos, []);
  const mudou = linha({ id: 3, fuel_date: new Date(2026, 9, 15), total_cost: '260.00', observation: null });
  const d = diferencas(antes, mudou, ['fuel_date', 'total_cost', 'observation']);
  assert.deepEqual(d.campos, ['fuel_date', 'total_cost']);
  assert.deepEqual(d.antes, { fuel_date: '2026-10-14', total_cost: 250 });
});

test('montarFiltro: ignora ação/entidade desconhecida e números inválidos', () => {
  const r = montarFiltro({ acao: 'excluido,hack', entidade: 'veiculo,x; DROP', usuario_id: '7', veiculo_id: '1 OR 1=1' });
  assert.equal(r.sql, 'WHERE acao IN (?) AND entidade IN (?) AND usuario_id = ?');
  assert.deepEqual(r.params, ['excluido', 'veiculo', 7]);
});

test('montarFiltro: período inclui o dia final inteiro e a busca procura também nos dados', () => {
  const r = montarFiltro({ de: '2026-10-01', ate: '2026-10-14', q: 'ABC1D23', veiculo_id: '5', ip: '10.100' });
  assert.match(r.sql, /veiculo_id = \?/);
  assert.match(r.sql, /created_at < DATE_ADD\(\?, INTERVAL 1 DAY\)/);
  assert.match(r.sql, /dados_antes LIKE \?/);
  assert.deepEqual(r.params.slice(0, 5), [5, '%10.100%', '%10.100%', '2026-10-01 00:00:00', '2026-10-14']);
  assert.equal(montarFiltro({ de: '01/10/2026' }).sql, '');
});

test('todas as entidades com tabela apontam para tabelas fleet_*', () => {
  for (const [k, v] of Object.entries(ENTIDADES)) if (v.tabela) assert.match(v.tabela, /^fleet_[a-z_]+$/, k);
  assert.deepEqual(Object.keys(ACOES), ['criado', 'editado', 'inativado', 'reativado', 'excluido', 'cupom_lido']);
});
