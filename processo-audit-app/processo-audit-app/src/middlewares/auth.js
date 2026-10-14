import jwt from 'jsonwebtoken';
import { tocarSessao, MOTIVOS } from '../services/acessos.js';

export const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    // `code` deixa o app distinguir "renove a sessão" de um token inválido; o status continua 403 por compatibilidade com o web
    return res.status(403).json({ error: 'Token inválido ou expirado', code: error.name === 'TokenExpiredError' ? 'token_expirado' : 'token_invalido' });
  }
  req.userId = decoded.id;
  req.userRole = decoded.role;
  req.userEmail = decoded.email;
  req.sessaoId = decoded.sid ?? null;
  if (!req.sessaoId) return next(); // token emitido antes da auditoria de acessos: vale até vencer

  // Anota a atividade da sessão e recusa token de sessão já encerrada (logout, senha trocada, admin...).
  // Se o banco não responder, a requisição segue: a auditoria nunca derruba o sistema.
  tocarSessao(req.sessaoId, req).then((s) => {
    if (s?.encerrada) {
      // "Token ..." no início: o web já trata como sessão vencida; `token_invalido` faz o app tentar renovar (e cair no login)
      return res.status(403).json({ error: `Token inválido: sessão encerrada (${MOTIVOS[s.motivo] ?? 'encerrada'})`, code: 'token_invalido', motivo: s.motivo ?? null });
    }
    next();
  }, () => next());
};

export const checkRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
  };
};
