# 🤝 Guia de Contribuição e Extensão

Este documento descreve como estender e melhorar a aplicação Processo Audit.

---

## 📋 Antes de Começar

- Leia [ARCHITECTURE.md](./ARCHITECTURE.md) para entender a estrutura
- Entenda o padrão de código usado (ES6+, React Hooks, Express.js)
- Tenha o projeto rodando localmente

---

## 🚀 Adicionando Nova Funcionalidade

### Exemplo: Adicionar "Aprovações Obrigatórias" em Processos

#### 1. Backend - Atualizar Modelo de Dados

```sql
-- Adicionar coluna à tabela processes
ALTER TABLE processes ADD COLUMN requires_approval BOOLEAN DEFAULT FALSE;
ALTER TABLE processes ADD COLUMN approved_by INT;
ALTER TABLE processes ADD FOREIGN KEY (approved_by) REFERENCES users(id);

-- Criar tabela para registros de aprovação
CREATE TABLE process_approvals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  process_id INT NOT NULL,
  approved_by INT NOT NULL,
  approval_date TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (process_id) REFERENCES processes(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
);
```

#### 2. Backend - Adicionar Endpoint

```javascript
// Em src/routes/processes.js

// Aprovar processo (apenas admin)
router.put('/processes/:id/approve', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { notes } = req.body;
    const processId = req.params.id;

    // Atualizar status
    await pool.execute(
      'UPDATE processes SET approved_by = ?, status = ? WHERE id = ?',
      [req.userId, 'active', processId]
    );

    // Registrar aprovação
    await pool.execute(
      'INSERT INTO process_approvals (process_id, approved_by, notes) VALUES (?, ?, ?)',
      [processId, req.userId, notes || '']
    );

    // Log de auditoria
    await logAudit(processId, req.userId, 'APPROVE', null, { approved: true }, req);

    res.json({ message: 'Processo aprovado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### 3. Frontend - Atualizar Página

```javascript
// Em frontend/src/pages/ProcessDetail.jsx

// Adicionar botão de aprovação
{process.status === 'draft' && user?.role === 'admin' && (
  <button
    onClick={handleApprove}
    className="btn btn-primary"
  >
    ✓ Aprovar Processo
  </button>
)}

