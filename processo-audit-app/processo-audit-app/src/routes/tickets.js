import express from 'express';
import pool from '../config/database.js';
import { verifyToken, checkRole } from '../middlewares/auth.js';

const router = express.Router();

/* ── Users list for assignment (any authenticated user) ── */
router.get('/tickets/users', verifyToken, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, name, email FROM users ORDER BY name'
    );
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const ticketWithUsers = `
  SELECT
    t.*,
    u1.name AS created_by_name,
    u1.email AS created_by_email,
    u2.name AS assigned_to_name,
    u2.email AS assigned_to_email,
    (SELECT COUNT(*) FROM ticket_comments c WHERE c.ticket_id = t.id) AS comment_count
  FROM tickets t
  JOIN users u1 ON u1.id = t.created_by
  LEFT JOIN users u2 ON u2.id = t.assigned_to
`;

/* ── List tickets ── */
router.get('/tickets', verifyToken, async (req, res) => {
  try {
    const { status, priority, filter, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions = [];
    const params = [];

    if (filter === 'mine') {
      conditions.push('t.created_by = ?');
      params.push(req.userId);
    } else if (filter === 'assigned') {
      conditions.push('t.assigned_to = ?');
      params.push(req.userId);
    }

    if (status)   { conditions.push('t.status = ?');   params.push(status); }
    if (priority) { conditions.push('t.priority = ?'); params.push(priority); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM tickets t ${where}`, params
    );

    const [tickets] = await pool.execute(
      `${ticketWithUsers} ${where} ORDER BY
        FIELD(t.priority,'urgent','high','medium','low'),
        FIELD(t.status,'open','in_progress','resolved','closed'),
        t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({ tickets, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Create ticket ── */
router.post('/tickets', verifyToken, async (req, res) => {
  try {
    const { title, description, priority, assigned_to } = req.body;
    if (!title) return res.status(400).json({ error: 'Título é obrigatório' });

    const [result] = await pool.execute(
      'INSERT INTO tickets (title, description, priority, assigned_to, created_by) VALUES (?, ?, ?, ?, ?)',
      [title, description || null, priority || 'medium', assigned_to || null, req.userId]
    );
    res.status(201).json({ id: result.insertId, message: 'Ticket criado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Get single ticket with comments ── */
router.get('/tickets/:id', verifyToken, async (req, res) => {
  try {
    const [[ticket]] = await pool.execute(
      `${ticketWithUsers} WHERE t.id = ?`, [req.params.id]
    );
    if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado' });

    const [comments] = await pool.execute(
      `SELECT c.*, u.name AS user_name, u.email AS user_email
       FROM ticket_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.ticket_id = ?
       ORDER BY c.created_at ASC`,
      [req.params.id]
    );

    res.json({ ...ticket, comments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Update ticket ── */
router.put('/tickets/:id', verifyToken, async (req, res) => {
  try {
    const { title, description, status, priority, assigned_to } = req.body;

    const [[ticket]] = await pool.execute('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado' });

    if (req.userRole !== 'admin' && ticket.created_by !== req.userId && ticket.assigned_to !== req.userId) {
      return res.status(403).json({ error: 'Sem permissão para editar este ticket' });
    }

    await pool.execute(
      'UPDATE tickets SET title = ?, description = ?, status = ?, priority = ?, assigned_to = ? WHERE id = ?',
      [title ?? ticket.title, description ?? ticket.description,
       status ?? ticket.status, priority ?? ticket.priority,
       assigned_to !== undefined ? (assigned_to || null) : ticket.assigned_to,
       req.params.id]
    );
    res.json({ message: 'Ticket atualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Delete ticket (admin or creator) ── */
router.delete('/tickets/:id', verifyToken, async (req, res) => {
  try {
    const [[ticket]] = await pool.execute('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado' });

    if (req.userRole !== 'admin' && ticket.created_by !== req.userId) {
      return res.status(403).json({ error: 'Sem permissão para excluir este ticket' });
    }

    await pool.execute('DELETE FROM tickets WHERE id = ?', [req.params.id]);
    res.json({ message: 'Ticket excluído' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Add comment ── */
router.post('/tickets/:id/comments', verifyToken, async (req, res) => {
  try {
    const { comment } = req.body;
    if (!comment?.trim()) return res.status(400).json({ error: 'Comentário não pode ser vazio' });

    const [[ticket]] = await pool.execute('SELECT id FROM tickets WHERE id = ?', [req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado' });

    const [result] = await pool.execute(
      'INSERT INTO ticket_comments (ticket_id, user_id, comment) VALUES (?, ?, ?)',
      [req.params.id, req.userId, comment.trim()]
    );
    res.status(201).json({ id: result.insertId, message: 'Comentário adicionado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Delete comment ── */
router.delete('/tickets/:id/comments/:commentId', verifyToken, async (req, res) => {
  try {
    const [[comment]] = await pool.execute(
      'SELECT * FROM ticket_comments WHERE id = ? AND ticket_id = ?',
      [req.params.commentId, req.params.id]
    );
    if (!comment) return res.status(404).json({ error: 'Comentário não encontrado' });

    if (req.userRole !== 'admin' && comment.user_id !== req.userId) {
      return res.status(403).json({ error: 'Sem permissão para excluir este comentário' });
    }

    await pool.execute('DELETE FROM ticket_comments WHERE id = ?', [req.params.commentId]);
    res.json({ message: 'Comentário excluído' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
