import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';

dotenv.config();

const seedInstalacao = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log('Iniciando seed do processo de Instalação...');

    // 1. Obter ou Criar o departamento "Atendimento"
    const [existingDept] = await connection.execute('SELECT id FROM departments WHERE name = ?', ['Atendimento']);
    let departmentId;
    if (existingDept.length === 0) {
      const [result] = await connection.execute(
        'INSERT INTO departments (name, description) VALUES (?, ?)',
        ['Atendimento', 'Setor de atendimento ao cliente e suporte operacional']
      );
      departmentId = result.insertId;
      console.log('✓ Departamento Atendimento criado');
    } else {
      departmentId = existingDept[0].id;
    }

    // 2. Obter um admin para ser o criador
    const [admins] = await connection.execute('SELECT id FROM users WHERE role = "admin" LIMIT 1');
    if (admins.length === 0) {
      throw new Error('Nenhum usuário administrador encontrado para criar o processo. Execute seedAdmin.js primeiro.');
    }
    const adminId = admins[0].id;

    // 3. Criar o processo "Instalação (Checklist Operacional)"
    const [resultProc] = await connection.execute(
      `INSERT INTO processes (title, description, department_id, created_by, status) 
       VALUES (?, ?, ?, ?, 'active')`,
      ['Instalação (Checklist Operacional)', 'Processo completo de instalação técnica de internet, desde a chegada até a finalização e limpeza.', departmentId, adminId]
    );
    const processId = resultProc.insertId;
    console.log(`✓ Processo 'Instalação' criado com ID: ${processId}`);

    // 4. Inserir Passos
    const steps = [
      // Seção 1
      { section: '1. Chegada e Preparação Técnica (Entrevista)', title: 'Viabilidade Técnica (Rua)', description: 'Identificado de caixa na rua (ANTES DE CHAMAR O CLIENTE). CASO NÃO TENHA, CHAMAR EQUIPE TÉCNICA.' },
      { section: '1. Chegada e Preparação Técnica (Entrevista)', title: 'Segurança Elétrica', description: 'Realizado teste de tensão na cordoalha/cabos com a caneta de teste antes da subida.' },
      { section: '1. Chegada e Preparação Técnica (Entrevista)', title: 'EPIs/EPCs', description: 'Conferidos e utilizados: Capacete, cinto, talabarte, luvas, cones e escada amarrada.' },
      { section: '1. Chegada e Preparação Técnica (Entrevista)', title: 'Condições Climáticas', description: 'Validado que não há chuva ou ventos fortes que impeçam o serviço.' },

      // Seção 2
      { section: '2. Planejamento de Instalação', title: 'Vistoria de Fachada', description: 'Definido trajeto com menor poluição visual ou uso de conduítes.' },
      { section: '2. Planejamento de Instalação', title: 'Localização do Equipamento', description: 'Identificado o local de maior uso e verificado sinal via Wi-Fi Analyser.' },
      { section: '2. Planejamento de Instalação', title: 'Checklist de Cabeamento', description: 'Identificados dispositivos (TVs, Consoles, PCs) que podem ser conectados via cabo LAN para melhor performance.' },

      // Seção 3
      { section: '3. Instalação e Configuração', title: 'Potência de Sinal', description: 'Verificado no Power Meter (perda máxima aceitável de 1 dB em relação à CTO).' },
      { section: '3. Instalação e Configuração', title: 'Configuração Dual Band', description: 'Redes 2.4GHz e 5GHz configuradas separadamente.' },
      { section: '3. Instalação e Configuração', title: 'Orientação ao Cliente', description: 'Explicada a diferença de alcance/velocidade e a necessidade de dispositivos compatíveis com o plano.' },

      // Seção 4
      { section: '4. Testes de Performance', title: 'Speed Test (Wi-Fi)', description: 'Realizado na presença do cliente.' },

      // Seção 5
      { section: '5. Evidências Fotográficas', title: 'Foto da Ancoragem', description: 'Registro da fixação no poste do cliente.' },
      { section: '5. Evidências Fotográficas', title: 'Foto do Acabamento Interno', description: 'Registro do estado final da instalação (proteção contra futuras alegações).' },
      { section: '5. Evidências Fotográficas', title: 'Foto do Power Meter', description: 'Comprovando a potência do sinal.' },
      { section: '5. Evidências Fotográficas', title: 'Foto do MAC Address', description: 'Para registro sistêmico.' },

      // Seção 6
      { section: '6. Finalização e Pós-Serviço', title: 'Relatório de Dificuldades', description: 'Registradas obstruções de conduítes, árvores ou trajetos complexos.' },
      { section: '6. Finalização e Pós-Serviço', title: 'Limpeza do Local', description: 'Recolhidos restos de fibra, conectores, embalagens e pó de furação.' }
    ];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      await connection.execute(
        `INSERT INTO steps (process_id, step_number, title, description, section) 
         VALUES (?, ?, ?, ?, ?)`,
        [processId, i + 1, step.title, step.description, step.section]
      );
    }

    console.log(`✓ ${steps.length} passos inseridos com sucesso`);
    console.log('\n✅ Seed de Instalação finalizado!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro no seed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

seedInstalacao();
