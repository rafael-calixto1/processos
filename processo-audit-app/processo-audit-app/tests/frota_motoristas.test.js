// Frota > Motoristas: a lista mostra os veículos ativos de cada motorista e o detalhe
// (botão Visualizar) traz o motorista com os veículos atribuídos a ele.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool, prepararBanco } from './helpers/db.js';
import { up as migrarAuditoria } from '../scripts/migrate_frota_auditoria.js';
import { up as migrarInativacao } from '../scripts/migrate_frota_inativacao.js';

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

before(async () => {
  liberarBanco = await prepararBanco();
  execFileSync(process.execPath, [path.join(raiz, 'scripts', 'migrate_fleet.js')], {
    cwd: raiz, env: { ...process.env, DB_NAME: process.env.DB_NAME }, stdio: 'pipe',
  });
  const c = await pool.getConnection();
  try {
    await migrarAuditoria(c);
    await migrarInativacao(c);
  } finally { c.release(); }

  const [u] = await pool.query("INSERT INTO users (email,password,name,role) VALUES ('motoristas@t.local','x','Gestor Frota','admin')");
  token = jwt.sign({ id: u.insertId, role: 'admin', email: 'motoristas@t.local' }, process.env.JWT_SECRET);

  const app = express(); app.use(express.json());
  app.use('/api/fleet', fleetRouter);
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://127.0.0.1:${server.address().port}/api/fleet`;
});
after(async () => {
  server?.close();
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of ['fleet_maintenance_history', 'fleet_maintenance_types', 'fleet_tire_changes', 'fleet_oil_changes',
    'fleet_fueling', 'fleet_cars', 'fleet_drivers', 'frota_auditoria']) await pool.query(`DROP TABLE IF EXISTS ${t}`);
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  await liberarBanco?.();
  await pool.end();
});

test('lista de motoristas traz os veículos ativos de cada um; detalhe traz motorista e veículos', async () => {
  const ana   = (await api('POST', '/drivers', { name: 'ANA', license_number: '123' })).body.id;
  const bruno = (await api('POST', '/drivers', { name: 'BRUNO' })).body.id;

  const uno    = (await api('POST', '/cars', { make: 'FIAT', model: 'UNO', license_plate: 'AAA1A11', current_kilometers: 1000, driver_id: ana })).body.id;
  const palio  = (await api('POST', '/cars', { make: 'FIAT', model: 'PALIO', license_plate: 'BBB2B22', driver_id: ana })).body.id;
  const strada = (await api('POST', '/cars', { make: 'FIAT', model: 'STRADA', license_plate: 'CCC3C33', driver_id: ana })).body.id;
  await api('POST', '/cars', { make: 'VW', model: 'GOL', license_plate: 'DDD4D44' }); // sem motorista
  assert.equal((await api('PATCH', `/cars/${strada}/status`, { status: 'inactive' })).status, 200);

  const lista = await api('GET', '/drivers?status=active');
  assert.equal(lista.status, 200);
  const porNome = Object.fromEntries(lista.body.drivers.map(d => [d.name, d]));
  assert.deepEqual(porNome.ANA.vehicles.map(v => v.id), [palio, uno]); // ordenado por marca/modelo; inativo fora
  assert.deepEqual(porNome.ANA.vehicles[1], { id: uno, make: 'FIAT', model: 'UNO', license_plate: 'AAA1A11' });
  assert.deepEqual(porNome.BRUNO.vehicles, []);

  const det = await api('GET', `/drivers/${ana}/detail`);
  assert.equal(det.status, 200);
  assert.equal(det.body.driver.name, 'ANA');
  assert.equal(det.body.driver.license_number, '123');
  assert.deepEqual(det.body.cars.map(c => c.license_plate), ['BBB2B22', 'AAA1A11']);
  assert.equal(Number(det.body.cars[1].current_kilometers), 1000);

  assert.deepEqual((await api('GET', `/drivers/${bruno}/detail`)).body.cars, []);
  assert.equal((await api('GET', '/drivers/999999/detail')).status, 404);
});

test('lista vazia de motoristas não quebra a busca de veículos', async () => {
  const r = await api('GET', '/drivers?page=99');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.drivers, []);
});
