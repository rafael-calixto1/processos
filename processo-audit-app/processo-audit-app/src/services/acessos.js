// Auditoria de acessos: cada login (web ou app) vira uma sessão com IP, última atividade, quando e por que acabou;
// e tudo o que acontece no acesso (inclusive login recusado) vira um evento.
// Tabelas criadas por scripts/migrate_acessos_auditoria.js. Falha ao registrar nunca impede o login nem a requisição.
import crypto from 'node:crypto';
import pool from '../config/database.js';
import { dadosRequisicao } from './referral/auditoria.js';

export const WEB_HORAS = 24; // validade do token do web (o mesmo `expiresIn` do login)

export const MOTIVOS = {
  logout: 'Saiu (logout)',
  expirada: 'Expirou',
  senha_alterada: 'Senha alterada',
  usuario_inativado: 'Usuário inativado',
  encerrada_pelo_admin: 'Encerrada por um administrador',
  token_reutilizado: 'Token do app reutilizado (suspeita de cópia)',
  acesso_removido: 'Perdeu o acesso ao app',
};

export const EVENTOS = {
  login: 'Login',
  login_falhou: 'Login recusado',
  login_bloqueado: 'Login bloqueado (muitas tentativas)',
  login_negado: 'Login negado',
  logout: 'Logout',
  sessao_encerrada: 'Sessão encerrada',
  renovacao_negada: 'Renovação do app negada',
  sessao_reconhecida: 'Sessão aberta antes da auditoria',
};

// motivos de login recusado/negado (coluna `motivo` dos eventos)
export const MOTIVOS_RECUSA = {
  senha_incorreta: 'Senha incorreta',
  usuario_inexistente: 'E-mail não cadastrado',
  usuario_inativo: 'Usuário inativo',
  sem_acesso_app: 'Sem acesso ao app',
  muitas_tentativas: 'Muitas tentativas',
  sessao_invalida: 'Sessão inválida',
  sessao_expirada: 'Sessão expirada',
};

export const novoSid = () => crypto.randomUUID();

/**
 * Token do web emitido antes da auditoria (sem `sid`): o próprio token vira a identidade da sessão
 * (hash em formato de UUID). O mesmo token sempre dá o mesmo sid, então logout e "encerrar" do admin valem para ele.
 */
export const sidDoTokenAntigo = (token) => {
  const h = crypto.createHash('sha256').update(String(token)).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};

let avisouSemTabela = false;
const falhou = (onde, err) => {
  if (err?.code === 'ER_NO_SUCH_TABLE') {
    if (!avisouSemTabela) console.error('[Acessos] Auditoria ainda não instalada: rode scripts/migrate_acessos_auditoria.js');
    avisouSemTabela = true;
    return;
  }
  console.error(`[Acessos] Erro ao ${onde}:`, err?.message);
};

const corta = (v, n) => (v == null || v === '' ? null : String(v).slice(0, n));

const nomeDoUsuario = async (id) => {
  if (!id) return null;
  const [[u]] = await pool.execute('SELECT name FROM users WHERE id = ?', [id]);
  return u?.name ?? null;
};

