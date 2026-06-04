import express from 'express';
import pool from '../config/database.js';
import { verifyToken } from '../middlewares/auth.js';

const router = express.Router();

/* ── List all labels ── */
router.get('/labels', verifyToken, async (req, res) => {
  try {
    const [labels] = await pool.execute(
      `SELECT l.*, u.name AS created_by_name
       FROM labels l
       LEFT JOIN users u ON u.id = l.created_by
       ORDER BY l.name`
    );
    res.json({ labels });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Create label ── */
router.post('/labels', verifyToken, async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });

    const [result] = await pool.execute(
      'INSERT INTO labels (name, color, created_by) VALUES (?, ?, ?)',
      [name.trim(), color || '#6366f1', req.userId]
    );
    res.status(201).json({ id: result.insertId, message: 'Label criada' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Já existe uma label com esse nome' });
    }
    res.status(500).json({ error: err.message });
  }
});

/* ── Update label ── */
router.put('/labels/:id', verifyToken, async (req, res) => {
  try {
    const { name, color } = req.body;
    const [[label]] = await pool.execute('SELECT * FROM labels WHERE id = ?', [req.params.id]);
    if (!label) return res.status(404).json({ error: 'Label não encontrada' });

    if (req.userRole !== 'admin' && label.created_by !== req.userId) {
      return res.status(403).json({ error: 'Sem permissão para editar esta label' });
    }

    await pool.execute(
      'UPDATE labels SET name = ?, color = ? WHERE id = ?',
      [name?.trim() ?? label.name, color ?? label.color, req.params.id]
    );
    res.json({ message: 'Label atualizada' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Já existe uma label com esse nome' });
    }
    res.status(500).json({ error: err.message });
  }
});

/* ── Delete label ── */
router.delete('/labels/:id', verifyToken, async (req, res) => {
  try {
    const [[label]] = await pool.execute('SELECT * FROM labels WHERE id = ?', [req.params.id]);
    if (!label) return res.status(404).json({ error: 'Label não encontrada' });

    if (req.userRole !== 'admin' && label.created_by !== req.userId) {
      return res.status(403).json({ error: 'Sem permissão para excluir esta label' });
    }

    await pool.execute('DELETE FROM labels WHERE id = ?', [req.params.id]);
    res.json({ message: 'Label excluída' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
