import express from 'express';
import pool from '../config/database.js';
import { verifyToken, checkRole } from '../middlewares/auth.js';

const router = express.Router();

// Listar todos os fluxos visuais
router.get('/visual-processes', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, title, created_at, updated_at FROM visual_processes ORDER BY updated_at DESC'
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obter um fluxo específico
router.get('/visual-processes/:id', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM visual_processes WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Fluxo não encontrado' });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Criar novo fluxo visual
router.post('/visual-processes', verifyToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const { title, nodes, edges } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO visual_processes (title, nodes, edges, created_by) VALUES (?, ?, ?, ?)',
      [title || 'Novo Fluxo', JSON.stringify(nodes), JSON.stringify(edges), req.userId]
    );
    res.status(201).json({ id: result.insertId, message: 'Fluxo criado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar fluxo visual existente
router.put('/visual-processes/:id', verifyToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const { title, nodes, edges } = req.body;
    await pool.execute(
      'UPDATE visual_processes SET title = ?, nodes = ?, edges = ? WHERE id = ?',
      [title, JSON.stringify(nodes), JSON.stringify(edges), req.params.id]
    );
    res.json({ message: 'Fluxo atualizado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Excluir fluxo visual
router.delete('/visual-processes/:id', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    await pool.execute('DELETE FROM visual_processes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Fluxo excluído com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
