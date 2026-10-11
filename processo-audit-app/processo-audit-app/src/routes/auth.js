import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import { verifyToken } from '../middlewares/auth.js';
import { criarLimitador } from '../middlewares/limitador.js';
import { ServiceError } from '../services/estoqueService.js';
import { abrirSessao, renovarSessao, encerrarSessao, revogarTodas } from '../services/sessao.js';

const router = express.Router();

// Tentativas de login falhas: por e-mail (não depende de IP, que pode ser forjado) e por IP
const limiteEmail = criarLimitador({ max: 10 });
const limiteIp = criarLimitador({ max: 40 });
const limiteRefresh = criarLimitador({ max: 60 });
const limiteRegistro = criarLimitador({ max: 5, janelaMs: 60 * 60 * 1000 }); // cadastros por IP por hora (só vale com o cadastro público ligado)

/** Cadastro por conta própria (cria um usuário só-leitura): DESLIGADO por padrão. Para ligar: ALLOW_PUBLIC_REGISTER=1 no ambiente do servidor. */
export const cadastroPublicoLigado = () => process.env.ALLOW_PUBLIC_REGISTER === '1';

// Registro
router.post('/register', async (req, res) => {
  try {
    if (!cadastroPublicoLigado()) {
      return res.status(403).json({ error: 'O cadastro por conta própria está desativado. Peça a um administrador para criar o seu acesso.' });
    }
    const espera = limiteRegistro.segundosRestantes(req.ip);
    if (espera > 0) {
      res.set('Retry-After', String(espera));
      return res.status(429).json({ error: `Muitos cadastros deste endereço. Tente de novo em ${Math.ceil(espera / 60)} min.` });
    }
    limiteRegistro.falha(req.ip); // cada tentativa conta, não só as que falham

    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, senha e nome são obrigatórios' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.execute(
      'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)',
      [email, hashedPassword, name, 'viewer']
    );

    res.status(201).json({ message: 'Usuário registrado com sucesso' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Email já registrado' });
    }
    console.error('auth:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const chaveEmail = String(email).trim().toLowerCase();
    const espera = Math.max(limiteEmail.segundosRestantes(chaveEmail), limiteIp.segundosRestantes(req.ip));
    if (espera) {
      res.set('Retry-After', String(espera));
      return res.status(429).json({ error: 'Muitas tentativas de login. Aguarde alguns minutos e tente de novo.' });
    }
    const recusar = () => {
      limiteEmail.falha(chaveEmail);
      limiteIp.falha(req.ip);
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    };

    const [users] = await pool.execute(
      'SELECT id, email, password, name, role, status FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return recusar();
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return recusar();
    }
    limiteEmail.sucesso(chaveEmail);

    // Só depois de validar a senha, para não revelar quais contas existem ou estão inativas
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Usuário inativo. Fale com o administrador.' });
    }

    // App mobile (informa `dispositivo`): token de acesso curto + refresh token. O web segue com o token de 24h.
    if (req.body.dispositivo !== undefined) {
      try {
        return res.json(await abrirSessao(user, req.body.dispositivo));
      } catch (e) {
        if (e instanceof ServiceError) return res.status(e.status).json({ error: e.message });
        throw e;
      }
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('auth:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Renova a sessão do app: troca o refresh token por um novo par (rotativo)
router.post('/refresh', async (req, res) => {
  try {
    const espera = limiteRefresh.segundosRestantes(req.ip);
    if (espera) {
      res.set('Retry-After', String(espera));
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' });
    }
    try {
      res.json(await renovarSessao(req.body?.refresh_token, req.body?.dispositivo));
    } catch (e) {
      if (!(e instanceof ServiceError)) throw e;
      if (e.status === 401) limiteRefresh.falha(req.ip);
      res.status(e.status).json({ error: e.message });
    }
  } catch (error) {
    console.error('auth:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Encerra a sessão do app (revoga a família do refresh token). Sempre responde ok.
router.post('/logout', async (req, res) => {
  try {
    await encerrarSessao(req.body?.refresh_token);
    res.json({ message: 'Sessão encerrada' });
  } catch (error) {
    console.error('auth:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Obter usuário atual
router.get('/me', verifyToken, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, email, name, role FROM users WHERE id = ?',
      [req.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('auth:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Alterar senha do usuário logado
router.put('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
    }

    const [users] = await pool.execute(
      'SELECT password FROM users WHERE id = ?',
      [req.userId]
    );

    const user = users[0];
    const validPassword = await bcrypt.compare(currentPassword, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await pool.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedNewPassword, req.userId]
    );
    await revogarTodas(req.userId);

    res.json({ message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('auth:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// List usuários (apenas admin)
router.get(['/users', '/user'], verifyToken, async (req, res) => {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = "SELECT id, email, name, role, created_at FROM users WHERE status = 'active'";
    let countQuery = "SELECT COUNT(*) as total FROM users WHERE status = 'active'";
    let params = [];
    let countParams = [];

    if (search) {
      query += ' AND (name LIKE ? OR email LIKE ?)';
      countQuery += ' AND (name LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [users] = await pool.execute(query, params);
    const [totalRes] = await pool.execute(countQuery, countParams);
    const total = totalRes[0].total;

    // Buscar departamentos para cada usuário
    for (let user of users) {
      const [userDeps] = await pool.execute(
        'SELECT department_id FROM user_departments WHERE user_id = ?',
        [user.id]
      );
      user.department_ids = userDeps.map(ud => ud.department_id);
    }

    res.json({
      users,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('auth:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar usuário (apenas admin)
router.post(['/users', '/user'], verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { email, password, name, role, department_ids } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    await connection.beginTransaction();

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await connection.execute(
      'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)',
      [email, hashedPassword, name, role]
    );

    const userId = result.insertId;

    if (department_ids && Array.isArray(department_ids)) {
      for (const depId of department_ids) {
        await connection.execute(
          'INSERT INTO user_departments (user_id, department_id) VALUES (?, ?)',
          [userId, depId]
        );
      }
    }

    await connection.commit();
    res.status(201).json({ message: 'Usuário criado com sucesso' });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Email já registrado' });
    }
    console.error('auth:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    connection.release();
  }
});

// Atualizar usuário (apenas admin)
router.put(['/users/:id', '/user/:id'], verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { name, role, password, department_ids } = req.body;
    const userId = req.params.id;

    await connection.beginTransaction();

    let query = 'UPDATE users SET name = ?, role = ?';
    let params = [name, role];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password = ?';
      params.push(hashedPassword);
    }

    query += ' WHERE id = ?';
    params.push(userId);

    await connection.execute(query, params);

    // Atualizar departamentos
    if (department_ids && Array.isArray(department_ids)) {
      // Remover antigos
      await connection.execute('DELETE FROM user_departments WHERE user_id = ?', [userId]);
      // Inserir novos
      for (const depId of department_ids) {
        await connection.execute(
          'INSERT INTO user_departments (user_id, department_id) VALUES (?, ?)',
          [userId, depId]
        );
      }
    }

    await connection.commit();
    if (password) await revogarTodas(userId);
    res.json({ message: 'Usuário atualizado com sucesso' });
  } catch (error) {
    await connection.rollback();
    console.error('auth:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    connection.release();
  }
});

// Excluir usuário (apenas admin)
router.delete(['/users/:id', '/user/:id'], verifyToken, async (req, res) => {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Não permitir que o admin inative a si mesmo
    if (parseInt(req.params.id) === req.userId) {
      return res.status(400).json({ error: 'Você não pode inativar seu próprio usuário' });
    }

    await pool.execute("UPDATE users SET status = 'inactive' WHERE id = ?", [req.params.id]);
    await revogarTodas(req.params.id);

    res.json({ message: 'Usuário inativado com sucesso' });
  } catch (error) {
    console.error('auth:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
