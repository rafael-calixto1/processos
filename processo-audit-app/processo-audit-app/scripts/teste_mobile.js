// Apoio aos testes de integração do app mobile (mobile/scripts/rodar-integracao.mjs). SÓ roda no banco de teste.
//   DB_NAME=processo_audit_test node scripts/teste_mobile.js preparar          recria o schema e cria usuários, técnicos e itens
//   DB_NAME=processo_audit_test node scripts/teste_mobile.js movimentacoes 12   movimentações de estoque da OS 12
//   DB_NAME=processo_audit_test node scripts/teste_mobile.js fechamento 12      OS, fechamento, fotos, retirados e rascunho
//   DB_NAME=processo_audit_test node scripts/teste_mobile.js posse 5 2 50        muda a posse do técnico 2 no lote 5 (simula o estoque mexendo)
//   DB_NAME=processo_audit_test node scripts/teste_mobile.js reatribuir 12 3     passa a OS 12 para o técnico 3
if (process.env.DB_NAME !== 'processo_audit_test') {
  console.error('Recusado: este script só roda com DB_NAME=processo_audit_test (escrito explicitamente).');
  process.exit(2);
}
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const [, , comando, ...args] = process.argv;
const { default: pool } = await import('../src/config/database.js');
const [[{ db }]] = await pool.query('SELECT DATABASE() AS db');
if (db !== 'processo_audit_test') { console.error(`Recusado: conectado em "${db}".`); process.exit(2); }
const saida = (v) => console.log(JSON.stringify(v));

try {
  if (comando === 'preparar') {
    const { prepararBanco } = await import('../tests/helpers/db.js');
    const bcrypt = (await import('bcryptjs')).default;
    const liberar = await prepararBanco();
    try {
      const hash = await bcrypt.hash('senha123', 10);
      const user = async (email, nome, role) => (await pool.query('INSERT INTO users (email,password,name,role) VALUES (?,?,?,?)', [email, hash, nome, role]))[0].insertId;
      const ins = async (sql, p) => (await pool.query(sql, p))[0].insertId;
      const admin = await user('admin@exemplo.com', 'Admin Teste', 'admin');
      const estoque = await user('estoque@exemplo.com', 'Maria do Estoque', 'estoque');
      const uJoao = await user('joao@exemplo.com', 'João Técnico', 'tecnico');
      const uMaria = await user('ana@exemplo.com', 'Ana Técnica', 'tecnico');
      const joao = await ins("INSERT INTO tecnicos (nome,tipo,usuario_id) VALUES ('João Técnico','interno',?)", [uJoao]);
      const ana = await ins("INSERT INTO tecnicos (nome,tipo,usuario_id) VALUES ('Ana Técnica','interno',?)", [uMaria]);
      const apoio = await ins("INSERT INTO tecnicos (nome,tipo,empresa) VALUES ('Equipe Apoio','terceirizado','Apoio Ltda')");
      const cabo = await ins("INSERT INTO estoque_itens (nome,unidade) VALUES ('Cabo óptico ASU 12F','metros')");
      const conector = await ins("INSERT INTO estoque_itens (nome,unidade) VALUES ('Conector SC/APC','pecas')");
      const svc = await import('../src/services/estoqueService.js');
      await svc.criarOS({ cliente: 'Rota PL-900 → CEO-00 (semente)', tecnico_id: joao, prazo: '2026-12-31', latitude: -23.5445, longitude: -46.3118, poste_id: 'PL-0900', tipo_servico: 'Lançamento de rota' }, estoque);
      saida({ senha: 'senha123', usuarios: { admin: 'admin@exemplo.com', estoque: 'estoque@exemplo.com', joao: 'joao@exemplo.com', ana: 'ana@exemplo.com' }, ids: { admin, estoque, joao, ana, apoio, cabo, conector } });
    } finally { await liberar(); }
  } else if (comando === 'movimentacoes') {
    const [rows] = await pool.query('SELECT id, tipo, lote_id, item_id, quantidade, os_id, servico_id, estorno_de_id FROM estoque_movimentacoes WHERE os_id = ? ORDER BY id', [Number(args[0])]);
    saida(rows.map((r) => ({ ...r, quantidade: Number(r.quantidade) })));
  } else if (comando === 'fechamento') {
    const id = Number(args[0]);
    const [[os]] = await pool.query('SELECT id, status, tecnico_id, iniciado_em, concluida_em FROM ordens_servico WHERE id = ?', [id]);
    const [[f]] = await pool.query('SELECT * FROM os_fechamentos WHERE os_id = ?', [id]);
    const [fotos] = await pool.query('SELECT id, arquivo, mime, tamanho, client_uuid, lat, lng FROM os_fotos WHERE os_id = ? ORDER BY id', [id]);
    const [retirados] = await pool.query('SELECT item_id, descricao, quantidade, unidade, condicao FROM os_materiais_retirados WHERE os_id = ? ORDER BY id', [id]);
    const [[{ n: rascunhos }]] = await pool.query('SELECT COUNT(*) AS n FROM os_rascunhos WHERE os_id = ?', [id]);
    const [servicos] = await pool.query('SELECT id, descricao, trecho, quantidade FROM os_servicos WHERE os_id = ? ORDER BY id', [id]);
    saida({ os, fechamento: f ?? null, fotos, retirados: retirados.map((r) => ({ ...r, quantidade: Number(r.quantidade) })), rascunhos, servicos });
  } else if (comando === 'posse') {
    const [r] = await pool.query('UPDATE estoque_posse SET quantidade = ? WHERE lote_id = ? AND tecnico_id = ?', [Number(args[2]), Number(args[0]), Number(args[1])]);
    saida({ alteradas: r.affectedRows });
  } else if (comando === 'reatribuir') {
    const [r] = await pool.query('UPDATE ordens_servico SET tecnico_id = ? WHERE id = ?', [Number(args[1]), Number(args[0])]);
    saida({ alteradas: r.affectedRows });
  } else {
    console.error('Comando desconhecido.'); process.exit(1);
  }
} finally {
  await pool.end();
}
