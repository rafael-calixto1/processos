# API do app mobile dos técnicos (Fase 1)

Novo cliente do mesmo backend. Tudo em `/api`, JSON, mensagens de erro em pt-BR no formato `{ "error": "..." }`.

## Antes de subir em produção (ordem importa)

1. **Migração primeiro**, depois reiniciar o backend. O `DB_NAME` precisa vir explícito no comando (o script ignora o `.env` de propósito):
   ```bash
   DB_NAME=processo_audit node scripts/migrate_os_mobile.js          # aplica (idempotente)
   DB_NAME=processo_audit node scripts/migrate_os_mobile.js --down   # reverte
   ```
2. `pm2 restart processo-audit-backend`.
3. Variáveis opcionais no `.env`:
   | Variável | Efeito |
   |---|---|
   | `FOTOS_DIR` | Pasta das fotos de OS. Padrão: `storage/os_fotos` (fora de `uploads/`, nunca servida como estática). Faça backup dela junto com o banco. |
   | `CORS_ALLOWED_ORIGINS` | Lista separada por vírgula das origens de navegador permitidas. Vazia = comportamento aberto de hoje. O app nativo não usa CORS. (O `CORS_ORIGIN` que já existe no `.env` não é lido por nenhum código.) |
   | `LOG_BODIES=1` | Só para depuração: loga corpos de requisição redigidos. Nunca loga `/auth` nem upload. |

As rotas que o **web** já usa não dependem da migração: se o backend reiniciar antes dela, a lista e o detalhe de OS continuam funcionando (coberto por teste).

## Convenções

- **Sessão do app:** `POST /auth/login` com o campo extra `dispositivo` devolve token de acesso de **15 min** e `refresh_token` de **30 dias** (rotativo). Sem `dispositivo` o login é o do web (token de 24 h, sem refresh).
- **Token expirado** responde **403** `{ "error": "Token inválido ou expirado", "code": "token_expirado" }`. O app renova em `/auth/refresh` e repete a chamada. (401 = sem token ou sessão revogada.)
- **`Idempotency-Key`** (UUID, 8–80 caracteres `A-Za-z0-9._:-`) é aceito em `POST /os/:id/{materiais,lancamentos,servicos,iniciar,fotos,finalizar}` e em `POST /estoque/devolucoes` (solicitação do técnico). Repetir a mesma chave devolve a **mesma resposta** com `"repetida": true` e o cabeçalho `Idempotent-Replayed: true`, sem executar de novo. A chave vale por usuário, rota e corpo: usá-la para outra coisa dá **422**. Erros **não** ficam guardados: depois de corrigir o problema, reenvie com a mesma chave. Os registros expiram em 60 dias; o app deve tratar como "requer atenção" qualquer operação offline mais velha que isso.
- **Números:** `DECIMAL` do banco chega como número nas rotas novas (`bootstrap`, `fechamento`). Datas em ISO 8601 UTC; `prazo` é `YYYY-MM-DD`.
- **Erros de validação da finalização** trazem `detalhes: [{ campo, mensagem }]` com todos os problemas de uma vez.

## Endpoints

| Método e rota | Para quê |
|---|---|
| `POST /auth/login` (+`dispositivo`) | Sessão do app. Só perfil `tecnico` com técnico ativo vinculado (senão 403). Usuário `inactive` não entra. 10 falhas/15 min por e-mail → 429 com `Retry-After`. |
| `POST /auth/refresh` | Troca `refresh_token` por um novo par. Reapresentar um token já usado há mais de 60 s revoga a sessão inteira. |
| `POST /auth/logout` | Revoga a sessão. Sempre responde 200. |
| `GET /mobile/bootstrap` | Tudo numa chamada: OS (pendentes + encerradas dos últimos 30 dias), posse, motivos, checklist, técnicos ativos, itens, tipos de serviço, sugestões e `regras`. É um retrato completo: OS reatribuídas ou canceladas somem/mudam sozinhas. |
| `GET /os?atualizado_desde=<ISO>` | Só o que mudou (`>=`; deduplique por `id`). Acrescenta `atualizado_em` e `iniciado_em`. |
| `POST /os/:id/iniciar` | Grava `iniciado_em` (horário do aparelho; corrigido se estiver no futuro ou antes da abertura) e põe a OS em andamento. Repetir não muda nada. |
| `POST /os/:id/lancamentos` · `/materiais` · `/servicos` | Já existiam; agora com `Idempotency-Key`. |
| `POST /os/:id/fotos` | `multipart/form-data`: `foto` (JPEG/PNG, até 8 MB) + `client_uuid` (obrigatório) e opcionais `tirada_em`, `lat`, `lng`, `legenda`. Máx. 30 por OS. HEIC é recusado (o app converte para JPEG). |
| `GET /os/:id/fotos` · `GET /os/:id/fotos/:fotoId` | Lista / baixa. Exigem Bearer e dono da OS (ou estoque/admin). |
| `DELETE /os/:id/fotos/:fotoId` | Remove enquanto a OS está aberta. |
| `POST /os/:id/finalizar` | Finalização completa e atômica (abaixo). |
| `POST /estoque/devolucoes` | Técnico **solicita** a devolução de um lote da própria posse: `{lote_id, quantidade, condicao: "novo"\|"usado", observacao?}`. Não mexe no saldo até admin/estoque aprovar. Recusa (400) acima do que a posse tem **menos o que já está pendente** daquele lote. Com `Idempotency-Key`, reenviar não abre outra solicitação. Um lote por chamada. |
| `GET /estoque/devolucoes` | As solicitações do técnico (`status` pendente/aprovada/negada, `motivo_negacao`). O `bootstrap` já traz as pendentes e as decididas nos últimos 30 dias em `devolucoes`. |
| `GET /os/:id` | Agora também traz `fechamento`, `fotos` e `materiais_retirados`. |
| `GET /os/catalogos-fechamento` | Os mesmos catálogos do `bootstrap` (`motivos`, `checklist`, `tecnicos`, `itens`, `regras`) para quem não é o app: o **web** usa para montar a finalização. Técnico recebe a lista de técnicos sem ele mesmo; estoque/admin recebem todos os ativos. |
| `GET/POST/PUT /os-catalogos/motivos` · `/checklist` | **Só admin.** Administra os catálogos acima (nada é apagado, só desativado; código e tipo não mudam). Ver `docs/ENDURECIMENTO.md`. |

