# HubSoft API — Reference Documentation

Generated from `Hubsoft API.postman_collection.json` (repo root). HubSoft is an ERP for
internet providers / telecom companies (ISPs); this collection documents its integration
API, used across this repo (see `processo-audit-app/processo-audit-app/src/services/hubsoft/`).

This is a **reference**, split into one file per module so it stays navigable. Each file
mirrors the structure of the Postman collection: folder → sub-folder → endpoint, with
method, full path, headers, query params, request body, description (kept in the original
Portuguese, as written by HubSoft) and a truncated example response where the collection
provided one.

> Source of truth: if this doc and the live Postman collection ever disagree, trust the
> collection (`Hubsoft API.postman_collection.json`) — re-run the extraction if it's been
> updated. This doc is a snapshot.

## Base setup

| Var | Example | Notes |
| --- | --- | --- |
| `url` | `https://api.endereco.com.br` | Base URL of the provider's HubSoft instance — every path below is relative to this |
| `client_id` | `89` | Created by the provider's admin user |
| `client_secret` | `ONe7Ns48Y30tB` | Created by the provider's admin user |
| `username` | `api@solucao.com` | Created by the provider's admin user |
| `password` | `!@$fas4jFADSF81731` | Created by the provider's admin user |
| `grant_type` | — | Sent as-is to `/oauth/token` |

## Authentication

See [01-autenticacao.md](01-autenticacao.md) for the full endpoint doc. Summary:

1. `POST {url}/oauth/token` with `client_id`, `client_secret`, `username`, `password`,
   `grant_type` in the JSON body → returns `access_token`, `expires_in` (seconds, typically
   `2592000` = 30 days), `refresh_token`, `token_type: "Bearer"`.
2. Every other endpoint requires header:
   ```
   Authorization: Bearer <access_token>
   ```
   (the collection's own request headers just show `{{access_token}}` — the variable is
   expected to already include the `Bearer ` prefix, or you add it yourself, as this repo's
   client does).
3. Token expires per `expires_in`. On any `HTTP 401`, re-authenticate — HubSoft may also
   invalidate all tokens server-side (e.g. during platform updates), so treat 401 as
   "always get a fresh token," not just a timer thing. This repo's implementation
   (`hubsoftAuth.js`) caches the token, proactively refreshes every 24h, and reactively
   re-authenticates on a 401.

**Existing implementation in this repo:**
- `processo-audit-app/processo-audit-app/src/services/hubsoft/hubsoftAuth.js` — token fetch/cache/refresh
- `processo-audit-app/processo-audit-app/src/services/hubsoft/hubsoftClient.js` — generic `hubsoft.get/post/put/patch/delete` wrapper
- `processo-audit-app/processo-audit-app/src/routes/hubsoft.js` — Express routes exposing HubSoft data to the frontend
- `processo-audit-app/processo-audit-app/frontend/src/pages/Hubsoft*.jsx` — frontend pages (Explorer, Users, Tecnicos, LoginSearch)

## Conventions seen across the API

- **Base path:** almost every business endpoint lives under `/api/v1/integracao/...`.
- **Pagination:** list endpoints generally take `pagina` (0-indexed) and `itens_por_pagina`
  (min 1, max 500) and return a `paginacao` object: `primeira_pagina`, `ultima_pagina`,
  `pagina_atual`, `total_registros`. Loop until `pagina_atual == ultima_pagina`.
- **Response envelope:** success responses are generally `{"status": "success", "msg": "...", ...data}`;
  errors are generally `{"status": "error", "msg": "...", "errors": [...]}` — note HubSoft
  often returns validation errors with `HTTP 200`, not `HTTP 4xx`, so check `status` in the
  body, not just the HTTP status code.
- **Relations:** many "listar/consultar" endpoints accept a `relacoes` query param
  (comma-separated) to eager-load nested data (e.g. `endereco_instalacao,pacotes,anexos`).
  Use sparingly — more relations = slower responses.
- **Multi-value filters:** params like `servico_status`, `motivo_cancelamento`,
  `grupo_cliente`, `vendedor` accept comma-separated IDs/values for OR-filtering.
