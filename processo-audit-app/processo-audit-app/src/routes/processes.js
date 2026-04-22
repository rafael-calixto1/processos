import express from 'express';
import pool from '../config/database.js';
import { verifyToken, checkRole } from '../middlewares/auth.js';
import { logAudit } from '../middlewares/audit.js';

const router = express.Router();

// Criar novo processo
router.post('/processes', verifyToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const { title, description, department_id, steps } = req.body;
    
    console.log('CREATE process request:', title);
    console.log('Steps received:', JSON.stringify(steps));

    if (!title || !department_id) {
      return res.status(400).json({ error: 'Título e departamento são obrigatórios' });
    }

    const [result] = await pool.execute(
      `INSERT INTO processes (title, description, department_id, created_by, status) 
       VALUES (?, ?, ?, ?, 'draft')`,
      [title, description || '', department_id, req.userId]
    );

    const processId = result.insertId;

    // Inserir passos se fornecidos
    if (steps && Array.isArray(steps)) {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        await pool.execute(
          `INSERT INTO steps (process_id, step_number, title, description, documentation_markdown) 
           VALUES (?, ?, ?, ?, ?)`,
          [processId, i + 1, step.title, step.description || '', step.documentation_markdown || '']
        );
      }
    }

    // Registrar na auditoria
    await logAudit(processId, req.userId, 'CREATE', null, { title, description, department_id }, req);

    res.status(201).json({
      id: processId,
      message: 'Processo criado com sucesso'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listar processos
router.get('/processes', verifyToken, async (req, res) => {
  try {
    const { department_id, status } = req.query;
    let query = `
      SELECT p.*, d.name as department_name, u.name as created_by_name
      FROM processes p
      JOIN departments d ON p.department_id = d.id
      JOIN users u ON p.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (department_id) {
      query += ' AND p.department_id = ?';
      params.push(department_id);
    }

    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }

    query += ' ORDER BY p.created_at DESC';

    const [processes] = await pool.execute(query, params);

    // Buscar steps para cada processo
    for (let process of processes) {
      const [steps] = await pool.execute(
        'SELECT * FROM steps WHERE process_id = ? ORDER BY step_number',
        [process.id]
      );
      process.steps = steps;
    }

    res.json(processes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obter processo específico
router.get('/processes/:id', verifyToken, async (req, res) => {
  try {
    const [processes] = await pool.execute(
      `SELECT p.*, d.name as department_name, u.name as created_by_name
       FROM processes p
       JOIN departments d ON p.department_id = d.id
       JOIN users u ON p.created_by = u.id
       WHERE p.id = ?`,
      [req.params.id]
    );

    if (processes.length === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const process = processes[0];

    const [steps] = await pool.execute(
      'SELECT * FROM steps WHERE process_id = ? ORDER BY step_number',
      [process.id]
    );

    process.steps = steps;
    console.log(`Returning process ${process.id} with ${steps.length} steps`);

    res.json(process);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar processo
router.put('/processes/:id', verifyToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const { title, description, status, steps } = req.body;
    const processId = req.params.id;

    console.log('Update request for process:', processId);
    console.log('Body steps:', JSON.stringify(steps));

    // Obter dados antigos para auditoria
    const [oldProcess] = await pool.execute(
      'SELECT * FROM processes WHERE id = ?',
      [processId]
    );

    if (oldProcess.length === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    // Atualizar processo
    await pool.execute(
      `UPDATE processes 
       SET title = ?, description = ?, status = ?, updated_by = ?, version = version + 1, updated_at = NOW()
       WHERE id = ?`,
      [title || oldProcess[0].title, description !== undefined ? description : oldProcess[0].description, 
       status || oldProcess[0].status, req.userId, processId]
    );

    // Atualizar steps se fornecidos
    if (steps && Array.isArray(steps)) {
      // Deletar steps antigos
      await pool.execute('DELETE FROM steps WHERE process_id = ?', [processId]);

      // Inserir novos steps
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        await pool.execute(
          `INSERT INTO steps (process_id, step_number, title, description, documentation_markdown) 
           VALUES (?, ?, ?, ?, ?)`,
          [processId, i + 1, step.title, step.description || '', step.documentation_markdown || '']
        );
      }
    }

    // Registrar na auditoria
    await logAudit(processId, req.userId, 'UPDATE', oldProcess[0], { title, description, status }, req);

    res.json({ message: 'Processo atualizado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar processo
router.delete('/processes/:id', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const processId = req.params.id;

    const [oldProcess] = await pool.execute(
      'SELECT * FROM processes WHERE id = ?',
      [processId]
    );

    if (oldProcess.length === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    await pool.execute('DELETE FROM processes WHERE id = ?', [processId]);

    // Registrar na auditoria
    await logAudit(processId, req.userId, 'DELETE', oldProcess[0], null, req);

    res.json({ message: 'Processo deletado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obter auditoria de um processo
router.get('/processes/:id/audit', verifyToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const [logs] = await pool.execute(
      `SELECT a.*, u.name as user_name 
       FROM audit_logs a
       JOIN users u ON a.user_id = u.id
       WHERE a.process_id = ?
       ORDER BY a.timestamp DESC`,
      [req.params.id]
    );

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
