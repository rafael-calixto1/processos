# Ordem de Serviço

StartFragment

**Necessário**

Para fazer requisições nos dados de ordem de serviço, é necessário que você já possua o `access_token`, conseguido na etapa `(oAuth)`

EndFragment

## GET — Todos
*Ordem de Serviço*

```
GET {{url}}/api/v1/integracao/ordem_servico/todos
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `pagina` | `0` |
| `itens_por_pagina` | `100` |
| `data_inicio` | `` |
| `data_fim` | `` |
| `tipo_data` | `` |
| `destino` | `` |
| `id_destino` | `` |
| `status` | `` |
| `tecnico` | `` |
| `tipo_ordem_servico` | `` |
| `disponibilidade` | `` |

**Descrição:**

**Endpoint (Rota)**

Neste `endpoint`, será possível consultar todas as O.S., obtendo o retorno no formato `JSON` como resposta. Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| pagina | Página a ser exibida | Sim |
| itens_por_pagina | Itens por Página a serem exibidos. Mínimo: 1, Máximo: 500. | Sim |
| data_inicio | Data inicial de referência para consulta de ordens de serviço em um intervalo | Sim |
| data_fim | Data final de referência para consulta de ordens de serviço em um intervalo | Sim |
| tipo_data | O tipo de data poderá ser: data_cadastro, data_inicio_programado, data_inicio_executado, data_termino_programado, data_termino_executado | Não |
| destino | Destino da OS | Não |
| id_destino | Identificador para Consulta (Utilizado para consultar todas as OS de um determinado Cliente, POP ou Prospecto) | Não |
| status | Status da Ordem de Serviço | Não |
| tecnico | Técnicos responsáveis pela O.S | Não |
| tipo_ordem_servico | Filtro pelo Tipo de O.S | Não |
| agenda_ordem_servico | Filtro pela Agenda da O.S | Não |
| id_servico | Filtro pelo ID dos Serviços | Não |
| disponibilidade | Parâmetro utilizado para filtrar por disponibilidade cadastrado na O.S | Não |
| relacoes | Carrega apenas os relacionamentos especificados | Não |
| reservada | Filtro por O.S reservadas | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| pagina | Campo Inteiro (integer) | 0 |
| itens_por_pagina | Campo Inteiro (integer) | 50 |
| data_inicio | Formato date (2024-04-01 / 2024-04-01 08:15:00) | Nenhum |
| data_fim | Formato date (2024-04-30 / 2024-04-30 18:00:00) | Nenhum |
| tipo_data | Texto | data_inicio_programado |
| destino | destino da OS | cliente_servico, pop ou prospecto |
| id_destino | Campo Inteiro (integer) | Nenhum |
| status | status da O.S (Para consultar mais de um status, basta separar por vírgula ",") | pendente , finalizado ou aguardando_agendamento |
| tecnico | Valor no formato string (Para consultar mais de um técnico, basta separar por vírgula "," os ids) | Nenhum |
| tipo_ordem_servico | Valor no formato string (Para consultar mais de um tipo de OS, basta separar por vírgula "," os ids) | Nenhum |
| agenda_ordem_servico | Valor no formato string (Para consultar mais de uma agenda de OS, basta separar por vírgula "," os ids) | Nenhum |
| id_servico | Valor no formato numérico (id_servico) | Nenhum |
| disponibilidade | Valor no formato string (manha, tarde ou noite) | Nenhum |
| relacoes | tecnicos,ordem_servico_mensagem,anexos,link_rastreamento | Nenhum |
| reservada | sim, nao, reservada_em_execucao, reservada_sem_execucao | Nenhum |

**IMPORTANTE:** Lembre-se que essa é uma requisição que poderá retornar um volume muito grande de dados, portanto, utilize as relações com cautela, pois quanto mais relações forem utilizados, maior poderá ser o tempo de resposta da API.

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "paginacao": {
        "primeira_pagina": 0,
        "ultima_pagina": 0,
        "pagina_atual": 0,
        "total_registros": 4
    },
    "ordens_servico": [
        {
            "id_ordem_servico": 4962,
            "numero": 3679,
            "tipo": "ATIVAÇÃO FIBRA",
            "data_inicio_programado": "2024-05-31 08:00:00",
            "data_termino_programado": "2024-05-31 08:10:00",
            "data_inicio_executado": null,
            "data_termino_executado": null,
            "data_cadastro": "2024-04-08 16:00:49",
            "descricao_abertura": "Teste",
            "descricao_servico": "Teste",
            "descricao_fechamento": null,
            "status": "Aguardando Agendamento",
            "disponibilidade": "Manhã",
            "cliente": "(2123) PABLO CASTRO DE MELO",
            "servico": "(10) TESTE MAURO",
            "endereco_instalacao": "RUA 01, 150 - MANGABEIRAS, SANTO ANTÔNIO DO MONTE/MG | CEP: 35560-000"
        },
        {
            "id_ordem_servico": 4841,
            "numero": 3611,
            "tipo": "ATIVAÇÃO A TESTE DESENVOLVIMENTO",
            "data_inicio_programado": "2024-05-30 15:00:00",
            "data_termino_programado": "2024-05-30 16:00:00",
            "data_inicio_executado": null,
            "data_termino_executado": null,
            "data_cadastro": "2024-02-29 10:42:02",
            "descricao_abert
```

