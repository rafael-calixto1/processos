import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';
dotenv.config();

/*
  Adds the columns the preventive-maintenance alert feature depends on
  to databases created before they existed:
    - fleet_maintenance_types.recurrence_mode  (km | date | both)
    - fleet_maintenance_history.total_cost
  Safe to run multiple times.
*/
const migrate = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const addColumn = async (label, sql) => {
    try {
      await connection.query(sql);
      console.log(`✅ ${label} added successfully`);
    } catch (error) {
      if (error.code === 'ER_DUP_COLUMN_NAME') {
        console.log(`ℹ️ ${label} already exists`);
      } else {
        console.error(`Migration failed (${label}):`, error);
        process.exit(1);
      }
    }
  };

  try {
    await addColumn(
      'fleet_maintenance_types.recurrence_mode',
      `ALTER TABLE fleet_maintenance_types
         ADD COLUMN recurrence_mode ENUM('km','date','both') AFTER name`
    );
    await addColumn(
      'fleet_maintenance_history.total_cost',
      `ALTER TABLE fleet_maintenance_history
         ADD COLUMN total_cost DECIMAL(10,2) AFTER maintenance_kilometers`
    );
  } finally {
    await connection.end();
  }
};

migrate();
