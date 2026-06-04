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
    console.log('Iniciando migração: step sections...');

    // Adicionar coluna section na tabela steps
    const [cols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'section'`,
      [process.env.DB_NAME, 'steps']
    );

    if (cols.length === 0) {
      await connection.query(
        `ALTER TABLE steps
         ADD COLUMN section VARCHAR(255) DEFAULT NULL`
      );
      console.log('✓ Coluna section adicionada em steps');
    } else {
      console.log('• steps.section já existe — ignorado');
    }

    console.log('\n✅ Migração step sections concluída!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migração:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

migrate();