> **O web também finaliza por `POST /os/:id/finalizar`** (Fase 4b): fotos sobem na hora por `POST /os/:id/fotos`, retirados levam a condição novo/usado e o `client_uuid` fica guardado no rascunho. O `POST /os/:id/fechar` antigo continua funcionando, mas o web não o usa mais.

### Corpo de `POST /os/:id/finalizar`

```json
{
  "client_uuid": "UUID da finalização (obrigatório)",
  "descricao": "mais de 10 caracteres",
  "motivo_codigo": "route_launched",
  "local": { "lat": -23.5445, "lng": -46.3118, "precisao_m": 6, "origem": "gps|address|pole_reference", "endereco": "opcional", "aproximado": false, "capturado_em": "ISO" },
  "checklist": { "fiberLaunchedMeters": 350.5, "spliceEnclosureSealed": true },
  "materiais_usados": true,
  "materiais_retirados": true,
  "retirados": [ { "item_id": 12, "quantidade": 15.5, "condicao": "novo|usado" }, { "descricao": "Splitter antigo", "quantidade": 1, "unidade": "pecas", "condicao": "usado" } ],
  "participantes": [2, 7],
  "fotos_esperadas": ["client_uuid de cada foto já enviada"],
  "iniciado_em": "ISO", "finalizado_em": "ISO", "dispositivo": "Pixel 7", "versao_app": "0.1.0"
}
```

O servidor revalida tudo: descrição ≥ 11 caracteres, motivo ativo, local válido, todo item obrigatório do checklist com resposta do tipo certo, `materiais_usados` coerente com as baixas da OS (baixa totalmente estornada não conta), retirados com unidade/condição (peças inteiras), participantes ativos (o próprio técnico e repetidos são descartados), ao menos 1 foto e todas as `fotos_esperadas` já no servidor. Em seguida grava o fechamento (rótulos de motivo/checklist/participantes ficam copiados, então editar o catálogo depois não muda o histórico), os retirados (**só informação, o saldo do estoque não muda**), apaga o rascunho e encerra a OS, tudo na mesma transação.

Reenviar o mesmo `client_uuid` devolve o resultado (`repetida: true`) com ou sem `Idempotency-Key`. Outro `client_uuid` na mesma OS dá 409, assim como OS cancelada ou já encerrada pelo fluxo antigo do web (`/fechar`).

## Exemplos (executados contra o servidor real, banco de teste)

