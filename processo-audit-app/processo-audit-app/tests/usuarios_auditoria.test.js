// Auditoria do cadastro de usuários: criação, edição (com departamentos e troca de senha), inativação e troca da
// própria senha ficam registradas com quem fez e o que mudou; senha nunca é guardada; só admin vê.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import bcrypt from 'bcryptjs';
import { pool, prepararBanco } from './helpers/db.js';

const { default: authRouter } = await import('../src/routes/auth.js');
const auditoria = await import('../src/services/usuariosAuditoria.js');

const SENHA = 'senha-correta-123';
let server, base, liberarBanco, hash, seq = 0, admin, tokenAdmin, depTI, depRH;

const api = async (method, path, { body, token } = {}) => {
  const r = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const mkUsuario = async (role = 'viewer') => {
  const email = `ua${++seq}@t.local`;
  const [u] = await pool.query('INSERT INTO users (email,password,name,role) VALUES (?,?,?,?)', [email, hash, `Pessoa ${seq}`, role]);
  return { id: u.insertId, email };
};
const entrar = async (email, password = SENHA) => (await api('POST', '/auth/login', { body: { email, password } })).body.token;
const registros = async (filtro = '1=1', params = []) =>
  (await pool.query(`SELECT * FROM usuarios_auditoria WHERE ${filtro} ORDER BY id`, params))[0];

before(async () => {
  liberarBanco = await prepararBanco();
  hash = await bcrypt.hash(SENHA, 4);
  // departamentos como em produção (initDb + migrate_user_departments)
  await pool.query('CREATE TABLE IF NOT EXISTS departments (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NOT NULL, description TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
  await pool.query(`CREATE TABLE IF NOT EXISTS user_departments (user_id INT NOT NULL, department_id INT NOT NULL, PRIMARY KEY (user_id, department_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE)`);
  depTI = (await pool.query("INSERT INTO departments (name) VALUES ('TI')"))[0].insertId;
  depRH = (await pool.query("INSERT INTO departments (name) VALUES ('RH')"))[0].insertId;

  const app = express(); app.use(express.json());
  app.use('/api/auth', authRouter);
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://127.0.0.1:${server.address().port}/api`;

  admin = await mkUsuario('admin');
  tokenAdmin = await entrar(admin.email);
});
after(async () => {
  server?.close();
  await pool.query('DROP TABLE IF EXISTS user_departments');
  await pool.query('DROP TABLE IF EXISTS departments');
  await liberarBanco?.();
  await pool.end();
});

test('criar, editar e inativar usuário ficam na auditoria com quem fez e o que mudou', async () => {
  const criado = await api('POST', '/auth/users', {
    token: tokenAdmin, body: { email: 'novo@t.local', password: 'segredo-1', name: 'Novo Usuário', role: 'viewer', department_ids: [depTI] },
  });
  assert.equal(criado.status, 201);
  const [[novo]] = await pool.query("SELECT id FROM users WHERE email = 'novo@t.local'");

  const [c] = await registros('alvo_id = ?', [novo.id]);
  assert.equal(c.acao, 'criado');
  assert.equal(c.usuario_id, admin.id);
  assert.equal(c.usuario_email, admin.email);
  assert.equal(c.ip, '127.0.0.1');
  assert.equal(c.alvo_email, 'novo@t.local');
  const depois = JSON.parse(c.dados_depois);
  assert.deepEqual(depois.departamentos, ['TI']);
  assert.equal(depois.role, 'viewer');
  assert.equal(depois.password, undefined);
  assert.doesNotMatch(c.dados_depois, /segredo-1|\$2[aby]\$/);

  // edição: papel, nome, departamentos e senha
  assert.equal((await api('PUT', `/auth/users/${novo.id}`, {
    token: tokenAdmin, body: { name: 'Novo Nome', role: 'manager', password: 'outro-segredo', department_ids: [depRH, depTI] },
  })).status, 200);
  const [, e] = await registros('alvo_id = ?', [novo.id]);
  assert.equal(e.acao, 'editado');
  assert.equal(e.campos_alterados, 'name,role,departamentos,senha');
  assert.deepEqual(JSON.parse(e.dados_antes), { name: 'Novo Usuário', role: 'viewer', departamentos: 'TI', senha: '••••••' });
  assert.deepEqual(JSON.parse(e.dados_depois), { name: 'Novo Nome', role: 'manager', departamentos: 'RH,TI', senha: 'nova senha definida' });
  assert.match(e.resumo, /Nome, Papel, Departamentos, Senha/);
  assert.doesNotMatch(`${e.dados_antes}${e.dados_depois}`, /outro-segredo|\$2[aby]\$/);

  // salvar sem mudar nada
  await api('PUT', `/auth/users/${novo.id}`, { token: tokenAdmin, body: { name: 'Novo Nome', role: 'manager', department_ids: [depTI, depRH] } });
  const [, , semMudar] = await registros('alvo_id = ?', [novo.id]);
  assert.match(semMudar.resumo, /sem alterações/);
  assert.equal(semMudar.campos_alterados, null);

  // inativar (a rota DELETE inativa); repetir não registra de novo
  assert.equal((await api('DELETE', `/auth/users/${novo.id}`, { token: tokenAdmin })).status, 200);
  await api('DELETE', `/auth/users/${novo.id}`, { token: tokenAdmin });
  const inativ = await registros("alvo_id = ? AND acao = 'inativado'", [novo.id]);
  assert.equal(inativ.length, 1);
  assert.equal(JSON.parse(inativ[0].dados_antes).status, 'active');
  assert.deepEqual(JSON.parse(inativ[0].dados_depois), { status: 'inactive' });

  // id inexistente não registra nada
  const antes = (await registros()).length;
  await api('PUT', '/auth/users/999999', { token: tokenAdmin, body: { name: 'x', role: 'viewer' } });
  await api('DELETE', '/auth/users/999999', { token: tokenAdmin });
  assert.equal((await registros()).length, antes);
});

test('troca da própria senha fica registrada sem a senha', async () => {
  const u = await mkUsuario();
  const t = await entrar(u.email);
  assert.equal((await api('PUT', '/auth/change-password', { token: t, body: { currentPassword: SENHA, newPassword: 'nova-senha-9' } })).status, 200);
  const [r] = await registros("alvo_id = ? AND acao = 'senha_propria'", [u.id]);
  assert.equal(r.usuario_id, u.id);
  assert.equal(r.campos_alterados, 'senha');
  assert.doesNotMatch(`${r.dados_antes}${r.dados_depois}`, /nova-senha-9|\$2[aby]\$/);
  await pool.query('UPDATE users SET password = ? WHERE id = ?', [hash, u.id]);
});

test('só admin vê a auditoria; filtros por ação, usuário afetado, autor e busca', async () => {
  const comum = await mkUsuario('manager');
  assert.equal((await api('GET', '/auth/usuarios/auditoria', { token: await entrar(comum.email) })).status, 403);
  assert.equal((await api('GET', '/auth/usuarios/auditoria')).status, 401);

  const tudo = await api('GET', '/auth/usuarios/auditoria', { token: tokenAdmin });
  assert.equal(tudo.status, 200);
  assert.equal(tudo.body.total, 5); // criado, 2 editado, inativado, senha_propria
  assert.equal(tudo.body.acoes.criado, 'Cadastro');
  assert.equal(tudo.body.campos.role, 'Papel');
  assert.ok(tudo.body.autores.some((a) => a.id === admin.id));
  const alvo = tudo.body.alvos.find((a) => a.email === 'novo@t.local');
  assert.ok(alvo);
  assert.equal(typeof tudo.body.itens[0].dados_depois, 'object'); // JSON já vem convertido

  const doAlvo = await api('GET', `/auth/usuarios/auditoria?alvo_id=${alvo.id}`, { token: tokenAdmin });
  assert.deepEqual(doAlvo.body.itens.map((i) => i.acao).reverse(), ['criado', 'editado', 'editado', 'inativado']);
  assert.equal((await api('GET', '/auth/usuarios/auditoria?acao=inativado', { token: tokenAdmin })).body.total, 1);
  assert.equal((await api('GET', `/auth/usuarios/auditoria?usuario_id=${admin.id}&acao=criado`, { token: tokenAdmin })).body.total, 1);
  assert.equal((await api('GET', '/auth/usuarios/auditoria?q=novo%40t.local', { token: tokenAdmin })).body.total, 4);
  assert.equal((await api('GET', '/auth/usuarios/auditoria?q=Novo%20Nome', { token: tokenAdmin })).body.total, 3); // o cadastro foi com o nome antigo

  const f = auditoria.montarFiltro({ acao: 'criado,hack', alvo_id: "1 OR 1=1", de: '2026-10-01', ate: 'lixo' });
  assert.deepEqual(f.params, ['criado', '2026-10-01 00:00:00']);
  assert.doesNotMatch(f.sql, /alvo_id|DATE_ADD/);
});
