import express from 'express';
import pool from '../config/database.js';
import { verifyToken, checkRole } from '../middlewares/auth.js';

const router = express.Router();

// Criar departamento
router.post(['/departments', '/department'], verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome do departamento é obrigatório' });
    }

    const [result] = await pool.execute(
      'INSERT INTO departments (name, description) VALUES (?, ?)',
      [name, description || '']
    );

    res.status(201).json({
      id: result.insertId,
      message: 'Departamento criado com sucesso'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listar departamentos
router.get(['/departments', '/department'], verifyToken, async (req, res) => {
  try {
    let query = "SELECT * FROM departments WHERE status = 'active'";
    const params = [];

    // Filtro por departamentos do usuário (se não for admin)
    if (req.userRole !== 'admin') {
      const [userDeps] = await pool.execute(
        'SELECT department_id FROM user_departments WHERE user_id = ?',
        [req.userId]
      );
      const depIds = userDeps.map(ud => ud.department_id);

      if (depIds.length === 0) {
        return res.json([]); // Sem acesso a nenhum departamento
      }

      const placeholders = depIds.map(() => '?').join(',');
      query += ` AND id IN (${placeholders})`;
      params.push(...depIds);
    }

    query += ' ORDER BY name';
    const [departments] = await pool.execute(query, params);

    // Contar processos por departamento
    for (let dept of departments) {
      const [processes] = await pool.execute(
        'SELECT COUNT(*) as count FROM processes WHERE department_id = ?',
        [dept.id]
      );
      dept.process_count = processes[0].count;
    }

    res.json(departments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obter departamento específico
router.get(['/departments/:id', '/department/:id'], verifyToken, async (req, res) => {
  try {
    const deptId = req.params.id;
    let query = 'SELECT * FROM departments WHERE id = ?';
    const params = [deptId];

    if (req.userRole !== 'admin') {
      const [userDeps] = await pool.execute(
        'SELECT department_id FROM user_departments WHERE user_id = ?',
        [req.userId]
      );
      const depIds = userDeps.map(ud => ud.department_id);
      
      if (depIds.length === 0 || !depIds.includes(parseInt(deptId))) {
        return res.status(403).json({ error: 'Acesso negado a este departamento' });
      }
    }

    const [departments] = await pool.execute(query, params);

    if (departments.length === 0) {
      return res.status(404).json({ error: 'Departamento não encontrado' });
    }

    res.json(departments[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar departamento
router.put(['/departments/:id', '/department/:id'], verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { name, description } = req.body;

    await pool.execute(
      'UPDATE departments SET name = ?, description = ? WHERE id = ?',
      [name, description, req.params.id]
    );

    res.json({ message: 'Departamento atualizado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Inativar departamento
router.delete(['/departments/:id', '/department/:id'], verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    await pool.execute("UPDATE departments SET status = 'inactive' WHERE id = ?", [req.params.id]);
    res.json({ message: 'Departamento inativado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
