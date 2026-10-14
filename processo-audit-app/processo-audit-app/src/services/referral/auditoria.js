// Auditoria do Indique e Ganhe: quem fez o quê, de onde veio a informação e de qual IP.
// Tabela criada por scripts/migrate_indicacoes_auditoria.js. Falha ao registrar nunca impede a ação principal.
import pool from '../../config/database.js';

export const ORIGENS = {
  painel: 'Painel (usuário logado)',
  portal_publico: 'Portal público de indicação',
  webhook_hubsoft: 'Webhook do Hubsoft',
  sincronizacao_hubsoft: 'Sincronização com o Hubsoft',
};

export const ACOES = {
  recebida: 'Nova indicação recebida',
  criada: 'Indicação cadastrada',
  editada: 'Indicação editada',
  cancelada: 'Indicação cancelada',
  excluida: 'Indicação apagada',
  encaminhada_crm: 'Enviada ao CRM',
  aguardando_pagamento: 'Aguardando 1º pagamento',
  desconto_aplicado: 'Desconto aplicado',
  pagamento_registrado: 'Pagamento registrado',
  fatura_atualizada: 'Fatura atual mudou de situação',
  desconto_manual: 'Desconto manual lançado',
  config_alterada: 'Configuração alterada',
  etapa_crm_adicionada: 'Etapa de CRM salva',
  etapa_crm_removida: 'Etapa de CRM apagada',
  sincronizacao_manual: 'Sincronização pedida',
  webhook_ignorado: 'Webhook sem efeito',
  webhook_rejeitado: 'Webhook recusado (segredo inválido)',
  webhook_erro: 'Webhook com erro',
};

const MAX_JSON = 20000;

const limpaIp = (ip) => {
  if (!ip) return null;
  const s = String(ip).trim();
  return (s.startsWith('::ffff:') ? s.slice(7) : s).slice(0, 64) || null;
};

// IP segundo o `trust proxy` do Express (não confia no X-Forwarded-For enviado pelo próprio cliente)
// + a cadeia bruta, para conferência quando houver proxies no caminho.
export const dadosRequisicao = (req) => {
  if (!req) return { ip: null, ip_cadeia: null, user_agent: null, usuario_id: null, usuario_email: null };
  const xff = req.headers?.['x-forwarded-for'];
  const socket = req.socket?.remoteAddress;
  return {
    ip: limpaIp(req.ip ?? socket),
    ip_cadeia: xff ? `${xff} → ${limpaIp(socket) ?? '?'}`.slice(0, 255) : null,
    user_agent: (req.headers?.['user-agent'] || '').slice(0, 500) || null,
    usuario_id: req.userId ?? null,
    usuario_email: req.userEmail ?? null,
  };
};

