import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './src/routes/auth.js';
import processRoutes from './src/routes/processes.js';
import departmentRoutes from './src/routes/departments.js';
import brandingRoutes from './src/routes/branding.js';
import executionRoutes from './src/routes/executions.js';
import { auditMiddleware } from './src/middlewares/audit.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Request logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  if (['POST', 'PUT'].includes(req.method)) {
    console.log('Body:', JSON.stringify(req.body));
  }
  next();
});

// Middlewares
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(auditMiddleware);

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api', processRoutes);
app.use('/api', departmentRoutes);
app.use('/api', brandingRoutes);
app.use('/api', executionRoutes);

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
