import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';
dotenv.config();

const migrate = async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  try {
    await c.query(`
      ALTER TABLE indicacoes
      ADD COLUMN plano_codigo VARCHAR(30) DEFAULT NULL,
      ADD COLUMN plano_nome VARCHAR(100) DEFAULT NULL,
      ADD COLUMN plano_velocidade VARCHAR(60) DEFAULT NULL,
      ADD COLUMN plano_valor DECIMAL(10,2) DEFAULT NULL
    `);
    console.log('✓ colunas do plano escolhido adicionadas à tabela indicacoes');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') console.log('! colunas já existem');
    else { console.error('Erro na migração:', err.message); throw err; }
  } finally { await c.end(); }
};
migrate();
