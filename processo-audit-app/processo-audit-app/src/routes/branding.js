import express from 'express';
import pool from '../config/database.js';
import { verifyToken, checkRole } from '../middlewares/auth.js';
import { logAudit } from '../middlewares/audit.js';

const router = express.Router();

// Obter configurações de branding
router.get('/branding', async (req, res) => {
  try {
    const [branding] = await pool.execute(
      'SELECT * FROM branding LIMIT 1'
    );

    if (branding.length === 0) {
      // Retornar padrões se não existir
      return res.json({
        company_name: 'Minha Empresa',
        logo_url: null,
        primary_color: '#0ba52b',
        secondary_color: '#bbf804',
        accent_color: '#274518',
        background_color: '#ffffff',
        favicon_url: null
      });
    }

    res.json(branding[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar branding (apenas admin)
router.put('/branding', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const {
      company_name,
      logo_url,
      primary_color,
      secondary_color,
      accent_color,
      background_color,
      favicon_url
    } = req.body;

    // Validar cores
    const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (primary_color && !colorRegex.test(primary_color)) {
      return res.status(400).json({ error: 'Cor primária inválida' });
    }
    if (secondary_color && !colorRegex.test(secondary_color)) {
      return res.status(400).json({ error: 'Cor secundária inválida' });
    }
    if (accent_color && !colorRegex.test(accent_color)) {
      return res.status(400).json({ error: 'Cor de destaque inválida' });
    }
    if (background_color && !colorRegex.test(background_color)) {
      return res.status(400).json({ error: 'Cor de fundo inválida' });
    }

    const [existingBranding] = await pool.execute('SELECT * FROM branding LIMIT 1');

    let result;
    const newData = {
      company_name,
      logo_url,
      primary_color,
      secondary_color,
      accent_color,
      background_color,
      favicon_url
    };

    if (existingBranding.length === 0) {
      // Inserir novo registro
      result = await pool.execute(
        `INSERT INTO branding 
         (company_name, logo_url, primary_color, secondary_color, accent_color, background_color, favicon_url, updated_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          company_name,
          logo_url,
          primary_color || '#0ba52b',
          secondary_color || '#bbf804',
          accent_color || '#274518',
          background_color || '#ffffff',
          favicon_url,
          req.userId
        ]
      );

      // Registrar auditoria
      await logAudit(0, req.userId, 'CREATE_BRANDING', null, newData, req);
    } else {
      // Atualizar registro existente
      await pool.execute(
        `UPDATE branding 
         SET company_name = ?, logo_url = ?, primary_color = ?, 
             secondary_color = ?, accent_color = ?, background_color = ?, 
             favicon_url = ?, updated_by = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          company_name || existingBranding[0].company_name,
          logo_url !== undefined ? logo_url : existingBranding[0].logo_url,
          primary_color || existingBranding[0].primary_color,
          secondary_color || existingBranding[0].secondary_color,
          accent_color || existingBranding[0].accent_color,
          background_color || existingBranding[0].background_color,
          favicon_url !== undefined ? favicon_url : existingBranding[0].favicon_url,
          req.userId,
          existingBranding[0].id
        ]
      );

      // Registrar auditoria
      await logAudit(0, req.userId, 'UPDATE_BRANDING', existingBranding[0], newData, req);
    }

    res.json({ message: 'Branding atualizado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obter histórico de alterações de branding (apenas admin)
router.get('/branding/audit', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const [logs] = await pool.execute(
      `SELECT a.*, u.name as user_name 
       FROM audit_logs a
       JOIN users u ON a.user_id = u.id
       WHERE a.action IN ('CREATE_BRANDING', 'UPDATE_BRANDING')
       ORDER BY a.timestamp DESC`
    );

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
