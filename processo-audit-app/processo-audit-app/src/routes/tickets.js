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

const labelsSubquery = `
  (SELECT GROUP_CONCAT(CONCAT(l.id,'|',l.name,'|',l.color) ORDER BY l.name SEPARATOR ';;')
   FROM ticket_labels tl JOIN labels l ON l.id = tl.label_id
   WHERE tl.ticket_id = t.id) AS labels_raw
`;

const ticketWithUsers = `
  SELECT
    t.*,
    u1.name  AS created_by_name,
    u1.email AS created_by_email,
    u2.name  AS assigned_to_name,
    u2.email AS assigned_to_email,
    d.name   AS department_name,
    (SELECT COUNT(*) FROM ticket_comments c WHERE c.ticket_id = t.id) AS comment_count,
    ${labelsSubquery}
  FROM tickets t
  JOIN  users u1 ON u1.id = t.created_by
  LEFT JOIN users u2 ON u2.id = t.assigned_to
  LEFT JOIN departments d ON d.id = t.department_id
`;

const parseLabels = (raw) =>
  raw
    ? raw.split(';;').map(s => {
        const [id, name, color] = s.split('|');
        return { id: parseInt(id), name, color: color || '#6366f1' };
      })
    : [];

const parseTicket = (t) => ({ ...t, labels: parseLabels(t.labels_raw), labels_raw: undefined });

