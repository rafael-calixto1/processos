# Tarefas

**Necessário**

Para fazer requisições nas `Tarefas`, é necessário que você já possua o `access_token`, conseguido na etapa `(oAuth)`.

## Ações

Para fazer requisições nos dados das `Ações` da `Tarefas` é necessário que você já possua o `access_token`, conseguido na etapa `(oAuth).`

### PUT — Iniciar Tarefa
*Tarefas / Ações*

```
PUT {{url}}/api/v1/integracao/tarefa/inicia_tarefa/:id_tarefa
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

No método `PUT`, será possível iniciar a tarefa.

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Tarefa foi iniciada com sucesso",
    "tarefa": {
        "id_tarefa": 1455,
        "id_usuario_responsavel": 7834,
        "id_setor_responsavel": 183,
        "id_tarefa_categoria": 47,
        "id_usuario_cadastro": 7599,
        "id_tarefa_grupo": 596,
        "descricao_abertura": "teste api edição tarefa descricao",
        "descricao_conclusao": null,
        "data_cadastro": "2024-11-27 11:52:56",
        "data_limite": "2023-10-06 16:50:41",
        "data_atualizacao": "2024-11-27 11:56:36",
        "data_inicio": "2024-11-27 11:56:36",
        "data_conclusao": null,
        "status": "em_execucao",
        "id_prioridade": 2,
        "deleted_at": null,
        "id_tarefa_recorrente": null,
        "titulo": "teste api editar tarefa",
        "id_tarefa_recorrente_origem": null,
        "prazo_execucao": null,
        "hora": null,
        "minuto": null,
        "data_cadastro_br": "27/11/2024",
        "data_limite_br": "06/10/2023",
        "data_limite_timestamp": "06/10/2023 16:50:41",
        "data_cadastro_timestamp": "27/11/2024 11:52:56",
        "data_atualizacao_br": "27/11/2024 11:56:36",
        "data_inicio_br": "27/11/2024 11:56:36",
        "data_conclusao_br": null,
        "status_display": {
            "descricao": "Em Execução",
            "material_color": {
                "style": {
                    "color": "rgb(255,255,255)",
                    "background-color": "rgb(0,151,167)"
```

---
### PUT — Conclui Tarefa
*Tarefas / Ações*

```
PUT {{url}}/api/v1/integracao/tarefa/conclui_tarefa/:id_tarefa
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

No método `PUT`, será possível concluir a tarefa.

**Corpo da requisição (JSON):**

```json
{
  "descricao_conclusao": "teste api editar tarefa"
}
```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Tarefa foi concluida com sucesso",
    "tarefa": {
        "id_tarefa": 1455,
        "id_usuario_responsavel": 7834,
        "id_setor_responsavel": 183,
        "id_tarefa_categoria": 47,
        "id_usuario_cadastro": 7599,
        "id_tarefa_grupo": 596,
        "descricao_abertura": "teste api edição tarefa descricao",
        "descricao_conclusao": "teste api editar tarefa",
        "data_cadastro": "2024-11-27 11:52:56",
        "data_limite": "2023-10-06 16:50:41",
        "data_atualizacao": "2024-11-27 11:58:53",
        "data_inicio": "2024-11-27 11:57:20",
        "data_conclusao": "2024-11-27 11:58:53",
        "status": "concluido",
        "id_prioridade": 2,
        "deleted_at": null,
        "id_tarefa_recorrente": null,
        "titulo": "teste api editar tarefa",
        "id_tarefa_recorrente_origem": null,
        "prazo_execucao": null,
        "hora": null,
        "minuto": null,
        "data_cadastro_br": "27/11/2024",
        "data_limite_br": "06/10/2023",
        "data_limite_timestamp": "06/10/2023 16:50:41",
        "data_cadastro_timestamp": "27/11/2024 11:52:56",
        "data_atualizacao_br": "27/11/2024 11:58:53",
        "data_inicio_br": "27/11/2024 11:57:20",
        "data_conclusao_br": "27/11/2024 11:58:53",
        "status_display": {
            "descricao": "Concluido",
            "material_color": {
                "style": {
                    "color": "rgb(255,255,255)",
```

---
### PUT — Cancela Tarefa
*Tarefas / Ações*

