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
      MODIFY COLUMN status ENUM('pendente','ativo','cancelado','manual','aguardando_pagamento') DEFAULT 'pendente'
    `);
    console.log('✓ status enum atualizado com aguardando_pagamento');

    await connection.query(`
      INSERT INTO system_settings (\`key\`, \`value\`)
      VALUES ('referral_regra_ativacao', 'ativacao')
      ON DUPLICATE KEY UPDATE \`key\` = \`key\`
    `);
    console.log('✓ configuração referral_regra_ativacao inserida');

    await connection.query(`
      INSERT INTO system_settings (\`key\`, \`value\`)
      VALUES ('referral_tipo_recompensa', 'desconto_valor')
      ON DUPLICATE KEY UPDATE \`key\` = \`key\`
    `);
    console.log('✓ configuração referral_tipo_recompensa inserida');
  } catch (err) {
    console.error('Erro na migração:', err.message);
    throw err;
  } finally {
    await connection.end();
  }
};

migrate();
