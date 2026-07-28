# Atendimento

**Necessário**

Para realizar as requisições nos dados de atendimento, será necessário que você já possua o `access_token`, adquirido através dos `endpoints` de `(oAuth)`.

## Avaliação (Disponível na versão 1.117)

**Necessário**

Para realizar as requisições nos dados de atendimento, será necessário que você já possua o `access_token`, adquirido através dos `endpoints` de `(oAuth)`.

### GET — Consultar Avaliação
*Atendimento / Avaliação (Disponível na versão 1.117)*

```
GET {{url}}/api/v1/integracao/atendimento/id_atendimento/avaliacao/consultar_avaliacao
```

**Descrição:**

Através desse `endpoint` será possível consultar a avaliação do atendimento.

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Dados consultados com sucesso",
  "atendimento": {
    "id_atendimento": 11111,
    "protocolo": "20251204162655314152"
  },
  "avaliacao": {
    "avaliacoes": [
      {
        "id_avaliacao": 1,
        "questao": "Qual a nota pelos serviços prestados pela dev_hubsoft ?",
        "avaliacao": "6",
        "tipo_avaliacao": "empresa",
        "data_cadastro": "12/12/2025 15:55"
      },
      {
        "id_avaliacao": 2,
        "questao": "Avalie o atendimento feito pelo(a) atendente Suporte Hubsoft, há 1 semana.",
        "avaliacao": "7",
        "tipo_avaliacao": "usuario_abertura",
        "data_cadastro": "12/12/2025 15:55",
        "usuarios": [
          {
            "id": 8585,
            "nome": "Suporte Hubsoft",
            "email": "suporte@hubsoft.com.br"
          }
        ]
      }
    ],
    "media": "6.5",
    "comentario": null
  }
}
```

---
### GET — Gerar Questões Avaliação
*Atendimento / Avaliação (Disponível na versão 1.117)*

```
GET {{url}}/api/v1/integracao/atendimento/id_atendimento/avaliacao/gerar_questoes_avaliacao
```

**Descrição:**

Através desse `endpoint` será possível consultar as questões que serão respondidas na avaliação do atendimento.

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Dados consultados com sucesso",
  "atendimento": {
    "id_atendimento": 11111,
    "protocolo": "20250521152026985697"
  },
  "questoes": [
    {
      "id_avaliacao": 1,
      "questao": "Qual a nota pelos serviços prestados pela HUBSOFT ?",
      "tipo_avaliacao": "empresa"
    },
    {
      "id_avaliacao": 2,
      "questao": "Avalie o atendimento feito pelo(a) atendente Hubsoft, há 6 meses.",
      "usuarios": [
        {
          "id": 1,
          "nome": "Hubsoft",
          "email": "hubsoft@hubsoft.com.br"
        }
      ],
      "tipo_avaliacao": "usuario_abertura"
    }
  ]
}
```

---
### POST — Avaliar
*Atendimento / Avaliação (Disponível na versão 1.117)*

```
POST {{url}}/api/v1/integracao/atendimento/id_atendimento/avaliacao/avaliar
```

**Descrição:**

No método `POST`, será possível realizar a avaliação do atendimento fechado do cliente e obter o retorno no formato `JSON` como resposta.

Os seguintes parâmetros podem/devem ser utilizados:

| **Atributo** | **Descrição** | **Obrigatório** |
| --- | --- | --- |
| id_avaliacao | Identificador da avaliação | Sim |
| avaliacao | Nota da avaliação | Sim |
| comentario | Comentário que será adicionado na avaliação | Não |

Os atributos podem conter os seguintes valores:

| **Atributo** | **Descrição** | **Obrigatório** |
| --- | --- | --- |
| id_avaliacao | Número Inteiro | Sim |
| avaliacao | Número Inteiro | Sim |
| comentario | Campo Livre (Qualquer valor é aceito) | Não |

**Corpo da requisição (JSON):**

```json
{
  "questoes": [
    {
      "id_avaliacao": 1,
      "avaliacao": 6
    },
    {
      "id_avaliacao": 2,
      "avaliacao": 7
    }
  ],
  "comentario": "avaliacao feita"
}
```

**Exemplo de resposta — Avaliar**