```
PUT {{url}}/api/v1/integracao/tarefa/cancela_tarefa/:id_tarefa
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

No método `PUT`, será possível cancelar a tarefa.

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Tarefa teve sua execução cancelada com sucesso",
    "tarefa": {
        "id_tarefa": 1455,
        "id_usuario_responsavel": 7834,
        "id_setor_responsavel": 183,
        "id_tarefa_categoria": 47,
        "id_usuario_cadastro": 7599,
        "id_tarefa_grupo": 596,
        "descricao_abertura": "teste api edição tarefa descricao",
        "descricao_conclusao": null,
        "data_cadastro": "2024-11-27 11:52:56",
        "data_limite": "2023-10-06 16:50:41",
        "data_atualizacao": "2024-11-27 11:57:12",
        "data_inicio": null,
        "data_conclusao": null,
        "status": "aguardando",
        "id_prioridade": 2,
        "deleted_at": null,
        "id_tarefa_recorrente": null,
        "titulo": "teste api editar tarefa",
        "id_tarefa_recorrente_origem": null,
        "prazo_execucao": null,
        "hora": null,
        "minuto": null,
        "data_cadastro_br": "27/11/2024",
        "data_limite_br": "06/10/2023",
        "data_limite_timestamp": "06/10/2023 16:50:41",
        "data_cadastro_timestamp": "27/11/2024 11:52:56",
        "data_atualizacao_br": "27/11/2024 11:57:12",
        "data_inicio_br": null,
        "data_conclusao_br": null,
        "status_display": {
            "descricao": "Aguardando Início",
            "material_color": {
                "style": {
                    "color": "rgba(0,0,0,0.87)",
                    "background-color": "rgb(255,183,77)"
                }
```

---
### PUT — Retomar Tarefa
*Tarefas / Ações*

```
PUT {{url}}/api/v1/integracao/tarefa/retomar_tarefa/:id_tarefa
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

No método `PUT`, será possível retomar a tarefa.

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Tarefa foi retomada com sucesso",
    "tarefa": {
        "id_tarefa": 1455,
        "id_usuario_responsavel": 7834,
        "id_setor_responsavel": 183,
        "id_tarefa_categoria": 47,
        "id_usuario_cadastro": 7599,
        "id_tarefa_grupo": 596,
        "descricao_abertura": "teste api edição tarefa descricao",
        "descricao_conclusao": null,
        "data_cadastro": "2024-11-27 11:52:56",
        "data_limite": "2023-10-06 16:50:41",
        "data_atualizacao": "2024-11-27 11:59:36",
        "data_inicio": "2024-11-27 11:57:20",
        "data_conclusao": null,
        "status": "em_execucao",
        "id_prioridade": 2,
        "deleted_at": null,
        "id_tarefa_recorrente": null,
        "titulo": "teste api editar tarefa",
        "id_tarefa_recorrente_origem": null,
        "prazo_execucao": null,
        "hora": null,
        "minuto": null,
        "data_cadastro_br": "27/11/2024",
        "data_limite_br": "06/10/2023",
        "data_limite_timestamp": "06/10/2023 16:50:41",
        "data_cadastro_timestamp": "27/11/2024 11:52:56",
        "data_atualizacao_br": "27/11/2024 11:59:36",
        "data_inicio_br": "27/11/2024 11:57:20",
        "data_conclusao_br": null,
        "status_display": {
            "descricao": "Em Execução",
            "material_color": {
                "style": {
                    "color": "rgb(255,255,255)",
                    "background-color": "rgb(0,151,167)"
```

---
## POST — Adicionar
*Tarefas*