---
## GET — Consultar Horários Disponíveis na Agenda
*Ordem de Serviço*

```
GET {{url}}/api/v1/integracao/ordem_servico/horarios_disponiveis_agenda
```

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `id_agenda_ordem_servico` | `154` |
| `data_inicio` | `2024-05-10` |
| `dias` | `2` |

**Descrição:**

Através desse endpoint será possível consultar os horários disponíveis em uma Agenda de Ordem de Serviço. O retorno será obtido através de um JSON como resposta. Você pode optar por enviar o id_agenda_ordem_servico ou a descrição da Agenda como parâmetro na URL, conforme exemplo acima. Os seguintes parâmetros podem/devem estar presentes no corpo da requisição:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_agenda_ordem_servico | O ID da Agenda de Ordem Serviço que deve ser consultada | Não |
| descricao | A descrição da Agenda de Ordem de Serviço que deve ser Consultada | Não |
| data_inicio | Define a partir de qual dia a consulta deve ser feita | Não |
| dias | Define quantos dias devem ser consultados a paritr da data_inicio | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_agenda_ordem_servico | Campo Inteiro (integer) | Nenhum |
| descricao | Texto (string) | Nenhum |
| data_inicio | Formato date (2024-04-01) | Nenhum |
| dias | Campo Inteiro (integer) | Nenhum |

Obs: É necessário definir o id_agenda_ordem_servico ou a descrição da Agenda.

Obs 2: Se não for definido data_inicio ou dias, vai pegar apenas os horários disponíveis na data de hoje.

**Exemplo de resposta — Consultar Horários na Agenda**

```json
"status": "success",
    "msg": "Agenda consultada com sucesso!",
    "agenda": "SAMONTE - CENTRO, SÃO LUCAS E SÃO JOSÉ (Não Mexer)",
    "horarios": {
        "datas": {
            "2024-05-15": {
                "disponiveis": 1,
                "horarios": {
                    "16:00:00": {
                        "data_inicio": "2024-05-15",
                        "hora_inicio": "16:00:00",
                        "data_termino": "2024-05-15",
                        "hora_termino": "17:00:00",
                        "duracao_minutos": 60,
                        "duracao_str": "01:00:00",
                        "disponiveis": 7,
                        "tecnicos": [
                            {
                                "id": 4,
                                "name": "Teste API",
                                "email": "teste@hubsoft.com.br",
                                "id_imagem_upload": 699,
                                "enabled2fa": false,
                                "pivot": {
                                    "id_agenda_ordem_servico": 160,
                                    "id_usuario": 4
                                },
                                "imagem": {
                                    "id_imagem_upload": 699,
                                    "link": "",
                                    "link_thumb": ""
                                }
                            },
```

---
## POST — Agendar
*Ordem de Serviço*