/** Grava um evento. `usuario` é a linha de users (id, email, name), quando se sabe quem é. */
export async function registrarEvento({ req, evento, motivo = null, sid = null, origem = null, usuario = null, email = null, detalhe = null, quando = null }) {
  try {
    const d = dadosRequisicao(req);
    await pool.execute(
      `INSERT INTO acessos_eventos
         (created_at, evento, motivo, sid, origem, usuario_id, usuario_email, usuario_nome, ip, ip_cadeia, user_agent, detalhe)
       VALUES (COALESCE(?, CURRENT_TIMESTAMP(3)), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [quando, evento, motivo, sid, origem, usuario?.id ?? null, corta(usuario?.email ?? email, 255), corta(usuario?.name, 255),
       d.ip, d.ip_cadeia, d.user_agent, corta(detalhe, 500)]);
  } catch (err) {
    falhou('registrar evento', err);
  }
}

/* ── Estado das sessões em memória: evita ir ao banco a cada requisição ── */
const TOQUE_MS = 60 * 1000;
const cache = new Map(); // sid → { em, encerrada, motivo }
const lembrar = (sid, estado) => {
  if (cache.size > 5000) cache.clear();
  cache.set(sid, { em: Date.now(), ...estado });
};
export const _limparCache = () => cache.clear(); // testes

/** Login aceito: abre a sessão. `expiraEm` é Date. */
export async function abrirSessao({ req, sid, origem, usuario, dispositivo = null, expiraEm }) {
  try {
    const d = dadosRequisicao(req);
    await pool.execute(
      `INSERT INTO acessos_sessoes
         (sid, origem, usuario_id, usuario_email, usuario_nome, usuario_papel, dispositivo, ip, ip_cadeia, user_agent,
          ultima_atividade, ultimo_ip, expira_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3), ?, ?)`,
      [sid, origem, usuario.id, corta(usuario.email, 255), corta(usuario.name, 255), corta(usuario.role, 30), corta(dispositivo, 160),
       d.ip, d.ip_cadeia, d.user_agent, d.ip, expiraEm]);
    lembrar(sid, { encerrada: false });
  } catch (err) {
    falhou('abrir sessão', err);
  }
  await registrarEvento({ req, evento: 'login', sid, origem, usuario, detalhe: dispositivo ? `Dispositivo: ${dispositivo}` : null });
}

/**
 * A cada requisição autenticada: anota a última atividade (no máximo 1x por minuto por sessão) e diz se a sessão
 * já foi encerrada. Devolve { encerrada, motivo } ou null quando não dá para saber (aí a requisição segue).
 */
export async function tocarSessao(sid, req, token = null) {
  const c = cache.get(sid);
  if (c && Date.now() - c.em < TOQUE_MS) return c;
  try {
    const ip = dadosRequisicao(req).ip;
    const [r] = await pool.execute(
      'UPDATE acessos_sessoes SET ultima_atividade = CURRENT_TIMESTAMP(3), ultimo_ip = ? WHERE sid = ? AND encerrada_em IS NULL',
      [ip, sid]);
    if (r.affectedRows) { lembrar(sid, { encerrada: false }); return cache.get(sid); }
    const [[s]] = await pool.execute('SELECT motivo_encerramento FROM acessos_sessoes WHERE sid = ?', [sid]);
    // sessão aberta antes da auditoria existir: passa a ser registrada agora e segue valendo até o token vencer
    if (!s && token) await reconhecerSessao({ req, sid, token });
    lembrar(sid, s ? { encerrada: true, motivo: s.motivo_encerramento } : { encerrada: false });
    return cache.get(sid);
  } catch (err) {
    falhou('anotar atividade', err);
    lembrar(sid, { encerrada: false }); // não insiste a cada requisição enquanto o banco/tabela não responde
    return null;
  }
}

/**
 * Sessão que já estava aberta quando a auditoria foi instalada (login antes das tabelas existirem): registra na
 * primeira atividade, com o início pelo horário do token (`iat` = hora do login) e a validade dele. O IP do login
 * não é conhecido (fica vazio); o de agora vai como último IP. Sessão do app (família de refresh token) usa o
 * início e a validade da família.
 */
export async function reconhecerSessao({ req, sid, token }) {
  try {
    const [[u]] = await pool.execute('SELECT id, email, name, role FROM users WHERE id = ?', [token.id ?? null]);
    if (!u) return;
    const [[fam]] = await pool.execute(
      'SELECT MIN(criado_em) AS inicio, MAX(expira_em) AS fim, MAX(dispositivo) AS dispositivo FROM refresh_tokens WHERE familia = ?', [sid]);
    const app = Boolean(fam?.inicio);
    const inicio = app ? fam.inicio : token.iat ? new Date(token.iat * 1000) : null;
    const fim = app ? fam.fim : token.exp ? new Date(token.exp * 1000) : null;
    const d = dadosRequisicao(req);
    const [r] = await pool.execute(
      `INSERT IGNORE INTO acessos_sessoes
         (sid, origem, usuario_id, usuario_email, usuario_nome, usuario_papel, dispositivo, ip, ip_cadeia, user_agent,
          iniciada_em, ultima_atividade, ultimo_ip, expira_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, COALESCE(?, CURRENT_TIMESTAMP(3)), CURRENT_TIMESTAMP(3), ?, ?)`,
      [sid, app ? 'app' : 'web', u.id, corta(u.email, 255), corta(u.name, 255), corta(u.role, 30), corta(app ? fam.dispositivo : null, 160),
       d.user_agent, inicio, d.ip, fim]);
    if (r.affectedRows) {
      await registrarEvento({
        req, evento: 'sessao_reconhecida', sid, origem: app ? 'app' : 'web', usuario: u, quando: null,
        detalhe: `Login feito${inicio ? ` em ${inicio.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : ''}, antes de a auditoria de acessos existir: o IP do login não foi registrado`,
      });
    }
  } catch (err) {
    falhou('registrar sessão já aberta', err);
  }
}