```json
{
  "status": "success",
  "msg": "Obrigado por avaliar o atendimento!",
  "atendimento": {
    "id_atendimento": 11111,
    "protocolo": "20250521152026985697"
  },
  "avaliacao": {
    "avaliacoes": [
      {
        "questao": "Qual a nota pelos serviços prestados pela HUBSOFT?",
        "avaliacao": "6",
        "tipo_avaliacao": "empresa"
      },
      {
        "questao": "Avalie o atendimento feito pelo(a) atendente Hubsoft, há 6 meses.",
        "avaliacao": "7",
        "tipo_avaliacao": "usuario_abertura"
      }
    ],
    "media": 6.5,
    "comentario": "avaliacao feita"
  }
}
```

---
## GET — Consulta
*Atendimento*

```
GET {{url}}/api/v1/integracao/atendimento/paginado/:quantidade
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `pagina` | `1` |
| `data_inicio` | `2022-08-01` |
| `data_fim` | `2022-08-31` |

**Descrição:**

**GET**

No método`GET`, irá consultar os dados dos atendimentos e retornar um `JSON` como resposta. Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| data_inicio | Data de Cadastro Inicial | Sim |
| data_fim | Data de Cadastro Final | Sim |
| tipo_data | Tipo de Data a ser consultado | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| data_inicio | Valor no formato DateTime (YYYY-MM-DD) | Nenhum |
| data_fim | Valor no formato DateTime (YYYY-MM-DD) Obs: Maior ou igual data_inicio | Nenhum |
| tipo_data | data_cadastro, data_fechamento | data_cadastro |

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "atendimentos": {
        "current_page": 8,
        "data": [
            {
                "id_atendimento": 4413,
                "id_atendimento_status": 22,
                "id_tipo_atendimento": 162,
                "id_cliente_servico": 17558,
                "id_usuario_responsavel": null,
                "id_usuario_abertura": 5228,
                "protocolo": "20220804154332049991",
                "data_cadastro": "2022-08-04 15:45:57",
                "data_fechamento": null,
                "rascunho": false,
                "status_fechamento": null,
                "descricao_fechamento": null,
                "id_motivo_fechamento_atendimento": null,
                "deleted_at": null,
                "avaliacao": null,
                "comentario_avaliacao": null,
                "ordem_servico_count": 1,
                "anexos_count": 0,
                "ingressado": false,
                "data_cadastro_br": "04/08/2022 15:45",
                "data_cadastro_timestamp": 1659638757000,
                "data_fechamento_br": null,
                "data_fechamento_timestamp": null,
                "minutos_em_aberto": 30126,
                "tempo_restante": "-501h 6min",
                "percentual_tempo_restante": 0,
                "percentual_color_class": "white-fg md-red-bg",
                "status": {
                    "id_atendimento_status": 22,
                    "prefixo
```

---
## GET — Todos
*Atendimento*

