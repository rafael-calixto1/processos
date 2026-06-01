import express from 'express';
import pool from '../config/database.js';
import { verifyToken, checkRole } from '../middlewares/auth.js';
import multer from 'multer';
import path from 'path';

const router = express.Router();

// Configuração do Multer para upload de imagens das etapas do fluxo
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/visual_processes/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'stage-' + uniqueSuffix + path.extname(file.originalname));
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

// Endpoint para upload de imagem da etapa
router.post('/visual-processes/upload', verifyToken, checkRole(['admin', 'manager']), upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    const imageUrl = `/uploads/visual_processes/${req.file.filename}`;
    res.json({ url: imageUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listar todos os fluxos visuais
router.get('/visual-processes', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT id, title, created_at, updated_at FROM visual_processes WHERE status = 'active' ORDER BY updated_at DESC"
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

// Inativar fluxo visual
router.delete('/visual-processes/:id', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    await pool.execute("UPDATE visual_processes SET status = 'inactive' WHERE id = ?", [req.params.id]);
    res.json({ message: 'Fluxo inativado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
