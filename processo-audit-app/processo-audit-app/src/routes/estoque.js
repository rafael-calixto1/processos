import express from 'express';
import pool from '../config/database.js';
import { verifyToken, checkRole } from '../middlewares/auth.js';
import { loadTecnico, handle } from '../middlewares/estoqueAccess.js';
import * as svc from '../services/estoqueService.js';

const router = express.Router();
router.use(verifyToken, loadTecnico);

const staff = checkRole(['admin', 'estoque']);
const SALDO_SQL = `COALESCE((SELECT SUM(l.saldo_atual) FROM estoque_lotes l WHERE l.item_id = i.id),0)`;

/* ───── Itens ───── */
router.get('/itens', staff, handle(async (req, res) => {
  const { q, status, categoria } = req.query;
  const where = ['i.ativo = 1'];
  const params = [];
  if (q) { where.push('i.nome LIKE ?'); params.push(`%${q}%`); }
  if (categoria) { where.push('i.categoria = ?'); params.push(categoria); }
  const [rows] = await pool.query(
    `SELECT i.*, ${SALDO_SQL} AS saldo,
       (SELECT COUNT(*) FROM estoque_lotes l WHERE l.item_id = i.id AND l.status = 'ativo') AS lotes_ativos,
       COALESCE((SELECT SUM(p.quantidade) FROM estoque_posse p JOIN estoque_lotes l ON l.id = p.lote_id WHERE l.item_id = i.id),0) AS em_posse
     FROM estoque_itens i WHERE ${where.join(' AND ')} ORDER BY i.nome`, params);
  let itens = rows.map((r) => ({ ...r, saldo: Number(r.saldo), em_posse: Number(r.em_posse),
    no_almoxarifado: Number(r.saldo) - Number(r.em_posse), status: svc.statusItem(r.saldo, r.estoque_minimo) }));
  if (status) itens = itens.filter((i) => i.status === String(status).toUpperCase());
  res.json(itens);
}));

const validarItem = (b) => {
  if (!b.nome || !String(b.nome).trim()) throw new svc.ServiceError(400, 'Informe o nome do item');
  if (!['metros', 'pecas'].includes(b.unidade)) throw new svc.ServiceError(400, 'Unidade deve ser metros ou peças');
  const min = Number(b.estoque_minimo ?? 0);
  if (!Number.isFinite(min) || min < 0) throw new svc.ServiceError(400, 'Estoque mínimo inválido');
  if (b.unidade === 'pecas' && !Number.isInteger(min)) throw new svc.ServiceError(400, 'Estoque mínimo de itens em unidades deve ser inteiro');
  return min;
};

router.post('/itens', staff, handle(async (req, res) => {
  const min = validarItem(req.body);
  const [r] = await pool.query(
    'INSERT INTO estoque_itens (nome, categoria, unidade, estoque_minimo) VALUES (?,?,?,?)',
    [req.body.nome.trim(), req.body.categoria || null, req.body.unidade, min]);
  res.status(201).json({ id: r.insertId });
}));

router.put('/itens/:id', staff, handle(async (req, res) => {
  const min = validarItem(req.body);
  const [[atual]] = await pool.query('SELECT unidade FROM estoque_itens WHERE id = ?', [req.params.id]);
  if (!atual) throw new svc.ServiceError(404, 'Item não encontrado');
  if (atual.unidade !== req.body.unidade) {
    const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM estoque_lotes WHERE item_id = ?', [req.params.id]);
    if (n > 0) throw new svc.ServiceError(409, 'Não é possível trocar a unidade de um item que já possui lotes');
  }
  await pool.query('UPDATE estoque_itens SET nome=?, categoria=?, unidade=?, estoque_minimo=?, ativo=? WHERE id=?',
    [req.body.nome.trim(), req.body.categoria || null, req.body.unidade, min, req.body.ativo === false ? 0 : 1, req.params.id]);
  res.json({ ok: true });
}));

