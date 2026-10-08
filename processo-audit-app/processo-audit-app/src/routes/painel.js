import express from 'express';
import pool from '../config/database.js';
import { verifyToken, checkRole } from '../middlewares/auth.js';
import { loadTecnico, handle } from '../middlewares/estoqueAccess.js';
import { statusItem, ServiceError } from '../services/estoqueService.js';

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

/* ───────── Helpers de período ───────── */
const iso = (d) => d.toISOString().slice(0, 10);
const addDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
// período padrão: últimos 30 dias; o período anterior tem a mesma duração (comparação justa)
function periodo(q) {
  const ate = q.ate ? new Date(`${q.ate}T00:00:00`) : new Date(new Date().toDateString());
  const de = q.de ? new Date(`${q.de}T00:00:00`) : addDias(ate, -29);
  const dias = Math.max(1, Math.round((ate - de) / 86400000) + 1);
  return { de: iso(de), ate: iso(ate), dePrev: iso(addDias(de, -dias)), atePrev: iso(addDias(de, -1)), dias };
}
// preenche dias sem movimento com zero (série contínua, sem "buracos" enganosos)
function serieContinua(p, rows, campos) {
  const mapa = new Map(rows.map((r) => [String(r.dia).slice(0, 10), r]));
  const out = [];
  for (let i = 0; i < p.dias; i++) {
    const dia = iso(addDias(new Date(`${p.de}T00:00:00`), i));
    const r = mapa.get(dia) || {};
    out.push({ dia, ...Object.fromEntries(campos.map((c) => [c, Number(r[c] || 0)])) });
  }
  return out;
}
const N = (v) => Number(v || 0);

