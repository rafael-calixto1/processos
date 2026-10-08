import express from 'express';
import pool from '../config/database.js';
import { verifyToken, checkRole } from '../middlewares/auth.js';
import { loadTecnico, handle } from '../middlewares/estoqueAccess.js';
import * as svc from '../services/estoqueService.js';

const router = express.Router();
router.use(verifyToken, loadTecnico, checkRole(['admin', 'estoque', 'tecnico']));

const staff = checkRole(['admin', 'estoque']);
const actorOf = (req) => ({ id: req.userId, role: req.userRole, tecnicoId: req.tecnicoId });

const carregarOS = async (req) => {
  const [[os]] = await pool.query(
    `SELECT o.*, t.nome AS tecnico_nome, t.empresa AS tecnico_empresa, u.name AS criado_por_nome
     FROM ordens_servico o JOIN tecnicos t ON t.id = o.tecnico_id LEFT JOIN users u ON u.id = o.criado_por
     WHERE o.id = ?`, [req.params.id]);
  if (!os) throw new svc.ServiceError(404, 'OS não encontrada');
  svc.assertAcessoOS(os, actorOf(req));
  return os;
};

router.get('/', handle(async (req, res) => {
  const where = [];
  const params = [];
  if (req.userRole === 'tecnico') {
    if (!req.tecnicoId) throw new svc.ServiceError(403, 'Seu usuário não está vinculado a um técnico');
    where.push('o.tecnico_id = ?'); params.push(req.tecnicoId);
  } else if (req.query.tecnico_id) { where.push('o.tecnico_id = ?'); params.push(req.query.tecnico_id); }
  if (req.query.status) { where.push('o.status = ?'); params.push(req.query.status); }
  const [rows] = await pool.query(
    `SELECT o.id, o.numero, o.cliente, o.endereco, o.tipo_execucao, o.prazo, o.prioridade, o.status, o.criado_em,
       o.tipo_servico, o.bairro, o.cidade, o.latitude, o.longitude, o.pop_nome, o.rota_id, o.poste_id,
       t.nome AS tecnico_nome,
       EXISTS(SELECT 1 FROM os_rascunhos r WHERE r.os_id = o.id) AS tem_rascunho
     FROM ordens_servico o JOIN tecnicos t ON t.id = o.tecnico_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY o.id DESC LIMIT 300`, params);
  res.json(rows);
}));

router.post('/', staff, handle(async (req, res) => {
  res.status(201).json(await svc.criarOS(req.body, req.userId));
}));

// tipos de serviço (lista editável pelo staff)
router.get('/tipos-servico', handle(async (req, res) => {
  const [rows] = await pool.query('SELECT id, nome FROM os_tipos_servico ORDER BY nome');
  res.json(rows);
}));
router.post('/tipos-servico', staff, handle(async (req, res) => {
  const nome = String(req.body.nome || '').trim().replace(/\s+/g, ' ');
  if (nome.length < 2 || nome.length > 60) throw new svc.ServiceError(400, 'Informe um nome de 2 a 60 caracteres');
  await pool.query('INSERT IGNORE INTO os_tipos_servico (nome) VALUES (?)', [nome]);
  const [[row]] = await pool.query('SELECT id, nome FROM os_tipos_servico WHERE nome = ?', [nome]);
  res.status(201).json(row);
}));

// sugestões de serviços já lançados (autocompletar)
router.get('/servicos/sugestoes', handle(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT descricao, COUNT(*) AS n FROM os_servicos GROUP BY descricao ORDER BY n DESC, descricao LIMIT 40');
  res.json(rows.map((r) => r.descricao));
}));

router.get('/:id', handle(async (req, res) => {
  const os = await carregarOS(req);
  const [materiais] = await pool.query(
    `SELECT m.id, m.servico_id, m.quantidade, m.criado_em, m.observacao, l.codigo AS lote_codigo, i.nome AS item_nome, i.unidade,
       u.name AS usuario_nome,
       (SELECT e.id FROM estoque_movimentacoes e WHERE e.estorno_de_id = m.id) AS estorno_id
     FROM estoque_movimentacoes m JOIN estoque_lotes l ON l.id = m.lote_id JOIN estoque_itens i ON i.id = m.item_id
     LEFT JOIN users u ON u.id = m.criado_por
     WHERE m.os_id = ? AND m.tipo = 'baixa_os' ORDER BY m.id`, [os.id]);
  const [historico] = await pool.query(
    `SELECT h.*, u.name AS usuario_nome FROM os_historico_status h LEFT JOIN users u ON u.id = h.usuario_id
     WHERE h.os_id = ? ORDER BY h.id`, [os.id]);
  const [servicos] = await pool.query(
    `SELECT sv.id, sv.descricao, sv.trecho, sv.quantidade, sv.criado_em, u.name AS usuario_nome
     FROM os_servicos sv LEFT JOIN users u ON u.id = sv.criado_por WHERE sv.os_id = ? ORDER BY sv.id`, [os.id]);
  const totais = { metros: 0, pecas: 0 };
  for (const m of materiais) if (!m.estorno_id) totais[m.unidade === 'metros' ? 'metros' : 'pecas'] += Number(m.quantidade);
  res.json({ ...os, materiais, servicos: servicos.map((x) => ({ ...x, quantidade: Number(x.quantidade) })), historico, totais });
}));

