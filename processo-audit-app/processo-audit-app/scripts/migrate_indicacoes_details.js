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
      ADD COLUMN data_faturamento DATE DEFAULT NULL AFTER fatura_referencia,
      ADD COLUMN data_vencimento DATE DEFAULT NULL AFTER data_faturamento
    `);
    console.log('✓ colunas data_faturamento e data_vencimento adicionadas à tabela indicacoes');
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