/* ───────── Painel de ESTOQUE por técnico/equipe ───────── */
async function estoqueDoTecnico(tid, p) {
  const intervalo = (a, b) => [tid, `${a} 00:00:00`, `${b} 23:59:59`];
  const sinal = `CASE m.tipo WHEN 'baixa_os' THEN m.quantidade WHEN 'estorno' THEN -m.quantidade ELSE 0 END`;
  const [[tec]] = await pool.query('SELECT id, nome, tipo, empresa FROM tecnicos WHERE id = ?', [tid]);
  if (!tec) throw new ServiceError('Técnico não encontrado', 404);

  const consumo = async (a, b) => {
    const [[r]] = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN i.unidade='metros' THEN ${sinal} END),0) AS metros,
              COALESCE(SUM(CASE WHEN i.unidade='pecas'  THEN ${sinal} END),0) AS pecas
       FROM estoque_movimentacoes m JOIN estoque_itens i ON i.id = m.item_id
       WHERE m.tecnico_id = ? AND m.tipo IN ('baixa_os','estorno') AND m.criado_em BETWEEN ? AND ?`, intervalo(a, b));
    return { metros: N(r.metros), pecas: N(r.pecas) };
  };
  const [atual, anterior] = await Promise.all([consumo(p.de, p.ate), consumo(p.dePrev, p.atePrev)]);

  const [serieRows] = await pool.query(
    `SELECT DATE(m.criado_em) AS dia,
            SUM(CASE WHEN i.unidade='metros' THEN ${sinal} END) AS consumo_metros,
            SUM(CASE WHEN i.unidade='pecas'  THEN ${sinal} END) AS consumo_pecas,
            SUM(CASE WHEN m.tipo='retirada' AND i.unidade='metros' THEN m.quantidade END) AS entrada_metros,
            SUM(CASE WHEN m.tipo='retirada' AND i.unidade='pecas'  THEN m.quantidade END) AS entrada_pecas
     FROM estoque_movimentacoes m JOIN estoque_itens i ON i.id = m.item_id
     WHERE m.tecnico_id = ? AND m.criado_em BETWEEN ? AND ? GROUP BY DATE(m.criado_em)`, intervalo(p.de, p.ate));
  const serie = serieContinua(p, serieRows, ['consumo_metros', 'consumo_pecas', 'entrada_metros', 'entrada_pecas']);

  const [posse] = await pool.query(
    `SELECT i.id, i.nome, i.unidade, SUM(p.quantidade) AS quantidade, COUNT(*) AS lotes
     FROM estoque_posse p JOIN estoque_lotes l ON l.id = p.lote_id JOIN estoque_itens i ON i.id = l.item_id
     WHERE p.tecnico_id = ? AND p.quantidade > 0 GROUP BY i.id ORDER BY quantidade DESC`, [tid]);
  const [porItem] = await pool.query(
    `SELECT i.id, i.nome, i.unidade, SUM(${sinal}) AS total
     FROM estoque_movimentacoes m JOIN estoque_itens i ON i.id = m.item_id
     WHERE m.tecnico_id = ? AND m.tipo IN ('baixa_os','estorno') AND m.criado_em BETWEEN ? AND ?
     GROUP BY i.id HAVING total <> 0 ORDER BY total DESC LIMIT 20`, intervalo(p.de, p.ate));
  const [porOS] = await pool.query(
    `SELECT o.id, o.numero, o.cliente,
       COALESCE(SUM(CASE WHEN i.unidade='metros' THEN ${sinal} END),0) AS metros,
       COALESCE(SUM(CASE WHEN i.unidade='pecas'  THEN ${sinal} END),0) AS pecas
     FROM estoque_movimentacoes m JOIN estoque_itens i ON i.id = m.item_id JOIN ordens_servico o ON o.id = m.os_id
     WHERE m.tecnico_id = ? AND m.tipo IN ('baixa_os','estorno') AND m.criado_em BETWEEN ? AND ?
     GROUP BY o.id ORDER BY o.numero DESC LIMIT 50`, intervalo(p.de, p.ate));
  const [[dev]] = await pool.query(
    `SELECT COUNT(*) AS pendentes, COALESCE(MAX(TIMESTAMPDIFF(DAY, solicitado_em, NOW())),0) AS mais_antiga_dias
     FROM estoque_devolucoes WHERE status='pendente' AND tecnico_id = ?`, [tid]);
  const [[os]] = await pool.query(
    `SELECT COALESCE(SUM(status IN ('aberta','em_andamento')),0) AS abertas FROM ordens_servico WHERE tecnico_id = ?`, [tid]);

  const soma = (u) => posse.filter((x) => x.unidade === u).reduce((a, x) => a + N(x.quantidade), 0);
  return {
    periodo: p, tecnico: tec,
    kpis: { posse_metros: soma('metros'), posse_pecas: soma('pecas'), os_abertas: N(os.abertas),
            devolucoes_pendentes: dev.pendentes, devolucao_mais_antiga_dias: N(dev.mais_antiga_dias) },
    consumo: { atual, anterior }, serie,
    posse: posse.map((x) => ({ ...x, quantidade: N(x.quantidade) })),
    por_item: porItem.map((x) => ({ ...x, total: N(x.total) })),
    por_os: porOS.map((x) => ({ ...x, metros: N(x.metros), pecas: N(x.pecas) })),
  };
}

/* ───────── Painel de ESTOQUE ───────── */
router.get('/estoque', handle(async (req, res) => {
  const p = periodo(req.query);
  if (req.query.tecnico_id) return res.json(await estoqueDoTecnico(Number(req.query.tecnico_id), p));
  const intervalo = (a, b) => [`${a} 00:00:00`, `${b} 23:59:59`];
  const sinal = `CASE m.tipo WHEN 'baixa_os' THEN m.quantidade WHEN 'estorno' THEN -m.quantidade ELSE 0 END`;

  const consumo = async (a, b) => {
    const [[r]] = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN i.unidade='metros' THEN ${sinal} END),0) AS metros,
              COALESCE(SUM(CASE WHEN i.unidade='pecas'  THEN ${sinal} END),0) AS pecas
       FROM estoque_movimentacoes m JOIN estoque_itens i ON i.id = m.item_id
       WHERE m.tipo IN ('baixa_os','estorno') AND m.criado_em BETWEEN ? AND ?`, intervalo(a, b));
    return { metros: N(r.metros), pecas: N(r.pecas) };
  };
  const [atual, anterior] = await Promise.all([consumo(p.de, p.ate), consumo(p.dePrev, p.atePrev)]);

  const [serieRows] = await pool.query(
    `SELECT DATE(m.criado_em) AS dia,
            SUM(CASE WHEN i.unidade='metros' THEN ${sinal} END) AS consumo_metros,
            SUM(CASE WHEN i.unidade='pecas'  THEN ${sinal} END) AS consumo_pecas,
            SUM(CASE WHEN m.tipo='entrada' AND i.unidade='metros' THEN m.quantidade END) AS entrada_metros,
            SUM(CASE WHEN m.tipo='entrada' AND i.unidade='pecas'  THEN m.quantidade END) AS entrada_pecas
     FROM estoque_movimentacoes m JOIN estoque_itens i ON i.id = m.item_id
     WHERE m.criado_em BETWEEN ? AND ? GROUP BY DATE(m.criado_em)`, intervalo(p.de, p.ate));
  const serie = serieContinua(p, serieRows, ['consumo_metros', 'consumo_pecas', 'entrada_metros', 'entrada_pecas']);

  // saldo x mínimo + cobertura (dias de estoque no ritmo de consumo do período)
  const [itens] = await pool.query(
    `SELECT i.id, i.nome, i.categoria, i.unidade, i.estoque_minimo,
       COALESCE((SELECT SUM(l.saldo_atual) FROM estoque_lotes l WHERE l.item_id = i.id),0) AS saldo,
       COALESCE((SELECT SUM(${sinal}) FROM estoque_movimentacoes m
                 WHERE m.item_id = i.id AND m.tipo IN ('baixa_os','estorno') AND m.criado_em BETWEEN ? AND ?),0) AS consumo
     FROM estoque_itens i WHERE i.ativo = 1`, intervalo(p.de, p.ate));
  const saude = itens.map((i) => {
    const saldo = N(i.saldo), consumo = N(i.consumo), minimo = N(i.estoque_minimo);
    const diario = consumo / p.dias;
    return { id: i.id, nome: i.nome, categoria: i.categoria, unidade: i.unidade, saldo, minimo, consumo,
      cobertura_dias: diario > 0 ? Math.round(saldo / diario) : null,
      // item sem saldo, sem mínimo e sem consumo é catálogo parado, não alerta
      status: saldo <= 0 && minimo <= 0 && consumo <= 0 ? 'SEM_USO' : statusItem(saldo, minimo) };
  });
  const contagem = { OK: 0, BAIXO: 0, ZERADO: 0, SEM_USO: 0 };
  saude.forEach((i) => { contagem[i.status] = (contagem[i.status] || 0) + 1; });
  // prioridade de reposição: zerados, depois baixos, depois menor cobertura
  const rank = { ZERADO: 0, BAIXO: 1, OK: 2, SEM_USO: 3 };
  const reposicao = saude.filter((i) => i.status === 'ZERADO' || i.status === 'BAIXO' || (i.cobertura_dias !== null && i.cobertura_dias <= 15))
    .sort((a, b) => rank[a.status] - rank[b.status] || (a.cobertura_dias ?? 9e9) - (b.cobertura_dias ?? 9e9)).slice(0, 12);

  const [posse] = await pool.query(
    `SELECT t.id, t.nome, t.tipo,
       COALESCE(SUM(CASE WHEN i.unidade='metros' THEN p.quantidade END),0) AS metros,
       COALESCE(SUM(CASE WHEN i.unidade='pecas'  THEN p.quantidade END),0) AS pecas
     FROM estoque_posse p JOIN tecnicos t ON t.id = p.tecnico_id
     JOIN estoque_lotes l ON l.id = p.lote_id JOIN estoque_itens i ON i.id = l.item_id
     WHERE p.quantidade > 0 GROUP BY t.id ORDER BY metros DESC, pecas DESC LIMIT 10`);

  const [[dev]] = await pool.query(
    `SELECT COUNT(*) AS pendentes, COALESCE(MAX(TIMESTAMPDIFF(DAY, solicitado_em, NOW())),0) AS mais_antiga_dias
     FROM estoque_devolucoes WHERE status='pendente'`);
  const [[k]] = await pool.query(
    `SELECT (SELECT COUNT(*) FROM estoque_lotes WHERE status='ativo' AND saldo_atual > 0) AS lotes_ativos,
            (SELECT COALESCE(SUM(p.quantidade),0) FROM estoque_posse p) AS em_posse`);

  res.json({
    periodo: p,
    kpis: { itens: saude.length, sem_uso: contagem.SEM_USO, ok: contagem.OK, baixo: contagem.BAIXO, zerado: contagem.ZERADO,
            lotes_ativos: k.lotes_ativos, em_posse: N(k.em_posse),
            devolucoes_pendentes: dev.pendentes, devolucao_mais_antiga_dias: N(dev.mais_antiga_dias) },
    consumo: { atual, anterior },
    serie, reposicao,
    posse: posse.map((t) => ({ ...t, metros: N(t.metros), pecas: N(t.pecas) })),
  });
}));

