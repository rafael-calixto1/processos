/**
 * Seed de DEMONSTRAÇÃO (somente desenvolvimento): itens, lotes, técnicos, OS e usuários de teste.
 *   SEED_PASSWORD=algumaSenha node scripts/seed_estoque.js
 * Sem SEED_PASSWORD, gera uma senha aleatória e imprime no console. Não commite senhas reais.
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import pool from '../src/config/database.js';
import * as svc from '../src/services/estoqueService.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Seed de demonstração bloqueado em produção.');
  process.exit(1);
}

const senha = process.env.SEED_PASSWORD || crypto.randomBytes(6).toString('base64url');
const hash = await bcrypt.hash(senha, 10);

const upsertUser = async (email, name, role) => {
  const [[u]] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (u) { await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, u.id]); return u.id; }
  return (await pool.query('INSERT INTO users (email, password, name, role) VALUES (?,?,?,?)', [email, hash, name, role]))[0].insertId;
};

try {
  const almoxId = await upsertUser('estoque@demo.local', 'Almoxarife Demo', 'estoque');
  const tecUserId = await upsertUser('tecnico@demo.local', 'Técnico Demo', 'tecnico');

  const tecnico = async (nome, tipo, empresa, usuario_id) => {
    const [[t]] = await pool.query('SELECT id FROM tecnicos WHERE nome = ?', [nome]);
    if (t) return t.id;
    return (await pool.query('INSERT INTO tecnicos (nome, tipo, empresa, usuario_id) VALUES (?,?,?,?)', [nome, tipo, empresa, usuario_id]))[0].insertId;
  };
  const t1 = await tecnico('Técnico Demo', 'interno', null, tecUserId);
  const t2 = await tecnico('Equipe Fibra Sul (terceirizada)', 'terceirizado', 'Fibra Sul Ltda', null);

  const item = async (nome, categoria, unidade, min) => {
    const [[i]] = await pool.query('SELECT id FROM estoque_itens WHERE nome = ?', [nome]);
    if (i) return i.id;
    return (await pool.query('INSERT INTO estoque_itens (nome, categoria, unidade, estoque_minimo) VALUES (?,?,?,?)', [nome, categoria, unidade, min]))[0].insertId;
  };
  const cabo = await item('Cabo Drop 1FO', 'Cabos', 'metros', 1000);
  const conector = await item('Conector SC/APC', 'Conectores', 'pecas', 100);
  await item('Caixa CTO 16 portas', 'Caixas', 'pecas', 5);

  const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM estoque_lotes');
  if (n === 0) {
    const bob = await svc.criarCompra({ item_id: cabo, tipo_volume: 'bobina', qtd_volumes: 1, medida_por_volume: 2000, nf: 'DEMO-001' }, almoxId);
    const cx = await svc.criarCompra({ item_id: conector, tipo_volume: 'caixa', qtd_volumes: 1, medida_por_volume: 200, nf: 'DEMO-002' }, almoxId);
    await svc.retirar({ lote_id: bob.lotes[0].id, tecnico_id: t1, quantidade: 500 }, almoxId);
    await svc.retirar({ lote_id: cx.lotes[0].id, tecnico_id: t1, quantidade: 50 }, almoxId);
    await svc.criarOS({ cliente: 'Maria Souza', endereco: 'Rua das Flores, 100 - Suzano/SP', tecnico_id: t1, prioridade: 'alta', descricao: 'Instalação FTTH' }, almoxId);
    await svc.criarOS({ cliente: 'João Lima', endereco: 'Av. Brasil, 250 - Suzano/SP', tecnico_id: t2, descricao: 'Troca de drop' }, almoxId);
  }
  console.log('✅ Seed de estoque concluído');
  console.log('   estoque@demo.local / tecnico@demo.local — senha:', process.env.SEED_PASSWORD ? '(a definida em SEED_PASSWORD)' : senha);
} finally {
  await pool.end();
}