```bash
B=http://localhost:5000/api

# 1. login do app
curl -s -X POST $B/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"joao@exemplo.com","password":"senha123","dispositivo":"Pixel 7 · Android 14"}'
# {"token":"eyJ…","refresh_token":"fOtsA93Fx8tA…","expires_in":900,"user":{"id":2,"email":"joao@exemplo.com","name":"João Técnico","role":"tecnico"}}

# 2. bootstrap
curl -s $B/mobile/bootstrap -H "Authorization: Bearer $TOKEN"
# {"tecnico":{…},"os":[{"id":1,"numero":1,"status":"aberta","prazo":"2026-10-20","latitude":-23.5445,…}],
#  "posse":[{"lote_id":1,"lote_codigo":"LOTE-BOB-0001","item_nome":"Cabo óptico ASU 12F","unidade":"metros","quantidade":800}],
#  "motivos":[…],"checklist":[…],"tecnicos":[…],"regras":{"descricao_min_caracteres":11,"fotos_min":1,…}}

# 3. iniciar
curl -s -X POST $B/os/1/iniciar -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"iniciado_em":"2026-10-10T23:20:00Z"}'
# {"status":"em_andamento","iniciado_em":"2026-10-10T23:40:09.000Z"}   (corrigido para a abertura da OS)

# 4. lançamento idempotente — o segundo envio (retry offline) não baixa de novo
KEY=$(uuidgen)
curl -s -i -X POST $B/os/1/lancamentos -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"descricao":"Lançamento de cabo ASU 12F","trecho":"PL-0932 → PL-0945","materiais":[{"lote_id":1,"quantidade":350.5}]}'
# HTTP/1.1 201 Created        {"id":1,…,"materiais":[{"movimentacao_id":3,"quantidade":350.5,"saldo_lote":1649.5}]}
# (reenvio)  HTTP/1.1 201 Created · Idempotent-Replayed: true · {…,"repetida":true}
# posse: 800 → 449.5 (uma baixa só)

# 5. foto
curl -s -X POST $B/os/1/fotos -H "Authorization: Bearer $TOKEN" \
  -F "foto=@foto.jpg;type=image/jpeg" -F "client_uuid=$(uuidgen)" -F lat=-23.5445 -F lng=-46.3118
# {"id":1,"client_uuid":"5c3b6bbb-…","mime":"image/jpeg","tamanho":134,"lat":-23.5445,"lng":-46.3118,…}

# 6. finalizar incompleto → 400 com tudo que falta
curl -s -X POST $B/os/1/finalizar -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"client_uuid":"…","descricao":"curta","materiais_usados":true,"materiais_retirados":false}'
# {"error":"A OS não pode ser finalizada: Descrição muito curta: escreva mais de 10 caracteres (e mais 8 problema(s))",
#  "detalhes":[{"campo":"descricao",…},{"campo":"motivo",…},{"campo":"local",…},{"campo":"checklist","mensagem":"Responda o item do checklist: Metros de fibra lançados?"},…]}

# 7. finalizar completo
curl -s -X POST $B/os/1/finalizar -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: $(uuidgen)" \
  -H 'Content-Type: application/json' --data @pacote.json
# HTTP/1.1 201 Created   {"status":"concluida","fechamento_id":1,"finalizado_em":"2026-10-10T23:40:43.000Z"}
# GET /os/1 → status "concluida", fechamento{motivo, local, checklist com rótulos, participantes}, fotos[1], materiais_retirados[1],
#             histórico: aberta → em_andamento → concluida

# 8. foto só com login
curl -s -o /dev/null -w "%{http_code}\n" $B/os/1/fotos/1 -H "Authorization: Bearer $TOKEN"   # 200 image/jpeg
curl -s -o /dev/null -w "%{http_code}\n" $B/os/1/fotos/1                                      # 401
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5000/uploads/os_fotos/<arquivo>     # 404 (não é estático)

# 9. renovar e sair
curl -s -X POST $B/auth/refresh -H 'Content-Type: application/json' -d '{"refresh_token":"…"}'
# {"token":"eyJ…","refresh_token":"BgwpRXtIkE…","expires_in":900,"user":{…}}
curl -s -X POST $B/auth/logout  -H 'Content-Type: application/json' -d '{"refresh_token":"…"}'   # {"message":"Sessão encerrada"}
# refresh depois do logout → 401 {"error":"Sessão inválida. Entre novamente."}
```

## Testes

```bash
npm test        # DB_NAME=processo_audit_test node --test tests/
```

Os testes recriam o schema inteiro do zero e **recusam qualquer banco sem "test" no nome**. Os arquivos de teste se serializam por um lock do MariaDB, então `node --test tests/` roda tudo em paralelo com segurança.

## O que a Fase 1 não faz

- Não há endpoints de administração dos catálogos (motivos e itens de checklist): edite as tabelas `os_motivos_fechamento` e `os_checklist_itens` ou peça a tela de gestão.
- O web (`FinalizationHub`) ainda usa `/fechar` e continua perdendo os dados da finalização. Migrar para `/finalizar` ficou para a etapa 4b, depois do MVP.
- O `OrdemServicoDetalhe` do web ainda não **exibe** o fechamento (o `GET /os/:id` já devolve tudo).
- As rotas de upload antigas (processos, arquivos, branding…) seguem no multer 1.x, depreciado por vulnerabilidades; só o upload novo usa a 2.x (`multer-v2`).
- Um token de acesso já emitido vale até expirar (≤ 15 min) mesmo depois do logout; a revogação vale na próxima renovação. Inativar o usuário bloqueia imediatamente as rotas de OS/estoque.
- `/auth/register` continua público (cria `viewer`).
- A tolerância de reuso do refresh token (60 s) e os prazos (15 min / 30 dias) são valores propostos, ajustáveis em `src/services/sessao.js`.
