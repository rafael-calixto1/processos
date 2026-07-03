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
    console.log('Adding department_id to tickets...');
    await connection.query(`
      ALTER TABLE tickets 
      ADD COLUMN department_id INT AFTER type,
      ADD CONSTRAINT fk_tickets_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    `);
    console.log('✅ Column department_id added successfully');
  } catch (error) {
    if (error.code === 'ER_DUP_COLUMN_NAME') {
      console.log('ℹ️ Column department_id already exists');
    } else if (error.code === 'ER_FK_DUP_NAME' || error.errno === 1826) {
      console.log('ℹ️ FK constraint already exists');
    } else {
      console.error('Migration failed:', error);
      process.exit(1);
    }
  } finally {
    await connection.end();
  }
};

migrate();
