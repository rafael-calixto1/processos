import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';

dotenv.config();

const migrate = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('Iniciando migração: user_departments...');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_departments (
        user_id INT NOT NULL,
        department_id INT NOT NULL,
        PRIMARY KEY (user_id, department_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
      )
    `);

    console.log('✓ Tabela user_departments criada/verificada');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migração:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

migrate();
