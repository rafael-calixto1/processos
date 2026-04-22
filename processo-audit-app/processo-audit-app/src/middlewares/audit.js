import pool from '../config/database.js';

export const logAudit = async (processId, userId, action, oldData, newData, req) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent') || '';

    await pool.execute(
      `INSERT INTO audit_logs 
       (process_id, user_id, action, old_data, new_data, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        processId,
        userId,
        action,
        oldData ? JSON.stringify(oldData) : null,
        newData ? JSON.stringify(newData) : null,
        ipAddress,
        userAgent
      ]
    );
  } catch (error) {
    console.error('Erro ao registrar auditoria:', error);
  }
};

export const auditMiddleware = (req, res, next) => {
  req.logAudit = logAudit;
  next();
};
