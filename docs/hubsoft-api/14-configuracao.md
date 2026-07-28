# Configuração

## Alerta

**Necessário**

Para realizar as requisições nos dados de alerta, será necessário que você já possua o `access_token`, adquirido através dos `endpoints` de `(oAuth)`.

### GET — Consulta
*Configuração / Alerta*

```
GET {{url}}/api/v1/integracao/configuracao/alerta/paginado/:quantidade
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `page` | `1` |

**Descrição:**

**GET**

No método `GET`, irá consultar os dados de alertas e retornar um `JSON` como resposta. Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| ativo | Status do Alerta | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| ativo | Caso enviado, deve conter um dos seguintes valores (sim/nao) | Nenhum |

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Alertas consultados com sucesso!",
  "alertas": {
    "current_page": 1,
    "data": [
      {
        "id_alerta": 216,
        "descricao": "TESTE",
        "atendimento": true,
        "faturamento": false,
        "arquivo_remessa": false,
        "arquivo_retorno": false,
        "nota_fiscal": false,
        "id_usuario": 4897,
        "created_at": "2023-08-16 14:23:36",
        "updated_at": "2023-08-16 14:23:55",
        "parametros": {
          "bairros": [],
          "id_cidade_bairros": []
        },
        "visivel_via_api": true,
        "deleted_at": null,
        "data_inicio": "2023-08-16 00:00:00",
        "data_fim": "2023-08-18 00:00:00",
        "texto_alerta": "TESTE API",
        "data_cadastro_br": "16/08/2023 14:23",
        "bairros": [],
        "cidades": [],
        "grupos_cliente": [],
        "grupos_cliente_servico": [],
        "interfaces_conexao": [],
        "caixa_optica": [],
        "servico_status": [],
        "usuario": {
          "id": 1,
          "name": "API"
        }
      }
    ],
    "first_page_url": "http://localhost:8000/api/v1/integracao/configuracao/alerta/paginado/1?page=1",
    "from": 1,
    "last_page": 13,
    "last_page_url": "http://localhost:8000/api/v1/integracao/configuracao/alerta/paginado/1?page=13",
    "next_page_url": "http://localhost:8000/api/v1/integracao/configuracao/alerta/paginado/1?page=2",
    "path": "http://localhost:8000/api/v1/integracao/configuracao/alert
```

---
### POST — Adicionar
*Configuração / Alerta*

```
POST {{url}}/api/v1/integracao/configuracao/alerta
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

No método `POST`, será possível adicionar alertas e obter o retorno no formato `JSON` como resposta. Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| descricao | Descrição do alerta | Sim |
| visivel_via_api | Indica se estará disponivel via API | Sim |
| atendimento | Indica se o alerta estará disponivel na abertura de atendimentos | Sim |
| cidade | Array de cidades (pode conter os bairros também) | Não |
| grupo_cliente | Array de grupos de cliente | Não |
| grupo_cliente_servico | Array de grupos de serviço | Não |
| interface_conexao | Array de interfaces de conexão | Não |
| servico_status | Array de status do serviço | Não |
| caixa_optica | Array de caixas opticas | Não |
| pops | Array de pops | Não |
| data_inicio | Data de início do alerta | Não |
| data_fim | Data de fim do alerta | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| descrição | Campo Livre (Qualquer valor é aceito) | Nenhum |
| visivel_via_api | Booleano (true/false) | Nenhum |
| atendimento | Booleano (true/false) | Nenhum |
| cidade | Array de objetos contendo (id_cidade) e opcionalmente um array de bairros (contendo o nome do bairro) | Nenhum |
| grupo_cliente | Array de objetos contendo (id_grupo_cliente) | Nenhum |
| grupo_cliente_servico | Array de objetos contendo (id) | Nenhum |
| interface_conexao | Array de objetos contendo (id_interface_conexao) | Nenhum |
| caixa_optica | Array de objetos contendo (id_caixa_optica) | Nenhum |
| servico_status | Array de objetos contendo (id_servico_status) | Nenhum |
| pops | Array de objetos contendo (id_pop) | Nenhum |
| data_inicio | Date (YYYY-MM-DD) | Nenhum |
| data_fim | Date (YYYY-MM-DD) | Nenhum |

**Corpo da requisição (JSON):**

```json
{
  "descricao": "ALERTA TESTE CADASTRO API",
  "visivel_via_api": true,
  "atendimento": true,
  "cidade": [
    {
      "id_cidade": 6976,
      "bairros": [
        {
          "nome": "TESTE"
        }
      ]
    }
  ],
  "grupo_cliente": [
    {
      "id_grupo_cliente": 46
    }
  ],
  "grupo_cliente_servico": [
    {
      "id": 22
    }
  ],
  "interface_conexao": [
    {
      "id_interface_conexao": 1478
    }
  ],
  "caixa_optica": [
    {
      "id_caixa_optica": 1221
    }
  ],
  "servico_status": [
    {
      "id_servico_status": 9
    }
  ],
  "data_inicio": "2023-08-09",
  "data_fim": "2023-08-10",
  "hora_inicio": "09:15",
  "hora_fim": "16:48"
}
```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
  "status": "success",
  "msg": "Alerta cadastrado com sucesso!",
  "alerta": [
    {
      "id_alerta": 1,
      "descricao": "ALERTA TESTE CADASTRO API",
      "ativo": true,
      "data_cadastro": "21/08/2023 15:49",
      "data_inicio": null,
      "data_fim": null,
      "texto_alerta": "ALERTA TESTE CADASTRO API\n\n21/08/2023 15:49 - Usuário API\n",
      "cidade": [],
      "grupo_cliente": [],
      "grupo_cliente_servico": [],
      "interface_conexao": [],
      "caixa_optica": [],
      "servico_status": [],
      "pops": [
        {
          "id_pop": 53,
          "descricao": "DEV TESTE - API"
        }
      ],
      "usuario": {
        "id": 1,
        "nome": "Usuário API"
      }
    }
  ]
}
```

---
### PUT — Editar
*Configuração / Alerta*

```
PUT {{url}}/api/v1/integracao/configuracao/alerta/:id_alerta
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse endpoint será possível editar o alerta e obter o retorno no formato JSON como resposta.  
Lembre de enviar o ID do alerta como um parâmetro na URL, conforme o exemplo acima.  
Os seguintes parâmetros podem/devem estar presentes no corpo do requisição:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| descricao | Descrição do alerta | Sim |
| visivel_via_api | Indica se estará disponivel via API | Sim |
| atendimento | Indica se o alerta estará disponivel na abertura de atendimentos | Não |
| visivel_cliente | Indica se o alerta estará disponivel nos clientes | Não |
| cidade | Array de cidades (pode conter os bairros também) | Não |
| grupo_cliente | Array de grupos de cliente | Não |
| grupo_cliente_servico | Array de grupos de serviço | Não |
| interface_conexao | Array de interfaces de conexão | Não |
| servico_status | Array de status do serviço | Não |
| caixa_optica | Array de caixas opticas | Não |
| pops | Array de pops | Não |
| data_inicio | Data de início do alerta | Não |
| data_fim | Data de fim do alerta | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| descrição | Campo Livre (Qualquer valor é aceito) | Nenhum |
| visivel_via_api | Booleano (true/false) | Nenhum |
| atendimento | Booleano (true/false) | Nenhum |
| cidade | Array de objetos contendo (id_cidade) e opcionalmente um array de bairros (contendo o nome do bairro) | Nenhum |
| grupo_cliente | Array de objetos contendo (id_grupo_cliente) | Nenhum |
| grupo_cliente_servico | Array de objetos contendo (id) | Nenhum |
| interface_conexao | Array de objetos contendo (id_interface_conexao) | Nenhum |
| caixa_optica | Array de objetos contendo (id_caixa_optica) | Nenhum |
| servico_status | Array de objetos contendo (id_servico_status) | Nenhum |
| pops | Array de objetos contendo (id_pop) | Nenhum |
| data_inicio | Date (YYYY-MM-DD) | Nenhum |
| data_fim | Date (YYYY-MM-DD) | Nenhum |

**Corpo da requisição (JSON):**

```json
{
  "descricao": "TESTE ALTERAÇÃO VIA API",
  "visivel_via_api": true,
  "atendimento": true
}
```

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Alerta atualizado com sucesso!",
  "alerta": [
    {
      "id_alerta": 217,
      "descricao": "TESTE ALTERAÇÃO VIA API",
      "ativo": true,
      "data_cadastro": "21/08/2023 15:49",
      "data_inicio": null,
      "data_fim": null,
      "texto_alerta": "TESTE ALTERAÇÃO VIA API\n\n21/08/2023 15:49 - Usuário API\n",
      "cidade": [],
      "grupo_cliente": [],
      "grupo_cliente_servico": [],
      "interface_conexao": [],
      "caixa_optica": [],
      "servico_status": [],
      "pops": [
        {
          "id_pop": 53,
          "descricao": "DEV TESTE - API"
        }
      ],
      "usuario": {
        "id": 1,
        "nome": "Usuário API"
      }
    }
  ]
}
```