/** Encerra uma sessão aberta. `por` = id de quem encerrou (admin), `quando` = Date (padrão: agora). Devolve true se encerrou. */
export async function encerrarSessao(sid, motivo, { req = null, por = null, quando = null, detalhe = null } = {}) {
  if (!sid) return false;
  try {
    const porNome = por ? await nomeDoUsuario(por) : null;
    const [r] = await pool.execute(
      `UPDATE acessos_sessoes SET encerrada_em = COALESCE(?, CURRENT_TIMESTAMP(3)), motivo_encerramento = ?,
         encerrada_por_id = ?, encerrada_por_nome = ?
       WHERE sid = ? AND encerrada_em IS NULL`,
      [quando, motivo, por, porNome, sid]);
    lembrar(sid, { encerrada: true, motivo });
    if (!r.affectedRows) return false;
    const [[s]] = await pool.execute('SELECT origem, usuario_id, usuario_email, usuario_nome FROM acessos_sessoes WHERE sid = ?', [sid]);
    await registrarEvento({
      req, evento: motivo === 'logout' ? 'logout' : 'sessao_encerrada', motivo, sid, origem: s?.origem,
      usuario: s ? { id: s.usuario_id, email: s.usuario_email, name: s.usuario_nome } : null,
      detalhe: detalhe ?? (porNome ? `Por ${porNome}` : null), quando,
    });
    return true;
  } catch (err) {
    falhou('encerrar sessão', err);
    return false;
  }
}

/** Encerra todas as sessões abertas do usuário (menos `exceto`, a sessão de quem pediu; só as da `origem`, se informada). Devolve quantas. */
export async function encerrarSessoesDoUsuario(usuarioId, motivo, { req = null, por = null, exceto = null, origem = null } = {}) {
  try {
    const [abertas] = await pool.execute(
      `SELECT sid FROM acessos_sessoes WHERE usuario_id = ? AND encerrada_em IS NULL${origem ? ' AND origem = ?' : ''}`,
      origem ? [Number(usuarioId) || 0, origem] : [Number(usuarioId) || 0]);
    let n = 0;
    for (const { sid } of abertas) if (sid !== exceto && await encerrarSessao(sid, motivo, { req, por })) n++;
    return n;
  } catch (err) {
    falhou('encerrar sessões do usuário', err);
    return 0;
  }
}

/** Sessões que passaram da validade sem logout: encerradas na hora em que expiraram. */
export async function fecharExpiradas() {
  try {
    const [vencidas] = await pool.query(
      'SELECT sid, expira_em FROM acessos_sessoes WHERE encerrada_em IS NULL AND expira_em < CURRENT_TIMESTAMP(3) LIMIT 1000');
    for (const s of vencidas) await encerrarSessao(s.sid, 'expirada', { quando: s.expira_em });
  } catch (err) {
    falhou('fechar sessões expiradas', err);
  }
}