```
POST {{url}}/api/v1/integracao/ordem_servico/agendar
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**Endpoint (Rota)**

Neste `endpoint`, será possível agendar uma O.S. que esteja aguardando agendamento, obtendo o retorno no formato `JSON` como resposta. Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_ordem_servico | Identificador da ordem de serviço | Sim |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_ordem_servico | Número Inteiro | Nenhum |

**Corpo da requisição (JSON):**

```json
{
  "id_ordem_servico": 99991
}
```

**Exemplo de resposta — Agendar**

```json
{
  "status": "success",
  "msg": "Agendamento salvo com sucesso",
  "ordem_servico": {
    "id_ordem_servico": 1493,
    "numero": "1262",
    "tipo": "INSTALAÇÃO FIBRA - VALORES OBRIGATÓRIOS: R$ 280.00",
    "data_inicio_programado": "2020-11-23 08:00:00",
    "data_termino_programado": "2020-11-23 09:30:00",
    "data_inicio_executado": null,
    "data_termino_executado": null,
    "data_cadastro": "2020-11-18 13:35:31",
    "descricao_abertura": "TESTE",
    "descricao_servico": "TESTE",
    "descricao_fechamento": null,
    "status": "Pendente",
    "tecnicos": [
      {
        "id": 1,
        "name": "Master",
        "pivot": {
          "id_ordem_servico": 1493,
          "id_usuario": 1
        }
      }
    ],
    "disponibilidade": "Manhã, Tarde",
    "cliente": "(1395) GUILHERME COUTO",
    "servico": "(1) PLANO 5 MBPS RAP10 E FIXO EM DOBRO",
    "endereco_instalacao": "PRAÇA GETÚLIO VARGAS, 77, SALA 411(SHOPPING WORK) - CENTRO, SANTO ANTÔNIO DO MONTE/MG | CEP: 35560-000"
  }
}
```

---
## POST — Consultar
*Ordem de Serviço*

```
POST {{url}}/api/v1/integracao/ordem_servico/consultar
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**Endpoint (Rota)**

Neste `endpoint`, será possível consultar ordens de serviço, obtendo o retorno no formato `JSON` como resposta. Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| consulta | Parametro que será utilizado para encontrar uma O.S. pelo seu número | Sim |
| relacoes | Carrega os relacionamentos especificados | Não |
| reservada | Filtro por O.S. reservada | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| consulta | Campo Inteiro (integer) | Nenhum |
| relacoes | tecnicos, motivos_fechamento, cobrancas_disponiveis, anexos, assinatura, equipamentos_insumos,link_rastreamento | Nenhum |
| reservada | sim, nao | Nenhum |

**Corpo da requisição (JSON):**

```json
{
  "consulta": "2921",
  "relacoes": [
    "tecnicos",
    "motivos_fechamento",
    "cobrancas_disponiveis"
  ]
}
```

