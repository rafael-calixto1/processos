import pool from '../config/database.js';
import { REGRAS_FECHAMENTO } from '../config/regrasFechamento.js';

const DIAS_HISTORICO = 30;
const num = (v) => (v === null || v === undefined ? null : Number(v));

/**
 * Tudo o que o app precisa numa chamada só: as OS do técnico (pendentes + encerradas recentes), a posse, os catálogos
 * e as regras. É um retrato completo das pendentes (não incremental), assim OS reatribuídas ou canceladas somem sozinhas.
 */
export const montarBootstrap = async (tecnicoId) => {
  const [[tecnico]] = await pool.query('SELECT id, nome, tipo, empresa FROM tecnicos WHERE id = ?', [tecnicoId]);
  const [os] = await pool.query(
    `SELECT o.id, o.numero, o.cliente, o.endereco, DATE_FORMAT(o.prazo, '%Y-%m-%d') AS prazo, o.prioridade, o.status, o.descricao,
       o.criado_em, o.atualizado_em, o.iniciado_em, o.concluida_em, o.tipo_servico, o.cep, o.logradouro, o.numero_endereco,
       o.complemento, o.bairro, o.cidade, o.uf, o.latitude, o.longitude, o.pop_nome, o.rota_id, o.poste_id,
       u.name AS criado_por_nome,
       EXISTS(SELECT 1 FROM os_rascunhos r WHERE r.os_id = o.id) AS tem_rascunho
     FROM ordens_servico o LEFT JOIN users u ON u.id = o.criado_por
     WHERE o.tecnico_id = ? AND (o.status IN ('aberta','em_andamento') OR o.atualizado_em >= NOW() - INTERVAL ? DAY)
     ORDER BY FIELD(o.status,'em_andamento','aberta','concluida','cancelada'), o.prazo IS NULL, o.prazo, o.id DESC`,
    [tecnicoId, DIAS_HISTORICO]);
  const [posse] = await pool.query(
    `SELECT p.lote_id, l.codigo AS lote_codigo, i.id AS item_id, i.nome AS item_nome, i.unidade, p.quantidade
     FROM estoque_posse p JOIN estoque_lotes l ON l.id = p.lote_id JOIN estoque_itens i ON i.id = l.item_id
     WHERE p.tecnico_id = ? AND p.quantidade > 0 ORDER BY i.nome, l.id`, [tecnicoId]);
  const [motivos] = await pool.query('SELECT id, codigo, rotulo, tipo_servico_id FROM os_motivos_fechamento WHERE ativo = 1 ORDER BY ordem, id');
  const [checklist] = await pool.query(
    'SELECT id, codigo, rotulo, tipo, unidade, obrigatorio, tipo_servico_id FROM os_checklist_itens WHERE ativo = 1 ORDER BY ordem, id');
  const [sugestoes] = await pool.query('SELECT descricao FROM os_servicos GROUP BY descricao ORDER BY COUNT(*) DESC, descricao LIMIT 40');
  const [tipos] = await pool.query('SELECT id, nome FROM os_tipos_servico ORDER BY nome');
  const [tecnicos] = await pool.query('SELECT id, nome, tipo, empresa FROM tecnicos WHERE ativo = 1 AND id <> ? ORDER BY nome', [tecnicoId]);
  const [itens] = await pool.query('SELECT id, nome, categoria, unidade FROM estoque_itens WHERE ativo = 1 ORDER BY nome');

  return {
    gerado_em: new Date().toISOString(),
    tecnico,
    os: os.map((o) => ({ ...o, latitude: num(o.latitude), longitude: num(o.longitude), tem_rascunho: Boolean(o.tem_rascunho) })),
    posse: posse.map((p) => ({ ...p, quantidade: Number(p.quantidade) })),
    motivos,
    checklist: checklist.map((c) => ({ ...c, obrigatorio: Boolean(c.obrigatorio) })),
    sugestoes_servicos: sugestoes.map((s) => s.descricao),
    tipos_servico: tipos,
    tecnicos,
    itens,
    regras: REGRAS_FECHAMENTO,
  };
};