/** App: o refresh deu certo. Anota a renovação; sessão do app aberta antes da auditoria passa a ser registrada aqui. */
export async function sessaoRenovada({ req, sid, usuario, dispositivo = null, expiraEm }) {
  try {
    const ip = dadosRequisicao(req).ip;
    const [r] = await pool.execute(
      `UPDATE acessos_sessoes SET renovacoes = renovacoes + 1, ultima_atividade = CURRENT_TIMESTAMP(3), ultimo_ip = ?, expira_em = ?
       WHERE sid = ? AND encerrada_em IS NULL`, [ip, expiraEm, sid]);
    if (r.affectedRows) return;
    const [[existe]] = await pool.execute('SELECT id FROM acessos_sessoes WHERE sid = ?', [sid]);
    if (existe) return;
    const [[ini]] = await pool.execute('SELECT MIN(criado_em) AS em FROM refresh_tokens WHERE familia = ?', [sid]);
    const d = dadosRequisicao(req);
    await pool.execute(
      `INSERT INTO acessos_sessoes
         (sid, origem, usuario_id, usuario_email, usuario_nome, usuario_papel, dispositivo, ip, ip_cadeia, user_agent,
          iniciada_em, ultima_atividade, ultimo_ip, expira_em, renovacoes)
       VALUES (?, 'app', ?, ?, ?, ?, ?, NULL, NULL, ?, COALESCE(?, CURRENT_TIMESTAMP(3)), CURRENT_TIMESTAMP(3), ?, ?, 1)`,
      [sid, usuario.id, corta(usuario.email, 255), corta(usuario.name, 255), corta(usuario.role, 30), corta(dispositivo, 160),
       d.user_agent, ini?.em ?? null, ip, expiraEm]);
  } catch (err) {
    falhou('anotar renovação', err);
  }
}

/* ── Consultas da tela ── */
const lista = (v) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const ORIGENS = ['web', 'app'];
/** Sessão aberta com atividade nos últimos 2 minutos conta como "em uso agora" (a atividade é anotada no máximo 1x/min). */
export const EM_USO_S = 120;

