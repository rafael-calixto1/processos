# Estoque

**Necessário**

Para fazer requisições nos dados de `Estoque`, é necessário que você já possua o `access_token`, conseguido na etapa `(oAuth)`.

## Local de Estoque

### GET — Listar
*Estoque / Local de Estoque*

```
GET {{url}}/api/v1/integracao/estoque/local_estoque
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
| `relacoes` | `usuarios` |

**Descrição:**

**GET**

No método `GET`, irá consultar/listar os dados de locais de estoque e retornar um `JSON` como resposta. Os dados serão retornados de forma paginada, portanto fique atento ao conjunto da dados "paginacao" que é retornado na resposta, para saber se será necessário consultar outras páginas ou não.

Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| pagina | Página a ser exibida | Sim |
| itens_por_pagina | Itens por Página a serem exibidos. Mínimo: 1, Máximo: 500. | Não |
| relacoes | Carrega os relacionamentos especificados | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| pagina | `Integer` | `NULL` |
| itens_por_pagina | `Integer` | 100 |
| relacoes | usuarios | `NULL` |

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "paginacao": {
        "primeira_pagina": 0,
        "ultima_pagina": 0,
        "pagina_atual": 0,
        "total_registros": 81
    },
    "locais_estoque": [
        {
            "id_local_estoque": 359,
            "data_cadastro": "2024-04-29 08:55:48",
            "descricao": "teste e",
            "empresa": {
                "id_empresa": 167,
                "nome_razaosocial": "EMPRESA TESTE IE",
                "cnpj": "32695028000187"
            },
            "endereco": {
                "endereco": "TANCREDO NEVEZ",
                "numero": "21",
                "complemento": null,
                "referencia": null,
                "bairro": "CENTRO",
                "cidade": "SANTO ANTÔNIO DO MONTE",
                "estado": "MG",
                "pais": "BRASIL",
                "cep": "35560000",
                "ibge": "3160405"
            },
            "usuarios": [
                {
                    "id": 1045,
                    "name": "(Suporte Hubsoft) Bianca Couto",
                    "email": "bianca.couto@hubsoft.com.br"
                },
                {
                    "id": 7878,
                    "name": "Vinicius",
                    "email": "vinicius.aquino@hubsoft.com.br"
                },
                {
                    "id": 7810,
                    "name": "Jaís Oliveira",
                    "email": "jais.oliveira@hubsoft.com.br"
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "Favor preencher os campos obrigatórios de acordo com as especificações",
  "errors": [
    "O campo pagina é obrigatório."
  ]
}
```

---
### GET — Encontrar por ID
*Estoque / Local de Estoque*

```
GET {{url}}/api/v1/integracao/estoque/local_estoque/:id_local_estoque
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `relacoes` | `usuarios` |

**Descrição:**

**GET**

No método `GET`, será possível consultar um produto individualmente. Esse endpoint pode ser útil quando for necessário verificar / sincronizar produto por produto.

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Local de Estoque de ID 145 consultado com sucesso",
    "local_estoque": {
        "id_local_estoque": 145,
        "data_cadastro": "2021-03-03 10:36:52",
        "descricao": "Hubsoft",
        "empresa": {
            "id_empresa": 37,
            "nome_razaosocial": "HUBSOFT BRASIL LTDA",
            "cnpj": "29507487000185"
        },
        "endereco": {
            "endereco": "PRESIDENTE KENNEDY",
            "numero": "380",
            "complemento": null,
            "referencia": null,
            "bairro": "MARIA EDUARDA",
            "cidade": "SÃO JOÃO DO IVAÍ",
            "estado": "PR",
            "pais": "BRASIL",
            "cep": "86930000",
            "ibge": "4125001"
        },
        "usuarios": [
            {
                "id": 4852,
                "name": "Carline ",
                "email": "assisteltelecom@hotmail.com"
            },
            {
                "id": 4864,
                "name": "Lucas ",
                "email": "lucasmarquesbraga10@gmail.com"
            },
            {
                "id": 1053,
                "name": "Rodolfo",
                "email": "rodolfo.ribeiro@navegueazul.com.br"
            },
            {
                "id": 4846,
                "name": "Cleyton ",
                "email": "gestao@minhanova.com"
            },
            {
                "id": 4861,
                "name": "KAIQUE",
                "email": "kaique@seuwifi.com.br"
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "Item de Produto de ID 9999 não encontrado"
}
```

---
## Movimentações de Estoque

Os endpoints abaixo são destinados ao novo módulo de controle de estoque do provedor: **Movimentações de Estoque**.

### Entrada

#### POST — Manual
*Estoque / Movimentações de Estoque / Entrada*

```
POST {{url}}/api/v1/integracao/estoque/movimento_estoque/entrada
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**`POST`**  
Utilizando esse endpoint será possível adicionar produtos a um local de estoque sem a necessidade de gerar uma nova compra dentro do sistema.

**Seria a Entrada Manual do sistema.**

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_local_estoque | ID do Local de Estoque | Sim |
| observacao | Aqui poderá ser preenchido um texto no movimento se necessário | Não |
| produtos | Um objeto que contém os ID's dos produtos, quantidades e/ou patrimônios (Veja abaixo) | Sim |
| produtos.\*.campo_identificacao_patrimonio | Campo de identificação dos patrimônios | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| produtos.\*.campo_identificacao_patrimonio | \- id_produto_item;  <br>\- codigo_item;  <br>\- identificador_proprio;  <br>\- numero_serie;  <br>\- mac_address;  <br>\- epi_ca; | id_produto_item |

Exemplo de obrigatoriedade do objeto **produtos**:

``` json
"produtos": [
  {
    "quantidade": 2,
    "produto": {
      "id_produto": 123
    },
    // Opcional: Utilize caso queira informar outro campo de identificação dos patrimônios.
    "campo_identificacao_patrimonio": "id_produto_item",
    "patrimonios": [
      // Opcional: Utilize este recurso para dar entrada em um patrimônio que foi retirado manualmente do estoque anteriormente.
      {"id_produto_item": 12345},
      {"id_produto_item": 12345},
    ]
  }
]

 ```

**Corpo da requisição (JSON):**

```json
{
  "id_local_estoque": 1,
  "produtos": [
    {
      "quantidade": 1,
      "produto": {
        "id_produto": 1
      }
    }
  ],
  "observacao": "Campo de preenchimento opcional. Aqui poderá ser preenchido um texto longo se necessário"
}
```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Movimento criado com sucesso",
    "movimento_estoque": {
        "id_movimento_estoque": 2928,
        "tipo": "entrada",
        "local_estoque": "ALMOXARIFADO",
        "origem": "",
        "destino": "ALMOXARIFADO",
        "vinculo_origem": [],
        "vinculo_destino": {
            "id_local_estoque": 5,
            "display": "ALMOXARIFADO",
            "tipo_vinculo": "local_estoque"
        },
        "codigo_movimento": "55bac1cf-5d62-4295-bd5f-b4b9be6d6359",
        "data_movimento": "2024-05-20 10:52:56",
        "data_cadastro": "2024-05-20 10:52:56",
        "data_atualizacao": "2024-05-20 10:52:56",
        "valor_total": 1176,
        "observacao": "Campo de preenchimento opcional. Aqui poderá ser preenchido um texto longo se necessário",
        "produtos": [
            {
                "id_movimento_estoque_produto": 4034,
                "id_produto": 3975,
                "produto": "Adaptador multiportas USB-C 7 em 1 da Dell — DA310: 2 Unidade - (UN)",
                "valor": "1176",
                "quantidade": 2,
                "patrimonios": [
                    {
                        "id_produto_item": 242988,
                        "produto": {
                            "id_produto": 3975,
                            "nome": "Adaptador multiportas USB-C 7 em 1 da Dell — DA310",
                            "controle_patrimonial": true,
                            "epi": false
```
**Exemplo de resposta — Entrada de patrimônios que foram retirados manualmente do estoque**

```json
{
    "status": "success",
    "msg": "Movimento criado com sucesso",
    "movimento_estoque": {
        "id_movimento_estoque": 2932,
        "tipo": "entrada",
        "local_estoque": "ALMOXARIFADO",
        "origem": "",
        "destino": "ALMOXARIFADO",
        "vinculo_origem": [],
        "vinculo_destino": {
            "id_local_estoque": 5,
            "display": "ALMOXARIFADO",
            "tipo_vinculo": "local_estoque"
        },
        "codigo_movimento": "84462065-5d55-4561-b136-b2ffc088bdf4",
        "data_movimento": "2024-05-20 11:17:04",
        "data_cadastro": "2024-05-20 11:17:04",
        "data_atualizacao": "2024-05-20 11:17:04",
        "valor_total": 588,
        "observacao": "Campo de preenchimento opcional. Aqui poderá ser preenchido um texto longo se necessário",
        "produtos": [
            {
                "id_movimento_estoque_produto": 4039,
                "id_produto": 3975,
                "produto": "Adaptador multiportas USB-C 7 em 1 da Dell — DA310: 1 Unidade - (UN)",
                "valor": "588",
                "quantidade": 1,
                "patrimonios": [
                    {
                        "id_produto_item": 242991,
                        "produto": {
                            "id_produto": 3975,
                            "nome": "Adaptador multiportas USB-C 7 em 1 da Dell — DA310",
                            "controle_patrimonial": true,
                            "epi": false
```

---
#### POST — Compra
*Estoque / Movimentações de Estoque / Entrada*

```
POST {{url}}/api/v1/integracao/estoque/movimento_estoque/compra
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**`POST`**  
Utilizando esse endpoint será possível adicionar compra no sistema, ao adicionar uma compra, automaticamente será adicionada uma movimentação de entrada com aqueles produtos a um local de estoque.

**Seria a Entrada Manual do sistema.**

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_local_estoque | ID do Local de Estoque | Sim |
| id_status_compra | ID Status da Compra | Sim |
| id_fornecedor | ID do Fornecedor | Sim |
| id_usuario_responsavel | ID do Usuário Reponsável | Sim |
| data_compra | Data Compra | Sim |
| produtos | Um objeto que contém os ID's dos produtos, quantidades e valor unitário | Sim |
| observacao | Aqui poderá ser preenchido um texto no movimento se necessário | Não |

Os atributos podem conter os seguintes valores:

| **Atributo** | **Descrição** | Valor Default |
| --- | --- | --- |
| id_local_estoque | `Inteiro` (Nota 1) | `NULL` |
| id_status_compra | `Inteiro`(Nota 2) | `NULL` |
| id_fornecedor | `Inteiro`(Nota 3) | `NULL` |
| id_usuario_responsavel | `Inteiro` | `NULL` |
| data_compra | `Date (YYYY-MM-DD)` | `NULL` |
| produtos | `Array de Objetos` (Nota 4) | `NULL` |
| observacao | `String` | `NULL` |

**Nota 1:** Para consultar os locais de estoque para encontrar o id_local_estoque, basta utilizar a rota /api/v1/integracao/estoque/local_estoque (Estoque > Local de Estoque)

**Nota 2:** Para consultar os status de compra para encontrar o id_status_compra, basta utilizar a rota /api/v1/integracao/configuracao/status_compra (Configuração > Estoque > Status Compra)

**Nota 3:** Para consultar os fornecedores para encontrar o id_fornecedor, basta utilizar a rota /api/v1/integracao/estoque/fornecedor (Estoque > Fornecedor)

**Nota 4:** Exemplo de obrigatoriedade do objeto **produtos**:

``` json
"produtos": [
  {
    "quantidade": 2,
    "produto": {
      "id_produto": 123
    },
    // Opcional: Utilize caso queira informar o valor unitário diferente do valor compra configurado no produto..
    "valor_unitario": 120.50
  }
]

 ```

**Corpo da requisição (JSON):**

```json
{
  "id_local_estoque": 5,
  "id_status_compra": 7,
  "id_fornecedor": 2935,
  "id_usuario_responsavel": 1045,
  "data_compra": "2025-05-15",
  "produtos": [
    {
      "quantidade": 17,
      "produto": {
        "id_produto": 4946
      },
      "valor_unitario": 15.5
    }
  ],
  "observacao": "Campo de preenchimento opcional. Aqui poderá ser preenchido um texto longo se necessário"
}
```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Movimento criado com sucesso",
    "movimento_estoque": {
        "id_movimento_estoque": 13261,
        "id_ordem_servico": null,
        "tipo": "entrada",
        "id_local_estoque": 5,
        "local_estoque": "ALMOXARIFADO",
        "origem": "Compra #757 (15/05/2025)",
        "destino": "ALMOXARIFADO",
        "vinculo_origem": {
            "id_produto_compra": 2097,
            "display": "#757 15/05/2025",
            "tipo_vinculo": "compra_produto"
        },
        "vinculo_destino": {
            "id_local_estoque": 5,
            "display": "ALMOXARIFADO",
            "tipo_vinculo": "local_estoque"
        },
        "codigo_movimento": "13eedcd5-ce58-4e79-a94c-1940cb08da14",
        "data_movimento": "2025-05-16 17:06:40",
        "data_cadastro": "2025-05-16 17:06:40",
        "data_atualizacao": "2025-05-16 17:06:41",
        "plataforma": "API",
        "valor_total": 263.5,
        "observacao": "compra feita",
        "produtos": [
            {
                "id_movimento_estoque_produto": 9421,
                "id_produto": 4946,
                "produto": "Produto Teste Roteador Wireless Intelbras  : 17 Unidade - (UN)",
                "valor": "263.5",
                "quantidade": 17,
                "patrimonios": [
                    {
                        "id_produto_item": 320443,
                        "codigo_item": 288216,
                        "identificador_proprio": null,
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "Os dados fornecidos são inválidos",
  "errors": [
    "O ID do Fornecedor é obrigatório",
    "O ID do Usuário Responsável é obrigatório",
    "O valor selecionado para o campo produtos.0.produto.id_produto é inválido."
  ]
}
```

