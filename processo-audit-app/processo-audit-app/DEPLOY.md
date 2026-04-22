# 🚀 Guia de Deploy - Processo Audit

Instruções passo a passo para fazer deploy da aplicação em produção.

---

## 📋 Pré-requisitos

- Servidor com Node.js 16+
- MySQL 8.0+ instalado
- Nginx ou Apache
- SSL/HTTPS ativo
- Domínio configurado

---

## 🏗️ Opção 1: Deploy Manual no Servidor

### 1. Conectar ao Servidor

```bash
ssh usuario@seu-servidor.com
```

### 2. Clonar Repositório

```bash
cd /var/www
git clone seu-repositorio.git processo-audit
cd processo-audit
```

### 3. Instalar Dependências

```bash
npm install --production
cd frontend
npm install --production
npm run build  # Compilar React
cd ..
```

### 4. Configurar Variáveis de Ambiente

```bash
nano .env
```

**Arquivo .env para Produção:**
```env
DB_HOST=localhost
DB_USER=processo_user
DB_PASSWORD=senha_muito_segura_aletatoria
DB_NAME=processo_audit

PORT=5000
NODE_ENV=production

JWT_SECRET=chave_secreta_aleatatoria_muito_longa_aqui

CORS_ORIGIN=https://seu-dominio.com
```

### 5. Inicializar Banco de Dados

```bash
npm run db:init
```

### 6. Instalar PM2 (Process Manager)

```bash
npm install -g pm2
pm2 startup
pm2 start server.js --name "processo-audit"
pm2 save
```

**Verificar Status:**
```bash
pm2 status
pm2 logs
```

### 7. Configurar Nginx

