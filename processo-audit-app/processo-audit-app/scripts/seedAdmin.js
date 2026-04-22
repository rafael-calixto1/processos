import mysql from 'mysql2/promise.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const seedAdmin = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const email = 'admin@empresa.com';
    const password = 'admin123';
    const name = 'Administrador';
    const role = 'admin';

    const hashedPassword = await bcrypt.hash(password, 10);

    const [existing] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);

    if (existing.length > 0) {
      console.log('⚠️ Usuário admin já existe');
    } else {
      await connection.execute(
        'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)',
        [email, hashedPassword, name, role]
      );
      console.log('✓ Usuário admin criado com sucesso!');
      console.log('📧 Email: admin@empresa.com');
      console.log('🔑 Senha: admin123');
    }

    // Inserir alguns departamentos padrão
    const departments = [
      ['TI', 'Tecnologia da Informação'],
      ['RH', 'Recursos Humanos'],
      ['Financeiro', 'Departamento Financeiro']
    ];

    for (const [deptName, description] of departments) {
      const [existingDept] = await connection.execute('SELECT id FROM departments WHERE name = ?', [deptName]);
      if (existingDept.length === 0) {
        await connection.execute('INSERT INTO departments (name, description) VALUES (?, ?)', [deptName, description]);
        console.log(`✓ Departamento '${deptName}' criado`);
      }
    }

    console.log('\n✅ Seed finalizado!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro no seed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

seedAdmin();