---
### Saída

#### POST — Manual
*Estoque / Movimentações de Estoque / Saída*

```
POST {{url}}/api/v1/integracao/estoque/movimento_estoque/saida
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Utilizando esse endpoint será possível dar saida manual nos produtos de um local de estoque.

**Seria a Saída Manual do sistema.**

**Importante:** Caso o produto seja **patrimonial**, é obrigatório passar o array de patrimonios e o objeto de produto_item_status.

**É possível coletar a informação do id_produto_item_status na rota GET configuracao/produto_item_status.**

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| observacao | Aqui poderá ser preenchido um texto no movimento se necessário | Não |
| produtos | Um objeto que contém os ID's dos produtos, quantidades e patrimônios a serem transferidos | Sim |
| produtos.\*.campo_identificacao_patrimonio | Campo de identificação dos patrimônios | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| produtos.\*.campo_identificacao_patrimonio | \- id_produto_item;  <br>\- codigo_item;  <br>\- identificador_proprio;  <br>\- numero_serie;  <br>\- mac_address;  <br>\- epi_ca; | id_produto_item |

**Corpo da requisição (JSON):**

```json
{
  "id_local_estoque": 307,
  "produtos": [
    {
      "quantidade": 2,
      "produto": {
        "id_produto": 3975
      },
      "campo_identificacao_patrimonio": "id_produto_item",
      "patrimonios": [
        {
          "id_produto_item": 234663
        },
        {
          "id_produto_item": 234664
        }
      ],
      "produto_item_status": {
        "id_produto_item_status": 6
      }
    },
    {
      "quantidade": 3,
      "produto": {
        "id_produto": 172
      }
    }
  ],
  "observacao": "Campo de preenchimento opcional. Aqui poderá ser preenchido um texto longo se necessário"
}
```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Movimento criado com sucesso",
    "movimento_estoque": {
        "id_movimento_estoque": 2931,
        "tipo": "saida",
        "local_estoque": "ALMOXARIFADO",
        "origem": "ALMOXARIFADO",
        "destino": "",
        "vinculo_origem": {
            "id_local_estoque": 5,
            "display": "ALMOXARIFADO",
            "tipo_vinculo": "local_estoque"
        },
        "vinculo_destino": [],
        "codigo_movimento": "f8226522-de13-4b74-8d41-296921dee37d",
        "data_movimento": "2024-05-20 11:04:33",
        "data_cadastro": "2024-05-20 11:04:33",
        "data_atualizacao": "2024-05-20 11:04:33",
        "valor_total": 722.2,
        "observacao": "Campo de preenchimento opcional. Aqui poderá ser preenchido um texto longo se necessário",
        "produtos": [
            {
                "id_movimento_estoque_produto": 4037,
                "id_produto": 3975,
                "produto": "Adaptador multiportas USB-C 7 em 1 da Dell — DA310: 1 Unidade - (UN)",
                "valor": "718",
                "quantidade": 1,
                "patrimonios": [
                    {
                        "id_produto_item": 242991,
                        "produto": {
                            "id_produto": 3975,
                            "nome": "Adaptador multiportas USB-C 7 em 1 da Dell — DA310",
                            "controle_patrimonial": true,
                            "epi": false
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "O produto Adaptador multiportas USB-C 7 em 1 da Dell — DA310 (DELL) é do tipo patrimonial, para dar saída manual desse produto, é obrigatório passar um array com os patrimonios"
}
```

---
#### POST — Produtos com Usuários
*Estoque / Movimentações de Estoque / Saída*

```
POST {{url}}/api/v1/integracao/estoque/movimento_estoque/saida/usuario
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**`POST`**

No endpoint de **Saída Produto para Usuário**, será possível mover produtos de um local de estoque para o usuário.

**Importante:** Caso o produto seja **patrimonial**, é obrigatório passar o array de patrimonios.

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_local_estoque | ID do Local de Estoque de saída do produto | Sim |
| id_usuario | ID do Usuário de Destino | Sim |
| tipo_utilizacao | Tipo de utilização que o usuário irá fazer do produto | Sim |
| solicitar_confirmacao | Se é necessário que o usuário confirme o recebimento dos produtos | Sim |
| observacao | Aqui poderá ser preenchido um texto no movimento se necessário | Não |
| produtos | Um objeto que contém os ID's dos produtos, quantidades e patrimônios a serem transferidos | Sim |
| produtos.\*.campo_identificacao_patrimonio | Campo de identificação dos patrimônios | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| tipo_utilizacao | \- Utilização própria: `uso_proprio`  <br>\- Utilização no cliente: `cliente_servico`  <br>\- Equipamento de Proteção Individual: `epi` | Nenhum |
| solicitar_confirmacao | Booleano: `true` ou `false` | Nenhum |
| produtos.\*.campo_identificacao_patrimonio | \- id_produto_item;  <br>\- codigo_item;  <br>\- identificador_proprio;  <br>\- numero_serie;  <br>\- mac_address;  <br>\- epi_ca; | id_produto_item |

**Corpo da requisição (JSON):**

```json
{
  "id_local_estoque": 9,
  "id_usuario": 7603,
  "tipo_utilizacao": "cliente_servico",
  "solicitar_confirmacao": false,
  "produtos": [
    {
      "id_produto": 672,
      "quantidade": 2,
      "campo_identificacao_patrimonio": "id_produto_item",
      "patrimonios": [
        {
          "id_produto_item": 136544
        },
        {
          "id_produto_item": 136543
        }
      ]
    },
    {
      "id_produto": 131,
      "quantidade": 40
    }
  ],
  "observacao": "Campo de preenchimento opcional. Aqui poderá ser preenchido um texto longo se necessário"
}
```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Movimento criado com sucesso",
    "movimento_estoque": {
        "id_movimento_estoque": 2950,
        "tipo": "saida",
        "local_estoque": "HUBSOFT",
        "origem": "HUBSOFT",
        "destino": "Ana Julia Cabral",
        "vinculo_origem": {
            "id_local_estoque": 9,
            "display": "HUBSOFT",
            "tipo_vinculo": "local_estoque"
        },
        "vinculo_destino": {
            "id_usuario": 7603,
            "nome": "Ana Julia Cabral",
            "email": "anajulia.cabral@api.com.br",
            "tipo_vinculo": "usuario"
        },
        "codigo_movimento": "b936360f-a1d1-4760-a51a-418810bb3012",
        "data_movimento": "2024-05-13 11:14:50",
        "data_cadastro": "2024-05-13 11:14:50",
        "data_atualizacao": "2024-05-13 11:14:51",
        "valor_total": 1559.405,
        "observacao": "Campo de preenchimento opcional. Aqui poderá ser preenchido um texto longo se necessário",
        "produtos": [
            {
                "id_movimento_estoque_produto": 4018,
                "id_produto": 131,
                "produto": "CABO DE 30 VOLTS: 40 Kilograma - (kg)",
                "valor": "200",
                "quantidade": 40,
                "patrimonios": []
            },
            {
                "id_movimento_estoque_produto": 4017,
                "id_produto": 672,
                "produto": "Roteador Gamer Wireless ASUS RT-AC86U: 1 Unidade - (UN)",
                "valor"
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "O patrimônio com ID \"136545\" não se contra mais disponível para movimentar"
}
```

---
#### POST — POP de Conexão
*Estoque / Movimentações de Estoque / Saída*

```
POST {{url}}/api/v1/integracao/estoque/movimento_estoque/saida/pop_conexao
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**`POST`**

No endpoint de **Saída para POP de Conexão**, será possível mover produtos de um local de estoque para o POP de Conexão.

**Importante:** Caso o produto seja **patrimonial**, é obrigatório passar o array de patrimonios.

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_pop | ID do POP de Conexão de Destino | Sim |
| id_local_estoque | ID do Local de Estoque de saída do produto | Sim |
| observacao | Aqui poderá ser preenchido um texto no movimento se necessário | Não |
| produtos | Um objeto que contém os ID's dos produtos, quantidades e patrimônios a serem transferidos | Sim |
| produtos.\*.campo_identificacao_patrimonio | Campo de identificação dos patrimônios | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| produtos.\*.campo_identificacao_patrimonio | \- id_produto_item;  <br>\- codigo_item;  <br>\- identificador_proprio;  <br>\- numero_serie;  <br>\- mac_address;  <br>\- epi_ca; | id_produto_item |

**Corpo da requisição (JSON):**

```json
{
  "id_pop": 97,
  "id_local_estoque": 5,
  "produtos": [
    {
      "id_produto": 672,
      "quantidade": 1,
      "campo_identificacao_patrimonio": "id_produto_item",
      "patrimonios": [
        {
          "id_produto_item": 153481
        }
      ]
    }
  ],
  "observacao": "Campo de preenchimento opcional. Aqui poderá ser preenchido um texto longo se necessário"
}
```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Movimento criado com sucesso",
    "movimento_estoque": {
        "id_movimento_estoque": 3473,
        "tipo": "saida",
        "id_local_estoque": 5,
        "local_estoque": "ALMOXARIFADO",
        "origem": "ALMOXARIFADO",
        "destino": "CPD-SANTA-MARIA TESTE",
        "vinculo_origem": {
            "id_local_estoque": 5,
            "display": "ALMOXARIFADO",
            "tipo_vinculo": "local_estoque"
        },
        "vinculo_destino": {
            "id_pop": 97,
            "display": "CPD-SANTA-MARIA TESTE",
            "tipo_vinculo": "pop_conexao"
        },
        "codigo_movimento": "2d8c3141-5eee-4a16-8a61-3d540adc3297",
        "data_movimento": "2024-06-20 08:48:03",
        "data_cadastro": "2024-06-20 08:48:03",
        "data_atualizacao": "2024-06-20 08:48:03",
        "valor_total": 1359.405,
        "observacao": "Campo de preenchimento opcional. Aqui poderá ser preenchido um texto longo se necessário",
        "produtos": [
            {
                "id_movimento_estoque_produto": 4630,
                "id_produto": 672,
                "produto": "Roteador Gamer Wireless ASUS RT-AC86U: 1 Unidade - (UN)",
                "valor": "1359.405",
                "quantidade": 1,
                "patrimonios": [
                    {
                        "id_produto_item": 153481,
                        "produto": {
                            "id_produto": 672,
                            "nome": "Rotead
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "O patrimônio com ID \"153481\" não se contra mais disponível para movimentar"
}
```

---
#### POST — Projeto de Mapeamento
*Estoque / Movimentações de Estoque / Saída*

```
POST {{url}}/api/v1/integracao/estoque/movimento_estoque/saida/projeto_mapeamento
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**`POST`**

No endpoint de **Saída para Projeto de Mapeamento**, será possível mover produtos de um local de estoque para o Projeto de Mapeamento.

**Importante:** Caso o produto seja **patrimonial**, é obrigatório passar o array de patrimonios.

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_mapeamento_projeto | ID do Projeto de Mapeamento de Destino | Sim |
| id_local_estoque | ID do Local de Estoque de saída do produto | Sim |
| observacao | Aqui poderá ser preenchido um texto no movimento se necessário | Não |
| produtos | Um objeto que contém os ID's dos produtos, quantidades e patrimônios a serem transferidos | Sim |
| produtos.\*.campo_identificacao_patrimonio | Campo de identificação dos patrimônios | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| produtos.\*.campo_identificacao_patrimonio | \- id_produto_item;  <br>\- codigo_item;  <br>\- identificador_proprio;  <br>\- numero_serie;  <br>\- mac_address;  <br>\- epi_ca; | id_produto_item |

**Corpo da requisição (JSON):**

```json
{
  "id_mapeamento_projeto": 33,
  "id_local_estoque": 5,
  "produtos": [
    {
      "id_produto": 4074,
      "quantidade": 1,
      "campo_identificacao_patrimonio": "id_produto_item",
      "patrimonios": [
        {
          "id_produto_item": 61892
        }
      ]
    }
  ],
  "observacao": "Campo de preenchimento opcional. Aqui poderá ser preenchido um texto longo se necessário"
}
```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Movimento criado com sucesso",
    "movimento_estoque": {
        "id_movimento_estoque": 3476,
        "tipo": "saida",
        "id_local_estoque": 5,
        "local_estoque": "ALMOXARIFADO",
        "origem": "ALMOXARIFADO",
        "destino": "Rede - Santo Antonio do Monte",
        "vinculo_origem": {
            "id_local_estoque": 5,
            "display": "ALMOXARIFADO",
            "tipo_vinculo": "local_estoque"
        },
        "vinculo_destino": {
            "id_vinculo": 33,
            "id_mapeamento_projeto": 33,
            "display": "Rede - Santo Antonio do Monte",
            "tipo_vinculo": "projeto_mapeamento"
        },
        "codigo_movimento": "ab30accd-4f01-4296-9bd5-d877fe53e6cd",
        "data_movimento": "2024-06-20 08:57:46",
        "data_cadastro": "2024-06-20 08:57:46",
        "data_atualizacao": "2024-06-20 08:57:46",
        "valor_total": 150,
        "observacao": "Campo de preenchimento opcional. Aqui poderá ser preenchido um texto longo se necessário",
        "produtos": [
            {
                "id_movimento_estoque_produto": 4633,
                "id_produto": 4074,
                "produto": "roteador: 1 Unidade - (UN)",
                "valor": "150",
                "quantidade": 1,
                "patrimonios": [
                    {
                        "id_produto_item": 61892,
                        "produto": {
                            "id_produto": 4074,
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "O patrimônio com ID \"61892\" não se contra mais disponível para movimentar"
}
```

