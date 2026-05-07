import pool from '../src/config/database.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const users = [
  { name: 'BEATRIZ DA SILVA ARAUJO', email: 'beatriz.silvaaraujo9@gmail.com', cpf: '48132790820' },
  { name: 'THIAGO MASSAO BERTOLDO', email: 'thiagomassau21@gmail.com', cpf: '52060816807' },
  { name: 'MIKE OLIVEIRA ESPINDOLA', email: 'mikeptt7@gmail.com', cpf: '44750860867' },
  { name: 'JHENIFER TAINA DE OLIVEIRA PEREIRA', email: 'jhenifertainaoliveira@gmail.com', cpf: '44775340867' },
  { name: 'JÉSSICA ALESSANDRA RODRIGUES FERNANDES', email: 'alessandra.jessicar@gmail.com', cpf: '50481148841' },
  { name: 'FERNANDA DE OLIVEIRA PEREIRA', email: 'fernandaoliveira178@gmail.com', cpf: '43429208831' },
  { name: 'ESTER ALVES FEITOSA DELPUPO', email: 'delpupoester@hotmail.com', cpf: '48038853890' }
];

async function addUsers() {
  try {
    // 1. Get all departments
    const [departments] = await pool.execute('SELECT id FROM departments');
    const departmentIds = departments.map(d => d.id);
    
    console.log(`Encontrados ${departmentIds.length} departamentos.`);

    for (const user of users) {
      console.log(`Processando usuário: ${user.name}...`);
      
      // Use CPF as initial password
      const hashedPassword = await bcrypt.hash(user.cpf, 10);
      
      try {
        // 2. Create user
        const [result] = await pool.execute(
          'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)',
          [user.email, hashedPassword, user.name, 'viewer']
        );
        
        const userId = result.insertId;
        console.log(`✓ Usuário ${user.name} criado (ID: ${userId})`);

        // 3. Associate with all departments
        for (const depId of departmentIds) {
          await pool.execute(
            'INSERT INTO user_departments (user_id, department_id) VALUES (?, ?)',
            [userId, depId]
          );
        }
        console.log(`✓ Associado a ${departmentIds.length} departamentos.`);
        
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          console.warn(`! Usuário ${user.email} já existe. Pulando...`);
        } else {
          console.error(`✗ Erro ao criar ${user.name}:`, err.message);
        }
      }
    }

    console.log('\nOperação concluída!');
    process.exit(0);
  } catch (error) {
    console.error('Erro geral:', error);
    process.exit(1);
  }
}

addUsers();