// Função de aprovação
const handleApprove = async () => {
  const notes = prompt('Notas de aprovação (opcional):');
  if (notes !== null) {
    try {
      await fetch(`/api/processes/${id}/approve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notes })
      });
      loadData();
    } catch (err) {
      setError(err.message);
    }
  }
};
```

---

## 🐛 Padrões de Desenvolvimento

### Backend

#### Middleware para Autenticação
```javascript
// Sempre proteger rotas sensíveis
router.post('/sensitive', verifyToken, checkRole(['admin']), (req, res) => {
  // ...
});
```

#### Validação de Entrada
```javascript
// Sempre validar dados do cliente
if (!req.body.email || !req.body.password) {
  return res.status(400).json({ error: 'Email e senha são obrigatórios' });
}
```

#### Tratamento de Erros
```javascript
try {
  // seu código
} catch (error) {
  console.error('Erro:', error);
  res.status(500).json({ error: error.message });
}
```

#### Auditoria
```javascript
// Registrar mudanças importantes
await logAudit(processId, userId, 'CREATE', null, newData, req);
```

### Frontend

#### State Management com Context
```javascript
// Usar Context para dados globais
const { user, token } = useAuth();
const { branding } = useBranding();
```

#### Proteção de Rotas
```javascript
<ProtectedRoute>
  <Layout>
    <MeuComponente />
  </Layout>
</ProtectedRoute>
```

#### Tratamento de Erros
```javascript
try {
  const data = await api.call();
  setData(data);
} catch (err) {
  setError(err.message);
}
```

#### CSS Modules
```javascript
// Importar estilos como módulos
import styles from './MyComponent.module.css';

// Usar com classNames
<div className={styles.container}>
```

---

## 📝 Checklist para Nova Feature

- [ ] Entendo a arquitetura atual
- [ ] Atualizei o banco de dados (se necessário)
- [ ] Criei/atualizei endpoints do backend
- [ ] Testei endpoints com Postman/curl
- [ ] Criei/atualizei componentes frontend
- [ ] Testei no navegador
- [ ] Adicionei tratamento de erros
- [ ] Documentei a feature
- [ ] Testei em mobile também

---

## 🔒 Segurança

### Checklist de Segurança

- [ ] Validar entrada do cliente no backend
- [ ] Proteger rotas sensíveis com autenticação
- [ ] Verificar roles/permissões
- [ ] Usar HTTPS em produção
- [ ] Não expor senhas em logs
- [ ] Usar prepared statements (já implementado)
- [ ] Registrar em auditoria se necessário
- [ ] Testar com diferentes usuários

---

## 🧪 Testando Sua Feature

### Teste Manual
```bash
# 1. Reproduzir o fluxo manualmente
# 2. Testar casos de erro
# 3. Testar em diferentes navegadores/dispositivos
# 4. Testar com diferentes roles de usuário
```

### Com Postman
```bash
# 1. Fazer login
POST /api/auth/login

# 2. Copiar token
# 3. Usar em Authorization header
Authorization: Bearer {token}

# 4. Testar seu novo endpoint
POST /api/sua-rota
```

---

## 📖 Documentação

### Quando Adicionar Docs

- Novo endpoint? → Documentar em GUIA_FUNCIONALIDADES.md
- Nova feature? → Adicionar na seção apropriada
- Mudança técnica? → Atualizar ARCHITECTURE.md

### Formato de Documentação

```markdown
## Nova Feature

### O que é?
Descrição breve

### Como funciona?
Explicação do funcionamento

### Como usar?
Passo a passo para o usuário

### API
Endpoints envolvidos
```

---

## 🔧 Ferramentas Úteis

### Testing
- **Postman**: Testar API
- **Browser DevTools**: Debugar frontend
- **MySQL Workbench**: Verificar dados

### Code Quality
- **ESLint**: Validar código
- **Prettier**: Formatar código

---

## 📋 Lista de Ideias para Extensão

### Fáceis (1-2 horas)
- [ ] Dark mode
- [ ] Exportar processo como PDF
- [ ] Busca/filtro global
- [ ] Tema customizável por usuário

### Médias (3-5 horas)
- [ ] Notificações por email
- [ ] Integração com Slack
- [ ] Dashboard com gráficos
- [ ] Versionamento de processos

### Complexas (1-2 dias)
- [ ] Editor visual drag-and-drop
- [ ] 2FA (autenticação de dois fatores)
- [ ] Integração com SSO (LDAP, Google)
- [ ] Multi-tenancy

---

## 🚀 Deploy da Feature

### Antes de Fazer Deploy

1. Testar completamente em staging
2. Atualizar documentação
3. Migrar dados (se necessário)
4. Backup do banco
5. Testar rollback

### Processo de Deploy

```bash
# 1. Committar código
git add .
git commit -m "feat: descrição da feature"

# 2. Fazer build
npm run build

# 3. Deploy
# (Seguir seu processo de deploy)

# 4. Verificar em produção
# Testar nova feature em prod
```

---

## 💬 Dúvidas?

- Leia [README.md](./README.md)
- Confira [ARCHITECTURE.md](./ARCHITECTURE.md)
- Veja exemplos de código existente

---

## 📄 Exemplo Completo: Adicionar Campo de Status

### 1. Database
```sql
ALTER TABLE processes ADD COLUMN priority ENUM('low', 'medium', 'high') DEFAULT 'medium';
```

### 2. Backend
```javascript
// Usar campo na query
const [result] = await pool.execute(
  'UPDATE processes SET priority = ? WHERE id = ?',
  [req.body.priority, processId]
);
```

### 3. Frontend
```javascript
<select 
  value={priority}
  onChange={(e) => setPriority(e.target.value)}
>
  <option value="low">Baixa</option>
  <option value="medium">Média</option>
  <option value="high">Alta</option>
</select>
```

### 4. Documentação
```markdown
## Prioridade do Processo

Você pode definir a prioridade:
- Baixa: Processos de rotina
- Média: Processos importantes
- Alta: Processos críticos
```

---

## 🎯 Boas Práticas

✅ Use nomes descritivos para variáveis e funções  
✅ Comente código complexo  
✅ Separe responsabilidades  
✅ Use componentes reutilizáveis  
✅ Trate erros graciosamente  
✅ Teste em diferentes cenários  
✅ Documente mudanças importantes  
✅ Mantenha segurança em mente  

---

## 🙏 Obrigado por Contribuir!

Suas melhorias ajudam a aplicação a ficar melhor para todos. 🚀

