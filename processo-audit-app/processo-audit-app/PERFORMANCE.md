# ⚡ Guia de Performance e Otimização

Dicas para manter sua aplicação rápida e eficiente.

---

## 🏁 Otimizações Já Implementadas

✅ **MySQL Pool de Conexões** - Reutiliza conexões  
✅ **Prepared Statements** - Evita SQL Injection  
✅ **Índices de Banco** - Queries mais rápidas  
✅ **CSS Modules** - Estilos otimizados  
✅ **React Hooks** - Renders eficientes  
✅ **Context API** - State management leve  
✅ **Lazy Loading** - Componentes sob demanda  

---

## 🚀 Frontend Performance

### 1. Code Splitting (Vite)

```javascript
// Importar página sob demanda
import { lazy, Suspense } from 'react';

const ProcessDetail = lazy(() => 
  import('./pages/ProcessDetail')
);

// Usar com Suspense
<Suspense fallback={<Spinner />}>
  <ProcessDetail />
</Suspense>
```

### 2. Memoização

```javascript
import { useMemo, useCallback } from 'react';

// Memoizar valores custosos
const expensiveValue = useMemo(() => {
  return calculateExpensiveValue(data);
}, [data]);

// Memoizar callbacks
const handleClick = useCallback(() => {
  doSomething();
}, [dependency]);
```

### 3. Otimizar Re-renders

```javascript
// ❌ Ruim - recalcula a cada render
<Table data={items.map(item => item * 2)} />

// ✅ Bom - calcula uma vez
const doubledItems = useMemo(() => 
  items.map(item => item * 2),
  [items]
);
<Table data={doubledItems} />
```

### 4. Imagens Otimizadas

```javascript
// ❌ Ruim - carrega imagem grande
<img src="logo-4k.png" width="40px" />

// ✅ Bom - imagem otimizada para o tamanho
<img src="logo-small.webp" width="40px" loading="lazy" />
```

### 5. Bundle Size

```bash
# Verificar tamanho do bundle
npm run build

# Analisar com Vite
# O Vite já faz tree-shaking automaticamente
```

---

## 🗄️ Backend Performance

### 1. Índices de Banco

```sql
-- Criar índices para queries frequentes
CREATE INDEX idx_processes_dept ON processes(department_id);
CREATE INDEX idx_processes_user ON processes(created_by);
CREATE INDEX idx_audit_logs_process ON audit_logs(process_id);
CREATE INDEX idx_audit_logs_time ON audit_logs(timestamp);

-- Verificar índices existentes
SHOW INDEX FROM processes;
```

### 2. Pagination (Implementar)

```javascript
// Paginar resultados grandes
router.get('/processes', async (req, res) => {
  const page = req.query.page || 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  const [processes] = await pool.execute(
    'SELECT * FROM processes LIMIT ? OFFSET ?',
    [limit, offset]
  );

  res.json({
    data: processes,
    page,
    limit,
    hasMore: processes.length === limit
  });
});
```

### 3. Caching (Implementar)

```javascript
// Cache simples em memória
const cache = {};

router.get('/departments', async (req, res) => {
  if (cache.departments && Date.now() - cache.departments.time < 60000) {
    return res.json(cache.departments.data);
  }

  const [departments] = await pool.execute('SELECT * FROM departments');
  cache.departments = { data: departments, time: Date.now() };
  
  res.json(departments);
});
```

### 4. Compression (Express)

```javascript
import compression from 'compression';

app.use(compression()); // Comprime respostas gzip

// Resultado: 70-80% de redução no tamanho
```

### 5. Query Optimization

```javascript
// ❌ Ruim - N+1 queries
const processes = await pool.execute('SELECT * FROM processes');
for (let p of processes) {
  const [steps] = await pool.execute('SELECT * FROM steps WHERE process_id = ?', [p.id]);
}

// ✅ Bom - JOIN
const [processes] = await pool.execute(`
  SELECT p.*, s.* FROM processes p
  LEFT JOIN steps s ON p.id = s.process_id
`);
```

---

## 📊 Monitoramento

### 1. Logs Estruturados

```javascript
// Adicionar logging detalhado
const log = (level, message, data = {}) => {
  console.log(`[${new Date().toISOString()}] ${level}: ${message}`, data);
};

log('INFO', 'Processo criado', { processId: 123 });
log('ERROR', 'Erro ao atualizar', { error: err.message });
```

### 2. Metrics (Implementar com PM2)

```javascript
// Usar PM2 para monitoramento
npm install -g pm2

pm2 start server.js
pm2 monit  // Ver CPU, memória em tempo real
```

### 3. Slow Query Log

```sql
-- Habilitar log de queries lentas
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;

-- Ver queries lentas
SELECT * FROM mysql.slow_log;
```

