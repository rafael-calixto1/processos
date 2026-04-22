# 🚀 Processo Audit - Sistema de Gerenciamento de Processos com Auditoria

Um sistema completo e profissional para gerenciamento de processos empresariais com auditoria, controle de departamentos, execução de checklists e identidade visual personalizável.

## 📋 Características Principais

### ✅ Gerenciamento de Processos
- Criar, editar e deletar processos
- Organizar processos por departamentos
- Versionamento automático de mudanças
- Status: Rascunho, Ativo, Arquivado

### 📝 Checklists Dinâmicos
- Adicionar passos (itens) aos processos
- Cada passo pode ter documentação em Markdown
- Executar processos com checklist interativo
- Marcar passos como completos durante execução

### 🔐 Sistema de Autenticação e Autorização
- Registro e login de usuários
- Três níveis de acesso: Admin, Manager, Viewer
- Tokens JWT com expiração
- Proteção de rotas no frontend

### 📊 Auditoria Completa
- Registro de todas as alterações em processos
- Histórico com timestamp, IP e User-Agent
- Logs antes e depois (old_data, new_data)
- Rastreabilidade total de quem fez o quê e quando

### 🎨 Identidade Visual Personalizável
- Personalizar cores da interface
- Upload de logo da empresa
- Nome da empresa editável
- Preview em tempo real
- Histórico de alterações de branding

### 🏢 Gerenciamento de Departamentos
- Criar departamentos
- Atribuir processos a departamentos
- Visualizar processos por departamento

## 🛠 Stack Tecnológico

### Backend
- **Node.js** com Express.js
- **MySQL** como banco de dados
- **JWT** para autenticação
- **bcryptjs** para hash de senhas

### Frontend
- **React 18** com Hooks
- **React Router** v6 para navegação
- **CSS Modules** para estilos
- **Axios** para requisições HTTP
- **React Icons** para ícones

## 📦 Instalação

### Pré-requisitos
- Node.js 16+ instalado
- MySQL 8.0+ instalado e rodando
- npm ou yarn

### 1. Clone e Configuração Inicial

```bash
cd processo-audit-app
npm install
cd frontend
npm install
cd ..
```

### 2. Configurar Banco de Dados

```bash
# Criar arquivo .env na raiz do projeto
cp .env.example .env  # Se houver

# Editar .env com suas credenciais
nano .env
```

**Conteúdo do `.env`:**
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=processo_audit
PORT=5000
JWT_SECRET=sua_chave_secreta_super_segura_2024
CORS_ORIGIN=http://localhost:3000
```

### 3. Inicializar Banco de Dados

```bash
# A partir da raiz do projeto
npm run db:init
```

Este comando irá:
- Criar o banco de dados `processo_audit`
- Criar todas as tabelas necessárias
- Preparar índices para performance

### 4. Iniciar o Backend

```bash
# Na raiz do projeto (processo-audit-app)
npm start
# ou em modo desenvolvimento com auto-reload
npm run dev
```

O servidor estará rodando em: `http://localhost:5000`

### 5. Iniciar o Frontend

```bash
# Em outro terminal, dentro de frontend/
cd frontend
npm run dev
```

O frontend estará disponível em: `http://localhost:3000`

## 🎯 Primeiro Acesso

1. Acesse `http://localhost:3000`
2. Clique em "Registre-se aqui"
3. Crie uma conta com email e senha
4. Login com suas credenciais
5. Acesse o dashboard

## 👥 Gerenciamento de Usuários

### Funções de Acesso

| Função | Descrição | Permissões |
|--------|-----------|-----------|
| **Admin** | Administrador do sistema | Tudo: criar, editar, deletar, gerenciar usuários, branding |
| **Manager** | Gerenciador de processos | Criar e editar processos, visualizar auditoria |
| **Viewer** | Visualizador | Apenas visualizar processos e executá-los |

### Promover Usuário a Admin

> **Nota:** Atualmente deve ser feito diretamente no banco de dados. Para versões futuras, adicione uma página de gerenciamento de usuários.

```sql
USE processo_audit;
UPDATE users SET role = 'admin' WHERE id = 1;
```

## 📖 Guia de Uso

### Criar um Novo Processo

1. Clique em "Processos" no menu lateral
2. Clique em "Novo Processo"
3. Preencha:
   - **Título**: Nome do processo
   - **Descrição**: Descrição detalhada
   - **Departamento**: Selecione um departamento
4. Adicione **Passos**:
   - Digite o título do passo
   - (Opcional) Adicione descrição
   - Clique "Adicionar Passo"
5. Clique "Criar Processo"

### Editar Branding da Empresa

1. Clique em "Branding" (apenas admin)
2. Preencha os campos:
   - Nome da empresa
   - URLs de logo e favicon
   - Cores (primária, secundária, acento, fundo)
3. Veja o preview em tempo real
4. Clique "Salvar Alterações"

As mudanças são aplicadas imediatamente em toda a interface!

### Executar um Processo (Checklist)

1. Acesse "Processos"
2. Clique em um processo
3. Clique "Iniciar Execução"
4. Uma lista de verificação aparecerá
5. Marque cada passo conforme completá-lo
6. Finalize quando todos os passos estiverem completos

