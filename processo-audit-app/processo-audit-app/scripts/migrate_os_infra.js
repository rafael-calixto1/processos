/**
 * Migration: campos de infraestrutura e endereço estruturado nas OS.
 *
 *   node scripts/migrate_os_infra.js          # aplica (idempotente)
 *   node scripts/migrate_os_infra.js --down   # remove as colunas
 */
import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'processo_audit',
});

const COLUNAS = {
  tipo_servico: 'VARCHAR(60) NULL',
  cep: 'CHAR(8) NULL',
  logradouro: 'VARCHAR(255) NULL',
  numero_endereco: 'VARCHAR(20) NULL',
  complemento: 'VARCHAR(120) NULL',
  bairro: 'VARCHAR(120) NULL',
  cidade: 'VARCHAR(120) NULL',
  uf: 'CHAR(2) NULL',
  latitude: 'DECIMAL(10,7) NULL',
  longitude: 'DECIMAL(10,7) NULL',
  pop_nome: 'VARCHAR(100) NULL',
  rota_id: 'VARCHAR(60) NULL',
  poste_id: 'VARCHAR(60) NULL',
};

const [existentes] = await conn.query(
  `SELECT COLUMN_NAME n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ordens_servico'`);
const tem = new Set(existentes.map((r) => r.n));

for (const [nome, def] of Object.entries(COLUNAS)) {
  if (process.argv.includes('--down')) {
    if (tem.has(nome)) await conn.query(`ALTER TABLE ordens_servico DROP COLUMN ${nome}`);
  } else if (!tem.has(nome)) {
    await conn.query(`ALTER TABLE ordens_servico ADD COLUMN ${nome} ${def}`);
  }
}
// Lançamento = linha de serviço da OS (os_servicos) + trecho + materiais baixados vinculados (estoque_movimentacoes.servico_id)
const extra = async (tabela, coluna, def, indice) => {
  const [r] = await conn.query('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [tabela, coluna]);
  if (process.argv.includes('--down')) { if (r.length) await conn.query(`ALTER TABLE ${tabela} DROP COLUMN ${coluna}`); return; }
  if (!r.length) { await conn.query(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${def}`); if (indice) await conn.query(`ALTER TABLE ${tabela} ADD INDEX ${indice} (${coluna})`); }
};
await extra('os_servicos', 'trecho', 'VARCHAR(255) NULL');
await extra('estoque_movimentacoes', 'servico_id', 'INT NULL', 'idx_mov_servico');

const PADRAO = ['Lançamento de rota', 'Manutenção de CEO/CTO', 'Manutenção de POP', 'Rompimento de fibra', 'Instalação de poste/ferragem', 'Vistoria de rota', 'Outro'];
if (process.argv.includes('--down')) {
  await conn.query('DROP TABLE IF EXISTS os_tipos_servico');
} else {
  await conn.query(`CREATE TABLE IF NOT EXISTS os_tipos_servico (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(60) NOT NULL UNIQUE,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  for (const n of PADRAO) await conn.query('INSERT IGNORE INTO os_tipos_servico (nome) VALUES (?)', [n]);
}
console.log(process.argv.includes('--down') ? 'colunas de infra removidas' : 'ordens_servico com campos de infra');
await conn.end();
