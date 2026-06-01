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
    console.log('Iniciando migração: soft-delete (inativação)...');

    const addStatusIfMissing = async (table, defaultVal = 'active') => {
      const [cols] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'status'`,
        [process.env.DB_NAME, table]
      );
      if (cols.length === 0) {
        await connection.query(
          `ALTER TABLE ${table}
           ADD COLUMN status ENUM('active','inactive') NOT NULL DEFAULT '${defaultVal}'`
        );
        console.log(`✓ Coluna status adicionada em ${table}`);
      } else {
        console.log(`• ${table}.status já existe — ignorado`);
      }
    };

    await addStatusIfMissing('departments');
    await addStatusIfMissing('users');
    await addStatusIfMissing('visual_processes');
    await addStatusIfMissing('files');
    await addStatusIfMissing('folders');

    console.log('\n✅ Migração soft-delete concluída!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migração:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

migrate();