```
GET {{url}}/api/v1/integracao/atendimento/todos
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `pagina` | `0` |
| `itens_por_pagina` | `0` |
| `data_inicio` | `` |
| `data_fim` | `` |
| `relacoes` | `` |

**Descrição:**

No método `GET`, irá consultar os dados dos atendimentos e retornar um `JSON` como resposta. O resultado é retornado de forma paginada, portanto é importante fazer um loop de consultas em sua aplicação, caso queria percorrer os dados em sua totalidade.

Os seguintes parâmetros podem/devem ser utilizados:

| **Atributo** | **Descrição** | **Obrigatório** |
| --- | --- | --- |
| pagina | Número da Página da Consulta | **Sim** |
| itens_por_pagina | Quantidade de Registro por Página da consulta | **Sim** |
| data_inicio | Data de Cadastro Inicial | Sim |
| data_fim | Data de Cadastro Final | Sim |
| tipo_atendimento | Tipo de Atendimento | Não |
| status_atendimento | Status do Atendimento | Não |
| id_servico | ID dos Serviços | Não |
| relacoes | Carrega apenas os relacionamentos especificados | Não |
| tipo_data | Tipo de Data para consultar atendimento | Não |

Os atributos podem conter os seguintes valores:

| **Atributo** | **Descrição** | **Valor Default** |
| --- | --- | --- |
| pagina | Valor númerico. A primeira página será 0 | Nenhum |
| itens_por_pagina | Valor númerico. Mínimo: 1, Máximo: 500 | Nenhum |
| data_inicio | Valor no formato DateTime (YYYY-MM-DD) | Nenhum |
| data_fim | Valor no formato DateTime (YYYY-MM-DD) Obs: Maior ou igual data_inicio | Nenhum |
| tipo_atendimento | Valor no formato string. IDs do Tipo de Atendimento que deseja buscar (Nota 1) | Nenhum |
| status_atendimento | Valor no formato string. IDs do Status Atendimento que deseja buscar (Nota 1) | Nenhum |
| id_servico | Valor em formato numeric dos ID's dos Serviços que deseja buscar | Nenhum |
| relacoes | cliente_servico,usuarios_responsaveis,atendimento_mensagem, checklists | Nenhum |
| tipo_data | data_cadastro, data_fechamneto | data_cadastro |

**IMPORTANTE:** Lembre-se que essa é uma requisição que poderá retornar um volume muito grande de dados, portanto, utilize as relações com cautela, pois quanto mais relações forem utilizados, maior poderá ser o tempo de resposta da API.

**Nota 1:** Os campos `tipo_atendimento` e `status_atendimento,` podem receber múltiplos valores separados por vírgulas. Por exemplo, para filtrar por múltiplos tipo_atendimento, você pode fornecer uma string como `132, 28`.

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "paginacao": {
        "primeira_pagina": 0,
        "ultima_pagina": 38,
        "pagina_atual": 0,
        "total_registros": 39
    },
    "atendimentos": [
        {
            "id_atendimento": 5448,
            "id_atendimento_status": 23,
            "id_tipo_atendimento": 125,
            "id_cliente_servico": 17812,
            "id_usuario_responsavel": null,
            "id_usuario_abertura": 4903,
            "protocolo": "20221229180833379797",
            "data_cadastro": "2022-12-29 18:08:33",
            "data_fechamento": null,
            "rascunho": false,
            "status_fechamento": null,
            "descricao_fechamento": null,
            "id_motivo_fechamento_atendimento": null,
            "deleted_at": null,
            "avaliacao": null,
            "comentario_avaliacao": null,
            "ordem_servico_count": 0,
            "ordem_servico_fechada": 0,
            "ordem_servico_aberta": 0,
            "ingressado": false,
            "data_cadastro_br": "29/12/2022 18:08",
            "data_cadastro_timestamp": 1672348113000,
            "data_fechamento_br": null,
            "data_fechamento_timestamp": null,
            "minutos_em_aberto": 61486,
            "tempo_restante": "-1023h 46min",
            "percentual_tempo_restante": 0,
            "percentual_color_class": "white-fg md-red-bg",
            "status": {
                "id_atendimento_status": 23,
```

---
## POST — Adicionar
*Atendimento*

