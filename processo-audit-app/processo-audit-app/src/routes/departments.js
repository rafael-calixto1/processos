import express from 'express';
import pool from '../config/database.js';
import { verifyToken, checkRole } from '../middlewares/auth.js';

const router = express.Router();

// Criar departamento
router.post('/departments', verifyToken, checkRole(['admin']), async (req, res) => {
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
router.get('/departments', verifyToken, async (req, res) => {
  try {
    const [departments] = await pool.execute(
      'SELECT * FROM departments ORDER BY name'
    );

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
router.get('/departments/:id', verifyToken, async (req, res) => {
  try {
    const [departments] = await pool.execute(
      'SELECT * FROM departments WHERE id = ?',
      [req.params.id]
    );

    if (departments.length === 0) {
      return res.status(404).json({ error: 'Departamento não encontrado' });
    }

    res.json(departments[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar departamento
router.put('/departments/:id', verifyToken, checkRole(['admin']), async (req, res) => {
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

// Deletar departamento
router.delete('/departments/:id', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const [processes] = await pool.execute(
      'SELECT COUNT(*) as count FROM processes WHERE department_id = ?',
      [req.params.id]
    );

    if (processes[0].count > 0) {
      return res.status(400).json({ error: 'Não é possível deletar um departamento com processos' });
    }

    await pool.execute('DELETE FROM departments WHERE id = ?', [req.params.id]);

    res.json({ message: 'Departamento deletado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
