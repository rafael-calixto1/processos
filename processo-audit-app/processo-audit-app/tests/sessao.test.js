// Sessão do app mobile: login com refresh token, rotação, reuso, expiração, logout e revogação.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, prepararBanco } from './helpers/db.js';

const { default: authRouter } = await import('../src/routes/auth.js');
const { default: osRouter } = await import('../src/routes/os.js');

const SENHA = 'senha-correta-123';
let server, base, liberarBanco, hash, admin, seq = 0;

const api = async (method, path, { body, token } = {}) => {
  const r = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const mkTecnico = async ({ role = 'tecnico', status = 'active', vinculo = true, ativo = 1 } = {}) => {
  const email = `tec${++seq}@t.local`;
  const [u] = await pool.query('INSERT INTO users (email,password,name,role,status) VALUES (?,?,?,?,?)', [email, hash, email, role, status]);
  let tecnicoId = null;
  if (vinculo) tecnicoId = (await pool.query('INSERT INTO tecnicos (nome,tipo,usuario_id,ativo) VALUES (?,?,?,?)', [email, 'interno', u.insertId, ativo]))[0].insertId;
  return { id: u.insertId, email, tecnicoId };
};
const entrar = (email, extra = { dispositivo: 'Pixel 7 (teste)' }) => api('POST', '/auth/login', { body: { email, password: SENHA, ...extra } });
const refresh = (refresh_token) => api('POST', '/auth/refresh', { body: { refresh_token } });
const tokensDoBanco = async (usuarioId) => (await pool.query('SELECT * FROM refresh_tokens WHERE usuario_id = ? ORDER BY id', [usuarioId]))[0];

before(async () => {
  liberarBanco = await prepararBanco();
  hash = await bcrypt.hash(SENHA, 4);
  const [a] = await pool.query("INSERT INTO users (email,password,name,role) VALUES ('adm@t.local',?, 'Adm','admin')", [hash]);
  admin = { id: a.insertId, token: jwt.sign({ id: a.insertId, role: 'admin', email: 'adm@t.local' }, process.env.JWT_SECRET) };
  const app = express(); app.use(express.json());
  app.use('/api/auth', authRouter); app.use('/api/os', osRouter);
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { server?.close(); await liberarBanco?.(); await pool.end(); });

test('login do app devolve token curto + refresh; no banco fica só o hash do refresh', async () => {
  const t = await mkTecnico();
  const r = await entrar(t.email);
  assert.equal(r.status, 200);
  assert.ok(r.body.token && r.body.refresh_token);
  assert.equal(r.body.expires_in, 900);
  assert.equal(r.body.user.role, 'tecnico');
  const d = jwt.decode(r.body.token);
  assert.equal(d.exp - d.iat, 900);
  const linhas = await tokensDoBanco(t.id);
  assert.equal(linhas.length, 1);
  assert.notEqual(linhas[0].token_hash, r.body.refresh_token);
  assert.match(linhas[0].token_hash, /^[0-9a-f]{64}$/);
  assert.equal(linhas[0].dispositivo, 'Pixel 7 (teste)');
});

test('login do web (sem dispositivo) continua igual: token de 24h e nenhum refresh token', async () => {
  const t = await mkTecnico();
  const r = await entrar(t.email, {});
  assert.equal(r.status, 200);
  assert.equal(r.body.refresh_token, undefined);
  const d = jwt.decode(r.body.token);
  assert.equal(d.exp - d.iat, 24 * 3600);
  assert.equal((await tokensDoBanco(t.id)).length, 0);
});

test('o app recusa quem não é técnico ativo vinculado, sem criar sessão', async () => {
  const adm = await mkTecnico({ role: 'admin', vinculo: false });
  const r1 = await entrar(adm.email);
  assert.equal(r1.status, 403); assert.match(r1.body.error, /exclusivo para técnicos/);
  const semVinculo = await mkTecnico({ vinculo: false });
  const r2 = await entrar(semVinculo.email);
  assert.equal(r2.status, 403); assert.match(r2.body.error, /vinculado/);
  const tecInativo = await mkTecnico({ ativo: 0 });
  assert.equal((await entrar(tecInativo.email)).status, 403);
  for (const u of [adm, semVinculo, tecInativo]) assert.equal((await tokensDoBanco(u.id)).length, 0);
});

test('refresh troca o par de tokens e o novo access token funciona', async () => {
  const t = await mkTecnico();
  const a = (await entrar(t.email)).body;
  const b = await refresh(a.refresh_token);
  assert.equal(b.status, 200);
  assert.notEqual(b.body.refresh_token, a.refresh_token);
  assert.equal((await api('GET', '/auth/me', { token: b.body.token })).status, 200);
  const linhas = await tokensDoBanco(t.id);
  assert.equal(linhas.length, 2);
  assert.ok(linhas[0].usado_em);
  assert.equal(linhas[0].familia, linhas[1].familia);
});

test('reuso do token antigo logo em seguida (resposta perdida na rede) é tolerado', async () => {
  const t = await mkTecnico();
  const a = (await entrar(t.email)).body;
  assert.equal((await refresh(a.refresh_token)).status, 200);
  assert.equal((await refresh(a.refresh_token)).status, 200); // o app não recebeu o 1º par e tentou de novo
});

test('renovações simultâneas do mesmo token não derrubam a sessão', async () => {
  const t = await mkTecnico();
  const a = (await entrar(t.email)).body;
  const rs = await Promise.all([refresh(a.refresh_token), refresh(a.refresh_token), refresh(a.refresh_token)]);
  assert.deepEqual(rs.map((r) => r.status), [200, 200, 200]);
});

test('reuso depois da tolerância é roubo: a família inteira é revogada, inclusive o token novo', async () => {
  const t = await mkTecnico();
  const a = (await entrar(t.email)).body;
  const b = (await refresh(a.refresh_token)).body;
  await pool.query('UPDATE refresh_tokens SET usado_em = NOW() - INTERVAL 10 MINUTE WHERE usuario_id = ? AND usado_em IS NOT NULL', [t.id]);
  assert.equal((await refresh(a.refresh_token)).status, 401);
  assert.equal((await refresh(b.refresh_token)).status, 401); // o legítimo também precisa entrar de novo
  assert.ok((await tokensDoBanco(t.id)).every((x) => x.revogado_em));
});

test('refresh expirado, desconhecido ou malformado é 401', async () => {
  const t = await mkTecnico();
  const a = (await entrar(t.email)).body;
  await pool.query('UPDATE refresh_tokens SET expira_em = NOW() - INTERVAL 1 DAY WHERE usuario_id = ?', [t.id]);
  const exp = await refresh(a.refresh_token);
  assert.equal(exp.status, 401); assert.match(exp.body.error, /expirada/);
  assert.equal((await refresh('x'.repeat(43))).status, 401);
  assert.equal((await refresh('curto')).status, 401);
  assert.equal((await api('POST', '/auth/refresh', { body: {} })).status, 401);
});

test('logout revoga a sessão; chamar de novo ou com lixo também responde ok', async () => {
  const t = await mkTecnico();
  const a = (await entrar(t.email)).body;
  const b = (await refresh(a.refresh_token)).body;
  assert.equal((await api('POST', '/auth/logout', { body: { refresh_token: b.refresh_token } })).status, 200);
  assert.equal((await refresh(b.refresh_token)).status, 401);
  assert.equal((await refresh(a.refresh_token)).status, 401); // mesma família
  assert.equal((await api('POST', '/auth/logout', { body: { refresh_token: b.refresh_token } })).status, 200);
  assert.equal((await api('POST', '/auth/logout', { body: { refresh_token: 'lixo' } })).status, 200);
  assert.equal((await api('POST', '/auth/logout', { body: {} })).status, 200);
});

test('inativar o usuário revoga as sessões e o refresh passa a falhar', async () => {
  const t = await mkTecnico();
  const a = (await entrar(t.email)).body;
  assert.equal((await api('DELETE', `/auth/users/${t.id}`, { token: admin.token })).status, 200);
  assert.ok((await tokensDoBanco(t.id)).every((x) => x.revogado_em));
  assert.equal((await refresh(a.refresh_token)).status, 401);
});

test('desativar o técnico (cadastro) derruba a sessão na próxima renovação', async () => {
  const t = await mkTecnico();
  const a = (await entrar(t.email)).body;
  await pool.query('UPDATE tecnicos SET ativo = 0 WHERE id = ?', [t.tecnicoId]);
  const r = await refresh(a.refresh_token);
  assert.equal(r.status, 403); assert.match(r.body.error, /vinculado/);
  assert.ok((await tokensDoBanco(t.id)).every((x) => x.revogado_em));
});

test('admin trocando a senha do técnico revoga as sessões dele', async () => {
  const t = await mkTecnico();
  const a = (await entrar(t.email)).body;
  const put = await api('PUT', `/auth/users/${t.id}`, { token: admin.token, body: { name: 'Novo', role: 'tecnico', password: 'outra-senha-456' } });
  assert.equal(put.status, 200);
  assert.equal((await refresh(a.refresh_token)).status, 401);
});

test('token de acesso expirado responde 403 com code=token_expirado (o app renova e repete)', async () => {
  const t = await mkTecnico();
  const velho = jwt.sign({ id: t.id, role: 'tecnico', email: t.email }, process.env.JWT_SECRET, { expiresIn: -10 });
  const r = await api('GET', '/os', { token: velho });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'token_expirado');
  const lixo = await api('GET', '/os', { token: 'abc.def.ghi' });
  assert.equal(lixo.body.code, 'token_invalido');
});
