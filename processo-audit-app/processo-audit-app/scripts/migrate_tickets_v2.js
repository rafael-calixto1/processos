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

  const addColumn = async (sql, name) => {
    try {
      await connection.query(sql);
      console.log(`✓ ${name}`);
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log(`  (already exists) ${name}`);
      } else {
        throw err;
      }
    }
  };

  try {
    await addColumn(
      `ALTER TABLE tickets ADD COLUMN type ENUM('task','bug','story','feature') NOT NULL DEFAULT 'task' AFTER priority`,
      'tickets.type'
    );

    await addColumn(
      `ALTER TABLE tickets ADD COLUMN due_date DATE NULL AFTER assigned_to`,
      'tickets.due_date'
    );

    await connection.query(`
      CREATE TABLE IF NOT EXISTS ticket_labels (
        id INT PRIMARY KEY AUTO_INCREMENT,
        ticket_id INT NOT NULL,
        label VARCHAR(60) NOT NULL,
        color VARCHAR(7) NOT NULL DEFAULT '#6366f1',
        UNIQUE KEY uq_ticket_label (ticket_id, label),
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ ticket_labels');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS ticket_activity (
        id INT PRIMARY KEY AUTO_INCREMENT,
        ticket_id INT NOT NULL,
        user_id INT NOT NULL,
        action VARCHAR(30) NOT NULL,
        field VARCHAR(50),
        old_value TEXT,
        new_value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ ticket_activity');

    console.log('\n✅ Tickets v2 migration completed');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

migrate();