```
POST {{url}}/api/v1/integracao/tarefa
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

No método `POST`, irá adicionar uma nova tarefa e retornar um `JSON` como resposta.

Os seguintes parâmetros podem/devem ser utilizados:

| **Atributo** | **Descrição** | **Obrigatório** |
| --- | --- | --- |
| titulo | Titulo da tarefa que vai ser adicionada | Sim |
| id_prioridade | ID da Prioridade que vai ser vinculada | Sim |
| id_setor_responsavel | ID da Setor que vai ser vinculado | Sim |
| id_tarefa_categoria | ID da Categoria de tarefa que vai ser vinculada | Sim |
| id_usuario_responsavel | ID do Usuario responsavel que vai ser vinculado | Sim |
| data_limite | Data limite para execução | Sim |
| hora_limite | Hora limite para execução | Sim |
| descricao_abertura | Descricao de Abertura da tarefa | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| titulo | Campo Livre (Qualquer valor é aceito) | Nenhum |
| id_prioridade | Número Inteiro | Nenhum |
| id_setor_responsavel | Número Inteiro | Nenhum |
| id_tarefa_categoria | Número Inteiro | Nenhum |
| id_usuario_responsavel | Número Inteiro | Nenhum |
| data_limite | Timestamp (2020-01-01) | Nenhum |
| hora_limite | Texto (12:00:00) | Nenhum |
| descricao_abertura | Campo Livre (Qualquer valor é aceito) | Nenhum |

**Corpo da requisição (JSON):**

```json
{
  "titulo": "teste api abertura tarefa",
  "id_prioridade": 1,
  "id_setor_responsavel": "40",
  "id_tarefa_categoria": "637",
  "id_usuario_responsavel": "7599",
  "data_limite": "24-10-06",
  "hora_limite": "10:54:04",
  "descricao_abertura": "teste api abertura tarefa descricao"
}
```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Tarefa cadastrado com sucesso",
    "tarefa": {
        "id_usuario_responsavel": "7599",
        "id_setor_responsavel": "40",
        "id_tarefa_categoria": "637",
        "id_usuario_cadastro": 7599,
        "id_tarefa_grupo": 596,
        "descricao_abertura": "teste api abertura tarefa descricao",
        "titulo": "teste api abertura tarefa",
        "data_limite": "2024-10-06 10:54:04",
        "status": "aguardando",
        "id_prioridade": 1,
        "id_tarefa_recorrente": null,
        "prazo_execucao": null,
        "hora": null,
        "minuto": null,
        "data_atualizacao": "2024-11-27 11:52:56",
        "data_cadastro": "2024-11-27 11:52:56",
        "id_tarefa": 1455,
        "data_cadastro_br": "27/11/2024",
        "data_cadastro_timestamp": "27/11/2024 11:52:56",
        "data_limite_timestamp": "06/10/2024 10:54:04",
        "data_limite_br": "06/10/2024",
        "hora_limite": "10:54:04",
        "data_atualizacao_br": "27/11/2024 11:52:56",
        "data_inicio_br": null,
        "data_conclusao_br": null,
        "status_display": {
            "descricao": "Aguardando Início",
            "material_color": {
                "style": {
                    "color": "rgba(0,0,0,0.87)",
                    "background-color": "rgb(255,183,77)"
                }
            }
        },
        "checklists_concluidas": 0,
        "checklists_total": 2,
        "data_limite_excedida": true,
        "usuario_cadas
```

---
## PUT — Editar
*Tarefas*

