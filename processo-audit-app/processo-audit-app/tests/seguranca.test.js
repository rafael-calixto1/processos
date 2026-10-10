// Segurança sem banco: log sem segredos, CORS por allowlist e limitador de tentativas.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { requestLogger, redigir, urlSegura, corpoParaLog } from '../src/middlewares/requestLogger.js';
import { criarOpcoesCors } from '../src/config/cors.js';
import { criarLimitador } from '../src/middlewares/limitador.js';

const SENHA = 'senha-super-secreta-123';

const subirApp = async () => {
  const app = express();
  app.use(requestLogger);
  app.use(express.json({ limit: '50mb' }));
  app.post('/api/auth/login', (req, res) => res.json({ ok: true }));
  app.post('/api/os/1/fotos', (req, res) => res.json({ ok: true }));
  app.post('/api/os/1/lancamentos', (req, res) => res.json({ ok: true }));
  const server = await new Promise((ok) => { const s = app.listen(0, () => ok(s)); });
  const post = (path, body) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { server, post };
};

// roda `fn` capturando tudo o que o servidor escreve em console.log
const capturarLog = async (fn) => {
  const linhas = [];
  const m = mock.method(console, 'log', (...a) => linhas.push(a.join(' ')));
  try { await fn(); } finally { m.mock.restore(); }
  return linhas.join('\n');
};

test('log: senha em /auth/login nunca aparece, nem com LOG_BODIES=1', async () => {
  process.env.LOG_BODIES = '1';
  const { server, post } = await subirApp();
  try {
    const log = await capturarLog(async () => { await post('/api/auth/login', { email: 'a@b.c', password: SENHA }); });
    assert.ok(!log.includes(SENHA), 'a senha vazou no log');
    assert.match(log, /Body: \[omitido\]/);
  } finally { server.close(); delete process.env.LOG_BODIES; }
});

test('log: upload (/fotos) não registra o corpo e outras rotas redigem chaves sensíveis e textos longos', async () => {
  process.env.LOG_BODIES = '1';
  const { server, post } = await subirApp();
  try {
    const foto = `data:image/jpeg;base64,${'A'.repeat(5000)}`;
    const log = await capturarLog(async () => {
      await post('/api/os/1/fotos', { imagem: foto });
      await post('/api/os/1/lancamentos', { descricao: 'Lançamento ok', token: 'tk-123', rascunho: { foto } });
    });
    assert.ok(!log.includes('AAAAAAAAAA'), 'conteúdo de foto vazou no log');
    assert.ok(!log.includes('tk-123'), 'token vazou no log');
    assert.match(log, /Lançamento ok/);
    assert.match(log, /\[texto de \d+ caracteres\]/);
  } finally { server.close(); delete process.env.LOG_BODIES; }
});

test('log: sem LOG_BODIES o corpo não é logado e o segredo na query string é ocultado', async () => {
  delete process.env.LOG_BODIES;
  const { server, post } = await subirApp();
  try {
    const log = await capturarLog(async () => { await post('/api/os/1/lancamentos?token=abc123&x=1', { password: SENHA }); });
    assert.ok(!log.includes(SENHA));
    assert.ok(!log.includes('Body:'));
    assert.ok(!log.includes('abc123'));
    assert.match(log, /token=\[oculto\]&x=1/);
  } finally { server.close(); }
});

test('redigir: aninhado, listas longas e profundidade', () => {
  const r = redigir({ a: { Password: 'x', ok: 1 }, itens: Array.from({ length: 25 }, (_, i) => i) });
  assert.equal(r.a.Password, '[oculto]');
  assert.equal(r.a.ok, 1);
  assert.equal(r.itens.length, 21);
  assert.equal(urlSegura('/x?senha=1&b=2'), '/x?senha=[oculto]&b=2');
  assert.equal(corpoParaLog({ url: '/api/auth/refresh', body: { refresh: 'x' } }), '[omitido]');
});

test('cors: sem lista segue aberto; com lista só as origens listadas (e requisições sem Origin)', async () => {
  assert.equal(criarOpcoesCors('').origin, true);
  assert.equal(criarOpcoesCors('*').origin, true);
  const { origin } = criarOpcoesCors('https://app.exemplo.com/, https://admin.exemplo.com');
  const decide = (o) => new Promise((ok) => origin(o, (_, permitido) => ok(permitido)));
  assert.equal(await decide('https://app.exemplo.com'), true);
  assert.equal(await decide('https://admin.exemplo.com'), true);
  assert.equal(await decide('https://malicioso.com'), false);
  assert.equal(await decide(undefined), true); // app nativo / curl
});

test('limitador: bloqueia após o máximo de falhas, libera com o tempo e zera no sucesso', () => {
  let t = 0;
  const l = criarLimitador({ janelaMs: 1000, max: 3, agora: () => t });
  for (let i = 0; i < 3; i++) { assert.equal(l.segundosRestantes('a'), 0); l.falha('a'); t += 100; }
  assert.ok(l.segundosRestantes('a') > 0);
  assert.equal(l.segundosRestantes('outro'), 0);
  t += 800; // a 1ª falha (t=0) saiu da janela
  assert.equal(l.segundosRestantes('a'), 0);
  l.falha('a'); l.falha('a');
  assert.ok(l.segundosRestantes('a') > 0);
  l.sucesso('a');
  assert.equal(l.segundosRestantes('a'), 0);
});
