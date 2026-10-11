// Apoio aos testes de integração do app mobile (mobile/scripts/rodar-integracao.mjs). SÓ roda no banco de teste.
//   DB_NAME=processo_audit_test node scripts/teste_mobile.js preparar          recria o schema e cria usuários, técnicos e itens
//   DB_NAME=processo_audit_test node scripts/teste_mobile.js cenario           cria para o João: 400 m de cabo, 50 conectores (2 lotes) e uma OS aberta
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
  } else if (comando === 'cenario') {
    const svc = await import('../src/services/estoqueService.js');
    const um = async (sql, p) => (await pool.query(sql, p))[0][0];
    const joao = await um("SELECT id FROM tecnicos WHERE nome = 'João Técnico'");
    const estoque = await um("SELECT id FROM users WHERE email = 'estoque@exemplo.com'");
    const cabo = await um("SELECT id FROM estoque_itens WHERE nome LIKE 'Cabo%'");
    const conector = await um("SELECT id FROM estoque_itens WHERE nome LIKE 'Conector%'");
    if (!joao || !estoque || !cabo || !conector) { console.error('Rode antes: node scripts/teste_mobile.js preparar'); process.exit(1); }
    const { lotes: [bobina] } = await svc.criarCompra({ item_id: cabo.id, tipo_volume: 'bobina', qtd_volumes: 1, medida_por_volume: 1000 }, estoque.id);
    await svc.retirar({ lote_id: bobina.id, tecnico_id: joao.id, quantidade: 400 }, estoque.id);
    const { lotes: unidades } = await svc.criarCompra({ item_id: conector.id, tipo_volume: 'unidade', medidas: [30, 20] }, estoque.id);
    for (const [i, l] of unidades.entries()) await svc.retirar({ lote_id: l.id, tecnico_id: joao.id, quantidade: [30, 20][i] }, estoque.id);
    const os = await svc.criarOS({ cliente: 'Rota PL-0932 → CEO-03 (teste no celular)', tecnico_id: joao.id, prazo: '2026-12-31', latitude: -23.5445, longitude: -46.3118, poste_id: 'PL-0932', tipo_servico: 'Lançamento de rota' }, estoque.id);
    saida({ os_numero: os.numero, os_id: os.id, cabo: { lote: bobina.codigo, metros_com_o_joao: 400 }, conectores: { lotes: unidades.map((l) => l.codigo), unidades_com_o_joao: 50 } });
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
    const [servicos] = await pool.query('SELECT id, descricao, trecho, quantidade, rota_trecho FROM os_servicos WHERE os_id = ? ORDER BY id', [id]);
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
