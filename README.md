# Processos — Sistema de Gestão Operacional

Plataforma web para gestão de processos, execuções, arquivos, departamentos, chamados e frota. Desenvolvida com **Node.js + Express** no back-end e **React + Vite** no front-end.

---

## Telas

### Dashboard (`/dashboard`)
Visão geral do sistema: processos recentes, estatísticas de execuções e acesso rápido aos principais módulos.

![Dashboard](telas/pt-br/DASHBOARD.png)

---

### Processos (`/processos`)
Cadastro e gerenciamento de processos operacionais com etapas, departamento responsável e status. Suporta busca, filtros por departamento/status, paginação e exportação em PDF.

![Processos](telas/pt-br/PROCESSOS.png)

---

### Arquivos (`/arquivos`)
Repositório centralizado de arquivos vinculados a processos. Permite upload, visualização e download de documentos e anexos.

![Arquivos](telas/pt-br/ARQUIVOS.png)

---

### Departamentos (`/departamentos`)
Gerenciamento dos departamentos da organização. Cada processo e usuário pode ser associado a um departamento.

![Departamentos](telas/pt-br/DEPARTAMENTOS.png)

---

### Execuções (`/execucoes`)
Acompanhamento de todas as execuções de processos: histórico, status, responsável e data. Permite filtrar execuções próprias ou de toda a equipe.

![Execuções](telas/pt-br/EXECUÇÕES.png)

---

### Tickets (`/tickets`)
Sistema de chamados interno com suporte a tipos (Tarefa, Bug, História, Feature), prioridades (Baixa, Média, Alta, Urgente) e status (Aberto → Em andamento → Resolvido → Fechado). Visualização em lista ou kanban, comentários em tempo real e etiquetas coloridas.

![Tickets](telas/pt-br/TICKETS.png)

---

### Branding (`/branding`)

Personalização da identidade visual da plataforma, dividida em duas seções:

**Informações Básicas** — nome da empresa, logotipo e favicon.

![Branding - Informações Básicas](telas/pt-br/branding1.png)

**Paleta de Cores e Preview** — definição das cores primária, secundária e de destaque com prévia em tempo real da interface.

![Branding - Paleta de Cores](telas/pt-br/BRANDING2.png)

---

### Frota (`/frota`)
Gestão completa da frota de veículos com abas para:
- **Painel** — métricas e resumo da frota
- **Status** — situação atual de cada veículo
- **Veículos** — cadastro e detalhes dos carros
- **Motoristas** — gestão dos motoristas
- **Abastecimento** — registro de abastecimentos com leitura de QR Code em cupons fiscais
- **Manutenção** — histórico e agendamento de manutenções

---

## Tecnologias

| Camada | Stack |
|--------|-------|
| Front-end | React 18, Vite, React Router, CSS Modules |
| Back-end | Node.js, Express |
| Banco de dados | PostgreSQL |
| Autenticação | JWT |
| PDF | jsPDF + AutoTable |

---

## Executando localmente

```bash
# Instalar dependências
cd processo-audit-app/processo-audit-app
npm install
cd frontend && npm install

# Back-end
npm start

# Front-end (em outro terminal)
cd frontend && npm run dev
```
