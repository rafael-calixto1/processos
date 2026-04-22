# 🧪 Guia de Teste Rápido

Siga este guia para testar todas as funcionalidades da aplicação Processo Audit em menos de 15 minutos.

---

## ⚙️ Setup Inicial (5 minutos)

### 1. Iniciar Backend
```bash
cd /caminho/para/processo-audit-app
npm install                    # Se ainda não fez
npm run db:init               # Criar banco de dados
npm start                      # Backend roda em :5000
```

### 2. Iniciar Frontend (em outro terminal)
```bash
cd /caminho/para/processo-audit-app/frontend
npm install                    # Se ainda não fez
npm run dev                    # Frontend roda em :3000
```

### 3. Acessar Aplicação
- Abra: **http://localhost:3000**
- Você será redirecionado para `/login`

---

## 👤 Teste 1: Autenticação (2 minutos)

### Registrar novo usuário

1. Clique em **"Registre-se aqui"**
2. Preencha:
   - Nome: `João Silva`
   - Email: `joao@empresa.com`
   - Senha: `senha123`
   - Confirmar: `senha123`
3. Clique **"Criar Conta"**

✅ **Esperado**: Login automático e redirecionamento para Dashboard

### Fazer Logout e Login

1. Clique no ícone de **logout** (canto superior direito)
2. Clique **"Sair"**
3. Digite:
   - Email: `joao@empresa.com`
   - Senha: `senha123`
4. Clique **"Entrar"**

✅ **Esperado**: Acesso ao Dashboard

---

## 🎨 Teste 2: Branding Personalization (2 minutos)

> ⚠️ Seu usuário precisa ser ADMIN para isso. Faça:
> ```sql
> UPDATE users SET role = 'admin' WHERE email = 'joao@empresa.com';
> ```