/** WHERE dos filtros da aba Sessões (exportado para teste). */
export const filtroSessoes = (f = {}) => {
  const where = [];
  const params = [];
  if (f.usuario_id && /^\d+$/.test(String(f.usuario_id))) { where.push('usuario_id = ?'); params.push(Number(f.usuario_id)); }
  const origens = lista(f.origem).filter((o) => ORIGENS.includes(o));
  if (origens.length) { where.push(`origem IN (${origens.map(() => '?').join(',')})`); params.push(...origens); }
  if (['ativa', 'em_uso', 'sem_atividade'].includes(f.situacao)) where.push('encerrada_em IS NULL');
  if (f.situacao === 'em_uso') where.push(`(ultima_atividade IS NULL OR ultima_atividade >= CURRENT_TIMESTAMP(3) - INTERVAL ${EM_USO_S} SECOND)`);
  if (f.situacao === 'sem_atividade') where.push(`ultima_atividade < CURRENT_TIMESTAMP(3) - INTERVAL ${EM_USO_S} SECOND`);
  if (f.situacao === 'encerrada') where.push('encerrada_em IS NOT NULL');
  const motivos = lista(f.motivo).filter((m) => MOTIVOS[m]);
  if (motivos.length) { where.push(`motivo_encerramento IN (${motivos.map(() => '?').join(',')})`); params.push(...motivos); }
  if (f.ip) { where.push('(ip LIKE ? OR ultimo_ip LIKE ? OR ip_cadeia LIKE ?)'); params.push(`%${f.ip}%`, `%${f.ip}%`, `%${f.ip}%`); }
  if (DATA.test(f.de ?? '')) { where.push('iniciada_em >= ?'); params.push(`${f.de} 00:00:00`); }
  if (DATA.test(f.ate ?? '')) { where.push('iniciada_em < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(f.ate); }
  if (f.q) {
    const t = `%${String(f.q).slice(0, 100)}%`;
    where.push('(usuario_nome LIKE ? OR usuario_email LIKE ? OR dispositivo LIKE ? OR user_agent LIKE ?)');
    params.push(t, t, t, t);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
};

/** WHERE dos filtros da aba Eventos (exportado para teste). */
export const filtroEventos = (f = {}) => {
  const where = [];
  const params = [];
  if (f.usuario_id && /^\d+$/.test(String(f.usuario_id))) { where.push('usuario_id = ?'); params.push(Number(f.usuario_id)); }
  const eventos = lista(f.evento).filter((e) => EVENTOS[e]);
  if (eventos.length) { where.push(`evento IN (${eventos.map(() => '?').join(',')})`); params.push(...eventos); }
  const origens = lista(f.origem).filter((o) => ORIGENS.includes(o));
  if (origens.length) { where.push(`origem IN (${origens.map(() => '?').join(',')})`); params.push(...origens); }
  if (f.sid && /^[0-9a-f-]{36}$/i.test(String(f.sid))) { where.push('sid = ?'); params.push(String(f.sid)); }
  if (f.ip) { where.push('(ip LIKE ? OR ip_cadeia LIKE ?)'); params.push(`%${f.ip}%`, `%${f.ip}%`); }
  if (DATA.test(f.de ?? '')) { where.push('created_at >= ?'); params.push(`${f.de} 00:00:00`); }
  if (DATA.test(f.ate ?? '')) { where.push('created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(f.ate); }
  if (f.q) {
    const t = `%${String(f.q).slice(0, 100)}%`;
    where.push('(usuario_nome LIKE ? OR usuario_email LIKE ? OR detalhe LIKE ? OR user_agent LIKE ?)');
    params.push(t, t, t, t);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
};

const paginacao = (f) => {
  const porPagina = Math.min(200, Math.max(1, parseInt(f.por_pagina, 10) || 50));
  const pagina = Math.max(1, parseInt(f.pagina, 10) || 1);
  return { porPagina, pagina, offset: (pagina - 1) * porPagina };
};

const usuariosConhecidos = async () => {
  const [rows] = await pool.query(
    `SELECT usuario_id AS id, MAX(usuario_nome) AS nome, MAX(usuario_email) AS email
       FROM acessos_eventos WHERE usuario_id IS NOT NULL GROUP BY usuario_id ORDER BY nome`);
  return rows;
};

const rotulos = () => ({ motivos: MOTIVOS, eventos: EVENTOS, motivos_recusa: MOTIVOS_RECUSA, em_uso_s: EM_USO_S });

export async function listarSessoes(f = {}) {
  await fecharExpiradas();
  const { porPagina, pagina, offset } = paginacao(f);
  const { sql, params } = filtroSessoes(f);
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM acessos_sessoes ${sql}`, params);
  const [itens] = await pool.query(
    `SELECT *, TIMESTAMPDIFF(SECOND, iniciada_em, COALESCE(encerrada_em, CURRENT_TIMESTAMP(3))) AS duracao_s,
            TIMESTAMPDIFF(SECOND, iniciada_em, COALESCE(ultima_atividade, iniciada_em)) AS em_uso_s,
            TIMESTAMPDIFF(SECOND, ultima_atividade, CURRENT_TIMESTAMP(3)) AS ociosa_s
       FROM acessos_sessoes ${sql} ORDER BY iniciada_em DESC, id DESC LIMIT ${porPagina} OFFSET ${offset}`, params);
  const [[{ ativas }]] = await pool.query('SELECT COUNT(*) AS ativas FROM acessos_sessoes WHERE encerrada_em IS NULL');
  return {
    itens: itens.map((i) => ({ ...i, duracao_s: Number(i.duracao_s), em_uso_s: Number(i.em_uso_s), ociosa_s: i.ociosa_s == null ? null : Number(i.ociosa_s) })),
    total: Number(total), ativas: Number(ativas), pagina, por_pagina: porPagina,
    usuarios: await usuariosConhecidos(), ...rotulos(),
  };
}

export async function listarEventos(f = {}) {
  await fecharExpiradas();
  const { porPagina, pagina, offset } = paginacao(f);
  const { sql, params } = filtroEventos(f);
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM acessos_eventos ${sql}`, params);
  const [itens] = await pool.query(
    `SELECT * FROM acessos_eventos ${sql} ORDER BY created_at DESC, id DESC LIMIT ${porPagina} OFFSET ${offset}`, params);
  return { itens, total: Number(total), pagina, por_pagina: porPagina, usuarios: await usuariosConhecidos(), ...rotulos() };
}
