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

  const colunas = [
    ['fatura_atual_vencimento', 'DATE DEFAULT NULL'],
    ['fatura_atual_baixa', 'DATE DEFAULT NULL'],
    ['fatura_atual_status', 'VARCHAR(20) DEFAULT NULL'],
  ];

  try {
    for (const [nome, tipo] of colunas) {
      try {
        await connection.query(`ALTER TABLE indicacoes ADD COLUMN ${nome} ${tipo}`);
        console.log(`✓ coluna ${nome} adicionada à tabela indicacoes`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log(`! coluna ${nome} já existe`);
        } else {
          throw err;
        }
      }
    }
  } finally {
    await connection.end();
  }
};

migrate();
