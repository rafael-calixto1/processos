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
      ALTER TABLE indicacoes
      ADD COLUMN regra_ativacao ENUM('ativacao','primeira_fatura_paga') DEFAULT NULL AFTER valor_desconto,
      ADD COLUMN tipo_recompensa ENUM('desconto_valor','remover_fatura') DEFAULT NULL AFTER regra_ativacao
    `);
    console.log('✓ colunas regra_ativacao e tipo_recompensa adicionadas à tabela indicacoes');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('! colunas já existem');
    } else {
      console.error('Erro na migração:', err.message);
      throw err;
    }
  } finally {
    await connection.end();
  }
};

migrate();
