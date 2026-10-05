import express from 'express';
import pool from '../config/database.js';
import { verifyToken, checkRole } from '../middlewares/auth.js';
import { loadTecnico, handle } from '../middlewares/estoqueAccess.js';
import { ServiceError } from '../services/estoqueService.js';

/* Cadastros do almoxarifado: técnicos, fornecedores e equipamentos (todos admin/estoque). */
export const tecnicosRouter = express.Router();
export const fornecedoresRouter = express.Router();
export const equipamentosRouter = express.Router();

for (const r of [tecnicosRouter, fornecedoresRouter, equipamentosRouter]) {
  r.use(verifyToken, loadTecnico, checkRole(['admin', 'estoque']));
}

const obrigatorio = (v, msg) => { if (!v || !String(v).trim()) throw new ServiceError(400, msg); };

/* ───── Técnicos ───── */
tecnicosRouter.get('/', handle(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT t.*, u.email AS usuario_email, u.name AS usuario_nome FROM tecnicos t
     LEFT JOIN users u ON u.id = t.usuario_id ORDER BY t.ativo DESC, t.nome`);
  res.json(rows);
}));

// usuários com perfil `tecnico` ainda sem vínculo
tecnicosRouter.get('/usuarios-disponiveis', handle(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email FROM users u
     WHERE u.role = 'tecnico' AND NOT EXISTS (SELECT 1 FROM tecnicos t WHERE t.usuario_id = u.id) ORDER BY u.name`);
  res.json(rows);
}));

const validarTecnico = async (b, id = null) => {
  obrigatorio(b.nome, 'Informe o nome');
  if (!['interno', 'terceirizado'].includes(b.tipo)) throw new ServiceError(400, 'Tipo deve ser interno ou terceirizado');
  if (b.usuario_id) {
    if (b.tipo === 'terceirizado') throw new ServiceError(400, 'Equipe terceirizada não possui login');
    const [[u]] = await pool.query('SELECT role FROM users WHERE id = ?', [b.usuario_id]);
    if (!u) throw new ServiceError(404, 'Usuário não encontrado');
    if (u.role !== 'tecnico') throw new ServiceError(400, 'O usuário vinculado precisa ter o perfil técnico');
    const [[dup]] = await pool.query('SELECT id FROM tecnicos WHERE usuario_id = ? AND id <> ?', [b.usuario_id, id || 0]);
    if (dup) throw new ServiceError(409, 'Este usuário já está vinculado a outro técnico');
  }
};

tecnicosRouter.post('/', handle(async (req, res) => {
  const b = req.body;
  await validarTecnico(b);
  const [r] = await pool.query('INSERT INTO tecnicos (nome, tipo, empresa, telefone, usuario_id) VALUES (?,?,?,?,?)',
    [b.nome.trim(), b.tipo, b.empresa || null, b.telefone || null, b.usuario_id || null]);
  res.status(201).json({ id: r.insertId });
}));

tecnicosRouter.put('/:id', handle(async (req, res) => {
  const b = req.body;
  await validarTecnico(b, Number(req.params.id));
  await pool.query('UPDATE tecnicos SET nome=?, tipo=?, empresa=?, telefone=?, usuario_id=?, ativo=? WHERE id=?',
    [b.nome.trim(), b.tipo, b.empresa || null, b.telefone || null, b.usuario_id || null, b.ativo === false ? 0 : 1, req.params.id]);
  res.json({ ok: true });
}));

/* ───── Fornecedores ───── */
fornecedoresRouter.get('/', handle(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM fornecedores ORDER BY ativo DESC, nome');
  res.json(rows);
}));
fornecedoresRouter.post('/', handle(async (req, res) => {
  obrigatorio(req.body.nome, 'Informe o nome');
  const [r] = await pool.query('INSERT INTO fornecedores (nome, cnpj, contato) VALUES (?,?,?)',
    [req.body.nome.trim(), req.body.cnpj || null, req.body.contato || null]);
  res.status(201).json({ id: r.insertId });
}));
fornecedoresRouter.put('/:id', handle(async (req, res) => {
  obrigatorio(req.body.nome, 'Informe o nome');
  await pool.query('UPDATE fornecedores SET nome=?, cnpj=?, contato=?, ativo=? WHERE id=?',
    [req.body.nome.trim(), req.body.cnpj || null, req.body.contato || null, req.body.ativo === false ? 0 : 1, req.params.id]);
  res.json({ ok: true });
}));

