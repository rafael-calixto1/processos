import express from 'express';
import pool from '../config/database.js';
import { verifyToken, checkRole } from '../middlewares/auth.js';
import { loadTecnico, handle } from '../middlewares/estoqueAccess.js';
import { statusItem } from '../services/estoqueService.js';

const router = express.Router();
router.use(verifyToken, loadTecnico, checkRole(['admin', 'estoque']));

// consumo líquido = baixas - estornos
const LIQ = `SUM(CASE m.tipo WHEN 'baixa_os' THEN m.quantidade WHEN 'estorno' THEN -m.quantidade ELSE 0 END)`;

router.get('/uso', handle(async (req, res) => {
  const { de, ate, tecnico_id, tipo } = req.query; // tipo = interno|terceirizado ("equipe")
  const where = [`m.tipo IN ('baixa_os','estorno')`];
  const params = [];
  if (de) { where.push('m.criado_em >= ?'); params.push(`${de} 00:00:00`); }
  if (ate) { where.push('m.criado_em <= ?'); params.push(`${ate} 23:59:59`); }
  if (tecnico_id) { where.push('m.tecnico_id = ?'); params.push(tecnico_id); }
  if (tipo) { where.push('t.tipo = ?'); params.push(tipo); }
  const W = where.join(' AND ');
  const base = `FROM estoque_movimentacoes m JOIN estoque_itens i ON i.id = m.item_id
                LEFT JOIN tecnicos t ON t.id = m.tecnico_id LEFT JOIN ordens_servico o ON o.id = m.os_id WHERE ${W}`;
  const split = `COALESCE(SUM(CASE WHEN i.unidade='metros' THEN CASE m.tipo WHEN 'baixa_os' THEN m.quantidade ELSE -m.quantidade END END),0) AS metros,
                 COALESCE(SUM(CASE WHEN i.unidade='pecas'  THEN CASE m.tipo WHEN 'baixa_os' THEN m.quantidade ELSE -m.quantidade END END),0) AS pecas`;

  const [porTecnico] = await pool.query(`SELECT t.id, t.nome, t.tipo, ${split} ${base} GROUP BY t.id ORDER BY metros DESC, pecas DESC`, params);
  const [porOS] = await pool.query(`SELECT o.id, o.numero, o.cliente, ${split} ${base} GROUP BY o.id ORDER BY o.numero DESC LIMIT 50`, params);
  const [porItem] = await pool.query(`SELECT i.id, i.nome, i.unidade, ${LIQ} AS total ${base} GROUP BY i.id ORDER BY total DESC LIMIT 20`, params);
  const num = (rows) => rows.map((r) => ({ ...r, ...(r.metros !== undefined && { metros: Number(r.metros), pecas: Number(r.pecas) }), ...(r.total !== undefined && { total: Number(r.total) }) }));

  const [[k]] = await pool.query(
    `SELECT (SELECT COUNT(*) FROM estoque_itens WHERE ativo=1) AS total_itens,
            (SELECT COUNT(*) FROM estoque_lotes WHERE status='ativo' AND saldo_atual > 0) AS lotes_ativos,
            (SELECT COALESCE(SUM(p.quantidade),0) FROM estoque_posse p) AS em_posse,
            (SELECT COUNT(*) FROM ordens_servico WHERE status='aberta') AS os_abertas,
            (SELECT COUNT(*) FROM ordens_servico WHERE status='em_andamento') AS os_andamento`);

  const [itens] = await pool.query(
    `SELECT i.id, i.nome, i.unidade, i.estoque_minimo,
       COALESCE((SELECT SUM(l.saldo_atual) FROM estoque_lotes l WHERE l.item_id = i.id),0) AS saldo
     FROM estoque_itens i WHERE i.ativo = 1`);
  const alertas = itens.map((i) => ({ ...i, saldo: Number(i.saldo), status: statusItem(i.saldo, i.estoque_minimo) }))
    .filter((i) => i.status !== 'OK').sort((a, b) => a.saldo - b.saldo);

  res.json({
    kpis: { total_itens: k.total_itens, itens_baixos: alertas.length, lotes_ativos: k.lotes_ativos,
            em_posse: Number(k.em_posse), os_abertas: k.os_abertas, os_andamento: k.os_andamento },
    alertas, por_tecnico: num(porTecnico), por_os: num(porOS), por_item: num(porItem),
  });
}));

export default router;