router.get('/itens/:id', staff, handle(async (req, res) => {
  const [[item]] = await pool.query(`SELECT i.*, ${SALDO_SQL} AS saldo FROM estoque_itens i WHERE i.id = ?`, [req.params.id]);
  if (!item) throw new svc.ServiceError(404, 'Item não encontrado');
  const [lotes] = await pool.query(
    `SELECT l.*, COALESCE((SELECT SUM(p.quantidade) FROM estoque_posse p WHERE p.lote_id = l.id),0) AS em_posse
     FROM estoque_lotes l WHERE l.item_id = ? ORDER BY l.id DESC`, [req.params.id]);
  const [movs] = await pool.query(
    `SELECT m.*, l.codigo AS lote_codigo, t.nome AS tecnico_nome, u.name AS usuario_nome, o.numero AS os_numero
     FROM estoque_movimentacoes m JOIN estoque_lotes l ON l.id = m.lote_id
     LEFT JOIN tecnicos t ON t.id = m.tecnico_id LEFT JOIN users u ON u.id = m.criado_por
     LEFT JOIN ordens_servico o ON o.id = m.os_id
     WHERE m.item_id = ? ORDER BY m.id DESC LIMIT 200`, [req.params.id]);
  res.json({ ...item, saldo: Number(item.saldo), status: svc.statusItem(item.saldo, item.estoque_minimo),
    lotes: lotes.map((l) => ({ ...l, no_almoxarifado: Number(l.saldo_atual) - Number(l.em_posse) })), movimentacoes: movs });
}));

/* ───── Compras / Entradas ───── */
router.post('/compras', staff, handle(async (req, res) => {
  const out = await svc.criarCompra(req.body, req.userId);
  res.status(out.repetida ? 200 : 201).json(out);
}));

router.get('/compras', staff, handle(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.*, i.nome AS item_nome, i.unidade, f.nome AS fornecedor_nome, u.name AS usuario_nome
     FROM estoque_compras c JOIN estoque_itens i ON i.id = c.item_id
     LEFT JOIN fornecedores f ON f.id = c.fornecedor_id LEFT JOIN users u ON u.id = c.criado_por
     ORDER BY c.id DESC LIMIT 100`);
  res.json(rows);
}));

// Detalhe de uma compra (todas as linhas): lotes e onde está cada um (almoxarifado, com técnico, consumido)
router.get('/compras/detalhe', staff, handle(async (req, res) => {
  const ids = String(req.query.ids || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (!ids.length) return res.json([]);
  const [lotes] = await pool.query(
    `SELECT l.id, l.codigo, l.compra_id, l.item_id, l.saldo_inicial, l.saldo_atual, l.status, i.nome AS item_nome, i.unidade
     FROM estoque_lotes l JOIN estoque_itens i ON i.id = l.item_id WHERE l.compra_id IN (?) ORDER BY l.id`, [ids]);
  const [posse] = lotes.length ? await pool.query(
    `SELECT p.lote_id, p.quantidade, t.nome AS tecnico FROM estoque_posse p JOIN tecnicos t ON t.id = p.tecnico_id
     WHERE p.lote_id IN (?) AND p.quantidade > 0`, [lotes.map((l) => l.id)]) : [[]];
  res.json(lotes.map((l) => {
    const com = posse.filter((p) => p.lote_id === l.id).map((p) => ({ tecnico: p.tecnico, quantidade: Number(p.quantidade) }));
    const emPosse = com.reduce((a, p) => a + p.quantidade, 0);
    const atual = Number(l.saldo_atual); const inicial = Number(l.saldo_inicial);
    return { ...l, saldo_inicial: inicial, saldo_atual: atual, com_tecnicos: com,
      no_almoxarifado: Math.max(0, +(atual - emPosse).toFixed(2)), consumido: +(inicial - atual).toFixed(2) };
  }));
}));

router.get('/compras/:id/lotes', staff, handle(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT l.*, i.nome AS item_nome, i.unidade FROM estoque_lotes l JOIN estoque_itens i ON i.id = l.item_id
     WHERE l.compra_id = ? ORDER BY l.id`, [req.params.id]);
  res.json(rows);
}));

/* ───── Patrimônio: consulta de lotes por nome, lote, categoria ou automático, com filtros de local e status ───── */
const termosNome = (q) => String(q || '').trim().split(/\s+/).filter(Boolean).slice(0, 6);
const TIPOS_BUSCA = ['nome', 'lote', 'categoria', 'auto'];