- **Dates:** `YYYY-MM-DD` unless stated otherwise.

## Modules

| File | Module | Contents |
| --- | --- | --- |
| [01-autenticacao.md](01-autenticacao.md) | Autenticação | OAuth token endpoint |
| [02-atendimento.md](02-atendimento.md) | Atendimento | Tickets/support cases: list, add, edit, messages, attachments, satisfaction surveys |
| [03-clientes.md](03-clientes.md) | Clientes | Customers: search, register, service (cliente_servico) lifecycle (activate/enable/suspend), passwords, contracts, invoices, NF, service orders, packages, auth/CPE binding, MAC reset, attachments |
| [04-crm.md](04-crm.md) | CRM | List CRM pipelines |
| [05-estoque.md](05-estoque.md) | Estoque | Warehouses, stock movements (entrada/saída/transferência/retorno), products, asset items (patrimônio), linked products, suppliers |
| [06-financeiro.md](06-financeiro.md) | Financeiro | Billing events, invoices (fatura), renegotiation (renegociação), one-off charges (cobrança avulsa), accounts payable |
| [07-tarefas.md](07-tarefas.md) | Tarefas | Tasks: create/edit/delete, start/complete/cancel/resume actions |
| [08-ordem-servico.md](08-ordem-servico.md) | Ordem de Serviço | Service orders: schedule, reschedule, close, agenda availability, messages, attachments |
| [09-mapeamento.md](09-mapeamento.md) | Mapeamento | Network/GIS mapping: optical boxes, feasibility (viabilidade) by address/coordinates, service ports, projects |
| [10-nota-fiscal.md](10-nota-fiscal.md) | Nota Fiscal | Fiscal documents: NFS-e, Telecom (models 21/22), NFCom, NF-e (55), inbound notes |
| [11-pbx.md](11-pbx.md) | PBX | Call notify/cancel webhooks |
| [12-prospectos.md](12-prospectos.md) | Prospectos | Leads: list, available plans by CEP, add, edit, search |
| [13-rede.md](13-rede.md) | Rede | Network: CPE list/reboot/restore/manage, equipment, POPs, service zones, optical boxes |
| [14-configuracao.md](14-configuracao.md) | Configuração | Lookup/reference data: statuses, types, reasons, cities, companies, groups, contract templates, sellers, payment methods, etc. — mostly used to resolve IDs referenced elsewhere |

## Endpoint index (by module)

