# 📦 Como Usar o Arquivo ZIP - Processo Audit

## ✅ O Que Está Incluído

O arquivo `processo-audit-app.zip` contém **todo o projeto completo**, pronto para usar:

- ✅ Backend (Node.js + Express)
- ✅ Frontend (React 18)
- ✅ 15 documentações detalhadas
- ✅ Dockerfile e docker-compose
- ✅ Todos os scripts
- ✅ Arquivo .env.example

**Não inclui:** node_modules (para reduzir tamanho), .git, dist

---

## 🚀 Passo a Passo para Usar

### 1. Extrair o ZIP

```bash
# Linux/Mac
unzip processo-audit-app.zip

# Windows
# Clique com botão direito > Extrair Tudo

# Ou use 7-Zip, WinRAR, etc.
```

### 2. Entrar na Pasta

```bash
cd processo-audit-app
```

### 3. Ler o Arquivo Inicial

```bash
# Recomendado: abrir START_HERE.md
# Este arquivo tem instruções claras para começar
```

### 4. Instalar Dependências

```bash
# Backend
npm install

# Frontend
cd frontend
npm install
cd ..
```

### 5. Configurar Banco de Dados

```bash
# Copiar exemplo
cp .env.example .env

# Editar .env com suas credenciais MySQL
nano .env
# ou
notepad .env  # Windows
```

**Preenchimento rápido do .env:**
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=processo_audit
PORT=5000
NODE_ENV=development
JWT_SECRET=chave_secreta_aqui
CORS_ORIGIN=http://localhost:3000
```

### 6. Inicializar Banco

```bash
npm run db:init
```

### 7. Rodar a Aplicação (2 Terminais)

**Terminal 1 - Backend:**
```bash
npm start
# Verá: ✅ Servidor rodando na porta 5000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Verá: VITE ready in XXX ms
```

### 8. Acessar

```
http://localhost:3000
```

---

## 📚 Documentação

Após extrair, procure por estes arquivos (todos em Markdown):

| Arquivo | Propósito | Tempo |
|---------|-----------|-------|
| **START_HERE.md** | Comece aqui | 5 min |
| QUICKSTART.md | Setup rápido | 5 min |
| README.md | Guia completo | 15 min |
| TESTE_RAPIDO.md | Teste prático | 15 min |
| GUIA_FUNCIONALIDADES.md | Como usar | 20 min |
| ARCHITECTURE.md | Técnica | 20 min |
| DEPLOY.md | Deploy produção | 30 min |

---

## 🐳 Alternativa: Usar Docker

Se tiver Docker instalado:

```bash
# Na pasta do projeto
docker-compose up

# Acesso
http://localhost:3000
```

---

## 🆘 Problemas Comuns

### "npm: command not found"
- Instale Node.js em: https://nodejs.org

### "MySQL connection refused"
- MySQL não está rodando
- Verifique credenciais em .env

### "Port 3000 already in use"
```bash
# Mude a porta no vite.config.js
# ou mate o processo:
lsof -i :3000  # Linux/Mac
netstat -ano | findstr :3000  # Windows
```

### Mais problemas?
- Leia [README.md](./README.md) - seção Troubleshooting
- Confira [TESTE_RAPIDO.md](./TESTE_RAPIDO.md) - seção Se Algo Não Funcionar

---

## 📋 Checklist de Setup

- [ ] Extraí o ZIP
- [ ] Li START_HERE.md
- [ ] Instalei Node.js
- [ ] Rodei `npm install`
- [ ] Rodei `npm install` no frontend/
- [ ] Configurei .env
- [ ] Rodei `npm run db:init`
- [ ] Backend rodando em :5000
- [ ] Frontend rodando em :3000
- [ ] Consegui acessar http://localhost:3000

---

## ✨ Primeira Coisa a Fazer

1. **Abrir [START_HERE.md](./START_HERE.md)**
2. **Seguir os passos**
3. **Testar com [TESTE_RAPIDO.md](./TESTE_RAPIDO.md)**

---

## 🎯 Próximos Passos

Depois de conseguir rodar:

1. Leia [GUIA_FUNCIONALIDADES.md](./GUIA_FUNCIONALIDADES.md)
2. Customize as cores em Branding
3. Crie alguns processos
4. Teste com sua equipe
5. Deploy em produção usando [DEPLOY.md](./DEPLOY.md)

---

## 📞 Precisa de Ajuda?

### Para Instalar/Rodar
→ Leia [README.md](./README.md)

### Para Entender Como Usar
→ Leia [GUIA_FUNCIONALIDADES.md](./GUIA_FUNCIONALIDADES.md)

### Para Deploy
→ Leia [DEPLOY.md](./DEPLOY.md)

### Para Entender Tecnicamente
→ Leia [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 🎉 Está Pronto!

Você tem **uma aplicação profissional completa** em suas mãos!

**Comece agora:** Abra `START_HERE.md` ⭐

---

**Versão do Projeto**: 1.0.0  
**Data**: 2024  
**Status**: ✅ Pronto para Usar/Customizar/Deploy

Sucesso! 🚀
