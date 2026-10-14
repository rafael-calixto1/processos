// Filtro por período das telas Indique e Ganhe e Leads (frontend/src/components/periodo.js).
// Rodar com TZ=America/Sao_Paulo para o caso da virada de dia em UTC (o npm test herda o fuso da máquina).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noPeriodo, diaLocal, periodoDoAtalho } from '../frontend/src/components/periodo.js';

test('noPeriodo: sem datas não filtra; limites são inclusivos; registro sem data sai quando há período', () => {
  assert.equal(noPeriodo('2026-10-14T12:00:00', '', ''), true);
  assert.equal(noPeriodo(null, '', ''), true);
  assert.equal(noPeriodo('2026-10-01T00:00:00', '2026-10-01', '2026-10-31'), true);
  assert.equal(noPeriodo('2026-10-31T23:59:59', '2026-10-01', '2026-10-31'), true);
  assert.equal(noPeriodo('2026-11-01T00:00:00', '2026-10-01', '2026-10-31'), false);
  assert.equal(noPeriodo('2026-09-30T23:59:59', '2026-10-01', ''), false);
  assert.equal(noPeriodo('2026-09-30T23:59:59', '', '2026-10-01'), true);
  assert.equal(noPeriodo(null, '2026-10-01', ''), false);
});

test('diaLocal: TIMESTAMP em UTC vira o dia de quem usa a tela', { skip: process.env.TZ !== 'America/Sao_Paulo' && 'precisa de TZ=America/Sao_Paulo' }, () => {
  // 01:30 UTC do dia 15 = 22:30 do dia 14 em São Paulo
  assert.equal(diaLocal('2026-10-15T01:30:00.000Z'), '2026-10-14');
  assert.equal(noPeriodo('2026-10-15T01:30:00.000Z', '2026-10-14', '2026-10-14'), true);
  assert.equal(diaLocal('2026-10-14'), '2026-10-14');
});

test('periodoDoAtalho: hoje, 7/30 dias, este mês e mês passado (inclusive virada de ano)', () => {
  const hoje = new Date(2026, 0, 10); // 10/01/2026
  assert.deepEqual(periodoDoAtalho('hoje', hoje), { de: '2026-01-10', ate: '2026-01-10' });
  assert.deepEqual(periodoDoAtalho('7d', hoje), { de: '2026-01-04', ate: '2026-01-10' });
  assert.deepEqual(periodoDoAtalho('30d', hoje), { de: '2025-12-12', ate: '2026-01-10' });
  assert.deepEqual(periodoDoAtalho('mes', hoje), { de: '2026-01-01', ate: '2026-01-10' });
  assert.deepEqual(periodoDoAtalho('mesPassado', hoje), { de: '2025-12-01', ate: '2025-12-31' });
  assert.deepEqual(periodoDoAtalho('mesPassado', new Date(2026, 2, 31)), { de: '2026-02-01', ate: '2026-02-28' });
});