// Sugestões a partir de 3 letras, conforme o tipo de busca
router.get('/patrimonio/sugestoes', staff, handle(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 3) return res.json([]);
  const tipo = TIPOS_BUSCA.includes(req.query.tipo) ? req.query.tipo : 'auto';
  const like = `%${q}%`; const termos = termosNome(q);
  const out = [];
  if (tipo === 'lote' || tipo === 'auto') {
    const [r] = await pool.query(
      `SELECT l.codigo AS valor, i.nome AS detalhe FROM estoque_lotes l JOIN estoque_itens i ON i.id = l.item_id
       WHERE l.codigo LIKE ? ORDER BY l.codigo LIMIT 8`, [like]);
    out.push(...r.map((x) => ({ ...x, tipo: 'lote' })));
  }
  if (tipo === 'nome' || tipo === 'auto') {
    const [r] = await pool.query(
      `SELECT i.nome AS valor, i.categoria AS detalhe FROM estoque_itens i
       WHERE i.ativo = 1 AND ${termos.map(() => 'i.nome LIKE ?').join(' AND ')} ORDER BY i.nome LIMIT 8`, termos.map((t) => `%${t}%`));
    out.push(...r.map((x) => ({ ...x, tipo: 'nome' })));
  }
  if (tipo === 'categoria') {
    const [r] = await pool.query(
      'SELECT DISTINCT categoria AS valor FROM estoque_itens WHERE ativo = 1 AND categoria LIKE ? ORDER BY categoria LIMIT 8', [like]);
    out.push(...r.map((x) => ({ ...x, detalhe: 'Categoria', tipo: 'categoria' })));
  }
  res.json(out.slice(0, 10));
}));

router.get('/patrimonio', staff, handle(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const tipo = TIPOS_BUSCA.includes(req.query.tipo) ? req.query.tipo : 'nome';
  const { local = '', status = '' } = req.query;
  if (q && q.length < 3) throw new svc.ServiceError(400, 'Digite ao menos 3 caracteres');
  const POSSE = '(SELECT COALESCE(SUM(p.quantidade),0) FROM estoque_posse p WHERE p.lote_id = l.id)';
  const where = ['i.ativo = 1']; const params = [];
  if (q) {
    const termos = termosNome(q);
    const nome = () => { where.push(...termos.map(() => 'i.nome LIKE ?')); params.push(...termos.map((t) => `%${t}%`)); };
    if (tipo === 'lote') { where.push('l.codigo LIKE ?'); params.push(`%${q}%`); }
    else if (tipo === 'categoria') { where.push('i.categoria LIKE ?'); params.push(`%${q}%`); }
    else if (tipo === 'auto') {
      where.push(`(l.codigo LIKE ? OR i.categoria LIKE ? OR (${termos.map(() => 'i.nome LIKE ?').join(' AND ')}))`);
      params.push(`%${q}%`, `%${q}%`, ...termos.map((t) => `%${t}%`));
    } else nome();
  }
  if (local === 'almoxarifado') where.push(`(l.saldo_atual - ${POSSE}) > 0`);
  else if (local === 'tecnicos') where.push(`${POSSE} > 0`);
  else if (/^tec:\d+$/.test(local)) { where.push('EXISTS (SELECT 1 FROM estoque_posse p WHERE p.lote_id = l.id AND p.tecnico_id = ? AND p.quantidade > 0)'); params.push(Number(local.slice(4))); }
  if (status === 'com_saldo') where.push('l.saldo_atual > 0');
  else if (status === 'esgotado') where.push('l.saldo_atual = 0');

  const [lotes] = await pool.query(
    `SELECT l.id, l.codigo, l.item_id, l.saldo_inicial, l.saldo_atual, l.status, l.criado_em,
       i.nome AS item_nome, i.unidade, i.categoria, i.estoque_minimo
     FROM estoque_lotes l JOIN estoque_itens i ON i.id = l.item_id
     WHERE ${where.join(' AND ')} ORDER BY i.nome, l.id LIMIT 500`, params);
  const [posse] = lotes.length ? await pool.query(
    `SELECT p.lote_id, p.tecnico_id, p.quantidade, t.nome AS tecnico FROM estoque_posse p JOIN tecnicos t ON t.id = p.tecnico_id
     WHERE p.lote_id IN (?) AND p.quantidade > 0`, [lotes.map((l) => l.id)]) : [[]];
  res.json(lotes.map((l) => {
    const com = posse.filter((p) => p.lote_id === l.id).map((p) => ({ tecnico_id: p.tecnico_id, tecnico: p.tecnico, quantidade: Number(p.quantidade) }));
    const emPosse = com.reduce((a, p) => a + p.quantidade, 0); const atual = Number(l.saldo_atual);
    return { ...l, saldo_inicial: Number(l.saldo_inicial), saldo_atual: atual, estoque_minimo: Number(l.estoque_minimo),
      com_tecnicos: com, no_almoxarifado: Math.max(0, +(atual - emPosse).toFixed(2)) };
  }));
}));

