import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';
dotenv.config();

// A API do Hubsoft só aplica o evento de faturamento de desconto na PRÓXIMA fatura a ser
// gerada — nunca em uma fatura que já existe. Se o indicador já tinha uma fatura em aberto
// no momento em que a recompensa foi concedida, o desconto necessariamente ficou adiado
// para o ciclo seguinte. Essa coluna registra esse fato para exibirmos isso claramente no
// painel, em vez de dar a entender que a fatura atual foi alterada.
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
      ADD COLUMN desconto_adiado TINYINT(1) DEFAULT 0 AFTER fatura_referencia
    `);
    console.log('✓ coluna desconto_adiado adicionada à tabela indicacoes');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('! coluna desconto_adiado já existe');
    } else {
      console.error('Erro na migração:', err.message);
      throw err;
    }
  } finally {
    await connection.end();
  }
};

migrate();