---
### DELETE — Remover (Inativar)
*Configuração / Alerta*

```
DELETE {{url}}/api/v1/integracao/configuracao/alerta/:id_alerta
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

No método `DELETE`, será possível remover (inativar) um alerta.

**Aviso**

`IMPORTANTE`: É necessário informar na requisição o `id_alerta.`

**Corpo da requisição (JSON):**

```json
{
  "motivo": "SERÁ ADICIONADO OUTRO CONTRATO PARA O CLIENTE"
}
```

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Alerta removido com sucesso!",
  "alerta": {
    "id_alerta": 1,
    "descricao": "TESTE ALTERAÇÃO VIA API",
    "atendimento": true,
    "faturamento": false,
    "arquivo_remessa": false,
    "arquivo_retorno": false,
    "nota_fiscal": false,
    "id_usuario": 915,
    "created_at": "2023-08-21 15:49:18",
    "updated_at": "2023-08-21 16:44:26",
    "parametros": [],
    "visivel_via_api": true,
    "deleted_at": "2023-08-21 16:44:26",
    "data_inicio": null,
    "data_fim": null,
    "texto_alerta": "TESTE ALTERAÇÃO VIA API\n\n21/08/2023 15:49 - Usuário API\n",
    "data_cadastro_br": "21/08/2023 15:49",
    "bairros": [],
    "usuario": {
      "id": 1,
      "name": "Usuário API"
    }
  }
}
```

---
## Atendimento

**Necessário**

Para realizar as requisições nos dados de atendimento, será necessário que você já possua o `access_token`, adquirido através dos `endpoints` de `(oAuth)`.

### GET — Tipos de Atendimento
*Configuração / Atendimento*

```
GET {{url}}/api/v1/integracao/configuracao/tipo_atendimento
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

No método `GET`, irá consultar os dados dos tipos de atendimento e retornar um `JSON` como resposta.

**Exemplo de resposta — Consulta**

```json
{
  "status": "success",
  "msg": "Dados consultados com sucesso",
  "tipos_atendimento": [
    {
      "id_tipo_atendimento": 109,
      "descricao": "SEM ACESSO A INTERNET"
    },
    {
      "id_tipo_atendimento": 111,
      "descricao": "OSCILAÇÃO/QUEDAS DE CONEXÃO"
    }
  ]
}
```

---
### GET — Status Atendimento
*Configuração / Atendimento*

```
GET {{url}}/api/v1/integracao/configuracao/status_atendimento
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

No método `GET`, irá consultar os dados de status de atendimento e irá retornar um `JSON` como resposta.

