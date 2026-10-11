import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './src/routes/auth.js';
import processRoutes from './src/routes/processes.js';
import departmentRoutes from './src/routes/departments.js';
import brandingRoutes from './src/routes/branding.js';
import visualProcessRoutes from './src/routes/visual_processes.js';
import executionRoutes from './src/routes/executions.js';
import fileRoutes from './src/routes/files.js';
import fleetRoutes from './src/routes/fleet.js';
import ticketRoutes from './src/routes/tickets.js';
import labelRoutes from './src/routes/labels.js';
import hubsoftRoutes from './src/routes/hubsoft.js';
import referralRoutes from './src/routes/referral.js';
import estoqueRoutes from './src/routes/estoque.js';
import osRoutes from './src/routes/os.js';
import mobileRoutes from './src/routes/mobile.js';
import geoRoutes from './src/routes/geo.js';
import painelRoutes from './src/routes/painel.js';
import { tecnicosRouter, fornecedoresRouter, equipamentosRouter } from './src/routes/cadastros.js';
import { auditMiddleware } from './src/middlewares/audit.js';
import { requestLogger } from './src/middlewares/requestLogger.js';
import { criarOpcoesCors, origensPermitidas } from './src/config/cors.js';
import { opcaoTrustProxy } from './src/config/proxy.js';
import { limparOperacoesAntigas } from './src/services/idempotencia.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// IP do cliente atrás de proxy: só confia no X-Forwarded-For de proxy da mesma máquina (ou do que TRUST_PROXY disser). Ver src/config/proxy.js
app.set('trust proxy', opcaoTrustProxy());

// Request logger (corpo só com LOG_BODIES=1, sempre redigido; nunca em /auth nem em upload)
app.use(requestLogger);

// Middlewares
if (!origensPermitidas().length) console.warn('[segurança] CORS_ALLOWED_ORIGINS não definido: o servidor aceita pedidos de navegador de qualquer origem. Defina a lista em produção (ver docs/ENDURECIMENTO.md).');
app.use(cors(criarOpcoesCors()));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(auditMiddleware);

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api', processRoutes);
app.use('/api', departmentRoutes);
app.use('/api', brandingRoutes);
app.use('/api', visualProcessRoutes);
app.use('/api', executionRoutes);
app.use('/api', fileRoutes);
app.use('/api/fleet', fleetRoutes);
app.use('/api', ticketRoutes);
app.use('/api', labelRoutes);
app.use('/api/hubsoft', hubsoftRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/estoque', estoqueRoutes);
app.use('/api/os', osRoutes);
app.use('/api/mobile', mobileRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/painel', painelRoutes);
app.use('/api/tecnicos', tecnicosRouter);
app.use('/api/fornecedores', fornecedoresRouter);
app.use('/api/equipamentos', equipamentosRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Erro 404
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// Limpeza diária das chaves de idempotência antigas (silenciosa enquanto a migração do app mobile não rodou)
const limparIdempotencia = () => limparOperacoesAntigas().catch((e) => {
  if (e.code !== 'ER_NO_SUCH_TABLE') console.error('sync_operacoes:', e.message);
});
limparIdempotencia();
setInterval(limparIdempotencia, 24 * 60 * 60 * 1000).unref();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Servidor rodando na porta ${PORT}`);
  console.log(`📝 API disponível em http://localhost:${PORT}/api`);
  console.log(`🏥 Health check em http://localhost:${PORT}/api/health\n`);
});