---
#### POST — Serviço do Cliente
*Estoque / Movimentações de Estoque / Saída*

```
POST {{url}}/api/v1/integracao/estoque/movimento_estoque/saida/cliente_servico
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**`POST`**

No endpoint de **Saída para Serviço do Cliente**, será possível mover produtos de um local de estoque para o serviço do cliente.

**Importante:** Caso o produto seja **patrimonial**, é obrigatório passar o array de patrimonios.

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_cliente_servico | ID do Serviço de Destino do Cliente | Sim |
| id_tipo_movimento_estoque | ID do Tipo de Movimento de Estoque | Sim |
| id_local_estoque | ID do Local de Estoque de saída do produto | Sim |
| observacao | Aqui poderá ser preenchido um texto no movimento se necessário | Não |
| produtos | Um objeto que contém os ID's dos produtos, quantidades e patrimônios a serem transferidos | Sim |
| produtos.\*.campo_identificacao_patrimonio | Campo de identificação dos patrimônios | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_tipo_movimento_estoque | Tipo de Movimento de Estoque que vai ser vinculado ao Movimento de Estoque | Nenhum |
| produtos.\*.campo_identificacao_patrimonio | \- id_produto_item;  <br>\- codigo_item;  <br>\- identificador_proprio;  <br>\- numero_serie;  <br>\- mac_address;  <br>\- epi_ca; | id_produto_item |

**Corpo da requisição (JSON):**

```json
{
  "id_cliente_servico": 17952,
  "id_tipo_movimento_estoque": 6,
  "id_local_estoque": 5,
  "produtos": [
    {
      "id_produto": 672,
      "quantidade": 1,
      "campo_identificacao_patrimonio": "id_produto_item",
      "patrimonios": [
        {
          "id_produto_item": 153480
        }
      ]
    },
    {
      "id_produto": 131,
      "quantidade": 40
    }
  ],
  "observacao": "Campo de preenchimento opcional. Aqui poderá ser preenchido um texto longo se necessário"
}
```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Movimento criado com sucesso",
    "movimento_estoque": {
        "id_movimento_estoque": 3472,
        "tipo": "saida",
        "id_local_estoque": 5,
        "local_estoque": "ALMOXARIFADO",
        "origem": "ALMOXARIFADO",
        "destino": "(1484) CHESTER BENNINGTON - (28) COMBO 10 MEGA - NOVO",
        "vinculo_origem": {
            "id_local_estoque": 5,
            "display": "ALMOXARIFADO",
            "tipo_vinculo": "local_estoque"
        },
        "vinculo_destino": {
            "id_cliente_servico": 17952,
            "display": "(28) COMBO 10 MEGA - NOVO",
            "numero_plano": 28,
            "cliente": {
                "id_cliente": 24035,
                "nome_razaosocial": "CHESTER BENNINGTON",
                "cpf_cnpj": "67131260000177"
            },
            "tipo_vinculo": "servico_cliente"
        },
        "codigo_movimento": "fd2ef32c-a5ac-49ac-a7fa-8116b5a73b7c",
        "data_movimento": "2024-06-19 17:39:58",
        "data_cadastro": "2024-06-19 17:39:58",
        "data_atualizacao": "2024-06-19 17:39:58",
        "valor_total": 1364.405,
        "observacao": "Campo de preenchimento opcional. Aqui poderá ser preenchido um texto longo se necessário",
        "produtos": [
            {
                "id_movimento_estoque_produto": 4628,
                "id_produto": 672,
                "produto": "Roteador Gamer Wireless ASUS RT-AC86U: 1 Unidade - (UN)",
                "valor": "1359.405",
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "O patrimônio com ID \"153480\" não se contra mais disponível para movimentar"
}
```

---
### Transferência

#### POST — Entre Estoques
*Estoque / Movimentações de Estoque / Transferência*