**Criar arquivo:** `/etc/nginx/sites-available/processo-audit`

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    # Redirecionar HTTP para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seu-dominio.com;

    # SSL (obter de Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/seu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seu-dominio.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    gzip_min_length 1000;

    # Frontend (React build)
    location / {
        root /var/www/processo-audit/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API Backend
    location /api {
        proxy_pass http://localhost:5000/api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 8. Ativar Site Nginx

```bash
sudo ln -s /etc/nginx/sites-available/processo-audit /etc/nginx/sites-enabled/
sudo nginx -t  # Testar configuração
sudo systemctl restart nginx
```

### 9. SSL com Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot certonly --standalone -d seu-dominio.com
```

---

## 🐳 Opção 2: Deploy com Docker (Recomendado)

### 1. Preparar Servidor

```bash
sudo apt update
sudo apt install docker.io docker-compose
sudo usermod -aG docker $USER
```

### 2. Criar docker-compose.yml para Produção

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: processo-audit-mysql
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
    volumes:
      - mysql_data:/var/lib/mysql
    restart: always
    networks:
      - app-network

  backend:
    build: .
    container_name: processo-audit-backend
    environment:
      DB_HOST: mysql
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: ${DB_NAME}
      PORT: 5000
      NODE_ENV: production
      JWT_SECRET: ${JWT_SECRET}
      CORS_ORIGIN: ${CORS_ORIGIN}
    depends_on:
      - mysql
    restart: always
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    container_name: processo-audit-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./frontend/dist:/usr/share/nginx/html:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - backend
    restart: always
    networks:
      - app-network

volumes:
  mysql_data:

networks:
  app-network:
```

### 3. Variáveis de Ambiente

```bash
# Criar arquivo .env.prod
DB_USER=processo_user
DB_PASSWORD=senha_super_segura_aletatoria
DB_NAME=processo_audit
JWT_SECRET=chave_super_secreta_aqui
CORS_ORIGIN=https://seu-dominio.com
```

### 4. Iniciar

```bash
docker-compose -f docker-compose.yml --env-file .env.prod up -d
docker-compose logs -f
```

---

## ☁️ Opção 3: Deploy em Heroku

### 1. Instalar Heroku CLI

```bash
curl https://cli-assets.heroku.com/install.sh | sh
heroku login
```

### 2. Criar App

```bash
heroku create seu-app-nome
```

### 3. Adicionar MySQL (ClearDB)

```bash
heroku addons:create cleardb:ignite
```

### 4. Configurar Variáveis

```bash
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=seu_secret_aqui
# Pegar DATABASE_URL de ClearDB
heroku config:get CLEARDB_DATABASE_URL
```

### 5. Procfile

**Criar arquivo `Procfile`:**
```
web: npm start
release: npm run db:init
```

### 6. Deploy

```bash
git push heroku main
heroku logs --tail
```

---

## ☁️ Opção 4: Deploy em AWS

### 1. EC2 Instance

```bash
# Criar instância Ubuntu 20.04
# SSH na instância
ssh -i chave.pem ubuntu@seu-ip

# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar MySQL
sudo apt-get install -y mysql-server
sudo mysql_secure_installation
```

### 2. RDS (MySQL gerenciado)

```bash
# Criar RDS instance no console AWS
# Copiar endpoint do RDS
# Usar como DB_HOST no .env
```

### 3. S3 (Para backups)

```bash
aws s3 mb s3://seu-bucket-backups
aws s3 cp backup.sql s3://seu-bucket-backups/
```

### 4. Deploy (mesmo que opção 1)

```bash
# Seguir passos de deploy manual
# Usar endpoint do RDS como DB_HOST
```

---

## 📊 Checklist Pré-Deploy

### Segurança
- [ ] JWT_SECRET é uma string aleatória longa
- [ ] DB_PASSWORD é forte
- [ ] HTTPS/SSL ativo
- [ ] CORS_ORIGIN configurado corretamente
- [ ] NODE_ENV=production

### Performance
- [ ] npm install com flag --production
- [ ] Frontend compilado (npm run build)
- [ ] Compression habilitado no Nginx
- [ ] Cache headers configurados

### Banco de Dados
- [ ] Backup feito
- [ ] Índices criados
- [ ] Migração testada
- [ ] Conexão de pool otimizada

### Monitoramento
- [ ] PM2 ou similar configurado
- [ ] Logs sendo escritos
- [ ] SSL/HTTPS ativo
- [ ] Health check em lugar

---

## 🔍 Verificações Pós-Deploy

```bash
# 1. Testar Health Check
curl https://seu-dominio.com/api/health

# 2. Fazer Login
curl -X POST https://seu-dominio.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"senha123"}'

# 3. Ver Logs
pm2 logs  # ou docker-compose logs

# 4. Monitorar Performance
pm2 monit  # ou docker stats
```

---

## 🔄 Atualizações

### Fazer Update do Código

```bash
# 1. Pull código novo
git pull origin main

# 2. Reinstalar dependências
npm install

# 3. Rebuild frontend
cd frontend && npm install && npm run build && cd ..

# 4. Migrar banco (se necessário)
npm run db:init

# 5. Restart aplicação
pm2 restart processo-audit  # ou docker-compose restart
```

---

## 💾 Backup e Restauração

### Backup Manual

```bash
# Backup do banco
mysqldump -h seu-host -u usuario -p senha processo_audit > backup_$(date +%Y%m%d).sql

# Salvar em S3 ou servidor externo
aws s3 cp backup_20240115.sql s3://seu-bucket/
```

### Backup Automático

```bash
# Criar script backup.sh
#!/bin/bash
mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME > /backups/db_$(date +%Y%m%d_%H%M%S).sql

# Agendar com cron (diariamente às 2 da manhã)
0 2 * * * /home/ubuntu/backup.sh
```

### Restaurar Backup

```bash
mysql -h seu-host -u usuario -p senha processo_audit < backup_20240115.sql
```

---

## 🆘 Troubleshooting

### Erro: "Cannot connect to database"
```bash
# Verificar se MySQL está rodando
sudo service mysql status

# Verificar credenciais em .env
cat .env | grep DB_

# Testar conexão manualmente
mysql -h localhost -u root -p
```

### Erro: "CORS error"
```bash
# Verificar CORS_ORIGIN em .env
# Deve ser https://seu-dominio.com
# Não adicionar / no final

# Testar manualmente
curl -H "Origin: https://seu-dominio.com" https://seu-dominio.com/api/health
```

### Erro: "Out of memory"
```bash
# Aumentar memória de swap
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Erro: "Too many connections"
```sql
-- Aumentar max connections no MySQL
SET GLOBAL max_connections = 1000;

-- Salvar permanentemente em my.cnf
[mysqld]
max_connections = 1000
```

---

## 📈 Monitoramento Contínuo

### PM2 Monitoring

```bash
pm2 monit
pm2 web  # Dashboard na porta 9615
```

### CloudWatch (AWS)

```bash
# Instalar CloudWatch agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl
```

### New Relic (Opcional)

```bash
npm install newrelic

# Em server.js (primeira linha)
require('newrelic');
```

---

## 🔐 Segurança em Produção

### Firewall

```bash
# UFW (Uncomplicated Firewall)
sudo ufw enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Fail2Ban (Proteção contra ataques)

```bash
sudo apt install fail2ban
sudo systemctl start fail2ban
```

### Rate Limiting (Express)

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 100  // limite de 100 requisições
});

app.use('/api/', limiter);
```

---

## 📝 Documentação de Deploy

Após fazer deploy, documentar:
- [ ] Servidor/host utilizado
- [ ] Domínio e SSL
- [ ] Versão Node.js
- [ ] Versão MySQL
- [ ] Data do deploy
- [ ] Pessoa responsável
- [ ] Procedimento de rollback

---

## 🎉 Deploy Completo!

Parabéns! Sua aplicação Processo Audit está em produção! 🚀

---

**Próximos passos:**
1. Monitorar performance
2. Fazer backups regulares
3. Atualizar dependências periodicamente
4. Coletar feedback dos usuários
5. Melhorar continuamente

---

Versão: 1.0.0 | Atualizado: 2024

