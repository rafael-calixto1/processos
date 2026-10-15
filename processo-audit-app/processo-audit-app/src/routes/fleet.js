import express from 'express';
import pool from '../config/database.js';
import { parseFuelReceipt } from '../services/receiptService.js';
import { verifyToken, checkRole } from '../middlewares/auth.js';
import {
  auditarCriacao, auditarEdicao, auditarStatus, auditarCupom, buscar, listarAuditoria, historicoDoRegistro,
} from '../services/fleet/auditoria.js';

const router = express.Router();

// Toda a Frota exige login: é o que permite a auditoria saber quem fez cada ação
router.use(verifyToken);

// Na Frota nada é apagado (apagar um veículo levava junto todo o histórico dele): o registro é inativado
router.use((req, res, next) => (req.method === 'DELETE'
  ? res.status(405).json({ error: 'Na Frota não é permitido excluir: inative o registro.' })
  : next()));

const STATUS = ['active', 'inactive'];

/** PATCH /<recurso>/:id/status { status: 'active' | 'inactive' } — inativa ou reativa. */
const rotaStatus = (entidade, tabela) => async (req, res) => {
  const { status } = req.body ?? {};
  if (!STATUS.includes(status)) return res.status(400).json({ error: "status deve ser 'active' ou 'inactive'" });
  try {
    const antes = await buscar(entidade, req.params.id);
    if (!antes) return res.status(404).json({ error: 'Registro não encontrado' });
    await pool.execute(`UPDATE ${tabela} SET status = ? WHERE id = ?`, [status, req.params.id]);
    await auditarStatus(req, entidade, antes, req.params.id);
    res.json({ message: status === 'inactive' ? 'Registro inativado' : 'Registro reativado', status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** ?status=active|inactive das listas (sem o parâmetro: todos). */
const filtroStatus = (req, coluna = 'status') =>
  (STATUS.includes(req.query.status) ? { sql: `WHERE ${coluna} = ?`, params: [req.query.status] } : { sql: '', params: [] });

/* ──────────────────────────────────────────
   AUDITORIA (só admin e gerente)
   ────────────────────────────────────────── */

router.get('/auditoria', checkRole(['admin', 'manager']), async (req, res) => {
  try {
    res.json(await listarAuditoria(req.query));
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ error: 'Auditoria ainda não instalada: rode scripts/migrate_frota_auditoria.js' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Botão "Histórico" de um registro: dados para todos; a linha do tempo da auditoria só para admin e gerente
router.get('/historico/:entidade/:id', async (req, res) => {
  try {
    const r = await historicoDoRegistro(req.params.entidade, req.params.id, {
      comAuditoria: ['admin', 'manager'].includes(req.userRole),
    });
    if (!r) return res.status(404).json({ error: 'Registro não encontrado' });
    res.json(r);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ error: 'Auditoria ainda não instalada: rode scripts/migrate_frota_auditoria.js' });
    }
    res.status(500).json({ error: err.message });
  }
});

/* ──────────────────────────────────────────
   RECEIPT PARSING
   ────────────────────────────────────────── */

router.post('/fueling/parse-receipt', async (req, res) => {
  try {
    let { html, url } = req.body;
    
    if (!html && !url) {
      return res.status(400).json({ error: 'O HTML ou a URL do cupom é obrigatório' });
    }

    if (url) {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      if (!response.ok) throw new Error('Falha ao buscar a URL da Sefaz');
      html = await response.text();
    }

    const data = parseFuelReceipt(html);
    await auditarCupom(req, { url, dados: data });
    res.json(data);
  } catch (err) {
    console.error('Erro no parse-receipt:', err);
    res.status(500).json({ error: 'Erro ao processar o cupom: ' + err.message });
  }
});

/* ──────────────────────────────────────────
   DRIVERS
   ────────────────────────────────────────── */

router.get('/drivers', async (req, res) => {
  try {
    const limit  = parseInt(req.query.limit)  || 15;
    const page   = parseInt(req.query.page)   || 1;
    const offset = (page - 1) * limit;

    const f = filtroStatus(req);

    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM fleet_drivers ${f.sql}`, f.params);
    const [drivers] = await pool.execute(
      `SELECT * FROM fleet_drivers ${f.sql} ORDER BY name LIMIT ? OFFSET ?`,
      [...f.params, limit, offset]
    );

    // Active vehicles assigned to each driver on this page
    const veiculos = {};
    if (drivers.length) {
      const ids = drivers.map(d => d.id);
      const [cars] = await pool.query(
        `SELECT id, make, model, license_plate, driver_id FROM fleet_cars
         WHERE status = 'active' AND driver_id IN (?) ORDER BY make, model`,
        [ids]
      );
      for (const c of cars) (veiculos[c.driver_id] ||= []).push({ id: c.id, make: c.make, model: c.model, license_plate: c.license_plate });
    }
    for (const d of drivers) d.vehicles = veiculos[d.id] || [];

    res.json({ drivers, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/drivers', async (req, res) => {
  try {
    const { name, license_number } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    const [result] = await pool.execute(
      'INSERT INTO fleet_drivers (name, license_number) VALUES (?, ?)',
      [name, license_number || null]
    );
    await auditarCriacao(req, 'motorista', result.insertId);
    res.status(201).json({ id: result.insertId, message: 'Motorista criado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/drivers/:id', async (req, res) => {
  try {
    const { name, license_number } = req.body;
    const antes = await buscar('motorista', req.params.id);
    await pool.execute(
      'UPDATE fleet_drivers SET name = ?, license_number = ? WHERE id = ?',
      [name, license_number || null, req.params.id]
    );
    await auditarEdicao(req, 'motorista', antes, req.params.id);
    res.json({ message: 'Motorista atualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/drivers/:id/status', rotaStatus('motorista', 'fleet_drivers'));

router.get('/drivers/:id/detail', async (req, res) => {
  try {
    const [[driver]] = await pool.execute('SELECT * FROM fleet_drivers WHERE id = ?', [req.params.id]);
    if (!driver) return res.status(404).json({ error: 'Motorista não encontrado' });

    const [cars] = await pool.execute(
      `SELECT id, make, model, license_plate, current_kilometers, status
       FROM fleet_cars
       WHERE driver_id = ? AND status = 'active'
       ORDER BY make, model`,
      [req.params.id]
    );

    res.json({ driver, cars });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ──────────────────────────────────────────
   CARS
   ────────────────────────────────────────── */

router.get('/cars', async (req, res) => {
  try {
    const limit      = parseInt(req.query.limit)  || 15;
    const page       = parseInt(req.query.page)   || 1;
    const offset     = (page - 1) * limit;
    const sortField  = ['make', 'model', 'license_plate', 'current_kilometers', 'status'].includes(req.query.sortField)
      ? req.query.sortField : 'make';
    const sortOrder  = req.query.sortOrder === 'desc' ? 'DESC' : 'ASC';
    const status     = req.query.status;

    let where = '';
    const params = [];
    if (status) { where = 'WHERE c.status = ?'; params.push(status); }

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM fleet_cars c ${where}`,
      params
    );

    const [cars] = await pool.execute(
      `SELECT c.*, d.name AS driver_name
       FROM fleet_cars c
       LEFT JOIN fleet_drivers d ON d.id = c.driver_id
       ${where}
       ORDER BY c.${sortField} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ cars, totalItems: total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
   Preventive-maintenance overview for every vehicle.
   Returns, per car, the last maintenance performed for each active
   maintenance type together with its recurrence rule, so the client
   can compute the OK / Em breve / Vencida status for lists and cards.
*/
router.get('/cars/maintenance-overview', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
         c.id AS car_id,
         mt.id AS type_id, mt.name, mt.recurrence_mode, mt.recurrency, mt.recurrency_date,
         lm.maintenance_date       AS last_date,
         lm.maintenance_kilometers AS last_km
       FROM fleet_cars c
       CROSS JOIN fleet_maintenance_types mt
       LEFT JOIN fleet_maintenance_history lm ON lm.id = (
         SELECT id FROM fleet_maintenance_history
         WHERE maintenance_type_id = mt.id AND car_id = c.id AND status = 'active'
         ORDER BY maintenance_date DESC, id DESC LIMIT 1
       )
       WHERE mt.status = 'active'
       ORDER BY c.id, mt.name`
    );

    const overview = {};
    for (const r of rows) {
      (overview[r.car_id] ||= []).push({
        id:              r.type_id,
        name:            r.name,
        recurrence_mode: r.recurrence_mode,
        recurrency:      r.recurrency,
        recurrency_date: r.recurrency_date,
        last_date:       r.last_date,
        last_km:         r.last_km,
      });
    }

    res.json({ overview });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cars/:id/detail', async (req, res) => {
  try {
    const [[car]] = await pool.execute(
      `SELECT c.*, d.name AS driver_name
       FROM fleet_cars c
       LEFT JOIN fleet_drivers d ON d.id = c.driver_id
       WHERE c.id = ?`,
      [req.params.id]
    );
    if (!car) return res.status(404).json({ error: 'Veículo não encontrado' });

    // Last maintenance per type for this car
    const [maintenanceStatus] = await pool.execute(
      `SELECT
         mt.id, mt.name, mt.recurrence_mode, mt.recurrency, mt.recurrency_date,
         lm.maintenance_date  AS last_date,
         lm.maintenance_kilometers AS last_km
       FROM fleet_maintenance_types mt
       LEFT JOIN fleet_maintenance_history lm ON lm.id = (
         SELECT id FROM fleet_maintenance_history
         WHERE maintenance_type_id = mt.id AND car_id = ? AND status = 'active'
         ORDER BY maintenance_date DESC, id DESC LIMIT 1
       )
       WHERE mt.status = 'active'
       ORDER BY mt.name`,
      [req.params.id]
    );

    // Recent history
    const [history] = await pool.execute(
      `SELECT mh.*, mt.name AS type_name
       FROM fleet_maintenance_history mh
       LEFT JOIN fleet_maintenance_types mt ON mt.id = mh.maintenance_type_id
       WHERE mh.car_id = ? AND mh.status = 'active'
       ORDER BY mh.maintenance_date DESC, mh.id DESC
       LIMIT 30`,
      [req.params.id]
    );

    res.json({ car, maintenanceStatus, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cars', async (req, res) => {
  try {
    const { make, model, license_plate, current_kilometers, next_tire_change, next_oil_change, driver_id, status } = req.body;
    if (!make || !model || !license_plate) return res.status(400).json({ error: 'Marca, modelo e placa são obrigatórios' });
    const [result] = await pool.execute(
      `INSERT INTO fleet_cars (make, model, license_plate, current_kilometers, next_tire_change, next_oil_change, driver_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [make, model, license_plate,
       current_kilometers ?? null, next_tire_change ?? null, next_oil_change ?? null,
       driver_id || null, status || 'active']
    );
    await auditarCriacao(req, 'veiculo', result.insertId);
    res.status(201).json({ id: result.insertId, message: 'Veículo criado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/cars/:id', async (req, res) => {
  try {
    const { make, model, license_plate, current_kilometers, next_tire_change, next_oil_change, driver_id, status } = req.body;
    const antes = await buscar('veiculo', req.params.id);
    await pool.execute(
      `UPDATE fleet_cars
       SET make = ?, model = ?, license_plate = ?, current_kilometers = ?,
           next_tire_change = ?, next_oil_change = ?, driver_id = ?, status = ?
       WHERE id = ?`,
      [make, model, license_plate,
       current_kilometers ?? null, next_tire_change ?? null, next_oil_change ?? null,
       driver_id || null, status || 'active', req.params.id]
    );
    await auditarEdicao(req, 'veiculo', antes, req.params.id);
    res.json({ message: 'Veículo atualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/cars/:id/status', rotaStatus('veiculo', 'fleet_cars'));

/* ──────────────────────────────────────────
   FUELING — statistics (before /:id routes)
   ────────────────────────────────────────── */

router.get('/fueling/statistics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const [rows] = await pool.execute(
      `SELECT
         c.id AS carro_id,
         CONCAT(c.make, ' ', c.model, ' (', c.license_plate, ')') AS detalhesDoCarro,
         CONCAT(c.make, ' ', c.model) AS veiculo,
         COALESCE(SUM(f.total_cost), 0) AS custo_total
       FROM fleet_cars c
       JOIN fleet_fueling f ON f.car_id = c.id
       WHERE f.fuel_date BETWEEN ? AND ? AND f.status = 'active'
       GROUP BY c.id, c.make, c.model, c.license_plate
       ORDER BY custo_total DESC`,
      [startDate, endDate]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/fueling/statistics/fuel-by-type', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const [rows] = await pool.execute(
      `SELECT fuel_type AS tipo_combustivel, COALESCE(SUM(liters_quantity), 0) AS total_litros
       FROM fleet_fueling
       WHERE fuel_date BETWEEN ? AND ? AND status = 'active'
       GROUP BY fuel_type
       ORDER BY total_litros DESC`,
      [startDate, endDate]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/fueling/statistics/fuel-cost-by-type', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const [rows] = await pool.execute(
      `SELECT fuel_type AS tipo_combustivel, COALESCE(SUM(total_cost), 0) AS custo_total
       FROM fleet_fueling
       WHERE fuel_date BETWEEN ? AND ? AND status = 'active'
       GROUP BY fuel_type
       ORDER BY custo_total DESC`,
      [startDate, endDate]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/fueling/statistics/maintenance-by-type', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const [rows] = await pool.execute(
      `SELECT mt.name AS tipo_manutencao, COUNT(mh.id) AS total_manutencoes, COALESCE(SUM(mh.total_cost), 0) AS custo_total
       FROM fleet_maintenance_history mh
       JOIN fleet_maintenance_types mt ON mt.id = mh.maintenance_type_id
       WHERE mh.maintenance_date BETWEEN ? AND ? AND mh.status = 'active'
       GROUP BY mt.id, mt.name
       ORDER BY total_manutencoes DESC`,
      [startDate, endDate]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/fueling/statistics/fueling-by-date', async (req, res) => {
  try {
    const { startDate, endDate, groupBy } = req.query;
    let format, label;
    if (groupBy === 'day') {
      format = '%Y-%m-%d'; label = 'data_inicio';
    } else if (groupBy === 'week') {
      format = '%Y-%u'; label = 'periodo';
    } else {
      format = '%Y-%m'; label = 'periodo';
    }
    const [rows] = await pool.execute(
      `SELECT DATE_FORMAT(fuel_date, ?) AS ${label}, COUNT(*) AS total_abastecimentos
       FROM fleet_fueling
       WHERE fuel_date BETWEEN ? AND ? AND status = 'active'
       GROUP BY ${label}
       ORDER BY ${label}`,
      [format, startDate, endDate]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ──────────────────────────────────────────
   FUELING — CRUD
   ────────────────────────────────────────── */

router.get('/fueling', async (req, res) => {
  try {
    const limit  = parseInt(req.query.limit) || 15;
    const page   = parseInt(req.query.page)  || 1;
    const offset = (page - 1) * limit;

    const f = filtroStatus(req);

    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM fleet_fueling ${f.sql}`, f.params);
    const [fuelingHistory] = await pool.execute(
      `SELECT * FROM fleet_fueling ${f.sql} ORDER BY fuel_date DESC, id DESC LIMIT ? OFFSET ?`,
      [...f.params, limit, offset]
    );
    res.json({ fuelingHistory, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/fueling', async (req, res) => {
  try {
    const { car_id, fuel_date, fueling_kilometers, fuel_amount, liters_quantity, price_per_liter, total_cost, fuel_type, observation } = req.body;
    if (!car_id || !fuel_date) return res.status(400).json({ error: 'Veículo e data são obrigatórios' });
    const [result] = await pool.execute(
      `INSERT INTO fleet_fueling (car_id, fuel_date, fueling_kilometers, fuel_amount, liters_quantity, price_per_liter, total_cost, fuel_type, observation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [car_id, fuel_date, fueling_kilometers ?? null, fuel_amount ?? null,
       liters_quantity ?? null, price_per_liter ?? null, total_cost ?? null,
       fuel_type || 'Gasolina', observation || null]
    );
    await auditarCriacao(req, 'abastecimento', result.insertId);
    res.status(201).json({ id: result.insertId, message: 'Abastecimento registrado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/fueling/:id', async (req, res) => {
  try {
    const { car_id, fuel_date, fueling_kilometers, fuel_amount, liters_quantity, price_per_liter, total_cost, fuel_type, observation } = req.body;
    const antes = await buscar('abastecimento', req.params.id);
    await pool.execute(
      `UPDATE fleet_fueling
       SET car_id = ?, fuel_date = ?, fueling_kilometers = ?, fuel_amount = ?,
           liters_quantity = ?, price_per_liter = ?, total_cost = ?, fuel_type = ?, observation = ?
       WHERE id = ?`,
      [car_id, fuel_date, fueling_kilometers ?? null, fuel_amount ?? null,
       liters_quantity ?? null, price_per_liter ?? null, total_cost ?? null,
       fuel_type || 'Gasolina', observation || null, req.params.id]
    );
    await auditarEdicao(req, 'abastecimento', antes, req.params.id);
    res.json({ message: 'Abastecimento atualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/fueling/:id/status', rotaStatus('abastecimento', 'fleet_fueling'));

/* ──────────────────────────────────────────
   OIL CHANGES
   ────────────────────────────────────────── */

router.get('/oil-changes', async (req, res) => {
  try {
    const limit  = parseInt(req.query.limit) || 15;
    const page   = parseInt(req.query.page)  || 1;
    const offset = (page - 1) * limit;

    const f = filtroStatus(req);

    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM fleet_oil_changes ${f.sql}`, f.params);
    const [oilChangeHistory] = await pool.execute(
      `SELECT * FROM fleet_oil_changes ${f.sql} ORDER BY oil_change_date DESC, id DESC LIMIT ? OFFSET ?`,
      [...f.params, limit, offset]
    );
    res.json({ oilChangeHistory, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/oil-changes', async (req, res) => {
  try {
    const { car_id, oil_change_date, oil_change_kilometers, liters_quantity, price_per_liter, total_cost, observation } = req.body;
    if (!car_id || !oil_change_date) return res.status(400).json({ error: 'Veículo e data são obrigatórios' });
    const [result] = await pool.execute(
      `INSERT INTO fleet_oil_changes (car_id, oil_change_date, oil_change_kilometers, liters_quantity, price_per_liter, total_cost, observation)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [car_id, oil_change_date, oil_change_kilometers ?? null,
       liters_quantity ?? null, price_per_liter ?? null, total_cost ?? null, observation || null]
    );
    await auditarCriacao(req, 'troca_oleo', result.insertId);
    res.status(201).json({ id: result.insertId, message: 'Troca de óleo registrada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/oil-changes/:id', async (req, res) => {
  try {
    const { car_id, oil_change_date, oil_change_kilometers, liters_quantity, price_per_liter, total_cost, observation } = req.body;
    const antes = await buscar('troca_oleo', req.params.id);
    await pool.execute(
      `UPDATE fleet_oil_changes
       SET car_id = ?, oil_change_date = ?, oil_change_kilometers = ?,
           liters_quantity = ?, price_per_liter = ?, total_cost = ?, observation = ?
       WHERE id = ?`,
      [car_id, oil_change_date, oil_change_kilometers ?? null,
       liters_quantity ?? null, price_per_liter ?? null, total_cost ?? null,
       observation || null, req.params.id]
    );
    await auditarEdicao(req, 'troca_oleo', antes, req.params.id);
    res.json({ message: 'Troca de óleo atualizada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/oil-changes/:id/status', rotaStatus('troca_oleo', 'fleet_oil_changes'));

/* ──────────────────────────────────────────
   TIRE CHANGES
   ────────────────────────────────────────── */

router.get('/tire-changes', async (req, res) => {
  try {
    const limit      = parseInt(req.query.limit)       || 15;
    const page       = parseInt(req.query.page)        || 1;
    const offset     = (page - 1) * limit;
    const sortField  = ['tire_change_date', 'tire_change_kilometers', 'car_id'].includes(req.query.sort_field)
      ? req.query.sort_field : 'tire_change_date';
    const sortOrder  = req.query.sort_order === 'asc' ? 'ASC' : 'DESC';

    const f = filtroStatus(req);

    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM fleet_tire_changes ${f.sql}`, f.params);
    const [tireChangeHistory] = await pool.execute(
      `SELECT * FROM fleet_tire_changes ${f.sql} ORDER BY ${sortField} ${sortOrder}, id DESC LIMIT ? OFFSET ?`,
      [...f.params, limit, offset]
    );
    res.json({ tireChangeHistory, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tire-changes', async (req, res) => {
  try {
    const { car_id, tire_change_date, tire_change_kilometers, observation } = req.body;
    if (!car_id || !tire_change_date) return res.status(400).json({ error: 'Veículo e data são obrigatórios' });
    const [result] = await pool.execute(
      'INSERT INTO fleet_tire_changes (car_id, tire_change_date, tire_change_kilometers, observation) VALUES (?, ?, ?, ?)',
      [car_id, tire_change_date, tire_change_kilometers ?? null, observation || null]
    );
    await auditarCriacao(req, 'troca_pneu', result.insertId);
    res.status(201).json({ id: result.insertId, message: 'Troca de pneu registrada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/tire-changes/:id', async (req, res) => {
  try {
    const { car_id, tire_change_date, tire_change_kilometers, observation } = req.body;
    const antes = await buscar('troca_pneu', req.params.id);
    await pool.execute(
      'UPDATE fleet_tire_changes SET car_id = ?, tire_change_date = ?, tire_change_kilometers = ?, observation = ? WHERE id = ?',
      [car_id, tire_change_date, tire_change_kilometers ?? null, observation || null, req.params.id]
    );
    await auditarEdicao(req, 'troca_pneu', antes, req.params.id);
    res.json({ message: 'Troca de pneu atualizada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/tire-changes/:id/status', rotaStatus('troca_pneu', 'fleet_tire_changes'));

/* ──────────────────────────────────────────
   MAINTENANCE TYPES
   ────────────────────────────────────────── */

router.get('/maintenance/types', async (req, res) => {
  try {
    const [maintenanceTypes] = await pool.execute(
      "SELECT * FROM fleet_maintenance_types ORDER BY name"
    );
    res.json({ maintenanceTypes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/maintenance/types', async (req, res) => {
  try {
    const { name, recurrency, recurrency_date, recurrence_mode, status } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    const [result] = await pool.execute(
      'INSERT INTO fleet_maintenance_types (name, recurrency, recurrency_date, recurrence_mode, status) VALUES (?, ?, ?, ?, ?)',
      [name, recurrency ?? null, recurrency_date ?? null, recurrence_mode || null, status || 'active']
    );
    await auditarCriacao(req, 'tipo_manutencao', result.insertId);
    res.status(201).json({ id: result.insertId, message: 'Tipo criado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/maintenance/types/:id', async (req, res) => {
  try {
    const { name, recurrency, recurrency_date, recurrence_mode, status } = req.body;
    const antes = await buscar('tipo_manutencao', req.params.id);
    await pool.execute(
      'UPDATE fleet_maintenance_types SET name = ?, recurrency = ?, recurrency_date = ?, recurrence_mode = ?, status = ? WHERE id = ?',
      [name, recurrency ?? null, recurrency_date ?? null, recurrence_mode || null, status || 'active', req.params.id]
    );
    await auditarEdicao(req, 'tipo_manutencao', antes, req.params.id);
    res.json({ message: 'Tipo atualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/maintenance/types/:id/status', rotaStatus('tipo_manutencao', 'fleet_maintenance_types'));

/* ──────────────────────────────────────────
   MAINTENANCE HISTORY
   ────────────────────────────────────────── */

router.get('/maintenance/history', async (req, res) => {
  try {
    const limit  = parseInt(req.query.limit) || 15;
    const page   = parseInt(req.query.page)  || 1;
    const offset = (page - 1) * limit;
    const search = String([].concat(req.query.search ?? '')[0]).trim(); // ?search repetido vira array

    // Busca por placa, marca ou modelo do veículo — precisa do JOIN com fleet_cars
    const conds = [];
    const params = [];
    if (search) {
      conds.push(`(c.license_plate LIKE ? OR c.make LIKE ? OR c.model LIKE ?
               OR CONCAT(c.make, ' ', c.model) LIKE ?)`);
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (STATUS.includes(req.query.status)) { conds.push('h.status = ?'); params.push(req.query.status); }
    const id = (v) => (/^\d+$/.test(String(v ?? '')) ? Number(v) : null);
    if (id(req.query.car_id))              { conds.push('h.car_id = ?');              params.push(id(req.query.car_id)); }
    if (id(req.query.maintenance_type_id)) { conds.push('h.maintenance_type_id = ?'); params.push(id(req.query.maintenance_type_id)); }
    const DATA = /^\d{4}-\d{2}-\d{2}$/;
    if (DATA.test(req.query.de ?? ''))  { conds.push('h.maintenance_date >= ?'); params.push(req.query.de); }
    if (DATA.test(req.query.ate ?? '')) { conds.push('h.maintenance_date <= ?'); params.push(req.query.ate); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    // Total e custo de tudo o que o filtro pegou (não só da página)
    const [[{ total, custo_total }]] = await pool.execute(
      `SELECT COUNT(*) AS total, COALESCE(SUM(h.total_cost), 0) AS custo_total
         FROM fleet_maintenance_history h
         LEFT JOIN fleet_cars c ON c.id = h.car_id
         ${where}`,
      params
    );
    const [maintenanceHistory] = await pool.execute(
      `SELECT h.*
         FROM fleet_maintenance_history h
         LEFT JOIN fleet_cars c ON c.id = h.car_id
         ${where}
        ORDER BY h.maintenance_date DESC, h.id DESC
        LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({ maintenanceHistory, total, custo_total: Number(custo_total), page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/maintenance/history', async (req, res) => {
  try {
    const { car_id, maintenance_type_id, maintenance_date, maintenance_kilometers, total_cost, observation } = req.body;
    if (!car_id || !maintenance_date) return res.status(400).json({ error: 'Veículo e data são obrigatórios' });
    const [result] = await pool.execute(
      `INSERT INTO fleet_maintenance_history (car_id, maintenance_type_id, maintenance_date, maintenance_kilometers, total_cost, observation)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [car_id, maintenance_type_id || null, maintenance_date, maintenance_kilometers ?? null, total_cost ?? null, observation || null]
    );
    await auditarCriacao(req, 'manutencao', result.insertId);
    res.status(201).json({ id: result.insertId, message: 'Manutenção registrada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/maintenance/history/:id', async (req, res) => {
  try {
    const { car_id, maintenance_type_id, maintenance_date, maintenance_kilometers, total_cost, observation } = req.body;
    const antes = await buscar('manutencao', req.params.id);
    await pool.execute(
      `UPDATE fleet_maintenance_history
       SET car_id = ?, maintenance_type_id = ?, maintenance_date = ?, maintenance_kilometers = ?, total_cost = ?, observation = ?
       WHERE id = ?`,
      [car_id, maintenance_type_id || null, maintenance_date, maintenance_kilometers ?? null, total_cost ?? null, observation || null, req.params.id]
    );
    await auditarEdicao(req, 'manutencao', antes, req.params.id);
    res.json({ message: 'Manutenção atualizada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/maintenance/history/:id/status', rotaStatus('manutencao', 'fleet_maintenance_history'));

/* ──────────────────────────────────────────
   VEHICLE STATUS (consolidated dashboard)
   ────────────────────────────────────────── */

router.get('/vehicle-status', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const p = [startDate, endDate];

    const [rows] = await pool.execute(
      `SELECT
         c.id                       AS carro_id,
         c.make                     AS marca_carro,
         c.model                    AS modelo_carro,
         c.license_plate            AS placa_carro,
         c.current_kilometers       AS quilometragem_atual,
         c.next_oil_change,
         c.next_tire_change,
         d.name                     AS nome_motorista,

         (SELECT COALESCE(SUM(f.liters_quantity), 0)
          FROM fleet_fueling f WHERE f.car_id = c.id AND f.status = 'active' AND f.fuel_date BETWEEN ? AND ?)  AS total_combustivel,

         (SELECT COALESCE(SUM(f.total_cost), 0)
          FROM fleet_fueling f WHERE f.car_id = c.id AND f.status = 'active' AND f.fuel_date BETWEEN ? AND ?)  AS custo_total_combustivel,

         (SELECT IF(MAX(f.fueling_kilometers) > MIN(f.fueling_kilometers) AND SUM(f.liters_quantity) > 0,
                    ROUND((MAX(f.fueling_kilometers) - MIN(f.fueling_kilometers)) / SUM(f.liters_quantity), 2),
                    NULL)
          FROM fleet_fueling f WHERE f.car_id = c.id AND f.status = 'active' AND f.fuel_date BETWEEN ? AND ?)  AS media_consumo_km_por_litro,

         (SELECT COUNT(*) FROM fleet_oil_changes o WHERE o.car_id = c.id AND o.status = 'active' AND o.oil_change_date BETWEEN ? AND ?)  AS total_trocas_oleo,
         (SELECT MAX(o.oil_change_date) FROM fleet_oil_changes o WHERE o.car_id = c.id AND o.status = 'active')                          AS ultima_troca_oleo_data,

         (SELECT COUNT(*) FROM fleet_tire_changes t WHERE t.car_id = c.id AND t.status = 'active' AND t.tire_change_date BETWEEN ? AND ?)  AS total_trocas_pneu,
         (SELECT MAX(t.tire_change_date) FROM fleet_tire_changes t WHERE t.car_id = c.id AND t.status = 'active')                          AS ultima_troca_pneu_data,

         (SELECT COUNT(*) FROM fleet_maintenance_history m WHERE m.car_id = c.id AND m.status = 'active' AND m.maintenance_date BETWEEN ? AND ?)  AS total_manutencoes,
         (SELECT COALESCE(SUM(m.total_cost), 0) FROM fleet_maintenance_history m WHERE m.car_id = c.id AND m.status = 'active' AND m.maintenance_date BETWEEN ? AND ?) AS custo_total_manutencao,
         (SELECT MAX(m.maintenance_date) FROM fleet_maintenance_history m WHERE m.car_id = c.id AND m.status = 'active' AND m.maintenance_date BETWEEN ? AND ?)  AS ultima_manutencao_data

       FROM fleet_cars c
       LEFT JOIN fleet_drivers d ON d.id = c.driver_id
       WHERE c.status = 'active'
       ORDER BY c.make, c.model`,
      [...p, ...p, ...p, ...p, ...p, ...p, ...p, ...p]
    );

    const result = rows.map(r => ({
      ...r,
      oleo_atrasado: r.next_oil_change != null && r.quilometragem_atual != null
        ? parseFloat(r.quilometragem_atual) >= parseFloat(r.next_oil_change)
        : false,
      pneu_atrasado: r.next_tire_change != null && r.quilometragem_atual != null
        ? parseFloat(r.quilometragem_atual) >= parseFloat(r.next_tire_change)
        : false,
      data_proxima_troca_oleo: null,
      data_proxima_troca_pneu: null,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
