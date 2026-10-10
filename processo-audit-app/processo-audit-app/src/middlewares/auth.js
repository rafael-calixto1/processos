import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.userRole = decoded.role;
    req.userEmail = decoded.email;
    next();
  } catch (error) {
    // `code` deixa o app distinguir "renove a sessão" de um token inválido; o status continua 403 por compatibilidade com o web
    return res.status(403).json({ error: 'Token inválido ou expirado', code: error.name === 'TokenExpiredError' ? 'token_expirado' : 'token_invalido' });
  }
};

export const checkRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
  };
};