/* ───── Lotes ───── */
// Consulta por código (scan/digitação). Técnico só enxerga lote que está com ele.
// Histórico de movimentações de um lote (staff)
router.get('/lotes/:id/historico', staff, handle(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT m.id, m.tipo, m.quantidade, m.condicao, m.observacao, m.criado_em, t.nome AS tecnico_nome, u.name AS usuario_nome, o.numero AS os_numero
     FROM estoque_movimentacoes m LEFT JOIN tecnicos t ON t.id = m.tecnico_id LEFT JOIN users u ON u.id = m.criado_por
     LEFT JOIN ordens_servico o ON o.id = m.os_id WHERE m.lote_id = ? ORDER BY m.id DESC`, [Number(req.params.id) || 0]);
  res.json(rows);
}));

router.get('/lotes/:codigo', handle(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT l.*, i.nome AS item_nome, i.unidade,
       COALESCE((SELECT SUM(p.quantidade) FROM estoque_posse p WHERE p.lote_id = l.id),0) AS em_posse
     FROM estoque_lotes l JOIN estoque_itens i ON i.id = l.item_id WHERE l.codigo = ?`, [svc.normalizarCodigo(req.params.codigo)]);
  if (!rows.length) throw new svc.ServiceError(404, 'Lote não encontrado');
  const lote = rows[0];
  const [posse] = await pool.query(
    `SELECT p.tecnico_id, p.quantidade, t.nome AS tecnico_nome FROM estoque_posse p
     JOIN tecnicos t ON t.id = p.tecnico_id WHERE p.lote_id = ? AND p.quantidade > 0`, [lote.id]);
  if (req.userRole === 'tecnico') {
    const minha = posse.find((p) => p.tecnico_id === req.tecnicoId);
    if (!minha) throw new svc.ServiceError(403, 'Este lote não está em sua posse');
    return res.json({ ...lote, em_posse: undefined, minha_posse: Number(minha.quantidade) });
  }
  res.json({ ...lote, em_posse: Number(lote.em_posse), no_almoxarifado: Number(lote.saldo_atual) - Number(lote.em_posse), posse });
}));

router.put('/lotes/:id', staff, handle(async (req, res) => {
  res.json(await svc.editarLote({ lote_id: req.params.id, codigo: req.body.codigo }));
}));
router.post('/lotes/:id/descartar', staff, handle(async (req, res) => {
  res.json(await svc.descartarLote({ lote_id: req.params.id, ...req.body }, req.userId));
}));
router.delete('/lotes/:id', staff, handle(async (req, res) => {
  res.json(await svc.excluirLote({ lote_id: req.params.id }));
}));

/* ───── Retirada / Devolução ───── */
router.post('/retiradas', staff, handle(async (req, res) => {
  res.status(201).json(await svc.retirar(req.body, req.userId));
}));

router.post('/devolucoes', handle(async (req, res) => {
  const body = { ...req.body };
  if (req.userRole === 'tecnico') {
    // técnico só solicita; a devolução só é efetivada quando admin/estoque aprovar
    if (!req.tecnicoId) throw new svc.ServiceError(403, 'Seu usuário não está vinculado a um técnico');
    body.tecnico_id = req.tecnicoId;
    return res.status(201).json(await svc.solicitarDevolucao(body, req.userId));
  }
  if (!['admin', 'estoque'].includes(req.userRole)) throw new svc.ServiceError(403, 'Acesso negado');
  res.status(201).json(await svc.devolver(body, req.userId));
}));

const DEV_SQL = `SELECT d.id, d.lote_id, d.quantidade, d.condicao, d.observacao, d.status, d.solicitado_em, d.revisado_em, d.motivo_negacao,
    l.codigo AS lote_codigo, i.id AS item_id, i.nome AS item_nome, i.unidade, t.id AS tecnico_id, t.nome AS tecnico_nome,
    ur.name AS revisor_nome
  FROM estoque_devolucoes d JOIN estoque_lotes l ON l.id = d.lote_id JOIN estoque_itens i ON i.id = d.item_id
  JOIN tecnicos t ON t.id = d.tecnico_id LEFT JOIN users ur ON ur.id = d.revisado_por`;

