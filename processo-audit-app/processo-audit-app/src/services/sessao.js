import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import { ServiceError, withTx } from './estoqueService.js';
import { retentarSeDeadlock } from './retentativa.js';
import * as acessos from './acessos.js';

/**
 * Sessão do app mobile: token de acesso curto (JWT) + refresh token opaco e rotativo.
 * - Só o hash (sha256) do refresh token fica no banco; cada renovação troca o token por um novo da mesma "família".
 * - Reapresentar um token já usado depois da janela de tolerância é tratado como roubo: a família inteira é revogada.
 *   A janela existe porque, no campo, a resposta da renovação pode se perder e o app reenviar o token antigo.
 * - Usuário inativo, sem perfil técnico ou sem técnico ativo vinculado perde todas as sessões.
 */
export const ACESSO_SEGUNDOS = 15 * 60;
export const REFRESH_DIAS = 30;
export const TOLERANCIA_REUSO_SEGUNDOS = 60;

const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex');
const novoRefresh = () => crypto.randomBytes(32).toString('base64url');
const SESSAO_INVALIDA = 'Sessão inválida. Entre novamente.';

const tokenDeAcesso = (u, familia) => jwt.sign(
  { id: u.id, email: u.email, name: u.name, role: u.role, sid: familia },
  process.env.JWT_SECRET, { expiresIn: ACESSO_SEGUNDOS });

const gravarRefresh = async (conn, usuarioId, familia, dispositivo) => {
  const refresh = novoRefresh();
  await conn.query(
    `INSERT INTO refresh_tokens (usuario_id, token_hash, familia, expira_em, dispositivo)
     VALUES (?,?,?, NOW() + INTERVAL ? DAY, ?)`,
    [usuarioId, sha256(refresh), familia, REFRESH_DIAS, dispositivo ? String(dispositivo).slice(0, 160) : null]);
  return refresh;
};

const resposta = (u, familia, refresh) => ({
  token: tokenDeAcesso(u, familia), refresh_token: refresh, expires_in: ACESSO_SEGUNDOS,
  user: { id: u.id, email: u.email, name: u.name, role: u.role },
});

/** O app é exclusivo de técnicos: perfil `tecnico` e técnico ativo vinculado. Lança 403 com mensagem clara. */
export const exigirTecnicoAtivo = async (conn, u) => {
  if (u.role !== 'tecnico') throw new ServiceError(403, 'Este aplicativo é exclusivo para técnicos');
  const [[t]] = await conn.query('SELECT id FROM tecnicos WHERE usuario_id = ? AND ativo = 1', [u.id]);
  if (!t) throw new ServiceError(403, 'Seu usuário não está vinculado a um técnico ativo. Fale com o estoque.');
};

const expiraRefresh = () => new Date(Date.now() + REFRESH_DIAS * 24 * 60 * 60 * 1000);

// `req` só serve para a auditoria de acessos (IP, navegador/aparelho)
export const abrirSessao = async (u, dispositivo, req = null) => {
  const familia = crypto.randomUUID();
  const r = await withTx(async (conn) => {
    await exigirTecnicoAtivo(conn, u);
    return resposta(u, familia, await gravarRefresh(conn, u.id, familia, dispositivo));
  });
  await acessos.abrirSessao({ req, sid: familia, origem: 'app', usuario: u, dispositivo, expiraEm: expiraRefresh() });
  return r;
};

/**
 * Derruba todas as sessões do usuário: as do app (refresh tokens) e, na auditoria de acessos, também as do web.
 * `motivo` é um dos acessos.MOTIVOS; `exceto` = sessão que continua (quem trocou a própria senha); `por` = quem pediu.
 */
export const revogarTodas = async (usuarioId, motivo = null, { req = null, por = null, exceto = null } = {}) => {
  try {
    await pool.query(
      `UPDATE refresh_tokens SET revogado_em = COALESCE(revogado_em, NOW()) WHERE usuario_id = ?${exceto ? ' AND familia <> ?' : ''}`,
      exceto ? [usuarioId, exceto] : [usuarioId]);
  } catch (e) {
    if (e.code !== 'ER_NO_SUCH_TABLE') throw e; // migração do app mobile ainda não aplicada: não há sessões a revogar
  }
  if (motivo) await acessos.encerrarSessoesDoUsuario(usuarioId, motivo, { req, por, exceto });
};

/** Admin encerrou uma sessão pela tela de acessos: no app, revoga também a família do refresh token. */
export const revogarFamilia = async (familia) => {
  try {
    await pool.query('UPDATE refresh_tokens SET revogado_em = COALESCE(revogado_em, NOW()) WHERE familia = ?', [familia]);
  } catch (e) {
    if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
  }
};

