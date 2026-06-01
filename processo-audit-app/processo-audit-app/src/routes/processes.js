import express from 'express';
import pool from '../config/database.js';
import { verifyToken, checkRole } from '../middlewares/auth.js';
import { logAudit } from '../middlewares/audit.js';
import multer from 'multer';
import path from 'path';

const router = express.Router();

// Configuração do Multer para upload de fotos de instrução
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/process_steps/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'template-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Apenas imagens (jpeg, jpg, png, webp) são permitidas!'));
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Endpoint para upload de foto do passo (instrução)
router.post('/processes/upload-step-photo', verifyToken, checkRole(['admin', 'manager']), upload.single('photo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    const photoUrl = `/uploads/process_steps/${req.file.filename}`;
    res.json({ photo_url: photoUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Criar novo processo
router.post(['/processes', '/process'], verifyToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const { title, description, department_id, steps } = req.body;
    
    console.log('CREATE process request:', title);
    console.log('Steps received:', JSON.stringify(steps));

    if (!title || !department_id) {
      return res.status(400).json({ error: 'Título e departamento são obrigatórios' });
    }

    const [result] = await pool.execute(
      `INSERT INTO processes (title, description, department_id, created_by, status) 
       VALUES (?, ?, ?, ?, 'active')`,
      [title, description || '', department_id, req.userId]
    );

    const processId = result.insertId;

    // Inserir passos se fornecidos
    if (steps && Array.isArray(steps)) {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        await pool.execute(
          `INSERT INTO steps (process_id, step_number, title, description, documentation_markdown, photo_url) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [processId, i + 1, step.title, step.description || '', step.documentation_markdown || '', step.photo_url || null]
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
router.get(['/processes', '/process'], verifyToken, async (req, res) => {
  try {
    const { department_id, status, search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    let baseQuery = `
      FROM processes p
      JOIN departments d ON p.department_id = d.id
      JOIN users u ON p.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    // Filtro por departamentos do usuário (se não for admin)
    if (req.userRole !== 'admin') {
      const [userDeps] = await pool.execute(
        'SELECT department_id FROM user_departments WHERE user_id = ?',
        [req.userId]
      );
      const depIds = userDeps.map(ud => ud.department_id);
      
      if (depIds.length === 0) {
        return res.json({ processes: [], total: 0, pages: 0, currentPage: parseInt(page) });
      }
      
      const placeholders = depIds.map(() => '?').join(',');
      baseQuery += ` AND p.department_id IN (${placeholders})`;
      params.push(...depIds);
    }

    if (department_id) {
      baseQuery += ' AND p.department_id = ?';
      params.push(department_id);
    }

    if (status) {
      baseQuery += ' AND p.status = ?';
      params.push(status);
    } else {
      baseQuery += " AND p.status != 'archived'";
    }

    if (search) {
      baseQuery += ' AND (p.title LIKE ? OR p.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const [totalRes] = await pool.execute(countQuery, params);
    const total = totalRes[0].total;

    let query = `SELECT p.*, d.name as department_name, u.name as created_by_name ${baseQuery}`;
    query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [processes] = await pool.execute(query, params);

    // Buscar steps para cada processo
    for (let process of processes) {
      const [steps] = await pool.execute(
        'SELECT * FROM steps WHERE process_id = ? ORDER BY step_number',
        [process.id]
      );
      process.steps = steps;
    }

    res.json({
      processes,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obter processo específico
router.get(['/processes/:id', '/process/:id'], verifyToken, async (req, res) => {
  try {
    const processId = req.params.id;
    let query = `
      SELECT p.*, d.name as department_name, u.name as created_by_name
       FROM processes p
       JOIN departments d ON p.department_id = d.id
       JOIN users u ON p.created_by = u.id
       WHERE p.id = ?
    `;
    const params = [processId];

    // Verificação de acesso por departamento (se não for admin)
    if (req.userRole !== 'admin') {
      const [userDeps] = await pool.execute(
        'SELECT department_id FROM user_departments WHERE user_id = ?',
        [req.userId]
      );
      const depIds = userDeps.map(ud => ud.department_id);
      
      if (depIds.length === 0) {
        return res.status(403).json({ error: 'Acesso negado a este departamento' });
      }
      
      const placeholders = depIds.map(() => '?').join(',');
      query += ` AND p.department_id IN (${placeholders})`;
      params.push(...depIds);
    }

    const [processes] = await pool.execute(query, params);

    if (processes.length === 0) {
      return res.status(404).json({ error: 'Processo não encontrado ou sem permissão' });
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
router.put(['/processes/:id', '/process/:id'], verifyToken, checkRole(['admin', 'manager']), async (req, res) => {
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
          `INSERT INTO steps (process_id, step_number, title, description, documentation_markdown, photo_url) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [processId, i + 1, step.title, step.description || '', step.documentation_markdown || '', step.photo_url || null]
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
router.delete(['/processes/:id', '/process/:id'], verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const processId = req.params.id;

    const [oldProcess] = await pool.execute(
      'SELECT * FROM processes WHERE id = ?',
      [processId]
    );

    if (oldProcess.length === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    await pool.execute("UPDATE processes SET status = 'archived' WHERE id = ?", [processId]);

    // Registrar na auditoria
    await logAudit(processId, req.userId, 'DELETE', oldProcess[0], null, req);

    res.json({ message: 'Processo inativado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obter auditoria de um processo
router.get(['/processes/:id/audit', '/process/:id/audit'], verifyToken, checkRole(['admin', 'manager']), async (req, res) => {
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
