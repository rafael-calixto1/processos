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
    console.log('Iniciando migração de arquivos...');

    // Tabela de pastas
    await connection.query(`
      CREATE TABLE IF NOT EXISTS folders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        parent_id INT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('✓ Tabela folders criada');

    // Tabela de arquivos
    await connection.query(`
      CREATE TABLE IF NOT EXISTS files (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        folder_id INT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_type VARCHAR(100),
        file_size INT,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('✓ Tabela files criada');

    console.log('✅ Migração concluída com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migração:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

migrate();
