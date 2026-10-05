import pool from '../config/database.js';
import { ServiceError } from '../services/estoqueService.js';

// Atualiza o perfil a partir do banco (o JWT pode estar desatualizado) e, para
// perfil `tecnico`, resolve o registro de técnico vinculado (1:1 via tecnicos.usuario_id).
export const loadTecnico = async (req, res, next) => {
  try {
    const [[u]] = await pool.query('SELECT role FROM users WHERE id = ?', [req.userId]);
    if (!u) return res.status(401).json({ error: 'Usuário não encontrado' });
    req.userRole = u.role;
    req.tecnicoId = null;
    if (u.role === 'tecnico') {
      const [[t]] = await pool.query('SELECT id FROM tecnicos WHERE usuario_id = ? AND ativo = 1', [req.userId]);
      req.tecnicoId = t ? t.id : null;
    }
    next();
  } catch (err) {
    next(err);
  }
};

// Envolve handlers async e padroniza erros: { error: "mensagem em pt-BR" }
export const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    if (err instanceof ServiceError) return res.status(err.status).json({ error: err.message });
    if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED' || err.code === 'ER_CONSTRAINT_FAILED') {
      return res.status(400).json({ error: 'Operação violaria uma regra de integridade do estoque' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
