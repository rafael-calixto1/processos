// migrate_os_mobile: sobe, desce e sobe de novo; semeia os catálogos; restrições principais.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { pool, prepararBanco } from './helpers/db.js';
import { up, down } from '../scripts/migrate_os_mobile.js';

let liberarBanco, userId, osId;
const NOVAS = ['os_motivos_fechamento', 'os_checklist_itens', 'os_fechamentos', 'os_fotos', 'os_materiais_retirados', 'sync_operacoes', 'refresh_tokens'];

const tabelas = async () => {
  const [r] = await pool.query('SELECT TABLE_NAME n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()');
  return new Set(r.map((x) => x.n));
};
const colunas = async (t) => {
  const [r] = await pool.query('SELECT COLUMN_NAME n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [t]);
  return new Set(r.map((x) => x.n));
};
const conn = async (fn) => { const c = await pool.getConnection(); try { return await fn(c); } finally { c.release(); } };

before(async () => {
  liberarBanco = await prepararBanco();
  const [u] = await pool.query("INSERT INTO users (email,password,name,role) VALUES ('t@t.local','x','T','tecnico')");
  userId = u.insertId;
  const [t] = await pool.query("INSERT INTO tecnicos (nome,tipo,usuario_id) VALUES ('Téc','interno',?)", [userId]);
  const [o] = await pool.query("INSERT INTO ordens_servico (numero,cliente,tecnico_id,criado_por) VALUES (1,'C',?,?)", [t.insertId, userId]);
  osId = o.insertId;
});
after(async () => { await liberarBanco?.(); await pool.end(); });

test('up é idempotente e cria tabelas, colunas e catálogos semeados', async () => {
  await conn(up); await conn(up); // segunda vez não pode falhar nem duplicar
  const t = await tabelas();
  for (const n of NOVAS) assert.ok(t.has(n), `faltou a tabela ${n}`);
  const cols = await colunas('ordens_servico');
  assert.ok(cols.has('iniciado_em') && cols.has('atualizado_em'));
  const [[m]] = await pool.query('SELECT COUNT(*) n FROM os_motivos_fechamento');
  const [[c]] = await pool.query("SELECT COUNT(*) n, SUM(obrigatorio) obrig FROM os_checklist_itens");
  assert.equal(m.n, 6);
  assert.equal(c.n, 7);
  assert.equal(Number(c.obrig), 6);
});

test('atualizado_em muda quando a OS muda (base da sincronização incremental)', async () => {
  const [[antes]] = await pool.query('SELECT atualizado_em a FROM ordens_servico WHERE id = ?', [osId]);
  await new Promise((r) => setTimeout(r, 1100));
  await pool.query("UPDATE ordens_servico SET prioridade = 'alta' WHERE id = ?", [osId]);
  const [[depois]] = await pool.query('SELECT atualizado_em a FROM ordens_servico WHERE id = ?', [osId]);
  assert.ok(new Date(depois.a) > new Date(antes.a));
});

test('restrições: um fechamento por OS, uuid único, JSON válido e coordenadas dentro do intervalo', async () => {
  const [[mot]] = await pool.query('SELECT id, rotulo FROM os_motivos_fechamento LIMIT 1');
  const base = (over = {}) => ({
    os_id: osId, descricao: 'Descrição longa o bastante', motivo_id: mot.id, motivo_rotulo: mot.rotulo, local_lat: -23.5, local_lng: -46.3,
    local_origem: 'gps', checklist: '[]', participantes: '[]', materiais_usados: 0, materiais_retirados: 0,
    client_uuid: '11111111-1111-4111-8111-111111111111', finalizado_por: userId, ...over,
  });
  const ins = (o) => pool.query('INSERT INTO os_fechamentos SET ?', [o]);
  await assert.rejects(ins(base({ checklist: 'isto não é json' })));
  await assert.rejects(ins(base({ local_lat: 91 })));
  await ins(base());
  await assert.rejects(ins(base({ client_uuid: '22222222-2222-4222-8222-222222222222' })), /Duplicate/); // 2º fechamento da mesma OS
});

test('idempotência é por usuário: mesma chave de outro usuário não colide, a do mesmo sim', async () => {
  const [o] = await pool.query("INSERT INTO users (email,password,name,role) VALUES ('o@t.local','x','O','tecnico')");
  const ins = (uid) => pool.query("INSERT INTO sync_operacoes (usuario_id, chave, rota, hash_corpo) VALUES (?, 'k-1', 'POST /x', ?)", [uid, 'a'.repeat(64)]);
  await ins(userId);
  await ins(o.insertId);
  await assert.rejects(ins(userId), /Duplicate/);
});

test('down remove tudo e as colunas; up depois recria sem perda de estrutura', async () => {
  await conn(down);
  const t = await tabelas();
  for (const n of NOVAS) assert.ok(!t.has(n), `${n} deveria ter sido removida`);
  const cols = await colunas('ordens_servico');
  assert.ok(!cols.has('iniciado_em') && !cols.has('atualizado_em'));
  await conn(down); // idempotente também
  await conn(up);
  assert.ok((await tabelas()).has('os_fechamentos'));
});

test('com a migração revertida, a lista e o detalhe de OS usados pelo web continuam funcionando', async () => {
  await conn(down);
  const express = (await import('express')).default;
  const jwt = (await import('jsonwebtoken')).default;
  const { default: osRouter } = await import('../src/routes/os.js');
  const app = express(); app.use(express.json()); app.use('/api/os', osRouter);
  const srv = await new Promise((ok) => { const s = app.listen(0, () => ok(s)); });
  try {
    const call = (path) => fetch(`http://127.0.0.1:${srv.address().port}/api/os${path}`, {
      headers: { Authorization: `Bearer ${jwt.sign({ id: userId, role: 'tecnico', email: 't@t.local' }, process.env.JWT_SECRET)}` },
    });
    const lista = await call('');
    assert.equal(lista.status, 200);
    assert.ok((await lista.json()).some((o) => o.id === osId));
    assert.equal((await call(`/${osId}`)).status, 200);
  } finally { srv.close(); await conn(up); }
});

test('CLI recusa rodar sem DB_NAME explícito no comando (não usa o .env)', () => {
  const env = { ...process.env }; delete env.DB_NAME;
  let saida = '', codigo = 0;
  try { execFileSync(process.execPath, ['scripts/migrate_os_mobile.js'], { env, stdio: 'pipe' }); }
  catch (e) { codigo = e.status; saida = String(e.stderr); }
  assert.equal(codigo, 1);
  assert.match(saida, /Informe o banco no comando/);
});
