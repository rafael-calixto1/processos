// Frota: nada é apagado. DELETE é recusado; PATCH /:id/status inativa e reativa, fica na auditoria,
// e registro inativo sai dos painéis, custos e do cálculo de manutenção preventiva.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool, prepararBanco } from './helpers/db.js';
import { up as migrarAuditoria } from '../scripts/migrate_frota_auditoria.js';
import { up as migrarInativacao, down as reverterInativacao, TABELAS } from '../scripts/migrate_frota_inativacao.js';

const { default: fleetRouter } = await import('../src/routes/fleet.js');

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let server, base, liberarBanco, token;

const api = async (method, p, body) => {
  const r = await fetch(base + p, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const um = async (sql, params = []) => (await pool.query(sql, params))[0][0];

before(async () => {
  liberarBanco = await prepararBanco();
  // Frota como em produção: tabelas antigas (sem status nos eventos) + auditoria + esta migração
  execFileSync(process.execPath, [path.join(raiz, 'scripts', 'migrate_fleet.js')], {
    cwd: raiz, env: { ...process.env, DB_NAME: process.env.DB_NAME }, stdio: 'pipe',
  });
  const c = await pool.getConnection();
  try {
    await migrarAuditoria(c);
    await migrarInativacao(c);
    await migrarInativacao(c); // idempotente
  } finally { c.release(); }

  const [u] = await pool.query("INSERT INTO users (email,password,name,role) VALUES ('frota@t.local','x','Gestor Frota','admin')");
  token = jwt.sign({ id: u.insertId, role: 'admin', email: 'frota@t.local' }, process.env.JWT_SECRET);

  const app = express(); app.use(express.json());
  app.use('/api/fleet', fleetRouter);
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://127.0.0.1:${server.address().port}/api/fleet`;
});
after(async () => {
  server?.close();
  // deixa o banco de teste como os outros testes esperam (sem as tabelas da Frota)
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of ['fleet_maintenance_history', 'fleet_maintenance_types', 'fleet_tire_changes', 'fleet_oil_changes',
    'fleet_fueling', 'fleet_cars', 'fleet_drivers', 'frota_auditoria']) await pool.query(`DROP TABLE IF EXISTS ${t}`);
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  await liberarBanco?.();
  await pool.end();
});

test('migração: todas as tabelas da Frota têm status ativo por padrão; --down tira só o que ela criou', async () => {
  for (const t of [...TABELAS, 'fleet_cars', 'fleet_maintenance_types']) {
    const col = await um(`SELECT COLUMN_DEFAULT AS d FROM information_schema.COLUMNS
                           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'status'`, [t]);
    assert.ok(col, t);
    assert.match(String(col.d), /active/, t);
  }
  const c = await pool.getConnection();
  try {
    await reverterInativacao(c);
    assert.equal(await um(`SELECT 1 AS x FROM information_schema.COLUMNS
                            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fleet_fueling' AND COLUMN_NAME = 'status'`), undefined);
    assert.ok(await um(`SELECT 1 AS x FROM information_schema.COLUMNS
                         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fleet_cars' AND COLUMN_NAME = 'status'`));
    await migrarInativacao(c);
  } finally { c.release(); }
});

test('DELETE em qualquer rota da Frota é recusado e nada some do banco', async () => {
  const car = await api('POST', '/cars', { make: 'Fiat', model: 'Strada', license_plate: 'DEL1A23' });
  await api('POST', '/fueling', { car_id: car.body.id, fuel_date: '2026-10-01', total_cost: 100 });
  for (const p of [`/cars/${car.body.id}`, '/drivers/1', '/fueling/entry/1', '/oil-changes/1', '/tire-changes/1',
    '/maintenance/types/1', '/maintenance/history/1', '/qualquer/coisa']) {
    const r = await api('DELETE', p);
    assert.equal(r.status, 405, p);
    assert.match(r.body.error, /inative/);
  }
  assert.ok(await um('SELECT id FROM fleet_cars WHERE id = ?', [car.body.id]));
  assert.equal(Number((await um('SELECT COUNT(*) AS n FROM fleet_fueling WHERE car_id = ?', [car.body.id])).n), 1);
});

test('inativar e reativar cada tipo de registro, com auditoria; status inválido e id inexistente', async () => {
  const drv = await api('POST', '/drivers', { name: 'João' });
  const car = await api('POST', '/cars', { make: 'VW', model: 'Gol', license_plate: 'INA1B23', driver_id: drv.body.id });
  const tipo = await api('POST', '/maintenance/types', { name: 'Revisão' });
  const fu = await api('POST', '/fueling', { car_id: car.body.id, fuel_date: '2026-10-02', total_cost: 50 });
  const oil = await api('POST', '/oil-changes', { car_id: car.body.id, oil_change_date: '2026-10-02' });
  const tire = await api('POST', '/tire-changes', { car_id: car.body.id, tire_change_date: '2026-10-02' });
  const mh = await api('POST', '/maintenance/history', { car_id: car.body.id, maintenance_type_id: tipo.body.id, maintenance_date: '2026-10-02' });

  const casos = [
    ['/drivers', drv.body.id, 'fleet_drivers', 'motorista'],
    ['/cars', car.body.id, 'fleet_cars', 'veiculo'],
    ['/maintenance/types', tipo.body.id, 'fleet_maintenance_types', 'tipo_manutencao'],
    ['/fueling', fu.body.id, 'fleet_fueling', 'abastecimento'],
    ['/oil-changes', oil.body.id, 'fleet_oil_changes', 'troca_oleo'],
    ['/tire-changes', tire.body.id, 'fleet_tire_changes', 'troca_pneu'],
    ['/maintenance/history', mh.body.id, 'fleet_maintenance_history', 'manutencao'],
  ];
  for (const [p, id, tabela, entidade] of casos) {
    const r = await api('PATCH', `${p}/${id}/status`, { status: 'inactive' });
    assert.equal(r.status, 200, p);
    assert.equal((await um(`SELECT status FROM ${tabela} WHERE id = ?`, [id])).status, 'inactive', p);
    const aud = await um('SELECT * FROM frota_auditoria WHERE entidade = ? AND entidade_id = ? ORDER BY id DESC LIMIT 1', [entidade, id]);
    assert.equal(aud.acao, 'inativado', p);
    assert.match(aud.resumo, /inativad[oa]/, p);
    assert.equal(aud.usuario_nome, 'Gestor Frota');
    assert.equal(JSON.parse(aud.dados_antes).status, 'active');

    assert.equal((await api('PATCH', `${p}/${id}/status`, { status: 'active' })).status, 200, p);
    assert.equal((await um(`SELECT status FROM ${tabela} WHERE id = ?`, [id])).status, 'active', p);
    assert.equal((await um('SELECT acao FROM frota_auditoria WHERE entidade = ? AND entidade_id = ? ORDER BY id DESC LIMIT 1', [entidade, id])).acao, 'reativado');
  }

  // repetir o mesmo status não gera linha nova na auditoria
  const antes = Number((await um('SELECT COUNT(*) AS n FROM frota_auditoria')).n);
  assert.equal((await api('PATCH', `/drivers/${drv.body.id}/status`, { status: 'active' })).status, 200);
  assert.equal(Number((await um('SELECT COUNT(*) AS n FROM frota_auditoria')).n), antes);

  assert.equal((await api('PATCH', `/drivers/${drv.body.id}/status`, { status: 'apagado' })).status, 400);
  assert.equal((await api('PATCH', `/drivers/${drv.body.id}/status`, {})).status, 400);
  assert.equal((await api('PATCH', '/drivers/999999/status', { status: 'inactive' })).status, 404);
});

test('listas filtram por ?status e registro inativo sai dos painéis e da manutenção preventiva', async () => {
  const car = await api('POST', '/cars', { make: 'Renault', model: 'Kangoo', license_plate: 'PNL1C23', current_kilometers: 1000 });
  const id = car.body.id;
  const tipo = await api('POST', '/maintenance/types', { name: 'Correia', recurrence_mode: 'km', recurrency: 5000 });
  const fuOk = await api('POST', '/fueling', { car_id: id, fuel_date: '2026-09-10', total_cost: 100, liters_quantity: 20, fuel_type: 'Etanol' });
  const fuX = await api('POST', '/fueling', { car_id: id, fuel_date: '2026-09-11', total_cost: 900, liters_quantity: 180, fuel_type: 'Etanol' });
  const mOk = await api('POST', '/maintenance/history', { car_id: id, maintenance_type_id: tipo.body.id, maintenance_date: '2026-09-01', maintenance_kilometers: 500, total_cost: 30 });
  const mX = await api('POST', '/maintenance/history', { car_id: id, maintenance_type_id: tipo.body.id, maintenance_date: '2026-09-20', maintenance_kilometers: 900, total_cost: 70 });
  const oX = await api('POST', '/oil-changes', { car_id: id, oil_change_date: '2026-09-12' });
  const tX = await api('POST', '/tire-changes', { car_id: id, tire_change_date: '2026-09-12' });
  for (const [p, rid] of [['/fueling', fuX.body.id], ['/maintenance/history', mX.body.id], ['/oil-changes', oX.body.id], ['/tire-changes', tX.body.id]]) {
    assert.equal((await api('PATCH', `${p}/${rid}/status`, { status: 'inactive' })).status, 200);
  }

  const q = 'startDate=2026-09-01&endDate=2026-09-30';
  const porCarro = (await api('GET', `/fueling/statistics?${q}`)).body.find(r => r.carro_id === id);
  assert.equal(Number(porCarro.custo_total), 100);
  const litros = (await api('GET', `/fueling/statistics/fuel-by-type?${q}`)).body.find(r => r.tipo_combustivel === 'Etanol');
  assert.equal(Number(litros.total_litros), 20);
  const custoTipo = (await api('GET', `/fueling/statistics/fuel-cost-by-type?${q}`)).body.find(r => r.tipo_combustivel === 'Etanol');
  assert.equal(Number(custoTipo.custo_total), 100);
  const manut = (await api('GET', `/fueling/statistics/maintenance-by-type?${q}`)).body.find(r => r.tipo_manutencao === 'Correia');
  assert.equal(Number(manut.total_manutencoes), 1);
  assert.equal(Number(manut.custo_total), 30);

  const vs = (await api('GET', `/vehicle-status?${q}`)).body.find(r => r.carro_id === id);
  assert.equal(Number(vs.custo_total_combustivel), 100);
  assert.equal(Number(vs.total_manutencoes), 1);
  assert.equal(Number(vs.custo_total_manutencao), 30);
  assert.equal(Number(vs.total_trocas_oleo), 0);
  assert.equal(Number(vs.total_trocas_pneu), 0);

  // a última manutenção válida é a de 500 km, não a inativada de 900 km
  const ov = (await api('GET', '/cars/maintenance-overview')).body.overview[id].find(t => t.id === tipo.body.id);
  assert.equal(Number(ov.last_km), 500);
  const det = (await api('GET', `/cars/${id}/detail`)).body;
  assert.equal(Number(det.maintenanceStatus.find(t => t.id === tipo.body.id).last_km), 500);
  assert.deepEqual(det.history.map(h => h.id), [mOk.body.id]);

  // listas: sem filtro trazem tudo (com status); com filtro só o pedido
  const todos = (await api('GET', '/fueling?limit=100')).body.fuelingHistory.filter(f => f.car_id === id);
  assert.deepEqual(todos.map(f => [f.id, f.status]).sort(), [[fuOk.body.id, 'active'], [fuX.body.id, 'inactive']].sort());
  const inativos = (await api('GET', '/fueling?limit=100&status=inactive')).body;
  assert.ok(inativos.fuelingHistory.every(f => f.status === 'inactive'));
  assert.ok(inativos.fuelingHistory.some(f => f.id === fuX.body.id));
  const ativosMh = (await api('GET', '/maintenance/history?limit=100&status=active&search=PNL1C23')).body;
  assert.deepEqual(ativosMh.maintenanceHistory.map(h => h.id), [mOk.body.id]);
  assert.equal(ativosMh.total, 1);
  assert.equal((await api('GET', '/oil-changes?status=inactive')).body.oilChangeHistory.length >= 1, true);
  assert.equal((await api('GET', '/tire-changes?status=active')).body.tireChangeHistory.every(t => t.status === 'active'), true);
  assert.equal((await api('GET', '/drivers?status=xx')).status, 200); // filtro inválido = sem filtro
});

test('histórico de manutenção filtra por veículo, tipo, período e placa, e soma o custo de tudo o que o filtro pegou', async () => {
  const a = (await api('POST', '/cars', { make: 'Fiat', model: 'Palio', license_plate: 'FLT1A11' })).body.id;
  const b = (await api('POST', '/cars', { make: 'Ford', model: 'Ka', license_plate: 'FLT2B22' })).body.id;
  const t1 = (await api('POST', '/maintenance/types', { name: 'Freio' })).body.id;
  const t2 = (await api('POST', '/maintenance/types', { name: 'Suspensão' })).body.id;
  const mk = async (car_id, maintenance_type_id, maintenance_date, total_cost) =>
    (await api('POST', '/maintenance/history', { car_id, maintenance_type_id, maintenance_date, total_cost })).body.id;
  const m1 = await mk(a, t1, '2026-07-01', 100);
  const m2 = await mk(a, t2, '2026-07-15', 200);
  const m3 = await mk(b, t1, '2026-07-31', 300);
  await mk(b, t2, '2026-08-01', 400);
  const ids = async (qs) => {
    const r = (await api('GET', `/maintenance/history?limit=100&search=FLT&${qs}`)).body;
    return { ids: r.maintenanceHistory.map(h => h.id).sort((x, y) => x - y), total: r.total, custo: r.custo_total };
  };

  assert.deepEqual(await ids(`car_id=${a}`), { ids: [m1, m2], total: 2, custo: 300 });
  assert.deepEqual((await ids(`maintenance_type_id=${t1}`)).ids, [m1, m3]);
  // período inclui os dois extremos
  assert.deepEqual((await ids('de=2026-07-15&ate=2026-07-31')).ids, [m2, m3]);
  assert.deepEqual((await ids(`de=2026-07-01&ate=2026-07-31&maintenance_type_id=${t1}&car_id=${b}`)).ids, [m3]);
  const placa = (await api('GET', '/maintenance/history?limit=100&search=FLT1A11')).body;
  assert.deepEqual(placa.maintenanceHistory.map(h => h.id).sort((x, y) => x - y), [m1, m2]);
  assert.equal((await api('GET', '/maintenance/history?search=FLT1A11&search=x')).status, 200); // ?search repetido não derruba
  // custo soma tudo o que o filtro pegou, não só a página
  const pag = (await api('GET', '/maintenance/history?limit=1&search=FLT')).body;
  assert.equal(pag.maintenanceHistory.length, 1);
  assert.equal(pag.total, 4);
  assert.equal(pag.custo_total, 1000);
  // valores inválidos são ignorados
  assert.equal((await ids('car_id=1 OR 1=1&de=01/07/2026&maintenance_type_id=x')).total, 4);
});