```
POST {{url}}/api/v1/integracao/estoque/movimento_estoque/transferencia
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**`POST`**

No endpoint de **Transferência entre Estoque**, será possível mover produtos de um local de estoque para outro. É possível realizar transferências tanto entre estoques da mesma empresa quanto entre estoques de empresas diferentes.

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_local_estoque_origem | ID do Local de Estoque de Origem | Sim |
| id_local_estoque_destino | ID do Local de Estoque de Destino | Sim |
| observacao | Aqui poderá ser preenchido um texto no movimento se necessário | Não |
| produtos | Um objeto que contém os ID's dos produtos, quantidades e patrimônios a serem transferidos | (Veja abaixo) |
| produtos.\*.campo_identificacao_patrimonio | Campo de identificação dos patrimônios | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| produtos.\*.campo_identificacao_patrimonio | \- id_produto_item;  <br>\- codigo_item;  <br>\- identificador_proprio;  <br>\- numero_serie;  <br>\- mac_address;  <br>\- epi_ca; | id_produto_item |

Exemplo de obrigatoriedade do objeto **produtos**:

``` json
"produtos": [{
    "quantidade": 10 // Obrigatório,
    "produto": {
        "id_produto": 1 // Obrigatório
    },
    "patrimonios": [{ // Obrigatório se, o produto em questão estiver com o "Controle Patrimonial" habilitado no sistema
        "id_produto_item": 2
    }]
}]

 ```

**Corpo da requisição (JSON):**

```json
{
  "id_local_estoque_origem": 2,
  "id_local_estoque_destino": 43,
  "produtos": [
    {
      "quantidade": 1,
      "produto": {
        "id_produto": 1
      },
      "campo_identificacao_patrimonio": "id_produto_item",
      "patrimonios": [
        {
          "id_produto_item": 126543
        }
      ]
    }
  ]
}
```

**Exemplo de resposta — Sucesso - Entre Mesma Empresa** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Transferência realizada com sucesso",
    "movimentos_estoque": {
        "saida": {
            "id_movimento_estoque": 3369,
            "tipo": "saida",
            "id_local_estoque": 5,
            "local_estoque": "ALMOXARIFADO",
            "origem": "ALMOXARIFADO",
            "destino": "Hubsoft",
            "vinculo_origem": {
                "id_local_estoque": 5,
                "display": "ALMOXARIFADO",
                "tipo_vinculo": "local_estoque"
            },
            "vinculo_destino": {
                "id_local_estoque": 145,
                "display": "Hubsoft",
                "tipo_vinculo": "local_estoque"
            },
            "codigo_movimento": "6fd3a9c7-50c4-40c7-a59c-cbe0816d2ce0",
            "data_movimento": "2024-05-29 15:42:54",
            "data_cadastro": "2024-05-29 15:42:54",
            "data_atualizacao": "2024-05-29 15:42:55",
            "valor_total": 4.35,
            "observacao": null,
            "produtos": [
                {
                    "id_movimento_estoque_produto": 4507,
                    "id_produto": 3897,
                    "produto": "AA CABO DE REDE CAT 5E: 1 Unidade - (UN)",
                    "valor": "4.35",
                    "quantidade": 1,
                    "patrimonios": []
                }
            ],
            "tipo_movimento_estoque": {
                "id_tipo_movimento_estoque": 12,
                "nome": "Transferência",
```
**Exemplo de resposta — Sucesso - Entre Diferentes Empresa** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Transferência realizada com sucesso",
    "movimentos_estoque": {
        "saida": {
            "id_movimento_estoque": 4148,
            "id_ordem_servico": null,
            "tipo": "saida",
            "id_local_estoque": 5,
            "local_estoque": "ALMOXARIFADO",
            "origem": "ALMOXARIFADO",
            "destino": "Almoxarifado TESTE",
            "vinculo_origem": {
                "id_local_estoque": 5,
                "display": "ALMOXARIFADO",
                "tipo_vinculo": "local_estoque"
            },
            "vinculo_destino": {
                "id_local_estoque": 39,
                "display": "Almoxarifado TESTE",
                "tipo_vinculo": "local_estoque"
            },
            "codigo_movimento": "1039fc38-50ea-4e9a-967b-964ad336e22a",
            "data_movimento": "2024-10-01 10:43:23",
            "data_cadastro": "2024-10-01 10:43:23",
            "data_atualizacao": "2024-10-01 10:43:23",
            "plataforma": "API",
            "valor_total": 99.9,
            "observacao": null,
            "produtos": [
                {
                    "id_movimento_estoque_produto": 5068,
                    "id_produto": 69,
                    "produto": "ROTEADOR INTELBRAS Ac1200: 1 Unidade - (UN)",
                    "valor": "99.9",
                    "quantidade": 1,
                    "patrimonios": [
                        {
                            "id_produto_item": 16260,
```

---
### Retorno Estoque

#### POST — Produtos com Usuários
*Estoque / Movimentações de Estoque / Retorno Estoque*

```
POST {{url}}/api/v1/integracao/estoque/movimento_estoque/retorno_estoque/usuario
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**`POST`**

No endpoint de **Retorno ao Estoque de Produtos com Usuário**, será possível retornar produtos vinculados ao usuário para o local de estoque.

**Importante:** Caso o produto seja **patrimonial**, é obrigatório passar o array de patrimonios.

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_usuario | ID do Usuário de Origem | Sim |
| tipo_utilizacao | Tipo de utilização do produto com o usuário | Sim |
| id_local_estoque_retorno | ID do Local de Estoque para onde os produtos iram retornar | Sim |
| observacao | Aqui poderá ser preenchido um texto no movimento se necessário | Não |
| produtos | Um objeto que contém os ID's dos produtos, quantidades e patrimônios a serem transferidos | Sim |
| produtos.\*.campo_identificacao_patrimonio | Campo de identificação dos patrimônios | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| tipo_utilizacao | \- Utilização própria: `uso_proprio`  <br>\- Utilização no cliente: `cliente_servico`  <br>\- Equipamento de Proteção Individual: `epi`  <br>\- Retirados: `retirado` | Nenhum |
| id_local_estoque_retorno | Todos os produtos serão retornados para o mesmo local de estoque, devendo ser o estoque da mesma empresa dos produtos | Caso não seja informado, vai retornar para o local de estoque em que deu saída |
| produtos.\*.campo_identificacao_patrimonio | \- id_produto_item;  <br>\- codigo_item;  <br>\- identificador_proprio;  <br>\- numero_serie;  <br>\- mac_address;  <br>\- epi_ca; | id_produto_item |

Exemplo de obrigatoriedade do objeto **produtos**:

``` json
"produtos": [
  {
    // Local de Estoque vinculado ao produto_usuario
    "id_local_estoque": 8,
    "id_produto": 123,
    "quantidade": 2,
    // Opcional: Utilize caso queira informar outro campo de identificação dos patrimônios.
    "campo_identificacao_patrimonio": "id_produto_item",
    // Utilize este recurso quando o produto for do tipo patrimonial.
    "patrimonios": [
      {"id_produto_item": 12345},
      {"id_produto_item": 12345},
    ]
  }
]

 ```

**Corpo da requisição (JSON):**

```json
{
  "id_usuario": 4904,
  "tipo_utilizacao": "retirado",
  "produtos": [
    {
      "id_local_estoque": 8,
      "id_produto": 4074,
      "quantidade": 1,
      "campo_identificacao_patrimonio": "id_produto_item",
      "patrimonios": [
        {
          "id_produto_item": 18824
        }
      ]
    },
    {
      "id_local_estoque": 5,
      "id_produto": 162,
      "quantidade": 1
    }
  ],
  "observacao": "Campo de preenchimento opcional. Aqui poderá ser preenchido um texto longo se necessário"
}
```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Movimento de retorno criado com sucesso",
    "movimentos_estoque": [
        {
            "id_movimento_estoque": 3459,
            "tipo": "entrada",
            "id_local_estoque": 8,
            "local_estoque": "ESTOQUE TESTE 12",
            "origem": "Suporte Hubsoft",
            "destino": "ESTOQUE TESTE 12",
            "vinculo_origem": {
                "id_usuario": 4904,
                "display": "Suporte Hubsoft",
                "email": "suporte.hubsoft@hubsoft.com.br",
                "tipo_vinculo": "usuario"
            },
            "vinculo_destino": {
                "id_local_estoque": 8,
                "display": "ESTOQUE TESTE 12",
                "tipo_vinculo": "local_estoque"
            },
            "codigo_movimento": "4732ca37-2cf5-47d0-adbd-9fdf761f11c5",
            "data_movimento": {
                "date": "2024-06-19 16:46:10.998861",
                "timezone_type": 3,
                "timezone": "America/Recife"
            },
            "data_cadastro": "2024-06-19 16:46:11",
            "data_atualizacao": "2024-06-19 16:46:11",
            "valor_total": 150,
            "observacao": "Campo de preenchimento opcional. Aqui poderá ser preenchido um texto longo se necessário",
            "produtos": [
                {
                    "id_movimento_estoque_produto": 4614,
                    "id_produto": 4074,
                    "produto": "roteador: 1 Unidade - (UN)",
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "Os produtos não foi encontrado com sua origem!",
  "errors": [
    {
      "id_usuario": 4904,
      "id_produto": 162,
      "id_local_estoque": 10,
      "tipo_utilizacao": "retirado",
      "quantidade": 1,
      "patrimonios": []
    }
  ]
}
```

---
#### POST — POP de Conexão
*Estoque / Movimentações de Estoque / Retorno Estoque*

```
POST {{url}}/api/v1/integracao/estoque/movimento_estoque/retorno_estoque/pop_conexao
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**`POST`**

No endpoint de **Retorno ao Estoque de Produtos com POP de Conexão**, será possível retornar produtos vinculados aos POP's para o local de estoque.

**Importante:** Caso o produto seja **patrimonial**, é obrigatório passar o array de patrimonios.

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_pop | ID do POP de Conexão de Origem | Sim |
| id_local_estoque_retorno | ID do Local de Estoque para onde os produtos iram retornar | Sim |
| observacao | Aqui poderá ser preenchido um texto no movimento se necessário | Não |
| produtos | Um objeto que contém os ID's dos produtos, quantidades e patrimônios a serem transferidos | Sim |
| produtos.\*.campo_identificacao_patrimonio | Campo de identificação dos patrimônios | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_local_estoque_retorno | Todos os produtos serão retornados para o mesmo local de estoque, devendo ser o estoque da mesma empresa dos produtos | Caso não seja informado, vai retornar para o local de estoque em que deu saída |
| produtos.\*.campo_identificacao_patrimonio | \- id_produto_item;  <br>\- codigo_item;  <br>\- identificador_proprio;  <br>\- numero_serie;  <br>\- mac_address;  <br>\- epi_ca; | id_produto_item |

Exemplo de obrigatoriedade do objeto **produtos**:

``` json
"produtos": [
  {
    // Local de Estoque vinculado ao produto_pop
    "id_local_estoque": 8,
    "id_produto": 123,
    "quantidade": 2,
    // Opcional: Utilize caso queira informar outro campo de identificação dos patrimônios.
    "campo_identificacao_patrimonio": "id_produto_item",
    // Utilize este recurso quando o produto for do tipo patrimonial.
    "patrimonios": [
      {"id_produto_item": 12345},
      {"id_produto_item": 12345},
    ]
  }
]

 ```

**Corpo da requisição (JSON):**

```json
{
  "id_pop": 72,
  "produtos": [
    {
      "id_local_estoque": 12,
      "id_produto": 166,
      "quantidade": 1,
      "campo_identificacao_patrimonio": "id_produto_item",
      "patrimonios": [
        {
          "id_produto_item": 94877
        }
      ]
    }
  ],
  "observacao": "Campo de preenchimento opcional. Aqui poderá ser preenchido um texto longo se necessário"
}
```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Movimento de retorno criado com sucesso",
    "movimentos_estoque": {
        "id_movimento_estoque": 3466,
        "tipo": "entrada",
        "id_local_estoque": 12,
        "local_estoque": "Estoque teste",
        "origem": "PONTO 3",
        "destino": "Estoque teste",
        "vinculo_origem": {
            "id_pop": 72,
            "display": "PONTO 3",
            "tipo_vinculo": "pop_conexao"
        },
        "vinculo_destino": {
            "id_local_estoque": 12,
            "display": "Estoque teste",
            "tipo_vinculo": "local_estoque"
        },
        "codigo_movimento": "9b0fad0b-4cbb-44b0-bd22-fc65bb06eb2d",
        "data_movimento": {
            "date": "2024-06-19 17:06:29.769754",
            "timezone_type": 3,
            "timezone": "America/Recife"
        },
        "data_cadastro": "2024-06-19 17:06:29",
        "data_atualizacao": "2024-06-19 17:06:29",
        "valor_total": 29712.09,
        "observacao": "Campo de preenchimento opcional. Aqui poderá ser preenchido um texto longo se necessário",
        "produtos": [
            {
                "id_movimento_estoque_produto": 4621,
                "id_produto": 166,
                "produto": "COMUT.PACOTE REDE-SWITCH: 1 Unidade - (UN)",
                "valor": "29712.09",
                "quantidade": 1,
                "patrimonios": [
                    {
                        "id_produto_item": 94877,
                        "produto": {
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "Nenhum produto foi encontrado. Por favor, verifique se os dados fornecidos estão corretos",
  "errors": []
}
```

---
#### POST — Projeto de Mapeamento
*Estoque / Movimentações de Estoque / Retorno Estoque*

```
POST {{url}}/api/v1/integracao/estoque/movimento_estoque/retorno_estoque/projeto_mapeamento
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**`POST`**

No endpoint de **Retorno ao Estoque de Produtos com Projeto de Mapeamento**, será possível retornar produtos vinculados aos Projetos de Mapeamento para o local de estoque.

**Importante:** Caso o produto seja **patrimonial**, é obrigatório passar o array de patrimonios.

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_mapeamento_projeto | ID do Projeto de Mapeamento de Origem | Sim |
| id_local_estoque_retorno | ID do Local de Estoque para onde os produtos iram retornar | Sim |
| observacao | Aqui poderá ser preenchido um texto no movimento se necessário | Não |
| produtos | Um objeto que contém os ID's dos produtos, quantidades e patrimônios a serem transferidos | Sim |
| produtos.\*.campo_identificacao_patrimonio | Um objeto que contém os ID's dos produtos, quantidades e patrimônios a serem transferidos | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_local_estoque_retorno | Todos os produtos serão retornados para o mesmo local de estoque, devendo ser o estoque da mesma empresa dos produtos | Caso não seja informado, vai retornar para o local de estoque em que deu saída |
| produtos.\*.campo_identificacao_patrimonio | \- id_produto_item;  <br>\- codigo_item;  <br>\- identificador_proprio;  <br>\- numero_serie;  <br>\- mac_address;  <br>\- epi_ca; | id_produto_item |

Exemplo de obrigatoriedade do objeto **produtos**:

``` json
"produtos": [
  {
    // Local de Estoque vinculado ao produto_mapeamento_projeto
    "id_local_estoque": 8,
    "id_produto": 123,
    "quantidade": 2,
    // Utilize este recurso quando o produto for do tipo patrimonial.
    "patrimonios": [
      {"id_produto_item": 12345},
      {"id_produto_item": 12345},
    ]
  }
]

 ```

**Corpo da requisição (JSON):**

```json
{
  "id_mapeamento_projeto": 290,
  "produtos": [
    {
      "id_local_estoque": 12,
      "id_produto": 156,
      "quantidade": 4
    }
  ],
  "observacao": "Campo de preenchimento opcional. Aqui poderá ser preenchido um texto longo se necessário"
}
```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Movimento de retorno criado com sucesso",
    "movimentos_estoque": {
        "id_movimento_estoque": 3467,
        "tipo": "entrada",
        "id_local_estoque": 12,
        "local_estoque": "Estoque teste",
        "origem": "Teste Projeto",
        "destino": "Estoque teste",
        "vinculo_origem": {
            "id_vinculo": 290,
            "id_mapeamento_projeto": 290,
            "display": "Teste Projeto",
            "tipo_vinculo": "projeto_mapeamento"
        },
        "vinculo_destino": {
            "id_local_estoque": 12,
            "display": "Estoque teste",
            "tipo_vinculo": "local_estoque"
        },
        "codigo_movimento": "c917d4d4-0e59-4dba-92e9-fa1d6a951392",
        "data_movimento": {
            "date": "2024-06-19 17:16:58.167385",
            "timezone_type": 3,
            "timezone": "America/Recife"
        },
        "data_cadastro": "2024-06-19 17:16:58",
        "data_atualizacao": "2024-06-19 17:16:58",
        "valor_total": 63.6,
        "observacao": "Campo de preenchimento opcional. Aqui poderá ser preenchido um texto longo se necessário",
        "produtos": [
            {
                "id_movimento_estoque_produto": 4622,
                "id_produto": 156,
                "produto": "CABO OPTICO : 4 Metro - (m)",
                "valor": "63.6",
                "quantidade": 4,
                "patrimonios": []
            }
        ],
        "tipo_movimento_estoque": {
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "Nenhum produto foi encontrado. Por favor, verifique se os dados fornecidos estão corretos",
  "errors": []
}
```

---
#### POST — Serviço do Cliente
*Estoque / Movimentações de Estoque / Retorno Estoque*

```
POST {{url}}/api/v1/integracao/estoque/movimento_estoque/retorno_estoque/cliente_servico
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**`POST`**

No endpoint de **Retorno ao Estoque de Produtos com Serviço do Cliente**, será possível retornar produtos vinculados ao serviço do cliente para o local de estoque.

**Importante:** Caso o produto seja **patrimonial**, é obrigatório passar o array de patrimonios.

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_cliente_servico | ID do Serviço do Cliente de Origem | Sim |
| id_tipo_movimento_estoque | ID do Tipo de Movimento de Estoque que vai ser vinculado o Movimento de Retorno | Não |
| id_local_estoque_retorno | ID do Local de Estoque para onde os produtos iram retornar | Sim |
| observacao | Aqui poderá ser preenchido um texto no movimento se necessário | Não |
| produtos | Um objeto que contém os ID's dos produtos, quantidades e patrimônios a serem transferidos | Sim |
| produtos.\*.campo_identificacao_patrimonio | Campo de identificação dos patrimônios | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_tipo_movimento_estoque | Tipo de Movimento de Estoque que vai ser vinculado o Movimento de Retorno | Caso não seja informado, vai ser utilização o tipo de movimento padão (Retorno ao Estoque) |
| id_local_estoque_retorno | Todos os produtos serão retornados para o mesmo local de estoque, devendo ser o estoque da mesma empresa dos produtos | Caso não seja informado, vai retornar para o local de estoque em que deu saída |
| produtos.\*.campo_identificacao_patrimonio | \- id_produto_item;  <br>\- codigo_item;  <br>\- identificador_proprio;  <br>\- numero_serie;  <br>\- mac_address;  <br>\- epi_ca; | id_produto_item |

Exemplo de obrigatoriedade do objeto **produtos**:

``` json
"produtos": [
  {
    // Local de Estoque vinculado ao produto_cliente_servico
    "id_local_estoque": 8,
    // Produto Item Status vinculado ao produto_cliente_servico
    "id_produto_item_status": 1,
    "id_produto": 123,
    "quantidade": 2,
    // Utilize este recurso quando o produto for do tipo patrimonial.
    "patrimonios": [
      {"id_produto_item": 12345},
      {"id_produto_item": 12345},
    ]
  }
]

 ```

**Corpo da requisição (JSON):**

```json
{
  "id_cliente_servico": 17952,
  "produtos": [
    {
      "id_local_estoque": 5,
      "id_produto_item_status": 1,
      "id_produto": 180,
      "quantidade": 1,
      "campo_identificacao_patrimonio": "id_produto_item",
      "patrimonios": [
        {
          "id_produto_item": 100980
        }
      ]
    },
    {
      "id_local_estoque": 5,
      "id_produto_item_status": 1,
      "id_produto": 672,
      "quantidade": 1,
      "campo_identificacao_patrimonio": "id_produto_item",
      "patrimonios": [
        {
          "id_produto_item": 153480
        }
      ]
    }
  ],
  "observacao": "Campo de preenchimento opcional. Aqui poderá ser preenchido um texto longo se necessário"
}
```

**Exemplo de resposta — Sucesso - Exemplo 1** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Movimento de retorno criado com sucesso",
    "movimentos_estoque": [
        {
            "id_movimento_estoque": 3469,
            "tipo": "entrada",
            "id_local_estoque": 5,
            "local_estoque": "ALMOXARIFADO",
            "origem": "(1484) CHESTER BENNINGTON - (28) COMBO 10 MEGA - NOVO",
            "destino": "ALMOXARIFADO",
            "vinculo_origem": {
                "id_cliente_servico": 17952,
                "display": "(28) COMBO 10 MEGA - NOVO",
                "numero_plano": 28,
                "cliente": {
                    "id_cliente": 24035,
                    "nome_razaosocial": "CHESTER BENNINGTON",
                    "cpf_cnpj": "67131260000177"
                },
                "tipo_vinculo": "servico_cliente"
            },
            "vinculo_destino": {
                "id_local_estoque": 5,
                "display": "ALMOXARIFADO",
                "tipo_vinculo": "local_estoque"
            },
            "codigo_movimento": "30f327a2-5a38-4f43-bc18-cb1e4c910a79",
            "data_movimento": {
                "date": "2024-06-19 17:30:27.962761",
                "timezone_type": 3,
                "timezone": "America/Recife"
            },
            "data_cadastro": "2024-06-19 17:30:27",
            "data_atualizacao": "2024-06-19 17:30:28",
            "valor_total": 13049.455,
            "observacao": "Campo de preenchimento opcional. Aqui poderá ser preenchido um texto lon
```
**Exemplo de resposta — Sucesso - Exemplo 2** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Movimento de retorno criado com sucesso",
    "movimentos_estoque": [
        {
            "id_movimento_estoque": 3500,
            "tipo": "entrada",
            "id_local_estoque": 84,
            "local_estoque": "Novo Local de Estoque - Não Usar",
            "origem": "(1484) CHESTER BENNINGTON - (28) COMBO 10 MEGA - NOVO",
            "destino": "Novo Local de Estoque - Não Usar",
            "vinculo_origem": {
                "id_cliente_servico": 17952,
                "display": "(28) COMBO 10 MEGA - NOVO",
                "numero_plano": 28,
                "cliente": {
                    "id_cliente": 24035,
                    "nome_razaosocial": "CHESTER BENNINGTON",
                    "cpf_cnpj": "67131260000177"
                },
                "tipo_vinculo": "servico_cliente"
            },
            "vinculo_destino": {
                "id_local_estoque": 84,
                "display": "Novo Local de Estoque - Não Usar",
                "tipo_vinculo": "local_estoque"
            },
            "codigo_movimento": "363f3a10-f7a3-4827-8598-d48a63035e52",
            "data_movimento": {
                "date": "2024-06-21 16:38:48.143053",
                "timezone_type": 3,
                "timezone": "America/Recife"
            },
            "data_cadastro": "2024-06-21 16:38:48",
            "data_atualizacao": "2024-06-21 16:38:48",
            "plataforma": "API",
            "valor_total": 4.35,
```

---
### GET — Listar
*Estoque / Movimentações de Estoque*

```
GET {{url}}/api/v1/integracao/estoque/movimento_estoque
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `pagina` | `integer` |
| `itens_por_pagina` | `integer` |
| `data_inicio` | `YYYY-MM-DD ` |
| `data_fim` | `YYYY-MM-DD ` |
| `tipo_data` | `cadastro,edicao,movimento` |
| `tipo_vinculo_origem` | `local_estoque, local_estoque_reparticao, compra_produto, servico_cliente, projeto_mapeamento, pop_conexao, usuario, usuario_confirmacao, local_estoque_confirmacao_transferencia` |
| `tipo_vinculo_destino` | `local_estoque, local_estoque_reparticao, compra_produto, servico_cliente, projeto_mapeamento, pop_conexao, usuario, usuario_confirmacao, local_estoque_confirmacao_transferencia` |
| `plataforma` | `web, app, api` |

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "paginacao": {
        "primeira_pagina": 0,
        "ultima_pagina": 270,
        "pagina_atual": 0,
        "total_registros": 2705
    },
    "movimentos_estoque": [
        {
            "id_movimento_estoque": 2925,
            "id_ordem_servico": null,
            "tipo": "entrada",
            "local_estoque": "ESTOQUE MÓVEL MÁRCIO",
            "origem": "Compra #539 (30/01/2024)",
            "destino": "ESTOQUE MÓVEL MÁRCIO",
            "vinculo_origem": {
                "id_produto_compra": 1276,
                "display": "#539 30/01/2024",
                "tipo_vinculo": "compra_produto"
            },
            "vinculo_destino": {
                "id_local_estoque": 153,
                "display": "ESTOQUE MÓVEL MÁRCIO",
                "tipo_vinculo": "local_estoque"
            },
            "codigo_movimento": "64df16c6-75f9-4b68-a438-d09e87a89d83",
            "data_movimento": "2024-05-16 16:44:59",
            "data_cadastro": "2024-05-16 16:44:59",
            "data_atualizacao": "2024-05-16 16:44:59",
            "valor_total": "170",
            "observacao": "Movimento gerado pelo do pedido #2193 da Solicitação de Compra #2301",
            "produtos": [
                {
                    "id_movimento_estoque_produto": 4031,
                    "id_produto": 655,
                    "produto": "ROTEADOR: 10 Unidade - (UN)",
                    "valor": "170",
```
**Exemplo de resposta — Erro**

```json
{
  "status": "error",
  "msg": "Favor preencher os campos obrigatórios de acordo com as especificações",
  "errors": [
    "O campo pagina é obrigatório."
  ]
}
```

---
### GET — Encontrar por ID
*Estoque / Movimentações de Estoque*

```
GET {{url}}/api/v1/integracao/estoque/movimento_estoque/:id_movimento_estoque
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse endpoint será possível capturar todos os dados de um movimento de estoque, seja ele de saída ou entrada.

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Movimento de Estoque de ID 2924 consultado com sucesso",
    "movimento_estoque": {
        "id_movimento_estoque": 2924,
        "id_ordem_servico": 5341,
        "tipo": "entrada",
        "local_estoque": "ESTOQUE TESTE WIKI 2",
        "origem": "TESTE PROJETO",
        "destino": "ESTOQUE TESTE WIKI 2",
        "vinculo_origem": {
            "id_vinculo": 31,
            "id_mapeamento_projeto": 31,
            "display": "TESTE PROJETO",
            "tipo_vinculo": "projeto_mapeamento"
        },
        "vinculo_destino": {
            "id_local_estoque": 37,
            "display": "ESTOQUE TESTE WIKI 2",
            "tipo_vinculo": "local_estoque"
        },
        "codigo_movimento": "55e5e566-5ca0-4199-ad60-202ee74a89aa",
        "data_movimento": "2024-05-16 15:31:07",
        "data_cadastro": "2024-05-16 15:31:07",
        "data_atualizacao": "2024-05-16 15:31:07",
        "valor_total": "45",
        "observacao": null,
        "produtos": [
            {
                "id_movimento_estoque_produto": 4030,
                "id_produto": 655,
                "produto": "ROTEADOR: 1 Unidade - (UN)",
                "valor": "45",
                "quantidade": 1,
                "patrimonios": [
                    {
                        "id_produto_item": 20556,
                        "produto": {
                            "id_produto": 655,
                            "nome": "ROTEADOR",
                            "
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "Movimentro de Estoque de ID 234124 não encontrado"
}
```

---
### DELETE — Apagar Movimento
*Estoque / Movimentações de Estoque*

```
DELETE {{url}}/api/v1/integracao/estoque/movimento_estoque/:id_movimento_estoque
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse endpoint será possível apagar movimentações de estoque de entrada adicionadas através do endpoint **Adicionar Produtos**, também documentado aqui.

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
  "status": "success",
  "msg": "Movimento apagado com sucesso"
}
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "O movimento de ID 4495 não pode ser apagado"
}
```

---
## Produto

### GET — Listar
*Estoque / Produto*

```
GET {{url}}/api/v1/integracao/estoque/produto
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
| `data_inicio` | `YYYY-MM-DD` |
| `data_fim` | `YYYY-MM-DD` |
| `relacoes` | `produto_configuracao` |

**Descrição:**

**GET**

No método `GET`, irá consultar/listar os dados de produtos e retornar um `JSON` como resposta. Os dados serão retornados de forma paginada, portanto fique atento ao conjunto da dados "paginacao" que é retornado na resposta, para saber se será necessário consultar outras páginas ou não.

Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| pagina | Página a ser exibida | Sim |
| itens_por_pagina | Itens por Página a serem exibidos. Mínimo: 1, Máximo: 500. | Não |
| data_inicio | Data de início da filtragem de dados | Não |
| data_fim | Data final da filtragem de dados | Não |
| busca | Tipo de busca que deseja fazer no produto | Não |
| termo_busca | Termo utilizado para fazer a busca | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| pagina | Campo Inteiro (integer) | `NULL` |
| itens_por_pagina | Campo Inteiro (integer) | 100 |
| data_inicio | Campo no formato Date (YYYY-MM-DD) | `NULL` |
| data_fim | Campo no formato Date (YYYY-MM-DD) | `NULL` |
| busca | `id_produto, codigo, nome` | `NULL` |
| termo_busca | Campo livre (Qualquer valor será aceito) | `NULL` |

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "paginacao": {
        "primeira_pagina": 0,
        "ultima_pagina": 43,
        "pagina_atual": 0,
        "total_registros": 440
    },
    "produtos": [
        {
            "id_produto": 1,
            "nome": "Airgrid",
            "descricao": "teste",
            "valor_compra": 280,
            "valor_venda": 400,
            "codigo_ean": null,
            "codigo_ean_trib": null,
            "data_cadastro": "2017-09-22 11:54:45",
            "ncm": {
                "id_ncm": 8834,
                "codigo": "85176249",
                "descricao": "OUTROS ROTEADORES DIGITAIS"
            },
            "cst_origem": null,
            "cest": null,
            "unidade_medida": {
                "id_unidade_medida": 19,
                "nome": "Unidade",
                "abreviacao": "UN"
            }
        },
        {
            "id_produto": 38,
            "nome": "MINE RACK PARA SERVIDOR",
            "descricao": "RACK",
            "valor_compra": 4969.5,
            "valor_venda": 4969.5,
            "codigo_ean": "7896637665919",
            "codigo_ean_trib": "7896637665919",
            "data_cadastro": "2018-02-28 08:44:28",
            "ncm": {
                "id_ncm": 8822,
                "codigo": "85176219",
                "descricao": "OUTROS CONCENTRADORES"
            },
            "cst_origem": null,
            "cest": {
                "id_cest": 2112,
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "Favor preencher os campos obrigatórios de acordo com as especificações",
  "errors": [
    "O campo pagina é obrigatório."
  ]
}
```

---
### GET — Encontrar por ID
*Estoque / Produto*

```
GET {{url}}/api/v1/integracao/estoque/produto/:id_produto
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `relacoes` | `produto_configuracao` |

**Descrição:**

**GET**

No método `GET`, será possível consultar um produto individualmente. Esse endpoint pode ser útil quando for necessário verificar / sincronizar produto por produto.

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
  "status": "success",
  "msg": "Produto de ID 4974 consultado com sucesso",
  "produto": {
    "id_produto": 4974,
    "nome": "Teste API Postman",
    "descricao": null,
    "valor_compra": 0,
    "valor_venda": 0,
    "codigo_ean": null,
    "codigo_ean_trib": null,
    "data_cadastro": "2023-01-31 10:05:54",
    "ncm": null,
    "cst_origem": null,
    "cest": null,
    "unidade_medida": {
      "id_unidade_medida": 186,
      "nome": "",
      "abreviacao": ""
    }
  }
}
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "Produto de ID 49742 não encontrado"
}
```

---
### POST — Adicionar
*Estoque / Produto*

```
POST {{url}}/api/v1/integracao/estoque/produto
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `relacoes` | `produto_configuracao` |

**Descrição:**

**POST**

No método `POST`, será possível adicionar novos produtos ao cadastro

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| nome | Nome do Produto | Sim |
| unidade_medida | Sigla da unidade de medida (EX: `UN`, `L`, `KG`) | Sim |
| valor_compra | Valor da Compra | Sim |
| valor_venda | Valor de Venda | Sim |
| controle_patrimonial | Controle Patrimonial | Sim |
| epi | Equipamento de Proteção Individual | Sim |
| produto_categoria.id_protudo_categoria | Categoria do Produto | Sim |
| produto_marca.id_produto_marca | Marca do Produto | Sim |
| produto_tipo.id_produto_tipo | Tipo do Produto | Não |
| codigo_ean | Código EAN | Não |
| codigo_ean_trib | Código EAN Tributável | Não |
| altura | Medida Altura | Não |
| largura | Medida Lagura | Não |
| profundidade | Medida Profundidade | Não |
| espessura | Medida Espessa | Não |
| comprimento | Medida Comprimento | Não |
| peso_liquido | Medida Peso Líquido | Não |
| peso_bruto | Medida Peso Bruto | Não |
| estoque_minimo | Quantidade mínima total | Não |
| codigo | Código do Produto | Não |
| descricao | Descrição do Produto | Não |
| ncm | Código NCM do Produto | Não |
| cest | Código Cest do Produto | Não |
| cst_origem | Origem do Produto | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| nome | `String` | `NULL` |
| unidade_medida | `String` | `NULL` |
| valor_compra | `Numeric` | `NULL` |
| valor_venda | `Numeric` | `NULL` |
| estoque_minimo | `Numeric` | `NULL` |
| codigo_ean | `Numeric` | `NULL` |
| codigo_ean_trib | `Numeric` | `NULL` |
| altura | `Numeric` | `NULL` |
| largura | `Numeric` | `NULL` |
| profundidade | `Numeric` | `NULL` |
| espessura | `Numeric` | `NULL` |
| comprimento | `Numeric` | `NULL` |
| peso_liquido | `Numeric` | `NULL` |
| peso_bruto | `Numeric` | `NULL` |
| agrupado | `Boolean` | `false` |
| controle_patrimonial | `Boolean` | `false` |
| epi | `Boolean` | `false` |
| produto_categoria.id_protudo_categoria | `Numeric` | `NULL` |
| produto_marca.id_produto_marca | `Numeric` | `NULL` |
| produto_tipo.id_produto_tipo | `Numeric` | `NULL` |
| codigo | `String` | `NULL` |
| descricao | `String` | `NULL` |
| ncm | `Numeric` | `NULL` |
| cest | `Numeric` | `NULL` |
| cst_origem | `Numeric` | `NULL` |

**Observação: O parâmetro controle_patrimonial irá indicar se o produto irá gerenciar os itens como patrimônio ou não. Caso o produto seja cadastrado com a opção controle_patrimonial =** **`true`****, significa que cada unidade do produto, precisará ter um** **`produto_item`** **(patrimônio) no estoque.**

Caso o produto seja cadastrado com a opção `controle_patrimonial` = `false` siginfica que será necessário cadastrar apenas 1 item no local de estoque contendo toda a quantidade de estoque disponível, ou seja, estará tudo agrupado.

**Corpo da requisição (JSON):**

```json
{
  "controle_patrimonial": true,
  "epi": true,
  "nome": "teste api 265656",
  "valor_compra": 25.93,
  "valor_venda": 39.99,
  "estoque_minimo": 6,
  "produto_marca": {
    "id_produto_marca": 1
  },
  "codigo": 333434553,
  "descricao": "teste",
  "codigo_ean": 56,
  "codigo_ean_trib": 753,
  "produto_tipo": {
    "id_produto_tipo": 1
  },
  "ncm": "01012100",
  "cest": "0100100",
  "cst_origem": 5,
  "produto_categoria": {
    "id_categoria": 5
  },
  "unidade_medida": "L",
  "peso_liquido": 55,
  "peso_bruto": 55,
  "altura": 67,
  "largura": 677,
  "profundidade": 89,
  "espessura": 833,
  "comprimento": 10
}
```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
  "status": "success",
  "msg": "Produto cadastrado com sucesso",
  "produto": {
    "id_produto": 4976,
    "nome": "Nome do Meu Produto",
    "descricao": null,
    "valor_compra": 25.93,
    "valor_venda": 39.99,
    "codigo_ean": null,
    "codigo_ean_trib": null,
    "data_cadastro": "2023-02-06 09:05:04",
    "ncm": null,
    "cst_origem": null,
    "cst_tributacao": null,
    "csosn": null,
    "cest": null,
    "unidade_medida": {
      "id_unidade_medida": 19,
      "nome": "Unidade",
      "abreviacao": "UN"
    }
  }
}
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "Favor preencher os campos obrigatórios de acordo com as especificações",
  "errors": [
    "O campo nome é obrigatório."
  ]
}
```

---
### PUT — Editar
*Estoque / Produto*

```
PUT {{url}}/api/v1/integracao/estoque/produto/:id_produto
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `relacoes` | `produto_configuracao` |

**Descrição:**

**POST**

No método `PUT`, será possível editar os dados de cadastro do produto

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| nome | Nome do Produto | Não |
| unidade_medida | Sigla da unidade de medida (EX: `UN`, `L`, `KG`) | Não |
| valor_compra | Valor da Compra | Não |
| valor_venda | Valor de Venda | Não |
| epi | Equipamentos de Proteção Individual | Não |
| codigo | Código do Produto | Não |
| codigo_ean | Código EAN | Não |
| codigo_ean_trib | Código EAN Tributável | Não |
| altura | Medida Altura | Não |
| largura | Medida Lagura | Não |
| profundidade | Medida Profundidade | Não |
| espessura | Medida Espessa | Não |
| comprimento | Medida Comprimento | Não |
| peso_liquido | Medida Peso Líquido | Não |
| peso_bruto | Medida Peso Bruto | Não |
| estoque_minimo | Quantidade mínima total | Não |
| produto_tipo | Tipo do Produto | Não |
| ncm | Código NCM do Produto | Não |
| cest | Código Cest do Produto | Não |
| cst_origem | Origem do Produto | Não |
| produto_configuracao | Configuração do Produto | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| nome | `String` | `NULL` |
| unidade_medida | `String` | `NULL` |
| valor_compra | `Numeric` | `NULL` |
| valor_venda | `Numeric` | `NULL` |
| estoque_minimo | `Numeric` | `NULL` |
| codigo | String | NULL |
| codigo_ean | `Numeric` | `NULL` |
| codigo_ean_trib | `Numeric` | `NULL` |
| altura | `Numeric` | `NULL` |
| largura | `Numeric` | `NULL` |
| profundidade | `Numeric` | `NULL` |
| espessura | `Numeric` | `NULL` |
| comprimento | `Numeric` | `NULL` |
| peso_liquido | `Numeric` | `NULL` |
| peso_bruto | `Numeric` | `NULL` |
| epi | `Boolean` | `FALSE` |
| ncm | `Numeric` | `NULL` |
| cest | `Numeric` | `NULL` |
| cst_origem | `Numeric` | `NULL` |
| produto_tipo.id_produto_tipo | `Numeric` | `NULL` |
| produto_configuracao.incluir_nota_fiscal | `Boolean` | `TRUE` |
| produto_configuracao.permite_venda_cliente | `Boolean` | `TRUE` |
| produto_configuracao.permite_comodato_cliente | `Boolean` | `TRUE` |
| produto_configuracao.permite_vinculo_pop | `Boolean` | `TRUE` |
| produto_configuracao.permite_vinculo_projeto_mapeamento | `Boolean` | `TRUE` |
| produto_configuracao.permite_vinculo_usuario | `Boolean` | `TRUE` |
| produto_configuracao.permite_vinculo_composicao | `Boolean` | `TRUE` |

**Corpo da requisição (JSON):**

```json
{
  "nome": "Nome do Meu Produto Editado",
  "unidade_medida": "UN",
  "valor_compra": 99.9,
  "valor_venda": 199.9
}
```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
  "status": "success",
  "msg": "Produto atualizado com sucesso",
  "produto": {
    "id_produto": 4976,
    "nome": "Nome do Meu Produto Editado",
    "descricao": null,
    "valor_compra": 99.9,
    "valor_venda": 199.9,
    "codigo_ean": null,
    "codigo_ean_trib": null,
    "data_cadastro": "2023-02-06 09:05:04",
    "ncm": null,
    "cst_origem": null,
    "cst_tributacao": null,
    "csosn": null,
    "cest": null,
    "unidade_medida": {
      "id_unidade_medida": 19,
      "nome": "Unidade",
      "abreviacao": "UN"
    }
  }
}
```
**Exemplo de resposta — Sucesso - Produto Configuração** (`HTTP 200 OK`)

```json
{
  "status": "success",
  "msg": "Produto atualizado com sucesso",
  "produto": {
    "id_produto": 4976,
    "nome": "Nome do Meu Produto Editado",
    "descricao": null,
    "valor_compra": 99.9,
    "valor_venda": 199.9,
    "codigo_ean": null,
    "codigo_ean_trib": null,
    "data_cadastro": "2023-02-06 09:05:04",
    "ncm": null,
    "cst_origem": null,
    "cst_tributacao": null,
    "csosn": null,
    "cest": null,
    "unidade_medida": {
      "id_unidade_medida": 19,
      "nome": "Unidade",
      "abreviacao": "UN"
    },
    "produto_configuracao": {
      "incluir_nota_fiscal": true,
      "permite_venda_cliente": true,
      "permite_comodato_cliente": true,
      "permite_vinculo_pop": true,
      "permite_vinculo_projeto_mapeamento": false,
      "permite_vinculo_usuario": true,
      "permite_vinculo_composicao": true
    }
  }
}
```

---
### DELETE — Apagar
*Estoque / Produto*

```
DELETE {{url}}/api/v1/integracao/estoque/produto/:id_produto
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

No método `DELETE`, será possível apagar o cadastro de um produto.

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
  "status": "success",
  "msg": "Produto foi inativado com sucesso"
}
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "Produto de ID 923193 não encontrado"
}
```

---
## Patrimonio

### GET — Consultar
*Estoque / Patrimonio*

```
GET {{url}}/api/v1/integracao/estoque/produto_item/consultar
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

**GET**

No método `GET`, será possível consultar um item do produto individualmente. Ele irá retornar um `JSON` como resposta. Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| busca | Tipo de busca que deseja fazer no cliente | Sim |
| termo_busca | Termo utilizado para fazer a busca | Sim |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| busca | mac_address, codigo_item, numero_serie, identificador_proprio | Nenhum |
| termo_busca | Campo livre (Qualquer valor será aceito) | Nenhum |

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
  "status": "success",
  "msg": "Patrimônio consultado com sucesso!",
  "produto": [
    {
      "id_produto_item": 101732,
      "produto": {
        "id_produto": 39,
        "nome": "ONU OVERTEK",
        "controle_patrimonial": true,
        "epi": false
      },
      "local_estoque": {
        "id_local_estoque": 17,
        "descricao": "ESTOQUE HUBSOFT - BH"
      },
      "produto_item_status": {
        "id_produto_item_status": 4,
        "descricao": "COMODATO",
        "prefixo": "comodato"
      },
      "identificador_proprio": "ONU15",
      "codigo_item": 85056,
      "numero_serie": "DF9G3",
      "mac_address": "89:45:62:30:85:20",
      "observacoes": null,
      "cliente_servico": {
        "id_cliente_servico": 19258,
        "numero_plano": 105,
        "servico": "5MB-WIRELESS",
        "display": "(105) 5MB-WIRELESS",
        "cliente": {
          "id_cliente": 24856,
          "codigo_cliente": 1848,
          "nome_razaosocial": "IASMIN AMARAL",
          "display": "(1848) IASMIN AMARAL"
        }
      }
    }
  ]
}
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "O tipo de busca (mac) não é válido | Valores aceitos para esse campo: mac_address,codigo_item,numero_serie,identificador_proprio"
}
```

---
### GET — Listar
*Estoque / Patrimonio*

```
GET {{url}}/api/v1/integracao/estoque/produto_item
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `id_produto` | `integer` |
| `pagina` | `integer` |
| `itens_por_pagina` | `integer` |

**Descrição:**

**GET**

No método `GET`, irá consultar/listar os dados de produtos e retornar um `JSON` como resposta. Os dados serão retornados de forma paginada, portanto fique atento ao conjunto da dados "paginacao" que é retornado na resposta, para saber se será necessário consultar outras páginas ou não.

Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_produto | ID do Produto | Sim |
| pagina | Página a ser exibida | Sim |
| itens_por_pagina | Itens por Página a serem exibidos. Mínimo: 1, Máximo: 500. | Não |
| data_inicio | Data de início da filtragem de dados | Não |
| data_fim | Data final da filtragem de dados | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_produto | `Integer` |  |
| pagina | `Integer` | `NULL` |
| itens_por_pagina | `Integer` | 100 |
| data_inicio | `Date`(YYYY-MM-DD) | `NULL` |
| data_fim | `Date` (YYYY-MM-DD) | `NULL` |

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "paginacao": {
        "primeira_pagina": 0,
        "ultima_pagina": 4397,
        "pagina_atual": 0,
        "total_registros": 43971
    },
    "produto_itens": [
        {
            "id_produto_item": 1,
            "produto": {
                "id_produto": 1,
                "nome": "Airgrid",
                "agrupado": false
            },
            "local_estoque": {
                "id_local_estoque": 1,
                "descricao": "Estoque na Cidade XPTO"
            },
            "produto_item_status": {
                "id_produto_item_status": 1,
                "descricao": "Vendido",
                "prefixo": "vendido"
            },
            "identificador_proprio": null,
            "codigo_item": 43948,
            "numero_serie": null,
            "mac_address": null,
            "observacoes": "teste de observação"
        },
        {
            "id_produto_item": 2,
            "produto": {
                "id_produto": 1,
                "nome": "Airgrid",
                "agrupado": false
            },
            "local_estoque": {
                "id_local_estoque": 4,
                "descricao": "Local de Estoque de Teste"
            },
            "produto_item_status": {
                "id_produto_item_status": 8,
                "descricao": "DESCARTADO",
                "prefixo": "descartado"
            },
            "identificador_proprio": null,
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "Favor preencher os campos obrigatórios de acordo com as especificações",
  "errors": [
    "O campo id produto é obrigatório.",
    "O campo pagina é obrigatório."
  ]
}
```

---
### GET — Encontrar por ID
*Estoque / Patrimonio*

```
GET {{url}}/api/v1/integracao/estoque/produto_item/:id_produto_item
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**GET**

No método `GET`, será possível consultar um produto individualmente. Esse endpoint pode ser útil quando for necessário verificar / sincronizar produto por produto.

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
  "status": "success",
  "msg": "Item de Produto de ID 101732 consultado com sucesso",
  "produto": {
    "id_produto_item": 101732,
    "produto": {
      "id_produto": 39,
      "nome": "ONU OVERTEK",
      "controle_patrimonial": true,
      "epi": false
    },
    "local_estoque": {
      "id_local_estoque": 17,
      "descricao": "ESTOQUE HUBSOFT - BH"
    },
    "produto_item_status": {
      "id_produto_item_status": 4,
      "descricao": "COMODATO",
      "prefixo": "comodato"
    },
    "identificador_proprio": "ONU15",
    "codigo_item": 85056,
    "numero_serie": "DF9G3",
    "mac_address": "89:45:62:30:85:20",
    "observacoes": null
  }
}
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "Favor preencher os campos obrigatórios de acordo com as especificações",
  "errors": [
    "O campo id_produto_item deve ser do tipo integer"
  ]
}
```

---
### PUT — Editar
*Estoque / Patrimonio*

```
PUT {{url}}/api/v1/integracao/estoque/produto_item/:id_produto_item
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

No método `PUT`, será possível editar os dados de cadastro do item de produto.

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| numero_serie | Número de Série | Não |
| mac_address | MAC Address | Não |
| identificador_proprio | Identificador Interno da Empresa ou ID do Item em outro sistema | Não |
| epi_ca | CA (Certificado de Aprovação) | Não |
| data_validade | Data de Validade do Patrimônio | Não |
| observacoes | Observações livres | Não |
| recondicionado | Identifica se o patrimônio é recondicionado | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| numero_serie | `String` | `NULL` |
| mac_address | `String` | `NULL` |
| identificador_proprio | `String` | `NULL` |
| epi_ca | `String` | `NULL` |
| data_validade | `Date: YYYY-MM-DD` | `NULL` |
| observacoes | `LongText` | `NULL` |
| recondicionado | `Boolean` | `NULL` |

**Corpo da requisição (JSON):**

```json
{
  "mac_address": "00:11:22:AA:BB:CC",
  "numero_serie": "SN111222333999",
  "identificador_proprio": "95f5d435-c302-463e-ad2e-748025fca05e"
}
```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
  "status": "success",
  "msg": "Edição realizado com sucesso",
  "produto_item": {
    "id_produto_item": 213346,
    "produto": {
      "id_produto": 1,
      "nome": "Airgrid",
      "agrupado": false
    },
    "local_estoque": {
      "id_local_estoque": 9,
      "descricao": "HUBSOFT"
    },
    "produto_item_status": {
      "id_produto_item_status": 2,
      "descricao": "ESTOQUE",
      "prefixo": "estoque"
    },
    "identificador_proprio": "95f5d435-c302-463e-ad2e-748025fca05e",
    "codigo_item": 177686,
    "numero_serie": "SN111222333999",
    "mac_address": "00:11:22:AA:BB:CC",
    "observacoes": null
  }
}
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "Favor preencher os campos obrigatórios de acordo com as especificações",
  "errors": [
    "O campo id_produto_item deve ser do tipo integer"
  ]
}
```

---
### PUT — Alterar Status
*Estoque / Patrimonio*

```
PUT {{url}}/api/v1/integracao/estoque/produto_item/alterar_status
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

No método `PUT`, será possível alterar o status de um patrimônio.

**Importante**: É fundamental destacar que a alteração do status dos patrimônios é condicionada à prévia baixa destes no estoque. Além disso, a modificação é restrita aos status que não possibilitam qualquer forma de vinculação.  
  
**É possível coletar a informação do id_produto_item_status na rota GET configuracao/produto_item_status.**

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| ids_produto_item | IDs de Patrimonios já cadastrados anteriormente | Sim |
| status | Prefixo do Status | Sim |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| ids_produto_item | `Array` | `NULL` |
| status | `String` | `NULL` |

O campo `status` deverá ter um dos seguintes valores, caso seja utilizado:

- `baixa_manual`
- `defeito`
- `descartado`
- `manutencao`
- `perdido`
- `teste`
    

Ou algum outro status que a empresa tenha criado manualmente.

**Corpo da requisição (JSON):**

```json
{
  "ids_produto_item": [
    130109,
    130111
  ],
  "status": "manutencao"
}
```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
  "status": "success",
  "msg": "Itens atualizados com sucesso"
}
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
    "status": "error",
    "msg": "Não é possível alterar o status de patrimônios que possuem vínculo ou que estejam em estoque através dessa função. Utilize o módulo de Movimentações de Estoque.",
    "code": 0,
    "description": "Não é possível alterar o status de patrimônios que possuem vínculo ou que estejam em estoque através dessa função. Utilize o módulo de Movimentações de Estoque.",
    "line": 493,
    "file": "/usr/local/www/hubsoft_api/app/Repositories/Integracao/Estoque/ProdutoItemRepository.php",
    "hint": null,
    "error_type": null,
    "trace": [
        "#0 /usr/local/www/hubsoft_api/app/Http/Controllers/Integracao/Estoque/ProdutoItemController.php(56): App\\Repositories\\Integracao\\Estoque\\ProdutoItemRepository->updateStatusPatrimonio(Object(Illuminate\\Http\\Request))",
        "#1 [internal function]: App\\Http\\Controllers\\Integracao\\Estoque\\ProdutoItemController->updateStatusPatrimonio(Object(Illuminate\\Http\\Request))",
        "#2 /usr/local/www/hubsoft_api/vendor/laravel/framework/src/Illuminate/Routing/Controller.php(54): call_user_func_array(Array, Array)",
        "#3 /usr/local/www/hubsoft_api/vendor/laravel/framework/src/Illuminate/Routing/ControllerDispatcher.php(45): Illuminate\\Routing\\Controller->callAction('updateStatusPat...', Array)",
        "#4 /usr/local/www/hubsoft_api/vendor/laravel/framework/src/Illuminate/Routing/Route.php(219): Illuminate\\Routing\\ControllerDispatcher->dispatch(Object(Illuminate\\Routing\\Route), Obj
```

---
## Produtos Vínculados

### GET — Produtos com Usuários
*Estoque / Produtos Vínculados*

```
GET {{url}}/api/v1/integracao/estoque/produto_vinculo/usuario/:id_usuario
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
| `relacoes` | `usuario,produto,local_estoque` |
| `id_produto` | `Integer` |
| `id_local_estoque` | `Integer` |
| `tipo_utilizacao` | `epi,uso_proprio,cliente_servico,retirado` |

**Descrição:**

Utilize este endpoint quando for necessário consultar a lista completa de produtos associados a um usuário específico. Este recurso permite identificar todos os produtos vinculados ao usuário, fornecendo informações detalhadas sobre cada item, incluindo id_local_estoque, id_produto, quantidade e patrimônios associados.

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "paginacao": {
        "primeira_pagina": 0,
        "ultima_pagina": 0,
        "pagina_atual": 0,
        "total_registros": 17
    },
    "produtos_usuario": [
        {
            "tipo_utilizacao": "cliente_servico",
            "id_usuario": 205,
            "id_produto": 3849,
            "id_local_estoque": 5,
            "quantidade": 1
        },
        {
            "tipo_utilizacao": "cliente_servico",
            "id_usuario": 205,
            "id_produto": 667,
            "id_local_estoque": 5,
            "quantidade": 4,
            "patrimonios": [
                {
                    "id_produto_item": 127403,
                    "identificador_proprio": null,
                    "codigo_item": 110680,
                    "numero_serie": null,
                    "mac_address": null,
                    "observacoes": null,
                    "produto_item_status": {
                        "id_produto_item_status": 11,
                        "descricao": "Usuário",
                        "prefixo": "usuario"
                    }
                },
                {
                    "id_produto_item": 127404,
                    "identificador_proprio": null,
                    "codigo_item": 110681,
                    "numero_serie": null,
                    "mac_address": null,
                    "observacoes": null,
                    "produto_item_status": {
```
**Exemplo de resposta — Erro**

```json
{
  "status": "error",
  "msg": "Os dados fornecidos são inválidos",
  "errors": [
    "O campo tipo utilizacao não contém um valor válido."
  ]
}
```

---
### GET — POP de Conexão
*Estoque / Produtos Vínculados*

```
GET {{url}}/api/v1/integracao/estoque/produto_vinculo/pop_conexao/:id_pop
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
| `relacoes` | `pop,produto,local_estoque` |
| `id_produto` | `Integer` |
| `id_local_estoque` | `Integer` |

**Descrição:**

Utilize este endpoint quando for necessário consultar a lista completa de produtos associados a um pop de conexão específico. Este recurso permite identificar todos os produtos vinculados ao pop, fornecendo informações detalhadas sobre cada item, incluindo id_local_estoque, id_produto, quantidade e patrimônios associados.

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "paginacao": {
        "primeira_pagina": 0,
        "ultima_pagina": 0,
        "pagina_atual": 0,
        "total_registros": 7
    },
    "produtos_pop": [
        {
            "id_pop": 97,
            "id_produto": 629,
            "id_local_estoque": 5,
            "quantidade": 1,
            "patrimonios": [
                {
                    "id_produto_item": 117402,
                    "identificador_proprio": null,
                    "codigo_item": 100702,
                    "numero_serie": null,
                    "mac_address": null,
                    "observacoes": null,
                    "produto_item_status": {
                        "id_produto_item_status": 15,
                        "descricao": "POP de Conexão",
                        "prefixo": "pop_conexao"
                    }
                }
            ]
        },
        {
            "id_pop": 97,
            "id_produto": 166,
            "id_local_estoque": 5,
            "quantidade": 1,
            "patrimonios": [
                {
                    "id_produto_item": 94940,
                    "identificador_proprio": null,
                    "codigo_item": 78280,
                    "numero_serie": null,
                    "mac_address": null,
                    "observacoes": null,
                    "produto_item_status": {
                        "id_produto_item_status": 15,
```
**Exemplo de resposta — Erro**

```json
{
  "status": "error",
  "msg": "Os dados fornecidos são inválidos",
  "errors": [
    "O valor selecionado para o campo id pop é inválido."
  ]
}
```

---
### GET — Projeto de Mapeamento
*Estoque / Produtos Vínculados*

```
GET {{url}}/api/v1/integracao/estoque/produto_vinculo/projeto_mapeamento/:id_mapeamento_projeto
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
| `relacoes` | `mapeamento_projeto,produto,local_estoque` |
| `id_produto` | `Integer` |
| `id_local_estoque` | `Integer` |

**Descrição:**

Utilize este endpoint quando for necessário consultar a lista completa de produtos associados a um Projeto de Mapeamento específico. Este recurso permite identificar todos os produtos vinculados ao Projeto de Mapeamento, fornecendo informações detalhadas sobre cada item, incluindo id_local_estoque, id_produto, quantidade e patrimônios associados.

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Dados consultados com sucesso",
  "paginacao": {
    "primeira_pagina": 0,
    "ultima_pagina": 2,
    "pagina_atual": 0,
    "total_registros": 6
  },
  "produtos_mapeamento_projeto": [
    {
      "id_mapeamento_projeto": 33,
      "id_produto": 3485,
      "id_local_estoque": 5,
      "quantidade": 1,
      "patrimonios": [
        {
          "id_produto_item": 153261,
          "produto_item_status": {
            "id_produto_item_status": 14,
            "descricao": "Projeto de Mapeamento",
            "prefixo": "projeto_mapeamento"
          },
          "identificador_proprio": null,
          "codigo_item": 130277,
          "numero_serie": null,
          "mac_address": null,
          "observacoes": null
        }
      ]
    },
    {
      "id_mapeamento_projeto": 33,
      "id_produto": 156,
      "id_local_estoque": 12,
      "quantidade": 0.0399
    }
  ]
}
```
**Exemplo de resposta — Erro**

```json
{
  "status": "error",
  "msg": "Os dados fornecidos são inválidos",
  "errors": [
    "O valor selecionado para o campo id mapeamento projeto é inválido."
  ]
}
```

---
### GET — Serviço do Cliente
*Estoque / Produtos Vínculados*

```
GET {{url}}/api/v1/integracao/estoque/produto_vinculo/cliente_servico/:id_cliente_servico
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
| `relacoes` | `cliente_servico,produto_item_status,produto,local_estoque` |
| `id_produto` | `Integer` |
| `id_local_estoque` | `Integer` |
| `id_produto_item_status` | `Integer` |

**Descrição:**

Utilize este endpoint quando for necessário consultar a lista completa de produtos associados a um Serviço do Cliente específico. Este recurso permite identificar todos os produtos vinculados ao Serviço do Cliente, fornecendo informações detalhadas sobre cada item, incluindo id_local_estoque, id_produto, quantidade e patrimônios associados.

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Dados consultados com sucesso",
  "paginacao": {
    "primeira_pagina": 0,
    "ultima_pagina": 0,
    "pagina_atual": 0,
    "total_registros": 1
  },
  "produtos_cliente_servico": [
    {
      "id_cliente_servico": 17460,
      "id_produto_item_status": 1,
      "id_produto": 4074,
      "id_local_estoque": 20,
      "quantidade": 1,
      "patrimonios": [
        {
          "id_produto_item": 128781,
          "produto_item_status": {
            "id_produto_item_status": 1,
            "descricao": "Vendido",
            "prefixo": "vendido"
          },
          "identificador_proprio": null,
          "codigo_item": 111688,
          "numero_serie": null,
          "mac_address": null,
          "observacoes": null
        }
      ]
    }
  ]
}
```
**Exemplo de resposta — Erro**

```json
{
  "status": "error",
  "msg": "Os dados fornecidos são inválidos",
  "errors": [
    "O valor selecionado para o campo id cliente servico é inválido."
  ]
}
```

---
## Fornecedor

### POST — Adicionar
*Estoque / Fornecedor*

```
POST {{url}}/api/v1/integracao/estoque/fornecedor
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

No método `POST`, será possível adicionar novos fornecedores

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| tipo | Tipo de Fornecedor | Sim |
| nome_razaosocial | Razao Social do Fornecedor | Sim |
| nome_fantasia | Nome Fantasia do Fornecedor | Não |
| telefone_primario | Telefone Primário do Fornecedor | Não |
| telefone_secundario | Telefone Secundário do Fornecedor | Não |
| email_primario | Email Primário do Fornecedor | Não |
| cpf_cnpj | Documento do Fornecedor | Sim |
| tipo_pessoa | Tipo de Pessoa do Fornecedor | Sim |
| inscricao_municipal | Inscrição Municipal do Fornecedor | Não |
| inscricao_estadual | Inscrição Estadual do Fornecedor | Não |
| uf | UF da Inscrição Estadual do Fornecedor | Não |
| observacao | Observação do Fornecedor | Não |
| enderecos | Endereços vinculados ao Fornecedor | Não |
| contatos | Contatos vinculados ao Fornecedor | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| tipo | `fornecedor`,`transportadora`, `fornecedor_e_transportadora` | `NULL` |
| nome_razaosocial | `String` | `NULL` |
| nome_fantasia | `String` | `NULL` |
| telefone_primario | `String` | `NULL` |
| telefone_secundario | `String` | `NULL` |
| email_primario | `String` | `NULL` |
| cpf_cnpj | `String` | `NULL` |
| tipo_pessoa | `pf`, `pj` | `NULL` |
| inscricao_municipal | `String` | `NULL` |
| inscricao_estadual | `String` | `NULL` |
| uf | `AC,AL,AP,AM,BA,CE,DF,ES,GO,MA,MT,MS,MG,PA,PB,PR,PE,PI,RJ,RN,RS,RO,RR,SC,SP,SE,TO` | `NULL` |
| observacao | `String` | `NULL` |
| enderecos | `Array de objetos`. `Nota 1` | `NULL` |
| contatos | `Array de objetos`. `Nota 2` | `NULL` |

**Observação**: Os campos que não são marcados como obrigatórios podem se tornar obrigatórios caso a empresa configure determinado campo como obrigatório. Se algum campo obrigatório estiver configurado, um erro será retornado ao tentar realizar o cadastro do fornecedor.

**Nota 1:** Para cadastrar endereços ao fornecedor, deve ser enviado um array de objetos contendo as informações desejadas, exemplo do array:

| `"enderecos": [`  <br>`{`  <br>`"cidade":{`  <br>`"id_cidade": "123"`  <br>`},`  <br>`"bairro": "Mae Chiquinha",`  <br>`"endereco": "Av. Senador Eduardo",`  <br>`"numero": "12",`  <br>`"cep": "355560000",`  <br>`"complemento": "Complemento",`  <br>`"referencia": "Referencia"`  <br>`}`  <br>`]` |
| --- |

**Nota 2:** Para cadastrar contatos ao fornecedor, deve ser enviado um array de objetos contendo as informações desejadas, exemplo do array:

| `"contatos": [`  <br>`{`  <br>`"tipo_contato": {`  <br>`"id_tipo_contato": "2"`  <br>`},`  <br>`"nome": "BIANCA",`  <br>`"email_primario": "bianca.couto@hubsoft.com.br",`  <br>`"email_secundario": "",`  <br>`"telefone_primario": "37999999999",`  <br>`"telefone_secundario": "",`  <br>`"telefone_terciario": ""`  <br>`},`  <br>`{`  <br>`"tipo_contato": {`  <br>`"id_tipo_contato": [1,2]`  <br>`},`  <br>`"nome": "TESTE",`  <br>`"email_primario": "teste@hubsoft.com.br",`  <br>`"email_secundario": "",`  <br>`"telefone_primario": "37999999998",`  <br>`"telefone_secundario": "",`  <br>`"telefone_terciario": ""`  <br>`}`  <br>`]` |
| --- |

**Corpo da requisição (JSON):**

```json
{
  "tipo": "transportadora",
  "nome_razaosocial": "TRANSPORTADORA API - contatos e endereco",
  "nome_fantasia": "fornecedor",
  "telefone_primario": "37999098100",
  "email_primario": "bianca.couto@hubsoft.com.br",
  "cpf_cnpj": "83243573000173",
  "tipo_pessoa": "pj",
  "observacao": "TESTE DE FORNECEDOR OBSERVACAO",
  "enderecos": [
    {
      "cidade": {
        "id_cidade": "123"
      },
      "bairro": "Mae Chiquinha",
      "endereco": "Av. Senador Eduardo",
      "numero": "12",
      "cep": "355560000",
      "complemento": "Complemento",
      "referencia": "Referencia"
    }
  ],
  "contatos": [
    {
      "tipo_contato": {
        "id_tipo_contato": "2"
      },
      "nome": "BIANCA",
      "email_primario": "bianca.couto@hubsoft.com.br",
      "email_secundario": "",
      "telefone_primario": "37999999999",
      "telefone_secundario": "",
      "telefone_terciario": ""
    },
    {
      "tipo_contato": {
        "id_tipo_contato": [
          1,
          2
        ]
      },
      "nome": "TESTE",
      "email_primario": "teste@hubsoft.com.br",
      "email_secundario": "",
      "telefone_primario": "37999999998",
      "telefone_secundario": "",
      "telefone_terciario": ""
    }
  ]
}
```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Fornecedor / Transportadora cadastrado com sucesso",
    "fornecedor": {
        "id_fornecedor": 3727,
        "nome_razaosocial": "TRANSPORTADORA API - CONTATOS E ENDERECO",
        "nome_fantasia": "FORNECEDOR",
        "telefone_primario": "37999098100",
        "telefone_secundario": "37999098100",
        "email_primario": "bianca.couto@hubsoft.com.br",
        "cpf_cnpj": "83243573000173",
        "tipo_pessoa": "pj",
        "inscricao_estadual": null,
        "inscricao_municipal": null,
        "uf_ie": null,
        "ativo": true,
        "tipo": "transportadora",
        "observacao": "TESTE DE FORNECEDOR OBSERVACAO",
        "enderecos": [
            {
                "id_endereco_numero": 70001,
                "endereco": "AV. SENADOR EDUARDO",
                "numero": "12",
                "complemento": "COMPLEMENTO",
                "referencia": "REFERENCIA",
                "bairro": "MAE CHIQUINHA",
                "cep": "355560000",
                "cidade": "Viçosa",
                "estado": "AL"
            }
        ],
        "contatos": [
            {
                "id_contato": 27838,
                "tipo_contato": "Comercial",
                "nome": "BIANCA",
                "email_primario": "bianca.couto@hubsoft.com.br",
                "email_secundario": null,
                "telefone_primario": "37999999999",
                "telefone_secundario": null,
                "telefone_terciario": nul
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "Favor preencher os campos obrigatórios de acordo com as especificações",
  "errors": [
    "O campo tipo é obrigatório.",
    "O valor indicado para o campo cpf cnpj já se encontra utilizado."
  ]
}
```

---
### DELETE — Ativar/Inativar
*Estoque / Fornecedor*

```
DELETE {{url}}/api/v1/integracao/estoque/fornecedor/:id_fornecedor
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

No método `DELETE`, será possível inativar o cadastro de um fornecedor.

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
  "status": "success",
  "msg": "Fornecedor / Transportadora desativado com sucesso"
}
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "Fornecedor de ID 923193 não encontrado"
}
```

---
### PUT — Editar
*Estoque / Fornecedor*

```
PUT {{url}}/api/v1/integracao/estoque/fornecedor/:id_fornecedor
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

No método `POST`, será possível adicionar novos fornecedores

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| tipo | Tipo de Fornecedor | Não |
| nome_razaosocial | Razao Social do Fornecedor | Não |
| nome_fantasia | Nome Fantasia do Fornecedor | Não |
| telefone_primario | Telefone Primário do Fornecedor | Não |
| telefone_secundario | Telefone Secundário do Fornecedor | Não |
| email_primario | Email Primário do Fornecedor | Não |
| inscricao_municipal | Inscrição Municipal do Fornecedor | Não |
| inscricao_estadual | Inscrição Estadual do Fornecedor | Não |
| uf | UF da Inscrição Estadual do Fornecedor | Não |
| observacao | Observação do Fornecedor | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| tipo | `fornecedor`,`transportadora`, `fornecedor_e_transportadora` | `NULL` |
| nome_razaosocial | `String` | `NULL` |
| nome_fantasia | `String` | `NULL` |
| telefone_primario | `String` | `NULL` |
| telefone_secundario | `String` | `NULL` |
| email_primario | `String` | `NULL` |
| inscricao_municipal | `String` | `NULL` |
| inscricao_estadual | `String` | `NULL` |
| uf | `AC,AL,AP,AM,BA,CE,DF,ES,GO,MA,MT,MS,MG,PA,PB,PR,PE,PI,RJ,RN,RS,RO,RR,SC,SP,SE,TO` | `NULL` |
| observacao | `String` | `NULL` |

**Observação**: Os campos que não são marcados como obrigatórios e estão vazios no cadastro do fornecedor podem se tornar obrigatórios caso a empresa configure determinado campo como obrigatório. Se algum campo obrigatório estiver configurado, um erro será retornado ao tentar realizar o cadastro do fornecedor.

**Corpo da requisição (JSON):**

```json
{
  "nome_razaosocial": "FORNECEDOR DE API",
  "nome_fantasia": "FORNECEDOR API",
  "telefone_primario": "37999098100",
  "observacao": "EDITAR OBSERVACAO"
}
```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
  "status": "success",
  "msg": "Fornecedor / Transportadora atualizados com sucesso",
  "fornecedor": {
    "id_fornecedor": 3699,
    "nome_razaosocial": "FORNECEDOR DE API",
    "nome_fantasia": "FORNECEDOR API",
    "telefone_primario": "37999098100",
    "telefone_secundario": "37999098100",
    "email_primario": null,
    "cpf_cnpj": "27822224000135",
    "tipo_pessoa": "pj",
    "inscricao_estadual": null,
    "inscricao_municipal": null,
    "uf_ie": null,
    "ativo": true,
    "tipo": "fornecedor",
    "observacao": "EDITAR OBSERVACAO",
    "enderecos": [],
    "contatos": []
  }
}
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "Favor preencher os campos obrigatórios de acordo com as especificações",
  "errors": [
    "O campo email primario é obrigatório."
  ]
}
```

---
### GET — Encontrar por ID
*Estoque / Fornecedor*

```
GET {{url}}/api/v1/integracao/estoque/fornecedor/:id_fornecedor
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**GET**

No método `GET`, será possível consultar um fornecedor ativo individualmente. Esse endpoint pode ser útil quando for necessário verificar / sincronizar fornecedor por fornecedor.

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Fornecedor de ID 2474 consultado com sucesso",
    "fornecedor": {
        "id_fornecedor": 2474,
        "nome_razaosocial": "ASSOCIAÇÃO BRASILEIRA DE PROVEDORES DE INTERNET",
        "nome_fantasia": "ABRINT",
        "telefone_primario": "37999456377",
        "telefone_secundario": "37999456377",
        "email_primario": "teste@teste.com.br",
        "cpf_cnpj": "64537424000172",
        "tipo_pessoa": "pj",
        "inscricao_estadual": "",
        "inscricao_municipal": null,
        "uf_ie": null,
        "ativo": true,
        "tipo": "fornecedor",
        "observacao": "teste",
        "enderecos": [
            {
                "id_endereco_numero": 40517,
                "endereco": "CENTRO",
                "numero": "100",
                "complemento": null,
                "referencia": null,
                "bairro": "CENTRO",
                "cep": "010101",
                "cidade": "Chachapoyas",
                "estado": "Amazonas"
            }
        ],
        "contatos": [
            {
                "id_contato": 26552,
                "tipo_contato": "Outros",
                "nome": "TESTE",
                "email_primario": "teste@teste.com",
                "email_secundario": "",
                "telefone_primario": "78451237645",
                "telefone_secundario": "78451237784",
                "telefone_terciario": ""
            },
            {
                "id_contato": 27251,
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "Fornecedor de ID 24741 não encontrado"
}
```

---
### GET — Listar
*Estoque / Fornecedor*

```
GET {{url}}/api/v1/integracao/estoque/fornecedor
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

**Descrição:**

**GET**

No método `GET`, irá consultar/listar os dados de fornecedores ativos e retornar um `JSON` como resposta. Os dados serão retornados de forma paginada, portanto fique atento ao conjunto da dados "paginacao" que é retornado na resposta, para saber se será necessário consultar outras páginas ou não.

Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| `pagina` | Página a ser exibida | Sim |
| `itens_por_pagina` | Itens por Página a serem exibidos. Mínimo: 1, Máximo: 500. | Não |
| `busca` | Tipo de busca que deseja fazer no fornecedor | Não (Obrigatório se for enviar o parametro termo_busca) |
| `termo_busca` | Termo utilizado para fazer a busca | Não (Obrigatório se for enviar o parametro busca) |
| `status` | Termo utilizado para buscar fornecedores inativos | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| pagina | Campo Inteiro (integer) | `NULL` |
| itens_por_pagina | Campo Inteiro (integer) | 100 |
| busca | id_fornecedor, cpf_cnpj, tipo_pessoa, tipo | `NULL` |
| termo_busca | Campo livre (Qualquer valor será aceito) | `NULL` |
| status | ativo,inativo | ativo |

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "paginacao": {
        "primeira_pagina": 0,
        "ultima_pagina": 17,
        "pagina_atual": 0,
        "total_registros": 176
    },
    "fornecedores": [
        {
            "id_fornecedor": 1,
            "nome_razaosocial": "ISIMPLES TELECOM E HARDWARE LTDA",
            "nome_fantasia": "ISIMPLES",
            "telefone_primario": "3732818383",
            "telefone_secundario": "3732818383",
            "email_primario": "contato@isimples.com.br",
            "cpf_cnpj": "66343059000190",
            "tipo_pessoa": "pf",
            "inscricao_estadual": null,
            "inscricao_municipal": null,
            "uf_ie": null,
            "ativo": false,
            "tipo": "fornecedor",
            "observacao": null,
            "enderecos": [
                {
                    "id_endereco_numero": 18962,
                    "endereco": "RUA AMADOR EMÍDIO DA SILVA",
                    "numero": "13",
                    "complemento": null,
                    "referencia": null,
                    "bairro": "CHÁCARA",
                    "cep": "35560000",
                    "cidade": "Santo Antônio do Monte",
                    "estado": "MG"
                }
            ],
            "contatos": [
                {
                    "id_contato": 12221,
                    "tipo_contato": "Financeiro",
                    "nome": "MARLON",
                    "email_primar
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "Favor preencher os campos obrigatórios de acordo com as especificações",
  "errors": [
    "O campo pagina é obrigatório."
  ]
}
```

---