router.put('/:id', staff, handle(async (req, res) => {
  const os = await carregarOS(req);
  if (['concluida', 'cancelada'].includes(os.status)) throw new svc.ServiceError(409, 'OS encerrada é somente leitura');
  const b = req.body;
  if (!b.cliente || !String(b.cliente).trim()) throw new svc.ServiceError(400, 'Informe o cliente');
  let numero = os.numero;
  if (b.numero !== undefined && Number(b.numero) !== os.numero) {
    if (req.userRole !== 'admin') throw new svc.ServiceError(403, 'Somente o administrador altera o número da OS');
    numero = Number(b.numero);
    if (!Number.isInteger(numero) || numero <= 0) throw new svc.ServiceError(400, 'Número inválido');
  }
  await pool.query(
    `UPDATE ordens_servico SET numero=?, cliente=?, endereco=?, prazo=?, prioridade=?, descricao=?,
       tipo_servico=?, cep=?, logradouro=?, numero_endereco=?, complemento=?, bairro=?, cidade=?, uf=?, latitude=?, longitude=?, pop_nome=?, rota_id=?, poste_id=? WHERE id=?`,
    [numero, b.cliente.trim(), b.endereco || null, b.prazo || null, b.prioridade || os.prioridade, b.descricao || null,
     ...Object.values(svc.camposInfraOS(b)), os.id]);
  res.json({ ok: true });
}));

router.post('/:id/materiais', handle(async (req, res) => {
  res.status(201).json(await svc.baixarEmOS({ ...req.body, os_id: Number(req.params.id) }, actorOf(req)));
}));

router.post('/:id/lancamentos', handle(async (req, res) => {
  res.status(201).json(await svc.lancarServicoComMateriais({ ...req.body, os_id: Number(req.params.id) }, actorOf(req)));
}));

router.post('/:id/servicos', handle(async (req, res) => {
  res.status(201).json(await svc.adicionarServico({ ...req.body, os_id: Number(req.params.id) }, actorOf(req)));
}));

router.delete('/:id/servicos/:servicoId', handle(async (req, res) => {
  res.json(await svc.removerServico({ os_id: Number(req.params.id), servico_id: Number(req.params.servicoId) }, actorOf(req)));
}));

router.post('/:id/fechar', handle(async (req, res) => {
  const r = await svc.fecharOS({ os_id: Number(req.params.id) }, actorOf(req));
  await pool.query('DELETE FROM os_rascunhos WHERE os_id = ?', [Number(req.params.id)]);
  res.json(r);
}));

// Rascunho da finalização em campo (progresso salvo no banco)
router.get('/:id/rascunho', handle(async (req, res) => {
  const os = await carregarOS(req);
  const [[r]] = await pool.query('SELECT dados FROM os_rascunhos WHERE os_id = ?', [os.id]);
  res.json({ rascunho: r ? JSON.parse(r.dados) : null });
}));

router.put('/:id/rascunho', handle(async (req, res) => {
  const os = await carregarOS(req);
  if (['concluida', 'cancelada'].includes(os.status)) throw new svc.ServiceError(409, 'OS encerrada é somente leitura');
  if (!req.body || typeof req.body.rascunho !== 'object' || req.body.rascunho === null) throw new svc.ServiceError(400, 'Rascunho inválido');
  await pool.query(
    `INSERT INTO os_rascunhos (os_id, dados, atualizado_por) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE dados = VALUES(dados), atualizado_por = VALUES(atualizado_por)`,
    [os.id, JSON.stringify(req.body.rascunho), req.userId]);
  res.json({ ok: true });
}));

router.post('/:id/cancelar', staff, handle(async (req, res) => {
  res.json(await svc.cancelarOS({ os_id: Number(req.params.id) }, req.userId));
}));

router.post('/:id/estornos', staff, handle(async (req, res) => {
  const [[mov]] = await pool.query('SELECT os_id FROM estoque_movimentacoes WHERE id = ?', [req.body.movimentacao_id]);
  if (!mov || mov.os_id !== Number(req.params.id)) throw new svc.ServiceError(404, 'Baixa não encontrada nesta OS');
  res.status(201).json(await svc.estornarBaixa(req.body, req.userId));
}));

export default router;