**Exemplo de resposta — Consultar** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "ordens_servico": [
        {
            "cliente": "(2131) IASMIN TESTE 2 - (INATIVO)",
            "servico": "(2) TESTE ANA",
            "status_servico": "Cancelado",
            "endereco_instalacao": "AVENIDA JK, 180 - CENTRO, SANTO ANTÔNIO DO MONTE/MG | CEP: 35560-000",
            "pop": null,
            "id_ordem_servico": 4036,
            "numero": 2921,
            "tipo": "ATIVAÇÃO FIBRA",
            "id_tipo_ordem_servico": 95,
            "data_inicio_programado": "2023-12-18 06:00:00",
            "data_termino_programado": "2023-12-18 07:00:00",
            "data_inicio_executado": "2024-02-07 08:00:00",
            "data_termino_executado": "2024-02-07 08:25:41",
            "data_cadastro": "2023-12-12 14:37:54",
            "descricao_abertura": "O serviço estava com status Suspenso por Débito há 48 dias, por esse motivo foi cancelado automaticamente pelo sistema, de acordo com as configurações atuais.",
            "descricao_servico": "Executar a retirada dos equipamentos instalados no cliente.",
            "descricao_fechamento": "teste",
            "motivo_fechamento": [
                {
                    "id_motivo_fechamento": 27,
                    "descricao": "TESTE MOTIVO"
                }
            ],
            "status": "Finalizado",
            "disponibilidade": "Não Informada",
            "atendimento": {
                "protocolo": "201811011612427",
```

---
## POST — Reagendar
*Ordem de Serviço*

```
POST {{url}}/api/v1/integracao/ordem_servico/reagendar
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**Endpoint (Rota)**

Neste `endpoint`, será possível reagendar a ordem de serviço, obtendo o retorno no formato `JSON` como resposta. Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_ordem_servico | Identificador da ordem de serviço | Sim |
| data_inicio_programado | Data inicial programada para iniciar a execução da ordem de serviço | Sim |
| hora_inicio_programado | Hora inicial programada para iniciar a execução da ordem de serviço | Sim |
| data_termino_programado | Data final programada para finalizar a execução da ordem de serviço | Sim |
| hora_termino_programado | Hora final programada para finalizar a execução da ordem de serviço | Sim |
| id_usuario_antigo | Identificador do usuário (técnico) responsável pela ordem de serviço | Sim, se o id_usuario_novo for especificado |
| id_usuario_novo | Identificador do usuário (técnico) responsável pela ordem de serviço | Sim, se o id_usuario_antigo for especificado |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_ordem_servico | Número Inteiro | Nenhum |
| data_inicio_programado | Timestamp (2020-01-01) | Nenhum |
| hora_inicio_programado | Texto (12:00:00) | Nenhum |
| data_termino_programado | Texto (2020-01-01) | Nenhum |
| hora_termino_programado | Texto (13:00:00) | Nenhum |
| id_usuario_antigo | Número Inteiro | Nenhum |
| id_usuario_novo | Número Inteiro | Nenhum |

**Corpo da requisição (JSON):**

```json
{
  "id_ordem_servico": 1493,
  "data_inicio_programado": "2020-11-23",
  "hora_inicio_programado": "08:00:00",
  "data_termino_programado": "2020-11-23",
  "hora_termino_programado": "09:30:00",
  "id_usuario_antigo": 4,
  "id_usuario_novo": 1
}
```

**Exemplo de resposta — Reagendar**

```json
{
  "status": "success",
  "msg": "Reagendamento salvo com sucesso",
  "ordem_servico": {
    "id_ordem_servico": 1493,
    "numero": "1262",
    "tipo": "INSTALAÇÃO FIBRA - VALORES OBRIGATÓRIOS: R$ 280.00",
    "data_inicio_programado": "2020-11-23 08:00",
    "data_termino_programado": "2020-11-23 09:30",
    "data_inicio_executado": null,
    "data_termino_executado": null,
    "data_cadastro": "2020-11-18 13:35:31",
    "descricao_abertura": "TESTE",
    "descricao_servico": "TESTE",
    "descricao_fechamento": null,
    "status": "Pendente",
    "tecnicos": [
      {
        "id": 1,
        "name": "Master",
        "pivot": {
          "id_ordem_servico": 1493,
          "id_usuario": 1
        }
      }
    ],
    "disponibilidade": "Manhã, Tarde",
    "cliente": "(1395) GUILHERME COUTO",
    "servico": "(1) PLANO 5 MBPS RAP10 E FIXO EM DOBRO",
    "endereco_instalacao": "PRAÇA GETÚLIO VARGAS, 77, SALA 411(SHOPPING WORK) - CENTRO, SANTO ANTÔNIO DO MONTE/MG | CEP: 35560-000"
  }
}
```

---
## POST — Fechar
*Ordem de Serviço*

```
POST {{url}}/api/v1/integracao/ordem_servico/fechar
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**Endpoint (Rota)**

Neste `endpoint`, será possível fechar a ordem de serviço, obtendo o retorno no formato `JSON` como resposta. Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_ordem_servico | Identificador da ordem de serviço | Sim |
| gera_custo | Informa se o fechamento da O.S irá gerar cobrança | Sim |
| data_inicio_executado | Data inicial de execução da O.S | Sim |
| hora_inicio_executado | Hora inicial de execução da O.S | Sim |
| data_termino_executado | Data final de execução da O.S | Sim |
| hora_termino_executado | Hora final de execução da O.S | Sim |
| status_fechamento | Status de fechamento da O.S | Sim |
| descricao_fechamento | Descrição do fechamento da O.S | Sim |
| motivo_fechamento | Motivo de fechamento da O.S | Sim |
| tecnicos | Técnicos responsáveis pela O.S | Nāo |
| tipo_faturamento | Tipo de faturamento (em caso de gerar custo) | Não |
| forma_pagamento | Forma de pagamento da cobrança | Não |
| caixa_financeiro | Caixa Financeiro (em caso de gerar custo) | Não |
| servicos_cobrados | Serviços cobrados (em caso de gerar custo) | Não |
| data_vencimento | Data de vencimento da cobrança (Utilizado quando o 'tipo_faturamento' for 'gerar_boleto') | Não |
| numero_total_parcelas | Quantidade de parcelas (Utilizado quando for gerar cobrança e a 'forma_pagamento' for 'parcelado') | Não |
| movimento_produto_utilizado (disponível na versão 1.112) | Detalha a movimentação feita no fechamento da O.S | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_ordem_servico | Número Inteiro | Nenhum |
| gera_custo | Boolean | Nenhum |
| data_inicio_executado | Timestamp (2020-01-01) | Nenhum |
| hora_inicio_executado | Texto (12:00:00) | Nenhum |
| data_termino_executado | Timestamp (2020-01-01) | Nenhum |
| hora_termino_executado | Texto (12:00:00) | Nenhum |
| status_fechamento | concluido,sem_conclusao | Nenhum |
| descricao_fechamento | Texto | Nenhum |
| motivo_fechamento | Objeto contendo: id_motivo_fechamento | Nenhum |
| tecnicos | Array de objetos contendo: id | Nenhum |
| tipo_faturamento | receber,gerar_boleto,proxima_fatura | Nenhum |
| forma_pagamento | a_vista,parcelado | Nenhum |
| caixa_financeiro | Objeto contendo: id_caixa_financeiro | Nenhum |
| servicos_cobrados | Array de objetos contendo: id_servico_cobrado, quantidade | Nenhum |
| data_vencimento | Timestamp (2020-01-01) | Nenhum |
| numero_total_parcelas | Númerico (Minímo 2) | Nenhum |
| movimento_produto_utilizado | Boolean | Nenhum |

Abaixo estão detalhados os atributos podem/devem ser utilizados na **movimentação do fechamento da O.S**:

| Atributo (Movimentação - Fechamento da O.S) | **Descrição** | **Valor Default** |
| --- | --- | --- |
| movimento_produto_utilizado.produto.\* | id_produto,  <br>quantidade,  <br>patrimonios.\*.id_produto_item | Nenhum |
| movimento_produto_utilizado.id_local_estoque | Número Inteiro | Nenhum |
| movimento_produto_utilizado.id_tipo_movimento_estoque | Número Inteiro | Nenhum |

**Corpo da requisição (JSON):**

```json
{
  "id_ordem_servico": 10000,
  "gera_custo": true,
  "data_inicio_executado": "2024-04-04",
  "hora_inicio_executado": "11:30:00",
  "data_termino_executado": "2024-04-04",
  "hora_termino_executado": "11:35:00",
  "status_fechamento": "concluido",
  "descricao_fechamento": "Teste via API",
  "motivo_fechamento": {
    "id_motivo_fechamento": 1
  },
  "caixa_financeiro": {
    "id_caixa_financeiro": 139
  },
  "servicos_cobrados": [
    {
      "id_servico_cobrado": 1,
      "quantidade": 1
    },
    {
      "id_servico_cobrado": 2,
      "quantidade": 2
    }
  ],
  "tecnicos": [
    {
      "id": 1
    }
  ],
  "data_vencimento": "2024-04-15",
  "numero_total_parcelas": 2
}
```

**Exemplo de resposta — Fechar**

```json
{
  "status": "success",
  "msg": "Ordem de Serviço número 10000 finalizada com sucesso"
}
```
**Exemplo de resposta — Fechar O.S com Movimentação**

```json
{
  "status": "success",
  "msg": "Ordem de Serviço número 10000 finalizada com sucesso"
}
```

---
## POST — Remover Agendamento
*Ordem de Serviço*

```
POST {{url}}/api/v1/integracao/ordem_servico/remove_agendamento
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**Endpoint (Rota)**

Neste `endpoint`, será possível remover o agendamento da ordem de serviço, obtendo o retorno no formato `JSON` como resposta. Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_ordem_servico | Identificador da ordem de serviço | Sim |
| id_motivo_remocao_agendamento | Identificador do motivo de remoção de agendamento | Sim |
| observacao | Textual (Mínimo de 10 caracteres) | Sim |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_ordem_servico | Número Inteiro | Nenhum |
| id_motivo_remocao_agendamento | Número Inteiro | Nenhum |
| observacao | Texto | Nenhum |

**Corpo da requisição (JSON):**

```json
{
  "id_ordem_servico": 1493,
  "id_motivo_remocao_agendamento": 8,
  "observacao": "Cliente pediu para ir no dia seguinte."
}
```

**Exemplo de resposta — Remover Agendamento**

```json
{
  "status": "success",
  "msg": "Remoção do agendamento feito com sucesso",
  "ordem_servico": {
    "id_ordem_servico": 1493,
    "numero": "1262",
    "tipo": "INSTALAÇÃO FIBRA - VALORES OBRIGATÓRIOS: R$ 280.00",
    "data_inicio_programado": "2020-11-23 08:00:00",
    "data_termino_programado": "2020-11-23 09:30:00",
    "data_inicio_executado": null,
    "data_termino_executado": null,
    "data_cadastro": "2020-11-18 13:35:31",
    "descricao_abertura": "TESTE",
    "descricao_servico": "TESTE",
    "descricao_fechamento": null,
    "status": "Aguardando Agendamento",
    "tecnicos": [
      {
        "id": 1,
        "name": "Master",
        "pivot": {
          "id_ordem_servico": 1493,
          "id_usuario": 1
        }
      }
    ],
    "disponibilidade": "Manhã, Tarde",
    "cliente": "(1395) GUILHERME COUTO",
    "servico": "(1) PLANO 5 MBPS RAP10 E FIXO EM DOBRO",
    "endereco_instalacao": "PRAÇA GETÚLIO VARGAS, 77, SALA 411(SHOPPING WORK) - CENTRO, SANTO ANTÔNIO DO MONTE/MG | CEP: 35560-000"
  }
}
```

---
## POST — Adicionar Mensagem
*Ordem de Serviço*

```
POST {{url}}/api/v1/integracao/ordem_servico/adicionar_mensagem/:id_ordem_servico
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse endpoint será possível adicionar mensagem para as ordens de serviços abertos dos clientes e obter o retorno no formato JSON como resposta. Lembre de enviar o ID da Ordem de Serviço como um parâmetro na URL, conforme o exemplo acima. Os seguintes parâmetros podem/devem estar presentes no corpo do requisição:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| mensagem | Mensagem que será adicionada | Sim |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| mensagem | Texto | Nenhum |

**Corpo da requisição (JSON):**

```json
{
  "mensagem": "TESTE ADICIONAR API MENSAGEM2"
}
```

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Mensagem Adicionada com sucesso",
  "ordem_servico_mensagem": {
    "id_ordem_servico": 5061,
    "id_usuario": 1045,
    "mensagem": "TESTE ADICIONAR MENSAGEM O.S PELA API",
    "data_cadastro": {
      "date": "2024-04-23 15:36:58.955879",
      "timezone_type": 3,
      "timezone": "America/Recife"
    },
    "ip_cadastro": "192.168.65.1",
    "id_ordem_servico_mensagem": 297,
    "data_cadastro_br": "23/04/2024 15:36"
  }
}
```

---
## POST — Adicionar Anexos (Disponível na versão 1.112)
*Ordem de Serviço*

```
POST {{url}}/api/v1/integracao/ordem_servico/adicionar_anexo/:id_ordem_servico
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse endpoint será possível adicionar anexos para as ordens de serviços dos clientes e obter o retorno no formato JSON como resposta. Lembre de enviar o ID da Ordem de Serviço como um parâmetro na URL, conforme o exemplo acima. Os seguintes parâmetros podem/devem estar presentes no corpo do requisição:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| files | Arquivo que será adicionado | Sim |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| files | file | Nenhum |

**Corpo da requisição (form-data):**

| Campo | Tipo | Exemplo/Descrição |
| --- | --- | --- |
| `files[0]` | file |  |
| `files[1]` | file |  |

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Anexo Adicionado com sucesso",
  "numero_ordem_servico": "00132508"
}
```

---
## POST — Abrir Ordem de Serviço
*Ordem de Serviço*

```
POST {{url}}/api/v1/integracao/ordem_servico/abrir_os
```

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `id_atendimento` | `16069` |

**Descrição:**

No método POST, será possível adicionar uma Ordem de Serviço a partir de um Atendimento em que o Tipo de Atendimento permita abrir uma O.S. O retorno será em formato JSON e os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_atendimento | Define o Identificador do Atendimento que servirá como ponto de partida para abrir a O.S | Sim |
| id_agenda_ordem_servico | Define o identificador da Agenda da O.S | Não |
| id_tipo_ordem_servico | Define o Tipo da Ordem de Serviço | Não |
| data_inicio_programado | Define a data de início programada para a O.S | Não |
| data_termino_programado | Define a data termino programada para a O.S | Não |
| hora_inicio_programado | Define o horário de início programado | Não |
| hora_termino_programado | Define o horário termino programado | Não |
| status | Define o status da O.S | Não |
| prioridade | Define a prioridade da O.S | Não |
| descricao_servico | Define a descrição do Serviço | Não |
| tecnicos | Define os técnicos da O.S | Não |
| disponibilidade | Define a disponibilidade da O.S | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_atendimento | Número Inteiro | Nenhum |
| id_agenda_ordem_servico | Número Inteiro | Nenhum |
| id_tipo_ordem_servico | Número Inteiro | ABERTURA VIA API |
| data_inicio_programado | Formato date (2024-04-01) | Nenhum |
| data_termino_programado | Formato date (2024-04-01) | Nenhum |
| hora_inicio_programado | Formato de horário (H:i:s) | Nenhum |
| hora_termino_programado | Formato de horário (H:i:s) | Nenhum |
| status | Texto (string) | aguardando_agendameto |
| prioridade | Texto (string) | normal |
| descricao_servico | Texto (string) | O.S aberta via API. |
| tecnicos | Um array que vai conter os ids dos tecnios da O.S:  <br>`"tecnicos": {   "0": {"id": 5249},   "1": {"id": 7600}   }` | SAC (Atendimento) |
| disponibilidade | Um array que vai conter os prefixos dos periodos do dia da disponibilidades da O.S:  <br>`"disponibilidade": {   "0": "manha",   "1": "tarde"   }` | manha e tarde |

**Observação: Se o parâmetro id_tipo_ordem_servico não for enviado, a O.S será aberta com o tipo padrão ATENDIMENTO VIA API assim como se não for adicionado nenhum técnico, o técnico definido será** SAC (Atendimento)**. Além deles, as datas inicio e termino terão o dia de hoje como padrão e o horário de início e termino terão 1 hora a mais do horário de abertura da O.S e 1 hora de duração, o status virá como aguardando_agendamento e a disponibilidade deve ser preenchida em um array com o parâmetro de cada disponibilidade, se não for preenchida, ela virá como manhã e tarde definidas.**

**Corpo da requisição (JSON):**

```json

```

**Exemplo de resposta — Abrir Ordem de Serviço a partir de um Atendimento**

```json
"status": "success",
    "msg": "Ordem de Serviço adicionada com sucesso",
    "ordem_servico": {
        "id_ordem_servico": 5341,
        "id_atendimento": 15679,
        "tipo_ordem_servico": "ATIVAÇÃO TESTE DEV",
        "numero_ordem_servico": 3940,
        "descricao_abertura": "TESTE - O.S Aberta via API",
        "status": "aguardando_agendamento",
        "data_cadastro": "2024-05-15 15:40:51",
        "data_inicio_programado": "2024-05-17 17:00:00",
        "data_termino_programado": "2024-05-17 18:00:00",
        "cliente_servico": {
            "display": "(40) 5MB-WIRELESS",
            "id_cliente_servico": 19093,
            "cliente": "(2030) JOSNEY"
        }
    }
```

---