1. No menu, clique em **"Branding"**
2. Mude:
   - **Nome da Empresa**: "Minha Empresa LTDA"
   - **Cor Primária**: Escolha azul (#0066cc)
   - **Cor Secundária**: Escolha amarelo (#FFD700)
3. Veja a mudança no **Preview** em tempo real
4. Clique **"Salvar Alterações"**

✅ **Esperado**: 
- Mensagem "Branding atualizado com sucesso"
- Header da aplicação muda para azul
- Logo desaparece se estava vazio

---

## 📋 Teste 3: Criar Departamento (1 minuto)

### Via SQL (como o usuário é viewer por padrão):
```sql
INSERT INTO departments (name, description) 
VALUES ('TI', 'Departamento de Tecnologia da Informação');
```

---

## 📊 Teste 4: Criar Processo (3 minutos)

1. Clique em **"Processos"** no menu
2. Clique em **"Novo Processo"**
3. Preencha:
   - **Título**: `Aprovar Pedido de Compra`
   - **Descrição**: `Validar e aprovar pedidos antes do pagamento`
   - **Departamento**: `TI` (ou qualquer um)

### Adicionar Passos:

**Passo 1:**
- Título: `Verificar dados do fornecedor`
- Descrição: `Confirmar CNPJ e informações de contato`
- Clique **"Adicionar Passo"**

**Passo 2:**
- Título: `Validar orçamento`
- Descrição: `Comparar com orçamentos anteriores`
- Clique **"Adicionar Passo"**

**Passo 3:**
- Título: `Aprovar pagamento`
- Descrição: `Autorizar o desembolso`
- Clique **"Adicionar Passo"**

4. Clique **"Criar Processo"**

✅ **Esperado**: Processo criado e aparece na listagem

---

## 🔍 Teste 5: Visualizar Detalhes do Processo (2 minutos)

1. Na listagem, clique no processo criado
2. Veja:
   - Informações básicas
   - **Aba Passos**: Os 3 passos criados
   - **Aba Auditoria**: Registro de criação
3. Clique em um passo para expandir

✅ **Esperado**: Detalhes aparecem corretamente

---

## ▶️ Teste 6: Executar Processo como Checklist (3 minutos)

1. Na página de detalhes, clique **"Executar"**
2. Você será levado para a página de execução

### Complete os Passos:

**Passo 1:**
- Clique para expandir
- Adicione nota: `Fornecedor validado`
- Clique **"Marcar como Completo"**

**Passo 2:**
- Clique para expandir
- Adicione nota: `20% mais barato que último mês`
- Clique **"Marcar como Completo"**

**Passo 3:**
- Clique para expandir
- Adicione nota: `Aprovado para pagamento`
- Clique **"Marcar como Completo"**

3. Clique **"Finalizar Execução"**

✅ **Esperado**: 
- Progress bar cheia (100%)
- Mensagem de sucesso
- Redirecionado para execuções

---

## 📈 Teste 7: Minhas Execuções (1 minuto)

1. Clique em **"Minhas Execuções"** no menu
2. Veja:
   - Estatísticas (1 completo, 0 em progresso, etc)
   - Sua execução listada com status **"Completo"**
3. Clique em **"Visualizar"**

✅ **Esperado**: Vê a execução com todos os passos marcados

---

## 📝 Teste 8: Testar Auditoria (1 minuto)

1. Volte para a página de Processos
2. Clique no processo criado
3. Vá para aba **"Auditoria"**
4. Veja registros:
   - CREATE (quando foi criado)
   - Clique em "Antes" e "Depois" para ver mudanças

✅ **Esperado**: Histórico completo com timestamps

---

## 🏢 Teste 9: Dashboard (1 minuto)

1. Clique em **"Dashboard"** no menu
2. Veja:
   - **Total de Processos**: 1
   - **Processos Ativos**: (depende do status)
   - **Departamentos**: O que você criou
   - **Processos Recentes**: Seu processo listado

✅ **Esperado**: Estatísticas corretas

---

## 🧪 Teste Adicional: Editar Processo (Opcional)

1. Na listagem, clique no ícone **✏️ Editar**
2. Mude o título para: `Aprovar Pedido de Compra - v2`
3. Clique **"Atualizar"**
4. Verifique a auditoria - deve registrar a mudança

✅ **Esperado**: Título atualizado, auditoria registrada

---

## 🎯 Checklist de Teste

| Feature | Testado | Status |
|---------|---------|--------|
| Login | ☐ | ✅/❌ |
| Branding | ☐ | ✅/❌ |
| Criar Processo | ☐ | ✅/❌ |
| Ver Detalhes | ☐ | ✅/❌ |
| Executar Checklist | ☐ | ✅/❌ |
| Completar Passos | ☐ | ✅/❌ |
| Minhas Execuções | ☐ | ✅/❌ |
| Ver Auditoria | ☐ | ✅/❌ |
| Dashboard | ☐ | ✅/❌ |

---

## 🐛 Se Algo Não Funcionar

### Erro de Conexão ao Banco
```bash
# Verificar se MySQL está rodando
# Linux/Mac:
mysql -u root

# Editar .env com credenciais corretas
nano .env
```

### Erro "Cannot POST /api/processes"
```bash
# Verificar se backend está rodando
# Deve aparecer:
# ✅ Servidor rodando na porta 5000
```

### Erro CORS
```bash
# Verificar CORS_ORIGIN em .env
CORS_ORIGIN=http://localhost:3000
```

### Banco de Dados Vazio
```bash
npm run db:init   # Executar novamente
```

---

## 📊 Dados de Teste Sugeridos

Se quiser mais dados para testar:

```sql
-- Inserir mais departamentos
INSERT INTO departments (name, description) VALUES
('RH', 'Recursos Humanos'),
('Financeiro', 'Departamento Financeiro'),
('Vendas', 'Equipe de Vendas');

-- Criar usuário manager para testar permissões
INSERT INTO users (email, password, name, role) VALUES
('manager@empresa.com', '$2a$10/...', 'Maria Manager', 'manager');
```

---

## ⏱️ Tempo Total: ~15 minutos

Se você seguiu todos os testes acima, a aplicação está **100% funcional**!

---

## 🎓 O Que Você Testou

✅ Autenticação (login/registro)  
✅ Personalização visual (branding)  
✅ Criação de processos  
✅ Visualização de detalhes  
✅ Execução com checklist  
✅ Auditoria completa  
✅ Histórico de execuções  
✅ Dashboard com estatísticas  

---

## 🚀 Próximos Passos

1. **Explorar mais**: Crie mais processos, teste diferentes status
2. **Testar com Roles**: Crie usuarios com diferentes papéis
3. **Customizar**: Mude cores, logo, nome da empresa
4. **Deploy**: Siga instruções de produção quando pronto

---

**Parabéns! Você completou o teste da aplicação Processo Audit!** 🎉