/* ───────── Painel de ORDENS DE SERVIÇO ───────── */
router.get('/os', handle(async (req, res) => {
  const p = periodo(req.query);
  const tid = req.query.tecnico_id ? Number(req.query.tecnico_id) : null;
  const T = tid ? ' AND tecnico_id = ?' : '';       // filtro sem alias
  const TO = tid ? ' AND o.tecnico_id = ?' : '';    // filtro com alias o
  const tp = tid ? [tid] : [];
  const ini = `${p.de} 00:00:00`, fim = `${p.ate} 23:59:59`;
  const iniP = `${p.dePrev} 00:00:00`, fimP = `${p.atePrev} 23:59:59`;

  const [[snap]] = await pool.query(
    `SELECT SUM(status='aberta') AS abertas, SUM(status='em_andamento') AS andamento,
            SUM(status IN ('aberta','em_andamento') AND prazo IS NOT NULL AND prazo < CURDATE()) AS atrasadas,
            SUM(status IN ('aberta','em_andamento') AND prioridade='alta') AS alta_prioridade
     FROM ordens_servico WHERE 1=1${T}`, tp);

  const janela = async (a, b) => {
    const [[r]] = await pool.query(
      `SELECT (SELECT COUNT(*) FROM ordens_servico WHERE criado_em BETWEEN ? AND ?${T}) AS criadas,
              (SELECT COUNT(*) FROM ordens_servico WHERE status='concluida' AND concluida_em BETWEEN ? AND ?${T}) AS concluidas,
              (SELECT AVG(TIMESTAMPDIFF(HOUR, criado_em, concluida_em)) FROM ordens_servico
                 WHERE status='concluida' AND concluida_em BETWEEN ? AND ?${T}) AS lead_horas,
              (SELECT SUM(DATE(concluida_em) <= prazo) FROM ordens_servico
                 WHERE status='concluida' AND prazo IS NOT NULL AND concluida_em BETWEEN ? AND ?${T}) AS no_prazo,
              (SELECT COUNT(*) FROM ordens_servico
                 WHERE status='concluida' AND prazo IS NOT NULL AND concluida_em BETWEEN ? AND ?${T}) AS com_prazo`,
      [a, b, ...tp, a, b, ...tp, a, b, ...tp, a, b, ...tp, a, b, ...tp]);
    return { criadas: N(r.criadas), concluidas: N(r.concluidas), lead_horas: r.lead_horas === null ? null : N(r.lead_horas),
             pontualidade: N(r.com_prazo) ? N(r.no_prazo) / N(r.com_prazo) : null, com_prazo: N(r.com_prazo) };
  };
  const [atual, anterior] = await Promise.all([janela(ini, fim), janela(iniP, fimP)]);

  const [cri] = await pool.query(`SELECT DATE(criado_em) AS dia, COUNT(*) AS criadas FROM ordens_servico WHERE criado_em BETWEEN ? AND ?${T} GROUP BY DATE(criado_em)`, [ini, fim, ...tp]);
  const [con] = await pool.query(`SELECT DATE(concluida_em) AS dia, COUNT(*) AS concluidas FROM ordens_servico WHERE status='concluida' AND concluida_em BETWEEN ? AND ?${T} GROUP BY DATE(concluida_em)`, [ini, fim, ...tp]);
  const porDia = {};
  [...cri, ...con].forEach((r) => { const d = String(r.dia).slice(0, 10); porDia[d] = { ...porDia[d], ...r, dia: d }; });
  const serie = serieContinua(p, Object.values(porDia), ['criadas', 'concluidas']);

  // idade das OS em aberto (aging): onde o trabalho está parado
  const [[ag]] = await pool.query(
    `SELECT SUM(d <= 2) AS b1, SUM(d BETWEEN 3 AND 7) AS b2, SUM(d BETWEEN 8 AND 14) AS b3, SUM(d >= 15) AS b4
     FROM (SELECT DATEDIFF(CURDATE(), DATE(criado_em)) AS d FROM ordens_servico WHERE status IN ('aberta','em_andamento')${T}) x`, tp);

  const [porTipo] = await pool.query(
    `SELECT COALESCE(NULLIF(tipo_servico,''),'Não informado') AS nome, COUNT(*) AS total
     FROM ordens_servico WHERE criado_em BETWEEN ? AND ?${T} GROUP BY nome ORDER BY total DESC LIMIT 8`, [ini, fim, ...tp]);
  const [porTec] = await pool.query(
    `SELECT t.id, t.nome, t.tipo,
            SUM(o.status IN ('aberta','em_andamento')) AS em_aberto,
            SUM(o.status='concluida' AND o.concluida_em BETWEEN ? AND ?) AS concluidas,
            SUM(o.status IN ('aberta','em_andamento') AND o.prazo IS NOT NULL AND o.prazo < CURDATE()) AS atrasadas,
            AVG(CASE WHEN o.status='concluida' AND o.concluida_em BETWEEN ? AND ? THEN TIMESTAMPDIFF(HOUR, o.criado_em, o.concluida_em) END) AS lead_horas
     FROM ordens_servico o JOIN tecnicos t ON t.id = o.tecnico_id WHERE 1=1${TO}
     GROUP BY t.id HAVING em_aberto > 0 OR concluidas > 0 ORDER BY em_aberto DESC, concluidas DESC LIMIT 12`, [ini, fim, ini, fim, ...tp]);
  const [atrasadas] = await pool.query(
    `SELECT o.id, o.numero, o.cliente, o.prioridade, o.status, o.prazo, t.nome AS tecnico, DATEDIFF(CURDATE(), o.prazo) AS dias_atraso
     FROM ordens_servico o JOIN tecnicos t ON t.id = o.tecnico_id
     WHERE o.status IN ('aberta','em_andamento') AND o.prazo < CURDATE()${TO} ORDER BY dias_atraso DESC LIMIT 10`, tp);

  res.json({
    periodo: p,
    kpis: { abertas: N(snap.abertas), em_andamento: N(snap.andamento), atrasadas: N(snap.atrasadas), alta_prioridade: N(snap.alta_prioridade) },
    atual, anterior, serie,
    aging: [['0–2 dias', N(ag.b1)], ['3–7 dias', N(ag.b2)], ['8–14 dias', N(ag.b3)], ['15+ dias', N(ag.b4)]],
    por_tipo: porTipo.map((r) => ({ ...r, total: N(r.total) })),
    por_tecnico: porTec.map((r) => ({ ...r, em_aberto: N(r.em_aberto), concluidas: N(r.concluidas), atrasadas: N(r.atrasadas), lead_horas: r.lead_horas === null ? null : N(r.lead_horas) })),
    atrasadas,
  });
}));

export default router;
