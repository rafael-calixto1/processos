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
      if (err.code === 'ER_DUP_FIELDNAME') console.log(`  (already exists) ${name}`);
      else throw err;
    }
  };

  try {
    /* 1. Global labels table */
    await connection.query(`
      CREATE TABLE IF NOT EXISTS labels (
        id         INT PRIMARY KEY AUTO_INCREMENT,
        name       VARCHAR(60) NOT NULL,
        color      VARCHAR(7)  NOT NULL DEFAULT '#6366f1',
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_label_name (name),
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('✓ labels');

    /* 2. Migrate any existing ticket_labels rows into the labels table */
    const [[{ cnt }]] = await connection.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'ticket_labels' AND column_name = 'label'`
    );

    if (cnt > 0) {
      await connection.query(`
        INSERT IGNORE INTO labels (name, color)
        SELECT DISTINCT label, IFNULL(color,'#6366f1') FROM ticket_labels
      `);
      console.log('  migrated existing labels');
    }

    /* 3. Add label_id FK column to ticket_labels */
    await addColumn(
      `ALTER TABLE ticket_labels ADD COLUMN label_id INT`,
      'ticket_labels.label_id'
    );

    /* 4. Back-fill label_id from names */
    if (cnt > 0) {
      await connection.query(`
        UPDATE ticket_labels tl
        JOIN labels l ON l.name = tl.label
        SET tl.label_id = l.id
        WHERE tl.label_id IS NULL
      `);
    }

    /* 5. Add FK constraint (ignore if already exists) */
    try {
      await connection.query(`
        ALTER TABLE ticket_labels
          ADD CONSTRAINT fk_tl_label FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
      `);
      console.log('✓ FK ticket_labels.label_id');
    } catch (err) {
      if (err.code !== 'ER_FK_DUP_NAME' && err.errno !== 1826) throw err;
      console.log('  (FK already exists)');
    }

    /* 6. Drop old columns that are no longer needed */
    if (cnt > 0) {
      await connection.query(`ALTER TABLE ticket_labels DROP COLUMN label`);
      console.log('✓ dropped ticket_labels.label');
    }
    const [[{ hasCColor }]] = await connection.query(
      `SELECT COUNT(*) AS hasCColor FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'ticket_labels' AND column_name = 'color'`
    );
    if (hasCColor > 0) {
      await connection.query(`ALTER TABLE ticket_labels DROP COLUMN color`);
      console.log('✓ dropped ticket_labels.color');
    }

    /* 7. Unique constraint on (ticket_id, label_id) */
    try {
      await connection.query(`ALTER TABLE ticket_labels ADD UNIQUE KEY uq_ticket_label (ticket_id, label_id)`);
      console.log('✓ uq_ticket_label');
    } catch (err) {
      if (err.code !== 'ER_DUP_KEYNAME') throw err;
      console.log('  (unique key already exists)');
    }

    console.log('\n✅ Tickets v3 migration completed');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

migrate();
