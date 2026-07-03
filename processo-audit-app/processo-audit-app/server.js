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
import { auditMiddleware } from './src/middlewares/audit.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for correct IP detection
app.set('trust proxy', true);

// Request logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('IP:', req.ip);
  console.log('X-Forwarded-For:', req.headers['x-forwarded-for']);
  if (['POST', 'PUT'].includes(req.method)) {
    console.log('Body:', JSON.stringify(req.body));
  }
  next();
});

// Middlewares
app.use(cors({
  origin: true,
  credentials: true
}));

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Servidor rodando na porta ${PORT}`);
  console.log(`📝 API disponível em http://localhost:${PORT}/api`);
  console.log(`🏥 Health check em http://localhost:${PORT}/api/health\n`);
});
