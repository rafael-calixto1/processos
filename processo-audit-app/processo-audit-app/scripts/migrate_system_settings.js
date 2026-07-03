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
      CREATE TABLE IF NOT EXISTS system_settings (
        \`key\`       VARCHAR(100) PRIMARY KEY,
        \`value\`     TEXT NOT NULL,
        updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      INSERT INTO system_settings (\`key\`, \`value\`)
      VALUES ('referral_desconto_valor', '10')
      ON DUPLICATE KEY UPDATE \`key\` = \`key\`
    `);

    console.log('✓ tabela system_settings criada');
  } catch (err) {
    console.error('Erro na migração:', err.message);
    throw err;
  } finally {
    await connection.end();
  }
};

migrate();