```
POST {{url}}/api/v1/integracao/atendimento
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

No método `POST`, será possível adicionar os atendimentos em aberto/fechados dos clientes e obter o retorno no formato `JSON` como resposta. Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_cliente_servico | Identificador do serviço do cliente | Sim |
| id_tipo_atendimento | Identificador do tipo de atendimento | Não |
| id_atendimento_status | Identificar do Status do Atendimento | Não |
| id_usuario_responsavel | Identificador do Usuário Responsável | Não |
| descricao | Descrição detalhada do atendimento | Sim |
| nome | Nome do solicitante | Sim |
| telefone | Telefone do solicitante | Sim |
| email | Email do solicitante | Não |
| id_origem_contato | Identificar a Origem do Contato | Não |
| id_disponibilidade | Identificador da Disponibilidade do Atendimento | Não |
| abrir_os | Indica se deve abrir Ordem de Serviço ou não | Não |
| parametros | Parâmetros Dinâmicos. Array de dados. | Não |
| parametros_ordem_servico | Parâmetros Dinâmicos. Array de dados da O.S. | Não |
| parametros_fechamento | Parâmetros Dinâmicos. Array de dados de fechamento do Atendimento. | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_cliente_servico | Número Inteiro | Nenhum |
| id_tipo_atendimento | Número Inteiro | Nenhum |
| id_atendimento_status | Número Inteiro | Nenhum |
| id_usuario_responsavel | Número Inteiro | Nenhum |
| descricao | Campo Livre (Qualquer valor é aceito) | Nenhum |
| nome | Campo Livre (Qualquer valor é aceito) | Nenhum |
| telefone | Telefone no formato (DDNNNNNNNNN). | Nenhum |
| email | Caso enviado deve ser no formato e-mail (EX: [user@dominio.com](https://mailto:user@dominio.com)) | Nenhum |
| id_origem_contato | Número inteiro | Nenhum |
| id_disponibilidade | Valor no formato string |  |
| abrir_os | Caso enviado, deve conter um valor boolean (true | false |
| parametros | Nos parâmetros dinâmicos podem ser enviados qualquer informação. | \[\] |
| parametros_ordem_servico | Nos parâmetros dinâmicos podem ser enviados as seguintes informações (id_tipo_ordem_servico, status e ids_tecnicos, id_disponibilidade) | \[\] |
| parametros_fechamento | Nos parâmetros dinâmicos podem ser enviados as seguintes informações (id_motivo_fechamento_atendimento, descricao_fechamento, status_fechamento) | \[\] |

**Observação: Se o parâmetro id_tipo_atendimento não for enviado, o atendimento será aberto com o tipo padrão SAC.**

**Observação 2: Se o parâmetro id_atendimento_status não for enviado, caso utilizar o abrir_os, será aberto com o status pendente, senão com o status padrão, que seria aguardando_analise. Para coletar o id_atendimento_status, utilize a rota GET configuracao/status_atendimento**

**Observação 3: Veja que na abertura do atendimento existe a possibilidade de enviar parâmetros dinâmicos. Esses parâmetros todos serão armazendos juntamente com o atendimento . Por exemplo se a sua plataforma for um sistema Omnichannel (PBX, WhatsApp, Messenger, etc), você pode armazar o ID da Conversa/Chamada, Data de Início, Data de Término, Atendimento, etc. Quanto mais informações você envia para o HubSoft, mais completo ficará a visualização do atendimento.**

**Observação 4: Se o parâmetro id_tipo_ordem_servico não for enviado, a ordem de serviço será aberto com o tipo padrão ABERTURA VIA API.**

**Observação 5: Se o parâmetro status não for enviado, a ordem de serviço será aberto com o status padrão Aguardando Agendamento.**

**Observação 6: Se o parâmetro ids_tecnicos não for enviado, a ordem de serviço será aberto com o técnico padrão SAC (Atendimento).**

**Observação 7: Caso deseje passar mais de uma disponibilidade no campo id_disponibilidade, basta separar os ids por vigula, exemplo 1,2. Para coletar os ids de disponibilidade, basta usar o endpoint GET** /api/v1/integracao/configuracao/disponibilidade

**Observação 8: Caso deseje passar mais de um usuario responsavel no campo id_usuario_responsavel, basta separar os ids por vigula, exemplo 1,2**

**Observação 9: Caso os parâmetros id_motivo_fechamento_atendimento e descricao_fechamento não forem enviados, o atendimento será finalizado com os seguintes dados:****Motivo de Fechamento: Fechado Automático Atendimento // Descrição de Fechamento: Atendimento finalizado via API.**

**Corpo da requisição (JSON):**

```json

