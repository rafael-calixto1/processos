// Auditoria de acessos: sessões do web e do app (início, IP, atividade, fim e motivo) e tentativas de login.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, prepararBanco } from './helpers/db.js';

const { default: authRouter } = await import('../src/routes/auth.js');
const acessos = await import('../src/services/acessos.js');

const SENHA = 'senha-correta-123';
let server, base, liberarBanco, hash, seq = 0;

const api = async (method, path, { body, token, headers = {} } = {}) => {
  const r = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const mkUsuario = async ({ role = 'viewer', tecnico = false } = {}) => {
  const email = `u${++seq}@t.local`;
  const [u] = await pool.query('INSERT INTO users (email,password,name,role) VALUES (?,?,?,?)', [email, hash, `Usuário ${seq}`, role]);
  if (tecnico) await pool.query('INSERT INTO tecnicos (nome,tipo,usuario_id,ativo) VALUES (?,?,?,1)', [email, 'interno', u.insertId]);
  return { id: u.insertId, email };
};
const entrarWeb = (email, password = SENHA) => api('POST', '/auth/login', { body: { email, password }, headers: { 'User-Agent': 'Mozilla/5.0 (teste)' } });
const sessao = async (sid) => (await pool.query('SELECT * FROM acessos_sessoes WHERE sid = ?', [sid]))[0][0];
const eventos = async (filtro) => (await pool.query(`SELECT * FROM acessos_eventos WHERE ${filtro} ORDER BY id`))[0];

before(async () => {
  liberarBanco = await prepararBanco();
  hash = await bcrypt.hash(SENHA, 4);
  const app = express(); app.use(express.json());
  app.use('/api/auth', authRouter);
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { server?.close(); await liberarBanco?.(); await pool.end(); });

test('login do web abre sessão com IP e navegador; logout encerra e o token deixa de valer', async () => {
  const u = await mkUsuario();
  const r = await entrarWeb(u.email);
  assert.equal(r.status, 200);
  const { sid } = jwt.decode(r.body.token);
  assert.match(sid, /^[0-9a-f-]{36}$/);
  const s = await sessao(sid);
  assert.equal(s.origem, 'web');
  assert.equal(s.usuario_id, u.id);
  assert.equal(s.ip, '127.0.0.1');
  assert.equal(s.user_agent, 'Mozilla/5.0 (teste)');
  assert.equal(s.encerrada_em, null);
  assert.ok(s.expira_em > new Date(Date.now() + 23 * 3600e3));
  assert.equal((await api('GET', '/auth/me', { token: r.body.token })).status, 200);

  assert.equal((await api('POST', '/auth/logout', { token: r.body.token })).status, 200);
  const fim = await sessao(sid);
  assert.ok(fim.encerrada_em);
  assert.equal(fim.motivo_encerramento, 'logout');
  const depois = await api('GET', '/auth/me', { token: r.body.token });
  assert.equal(depois.status, 403);
  assert.match(depois.body.error, /^Token inválido: sessão encerrada/);
  assert.deepEqual((await eventos(`sid = '${sid}'`)).map((e) => e.evento), ['login', 'logout']);
});

test('login recusado fica registrado com o motivo e o e-mail digitado', async () => {
  const u = await mkUsuario();
  assert.equal((await entrarWeb(u.email, 'errada')).status, 401);
  assert.equal((await entrarWeb('ninguem@t.local', 'x')).status, 401);
  const [senha] = await eventos(`evento = 'login_falhou' AND usuario_id = ${u.id}`);
  assert.equal(senha.motivo, 'senha_incorreta');
  assert.equal(senha.ip, '127.0.0.1');
  const [inexistente] = await eventos("evento = 'login_falhou' AND usuario_email = 'ninguem@t.local'");
  assert.equal(inexistente.motivo, 'usuario_inexistente');
  assert.equal(inexistente.usuario_id, null);
});

test('usuário inativo: login negado registrado', async () => {
  const u = await mkUsuario();
  await pool.query("UPDATE users SET status = 'inactive' WHERE id = ?", [u.id]);
  assert.equal((await entrarWeb(u.email)).status, 403);
  const [e] = await eventos(`evento = 'login_negado' AND usuario_id = ${u.id}`);
  assert.equal(e.motivo, 'usuario_inativo');
});

test('trocar a própria senha derruba as outras sessões e mantém a atual', async () => {
  const u = await mkUsuario();
  const a = (await entrarWeb(u.email)).body.token;
  const b = (await entrarWeb(u.email)).body.token;
  const r = await api('PUT', '/auth/change-password', { token: a, body: { currentPassword: SENHA, newPassword: 'nova-senha-456' } });
  assert.equal(r.status, 200);
  assert.equal((await api('GET', '/auth/me', { token: a })).status, 200);
  assert.equal((await api('GET', '/auth/me', { token: b })).status, 403);
  const sb = await sessao(jwt.decode(b).sid);
  assert.equal(sb.motivo_encerramento, 'senha_alterada');
  assert.equal(sb.encerrada_por_id, u.id);
  await pool.query('UPDATE users SET password = ? WHERE id = ?', [hash, u.id]);
});

test('admin vê as sessões e eventos, encerra a sessão de outro; quem não é admin não vê', async () => {
  const adm = await mkUsuario({ role: 'admin' });
  const u = await mkUsuario();
  const ta = (await entrarWeb(adm.email)).body.token;
  const tu = (await entrarWeb(u.email)).body.token;
  const sidU = jwt.decode(tu).sid;

  assert.equal((await api('GET', '/auth/acessos/sessoes', { token: tu })).status, 403);
  const lista = await api('GET', `/auth/acessos/sessoes?usuario_id=${u.id}&situacao=ativa`, { token: ta });
  assert.equal(lista.status, 200);
  assert.equal(lista.body.total, 1);
  assert.equal(lista.body.itens[0].sid, sidU);
  assert.equal(typeof lista.body.itens[0].duracao_s, 'number');
  assert.ok(lista.body.motivos.logout);

  assert.equal((await api('POST', `/auth/acessos/sessoes/${jwt.decode(ta).sid}/encerrar`, { token: ta })).status, 400);
  assert.equal((await api('POST', `/auth/acessos/sessoes/${sidU}/encerrar`, { token: ta })).status, 200);
  assert.equal((await api('POST', `/auth/acessos/sessoes/${sidU}/encerrar`, { token: ta })).status, 409);
  assert.equal((await api('GET', '/auth/me', { token: tu })).status, 403);
  const s = await sessao(sidU);
  assert.equal(s.motivo_encerramento, 'encerrada_pelo_admin');
  assert.equal(s.encerrada_por_id, adm.id);

  const ev = await api('GET', `/auth/acessos/eventos?usuario_id=${u.id}&evento=sessao_encerrada`, { token: ta });
  assert.equal(ev.body.total, 1);
  assert.equal(ev.body.itens[0].motivo, 'encerrada_pelo_admin');
});

test('inativar o usuário encerra as sessões dele com esse motivo', async () => {
  const adm = await mkUsuario({ role: 'admin' });
  const u = await mkUsuario();
  const tu = (await entrarWeb(u.email)).body.token;
  const ta = (await entrarWeb(adm.email)).body.token;
  assert.equal((await api('DELETE', `/auth/users/${u.id}`, { token: ta })).status, 200);
  assert.equal((await sessao(jwt.decode(tu).sid)).motivo_encerramento, 'usuario_inativado');
});

test('app: login, renovação e logout ficam na mesma sessão (a família do refresh token)', async () => {
  const t = await mkUsuario({ role: 'tecnico', tecnico: true });
  const r = await api('POST', '/auth/login', { body: { email: t.email, password: SENHA, dispositivo: 'Pixel 7 (teste)' } });
  assert.equal(r.status, 200);
  const { sid } = jwt.decode(r.body.token);
  let s = await sessao(sid);
  assert.equal(s.origem, 'app');
  assert.equal(s.dispositivo, 'Pixel 7 (teste)');
  const r2 = await api('POST', '/auth/refresh', { body: { refresh_token: r.body.refresh_token } });
  assert.equal(r2.status, 200);
  s = await sessao(sid);
  assert.equal(s.renovacoes, 1);
  await api('POST', '/auth/logout', { body: { refresh_token: r2.body.refresh_token } });
  s = await sessao(sid);
  assert.equal(s.motivo_encerramento, 'logout');
});

test('app: refresh reutilizado depois da tolerância encerra a sessão como suspeita', async () => {
  const t = await mkUsuario({ role: 'tecnico', tecnico: true });
  const r = await api('POST', '/auth/login', { body: { email: t.email, password: SENHA, dispositivo: 'x' } });
  await api('POST', '/auth/refresh', { body: { refresh_token: r.body.refresh_token } });
  await pool.query('UPDATE refresh_tokens SET usado_em = NOW() - INTERVAL 5 MINUTE WHERE usuario_id = ?', [t.id]);
  assert.equal((await api('POST', '/auth/refresh', { body: { refresh_token: r.body.refresh_token } })).status, 401);
  const { sid } = jwt.decode(r.body.token);
  assert.equal((await sessao(sid)).motivo_encerramento, 'token_reutilizado');
  const [e] = await eventos(`evento = 'renovacao_negada' AND sid = '${sid}'`);
  assert.equal(e.motivo, 'sessao_invalida');
});

test('sessão vencida sem logout é encerrada como "expirou", na hora em que venceu', async () => {
  const u = await mkUsuario();
  const sid = jwt.decode((await entrarWeb(u.email)).body.token).sid;
  await pool.query('UPDATE acessos_sessoes SET expira_em = NOW(3) - INTERVAL 2 HOUR WHERE sid = ?', [sid]);
  await acessos.fecharExpiradas();
  const s = await sessao(sid);
  assert.equal(s.motivo_encerramento, 'expirada');
  assert.equal(s.encerrada_em.getTime(), s.expira_em.getTime());
});

test('logout com token do web já vencido conta como "expirou"', async () => {
  const u = await mkUsuario();
  const sid = acessos.novoSid();
  await acessos.abrirSessao({ req: null, sid, origem: 'web', usuario: { id: u.id, email: u.email, name: 'x', role: 'viewer' }, expiraEm: new Date(Date.now() + 3600e3) });
  const vencido = jwt.sign({ id: u.id, role: 'viewer', email: u.email, sid, exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET);
  assert.equal((await api('POST', '/auth/logout', { token: vencido })).status, 200);
  assert.equal((await sessao(sid)).motivo_encerramento, 'expirada');
});

test('filtros: só aceitam valores conhecidos', () => {
  const f = acessos.filtroSessoes({ origem: 'web,hack', situacao: 'ativa', motivo: 'logout,xx', de: '2026-10-01', ate: 'lixo', usuario_id: '3' });
  assert.match(f.sql, /usuario_id = \?/);
  assert.match(f.sql, /origem IN \(\?\)/);
  assert.match(f.sql, /encerrada_em IS NULL/);
  assert.match(f.sql, /motivo_encerramento IN \(\?\)/);
  assert.doesNotMatch(f.sql, /DATE_ADD/);
  assert.deepEqual(f.params, [3, 'web', 'logout', '2026-10-01 00:00:00']);
  const e = acessos.filtroEventos({ evento: 'login_falhou', sid: "x' OR 1=1" });
  assert.deepEqual(e.params, ['login_falhou']);
});