```
PUT {{url}}/api/v1/integracao/tarefa/:id_tarefa
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse endpoint será possível editar a tarefa e obter o retorno no formato JSON como resposta. Lembre de enviar o ID do tarefa como um parâmetro na URL, conforme o exemplo acima. Os seguintes parâmetros podem/devem estar presentes no corpo do requisição:

| **Atributo** | **Descrição** | **Obrigatório** |
| --- | --- | --- |
| titulo | Titulo da tarefa que vai ser adicionada | Sim |
| id_prioridade | ID da Prioridade que vai ser vinculada | Sim |
| id_setor_responsavel | ID da Setor que vai ser vinculado | Sim |
| id_tarefa_categoria | ID da Categoria de tarefa que vai ser vinculada | Sim |
| id_usuario_responsavel | ID do Usuario responsavel que vai ser vinculado | Sim |
| data_limite | Data limite para execução | Sim |
| hora_limite | Hora limite para execução | Sim |
| descricao_abertura | Descricao de Abertura da tarefa | Não |
| checklists | Objeto JSON que poderá conter o titulo e itens | Não |
| usuarios_participantes | Objeto JSON que poderá conter o ID do usuario participante | Não |
| comentarios | Objeto JSON que poderá conter a mensagem | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| titulo | Campo Livre (Qualquer valor é aceito) | Nenhum |
| id_prioridade | Número Inteiro | Nenhum |
| id_setor_responsavel | Número Inteiro | Nenhum |
| id_tarefa_categoria | Número Inteiro | Nenhum |
| id_usuario_responsavel | Número Inteiro | Nenhum |
| data_limite | Timestamp (2020-01-01) | Nenhum |
| hora_limite | Texto (12:00:00) | Nenhum |
| descricao_abertura | Campo Livre (Qualquer valor é aceito) | Nenhum |
| checklists | Array Associativo, JSON | Nenhum |
| usuarios_participantes | Array Associativo, JSON | Nenhum |
| comentarios | Array Associativo, JSON | Nenhum |

**Corpo da requisição (JSON):**

```json
{
  "titulo": "teste api editar tarefa",
  "id_prioridade": 2,
  "id_setor_responsavel": "183",
  "id_tarefa_categoria": "47",
  "id_usuario_responsavel": "7834",
  "data_limite": "23-10-06",
  "hora_limite": "16:50:41",
  "descricao_abertura": "teste api edição tarefa descricao",
  "checklists": [
    {
      "titulo": "api",
      "itens": [
        {
          "titulo": "teste 1",
          "concluido": true
        },
        {
          "titulo": "teste 2",
          "concluido": false
        }
      ]
    },
    {
      "titulo": "api 2",
      "itens": [
        {
          "titulo": "teste 3",
          "concluido": false
        },
        {
          "titulo": "teste 4",
          "concluido": false
        }
      ]
    }
  ],
  "usuarios_participantes": [
    {
      "id_usuario": "7834"
    },
    {
      "id_usuario": "1045"
    }
  ],
  "comentarios": [
    {
      "mensagem": "teste"
    },
    {
      "mensagem": "teste 2"
    }
  ]
}
```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Tarefa atualizada com sucesso",
    "tarefa": {
        "id_tarefa": 1455,
        "id_usuario_responsavel": 7834,
        "id_setor_responsavel": 183,
        "id_tarefa_categoria": 47,
        "id_usuario_cadastro": 7599,
        "id_tarefa_grupo": 596,
        "descricao_abertura": "teste api edição tarefa descricao",
        "descricao_conclusao": null,
        "data_cadastro": "2024-11-27 11:52:56",
        "data_limite": "2023-10-06 16:50:41",
        "data_atualizacao": "2024-11-27 11:54:13",
        "data_inicio": null,
        "data_conclusao": null,
        "status": "aguardando",
        "id_prioridade": 2,
        "deleted_at": null,
        "id_tarefa_recorrente": null,
        "titulo": "teste api editar tarefa",
        "id_tarefa_recorrente_origem": null,
        "prazo_execucao": null,
        "hora": null,
        "minuto": null,
        "data_cadastro_br": "27/11/2024",
        "data_cadastro_timestamp": "27/11/2024 11:52:56",
        "data_limite_br": "06/10/2023",
        "data_limite_timestamp": "06/10/2023 16:50:41",
        "data_atualizacao_br": "27/11/2024 11:54:13",
        "data_inicio_br": null,
        "data_conclusao_br": null,
        "status_display": {
            "descricao": "Aguardando Início",
            "material_color": {
                "style": {
                    "color": "rgba(0,0,0,0.87)",
                    "background-color": "rgb(255,183,77)"
                }
            }
        },
```

---
## DELETE — Apagar
*Tarefas*

```
DELETE {{url}}/api/v1/integracao/tarefa/:id_tarefa
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

No método `DELETE`, será possível apagar a tarefa.

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Tarefa inativada com sucesso",
    "tarefa": {
        "id_tarefa": 1444,
        "id_usuario_responsavel": 7599,
        "id_setor_responsavel": 40,
        "id_tarefa_categoria": 637,
        "id_usuario_cadastro": 7599,
        "id_tarefa_grupo": 596,
        "descricao_abertura": null,
        "descricao_conclusao": null,
        "data_cadastro": "2024-10-24 12:40:00",
        "data_limite": "2024-10-26 12:40:00",
        "data_atualizacao": "2024-11-27 11:55:17",
        "data_inicio": null,
        "data_conclusao": null,
        "status": "aguardando",
        "id_prioridade": 2,
        "deleted_at": "2024-11-27 11:55:17",
        "id_tarefa_recorrente": null,
        "titulo": "teste fellipe",
        "id_tarefa_recorrente_origem": 625,
        "prazo_execucao": 4320,
        "hora": 12,
        "minuto": 40,
        "data_cadastro_br": "24/10/2024",
        "data_limite_br": "26/10/2024",
        "data_limite_timestamp": "26/10/2024 12:40:00",
        "data_cadastro_timestamp": "24/10/2024 12:40:00",
        "data_atualizacao_br": "27/11/2024 11:55:17",
        "data_inicio_br": null,
        "data_conclusao_br": null,
        "status_display": {
            "descricao": "Aguardando Início",
            "material_color": {
                "style": {
                    "color": "rgba(0,0,0,0.87)",
                    "background-color": "rgb(255,183,77)"
                }
            }
        },
        "hora_limite": "12:40:0
```

---