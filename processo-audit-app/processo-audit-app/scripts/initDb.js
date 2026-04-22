import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';

dotenv.config();

const initDb = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    // Criar banco de dados
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
    console.log(`✓ Banco de dados '${process.env.DB_NAME}' criado/verificado`);

    // Usar o banco de dados
    await connection.query(`USE ${process.env.DB_NAME}`);

    // Tabela de usuários
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role ENUM('admin', 'manager', 'viewer') DEFAULT 'viewer',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Tabela users criada');

    // Tabela de departamentos
    await connection.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Tabela departments criada');

    // Tabela de processos
    await connection.query(`
      CREATE TABLE IF NOT EXISTS processes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        department_id INT NOT NULL,
        created_by INT NOT NULL,
        updated_by INT,
        version INT DEFAULT 1,
        status ENUM('draft', 'active', 'archived') DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (updated_by) REFERENCES users(id)
      )
    `);
    console.log('✓ Tabela processes criada');

    // Tabela de passos/checklist
    await connection.query(`
      CREATE TABLE IF NOT EXISTS steps (
        id INT PRIMARY KEY AUTO_INCREMENT,
        process_id INT NOT NULL,
        step_number INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        documentation_link VARCHAR(255),
        documentation_markdown LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (process_id) REFERENCES processes(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ Tabela steps criada');

    // Tabela de logs de auditoria
    await connection.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        process_id INT NOT NULL,
        user_id INT NOT NULL,
        action VARCHAR(50) NOT NULL,
        old_data JSON,
        new_data JSON,
        ip_address VARCHAR(45),
        user_agent VARCHAR(500),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (process_id) REFERENCES processes(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id),
        INDEX idx_process (process_id),
        INDEX idx_user (user_id),
        INDEX idx_timestamp (timestamp)
      )
    `);
    console.log('✓ Tabela audit_logs criada');

    // Tabela de branding/identidade visual
    await connection.query(`
      CREATE TABLE IF NOT EXISTS branding (
        id INT PRIMARY KEY AUTO_INCREMENT,
        company_name VARCHAR(255) NOT NULL,
        logo_url VARCHAR(500),
        primary_color VARCHAR(7) DEFAULT '#0ba52b',
        secondary_color VARCHAR(7) DEFAULT '#bbf804',
        accent_color VARCHAR(7) DEFAULT '#274518',
        background_color VARCHAR(7) DEFAULT '#ffffff',
        favicon_url VARCHAR(500),
        updated_by INT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (updated_by) REFERENCES users(id)
      )
    `);
    console.log('✓ Tabela branding criada');

    // Tabela de sessões de execução de processos
    await connection.query(`
      CREATE TABLE IF NOT EXISTS process_executions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        process_id INT NOT NULL,
        user_id INT NOT NULL,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL,
        status ENUM('in_progress', 'completed', 'abandoned') DEFAULT 'in_progress',
        FOREIGN KEY (process_id) REFERENCES processes(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        INDEX idx_status (status)
      )
    `);
    console.log('✓ Tabela process_executions criada');

    // Tabela de passos executados
    await connection.query(`
      CREATE TABLE IF NOT EXISTS step_executions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        execution_id INT NOT NULL,
        step_id INT NOT NULL,
        completed_at TIMESTAMP NULL,
        notes VARCHAR(500),
        completed_by INT,
        FOREIGN KEY (execution_id) REFERENCES process_executions(id) ON DELETE CASCADE,
        FOREIGN KEY (step_id) REFERENCES steps(id),
        FOREIGN KEY (completed_by) REFERENCES users(id)
      )
    `);
    console.log('✓ Tabela step_executions criada');

    console.log('\n✅ Banco de dados inicializado com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

initDb();
