// Endurecimento de segurança: cadastro público desligado por padrão e IP do cliente atrás de proxy.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { pool, prepararBanco } from './helpers/db.js';
import { opcaoTrustProxy } from '../src/config/proxy.js';

const { default: authRouter } = await import('../src/routes/auth.js');

let server, base, liberarBanco;
const post = async (rota, body, headers = {}) => {
  const r = await fetch(base + rota, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return { status: r.status, headers: r.headers, corpo: await r.json().catch(() => ({})) };
};
const totalUsuarios = async () => (await pool.query('SELECT COUNT(*) n FROM users'))[0][0].n;

before(async () => {
  liberarBanco = await prepararBanco();
  const app = express(); app.use(express.json());
  app.set('trust proxy', opcaoTrustProxy());
  app.use('/api/auth', authRouter);
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { delete process.env.ALLOW_PUBLIC_REGISTER; server?.close(); await liberarBanco?.(); await pool.end(); });

test('cadastro por conta própria vem DESLIGADO: 403 em português e nada é criado', async () => {
  delete process.env.ALLOW_PUBLIC_REGISTER;
  const antes = await totalUsuarios();
  const r = await post('/auth/register', { email: 'intruso@x.com', password: 'senha-forte-1', name: 'Intruso' });
  assert.equal(r.status, 403);
  assert.match(r.corpo.error, /desativado.*administrador/);
  assert.equal(await totalUsuarios(), antes);
  for (const valor of ['0', 'true', 'sim', '']) {
    process.env.ALLOW_PUBLIC_REGISTER = valor; // só "1" liga
    assert.equal((await post('/auth/register', { email: `v${valor}@x.com`, password: 'senha-forte-1', name: 'N' })).status, 403, `valor "${valor}"`);
  }
  assert.equal(await totalUsuarios(), antes);
});

test('com ALLOW_PUBLIC_REGISTER=1 o cadastro funciona, sempre como usuário só-leitura, e valida o básico', async () => {
  process.env.ALLOW_PUBLIC_REGISTER = '1';
  const ok = await post('/auth/register', { email: 'novo@x.com', password: 'senha-forte-1', name: 'Novo', role: 'admin' }, { 'X-Forwarded-For': '203.0.113.10' });
  assert.equal(ok.status, 201);
  const [[u]] = await pool.query("SELECT role FROM users WHERE email = 'novo@x.com'");
  assert.equal(u.role, 'viewer'); // mesmo pedindo admin no corpo
  assert.equal((await post('/auth/register', { email: 'novo@x.com', password: 'senha-forte-1', name: 'Novo' }, { 'X-Forwarded-For': '203.0.113.11' })).status, 400); // e-mail repetido
  assert.equal((await post('/auth/register', { email: 'b@x.com', password: '123', name: 'B' }, { 'X-Forwarded-For': '203.0.113.12' })).status, 400); // senha curta
  assert.equal((await post('/auth/register', { email: 'c@x.com' }, { 'X-Forwarded-For': '203.0.113.13' })).status, 400); // faltam campos
});

test('com o cadastro ligado há limite por IP (5 por hora) e Retry-After', async () => {
  process.env.ALLOW_PUBLIC_REGISTER = '1';
  const ip = { 'X-Forwarded-For': '198.51.100.77' };
  const resultados = [];
  for (let i = 0; i < 7; i++) resultados.push((await post('/auth/register', { email: `lote${i}@x.com`, password: 'senha-forte-1', name: `L${i}` }, ip)).status);
  assert.deepEqual(resultados, [201, 201, 201, 201, 201, 429, 429]);
  const bloqueado = await post('/auth/register', { email: 'lote9@x.com', password: 'senha-forte-1', name: 'L9' }, ip);
  assert.equal(bloqueado.status, 429);
  assert.ok(Number(bloqueado.headers.get('retry-after')) > 0);
  assert.match(bloqueado.corpo.error, /Muitos cadastros/);
  // outro IP não é afetado
  assert.equal((await post('/auth/register', { email: 'outro@x.com', password: 'senha-forte-1', name: 'O' }, { 'X-Forwarded-For': '198.51.100.78' })).status, 201);
});

test('TRUST_PROXY: padrão "loopback", número de proxies, false/true e lista de faixas', () => {
  assert.equal(opcaoTrustProxy(undefined), 'loopback');
  assert.equal(opcaoTrustProxy(''), 'loopback');
  assert.equal(opcaoTrustProxy('1'), 1);
  assert.equal(opcaoTrustProxy('2'), 2);
  assert.equal(opcaoTrustProxy('false'), false);
  assert.equal(opcaoTrustProxy('FALSE'), false);
  assert.equal(opcaoTrustProxy('true'), true);
  assert.equal(opcaoTrustProxy('loopback, 10.0.0.0/8'), 'loopback, 10.0.0.0/8');
});

test('o padrão só confia em proxy da própria máquina: um cliente de fora não consegue forjar o IP pelo cabeçalho', () => {
  const app = express();
  app.set('trust proxy', opcaoTrustProxy(undefined));
  const confia = app.get('trust proxy fn');
  assert.equal(confia('127.0.0.1', 0), true); // nginx/Caddy/cloudflared/Vite no mesmo servidor
  assert.equal(confia('::1', 0), true);
  assert.equal(confia('198.51.100.7', 0), false); // alguém na internet falando direto com a porta do servidor
  assert.equal(confia('10.0.0.5', 0), false);
  const velho = express(); velho.set('trust proxy', true); // o comportamento antigo
  assert.equal(velho.get('trust proxy fn')('198.51.100.7', 0), true); // era assim: qualquer um podia forjar
});

test('atrás de um proxy local o IP verdadeiro do cliente é usado (X-Forwarded-For)', async () => {
  const app = express();
  app.set('trust proxy', opcaoTrustProxy(undefined));
  app.get('/ip', (req, res) => res.json({ ip: req.ip }));
  const srv = await new Promise((ok) => { const s = app.listen(0, () => ok(s)); });
  try {
    const r = await (await fetch(`http://127.0.0.1:${srv.address().port}/ip`, { headers: { 'X-Forwarded-For': '203.0.113.9' } })).json();
    assert.equal(r.ip, '203.0.113.9'); // o proxy (loopback) é confiável: vale o IP que ele informou
  } finally { srv.close(); }
});