/* ───── Equipamentos e empréstimos ───── */
const CONDICOES = ['novo', 'bom', 'usado', 'defeito'];

equipamentosRouter.get('/', handle(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT e.*, em.id AS emprestimo_id, em.tecnico_id, t.nome AS tecnico_nome, em.saida_em
     FROM equipamentos e
     LEFT JOIN equipamento_emprestimos em ON em.equipamento_id = e.id AND em.devolucao_em IS NULL
     LEFT JOIN tecnicos t ON t.id = em.tecnico_id WHERE e.ativo = 1 ORDER BY e.nome`);
  res.json(rows);
}));
equipamentosRouter.post('/', handle(async (req, res) => {
  obrigatorio(req.body.nome, 'Informe o nome');
  const estado = CONDICOES.includes(req.body.estado) ? req.body.estado : 'bom';
  const [r] = await pool.query('INSERT INTO equipamentos (nome, patrimonio, estado) VALUES (?,?,?)',
    [req.body.nome.trim(), req.body.patrimonio || null, estado]);
  res.status(201).json({ id: r.insertId });
}));
equipamentosRouter.put('/:id', handle(async (req, res) => {
  obrigatorio(req.body.nome, 'Informe o nome');
  await pool.query('UPDATE equipamentos SET nome=?, patrimonio=?, estado=?, ativo=? WHERE id=?',
    [req.body.nome.trim(), req.body.patrimonio || null, CONDICOES.includes(req.body.estado) ? req.body.estado : 'bom',
     req.body.ativo === false ? 0 : 1, req.params.id]);
  res.json({ ok: true });
}));

equipamentosRouter.post('/:id/saida', handle(async (req, res) => {
  const { tecnico_id, condicao_saida } = req.body;
  const [[tec]] = await pool.query('SELECT ativo FROM tecnicos WHERE id = ?', [tecnico_id]);
  if (!tec || !tec.ativo) throw new ServiceError(400, 'Técnico/equipe inválido');
  const cond = CONDICOES.includes(condicao_saida) ? condicao_saida : 'bom';
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[eq]] = await conn.query('SELECT id FROM equipamentos WHERE id = ? AND ativo = 1 FOR UPDATE', [req.params.id]);
    if (!eq) throw new ServiceError(404, 'Equipamento não encontrado');
    const [[aberto]] = await conn.query(
      'SELECT id FROM equipamento_emprestimos WHERE equipamento_id = ? AND devolucao_em IS NULL', [eq.id]);
    if (aberto) throw new ServiceError(409, 'Equipamento já está emprestado');
    const [r] = await conn.query(
      'INSERT INTO equipamento_emprestimos (equipamento_id, tecnico_id, condicao_saida, criado_por) VALUES (?,?,?,?)',
      [eq.id, tecnico_id, cond, req.userId]);
    await conn.commit();
    res.status(201).json({ id: r.insertId });
  } catch (err) { await conn.rollback(); throw err; } finally { conn.release(); }
}));

equipamentosRouter.post('/:id/devolucao', handle(async (req, res) => {
  if (!CONDICOES.includes(req.body.condicao_devolucao)) throw new ServiceError(400, 'Informe a condição na devolução');
  const [r] = await pool.query(
    `UPDATE equipamento_emprestimos SET devolucao_em = NOW(), condicao_devolucao = ?
     WHERE equipamento_id = ? AND devolucao_em IS NULL`, [req.body.condicao_devolucao, req.params.id]);
  if (!r.affectedRows) throw new ServiceError(409, 'Equipamento não está emprestado');
  await pool.query('UPDATE equipamentos SET estado = ? WHERE id = ?', [req.body.condicao_devolucao, req.params.id]);
  res.json({ ok: true });
}));

equipamentosRouter.get('/:id/emprestimos', handle(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT em.*, t.nome AS tecnico_nome FROM equipamento_emprestimos em JOIN tecnicos t ON t.id = em.tecnico_id
     WHERE em.equipamento_id = ? ORDER BY em.id DESC LIMIT 100`, [req.params.id]);
  res.json(rows);
}));