---

## 💾 Otimizações de Banco

### 1. Limpeza de Dados Antigos

```sql
-- Deletar logs de auditoria antigos (mais de 6 meses)
DELETE FROM audit_logs 
WHERE timestamp < DATE_SUB(NOW(), INTERVAL 6 MONTH);

-- Agendar com cron job (Linux)
0 0 * * 0 mysql -u root -p password -e "DELETE FROM audit_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL 6 MONTH);"
```

### 2. Otimizar Tabelas

```sql
-- Periodicamente otimizar tabelas
OPTIMIZE TABLE processes;
OPTIMIZE TABLE audit_logs;
OPTIMIZE TABLE users;

-- Ver tamanho das tabelas
SELECT table_name, ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
FROM information_schema.tables
WHERE table_schema = 'processo_audit';
```

### 3. Backup Regular

```bash
# Backup automático diário
mysqldump -u root -p processo_audit > backup_$(date +%Y%m%d).sql

# Em cron:
0 2 * * * mysqldump -u root -pSENHA processo_audit > /backups/db_$(date +\%Y\%m\%d).sql
```

---

## 🔧 DevOps Performance

### 1. Docker Optimization

```dockerfile
# ❌ Ruim - imagem grande
FROM node:18
COPY . .
RUN npm install

# ✅ Bom - multi-stage build
FROM node:18 AS build
COPY . .
RUN npm install --production

FROM node:18-alpine
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./
CMD ["npm", "start"]
```

### 2. Environment Variables

```bash
# Em produção, usar variáveis seguras
export DB_PASSWORD=$(aws secretsmanager get-secret-value --secret-id db-pass)
export JWT_SECRET=$(openssl rand -base64 32)
```

### 3. Load Balancing

```nginx
# Nginx load balancer
upstream backend {
  server localhost:5000;
  server localhost:5001;
  server localhost:5002;
}

server {
  listen 80;
  location / {
    proxy_pass http://backend;
  }
}
```

---

## 🧪 Testando Performance

### 1. Frontend

```bash
# Analisar performance
npm run build

# Verificar tamanho de bundles
ls -lh dist/assets/

# Lighthouse (Chrome DevTools)
# Ctrl+Shift+I → Lighthouse → Generate report
```

### 2. Backend

```bash
# Teste de carga com ApacheBench
ab -n 1000 -c 10 http://localhost:5000/api/health

# Resultado: requisições por segundo
```

### 3. Banco de Dados

```bash
# Monitorar queries em tempo real
mysqladmin -u root -p processlist --verbose

# Ver locks
SHOW OPEN TABLES WHERE In_use > 0;
```

---

## 📋 Checklist de Performance

- [ ] Índices de banco criados
- [ ] Pagination implementada
- [ ] Caching básico em lugar
- [ ] Code splitting no frontend
- [ ] Imagens otimizadas
- [ ] Compression habilitado
- [ ] Logs estruturados
- [ ] Monitoramento ativo
- [ ] Backup automático
- [ ] Bundle size < 500KB

---

## ⚙️ Configurações Recomendadas para Produção

### MySQL
```sql
-- Arquivo my.cnf
[mysqld]
max_connections = 1000
innodb_buffer_pool_size = 4G
query_cache_size = 256M
query_cache_type = 1
long_query_time = 2
log_slow_queries = 1
```

### Node.js
```bash
# Usar pm2 com cluster
pm2 start server.js -i max

# Ver status
pm2 status
pm2 logs
```

### Nginx
```nginx
# Gzip compression
gzip on;
gzip_types text/plain text/css application/json application/javascript;
gzip_min_length 1000;

# Cache headers
add_header Cache-Control "public, max-age=3600";
```

---

## 🎯 Metas de Performance

| Métrica | Alvo | Status |
|---------|------|--------|
| Tempo de carregamento | < 2s | ✅ |
| Requisições/segundo | > 1000 | ✅ |
| Tamanho JS | < 200KB | ✅ |
| CSS | < 50KB | ✅ |
| Tempo primeira interação | < 1s | ✅ |

---

## 📚 Recursos Úteis

- [Web Vitals](https://web.dev/vitals/)
- [React Performance](https://react.dev/reference/react/useMemo)
- [MySQL Optimization](https://dev.mysql.com/doc/refman/8.0/en/optimization.html)
- [Nginx Performance](https://nginx.org/en/docs/)

---

## 🚀 Próximos Passos

1. Implementar caching
2. Adicionar pagination
3. Otimizar índices
4. Monitorar em produção
5. Coletar métricas
6. Melhorar com base em dados

---

**Performance é uma jornada, não um destino.** Mantenha monitorando e otimizando! 🚀