Rota importante para coletar o id_atendimento_status para ser passado ao abrir um atendimento.

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Status de Atendimento consultados com sucesso!",
    "status_atendimento": [
        {
            "id_atendimento_status": 23,
            "descricao": "Aguardando Análise",
            "prefixo": "aguardando_analise",
            "abrir_ordem_servico": false,
            "display": "Aguardando Análise"
        },
        {
            "id_atendimento_status": 64,
            "descricao": "BASE TÉCNICA",
            "prefixo": "base_tecnica",
            "abrir_ordem_servico": true,
            "display": "BASE TÉCNICA (Abertura de OS)"
        },
        {
            "id_atendimento_status": 66,
            "descricao": "EM TRATATIVA",
            "prefixo": "retornar_contato",
            "abrir_ordem_servico": false,
            "display": "EM TRATATIVA"
        },
        {
            "id_atendimento_status": 65,
            "descricao": "NOVO ATENDIMENTO",
            "prefixo": "novo_atendimento",
            "abrir_ordem_servico": false,
            "display": "NOVO ATENDIMENTO"
        },
        {
            "id_atendimento_status": 134,
            "descricao": "PENDENTE TESTE",
            "prefixo": "PENDENTE",
            "abrir_ordem_servico": false,
            "display": "PENDENTE TESTE"
        },
        {
            "id_atendimento_status": 22,
            "descricao": "Pendente",
            "prefixo": "pendente",
            "abrir_ordem_servico": true,
            "display": "Pendente (Abertura de OS)"
```

---
### GET — Motivos de Fechamento Atendimento
*Configuração / Atendimento*

```
GET {{url}}/api/v1/integracao/configuracao/motivo_fechamento_atendimento
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

No método `GET`, irá consultar os dados de motivos de fechamento de atendimento ativos e irá retornar um `JSON` como resposta.

No método `GET`, será possível consultar também os motivos vinculados a um determinado tipo de atendimento e obter o retorno no formato `JSON` como resposta. Os seguintes `Query Params` podem ser utilizados.

| **Atributo** | **Descrição** | **Obrigatório** |
| --- | --- | --- |
| id_tipo_atendimento | ID do Tipo de Atendimento | Não |

**Obs:** Caso no retorno daquele motivo de fechamento não tenha dados no motivos_fechamento_tipo_atendimento, esse motivo pode ser utilizado nos atendimentos de todos os tipos de atendimento

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "motivos_fechamento": [
        {
            "id_motivo_fechamento_atendimento": 125,
            "descricao": "Fechado Automático Atendimento",
            "motivos_fechamento_tipo_atendimento": [
                {
                    "id_tipo_atendimento": 236,
                    "descricao": "INSTALAÇÃO"
                },
                {
                    "id_tipo_atendimento": 273,
                    "descricao": "TESTE CAMILA MELO"
                },
                {
                    "id_tipo_atendimento": 274,
                    "descricao": "TESTE FELLIPE"
                },
                {
                    "id_tipo_atendimento": 275,
                    "descricao": "NOVO FLÁVIA"
                },
                {
                    "id_tipo_atendimento": 324,
                    "descricao": "TESTE O.S TREINAMENTO"
                },
                {
                    "id_tipo_atendimento": 930,
                    "descricao": "CANCELAMENTO"
                },
                {
                    "id_tipo_atendimento": 931,
                    "descricao": "CANCELAMENTO - CLIENTE INSATISFEITO - ADMINISTRATIVO"
                },
                {
                    "id_tipo_atendimento": 980,
                    "descricao": "TESTE ATEND 2"
                }
            ]
        },
        {
            "id_motivo_fechamento_atendimento": 4,
            "descricao":
```

---
## Estoque

**Necessário**

Para realizar as requisições nos dados de estoque, será necessário que você já possua o `access_token`, adquirido através dos `endpoints` de `(oAuth)`.

### GET — Categoria Produto
*Configuração / Estoque*

```
GET {{url}}/api/v1/integracao/configuracao/categoria
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse `endpoint` será possível consultar as categorias de produto que estão cadastrados e ativos no sistema.

`OBSERVAÇÃO`: O uso dessa API será muito útil para complementar a API de Adicionar/Editar Produto onde se faz necessário enviar obrigatóriamente o ID da categoria.

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Categorias consultados com sucesso!",
    "categorias": [
        {
            "id_categoria": 178,
            "descricao": " ACESSÓRIOS"
        },
        {
            "id_categoria": 114,
            "descricao": "A"
        },
        {
            "id_categoria": 196,
            "descricao": "CABO LAN"
        },
        {
            "id_categoria": 73,
            "descricao": "CAIXA DE FERRAMENTAS"
        },
        {
            "id_categoria": 187,
            "descricao": "CAIXA DE FERREMENTAS 2"
        },
        {
            "id_categoria": 192,
            "descricao": "CAPACETE"
        },
        {
            "id_categoria": 852,
            "descricao": "CATEGORIA WIKI"
        },
        {
            "id_categoria": 72,
            "descricao": "CELULAR"
        },
        {
            "id_categoria": 189,
            "descricao": "CHAVE"
        },
        {
            "id_categoria": 191,
            "descricao": "EPI"
        },
        {
            "id_categoria": 71,
            "descricao": "ITENS DE USO TÉCNICO"
        },
        {
            "id_categoria": 173,
            "descricao": "MODELO A1"
        },
        {
            "id_categoria": 180,
            "descricao": "MONITORES"
        },
        {
            "id_categoria": 179,
            "descricao": "MONITORES E ACESSÓRIOS"
        },
        {
            "id_categoria":
```

---
### GET — CEST Produto
*Configuração / Estoque*

```
GET {{url}}/api/v1/integracao/configuracao/cest
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse `endpoint` será possível consultar os cests que estão cadastrados e ativos no sistema, que poderá ser utilizado nos produto .

`OBSERVAÇÃO`: O uso dessa API será muito útil para complementar a API de Adicionar/Editar Produto onde se faz necessário enviar obrigatóriamente o **código** CEST.

No método `GET`, será possível consultar também o ncm e o cest de um determinado código e obter o retorno no formato `JSON` como resposta. Os seguintes `Query Params` podem ser utilizados.

| **Atributo** | **Descrição** | **Obrigatório** |
| --- | --- | --- |
| `codigo_cest` | Código CEST | Não |
| `codigo_ncm` | Código NCM | não |

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "CESTs consultados com sucesso!",
    "cests": [
        {
            "id_cest": 1174,
            "codigo_cest": "0100100",
            "ncm": "38151290",
            "descricao": "Catalisadores em colmeia cerâmica ou metálica para conversão catalítica de gases de escape de veículos e outros catalisadores",
            "display": "0100100 - Catalisadores em colmeia cerâmica ou metálica para conversão catalítica de gases de escape de veículos e outros catalisadores"
        },
        {
            "id_cest": 1173,
            "codigo_cest": "0100100",
            "ncm": "38151210",
            "descricao": "Catalisadores em colmeia cerâmica ou metálica para conversão catalítica de gases de escape de veículos e outros catalisadores",
            "display": "0100100 - Catalisadores em colmeia cerâmica ou metálica para conversão catalítica de gases de escape de veículos e outros catalisadores"
        },
        {
            "id_cest": 1175,
            "codigo_cest": "0100200",
            "ncm": "3917",
            "descricao": "Tubos e seus acessórios (por exemplo, juntas, cotovelos, flanges, uniões), de plásticos",
            "display": "0100200 - Tubos e seus acessórios (por exemplo, juntas, cotovelos, flanges, uniões), de plásticos"
        },
        {
            "id_cest": 1176,
            "codigo_cest": "0100300",
            "ncm": "39181000",
            "descricao": "Protetores de caçamba",
```

---
### GET — CST Origem Produto
*Configuração / Estoque*

```
GET {{url}}/api/v1/integracao/configuracao/cst_origem
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse `endpoint` será possível consultar os cst origem que estão cadastrados e ativos no sistema, para serem utilizado nos produtos.

`OBSERVAÇÃO`: O uso dessa API será muito útil para complementar a API de Adicionar/Editar Produto onde se faz necessário enviar obrigatóriamente o **código** CST Origem.

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "CST Origem consultados com sucesso!",
    "cst_origem": [
        {
            "id_cst_origem": 24,
            "descricao": "Estrangeira - Adquirida no mercado interno, exceto a indicada no código 7",
            "codigo": "2",
            "display": "2 - Estrangeira - Adquirida no mercado interno, exceto a indicada no código 7"
        },
        {
            "id_cst_origem": 29,
            "descricao": "Estrangeira - Adquirida no mercado interno, sem similar nacional, constante em lista da CAMEX e gás natural",
            "codigo": "7",
            "display": "7 - Estrangeira - Adquirida no mercado interno, sem similar nacional, constante em lista da CAMEX e gás natural"
        },
        {
            "id_cst_origem": 23,
            "descricao": "Estrangeira - Importação direta, exceto a indicada no código 6",
            "codigo": "1",
            "display": "1 - Estrangeira - Importação direta, exceto a indicada no código 6"
        },
        {
            "id_cst_origem": 28,
            "descricao": "Estrangeira - Importação direta, sem similar nacional, constante em lista da CAMEX e gás natural",
            "codigo": "6",
            "display": "6 - Estrangeira - Importação direta, sem similar nacional, constante em lista da CAMEX e gás natural"
        },
        {
            "id_cst_origem": 22,
            "descricao": "Nacional - Adquirida no mercado interno, exceto a indicada no código
```

---
### GET — Marca Produto
*Configuração / Estoque*

```
GET {{url}}/api/v1/integracao/configuracao/produto_marca
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse `endpoint` será possível consultar as marcas de produto que estão cadastrados e ativos no sistema.

`OBSERVAÇÃO`: O uso dessa API será muito útil para complementar a API de Adicionar/Editar Produto onde se faz necessário enviar obrigatóriamente o ID da marca.

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Produto Marcas consultados com sucesso!",
    "produto_marcas": [
        {
            "id_produto_marca": 26,
            "nome": "BELKIN"
        },
        {
            "id_produto_marca": 198,
            "nome": "ACER"
        },
        {
            "id_produto_marca": 206,
            "nome": "POLLL "
        },
        {
            "id_produto_marca": 208,
            "nome": "INNOVCABLE TESTE K"
        },
        {
            "id_produto_marca": 64,
            "nome": "SAMSUNG"
        },
        {
            "id_produto_marca": 65,
            "nome": "LG"
        },
        {
            "id_produto_marca": 292,
            "nome": "API"
        },
        {
            "id_produto_marca": 38,
            "nome": "FIBERHOME"
        },
        {
            "id_produto_marca": 30,
            "nome": "Furukawa "
        },
        {
            "id_produto_marca": 196,
            "nome": "MULTILASER"
        },
        {
            "id_produto_marca": 191,
            "nome": "Itatiaia"
        },
        {
            "id_produto_marca": 57,
            "nome": "LG"
        },
        {
            "id_produto_marca": 55,
            "nome": "Nvidia"
        },
        {
            "id_produto_marca": 62,
            "nome": "ASUS"
        },
        {
            "id_produto_marca": 56,
            "nome": "Xiaomi"
        },
        {
            "i
```

---
### GET — NCM Produto
*Configuração / Estoque*

```
GET {{url}}/api/v1/integracao/configuracao/ncm
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse `endpoint` será possível consultar os ncm que estão cadastrados e ativos no sistema, que poderá ser utilizado nos produto .

`OBSERVAÇÃO`: O uso dessa API será muito útil para complementar a API de Adicionar/Editar Produto onde se faz necessário enviar obrigatóriamente o **código** NCM.

No método `GET`, será possível consultar também o ncm de um determinado código e obter o retorno no formato `JSON` como resposta. Os seguintes `Query Params` podem ser utilizados.

| **Atributo** | **Descrição** | **Obrigatório** |
| --- | --- | --- |
| `codigo_ncm` | Código NCM | Não |

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "NCMs consultados com sucesso!",
    "ncms": [
        {
            "id_ncm": 13858,
            "codigo_ncm": "00000000",
            "descricao": "USO GENÉRICO",
            "display": "00000000 - USO GENÉRICO"
        },
        {
            "id_ncm": 1,
            "codigo_ncm": "01012100",
            "descricao": "CAVALOS REPRODUTORES DE RAÇA PURA",
            "display": "01012100 - CAVALOS REPRODUTORES DE RAÇA PURA"
        },
        {
            "id_ncm": 2,
            "codigo_ncm": "01012900",
            "descricao": "OUTROS CAVALOS VIVOS",
            "display": "01012900 - OUTROS CAVALOS VIVOS"
        },
        {
            "id_ncm": 3,
            "codigo_ncm": "01013000",
            "descricao": "ASININOS VIVOS",
            "display": "01013000 - ASININOS VIVOS"
        },
        {
            "id_ncm": 4,
            "codigo_ncm": "01019000",
            "descricao": "OUTROS MUARES VIVOS",
            "display": "01019000 - OUTROS MUARES VIVOS"
        },
        {
            "id_ncm": 5,
            "codigo_ncm": "01022110",
            "descricao": "BOVINOS DOMÉST.REPROD.D/RAÇA PURA,PRENHES OU C/CRIA AO",
            "display": "01022110 - BOVINOS DOMÉST.REPROD.D/RAÇA PURA,PRENHES OU C/CRIA AO"
        },
        {
            "id_ncm": 6,
            "codigo_ncm": "01022190",
            "descricao": "OUTROS BOVINOS REPRODUTORES DE RAÇA PURA",
            "display"
```

---
### GET — Status Compra
*Configuração / Estoque*

```
GET {{url}}/api/v1/integracao/configuracao/status_compra
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse `endpoint` será possível consultar os status de compra que estão cadastrados e ativos no sistema.

`OBSERVAÇÃO`: O uso dessa API será muito útil para complementar a API de Adicionar Movimento de Entrada de compra onde se faz necessário enviar obrigatóriamente o ID Status de Compra.

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Status de Compras consultados com sucesso!",
    "status_compra": [
        {
            "id_status_compra": 8,
            "descricao": "Aguardando Entrega"
        },
        {
            "id_status_compra": 1,
            "descricao": "Aguardando Fornecedor"
        },
        {
            "id_status_compra": 81,
            "descricao": "Aguardando Pagamento"
        },
        {
            "id_status_compra": 2,
            "descricao": "Cancelado"
        },
        {
            "id_status_compra": 66,
            "descricao": "Compra Ávista"
        },
        {
            "id_status_compra": 82,
            "descricao": "Compra Realizada"
        },
        {
            "id_status_compra": 3,
            "descricao": "Enviado pelo Fornecedor"
        },
        {
            "id_status_compra": 4,
            "descricao": "Pagamento Aceito"
        },
        {
            "id_status_compra": 5,
            "descricao": "Pendente"
        },
        {
            "id_status_compra": 6,
            "descricao": "Problema de Pagamento"
        },
        {
            "id_status_compra": 75,
            "descricao": "Produto em Garantia"
        },
        {
            "id_status_compra": 7,
            "descricao": "Recebido do Fornecedor"
        },
        {
            "id_status_compra": 735,
            "descricao": "STATUS WIKI"
        },
        {
```

---
### GET — Status Produto
*Configuração / Estoque*

```
GET {{url}}/api/v1/integracao/configuracao/produto_item_status
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse `endpoint` será possível consultar os status de produto que estão cadastrados e ativos no sistema.

`OBSERVAÇÃO`: O uso dessa API será muito útil para complementar a API de Saída Manual e Alteração de Status onde se faz necessário enviar obrigatóriamente o ID do **produto_item_status** ou o **prefixo** do mesmo.

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Produto Item Status consultados com sucesso.",
    "produto_item_status": [
        {
            "id_produto_item_status": 3,
            "descricao": "BAIXA MANUAL",
            "prefixo": "baixa_manual"
        },
        {
            "id_produto_item_status": 145,
            "descricao": "COM TÉCNICO",
            "prefixo": "teste_ana"
        },
        {
            "id_produto_item_status": 9,
            "descricao": "DEFEITO",
            "prefixo": "defeito"
        },
        {
            "id_produto_item_status": 8,
            "descricao": "DESCARTADO",
            "prefixo": "descartado"
        },
        {
            "id_produto_item_status": 28,
            "descricao": "DOAÇÃO.",
            "prefixo": "doado"
        },
        {
            "id_produto_item_status": 41,
            "descricao": "EM GARANTIA",
            "prefixo": "ainda_em_garantia"
        },
        {
            "id_produto_item_status": 7,
            "descricao": "EM TESTE",
            "prefixo": "teste"
        },
        {
            "id_produto_item_status": 32,
            "descricao": "FINALIZADO",
            "prefixo": "finalizado"
        },
        {
            "id_produto_item_status": 12,
            "descricao": "INSTALADO INFRA",
            "prefixo": "instal_infra"
        },
        {
            "id_produto_item_status": 6,
            "descricao": "MANUTENÇÃO",
```

---
### GET — Tipo Produto
*Configuração / Estoque*

```
GET {{url}}/api/v1/integracao/configuracao/produto_tipo
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse `endpoint` será possível consultar os tipos de produto que estão cadastrados e ativos no sistema.

`OBSERVAÇÃO`: O uso dessa API será muito útil para complementar a API de Adicionar/Editar Produto onde se faz necessário enviar obrigatóriamente o ID Tipo Produto.

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Produto Tipos consultados com sucesso!",
    "produto_tipos": [
        {
            "id_produto_tipo": 9,
            "descricao": "Ativo Imobilizado",
            "codigo_sped": "08",
            "display": "08 - Ativo Imobilizado (Inventário: NÃO)"
        },
        {
            "id_produto_tipo": 3,
            "descricao": "Embalagem",
            "codigo_sped": "02",
            "display": "02 - Embalagem (Inventário: NÃO)"
        },
        {
            "id_produto_tipo": 2,
            "descricao": "Matéria-prima",
            "codigo_sped": "01",
            "display": "01 - Matéria-prima (Inventário: NÃO)"
        },
        {
            "id_produto_tipo": 8,
            "descricao": "Material de Uso e Consumo",
            "codigo_sped": "07",
            "display": "07 - Material de Uso e Consumo (Inventário: NÃO)"
        },
        {
            "id_produto_tipo": 12,
            "descricao": "Outras",
            "codigo_sped": "99",
            "display": "99 - Outras (Inventário: NÃO)"
        },
        {
            "id_produto_tipo": 11,
            "descricao": "Outros Insumos",
            "codigo_sped": "10",
            "display": "10 - Outros Insumos (Inventário: NÃO)"
        },
        {
            "id_produto_tipo": 5,
            "descricao": "Produto Acabado",
            "codigo_sped": "04",
            "display": "04 - Produto Acabado (Inventário: NÃO)"
```

---
## Financeiro

**Necessário**

Para realizar as requisições nos dados de financeiro, será necessário que você já possua o `access_token`, adquirido através dos `endpoints` de `(oAuth)`.

### GET — Caixa Financeiro
*Configuração / Financeiro*

```
GET {{url}}/api/v1/integracao/configuracao/caixa_financeiro
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse `endpoint` será possível consultar os caixas finaneiros que estão cadastrados e ativos no sistema.

`OBSERVAÇÃO`: O uso dessa API será muito útil para complementar a API de Liquidação de faturas, onde se faz necessário enviar obrigatóriamente o ID do Caixa Financeiro onde se deseja realizar a liquidação.

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Caixas Finaceiros consultados com sucesso",
  "caixas_financeiro": [
    {
      "id_caixa_financeiro": 123,
      "descricao": "CAIXA BANCO ABC"
    },
    {
      "id_caixa_financeiro": 139,
      "descricao": "CAIXA BANCO TESTE"
    },
    {
      "id_caixa_financeiro": 143,
      "descricao": "CAIXA CARTÃO DE CRÉDITO"
    }
  ]
}
```

---
### GET — Meios de Pagamento
*Configuração / Financeiro*

```
GET {{url}}/api/v1/integracao/configuracao/meio_pagamento
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse `endpoint` será possível consultar os meios de pagamento que estão cadastrados e ativos no sistema.

`OBSERVAÇÃO`: O uso dessa API será muito útil para complementar a API de Liquidação de faturas, onde é possível especificar o prefixo do meio de pagamento.

`OBSERVAÇÃO 2:` Para incrementar novos meios de pagamento, basta cadastrá-los através da interface WEB do sistema em `Configuração > Financeiro > Meios de Pagamento`

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Meios de Pagamento consultados com sucesso",
  "meios_pagamento": [
    {
      "descricao": "Boleto",
      "prefixo": "boleto"
    },
    {
      "descricao": "Cartão de Crédito",
      "prefixo": "cartao_credito"
    },
    {
      "descricao": "Cartão de Débito",
      "prefixo": "cartao_debito"
    },
    {
      "descricao": "Cheque",
      "prefixo": "cheque"
    },
    {
      "descricao": "Débito Automático",
      "prefixo": "debito_automatico"
    },
    {
      "descricao": "Dinheiro",
      "prefixo": "dinheiro"
    },
    {
      "descricao": "PIX",
      "prefixo": "pix"
    },
    {
      "descricao": "Transferência Bancária",
      "prefixo": "transferencia_bancaria"
    }
  ]
}
```

---
## Ordem de Serviço

**Necessário**

Para realizar as requisições nos dados de ordem de serviço, será necessário que você já possua o `access_token`, adquirido através dos `endpoints` de `(oAuth)`.

### GET — Tipos de Ordens de Serviço
*Configuração / Ordem de Serviço*

```
GET {{url}}/api/v1/integracao/configuracao/tipo_ordem_servico
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

No método `GET`, irá consultar os dados dos tipos de ordens de serviços e retornar um `JSON` como resposta.

**Exemplo de resposta — Consulta**

```json
{
    "status": "success",
    "msg": "Tipos de O.S consultados com sucesso",
    "tipo_ordem_servicos": [
        {
            "id_tipo_ordem_servico": 95,
            "descricao": "ATIVAÇÃO FIBRA",
            "destino": "cliente_servico"
        },
        {
            "id_tipo_ordem_servico": 189,
            "descricao": "CANCELAMENTO",
            "destino": "cliente_servico"
        },
        {
            "id_tipo_ordem_servico": 209,
            "descricao": "CDO ERRADA | V-TAL IASMIN (INSTALAÇÃO - CHAMADO TÉCNICO)",
            "destino": "cliente_servico"
        },
        {
            "id_tipo_ordem_servico": 205,
            "descricao": "CONFIGURAÇÃO DE ROTEADOR",
            "destino": "pop"
        },
        {
            "id_tipo_ordem_servico": 76,
            "descricao": "CONFIGURAÇÃO DE ROTEADOR",
            "destino": "cliente_servico"
        },
        {
            "id_tipo_ordem_servico": 100,
            "descricao": "ENTREGA DE CARNÊ",
            "destino": "cliente_servico"
        },
        {
            "id_tipo_ordem_servico": 158,
            "descricao": "EVENTOS DE NOTIFICAÇÃO | V-TAL",
            "destino": "cliente_servico"
        },
        {
            "id_tipo_ordem_servico": 210,
            "descricao": "FALHA DE ASSOCIAÇÃO ONT | V-TAL IASMIN (INSTALAÇÃO - CHAMADO TÉCNICO)",
            "destino": "cliente_servico"
        },
        {
            "id_tipo_ordem_servico": 107,
            "descricao": "INSTALACAO",
```

---
### GET — Motivos de Fechamento O.S
*Configuração / Ordem de Serviço*

```
GET {{url}}/api/v1/integracao/configuracao/motivo_fechamento_os
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

No método `GET`, irá consultar os dados de motivos de fechamento de o.s ativos e irá retornar um `JSON` como resposta.

No método `GET`, será possível consultar também os motivos vinculados a um determinado tipo de ordem de serviço e obter o retorno no formato `JSON` como resposta. Os seguintes `Query Params` podem ser utilizados.

| **Atributo** | **Descrição** | **Obrigatório** |
| --- | --- | --- |
| id_tipo_ordem_servico | ID do Tipo de O.S | Não |

**Obs:** Caso no retorno daquele motivo de fechamento não tenha dados no motivos_fechamento_tipo_ordem_servico, esse motivo pode ser utilizado nas o.s de todos os tipos de o.s

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "motivos_fechamento": [
        {
            "id_motivo_fechamento": 155,
            "descricao": "CLIENTE AUSENTE",
            "ignora_parametros_obrigatorios": true,
            "motivos_fechamento_tipo_ordem_servico": []
        },
        {
            "id_motivo_fechamento": 152,
            "descricao": "FECHAMENTO VIA API",
            "ignora_parametros_obrigatorios": false,
            "motivos_fechamento_tipo_ordem_servico": [
                {
                    "id_tipo_ordem_servico": 313,
                    "descricao": "TESTE DEV GILBERTO MOD"
                }
            ]
        },
        {
            "id_motivo_fechamento": 19,
            "descricao": "INSTALAÇÃO CONCLUIDA",
            "ignora_parametros_obrigatorios": false,
            "motivos_fechamento_tipo_ordem_servico": [
                {
                    "id_tipo_ordem_servico": 232,
                    "descricao": "TETSTE MOTIVO FECHAMENTO"
                },
                {
                    "id_tipo_ordem_servico": 188,
                    "descricao": "INSTALAÇÃO :: V-TAL - TESTE WK"
                },
                {
                    "id_tipo_ordem_servico": 237,
                    "descricao": "TESTE FELLIPE OS"
                },
                {
                    "id_tipo_ordem_servico": 238,
                    "descricao": "TESTE FELLIPE POP"
                },
                {
```

---
### GET — Técnicos
*Configuração / Ordem de Serviço*

```
GET {{url}}/api/v1/integracao/configuracao/tecnico
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse `endpoint` será possível consultar os técnicos que estão cadastrados e ativos no sistema.

`OBSERVAÇÃO`: O uso dessa API será muito útil para complementar a API de Abrir Ordem de Serviço, onde é opcional passar o(s) IDs do(s) técnicos vinculados naquela Ordem de Serviço.

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Técnicos consultados com sucesso",
    "tecnicos": [
        {
            "id": 7603,
            "name": "(Suporte Hubsoft) Ana Julia"
        },
        {
            "id": 1045,
            "name": "(Suporte Hubsoft) Bianca Couto"
        },
        {
            "id": 1046,
            "name": "(Suporte Hubsoft) Ésio Filho"
        },
        {
            "id": 7599,
            "name": "(Suporte Hubsoft) Fellipe Cabral"
        },
        {
            "id": 1146,
            "name": "(Suporte Hubsoft) Giovanna Oliveira"
        },
        {
            "id": 1147,
            "name": "(Suporte Hubsoft) Isabella Pacheco"
        },
        {
            "id": 5245,
            "name": "(Suporte Hubsoft) Lucas Santos"
        },
        {
            "id": 5205,
            "name": "(Suporte Hubsoft) Pedro Branco"
        },
        {
            "id": 1148,
            "name": "(Suporte Hubsoft) Samuel Freitas"
        },
        {
            "id": 7600,
            "name": "(Suporte Hubsoft) Weslley Oliveira"
        },
        {
            "id": 4874,
            "name": "API Elisson - Teste Integração melhorias"
        },
        {
            "id": 832,
            "name": "Adan Ribeiro"
        },
        {
            "id": 7811,
            "name": "Alexsander"
        },
        {
            "id": 4894,
            "name": "Andre Junior - Hubsoft"
        },
```

---
## Serviços

**Necessário**

Para realizar as requisições nos dados dos serviços, será necessário que você já possua o `access_token`, adquirido através dos `endpoints` de `(oAuth)`.

### GET — Serviços
*Configuração / Serviços*

```
GET {{url}}/api/v1/integracao/configuracao/servico
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

No método `GET`, irá consultar os dados de seviços ativos e irá retornar um `JSON` como resposta.

No método `GET`, será possível consultar também os serviços de uma determina técnologia e obter o retorno no formato `JSON` como resposta.

Os seguintes `Query Params` estão disponíveis para consulta e personalização da resposta.

| **Atributo** | **Descrição** | **Obrigatório** |
| --- | --- | --- |
| `id_servico_tecnologia` | ID da Tecnologia do Serviço | Não |
| `servicos_inativos_com_cliente` | Nota 1 | Não |
| `dados_composicao_servico` | Nota 2 | Não |

Os atributos podem conter os seguintes valores:

| **Atributo** | **Descrição** | **Valor** Default |
| --- | --- | --- |
| `id_servico_tecnologia` | ID da Tecnologia do Serviço | `NULL` |
| `servicos_inativos_com_cliente` | sim,nao | nao |
| `dados_composicao_servico` | sim,nao | nao |

**Nota 1:****Por padrão, o método retorna apenas os serviços que estão ativos**. No entanto, é possível utilizar o parâmetro**`servicos_inativos_com_cliente`**. Caso este parâmetro seja informado com o valor **`sim`**, a resposta incluirá **todos os serviços ativos**, bem como os **serviços inativos que possuem clientes ativos vinculados**.

**Nota 2:**Por padrão, a composição do serviço não é retornada**.** No entanto, se o parâmetro`dados_composicao_servico` for passado com o valor **`sim`**, será retornado o objeto **`servico_composicao`**, que incluirá as informações sobre a **empresa**, **tipo de documento fiscal** e **descrição da composição**.

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Serviços Ativos consultados com sucesso",
    "servicos": [
        {
            "id_servico": 2792,
            "descricao": "10 MB TESTES CONECTA RLINE",
            "id_servico_tecnologia": 2,
            "servico_tecnologia": {
                "id_servico_tecnologia": 2,
                "descricao": "FIBRA"
            }
        },
        {
            "id_servico": 2799,
            "descricao": "100 MEGAS + HBO",
            "id_servico_tecnologia": 2,
            "servico_tecnologia": {
                "id_servico_tecnologia": 2,
                "descricao": "FIBRA"
            }
        },
        {
            "id_servico": 1292,
            "descricao": "100GB-FIBRA-CLONADO(108)",
            "id_servico_tecnologia": 2,
            "servico_tecnologia": {
                "id_servico_tecnologia": 2,
                "descricao": "FIBRA"
            }
        },
        {
            "id_servico": 1417,
            "descricao": "100GB-FIBRA-CLONE-imprimir-carne",
            "id_servico_tecnologia": 2,
            "servico_tecnologia": {
                "id_servico_tecnologia": 2,
                "descricao": "FIBRA"
            }
        },
        {
            "id_servico": 1410,
            "descricao": "100GB-FIBRA-XPTO",
            "id_servico_tecnologia": 2,
            "servico_tecnologia": {
                "id_servico_tecnologia": 2,
                "descricao": "FIBRA"
            }
        },
        {
            "
```

---
### GET — Status de Serviço
*Configuração / Serviços*

```
GET {{url}}/api/v1/integracao/configuracao/servico_status
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

No método `GET`, irá consultar os dados de status de serviço e irá retornar um `JSON` como resposta.

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Dados consultados com sucesso.",
  "servico_status": [
    {
      "id_servico_status": 1,
      "descricao": "Serviço Habilitado",
      "prefixo": "servico_habilitado"
    },
    {
      "id_servico_status": 2,
      "descricao": "Cancelado",
      "prefixo": "cancelado"
    }
  ]
}
```

---
### GET — Serviços Tecnologia
*Configuração / Serviços*

```
GET {{url}}/api/v1/integracao/configuracao/servico_tecnologia
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

No método `GET`, irá consultar os dados de seviços tecnologia ativos e irá retornar um `JSON` como resposta.

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Serviços Tecnologia consultados com sucesso",
  "servicos_tecnologia": [
    {
      "id_servico_tecnologia": 3,
      "descricao": "Cabo UTP"
    },
    {
      "id_servico_tecnologia": 2,
      "descricao": "FIBRA"
    },
    {
      "id_servico_tecnologia": 19,
      "descricao": "RADIO"
    },
    {
      "id_servico_tecnologia": 1,
      "descricao": "WIRELESS"
    }
  ]
}
```

---
## Tarefas

**Necessário**

Para realizar as requisições nos dados das tarefas, será necessário que você já possua o `access_token`, adquirido através dos `endpoints` de `(oAuth)`.

### GET — Categorias de Tarefas
*Configuração / Tarefas*

```
GET {{url}}/api/v1/integracao/configuracao/tarefa_categoria
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse `endpoint` será possível consultar as categorias de tarefas que estão cadastrados e ativas no sistema.

`OBSERVAÇÃO`: O uso dessa API será muito útil para complementar a API referente a tarefas, onde se faz necessário enviar obrigatóriamente o ID da Categoria de Tarefa.

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Categoria de Tarefas consultados com sucesso!",
    "tarefa_categorias": [
        {
            "id_tarefa_categoria": 637,
            "id_tarefa_grupo": 596,
            "id_setor_responsavel": 40,
            "nome": "ADMISSÃO DE NOVOS FUNCIONARIOS",
            "observacao": "Solicite aprovação da contratação ao gestor e confirme a vaga no orçamento. Recolha e verifique documentos do candidato, como RG, CPF, e carteira de trabalho.",
            "prazo_execucao": 4320,
            "distribuir_automatico": false,
            "data_cadastro": "2024-10-23 09:57:47",
            "deleted_at": null,
            "checklists": [
                {
                    "titulo": "TESTE",
                    "itens": [
                        {
                            "titulo": "TESTE"
                        },
                        {
                            "titulo": "TESTE"
                        }
                    ]
                }
            ],
            "usuarios_participantes": [
                {
                    "id": 7603,
                    "name": "(Suporte Hubsoft) Ana Julia (anajulia.alves@hubsoft.com.br)"
                },
                {
                    "id": 1045,
                    "name": "(Suporte Hubsoft) Bianca Couto (bianca.couto@hubsoft.com.br)"
                }
            ],
            "id_usuario_responsavel": 7599,
            "checklist_padrao": true,
            "usuario_participan
```

---
### GET — Grupos de Tarefas
*Configuração / Tarefas*

```
GET {{url}}/api/v1/integracao/configuracao/tarefa_grupo
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse `endpoint` será possível consultar os grupos de tarefas que estão cadastrados e ativas no sistema.

`OBSERVAÇÃO`: O uso dessa API será muito útil para complementar a API referente a tarefas, onde se faz necessário enviar obrigatóriamente o ID do Grupo de Tarefa.

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
  "status": "success",
  "msg": "Grupos de Tarefas consultados com sucesso!",
  "tarefa_grupos": [
    {
      "id_tarefa_grupo": 33,
      "nome": "ADMINISTRATIVO"
    },
    {
      "id_tarefa_grupo": 1,
      "nome": "COMERCIAL"
    },
    {
      "id_tarefa_grupo": 11,
      "nome": "DESENVOLVIMENTO"
    },
    {
      "id_tarefa_grupo": 14,
      "nome": "IMPLANTAÇÃO"
    },
    {
      "id_tarefa_grupo": 15,
      "nome": "MARKETING"
    },
    {
      "id_tarefa_grupo": 13,
      "nome": "NOC/INFRA"
    },
    {
      "id_tarefa_grupo": 595,
      "nome": "OPERAÇÕES"
    },
    {
      "id_tarefa_grupo": 596,
      "nome": "RH"
    },
    {
      "id_tarefa_grupo": 2,
      "nome": "SUPORTE TÉCNICO"
    },
    {
      "id_tarefa_grupo": 605,
      "nome": "hubinar"
    }
  ]
}
```

---
## Rede

### GET — Modelo Equipamento
*Configuração / Rede*

```
GET {{url}}/api/v1/integracao/configuracao/modelo_equipamento
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**GET**

No método `GET`, será possível consultar os `Modelos de Equipamentos` que estão cadastrados no sistema.

**`Importante`**: Esse retorno com os Ids podem ser utilizados para filtrar equipamentos de conexão.

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "modelos_equipamento": [
        {
            "id_modelo_equipamento": 58,
            "nome": "1016-OT",
            "id_tipo_equipamento": 15,
            "id_fabricante_equipamento": 40,
            "tipo_equipamento": {
                "id_tipo_equipamento": 15,
                "nome": "OLT"
            },
            "fabricante_equipamento": {
                "id_fabricante_equipamento": 40,
                "nome": "GIGA TELCO"
            }
        },
        {
            "id_modelo_equipamento": 226,
            "nome": "1408A",
            "id_tipo_equipamento": 15,
            "id_fabricante_equipamento": 182,
            "tipo_equipamento": {
                "id_tipo_equipamento": 15,
                "nome": "OLT"
            },
            "fabricante_equipamento": {
                "id_fabricante_equipamento": 182,
                "nome": "ZYXEL"
            }
        },
        {
            "id_modelo_equipamento": 218,
            "nome": "2406",
            "id_tipo_equipamento": 15,
            "id_fabricante_equipamento": 173,
            "tipo_equipamento": {
                "id_tipo_equipamento": 15,
                "nome": "OLT"
            },
            "fabricante_equipamento": {
                "id_fabricante_equipamento": 173,
                "nome": "ZYXEL"
            }
        },
        {
            "id_modelo_equipamento": 231,
            "nome": "3845",
```

---
### GET — Tipo Equipamento
*Configuração / Rede*

```
GET {{url}}/api/v1/integracao/configuracao/tipo_equipamento
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**GET**

No método `GET`, será possível consultar os `Tipos de Equipamentos` que estão cadastrados no sistema.

**`Importante`**: Esse retorno com os Ids podem ser utilizados para filtrar equipamentos de conexão.

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Dados consultados com sucesso",
  "tipos_equipamento": [
    {
      "id_tipo_equipamento": 10,
      "nome": "ACCESS POINT"
    },
    {
      "id_tipo_equipamento": 13,
      "nome": "BRAS"
    },
    {
      "id_tipo_equipamento": 14,
      "nome": "BRIDGE"
    },
    {
      "id_tipo_equipamento": 164,
      "nome": "CLT TESTE"
    },
    {
      "id_tipo_equipamento": 16,
      "nome": "ESTAÇÃO WIRELESS"
    },
    {
      "id_tipo_equipamento": 15,
      "nome": "OLT"
    },
    {
      "id_tipo_equipamento": 12,
      "nome": "ONU"
    },
    {
      "id_tipo_equipamento": 9,
      "nome": "ROTEADOR"
    },
    {
      "id_tipo_equipamento": 129,
      "nome": "ROTEADOR DE BANCADA"
    },
    {
      "id_tipo_equipamento": 11,
      "nome": "SWITCH"
    }
  ]
}
```

---
## GET — Tipos de Contato
*Configuração*

```
GET {{url}}/api/v1/integracao/configuracao/tipo_contato
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse `endpoint` será possível consultar os tipos de contatos do sistema.

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
  "status": "success",
  "msg": "Tipos de Contato consultados com sucesso!",
  "tipos_contato": [
    {
      "id_tipo_contato": 4,
      "descricao": "Administrativo"
    },
    {
      "id_tipo_contato": 6,
      "descricao": "Cadastral"
    },
    {
      "id_tipo_contato": 2,
      "descricao": "Comercial"
    },
    {
      "id_tipo_contato": 3,
      "descricao": "Financeiro"
    },
    {
      "id_tipo_contato": 5,
      "descricao": "Outros"
    },
    {
      "id_tipo_contato": 1,
      "descricao": "Técnico"
    }
  ]
}
```

---
## GET — Cidades
*Configuração*

```
GET {{url}}/api/v1/integracao/configuracao/cidade
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `busca` | `` |
| `termo_busca` | `` |

**Descrição:**

Através desse `endpoint` será possível consultar as cidades e seus respectivos bairros que estão cadastrados dentro do sistema. Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| busca | Tipo de busca que deseja fazer na cidade | Não |
| termo_busca | Termo utilizado para fazer a busca | Não |
| listar_todas_cidades | Termo utilizado para listar todas as cidades | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| busca | id_cidade, nome_cidade, uf, ibge | Nenhum |
| termo_busca | Campo livre (Qualquer valor será aceito) | Nenhum |
| listar_todas_cidades | sim,não | não |

`OBSERVAÇÃO`: Caso o listar_todas_cidades esteja como não, apenas as cidades e bairros que possuem clientes ativos, serão retornadas na requisição da `API`, uma vez que o sistema conta com o cadastro atualizado de todas as cidades do Brasil.

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso.",
    "cidades": [
        {
            "id_cidade": 1393,
            "nome": "Araújos",
            "uf": "MG",
            "ibge": "3103900",
            "bairros": [
                {
                    "nome": "ANTONIA DE LURDES"
                },
                {
                    "nome": "BEIRA RIO"
                },
                {
                    "nome": "BELA VISTA"
                },
                {
                    "nome": "CENTRO"
                },
                {
                    "nome": "CHIQUINHO PERCILIA"
                },
                {
                    "nome": "CIDADE NOVA"
                },
                {
                    "nome": "CIDADE NOVO"
                },
                {
                    "nome": "DOM CABRAL"
                },
                {
                    "nome": "ESTEVES"
                },
                {
                    "nome": "ESTIVA"
                },
                {
                    "nome": "FREDERICO OZANAN"
                },
                {
                    "nome": "GERALDO FIRMINO"
                },
                {
                    "nome": "JOAO ALONSO"
                },
                {
                    "nome": "JUCA FIRMINO"
                },
                {
                    "nome": "OLAVO DA AZ"
                },
```

---
## GET — Disponibilidade
*Configuração*

```
GET {{url}}/api/v1/integracao/configuracao/disponibilidade
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse `endpoint` será possível consultar os períodos do dia (disponibilidades) que estão cadastrados dentro do sistema.

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Períodos (Disponibilidade) consultados com sucesso!",
  "periodos": [
    {
      "id_periodo_dia": 1,
      "descricao": "Manhã",
      "hora_inicio": "08:00:00",
      "hora_fim": "12:00:30"
    },
    {
      "id_periodo_dia": 2,
      "descricao": "Tarde",
      "hora_inicio": "12:00:00",
      "hora_fim": "18:00:00"
    },
    {
      "id_periodo_dia": 3,
      "descricao": "Noite",
      "hora_inicio": "18:00:00",
      "hora_fim": "21:00:00"
    }
  ]
}
```

---
## GET — Empresas
*Configuração*

```
GET {{url}}/api/v1/integracao/configuracao/empresa
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse `endpoint` será possível consultar as empresas que estão cadastrados e ativas no sistema.

`OBSERVAÇÃO`: O uso dessa API será muito útil para complementar a API de Adicionar Contratos no Cliente, onde se faz necessário enviar obrigatóriamente o ID da Empresa.

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Empresas consultados com sucesso",
  "empresas": [
    {
      "id_empresa": 37,
      "nome_razaosocial": "HUBSOFT BRASIL LTDA",
      "cnpj": "29507487000185",
      "display": "HUBSOFT BRASIL LTDA (CNPJ: 29.507.487/0001-85)"
    }
  ]
}
```

---
## GET — Grupo de Cliente
*Configuração*

```
GET {{url}}/api/v1/integracao/configuracao/grupo_cliente
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

No método `GET`, irá consultar os dados de grupos de cliente e irá retornar um `JSON` como resposta.

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Dados consultados com sucesso.",
  "grupo_cliente": [
    {
      "id_grupo_cliente": 1,
      "display": "Clientes Empresariais",
      "ativo": true
    },
    {
      "id_grupo_cliente": 2,
      "display": "Clientes Residenciais",
      "ativo": true
    }
  ]
}
```

---
## GET — Grupo de Serviço
*Configuração*

```
GET {{url}}/api/v1/integracao/configuracao/grupo_cliente_servico
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

No método `GET`, irá consultar os dados de grupos de serviço e irá retornar um `JSON` como resposta.

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Dados consultados com sucesso.",
  "grupo_cliente_servico": [
    {
      "id": 1,
      "display": "Residencial",
      "ativo": true
    },
    {
      "id": 2,
      "display": "Serviços Cortesias ",
      "ativo": true
    }
  ]
}
```

---
## GET — Modelos de Contrato
*Configuração*

```
GET {{url}}/api/v1/integracao/configuracao/modelo_contrato
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse `endpoint` será possível consultar os modelos de contratos que estão cadastrados e ativos no sistema.

`OBSERVAÇÃO`: O uso dessa API será muito útil para complementar a API de Adicionar Contratos no Cliente, onde se faz necessário enviar obrigatóriamente o ID do Contrato.

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Modelos de Contratos consultados com sucesso",
    "modelos_contrato": [
        {
            "id_contrato": 10,
            "descricao": "TERMO DE CONTRATAÇÃO E AUTORIZAÇÃO DE DÉBITOS EQUIPAMENTO EM COMODATO",
            "validade": 12,
            "gera_multa": false,
            "valor_multa": null,
            "permite_renovar_vigencia_servico": false,
            "id_empresa": 1,
            "empresa": {
                "id_empresa": 1,
                "nome_razaosocial": "SERVIÇOS DE TECNOLOGIA",
                "cnpj": "36636392000127",
                "display": "SERVIÇOS DE TECNOLOGIA (CNPJ: 36.636.392/0001-27)"
            }
        },
        {
            "id_contrato": 18,
            "descricao": "CONTRATO 1 PROVEINTER",
            "validade": 12,
            "gera_multa": false,
            "valor_multa": null,
            "permite_renovar_vigencia_servico": false,
            "id_empresa": 3,
            "empresa": {
                "id_empresa": 3,
                "nome_razaosocial": "TELECOM E HARDWARE LTDA",
                "cnpj": "09613622000160",
                "display": "TELECOM E HARDWARE LTDA (CNPJ: 09.613.622/0001-60)"
            }
        },
        {
            "id_contrato": 7,
            "descricao": "CONTRATO - ",
            "validade": 12,
            "gera_multa": false,
            "valor_multa": null,
            "permite_renovar_vigencia_servico": false,
```

---
## GET — Motivos de Contratação
*Configuração*

```
GET {{url}}/api/v1/integracao/configuracao/motivo_contratacao
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

No método `GET`, irá consultar os dados dos tipos de serviço e irá retornar um `JSON` como resposta.

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Dados consultados com sucesso",
  "motivos_contratacao": [
    {
      "id_motivo_contratacao": 1,
      "descricao": "Indicação"
    },
    {
      "id_motivo_contratacao": 2,
      "descricao": "Promoção"
    }
  ],
  "encrypted": false
}
```

---
## GET — Origens de Cliente
*Configuração*

```
GET {{url}}/api/v1/integracao/configuracao/origem_cliente
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

No método `GET`, irá consultar os dados de origem de cliente e irá retornar um `JSON` como resposta.

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Dados consultados com sucesso",
  "origens_cliente": [
    {
      "id_origem_cliente": 1,
      "descricao": "Instagram"
    },
    {
      "id_origem_cliente": 2,
      "descricao": "Facebook"
    }
  ],
  "encrypted": false
}
```

---
## GET — Origens de Contato
*Configuração*

```
GET {{url}}/api/v1/integracao/configuracao/origem_contato
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

No método `GET`, irá consultar os dados das origens de contato e irá retornar um `JSON` como resposta.

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Origens Contatos consultados com sucesso!",
  "origem_contatos": [
    {
      "id_origem_contato": 4,
      "descricao": "E-Mail"
    },
    {
      "id_origem_contato": 6,
      "descricao": "Pessoal"
    },
    {
      "id_origem_contato": 5,
      "descricao": "Telefone"
    },
    {
      "id_origem_contato": 3,
      "descricao": "Telegram"
    },
    {
      "id_origem_contato": 2,
      "descricao": "Whatsapp"
    }
  ]
}
```

---
## GET — Pacotes
*Configuração*

```
GET {{url}}/api/v1/integracao/pacote/consultar
```

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `pagina` | `0` |
| `itens_por_pagina` | `20` |

**Descrição:**

**Endpoint (Rota)**

Neste `endpoint`, será possível consultar todos os Pacotes que foram adicionados nos Serviços dos Clientes, obtendo o retorno no formato `JSON` como resposta. Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| pagina | Página a ser exibida | Sim |
| itens_por_pagina | Itens por Página a serem exibidos. Mínimo: 1, Máximo: 500. | Sim |
| data_inicio | Data inicial de referência para consulta de pacotes em um intervalo | Não |
| data_fim | Data final de referência para consulta de pacotes em um intervalo | Não |
| tipo_data | O tipo de data poderá ser: data_cadastro, data_atualizacao, data_limite | Não |
| tipo_busca | O tipo de busca poderá ser: id_pacote ou codigo_pacote | Sim |
| termo_busca | O termo de busca poderá será o código do pacote ou o id do pacote. | Sim |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| pagina | Campo Inteiro (integer) | 0 |
| itens_por_pagina | Campo Inteiro (integer) | 50 |
| data_inicio | Formato date (2024-04-01) | Nenhum |
| data_fim | Formato date (2024-04-30) | Nenhum |
| tipo_data | Texto | data_cadastro |
| termo_busca | Texto | Nenhum |

**Exemplo de resposta — Sucesso**

```json
"status": "success",
    "msg": "Dados consultados com sucesso",
    "paginacao": {
        "primeira_pagina": 0,
        "ultima_pagina": 0,
        "pagina_atual": 0,
        "total_registros": 7
    },
    "pacotes": [
        {
            "id_cliente_servico_pacote": 5315,
            "id_cliente_servico": 17565,
            "id_pacote": 104,
            "valor": "10",
            "descricao": "",
            "data_cadastro": "2022-08-19 09:31:36",
            "deleted_at": null,
            "id_externo": null,
            "status": "aguardando_habilitacao",
            "status_em": null,
            "status_mensagem": null,
            "data_tentativa": null,
            "em_transmissao": false,
            "migrar": false,
            "transmitir": true,
            "data_limite": null,
            "data_atualizacao": "2022-08-19 09:31:36",
            "cliente_servico": [
                {
                    "id_cliente_servico": 17565,
                    "id_cliente": 24928,
                    "id_servico": 2735,
                    "numero_plano": 12,
                    "anotacoes": "TESTE TESTE",
                    "id_cliente_servico_antigo": 17507,
                    "referencia": null,
                    "display": "(12) COMBO 10 MEGA - NOVO",
                    "cliente": {
                        "id_cliente": 24928,
                        "codigo_cliente": 1862,
                        "nome_razaosocial": "DANI
```

---
## GET — Tipos de Serviço
*Configuração*

```
GET {{url}}/api/v1/integracao/configuracao/tipo_servico
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

No método `GET`, irá consultar os dados dos tipos de serviço e irá retornar um `JSON` como resposta.

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Dados consultados com sucesso",
  "tipos_servico": [
    {
      "id_tipo_servico": 3,
      "descricao": "Taxa de Instalação",
      "bloquear": true,
      "display": "Taxa de Instalação"
    },
    {
      "id_tipo_servico": 4,
      "descricao": "Ordem de Serviço",
      "bloquear": true,
      "display": "Ordem de Serviço"
    }
  ],
  "encrypted": false
}
```

---
## GET — Vencimentos
*Configuração*

```
GET {{url}}/api/v1/integracao/configuracao/vencimento
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse `endpoint` será possível consultar os vencimentos que estão cadastrados e ativos no sistema.

`OBSERVAÇÃO`: O uso dessa API será muito útil para complementar a API de Adicionar Prospecto, onde se faz necessário enviar obrigatóriamente o ID do Vencimento caso esteja configurado como obrigatório no formulário de Prospecto do provedor.

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Vencimentos consultados com sucesso",
  "vencimentos": [
    {
      "id_vencimento": 22,
      "dia_vencimento": 1
    },
    {
      "id_vencimento": 61,
      "dia_vencimento": 10
    },
    {
      "id_vencimento": 63,
      "dia_vencimento": 15
    },
    {
      "id_vencimento": 3,
      "dia_vencimento": 20
    },
    {
      "id_vencimento": 168,
      "dia_vencimento": 21
    },
    {
      "id_vencimento": 62,
      "dia_vencimento": 22
    },
    {
      "id_vencimento": 5,
      "dia_vencimento": 23
    },
    {
      "id_vencimento": 4,
      "dia_vencimento": 25
    },
    {
      "id_vencimento": 85,
      "dia_vencimento": 26
    },
    {
      "id_vencimento": 7,
      "dia_vencimento": "ultimo_dia"
    }
  ]
}
```

---
## GET — Vendedores
*Configuração*

```
GET {{url}}/api/v1/integracao/configuracao/vendedor
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse `endpoint` será possível consultar os vendedores que estão cadastrados e ativos no sistema.

`OBSERVAÇÃO`: O uso dessa API será muito útil para complementar a API de Adicionar Prospecto, onde se faz necessário enviar obrigatóriamente o ID do Vendedor caso esteja configurado como obrigatório no formulário de Prospecto do provedor.

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Vendedores consultados com sucesso",
    "vendedores": [
        {
            "id": 7603,
            "name": "(Suporte Hubsoft) Ana Julia"
        },
        {
            "id": 1146,
            "name": "(Suporte Hubsoft) Giovanna Oliveira"
        },
        {
            "id": 7806,
            "name": "(Suporte Hubsoft) Marcelo Araújo"
        },
        {
            "id": 7811,
            "name": "Alexsander"
        },
        {
            "id": 5271,
            "name": "André Junior"
        },
        {
            "id": 4808,
            "name": "André Lehrbach "
        },
        {
            "id": 4806,
            "name": "Andressa "
        },
        {
            "id": 4801,
            "name": "Andressa Vargas"
        },
        {
            "id": 4866,
            "name": "Caíque"
        },
        {
            "id": 4817,
            "name": "Calor Xavier"
        },
        {
            "id": 7805,
            "name": "Camila Melo"
        },
        {
            "id": 4852,
            "name": "Carline "
        },
        {
            "id": 4856,
            "name": "Claudia Maria Moura "
        },
        {
            "id": 4846,
            "name": "Cleyton "
        },
        {
            "id": 4704,
            "name": "Clodoaldo "
        },
        {
            "id": 4837,
            "name": "Dayane Moura "
        },
```

---