# 🎓 Guia de Funcionalidades - Processo Audit

## 📚 Sumário
1. [Dashboard](#dashboard)
2. [Processos](#processos)
3. [Execuções/Checklists](#execuções)
4. [Auditoria](#auditoria)
5. [Branding](#branding)
6. [Gestão de Arquivos](#arquivos)
7. [Dicas de Uso](#dicas)

---

## Dashboard

### O que é?
A página inicial da aplicação que mostra um resumo das atividades.

### Funcionalidades
- **Estatísticas**: Visualize o total de processos, ativos, rascunhos e departamentos
- **Processos Recentes**: Veja os últimos 5 processos criados
- **Departamentos**: Lista rápida de todos os departamentos

### Como Acessar
- Clique em "Dashboard" no menu lateral
- Ou acesse diretamente: `/dashboard`

### Ações Possíveis
- Clicar em um processo para ver detalhes
- Ir para a página de processos
- Filtrar por departamento

---

## Processos

### O que é?
Um processo é um conjunto de passos que devem ser seguidos para completar uma tarefa ou workflow.

### Estados de um Processo
- **📝 Rascunho**: Processo em criação, não visível para visualizadores
- **✅ Ativo**: Processo publicado e pronto para uso
- **📦 Arquivado**: Processo desativado, apenas para referência histórica

### Criar um Processo

1. Clique em **"Novo Processo"**
2. Preencha os campos:
   - **Título** (obrigatório): Nome descritivo do processo
   - **Descrição**: Explicação do que o processo faz
   - **Departamento** (obrigatório): Qual departamento este processo pertence

3. **Adicione Passos**:
   - Digite o título do passo (ex: "Validar documento")
   - Adicione uma descrição (opcional)
   - Clique "Adicionar Passo"
   - Repita para cada passo

4. Clique **"Criar Processo"**

### Editar um Processo

1. Acesse a página de processos
2. Clique no ícone **✏️ Editar**
3. Modifique os campos desejados
4. Clique **"Salvar"**

### Deletar um Processo

> ⚠️ Apenas Admins podem deletar

1. Clique no ícone **🗑️ Deletar**
2. Confirme a exclusão
3. O processo e todo seu histórico serão deletados

### Visualizar Detalhes

1. Clique no nome do processo (em qualquer listagem)
2. Você verá:
   - Informações básicas
   - Lista de passos com instruções
   - Histórico de auditoria (se manager/admin)
   - Opção de executar como checklist

---

## Execuções

### O que é?
Uma execução é quando um usuário realiza um processo, passo a passo, como um checklist interativo.

### Estados de Execução
- **⏱️ Em Progresso**: Usuário está executando o processo
- **✅ Completo**: Todos os passos foram concluídos
- **⏸️ Abandonado**: Execução foi cancelada

### Iniciar uma Execução

#### Opção 1: Pela página de Processos
1. Clique em um processo
2. Clique o botão **"Executar"**

#### Opção 2: Pelo Dashboard
1. Clique em um processo recente
2. Na página de detalhes, clique **"Executar"**

### Durante a Execução

**O que você verá:**
- Progress bar mostrando quantos passos completou
- Cada passo como um item expansível
- Instruções em Markdown (se fornecidas)
- Campo para adicionar anotações

**Como Completar um Passo:**
1. Clique no passo para expandir
2. Leia as instruções
3. Execute a ação descrita
4. (Opcional) Adicione anotações sobre o que foi feito
5. Clique **"Marcar como Completo"**

**Para Finalizar:**
1. Complete todos os passos (obrigatório)
2. Clique **"Finalizar Execução"**
3. A execução será marcada como completa

**Para Cancelar:**
1. Clique **"Cancelar"**
2. Você pode retomar depois

### Minhas Execuções

Clique em **"Minhas Execuções"** no menu para ver:
- Todas as suas execuções
- Filtrar por status
- Continuar execuções em progresso
- Ver execuções completas

---

## Auditoria

### O que é?
Sistema que registra TODAS as mudanças em processos para fins de conformidade e rastreamento.

### O que é Registrado

Para cada mudança, são registrados:
- **Quem**: Qual usuário fez a alteração
- **O quê**: Qual dados foram alterados (antes/depois)
- **Quando**: Data e hora exata
- **De onde**: IP de origem
- **Como**: User-Agent (navegador/sistema)
- **Tipo de ação**: Criação, atualização ou deleção

### Acessar Auditoria

> ℹ️ Apenas Managers e Admins veem auditoria

1. Acesse um processo
2. Clique na aba **"Auditoria"**
3. Veja todos os registros

### Interpretar os Logs

**Exemplo:**
```
✏️ ATUALIZADO
Por: João Silva
Em: 15/01/2024 14:30:45
IP: 192.168.1.100

Antes:
{
  "title": "Processar pedido",
  "status": "draft"
}

Depois:
{
  "title": "Processar pedido com validação",
  "status": "active"
}
```

### Casos de Uso

- **Conformidade**: Provar quem fez o quê em caso de auditoria
- **Rastreabilidade**: Entender o histórico de um processo
- **Segurança**: Detectar alterações suspeitas
- **Análise**: Ver como processos evoluíram

---

## Branding

### O que é?
A seção onde você customiza a aparência da aplicação de acordo com sua empresa.

### Personalizações Disponíveis

#### Informações Básicas
- **Nome da Empresa**: Aparece no header
- **Logo**: URL da logo (recomendado: 40x40px)
- **Favicon**: Ícone que aparece na aba do navegador

#### Cores
- **Cor Primária**: Botões, headers, destaques (padrão: #0ba52b)
- **Cor Secundária**: Acentos e elementos secundários (padrão: #bbf804)
- **Cor de Acento**: Textos escuros e backgrounds (padrão: #274518)
- **Cor de Fundo**: Fundo geral da interface (padrão: #ffffff)

### Como Atualizar

1. Admin: Clique em **"Branding"** no menu
2. Preencha os campos desejados
3. **Veja o preview em tempo real** na seção "Preview"
4. Clique **"Salvar Alterações"**

### Exemplos de Paletas de Cores

**Verde e Amarelo (padrão)**
- Primária: #0ba52b
- Secundária: #bbf804
- Acento: #274518
- Fundo: #ffffff

**Azul Corporativo**
- Primária: #1e40af
- Secundária: #06b6d4
- Acento: #0c4a6e
- Fundo: #f8fafc

**Vermelho Energético**
- Primária: #dc2626
- Secundária: #fbbf24
- Acento: #7c2d12
- Fundo: #fffbeb

### Histórico de Alterações

1. Admin: Clique em "Branding"
2. Scroll até "Histórico de Branding"
3. Veja todas as mudanças de branding com quem/quando

---

## Gestão de Arquivos

### O que é?
Um sistema de arquivos centralizado para armazenar documentos, manuais, planilhas e outros recursos importantes.

### Funcionalidades
- **Pastas**: Organize seus arquivos em uma estrutura hierárquica
- **Upload**: Envie múltiplos arquivos de uma vez
- **Download**: Baixe arquivos individuais ou pastas inteiras (compactadas em ZIP)
- **Gestão**: Renomeie pastas e exclua itens desnecessários

### Download de Pastas
Você pode baixar o conteúdo completo de uma pasta e todas as suas subpastas clicando no ícone de download (nuvem com seta) ao lado do nome da pasta. O sistema gerará automaticamente um arquivo ZIP contendo toda a estrutura de arquivos.

### Como Acessar
- Clique em **"Arquivos"** no menu lateral
- Ou acesse diretamente: `/arquivos`

---

## Dicas de Uso

### 📝 Boas Práticas para Processos

**Nomes Descritivos**
```
❌ Ruim: "Processo 1"
✅ Bom: "Aprovar Pedido de Compra"
```

**Descrições Claras**
```
❌ Ruim: "Fazer a coisa"
✅ Bom: "Validar documento e aprovar pedido seguindo normas de compliance"
```

**Passos Bem Estruturados**
```
✅ Bom:
1. Receber pedido
2. Validar dados
3. Verificar estoque
4. Processar pagamento
5. Gerar nota fiscal
```

### 📚 Documentação em Markdown

Os passos suportam **Markdown** para documentação rica:

```markdown
# Validar Documento

## O que fazer
- [ ] Verificar dados pessoais
- [ ] Validar assinatura
- [ ] Confirmar datas

## Exemplo
```
documentId: DOC-2024-001
status: pending
```

## Referências
Para mais info, veja o [Manual Interno](https://interno.empresa.com)
```

### 🔍 Filtrando Processos

Na página de Processos, você pode:
- **Filtrar por Departamento**: Veja apenas processos de um depto
- **Filtrar por Status**: Veja rascunhos, ativos ou arquivados

### ⏱️ Durante uma Execução

**Dica**: Se precisar pausar:
1. Clique na seta para recolher o passo
2. Feche a aba (seu progresso é salvo)
3. Retorne em "Minhas Execuções"
4. Clique "Continuar" para retomar

### 👥 Papéis e Permissões

| Ação | Viewer | Manager | Admin |
|------|--------|---------|-------|
| Ver processos | ✅ | ✅ | ✅ |
| Executar processos | ✅ | ✅ | ✅ |
| Criar processos | ❌ | ✅ | ✅ |
| Editar processos | ❌ | ✅ | ✅ |
| Deletar processos | ❌ | ❌ | ✅ |
| Ver auditoria | ❌ | ✅ | ✅ |
| Configurar branding | ❌ | ❌ | ✅ |
| Gerenciar usuários | ❌ | ❌ | ✅ |

---

## 🆘 Troubleshooting Rápido

**P: Posso voltar a um passo anterior na execução?**
A: Não. Os passos só podem avançar. Se errar, cancele a execução e inicie novamente.

**P: Meu processo não aparece para outros usuários.**
A: Verifique se o status é "Ativo". Rascunhos só aparecem para managers/admins.

**P: Posso editar um processo enquanto alguém o está executando?**
A: Sim, mas as mudanças não afetarão execuções em andamento.

**P: Como restaurar um processo deletado?**
A: Não é possível. Sempre verifique antes de deletar.

**P: Por que não consigo mudar as cores de branding?**
A: Apenas Admin pode. Solicite a um administrador.

---

**Última Atualização**: 2024
**Versão**: 1.0.0