### Visualizar Auditoria

1. Acesse um processo
2. Clique em "Histórico" ou "Auditoria"
3. Veja todas as mudanças com:
   - Quem fez
   - Quando fez
   - O que mudou (antes/depois)
   - IP de origem

## 📊 Estrutura do Banco de Dados

### Tabelas Principais

```
users
├── id, email, password, name, role, created_at

departments
├── id, name, description, created_at

processes
├── id, title, description, department_id
├── created_by, updated_by, version, status
├── created_at, updated_at

steps
├── id, process_id, step_number, title
├── description, documentation_markdown, created_at

audit_logs
├── id, process_id, user_id, action
├── old_data, new_data, ip_address, user_agent, timestamp

branding
├── id, company_name, logo_url
├── primary_color, secondary_color, accent_color, background_color
├── favicon_url, updated_by, updated_at

process_executions
├── id, process_id, user_id
├── started_at, completed_at, status

step_executions
├── id, execution_id, step_id
├── completed_at, notes, completed_by
```

## 🎨 Personalização de Cores

As cores padrão podem ser customizadas:

- **Primária** (#0ba52b): Botões, headers, destaques
- **Secundária** (#bbf804): Acentos, elementos secundários
- **Accent** (#274518): Textos escuros, backgrounds
- **Background** (#ffffff): Fundo geral

Todas as cores são configuráveis via interface de Branding!

## 🚀 Deploy

### Backend (Node.js)

```bash
# Instalar produção
npm install --production

# Iniciar
npm start
```

### Frontend (React)

```bash
# Build
npm run build

# Servir com servidor estático (requer Nginx/Apache)
# Ou servir com um servidor Node simples
```

## 🔒 Segurança

- ✅ Senhas com hash bcryptjs (10 rounds)
- ✅ Autenticação JWT com expiração
- ✅ Validação de entrada no backend
- ✅ CORS configurado
- ✅ Logs de auditoria completos
- ✅ Proteção de rotas por role

### Recomendações para Produção

```env
# .env produção
NODE_ENV=production
JWT_SECRET=gerar_uma_chave_aleatoria_muito_longa_e_segura
CORS_ORIGIN=https://seu-dominio.com
DB_HOST=seu-host-db-seguro
```

## 🐛 Troubleshooting

### Erro: "Connection refused" no MySQL
- Verifique se MySQL está rodando
- Confirme host, usuário e senha no `.env`

### Erro: "Cannot POST /api/auth/login"
- Verifique se o backend está rodando (porta 5000)
- Verifique CORS_ORIGIN no `.env`

### Erro: "Cannot find module"
- Execute `npm install` novamente
- Delete `node_modules` e `package-lock.json`, execute `npm install`

### Frontend não conecta ao backend
- Verifique se backend está em `http://localhost:5000`
- Verificar console do navegador (F12) para erros de CORS

## 📝 Variáveis de Ambiente

Criar arquivo `.env` na raiz:

```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=processo_audit

# Server
PORT=5000
NODE_ENV=development

# JWT
JWT_SECRET=sua_chave_secreta_super_segura_aqui_2024

# CORS
CORS_ORIGIN=http://localhost:3000
```

## 📚 Estrutura de Diretórios

```
processo-audit-app/
├── server.js                 # Arquivo principal backend
├── package.json
├── .env
├── scripts/
│   └── initDb.js            # Script de inicialização DB
├── src/
│   ├── config/
│   │   └── database.js       # Conexão MySQL
│   ├── middlewares/
│   │   ├── auth.js          # JWT e autorização
│   │   └── audit.js         # Logging de auditoria
│   └── routes/
│       ├── auth.js
│       ├── processes.js
│       ├── departments.js
│       ├── branding.js
│       └── executions.js
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx
    │   ├── api/
    │   │   └── index.js      # Chamadas HTTP
    │   ├── context/
    │   │   ├── AuthContext.jsx
    │   │   └── BrandingContext.jsx
    │   ├── components/
    │   │   ├── Layout.jsx
    │   │   └── Layout.module.css
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   ├── Dashboard.jsx
    │   │   ├── Processes.jsx
    │   │   ├── Branding.jsx
    │   │   └── *.module.css
    │   └── styles/
    │       └── global.css
```

## 🤝 Contribuindo

Sinta-se livre para:
- Reportar bugs
- Sugerir melhorias
- Fazer pull requests

## 📄 Licença

MIT License - Livre para usar em projetos pessoais e comerciais.

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique a seção Troubleshooting
2. Confira os logs do console do navegador (F12)
3. Confira os logs do backend (terminal)
4. Verifique as credenciais do banco de dados

## 🎯 Roadmap Futuro

- [ ] Página de detalhes do processo com auditoria
- [ ] Editor visual de processos
- [ ] Importação/exportação de processos
- [ ] Dashboard com gráficos de execução
- [ ] Notificações por email
- [ ] Integração com Slack
- [ ] Modo escuro
- [ ] Suporte multi-idioma
- [ ] API puública com rate limiting

---

**Versão:** 1.0.0  
**Última atualização:** 2024
