# Prompt — tutorial do Indique e Ganhe para atendentes

Como usar: preencha os campos `[PREENCHER]` da seção 9 (estão em **Configurações** na tela Indique e Ganhe e no
portal público), anexe capturas de tela das telas Leads, Indique e Ganhe e do portal, se tiver, e cole tudo o que
está abaixo da linha em uma conversa nova.

---

## PROMPT

Você é um redator de treinamento interno de uma provedora de internet (Conexão Web Telecom). Escreva um **tutorial
prático para os atendentes** sobre o programa **Indique e Ganhe**. Os atendentes não são técnicos: sabem usar o
Hubsoft e o painel interno, mas não sabem como o sistema funciona por dentro. Quero que, depois de ler, qualquer
atendente consiga tratar uma indicação do começo ao fim sem pedir ajuda e saiba responder ao cliente sem prometer
o que o sistema não faz.

Use **somente** os fatos das seções 1 a 8 e os dados da seção 9. Se faltar uma informação, escreva
`[CONFIRMAR: o que falta]` no lugar. Não invente valores, prazos, URLs, nomes de botões nem regras.

### 1. O que é o programa

Um cliente da empresa (o **indicador**) indica uma pessoa nova (o **indicado**). Quando a indicação se concretiza,
o indicador ganha uma recompensa na fatura dele. A recompensa e o momento em que ela é liberada são configurados
pela empresa (seção 9). O atendente não precisa calcular nada: o sistema aplica a recompensa sozinho.

### 2. Como o cliente indica (portal público, sem login)

1. O indicador abre o portal, escolhe **"Já sou cliente"** e informa o **CPF**. O portal mostra o link exclusivo
   dele, com o botão **Copiar Link**.
2. Se o indicador tem mais de um plano, ele escolhe **qual plano vai receber o desconto**.
3. Ele envia o link a quem quiser indicar. Na aba **Meus Resultados** acompanha as indicações dele. Para o cliente,
   o portal só mostra três situações: Ativo, Cancelado e Pendente (tudo o que ainda está em andamento aparece
   como Pendente).
4. O indicado abre o link (ou escolhe **"Fui indicado"** e digita o código do amigo) e preenche: nome completo, CPF,
   telefone, endereço (CEP é opcional e preenche o endereço sozinho), número, complemento (opcional), bairro,
   cidade e estado. Ao final clica em **"Quero ganhar meu desconto"** e vê a mensagem de que a equipe entrará
   em contato.

O portal bloqueia o cadastro nestes casos, e o indicado vê a mensagem correspondente:
- CPF inválido.
- CPF que **já é cliente** da empresa.
- CPF que **já tem cadastro de prospecto** no Hubsoft.
- CPF que **já foi indicado** antes (e a indicação não foi cancelada).
- **CNPJ**: empresas não entram pelo portal; o atendimento comercial envia uma proposta.

O portal não cria prospecto no Hubsoft. Quem define e vende o plano é o atendente/vendedor.

### 3. O que o atendente faz com cada indicação (tela Leads)

A tela **Leads** lista as indicações recebidas. Colunas: indicado, CPF, telefone, bairro, plano, indicador, data,
status, 1º boleto e fatura atual. Dá para buscar pelo **ID do indicador** e filtrar por status. No menu de ações
(três pontinhos) de cada lead há **Ver detalhes**, **Histórico** e, só quando o status é Pendente,
**Informar envio ao CRM**.

Passo a passo:
1. Abrir a tela **Leads** e filtrar por **Pendentes**.
2. Abrir **Ver detalhes** e conferir contato, plano escolhido, endereço e quem indicou.
3. Entrar em contato com o indicado e fechar a venda.
4. **Cadastrar o lead no CRM do Hubsoft manualmente.** O sistema não cria o cartão sozinho.
   Use o **mesmo CPF** informado na indicação: é por ele (e pelo código do cliente e pelo prospecto) que o sistema
   reconhece depois que aquele cliente veio de uma indicação.
5. Só **depois** de cadastrar, voltar ao lead e clicar em **Informar envio ao CRM**, escolher o **funil** e
   **Confirmar**. A própria tela pede para confirmar que o cadastro no Hubsoft já foi feito. O status vira
   **Encaminhado** e o **Histórico** registra o nome do atendente.