// Lista de solicitações: técnico vê as dele; admin/estoque veem todas (filtro ?status=pendente|aprovada|negada)
router.get('/devolucoes', handle(async (req, res) => {
  const where = [];
  const params = [];
  if (req.userRole === 'tecnico') {
    if (!req.tecnicoId) return res.json([]);
    where.push('d.tecnico_id = ?'); params.push(req.tecnicoId);
  } else if (!['admin', 'estoque'].includes(req.userRole)) throw new svc.ServiceError(403, 'Acesso negado');
  if (['pendente', 'aprovada', 'negada'].includes(req.query.status)) { where.push('d.status = ?'); params.push(req.query.status); }
  const [rows] = await pool.query(
    `${DEV_SQL} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY (d.status = 'pendente') DESC, d.id DESC LIMIT 300`, params);
  res.json(rows.map((r) => ({ ...r, quantidade: Number(r.quantidade) })));
}));

router.post('/devolucoes/:id/aprovar', staff, handle(async (req, res) => {
  res.json(await svc.aprovarDevolucao({ id: req.params.id, condicao: req.body?.condicao }, req.userId));
}));

router.post('/devolucoes/:id/negar', staff, handle(async (req, res) => {
  res.json(await svc.negarDevolucao({ id: req.params.id, motivo: req.body?.motivo }, req.userId));
}));

/* ───── Posse ───── */
const posseDe = async (tecnico_id) => {
  const [rows] = await pool.query(
    `SELECT p.lote_id, l.codigo AS lote_codigo, i.id AS item_id, i.nome AS item_nome, i.unidade, p.quantidade
     FROM estoque_posse p JOIN estoque_lotes l ON l.id = p.lote_id JOIN estoque_itens i ON i.id = l.item_id
     WHERE p.tecnico_id = ? AND p.quantidade > 0 ORDER BY i.nome, l.codigo`, [tecnico_id]);
  return rows.map((r) => ({ ...r, quantidade: Number(r.quantidade) }));
};

router.get('/posse/minha', handle(async (req, res) => {
  if (!req.tecnicoId) throw new svc.ServiceError(403, 'Seu usuário não está vinculado a um técnico');
  res.json(await posseDe(req.tecnicoId));
}));

router.get('/posse', staff, handle(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT t.id, t.nome, t.tipo, t.empresa,
       COUNT(DISTINCT p.lote_id) AS lotes,
       COALESCE(SUM(CASE WHEN i.unidade='metros' THEN p.quantidade END),0) AS metros,
       COALESCE(SUM(CASE WHEN i.unidade='pecas' THEN p.quantidade END),0) AS pecas
     FROM tecnicos t
     LEFT JOIN estoque_posse p ON p.tecnico_id = t.id AND p.quantidade > 0
     LEFT JOIN estoque_lotes l ON l.id = p.lote_id LEFT JOIN estoque_itens i ON i.id = l.item_id
     WHERE t.ativo = 1 GROUP BY t.id ORDER BY t.nome`);
  res.json(rows.map((r) => ({ ...r, metros: Number(r.metros), pecas: Number(r.pecas) })));
}));

router.get('/posse/:tecnicoId', staff, handle(async (req, res) => {
  const [[tec]] = await pool.query('SELECT * FROM tecnicos WHERE id = ?', [req.params.tecnicoId]);
  if (!tec) throw new svc.ServiceError(404, 'Técnico não encontrado');
  const [os] = await pool.query(
    'SELECT id, numero, cliente, status, prazo FROM ordens_servico WHERE tecnico_id = ? ORDER BY id DESC LIMIT 50', [tec.id]);
  const [historico] = await pool.query(
    `SELECT m.id, m.tipo, m.quantidade, m.condicao, m.criado_em, l.codigo AS lote_codigo, i.nome AS item_nome, i.unidade, o.numero AS os_numero
     FROM estoque_movimentacoes m JOIN estoque_lotes l ON l.id = m.lote_id JOIN estoque_itens i ON i.id = m.item_id
     LEFT JOIN ordens_servico o ON o.id = m.os_id WHERE m.tecnico_id = ? ORDER BY m.id DESC LIMIT 100`, [tec.id]);
  res.json({ tecnico: tec, itens: await posseDe(tec.id), os, historico });
}));

export default router;