/* ── List tickets ── */
router.get('/tickets', verifyToken, async (req, res) => {
  try {
    const { status, priority, type, department_id, filter, page = 1, limit = 20 } = req.query;
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

    if (status)        { conditions.push('t.status = ?');        params.push(status); }
    if (priority)      { conditions.push('t.priority = ?');      params.push(priority); }
    if (type)          { conditions.push('t.type = ?');          params.push(type); }
    if (department_id) { conditions.push('t.department_id = ?'); params.push(department_id); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM tickets t ${where}`, params
    );

    const [rows] = await pool.execute(
      `${ticketWithUsers} ${where}
       ORDER BY
         FIELD(t.priority,'urgent','high','medium','low'),
         FIELD(t.status,'open','in_progress','resolved','closed'),
         t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      tickets: rows.map(parseTicket),
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Create ticket ── */
router.post('/tickets', verifyToken, async (req, res) => {
  try {
    const { title, description, priority, type, department_id, assigned_to, due_date, labels } = req.body;
    if (!title) return res.status(400).json({ error: 'Título é obrigatório' });

    const [result] = await pool.execute(
      `INSERT INTO tickets (title, description, priority, type, department_id, assigned_to, due_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        description || null,
        priority || 'medium',
        type || 'task',
        department_id || null,
        assigned_to || null,
        due_date || null,
        req.userId,
      ]
    );

    const ticketId = result.insertId;

    if (Array.isArray(labels) && labels.length) {
      for (const id of labels) {
        await pool.execute(
          'INSERT IGNORE INTO ticket_labels (ticket_id, label_id) VALUES (?, ?)',
          [ticketId, id]
        );
      }
    }

    await pool.execute(
      `INSERT INTO ticket_activity (ticket_id, user_id, action) VALUES (?, ?, 'created')`,
      [ticketId, req.userId]
    );

    res.status(201).json({ id: ticketId, message: 'Ticket criado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Get single ticket with comments, labels, activity ── */
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

    const [labels] = await pool.execute(
      `SELECT l.id, l.name, l.color FROM ticket_labels tl
       JOIN labels l ON l.id = tl.label_id
       WHERE tl.ticket_id = ? ORDER BY l.name`,
      [req.params.id]
    );

    const [activity] = await pool.execute(
      `SELECT a.*, u.name AS user_name
       FROM ticket_activity a
       JOIN users u ON u.id = a.user_id
       WHERE a.ticket_id = ?
       ORDER BY a.created_at ASC`,
      [req.params.id]
    );

    res.json({ ...parseTicket(ticket), labels, comments, activity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Update ticket ── */
router.put('/tickets/:id', verifyToken, async (req, res) => {
  try {
    const { title, description, status, priority, type, department_id, due_date, assigned_to, labels } = req.body;

    const [[ticket]] = await pool.execute(
      `SELECT t.*, u.name AS assigned_to_name, d.name AS department_name 
       FROM tickets t 
       LEFT JOIN users u ON u.id = t.assigned_to 
       LEFT JOIN departments d ON d.id = t.department_id
       WHERE t.id = ?`,
      [req.params.id]
    );
    if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado' });

    if (req.userRole !== 'admin' && ticket.created_by !== req.userId && ticket.assigned_to !== req.userId) {
      return res.status(403).json({ error: 'Sem permissão para editar este ticket' });
    }

    /* track changed fields for activity log */
    const activities = [];
    const track = (field, oldVal, newVal) => {
      if (newVal !== undefined && String(oldVal ?? '') !== String(newVal ?? '')) {
        activities.push({ field, old_value: String(oldVal ?? ''), new_value: String(newVal ?? '') });
      }
    };

    track('status',   ticket.status,   status);
    track('priority', ticket.priority, priority);
    track('type',     ticket.type,     type);
    track('due_date', ticket.due_date ? String(ticket.due_date).slice(0, 10) : '', due_date ?? undefined);

    if (department_id !== undefined) {
      const oldId = ticket.department_id ?? '';
      const newId = department_id || '';
      if (String(oldId) !== String(newId)) {
        let newName = '';
        if (newId) {
          const [[d]] = await pool.execute('SELECT name FROM departments WHERE id = ?', [newId]);
          newName = d?.name ?? newId;
        }
        activities.push({
          field: 'department',
          old_value: ticket.department_name ?? '',
          new_value: newName,
        });
      }
    }

    if (assigned_to !== undefined) {
      const oldId = ticket.assigned_to ?? '';
      const newId = assigned_to || '';
      if (String(oldId) !== String(newId)) {
        let newName = '';
        if (newId) {
          const [[u]] = await pool.execute('SELECT name FROM users WHERE id = ?', [newId]);
          newName = u?.name ?? newId;
        }
        activities.push({
          field: 'assigned_to',
          old_value: ticket.assigned_to_name ?? '',
          new_value: newName,
        });
      }
    }

    await pool.execute(
      `UPDATE tickets SET
         title = ?, description = ?, status = ?, priority = ?, type = ?,
         department_id = ?, due_date = ?, assigned_to = ?
       WHERE id = ?`,
      [
        title        ?? ticket.title,
        description  ?? ticket.description,
        status       ?? ticket.status,
        priority     ?? ticket.priority,
        type         ?? ticket.type,
        department_id !== undefined ? (department_id || null) : ticket.department_id,
        due_date     !== undefined ? (due_date || null) : ticket.due_date,
        assigned_to  !== undefined ? (assigned_to || null) : ticket.assigned_to,
        req.params.id,
      ]
    );

    for (const act of activities) {
      await pool.execute(
        `INSERT INTO ticket_activity (ticket_id, user_id, action, field, old_value, new_value)
         VALUES (?, ?, 'changed', ?, ?, ?)`,
        [req.params.id, req.userId, act.field, act.old_value, act.new_value]
      );
    }

    if (Array.isArray(labels)) {
      await pool.execute('DELETE FROM ticket_labels WHERE ticket_id = ?', [req.params.id]);
      for (const id of labels) {
        await pool.execute(
          'INSERT IGNORE INTO ticket_labels (ticket_id, label_id) VALUES (?, ?)',
          [req.params.id, id]
        );
      }
    }

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

    await pool.execute(
      `INSERT INTO ticket_activity (ticket_id, user_id, action) VALUES (?, ?, 'commented')`,
      [req.params.id, req.userId]
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