6. Quando o indicado é ativado no Hubsoft, o sistema faz o resto (seção 5).

O **Histórico** mostra a linha do tempo do lead: recebimento, envio ao CRM, com data/hora, atendente, IP e
dispositivo. Serve para saber quem fez o quê.

### 4. Status que o atendente vai ver

| Status | Significado | O que fazer |
|---|---|---|
| Pendente | Indicação recebida, ninguém tratou ainda | Contatar o indicado, cadastrar no Hubsoft e informar o envio ao CRM |
| Encaminhado | Atendente já informou o envio ao CRM | Acompanhar a venda/instalação |
| Ag. Pagamento | Indicado já foi ativado, mas a recompensa só sai quando ele pagar a 1ª fatura (só existe nessa regra) | Nada; o sistema libera sozinho após o pagamento |
| Ativo | Recompensa aplicada ao indicador | Informar o cliente, se ele perguntar |
| Cancelado | Indicação cancelada, ou indicado ficou sem serviço ativo | Explicar ao indicador que não houve recompensa |
| Manual | Desconto lançado direto para um cliente, sem indicado | Só informativo |

Também há duas colunas de pagamento: **1º Boleto** (pago/vence/venceu) e **Fatura Atual** (pago/aguardando/vencido).
O sistema as atualiza sozinho ao abrir a tela e consultar o Hubsoft. Se aparecer "Sem dado disponível no Hubsoft",
é porque a consulta não retornou fatura.

### 5. Como e quando o indicador recebe a recompensa

- Existem **duas regras** de liberação, definidas pela empresa: **na ativação do serviço** do indicado, ou **quando o
  indicado pagar a primeira fatura**. Na segunda, o lead fica em **Ag. Pagamento** até o pagamento.
- Existem **dois tipos** de recompensa: **desconto em valor (R$)** ou **remoção de uma fatura**.
- **Ponto que mais gera dúvida do cliente:** o sistema não consegue alterar uma fatura que **já foi gerada**. Se, na
  hora de liberar a recompensa, o indicador já tem uma fatura em aberto, o desconto **não** entra nela: ele vale a
  partir da **próxima** fatura. Na tela Indique e Ganhe isso aparece como **"Adiado p/ próxima"**. O atendente deve
  explicar isso ao cliente e **nunca prometer** que o desconto vem na fatura que ele já tem em mãos.
- Cada indicação gera um registro de desconto com **fatura de referência**, **vencimento** e número do **evento
  Hubsoft**. É onde o atendente confere qual fatura recebeu a recompensa.

### 6. Tela Indique e Ganhe (uso interno)

Mostra todas as indicações e contadores por status, com busca por nome ou código do cliente. Botões:
- **Nova Indicação**: registrar uma indicação feita por telefone/balcão. Informa-se o **código do indicador** (o
  nome e os planos aparecem sozinhos), o **plano do indicador** que receberá o desconto e o **ID do prospecto** do
  indicado. Uma pessoa só pode ser indicada uma vez: se já tiver sido indicada por outro cliente, o sistema recusa.
- **Configurações**: tipo de recompensa, valor do desconto e regra de liberação.
- **Teste**: **simula** um desconto sem gravar nada e só depois de ver o resultado permite aplicar de verdade.
  Mostra qual fatura seria afetada, se a fatura em aberto ficaria de fora e o valor lançado. Bloqueia quando a
  fatura alvo já está paga ou quando o desconto é maior que a fatura.
- Em cada linha: **Cancelar** (só para Pendente), **Editar** e **Excluir**. **Excluir apaga a indicação para
  sempre**; recomende cancelar em vez de excluir.

[CONFIRMAR: quais perfis de usuário (atendente, gestor, administrador) veem cada tela e cada botão. Se o
atendente não tem acesso a Configurações, Teste ou Excluir, diga isso e indique a quem escalar.]

### 7. Erros comuns (inclua como seção "Evite estes erros")

- Clicar em **Informar envio ao CRM** antes de cadastrar o lead no Hubsoft.
- Cadastrar o cliente no Hubsoft com **CPF diferente** do informado na indicação: o sistema pode não achar a
  indicação e a recompensa não sai.
