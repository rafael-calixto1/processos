// Autenticação: limite de tentativas, usuário inativo, erros sem vazamento.
import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, prepararBanco } from './helpers/db.js';

const { default: authRouter } = await import('../src/routes/auth.js');
const { default: osRouter } = await import('../src/routes/os.js');

const SENHA = 'senha-correta-123';
let server, base, liberarBanco, hash;

const api = async (method, path, { body, token } = {}) => {
  const r = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, headers: r.headers, body: await r.json().catch(() => ({})) };
};
const mkUser = async (email, role = 'tecnico', status = 'active') => {
  const [r] = await pool.query('INSERT INTO users (email,password,name,role,status) VALUES (?,?,?,?,?)', [email, hash, email, role, status]);
  return r.insertId;
};
const login = (email, password = SENHA) => api('POST', '/auth/login', { body: { email, password } });

before(async () => {
  liberarBanco = await prepararBanco();
  hash = await bcrypt.hash(SENHA, 4);
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/os', osRouter);
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { server?.close(); await liberarBanco?.(); await pool.end(); });

test('login válido devolve token e usuário; senha errada é 401 genérico', async () => {
  await mkUser('ok@t.local');
  const ok = await login('ok@t.local');
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  assert.equal(ok.body.user.role, 'tecnico');
  assert.equal((await login('ok@t.local', 'errada')).status, 401);
  assert.equal((await login('naoexiste@t.local')).status, 401);
});

test('usuário inativo: 403 com a senha certa, 401 genérico com a errada (não revela a conta)', async () => {
  await mkUser('inativo@t.local', 'tecnico', 'inactive');
  const certo = await login('inativo@t.local');
  assert.equal(certo.status, 403);
  assert.match(certo.body.error, /inativo/i);
  assert.equal((await login('inativo@t.local', 'errada')).status, 401);
});

test('token válido de usuário que foi inativado deixa de funcionar nas rotas de OS', async () => {
  const id = await mkUser('ficou-inativo@t.local');
  const token = jwt.sign({ id, role: 'tecnico', email: 'ficou-inativo@t.local' }, process.env.JWT_SECRET);
  assert.notEqual((await api('GET', '/os', { token })).status, 401); // ativo: passa pelo middleware (sem técnico vinculado = 403)
  await pool.query("UPDATE users SET status = 'inactive' WHERE id = ?", [id]);
  assert.equal((await api('GET', '/os', { token })).status, 401);
});

test('10 senhas erradas bloqueiam o e-mail (429 + Retry-After), mesmo com a senha certa depois', async () => {
  await mkUser('alvo@t.local');
  for (let i = 0; i < 10; i++) assert.equal((await login('alvo@t.local', `errada${i}`)).status, 401);
  const bloqueado = await login('alvo@t.local'); // senha CERTA, mas já está bloqueado
  assert.equal(bloqueado.status, 429);
  assert.ok(Number(bloqueado.headers.get('retry-after')) > 0);
  // outro e-mail não é afetado
  await mkUser('outro@t.local');
  assert.equal((await login('outro@t.local')).status, 200);
});

test('login bem-sucedido zera as falhas anteriores do e-mail', async () => {
  await mkUser('zera@t.local');
  for (let i = 0; i < 9; i++) await login('zera@t.local', 'errada');
  assert.equal((await login('zera@t.local')).status, 200);
  for (let i = 0; i < 9; i++) assert.equal((await login('zera@t.local', 'errada')).status, 401);
});

test('erro interno de auth não vaza a mensagem do banco', async () => {
  const token = jwt.sign({ id: 1, role: 'admin', email: 'x@y.z' }, process.env.JWT_SECRET);
  const falha = mock.method(pool, 'execute', async () => { throw new Error("ER_PARSE_ERROR: SELECT segredo FROM tabela_interna"); });
  const silenciar = mock.method(console, 'error', () => {});
  try {
    const r = await api('GET', '/auth/me', { token });
    assert.equal(r.status, 500);
    assert.equal(r.body.error, 'Erro interno do servidor');
  } finally { falha.mock.restore(); silenciar.mock.restore(); }
});