export const renovarSessao = async (refreshToken, dispositivo, req = null) => {
  if (typeof refreshToken !== 'string' || refreshToken.length < 20 || refreshToken.length > 200) throw new ServiceError(401, SESSAO_INVALIDA);
  // As revogações precisam ser gravadas mesmo quando a renovação é negada; por isso o erro é lançado depois do commit.
  const r = await retentarSeDeadlock(() => withTx(async (conn) => {
    const [[t]] = await conn.query(
      `SELECT id, usuario_id, familia, revogado_em, usado_em, (expira_em < NOW()) AS expirado,
              TIMESTAMPDIFF(SECOND, usado_em, NOW()) AS usado_ha_s
       FROM refresh_tokens WHERE token_hash = ? FOR UPDATE`, [sha256(refreshToken)]);
    if (!t || t.revogado_em) return { erro: new ServiceError(401, SESSAO_INVALIDA), familia: t?.familia, usuario_id: t?.usuario_id, recusa: 'sessao_invalida' };
    if (t.expirado) {
      return { erro: new ServiceError(401, 'Sessão expirada. Entre novamente.'), familia: t.familia, usuario_id: t.usuario_id, recusa: 'sessao_expirada', encerrar: 'expirada' };
    }
    if (t.usado_em && t.usado_ha_s > TOLERANCIA_REUSO_SEGUNDOS) {
      await conn.query('UPDATE refresh_tokens SET revogado_em = COALESCE(revogado_em, NOW()) WHERE familia = ?', [t.familia]);
      return { erro: new ServiceError(401, SESSAO_INVALIDA), familia: t.familia, usuario_id: t.usuario_id, recusa: 'sessao_invalida', encerrar: 'token_reutilizado' };
    }
    const [[u]] = await conn.query('SELECT id, email, name, role, status FROM users WHERE id = ?', [t.usuario_id]);
    try {
      if (!u || u.status !== 'active') throw new ServiceError(401, 'Usuário inativo. Fale com o administrador.');
      await exigirTecnicoAtivo(conn, u);
    } catch (e) {
      if (!(e instanceof ServiceError)) throw e;
      await conn.query('UPDATE refresh_tokens SET revogado_em = COALESCE(revogado_em, NOW()) WHERE usuario_id = ?', [t.usuario_id]);
      const inativo = !u || u.status !== 'active';
      return { erro: e, familia: t.familia, usuario_id: t.usuario_id, recusa: inativo ? 'usuario_inativo' : 'sem_acesso_app', todas: inativo ? 'usuario_inativado' : 'acesso_removido' };
    }
    await conn.query('UPDATE refresh_tokens SET usado_em = COALESCE(usado_em, NOW()) WHERE id = ?', [t.id]);
    return { ok: resposta(u, t.familia, await gravarRefresh(conn, u.id, t.familia, dispositivo)), familia: t.familia, usuario: u };
  }));
  // Auditoria de acessos (depois do commit: falhar aqui nunca desfaz a renovação nem a revogação)
  if (r.ok) {
    await acessos.sessaoRenovada({ req, sid: r.familia, usuario: r.usuario, dispositivo, expiraEm: expiraRefresh() });
    return r.ok;
  }
  if (r.encerrar) await acessos.encerrarSessao(r.familia, r.encerrar, { req });
  if (r.todas) await acessos.encerrarSessoesDoUsuario(r.usuario_id, r.todas, { req, origem: r.todas === 'acesso_removido' ? 'app' : null });
  await acessos.registrarEvento({
    req, evento: 'renovacao_negada', motivo: r.recusa, sid: r.familia ?? null, origem: 'app',
    usuario: r.usuario_id ? { id: r.usuario_id } : null, detalhe: r.erro.message,
  });
  throw r.erro;
};

/** Encerra a sessão (todos os tokens da família). Sempre "funciona", para o app poder sair mesmo com token inválido. */
export const encerrarSessao = async (refreshToken, req = null) => {
  if (typeof refreshToken !== 'string' || !refreshToken) return;
  const [[t]] = await pool.query('SELECT familia FROM refresh_tokens WHERE token_hash = ?', [sha256(refreshToken)]);
  if (t) {
    await pool.query('UPDATE refresh_tokens SET revogado_em = COALESCE(revogado_em, NOW()) WHERE familia = ?', [t.familia]);
    await acessos.encerrarSessao(t.familia, 'logout', { req });
  }
};
