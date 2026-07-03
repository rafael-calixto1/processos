import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';
dotenv.config();

const migrate = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS indicacoes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        id_cliente_indicador INT NOT NULL,
        nome_indicador VARCHAR(255),
        id_cliente_indicado INT NOT NULL,
        nome_indicado VARCHAR(255),
        status ENUM('pendente', 'ativo', 'cancelado') DEFAULT 'pendente',
        valor_desconto DECIMAL(10,2) DEFAULT NULL,
        id_evento_faturamento INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_indicacao (id_cliente_indicador, id_cliente_indicado)
      )
    `);
    console.log('✓ tabela indicacoes criada');
  } catch (err) {
    console.error('Erro na migração:', err.message);
    throw err;
  } finally {
    await connection.end();
  }
};

migrate();
