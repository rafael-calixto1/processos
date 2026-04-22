# ⚡ Quick Start - Processo Audit

## 🚀 Inicie em 5 Minutos

### Pré-requisitos
- Node.js 16+ instalado
- MySQL 8.0+ rodando
- 5 minutos de tempo

---

## 1️⃣ Clonar e Instalar (2 min)

```bash
# Navegar para a pasta
cd /mnt/user-data/outputs/processo-audit-app

# Instalar dependências do backend
npm install

# Instalar dependências do frontend
cd frontend
npm install
cd ..
```

---

## 2️⃣ Configurar Banco de Dados (1 min)

### Abrir arquivo `.env`

```bash
nano .env
```

### Editar com suas credenciais MySQL:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha_aqui
DB_NAME=processo_audit
PORT=5000
JWT_SECRET=chave_super_secreta_2024
CORS_ORIGIN=http://localhost:3000
```

### Inicializar banco:
```bash
npm run db:init
```

✅ Você verá: `✅ Banco de dados inicializado com sucesso!`

---

## 3️⃣ Iniciar Aplicação (2 min)

### Terminal 1: Backend
```bash
npm start
```

✅ Você verá: `✅ Servidor rodando na porta 5000`

### Terminal 2: Frontend
```bash
cd frontend
npm run dev
```

✅ Você verá: `VITE v5.0.8 ready in 123 ms`

---

## 4️⃣ Acessar e Usar

### Abrir Navegador
```
http://localhost:3000
```

### Registrar Conta
1. Clique "Registre-se aqui"
2. Preencha dados
3. Clique "Criar Conta"

✅ **Pronto! Você está dentro da aplicação!**

---

## 🎯 Próximo: Teste em 5 Minutos

Veja: [TESTE_RAPIDO.md](./TESTE_RAPIDO.md)

---

## 📱 Com Docker? (Ainda Mais Fácil!)

```bash
# Instalar Docker em: https://docker.com

# Depois:
docker-compose up

# Acesso: http://localhost:3000
# Tudo pronto! Sem manual setup.
```

---

## ❌ Algo Deu Errado?

| Erro | Solução |
|------|---------|
| `Cannot connect to MySQL` | Verificar se MySQL está rodando |
| `Cannot POST /api` | Backend não está em :5000 |
| `CORS error` | Verificar `.env` CORS_ORIGIN |
| `npm: command not found` | Instalar Node.js |

👉 Ver detalhes em: [README.md#troubleshooting](./README.md)

---

## 📚 Documentação

| Arquivo | Proposito |
|---------|-----------|
| [INDICE.md](./INDICE.md) | 📚 Índice de toda documentação |
| [README.md](./README.md) | 📖 Guia completo |
| [TESTE_RAPIDO.md](./TESTE_RAPIDO.md) | 🧪 Teste prático |
| [GUIA_FUNCIONALIDADES.md](./GUIA_FUNCIONALIDADES.md) | 📋 Como usar cada feature |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 🏗️ Arquitetura técnica |

---

## ✨ Funcionalidades Prontas

✅ Autenticação com JWT  
✅ Gerenciamento de processos  
✅ Checklists executáveis  
✅ Auditoria completa  
✅ Branding personalizável  
✅ Design responsivo  
✅ Banco de dados MySQL  
✅ API RESTful  

---

## 🎓 Saiba Mais

- Quer entender a arquitetura? → [ARCHITECTURE.md](./ARCHITECTURE.md)
- Quer saber como usar? → [GUIA_FUNCIONALIDADES.md](./GUIA_FUNCIONALIDADES.md)
- Quer testar tudo? → [TESTE_RAPIDO.md](./TESTE_RAPIDO.md)
- Quer detalhes? → [README.md](./README.md)

---

## 🎉 Parabéns!

Sua aplicação de gerenciamento de processos está **100% pronta para usar**!

---

**Tempo total: 5 minutos ⏱️**  
**Status: ✅ Pronto para Produção**