```
Autenticação
  POST  oauth/token

Atendimento
  Avaliação (v1.117+)
    GET   .../avaliacao/consultar_avaliacao
    GET   .../avaliacao/gerar_questoes_avaliacao
    POST  .../avaliacao/avaliar
  GET   atendimento/paginado/:quantidade
  GET   atendimento/todos
  POST  atendimento
  PUT   atendimento/:id_atendimento
  POST  atendimento/adicionar_mensagem/:id_atendimento
  POST  atendimento/adicionar_anexo/:id_atendimento

Clientes
  GET   cliente/atendimento
  Cliente Serviço
    Documentação de Senhas: POST/GET/PUT/DELETE cliente_servico/senhas
    PUT   cliente_servico/editar/:id_cliente_servico
    POST  cliente_servico/ativar|habilitar|suspender/:id_cliente_servico
    POST  vincular_cpe
  Contrato
    POST  contrato/adicionar_contrato
    POST  contrato/enviar_email
    PUT   contrato/aceitar_contrato
    DELETE contrato/:id_cliente_servico_contrato
    POST  contrato/adicionar_anexo_contrato/:id
  Financeiro: GET financeiro, POST enviar_email|enviar_sms|enviar_push
  Nota Fiscal: GET nota_fiscal, POST enviar_email
  Ordem de Serviço: GET ordem_servico
  Pacote: GET consultar, PATCH ativar, DELETE, PUT, POST (add)
  Outros: autenticacao, configurar_autenticacao, desbloqueio_confianca,
          solicitar_desconexao, extrato_conexao, reset_mac_addr,
          reset_phy_addr, update_id_externo
  GET   cliente/todos
  PUT   cliente/cadastro/:id_cliente
  GET   cliente (busca)
  POST  cliente/adicionar_anexo/{id_cliente}

CRM
  GET   crm/all

Estoque
  Local de Estoque: GET listar, GET por ID
  Movimentação: entrada (manual/compra), saída (manual/usuario/pop_conexao/
                projeto_mapeamento/cliente_servico), transferência,
                retorno_estoque (mesmas 4 variações), GET listar/por ID,
                DELETE
  Produto: GET listar/por ID, POST, PUT, DELETE
  Patrimônio (produto_item): GET consultar/listar/por ID, PUT editar/status
  Produtos Vínculados: GET por usuario/pop_conexao/projeto_mapeamento/
                       cliente_servico
  Fornecedor: POST, DELETE (ativar/inativar), PUT, GET por ID/listar

Financeiro
  Evento de Faturamento: POST
  Fatura: GET listar, POST liquidar
  Renegociação: GET listar, POST simular, POST efetivar
  Cobrança Avulsa: GET listar
  Conta a Pagar: GET listar

Tarefas
  Ações: PUT inicia|conclui|cancela|retomar_tarefa/:id
  POST tarefa, PUT tarefa/:id, DELETE tarefa/:id

Ordem de Serviço
  GET   ordem_servico/todos
  GET   ordem_servico/horarios_disponiveis_agenda
  POST  agendar | consultar | reagendar | fechar | remove_agendamento
  POST  adicionar_mensagem/:id | adicionar_anexo/:id | abrir_os

Mapeamento
  Caixas Ópticas: GET consulta, GET listar (por projeto)
  Viabilidade: POST consultar (endereço ou coordenadas)
  Porta Atendimento: PUT vincular/remover/atualizar, PATCH reservar
  Projetos: GET listar

Nota Fiscal
  NFSE: GET listar, PUT editar, PUT update_id_externo2
  Telecom (21/22): GET listar, PUT update_id_externo2
  NFCOM: GET listar, PUT update_id_externo
  NFE (55): GET listar, PUT update_id_externo
  Nota de Entrada: GET listar

PBX
  POST  pbx/ligacao/notificar
  POST  pbx/ligacao/cancelar

Prospectos
  GET   prospecto/all
  GET   prospecto/create?cep=...
  POST  prospecto
  PATCH prospecto/:id_prospecto  (v1.117+)
  GET   prospecto (busca)

Rede
  CPE: GET todos, POST reiniciar_cpe/restaurar_cpe, GET iniciar_gerenciamento,
       POST gerenciar
  GET   equipamento | pop | zona_atendimento | caixa_optica

Configuração  (mostly read-only lookup tables used to resolve IDs)
  Alerta: GET/POST/PUT/DELETE
  Atendimento: tipo_atendimento, status_atendimento, motivo_fechamento_atendimento
  Estoque: categoria, cest, cst_origem, produto_marca, ncm, status_compra,
           produto_item_status, produto_tipo
  Financeiro: caixa_financeiro, meio_pagamento
  Ordem de Serviço: tipo_ordem_servico, motivo_fechamento_os, tecnico
  Serviços: servico, servico_status, servico_tecnologia
  Tarefas: tarefa_categoria, tarefa_grupo
  Rede: modelo_equipamento, tipo_equipamento
  + tipo_contato, cidade, disponibilidade, empresa, grupo_cliente,
    grupo_cliente_servico, modelo_contrato, motivo_contratacao,
    origem_cliente, origem_contato, pacote/consultar, tipo_servico,
    vencimento, vendedor
```

## Regenerating this doc

The extraction script lived at
`/tmp/claude-0/-root-processos/8d870334-cb75-44ab-94d4-ed52b6d6a884/scratchpad/gen_docs.py`
during generation (session scratchpad — not persisted in the repo). It reads
`Hubsoft API.postman_collection.json`, walks the folder tree, and renders one Markdown file
per top-level module with nested headings matching folder depth. Re-run the same approach
(dump the collection to JSON, walk `item[]` recursively, render method/url/headers/query/
body/description/first response per leaf request) if the collection is updated and this
doc needs to be refreshed.
