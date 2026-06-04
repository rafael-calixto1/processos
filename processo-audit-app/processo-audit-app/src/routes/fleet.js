import express from 'express';
import pool from '../config/database.js';
import { parseFuelReceipt } from '../services/receiptService.js';

const router = express.Router();

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

    const [[{ total }]] = await pool.execute('SELECT COUNT(*) AS total FROM fleet_drivers');
    const [drivers] = await pool.execute(
      'SELECT * FROM fleet_drivers ORDER BY name LIMIT ? OFFSET ?',
      [limit, offset]
    );

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
    res.status(201).json({ id: result.insertId, message: 'Motorista criado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/drivers/:id', async (req, res) => {
  try {
    const { name, license_number } = req.body;
    await pool.execute(
      'UPDATE fleet_drivers SET name = ?, license_number = ? WHERE id = ?',
      [name, license_number || null, req.params.id]
    );
    res.json({ message: 'Motorista atualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/drivers/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM fleet_drivers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Motorista excluído' });
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
    res.status(201).json({ id: result.insertId, message: 'Veículo criado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/cars/:id', async (req, res) => {
  try {
    const { make, model, license_plate, current_kilometers, next_tire_change, next_oil_change, driver_id, status } = req.body;
    await pool.execute(
      `UPDATE fleet_cars
       SET make = ?, model = ?, license_plate = ?, current_kilometers = ?,
           next_tire_change = ?, next_oil_change = ?, driver_id = ?, status = ?
       WHERE id = ?`,
      [make, model, license_plate,
       current_kilometers ?? null, next_tire_change ?? null, next_oil_change ?? null,
       driver_id || null, status || 'active', req.params.id]
    );
    res.json({ message: 'Veículo atualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/cars/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM fleet_cars WHERE id = ?', [req.params.id]);
    res.json({ message: 'Veículo excluído' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
       WHERE f.fuel_date BETWEEN ? AND ?
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
       WHERE fuel_date BETWEEN ? AND ?
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
       WHERE fuel_date BETWEEN ? AND ?
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
      `SELECT mt.name AS tipo_manutencao, COUNT(mh.id) AS total_manutencoes
       FROM fleet_maintenance_history mh
       JOIN fleet_maintenance_types mt ON mt.id = mh.maintenance_type_id
       WHERE mh.maintenance_date BETWEEN ? AND ?
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
       WHERE fuel_date BETWEEN ? AND ?
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

    const [[{ total }]] = await pool.execute('SELECT COUNT(*) AS total FROM fleet_fueling');
    const [fuelingHistory] = await pool.execute(
      'SELECT * FROM fleet_fueling ORDER BY fuel_date DESC, id DESC LIMIT ? OFFSET ?',
      [limit, offset]
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
    res.status(201).json({ id: result.insertId, message: 'Abastecimento registrado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/fueling/:id', async (req, res) => {
  try {
    const { car_id, fuel_date, fueling_kilometers, fuel_amount, liters_quantity, price_per_liter, total_cost, fuel_type, observation } = req.body;
    await pool.execute(
      `UPDATE fleet_fueling
       SET car_id = ?, fuel_date = ?, fueling_kilometers = ?, fuel_amount = ?,
           liters_quantity = ?, price_per_liter = ?, total_cost = ?, fuel_type = ?, observation = ?
       WHERE id = ?`,
      [car_id, fuel_date, fueling_kilometers ?? null, fuel_amount ?? null,
       liters_quantity ?? null, price_per_liter ?? null, total_cost ?? null,
       fuel_type || 'Gasolina', observation || null, req.params.id]
    );
    res.json({ message: 'Abastecimento atualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/fueling/entry/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM fleet_fueling WHERE id = ?', [req.params.id]);
    res.json({ message: 'Abastecimento excluído' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ──────────────────────────────────────────
   OIL CHANGES
   ────────────────────────────────────────── */

router.get('/oil-changes', async (req, res) => {
  try {
    const limit  = parseInt(req.query.limit) || 15;
    const page   = parseInt(req.query.page)  || 1;
    const offset = (page - 1) * limit;

    const [[{ total }]] = await pool.execute('SELECT COUNT(*) AS total FROM fleet_oil_changes');
    const [oilChangeHistory] = await pool.execute(
      'SELECT * FROM fleet_oil_changes ORDER BY oil_change_date DESC, id DESC LIMIT ? OFFSET ?',
      [limit, offset]
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
    res.status(201).json({ id: result.insertId, message: 'Troca de óleo registrada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/oil-changes/:id', async (req, res) => {
  try {
    const { car_id, oil_change_date, oil_change_kilometers, liters_quantity, price_per_liter, total_cost, observation } = req.body;
    await pool.execute(
      `UPDATE fleet_oil_changes
       SET car_id = ?, oil_change_date = ?, oil_change_kilometers = ?,
           liters_quantity = ?, price_per_liter = ?, total_cost = ?, observation = ?
       WHERE id = ?`,
      [car_id, oil_change_date, oil_change_kilometers ?? null,
       liters_quantity ?? null, price_per_liter ?? null, total_cost ?? null,
       observation || null, req.params.id]
    );
    res.json({ message: 'Troca de óleo atualizada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/oil-changes/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM fleet_oil_changes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Troca de óleo excluída' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

    const [[{ total }]] = await pool.execute('SELECT COUNT(*) AS total FROM fleet_tire_changes');
    const [tireChangeHistory] = await pool.execute(
      `SELECT * FROM fleet_tire_changes ORDER BY ${sortField} ${sortOrder}, id DESC LIMIT ? OFFSET ?`,
      [limit, offset]
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
    res.status(201).json({ id: result.insertId, message: 'Troca de pneu registrada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/tire-changes/:id', async (req, res) => {
  try {
    const { car_id, tire_change_date, tire_change_kilometers, observation } = req.body;
    await pool.execute(
      'UPDATE fleet_tire_changes SET car_id = ?, tire_change_date = ?, tire_change_kilometers = ?, observation = ? WHERE id = ?',
      [car_id, tire_change_date, tire_change_kilometers ?? null, observation || null, req.params.id]
    );
    res.json({ message: 'Troca de pneu atualizada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/tire-changes/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM fleet_tire_changes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Troca de pneu excluída' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
    const { name, recurrency, recurrency_date, status } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    const [result] = await pool.execute(
      'INSERT INTO fleet_maintenance_types (name, recurrency, recurrency_date, status) VALUES (?, ?, ?, ?)',
      [name, recurrency ?? null, recurrency_date ?? null, status || 'active']
    );
    res.status(201).json({ id: result.insertId, message: 'Tipo criado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/maintenance/types/:id', async (req, res) => {
  try {
    const { name, recurrency, recurrency_date, status } = req.body;
    await pool.execute(
      'UPDATE fleet_maintenance_types SET name = ?, recurrency = ?, recurrency_date = ?, status = ? WHERE id = ?',
      [name, recurrency ?? null, recurrency_date ?? null, status || 'active', req.params.id]
    );
    res.json({ message: 'Tipo atualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/maintenance/types/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM fleet_maintenance_types WHERE id = ?', [req.params.id]);
    res.json({ message: 'Tipo excluído' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ──────────────────────────────────────────
   MAINTENANCE HISTORY
   ────────────────────────────────────────── */

router.get('/maintenance/history', async (req, res) => {
  try {
    const limit  = parseInt(req.query.limit) || 15;
    const page   = parseInt(req.query.page)  || 1;
    const offset = (page - 1) * limit;

    const [[{ total }]] = await pool.execute('SELECT COUNT(*) AS total FROM fleet_maintenance_history');
    const [maintenanceHistory] = await pool.execute(
      'SELECT * FROM fleet_maintenance_history ORDER BY maintenance_date DESC, id DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    res.json({ maintenanceHistory, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/maintenance/history', async (req, res) => {
  try {
    const { car_id, maintenance_type_id, maintenance_date, maintenance_kilometers, observation } = req.body;
    if (!car_id || !maintenance_date) return res.status(400).json({ error: 'Veículo e data são obrigatórios' });
    const [result] = await pool.execute(
      `INSERT INTO fleet_maintenance_history (car_id, maintenance_type_id, maintenance_date, maintenance_kilometers, observation)
       VALUES (?, ?, ?, ?, ?)`,
      [car_id, maintenance_type_id || null, maintenance_date, maintenance_kilometers ?? null, observation || null]
    );
    res.status(201).json({ id: result.insertId, message: 'Manutenção registrada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/maintenance/history/:id', async (req, res) => {
  try {
    const { car_id, maintenance_type_id, maintenance_date, maintenance_kilometers, observation } = req.body;
    await pool.execute(
      `UPDATE fleet_maintenance_history
       SET car_id = ?, maintenance_type_id = ?, maintenance_date = ?, maintenance_kilometers = ?, observation = ?
       WHERE id = ?`,
      [car_id, maintenance_type_id || null, maintenance_date, maintenance_kilometers ?? null, observation || null, req.params.id]
    );
    res.json({ message: 'Manutenção atualizada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/maintenance/history/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM fleet_maintenance_history WHERE id = ?', [req.params.id]);
    res.json({ message: 'Manutenção excluída' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
          FROM fleet_fueling f WHERE f.car_id = c.id AND f.fuel_date BETWEEN ? AND ?)  AS total_combustivel,

         (SELECT COALESCE(SUM(f.total_cost), 0)
          FROM fleet_fueling f WHERE f.car_id = c.id AND f.fuel_date BETWEEN ? AND ?)  AS custo_total_combustivel,

         (SELECT IF(MAX(f.fueling_kilometers) > MIN(f.fueling_kilometers) AND SUM(f.liters_quantity) > 0,
                    ROUND((MAX(f.fueling_kilometers) - MIN(f.fueling_kilometers)) / SUM(f.liters_quantity), 2),
                    NULL)
          FROM fleet_fueling f WHERE f.car_id = c.id AND f.fuel_date BETWEEN ? AND ?)  AS media_consumo_km_por_litro,

         (SELECT COUNT(*) FROM fleet_oil_changes o WHERE o.car_id = c.id AND o.oil_change_date BETWEEN ? AND ?)  AS total_trocas_oleo,
         (SELECT MAX(o.oil_change_date) FROM fleet_oil_changes o WHERE o.car_id = c.id)                          AS ultima_troca_oleo_data,

         (SELECT COUNT(*) FROM fleet_tire_changes t WHERE t.car_id = c.id AND t.tire_change_date BETWEEN ? AND ?)  AS total_trocas_pneu,
         (SELECT MAX(t.tire_change_date) FROM fleet_tire_changes t WHERE t.car_id = c.id)                          AS ultima_troca_pneu_data,

         (SELECT COUNT(*) FROM fleet_maintenance_history m WHERE m.car_id = c.id AND m.maintenance_date BETWEEN ? AND ?)  AS total_manutencoes,
         (SELECT MAX(m.maintenance_date) FROM fleet_maintenance_history m WHERE m.car_id = c.id AND m.maintenance_date BETWEEN ? AND ?)  AS ultima_manutencao_data

       FROM fleet_cars c
       LEFT JOIN fleet_drivers d ON d.id = c.driver_id
       WHERE c.status = 'active'
       ORDER BY c.make, c.model`,
      [...p, ...p, ...p, ...p, ...p, ...p, ...p]
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
