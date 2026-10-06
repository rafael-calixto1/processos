/**
 * Migration: aprovação de devoluções de técnicos.
 *
 *   node scripts/migrate_estoque_devolucoes.js          # aplica (idempotente)
 *   node scripts/migrate_estoque_devolucoes.js --down   # remove a tabela
 *
 * O técnico solicita a devolução (status `pendente`, a posse não muda). Um usuário
 * admin/estoque aprova (a devolução é efetivada em estoque_movimentacoes) ou nega.
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

if (process.argv.includes('--down')) {
  await conn.query('DROP TABLE IF EXISTS estoque_devolucoes');
  console.log('estoque_devolucoes removida');
} else {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS estoque_devolucoes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      lote_id INT NOT NULL,
      item_id INT NOT NULL,
      tecnico_id INT NOT NULL,
      quantidade DECIMAL(12,2) NOT NULL,
      condicao ENUM('novo','usado') NOT NULL,
      observacao VARCHAR(500) NULL,
      status ENUM('pendente','aprovada','negada') NOT NULL DEFAULT 'pendente',
      solicitado_por INT NOT NULL,
      solicitado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revisado_por INT NULL,
      revisado_em TIMESTAMP NULL,
      motivo_negacao VARCHAR(500) NULL,
      movimentacao_id INT NULL,
      INDEX idx_dev_status (status),
      INDEX idx_dev_tecnico (tecnico_id, status),
      INDEX idx_dev_lote (lote_id),
      CONSTRAINT fk_dev_lote FOREIGN KEY (lote_id) REFERENCES estoque_lotes(id),
      CONSTRAINT fk_dev_item FOREIGN KEY (item_id) REFERENCES estoque_itens(id),
      CONSTRAINT fk_dev_tecnico FOREIGN KEY (tecnico_id) REFERENCES tecnicos(id),
      CONSTRAINT fk_dev_solicitante FOREIGN KEY (solicitado_por) REFERENCES users(id),
      CONSTRAINT fk_dev_revisor FOREIGN KEY (revisado_por) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('estoque_devolucoes pronta');
}
await conn.end();