// Normaliza para comparar o que veio do banco (DECIMAL vira string, DATE vira Date) com o que veio do formulário
const normalizar = (v) => {
  if (v === undefined || v === null || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return v;
  const s = String(v);
  return s.trim() !== '' && Number.isFinite(Number(s)) ? Number(s) : s;
};

/** Campos que mudaram entre `antes` e `depois` (só os informados em `depois`, ou em `campos`). */
export const diferencas = (antes = {}, depois = {}, campos = Object.keys(depois ?? {})) => {
  const r = { campos: [], antes: {}, depois: {} };
  for (const c of campos) {
    const a = normalizar(antes?.[c]);
    const d = normalizar(depois?.[c]);
    if (a === d) continue;
    r.campos.push(c);
    r.antes[c] = a;
    r.depois[c] = d;
  }
  return r;
};

const paraJson = (v) => {
  if (v === undefined || v === null) return null;
  const s = JSON.stringify(v);
  return s.length > MAX_JSON ? JSON.stringify({ truncado: true, inicio: s.slice(0, MAX_JSON) }) : s;
};

export async function registrarAuditoria({ req = null, acao, origem, entidade = 'indicacao', idIndicacao = null, resumo, antes = null, depois = null, campos = null }) {
  try {
    const d = dadosRequisicao(req);
    let nome = null;
    if (d.usuario_id) {
      const [[u]] = await pool.execute('SELECT name FROM users WHERE id = ?', [d.usuario_id]);
      nome = u?.name ?? null;
    }
    await pool.execute(
      `INSERT INTO indicacao_auditoria
         (acao, origem, entidade, id_indicacao, resumo, campos_alterados, dados_antes, dados_depois,
          usuario_id, usuario_email, usuario_nome, ip, ip_cadeia, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        acao, origem, entidade, idIndicacao != null ? Number(idIndicacao) : null,
        String(resumo ?? ACOES[acao] ?? acao).slice(0, 500),
        campos?.length ? campos.join(',').slice(0, 500) : null,
        paraJson(antes), paraJson(depois),
        d.usuario_id, d.usuario_email, nome, d.ip, d.ip_cadeia, d.user_agent,
      ]
    );
  } catch (err) {
    console.error('[Indique e Ganhe] Erro ao registrar auditoria:', err.message);
  }
}

const lista = (v) => String(v ?? '').split(',').map(s => s.trim()).filter(Boolean);
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Monta o WHERE dos filtros da tela (exportado para teste). */
export const montarFiltro = (f = {}) => {
  const where = [];
  const params = [];
  const acoes = lista(f.acao).filter(a => ACOES[a]);
  if (acoes.length) { where.push(`acao IN (${acoes.map(() => '?').join(',')})`); params.push(...acoes); }
  const origens = lista(f.origem).filter(o => ORIGENS[o]);
  if (origens.length) { where.push(`origem IN (${origens.map(() => '?').join(',')})`); params.push(...origens); }
  if (f.usuario_id && /^\d+$/.test(String(f.usuario_id))) { where.push('usuario_id = ?'); params.push(Number(f.usuario_id)); }
  if (f.id_indicacao && /^\d+$/.test(String(f.id_indicacao))) { where.push('id_indicacao = ?'); params.push(Number(f.id_indicacao)); }
  if (f.ip) { where.push('(ip LIKE ? OR ip_cadeia LIKE ?)'); params.push(`%${f.ip}%`, `%${f.ip}%`); }
  if (DATA.test(f.de ?? '')) { where.push('created_at >= ?'); params.push(`${f.de} 00:00:00`); }
  if (DATA.test(f.ate ?? '')) { where.push('created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(f.ate); }
  if (f.q) {
    const t = `%${String(f.q).slice(0, 100)}%`;
    where.push('(resumo LIKE ? OR usuario_nome LIKE ? OR usuario_email LIKE ? OR dados_antes LIKE ? OR dados_depois LIKE ?)');
    params.push(t, t, t, t, t);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
};

export async function listarAuditoria(f = {}) {
  const porPagina = Math.min(200, Math.max(1, parseInt(f.por_pagina, 10) || 50));
  const pagina = Math.max(1, parseInt(f.pagina, 10) || 1);
  const { sql, params } = montarFiltro(f);

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM indicacao_auditoria ${sql}`, params);
  const [itens] = await pool.query(
    `SELECT * FROM indicacao_auditoria ${sql} ORDER BY created_at DESC, id DESC LIMIT ${porPagina} OFFSET ${(pagina - 1) * porPagina}`,
    params
  );
  const [usuarios] = await pool.query(
    `SELECT usuario_id AS id, MAX(usuario_nome) AS nome, MAX(usuario_email) AS email
       FROM indicacao_auditoria WHERE usuario_id IS NOT NULL GROUP BY usuario_id ORDER BY nome`
  );
  const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return s; } };
  return {
    itens: itens.map(i => ({ ...i, dados_antes: parse(i.dados_antes), dados_depois: parse(i.dados_depois) })),
    total: Number(total),
    pagina,
    por_pagina: porPagina,
    usuarios,
    acoes: ACOES,
    origens: ORIGENS,
  };
}
