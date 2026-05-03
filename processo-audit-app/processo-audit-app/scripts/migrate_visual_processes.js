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
    console.log('Iniciando migração: visual_processes...');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS visual_processes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        nodes JSON NOT NULL,
        edges JSON NOT NULL,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    console.log('✓ Tabela visual_processes criada/verificada');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migração:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

migrate();
