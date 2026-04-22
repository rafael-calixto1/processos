# 🏗️ Documentação Técnica - Processo Audit

## Arquitetura da Aplicação

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          NAVEGADOR DO USUÁRIO                           │
│                         (http://localhost:3000)                         │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │                                 │
         ┌──────▼──────┐               ┌─────────▼──────┐
         │ React 18    │               │   React Router │
         │ Components  │               │      v6        │
         └──────┬──────┘               └────────────────┘
                │
         ┌──────▼──────────────────┐
         │   Context + Hooks       │
         │  - AuthContext          │
         │  - BrandingContext      │
         │  - useState, useEffect   │
         └──────┬──────────────────┘
                │
         ┌──────▼──────────────────┐
         │   API Service Layer     │
         │  (src/api/index.js)     │
         │   - authAPI             │
         │   - processAPI          │
         │   - departmentAPI       │
         │   - brandingAPI         │
         │   - executionAPI        │
         └──────┬──────────────────┘
                │
                │ HTTP (REST)
                │ Headers: Authorization: Bearer {JWT}
                │
    ┌───────────▼──────────────────────────────────────────┐
    │         EXPRESS.JS SERVER                             │
    │      (http://localhost:5000/api)                      │
    │                                                        │
    │  ┌──────────────────────────────────────────────┐   │
    │  │          MIDDLEWARE STACK                     │   │
    │  │  - CORS                                       │   │
    │  │  - JSON Parser                                │   │
    │  │  - Auth (JWT Verify)                          │   │
    │  │  - Audit Logger                               │   │
    │  └──────────────────────────────────────────────┘   │
    │                      │                                │
    │  ┌──────────────────▼──────────────────────────┐   │
    │  │         ROUTE HANDLERS                      │   │
    │  │  - /auth        (login, register)           │   │
    │  │  - /processes   (CRUD + audit)              │   │
    │  │  - /departments (CRUD)                      │   │
    │  │  - /branding    (get, update)               │   │
    │  │  - /executions  (start, complete)           │   │
    │  └──────────────────┬──────────────────────────┘   │
    │                     │                                │
    │  ┌──────────────────▼──────────────────────────┐   │
    │  │      DATABASE LAYER (MySQL2)                 │   │
    │  │  - Pool de Conexões                          │   │
    │  │  - Prepared Statements                       │   │
    │  └──────────────────┬──────────────────────────┘   │
    └─────────────────────┼──────────────────────────────┘
                          │
            ┌─────────────▼──────────────┐
            │    MySQL Database          │
            │  (processo_audit)          │
            │                            │
            │  Tables:                   │
            │  - users                   │
            │  - departments             │
            │  - processes               │
            │  - steps                   │
            │  - audit_logs              │
            │  - branding                │
            │  - process_executions      │
            │  - step_executions         │
            └────────────────────────────┘
```

## Fluxo de Autenticação

```
┌──────────────────────────────────────────────────────┐
│ USUÁRIO ABRE APLICAÇÃO                               │
│ localStorage.getItem('token')                        │
└────────────────┬─────────────────────────────────────┘
                 │
         ┌───────▼──────────┐
         │ Token existe?    │
         └────┬──────┬──────┘
              │      │
          SIM│      │NÃO
            │        │
    ┌───────▼──┐  ┌──▼──────────────┐
    │ Valida   │  │ Redireciona     │
    │ Token    │  │ para /login     │
    │ JWT      │  └─────────────────┘
    └───┬──────┘
        │
   ┌────▼────────────┐
   │ Token válido?   │
   └────┬───────┬────┘
        │       │
     SIM│       │NÃO
       │        │
    ┌──▼──┐  ┌──▼──────────────────┐
    │Acesso   │ Limpa token         │
    │Permitido│ Redireciona /login  │
    └─────┘  └─────────────────────┘
```

## Fluxo de Auditoria

```
┌────────────────────────────────────┐
│ USUÁRIO MODIFICA UM PROCESSO       │
│ (Editar / Deletar / Criar)         │
└──────────────┬─────────────────────┘
               │
        ┌──────▼──────────────┐
        │ Fetch dados antigos │
        │ (SELECT * FROM...) │
        └──────┬──────────────┘
               │
        ┌──────▼──────────────────┐
        │ Fazer alteração         │
        │ (UPDATE / DELETE)       │
        └──────┬──────────────────┘
               │
        ┌──────▼──────────────────────────────┐
        │ Registrar na auditoria:             │
        │ - action (UPDATE, DELETE, CREATE)   │
        │ - old_data (dados antes)            │
        │ - new_data (dados depois)           │
        │ - user_id (quem fez)                │
        │ - ip_address (de onde)              │
        │ - user_agent (qual navegador)       │
        │ - timestamp (quando)                │
        └────────────────────────────────────┘
```

## Estados do Processo

```
┌──────────────────────────────────────────────────┐
│                 LIFECYCLE DO PROCESSO             │
│                                                  │
│  ┌─────────────────────────────────────────┐   │
│  │ DRAFT (Rascunho)                        │   │
│  │ - Criado mas não publicado              │   │
│  │ - Pode ser editado livremente           │   │
│  │ - Não aparece para visualizadores       │   │
│  └──────────────────┬──────────────────────┘   │
│                     │ Publicar                  │
│                ┌────▼─────────────────────┐   │
│                │ ACTIVE (Ativo)           │   │
│                │ - Pronto para uso        │   │
│                │ - Disponível para todos  │   │
│                │ - Pode ser executado     │   │
│                └────┬──────────────┬──────┘   │
│                     │ Arquivar     │ Editar   │
│            ┌────────▼────────┐     │         │
│            │ ARCHIVED        │ └───┘         │
│            │ (Arquivado)     │               │
│            │ - Histórico     │               │
│            │ - Não editável  │               │
│            └─────────────────┘               │
└──────────────────────────────────────────────────┘
```

## Modelo de Dados

### Tabela: users
```sql
id (PK) | email (UNIQUE) | password (hashed) | name | role | created_at
```
**Roles:** admin, manager, viewer

### Tabela: processes
```sql
id (PK) | title | description | department_id (FK) 
| created_by (FK) | updated_by (FK) | version | status
| created_at | updated_at
```
**Status:** draft, active, archived

### Tabela: steps
```sql
id (PK) | process_id (FK) | step_number | title | description
| documentation_markdown | created_at
```

### Tabela: audit_logs
```sql
id (PK) | process_id (FK) | user_id (FK) | action
| old_data (JSON) | new_data (JSON) | ip_address | user_agent | timestamp
```
**Índices:** process_id, user_id, timestamp

### Tabela: branding
```sql
id (PK) | company_name | logo_url | primary_color | secondary_color
| accent_color | background_color | favicon_url | updated_by (FK) | updated_at
```

### Tabela: process_executions
```sql
id (PK) | process_id (FK) | user_id (FK) | started_at
| completed_at | status
```
**Status:** in_progress, completed, abandoned

### Tabela: step_executions
```sql
id (PK) | execution_id (FK) | step_id (FK) | completed_at
| notes | completed_by (FK)
```

## Endpoints da API

### Autenticação
```
POST   /api/auth/register        # Registrar novo usuário
POST   /api/auth/login           # Login
GET    /api/auth/me              # Dados do usuário atual
GET    /api/auth/users           # Listar usuários (admin)
PUT    /api/auth/users/:id/role  # Atualizar role (admin)
```

### Processos
```
GET    /api/processes              # Listar (com filtros)
GET    /api/processes/:id          # Obter um
POST   /api/processes              # Criar
PUT    /api/processes/:id          # Atualizar
DELETE /api/processes/:id          # Deletar (admin)
GET    /api/processes/:id/audit    # Histórico de auditoria
```

### Departamentos
```
GET    /api/departments            # Listar
GET    /api/departments/:id        # Obter um
POST   /api/departments            # Criar (admin)
PUT    /api/departments/:id        # Atualizar (admin)
DELETE /api/departments/:id        # Deletar (admin)
```

### Branding
```
GET    /api/branding               # Obter configurações
PUT    /api/branding               # Atualizar (admin)
GET    /api/branding/audit         # Histórico (admin)
```

### Execuções
```
POST   /api/executions/start/:pid  # Iniciar execução
GET    /api/executions/:id         # Obter execução
PUT    /api/step-executions/:id/complete  # Completar passo
PUT    /api/executions/:id/complete       # Finalizar execução
PUT    /api/executions/:id/cancel         # Cancelar
GET    /api/executions/user/me     # Minhas execuções
```

## Segurança Implementada

### 1. Hash de Senhas
```javascript
// Backend
const hashedPassword = await bcrypt.hash(password, 10);
const isValid = await bcrypt.compare(inputPassword, hashedPassword);
```

### 2. JWT Authentication
```javascript
// Header obrigatório
Authorization: Bearer {token}

// Token inclui
{
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  iat: timestamp,
  exp: timestamp + 24h
}
```

### 3. Controle de Acesso por Role
```javascript
// Alguns endpoints requerem role específico
router.put('/processes/:id', 
  verifyToken,
  checkRole(['admin', 'manager']),
  handler
);
```

### 4. Auditoria Completa
```javascript
// Cada mudança registra:
- WHO (user_id)
- WHAT (action, old_data, new_data)
- WHEN (timestamp)
- WHERE (ip_address)
- HOW (user_agent)
```

### 5. CORS Configurado
```javascript
// Apenas origem permitida pode fazer requisições
cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
})
```

## Variáveis CSS Dinâmicas

O sistema usa CSS variables que são atualizadas dinamicamente com as cores do branding:

```css
:root {
  --primary-color: #0ba52b;
  --secondary-color: #bbf804;
  --accent-color: #274518;
  --background-color: #ffffff;
}
```

Todas os componentes usam essas variáveis, permitindo mudança instantânea de tema!

## Performance

### Índices de Banco de Dados
```sql
-- audit_logs
CREATE INDEX idx_process ON audit_logs(process_id);
CREATE INDEX idx_user ON audit_logs(user_id);
CREATE INDEX idx_timestamp ON audit_logs(timestamp);

-- Melhor performance em queries de auditoria
```

### Pool de Conexões MySQL
```javascript
// Reutiliza conexões em vez de criar novas
connectionLimit: 10,
waitForConnections: true,
queueLimit: 0
```

### Prepared Statements
```javascript
// Protege contra SQL Injection
await pool.execute(
  'SELECT * FROM users WHERE id = ?',
  [userId]
);
```

## Tratamento de Erros

### Frontend
```javascript
try {
  const data = await api.call();
} catch (error) {
  // Mostra mensagem amigável ao usuário
  setError(error.message);
}
```

### Backend
```javascript
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});
```

## Cache e Performance

### Context API para State Management
- Evita prop drilling
- Reduz re-renders desnecessários
- Atualiza branding a cada 30s

```javascript
useEffect(() => {
  const interval = setInterval(fetchBranding, 30000);
  return () => clearInterval(interval);
}, []);
```

---

**Documentação Versão:** 1.0.0
