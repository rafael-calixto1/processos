import express from 'express';
import { verifyToken, checkRole } from '../middlewares/auth.js';
import { loadTecnico, handle } from '../middlewares/estoqueAccess.js';
import { ServiceError } from '../services/estoqueService.js';
import { montarBootstrap } from '../services/mobileService.js';
import { auditarOS } from '../services/os/auditoria.js';

/* Endpoints do app dos técnicos. */
const router = express.Router();
router.use(verifyToken, loadTecnico, checkRole(['tecnico']));
router.use(auditarOS('mobile'));

router.get('/bootstrap', handle(async (req, res) => {
  if (!req.tecnicoId) throw new ServiceError(403, 'Seu usuário não está vinculado a um técnico');
  res.json(await montarBootstrap(req.tecnicoId));
}));

export default router;
