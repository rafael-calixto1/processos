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
      ADD COLUMN fatura_referencia VARCHAR(50) DEFAULT NULL AFTER id_evento_faturamento
    `);
    console.log('✓ coluna fatura_referencia adicionada à tabela indicacoes');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('! coluna fatura_referencia já existe');
    } else {
      console.error('Erro na migração:', err.message);
      throw err;
    }
  } finally {
    await connection.end();
  }
};

migrate();
