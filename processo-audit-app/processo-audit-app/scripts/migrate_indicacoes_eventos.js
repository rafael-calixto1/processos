import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';
dotenv.config();

const migrate = async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  try {
    await c.query(`
      CREATE TABLE IF NOT EXISTS indicacao_eventos (
        id INT PRIMARY KEY AUTO_INCREMENT,
        id_indicacao INT NOT NULL,
        tipo VARCHAR(40) NOT NULL,
        descricao VARCHAR(500) NOT NULL,
        usuario VARCHAR(255) DEFAULT NULL,
        usuario_nome VARCHAR(255) DEFAULT NULL,
        ip VARCHAR(64) DEFAULT NULL,
        user_agent VARCHAR(500) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_indicacao (id_indicacao),
        CONSTRAINT fk_evento_indicacao FOREIGN KEY (id_indicacao) REFERENCES indicacoes(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ tabela indicacao_eventos criada');
  } catch (err) {
    console.error('Erro na migração:', err.message);
    throw err;
  } finally { await c.end(); }
};
migrate();
