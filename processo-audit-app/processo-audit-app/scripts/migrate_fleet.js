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
      CREATE TABLE IF NOT EXISTS fleet_drivers (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        license_number VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ fleet_drivers');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS fleet_cars (
        id INT PRIMARY KEY AUTO_INCREMENT,
        make VARCHAR(100) NOT NULL,
        model VARCHAR(100) NOT NULL,
        license_plate VARCHAR(20) NOT NULL,
        current_kilometers DECIMAL(10,0),
        next_tire_change DECIMAL(10,0),
        next_oil_change DECIMAL(10,0),
        driver_id INT,
        status ENUM('active','inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (driver_id) REFERENCES fleet_drivers(id) ON DELETE SET NULL
      )
    `);
    console.log('✓ fleet_cars');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS fleet_fueling (
        id INT PRIMARY KEY AUTO_INCREMENT,
        car_id INT NOT NULL,
        fuel_date DATE NOT NULL,
        fueling_kilometers DECIMAL(10,0),
        fuel_amount DECIMAL(10,2),
        liters_quantity DECIMAL(10,3),
        price_per_liter DECIMAL(10,3),
        total_cost DECIMAL(10,2),
        fuel_type ENUM('Gasolina','Etanol','Diesel','GNV') DEFAULT 'Gasolina',
        observation TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (car_id) REFERENCES fleet_cars(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ fleet_fueling');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS fleet_oil_changes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        car_id INT NOT NULL,
        oil_change_date DATE NOT NULL,
        oil_change_kilometers DECIMAL(10,0),
        liters_quantity DECIMAL(10,3),
        price_per_liter DECIMAL(10,3),
        total_cost DECIMAL(10,2),
        observation TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (car_id) REFERENCES fleet_cars(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ fleet_oil_changes');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS fleet_tire_changes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        car_id INT NOT NULL,
        tire_change_date DATE NOT NULL,
        tire_change_kilometers DECIMAL(10,0),
        observation TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (car_id) REFERENCES fleet_cars(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ fleet_tire_changes');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS fleet_maintenance_types (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        recurrence_mode ENUM('km','date','both'),
        recurrency INT,
        recurrency_date INT,
        status ENUM('active','inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ fleet_maintenance_types');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS fleet_maintenance_history (
        id INT PRIMARY KEY AUTO_INCREMENT,
        car_id INT NOT NULL,
        maintenance_type_id INT,
        maintenance_date DATE NOT NULL,
        maintenance_kilometers DECIMAL(10,0),
        total_cost DECIMAL(10,2),
        observation TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (car_id) REFERENCES fleet_cars(id) ON DELETE CASCADE,
        FOREIGN KEY (maintenance_type_id) REFERENCES fleet_maintenance_types(id) ON DELETE SET NULL
      )
    `);
    console.log('✓ fleet_maintenance_history');

    console.log('\n✅ Fleet migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

migrate();