```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Atendimento aberto com sucesso. Anote o protocolo: 201811161058216. Foi aberto também uma ordem de serviço e encaminhada ao sertor responsável",
    "atendimento": {
        "id_atendimento": 300,
        "protocolo": "201811161058216",
        "descricao_abertura": "Estou sem acesso a internet desde segunda-feira. | ATENDIMENTO ABERTO VIA API",
        "descricao_fechamento": null,
        "tipo_atendimento": "SAC",
        "usuario_abertura": "IP Telecom",
        "usuario_responsavel": "IP Telecom",
        "usuario_fechamento": null,
        "data_cadastro": "16/11/2018",
        "data_fechamento": null,
        "setor_responsavel": null,
        "status_fechamento": null,
        "motivo_fechamento": null,
        "status": "Aguardando Análise",
        "cliente": {
            "codigo_cliente": 1204,
            "nome_razaosocial": "BIANCA COUTO",
            "cpf_cnpj": "86214941081"
        },
        "ordens_servico": [
            {
                "id_ordem_servico": 340,
                "numero_ordem_servico": "320",
                "data_cadastro": "16/11/2018 10:58:21",
                "tipo": "ABERTURA VIA API",
                "data_inicio_programado": "16/11/2018 11:58:21",
                "data_termino_programado": "16/11/2018 12:58:21",
                "data_inicio_executado": null,
                "data_termino_executado": null,
                "descricao_abertura": "Estou sem acesso a internet desde segunda-feira. |
```
**Exemplo de resposta — Sucesso - Abertura com Finalização do Atendimento** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Atendimento aberto com sucesso. Anote o protocolo: 20250128085356853228.",
    "atendimento": {
        "id_atendimento": 29424,
        "rascunho": null,
        "protocolo": "2025012808535643228",
        "descricao_abertura": "Abertura de atendimento de teste | ATENDIMENTO ABERTO VIA API",
        "descricao_fechamento": "Atendimento finalizado pela API",
        "tipo_atendimento": "SAC",
        "usuario_abertura": "Iasmin",
        "usuario_responsavel": "Joaquim",
        "usuario_fechamento": "Iasmin",
        "data_cadastro": "28/01/2025",
        "data_fechamento": "28/01/2025",
        "setor_responsavel": null,
        "status_fechamento": "concluido",
        "motivo_fechamento": "Resolvido Nível 01",
        "status": "Resolvido",
        "atendimento_mensagem": [],
        "disponibilidade_atendimento": [],
        "cliente": {
            "codigo_cliente": 4112,
            "nome_razaosocial": "TESTE DE PROSPECTO - HUBSOFT",
            "cpf_cnpj": "00000000000"
        },
        "servico": {
            "id_cliente_servico": 11000,
            "numero_plano": 0,
            "nome": "200GB-VARIAVEL",
            "valor": 165,
            "status": "Suspenso Parcialmente",
            "status_prefixo": "suspenso_parcialmente",
            "id_motivo_cancelamento": null,
            "motivo_cancelamento": null,
            "motivo_cancelamento_prefixo": null,
            "anotacoes": null
        },
        "ordens_servico
```

---
## PUT — Editar
*Atendimento*

```
PUT {{url}}/api/v1/integracao/atendimento/:id_atendimento
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse endpoint será possível editar e fechar os atendimentos em abertos dos clientes e obter o retorno no formato JSON como resposta. Lembre de enviar o ID do atendimento como um parâmetro na URL, conforme o exemplo acima. Os seguintes parâmetros podem/devem estar presentes no corpo do requisição:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| descricao | Descrição de abertura do atendimento (Opcional) | Não |
| fechar_atendimento | Indica se deve ser fechado os atendimento e suas ordens de serviço | Sim |
| parametros_fechamento | Parâmetros Dinâmicos. Array de dados de fechamento do Atendimento. | Não |
| parametros | Objeto JSON que poderá conter qualquer informação da integração | Não |
| id_atendimento_status | o novo status de atendimento para ser atualizado. | Não |
| id_tipo_atendimento | o novo tipo de atendimento para ser atualizado. | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| descricao | Texto | Nenhum |
| fechar_atendimento | Boolean ( Verdadeiro ou Falso ) | false |
| parametros_fechamento | Nos parâmetros dinâmicos podem ser enviados as seguintes informações (id_motivo_fechamento_atendimento, descricao_fechamento, status_fechamento) | \[\] |
| parametros | Array Associativo, JSON | Nenhum |
| id_atendimento_status | id_atendimento_status (Nota 1) | Nenhum |
| id_tipo_atendimento | id_tipo_atendimento (Nota 2) | Nenhum |

**Nota 1:** _Não é possível alterar o status e fechar ao mesmo tempo._ Caso deseje somente alterar o status, passe o _fechar_atendimento_ como _false_. E para finalizar o atendimento não é necessário incluir o parametro _id_atendimento_status_.

**Nota 2:** _Não é possível alterar o tipo de atendimento e fechar ao mesmo tempo._ Caso deseje somente alterar o tipo_atendimento, passe o _fechar_atendimento_ como _false_. E para finalizar o atendimento não é necessário incluir o parametro id_tipo_atendimento.

**Corpo da requisição (JSON):**

```json
{
  "parametros": {
    "url_ligacao": "https://www.meusite.com.br/ligacao/3",
    "software": "PBX ABCDE",
    "outro_parametro": 123456
  },
  "parametros_fechamento": {
    "id_motivo_fechamento_atendimento": 108,
    "descricao_fechamento": "Finalizado",
    "status_fechamento": "concluido"
  },
  "fechar_atendimento": true
}
```

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Atendimento atualizado com sucesso",
    "atendimento": {
        "id_atendimento": 1114,
        "protocolo": "202003051452007",
        "id_cliente_servico": 13677,
        "id_tipo_atendimento": 44,
        "id_usuario_abertura": 56,
        "id_usuario_fechamento": 1,
        "descricao_abertura": "INSTALAÇÃO NOVA",
        "descricao_fechamento": "Fechamento automático.",
        "data_cadastro": "2020-03-05 14:52:00",
        "data_fechamento": "2020-03-11 09:56:10",
        "ip_cadastro": null,
        "id_usuario_responsavel": 22,
        "id_setor_responsavel": null,
        "destino": "usuario",
        "status_fechamento": "concluido",
        "id_motivo_fechamento_atendimento": 5,
        "id_atendimento_status": 24,
        "resultado_diagnostico": null,
        "nome_contato": "TESTE APRESENT",
        "telefone_contato": "3734151100",
        "email_contato": null,
        "rascunho": false,
        "deleted_at": null,
        "id_origem_contato": null,
        "avaliacao": null,
        "comentario_avaliacao": null,
        "push_notification_enviado": false,
        "data_cadastro_br": "05/03/2020 14:52",
        "data_cadastro_timestamp": 1583430720000,
        "data_fechamento_br": "11/03/2020 09:56",
        "data_fechamento_timestamp": 1583931370000,
        "minutos_em_aberto": 8344,
        "tempo_restante": "-138h 4min",
        "percentual_tempo_restante": 0,
        "percentual_color_class": "white-fg md-red-bg"
```

---
## POST — Adicionar Mensagem
*Atendimento*

```
POST {{url}}/api/v1/integracao/atendimento/adicionar_mensagem/:id_atendimento
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse endpoint será possível adicionar mensagem para atendimentos abertos dos clientes e obter o retorno no formato JSON como resposta. Lembre de enviar o ID do atendimento como um parâmetro na URL, conforme o exemplo acima. Os seguintes parâmetros podem/devem estar presentes no corpo do requisição:

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
    "atendimento_mensagem": {
        "id_atendimento": 391,
        "id_usuario": 1045,
        "mensagem": "TESTE ADICIONAR API MENSAGEM2",
        "data_cadastro": {
            "date": "2024-04-23 15:34:10.511128",
            "timezone_type": 3,
            "timezone": "America/Recife"
        },
        "ip_cadastro": "192.168.65.1",
        "ativo": true,
        "id_atendimento_mensagem": 613,
        "data_cadastro_br": "23/04/2024 15:34",
        "data_cadastro_timestamp": 1713897250000,
        "atendimento": {
            "id_atendimento": 391,
            "protocolo": "201902261631245",
            "id_cliente_servico": 15536,
            "id_tipo_atendimento": 33,
            "id_usuario_abertura": 56,
            "id_usuario_fechamento": null,
            "descricao_abertura": "FASFDAS",
            "descricao_fechamento": null,
            "data_cadastro": "2019-02-26 16:31:24",
            "data_fechamento": null,
            "ip_cadastro": "100.64.8.21",
            "id_usuario_responsavel": 122,
            "id_setor_responsavel": null,
            "destino": "usuario",
            "status_fechamento": null,
            "id_motivo_fechamento_atendimento": null,
            "id_atendimento_status": 22,
            "nome_contato": "izabella ribeiro  (Central do Assinante)",
            "telefone_contato": "(37)9995-92109",
            "email_contato": "bebelemg@hotmail.com",
```

---
## POST — Adicionar Anexos
*Atendimento*

```
POST {{url}}/api/v1/integracao/atendimento/adicionar_anexo/:id_atendimento
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse endpoint será possível adicionar anexos para os atendimentos dos clientes e obter o retorno no formato JSON como resposta. Lembre de enviar o ID do Atendimento como um parâmetro na URL, conforme o exemplo acima. Os seguintes parâmetros podem/devem estar presentes no corpo do requisição:

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
  "atendimento": {
    "id_atendimento": 35051,
    "protocolo": "20250813164713274745"
  }
}
```

---