- Prometer que o desconto cai na fatura atual (veja "Adiado p/ próxima").
- Prometer valor ou prazo sem conferir a configuração vigente.
- Excluir uma indicação em vez de cancelar.
- Tentar indicar empresa (CNPJ) pelo portal: encaminhar para proposta comercial.
- Tentar contornar o bloqueio de CPF que já é cliente ou prospecto: nesses casos não há indicação.

### 8. Perguntas que os clientes fazem (inclua como FAQ, com resposta pronta de atendimento)

- "Indiquei meu amigo e não recebi o desconto."  (verificar o status no Leads: Pendente, Encaminhado, Ag. Pagamento,
  Ativo ou Adiado; conferir se o CPF do cadastro é o mesmo da indicação)
- "Por que meu amigo aparece como Pendente?"  (o portal público agrupa tudo o que está em andamento como Pendente)
- "O desconto não veio na fatura que já recebi."  (explicar o adiamento para a próxima fatura)
- "Meu amigo já era cliente / já tinha pedido contato antes."  (nesses casos o sistema não aceita a indicação)
- "Posso indicar mais de uma pessoa?"  (a regra de limite, se existir, está na seção 9)
- "Tenho dois planos, em qual vem o desconto?"  (no plano escolhido pelo indicador ao gerar o link)
- "Como acompanho minhas indicações?"  (portal público, **Já sou cliente**, aba **Meus Resultados**)
- "Posso indicar minha empresa / uma empresa?"  (CNPJ: proposta comercial)

### 9. Dados da empresa (preencher antes de usar)

- Nome do programa para o cliente: Indique e Ganhe
- Endereço do portal público: `[PREENCHER]`
- Endereço do painel interno / menus (Indique e Ganhe, Leads): `[PREENCHER se for citar]`
- Tipo de recompensa em vigor (desconto em R$ ou remoção de fatura): `[PREENCHER]`
- Valor do desconto, se for em R$: `[PREENCHER]`
- Regra de liberação em vigor (na ativação ou na 1ª fatura paga): `[PREENCHER]`
- Funil do CRM que o atendente deve escolher: `[PREENCHER]`
- Prazo interno para contatar o indicado depois que o lead chega: `[PREENCHER ou "não definido"]`
- Há limite de indicações por cliente, ou regra de fidelidade para o indicado? `[PREENCHER ou "sem limite"]`
- Planos que o atendente pode oferecer ao indicado: `[PREENCHER]` (hoje o portal oferece Básico, Mais Vendido,
  Avançado e Premium; confirme os valores atuais antes de citá-los)
- Quem o atendente aciona em caso de problema (nome/setor/canal): `[PREENCHER]`

### 10. O que entregar

Entregue o tutorial em português do Brasil, em **Markdown**, com esta estrutura:

1. **Em 1 minuto**: o que é o programa e o que cabe ao atendente (5 linhas no máximo).
2. **Visão geral do caminho**: um fluxo simples do indicador até a recompensa, em lista numerada.
3. **Passo a passo do atendente**: seção 3 detalhada, com cada passo curto, no imperativo, e o nome exato do
   botão ou menu entre aspas. Onde houver captura de tela, deixe a marcação `[IMAGEM: descrição do que mostrar]`.
4. **Status e o que fazer em cada um**: tabela.
5. **Quando e como o indicador ganha**: a regra e o tipo vigentes (seção 9) e o aviso do "Adiado p/ próxima".
6. **Evite estes erros**: lista.
7. **Perguntas frequentes**: pergunta, resposta pronta de atendimento (2 a 3 frases, tom cordial) e, quando
   couber, onde conferir no sistema.
8. **Checklist de bolso**: no máximo 8 itens, para imprimir ou fixar na tela.
9. **Teste seu conhecimento**: 6 perguntas de múltipla escolha com gabarito comentado, cobrindo os erros comuns.

Regras de estilo:
- Frases curtas, sem jargão. Não use "webhook", "API", "endpoint", "evento de faturamento" nem termos de código;
  diga "o sistema" ou "o Hubsoft".
- Trate o leitor por "você". Tom de colega experiente, não de manual jurídico.
- Não repita a mesma explicação em seções diferentes: remeta à seção.
- No máximo 4 páginas de texto, sem contar o quiz e o FAQ.
- Ao final, liste em até 5 itens o que ficou como `[CONFIRMAR]`, para eu resolver antes de publicar.
