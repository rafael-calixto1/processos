# Nota Fiscal

Através do HubSoft é possível fazer a emissão dos seguintes notas fiscais:

\*   NF Modelo 21 (Telecom)
\*   NF Modelo 22 (Telecom)
\*   NF Modelo 55 (NFe)
\*   NFSe (Serviços / ISS / Prefeitura)

## NFSE

Para fazer requisições nos dados de NFSe, é necessário que você já possua o `access_token`, conseguido na etapa `(oAuth)`

### GET — Listar
*Nota Fiscal / NFSE*

```
GET {{url}}/api/v1/integracao/nota_fiscal/nfse
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `tipo_data` | `data_cadastro` |
| `data_inicio` | `2020-01-01` |
| `data_fim` | `2022-08-31` |
| `documento` | `29507487000170` |
| `pagina` | `0` |
| `itens_por_pagina` | `10` |
| `order_type` | `asc` |
| `order_by` | `id_nfse` |
| `status` | `todas` |

**Descrição:**

No método `GET`, será possível consultar as NFSe emitidas e obter o retorno no formato `JSON` como resposta. Os seguintes `Query Params` podem/devem ser utilizados.

| **Atributo** | **Descrição** | **Obrigatório** |
| --- | --- | --- |
| `tipo_data` | Tipo de data que será filtrada nos campos  <br>`data_inicio` e `data_fim`. Valor disponíveis: data_cadastro, data_cancelamento, data_emissao | Não |
| `data_inicio` | Data Inicial no formato YYYY-MM-DD | Sim |
| `data_fim` | Data Final no formato YYYY-MM-DD | Sim |
| `documento` | CNPJ da Empresa emissora da NFSe | Sim |
| `pagina` | Página a ser exibida | Sim |
| `itens_por_pagina` | Itens por Página a serem exibidos. Mínimo: 1, Máximo: 500 | Sim |
| `id_nfse` | Filtra a NFSe pelo ID | Não |
| `numero` | Filtra a NFSe pelo número | Não |
| `order_type` | Tipo de ordenação: asc, desc | Não |
| `order_by` | Coluna para ordenação: id_nfse, numero | Não |
| `status` | Coluna para consultar pelo status da nota: pendente, em_transmissao e etc. | Não |
| `campo_id_externo2` | Filtra Nfses com base no campo id_externo2. Valores Válidos: preenchido, nao_preenchido, todos. Valor Padrão: todos | Não |
| `adiantamento` | Pode ser utilizado para filtrar nfses conforme o tipo de adiantamento. Os valores permitidos são: `com_adiantamento`, `sem_adiantamento` ou `todos`. O valor padrão é `todos`. | Não |

OBS: Caso queira filtrar por exemplo somente as notas fiscais canceladas, basta preencher o parâmetro `tipo_data` com o valor `data_cancelamento`.

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "paginacao": {
        "primeira_pagina": 0,
        "ultima_pagina": 6,
        "pagina_atual": 0,
        "total_registros": 68
    },
    "nfses": [
        {
            "id_nfse": 1,
            "id_externo": "5e0eab8d6f876b9e7e4638ed",
            "hash": "c86faa05-55ca-451f-8d2e-3c56f2c8764b",
            "numero": "6",
            "serie": "1",
            "lote_rps": "9",
            "data_emissao": "2020-01-02 22:03:33",
            "data_cancelamento": "2020-01-03 18:15:39",
            "link_pdf": "https://link-com-pdf-da-nfse.pdf",
            "link_xml": "https://link-com-xml-da-nfse.xml",
            "link_prefeitura": "https://link-da-prefeitura.html",
            "status": "cancelado",
            "informacao_complementar": "INFORMAÇÃO COMPLEMENTAR DA NFSE",
            "protocolo_cancelamento": "3ce37523-c23b-483f-90a9-f2c4aa00efbb",
            "iss_retido": null,
            "codigo_lista_servico": null,
            "codigo_tributacao_municipio": null,
            "cnae": null,
            "aliquota_iss": null,
            "aliquota_pis": null,
            "aliquota_cofins": null,
            "aliquota_csll": null,
            "aliquota_inss": null,
            "aliquota_irrf": null,
            "valor": 39.33,
            "valor_iss": null,
            "valor_pis": null,
            "valor_cofins": null,
            "valor_csll": null,
            "valor_inss": null,
            "v
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "Favor preencher os campos obrigatórios de acordo com as especificações",
  "errors": [
    "O campo documento não possui um valor válido."
  ]
}
```

---
### PUT — Editar
*Nota Fiscal / NFSE*

```
PUT {{url}}/api/v1/integracao/nota_fiscal/nfse/:id_nfse
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

No método `PUT`, será possível editar uma NFSE especificada pelo seu `ID`. Essa função é útil para empresas que utilizam sistemas próprios e/ou que não são integrados nativamente pelo HubSoft.

Os campos abaixo estão disponíveis para serem editados:

| **Atributo** | **Descrição** | **Obrigatório** |
| --- | --- | --- |
| `id_externo` | Identificador no sistema externo ao HubSoft | Não |
| `numero` | Número da NFSe | Não |
| `serie` | Série da NFSe | Não |
| `data_emissao` | Data de Emissão. Formato: `Y-m-d H:i:s` | Não |
| `lote_rps` | Lote do RPS | Não |
| `link_pdf` | Link do PDF da NFSe. Formato: `URL` | Não |
| `link_xml` | Link do XML da NFSe. Formato: `URL` | Não |
| `link_prefeitura` | Link da NFSe na Prefeitura. Formato: `URL` | Não |
| `status` | Status da Nota Disponíveis:  <br>\- `pendente`  <br>\- `em_transmissao`  <br>\- `transmitido`  <br>\- `autorizado`  <br>\- `rejeitado`  <br>\- `em_cancelamento`  <br>\- `cancelamento_transmitido`  <br>\- `cancelamento_rejeitado`  <br>\- `cancelado` | Não |
| `codigo_verificacao` | Código de Verificação da NFSe | Não |

**Corpo da requisição (JSON):**

```json
{
  "id_externo": "",
  "numero": "",
  "serie": "",
  "data_emissao": "Y-m-d H:i:s",
  "lote_rps": "",
  "link_pdf": "https://url.com/pdf",
  "link_xml": "https://url.com/xml",
  "link_prefeitura": "https://prefeitura.gov.br/nfse/123456",
  "status": "",
  "codigo_verificao": ""
}
```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Edição da NFSe de ID 420 realizada com sucesso",
    "nfse": {
        "id_nfse": 420,
        "id_externo": "123456",
        "hash": null,
        "numero": "111222",
        "serie": "1",
        "lote_rps": "1234",
        "data_cadastro": "2023-07-20 16:44:30",
        "data_emissao": "2023-07-20 23:12:55",
        "data_cancelamento": null,
        "link_pdf": "https://teste.com/pdf",
        "link_xml": "https://teste.com/xml",
        "link_prefeitura": "https://prefeitura.gov.br/nfse/123456",
        "status": "autorizado",
        "informacao_complementar": null,
        "protocolo_cancelamento": null,
        "iss_retido": null,
        "codigo_lista_servico": null,
        "codigo_tributacao_municipio": null,
        "cnae": null,
        "aliquota_iss": null,
        "aliquota_pis": null,
        "aliquota_cofins": null,
        "aliquota_csll": null,
        "aliquota_inss": null,
        "aliquota_irrf": null,
        "valor": "100",
        "valor_iss": null,
        "valor_pis": null,
        "valor_cofins": null,
        "valor_csll": null,
        "valor_inss": null,
        "valor_irrf": null,
        "valor_iss_retido": null,
        "valor_desconto_condicionado": null,
        "valor_desconto_incondicionado": null,
        "valor_deducoes": null,
        "codigo_verificacao": null,
        "tipo_tributacao": {
            "codigo": null,
            "descricao": null
        },
        "exigibilidade": {
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "Favor preencher os campos obrigatórios de acordo com as especificações",
  "errors": [
    "O campo status ao ser preenchido, deve conter um dos seguintes status: pendente,em_transmissao,transmitido,autorizado,rejeitado,em_cancelamento,cancelamento_transmitido,cancelamento_rejeitado,cancelado"
  ]
}
```

---
### PUT — Update ID Externo 2
*Nota Fiscal / NFSE*

```
PUT {{url}}/api/v1/integracao/nota_fiscal/nfse/update_id_externo2/:id_nfse
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

Através deste `endpoint` , será possível efetuar a atualização do id_externo2 da NFSe

Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_externo2 | ID Externo2 a ser vinculado na HubSoft | Sim |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_externo2 | String | Campo livre |

**Corpo da requisição (JSON):**

```json
{
  "id_externo2": "SAP-3432"
}
```

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "O campo ID Externo2 da NFSE foi alterado de CAMPO_VAZIO para sap_1608",
  "nfse": {
    "id_nfse": 206
  }
}
```

---
## Telecom (21/22)

Para fazer requisições nos dados de notas fiscais de telecom (21/22), é necessário que você já possua o `access_token`, conseguido na etapa `(oAuth)`

### GET — Listar
*Nota Fiscal / Telecom (21/22)*

```
GET {{url}}/api/v1/integracao/nota_fiscal/telecom
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `tipo_data` | `data_emissao` |
| `data_inicio` | `2020-01-01` |
| `data_fim` | `2022-08-31` |
| `documento` | `29507487000185` |
| `modelo` | `21` |
| `pagina` | `0` |
| `itens_por_pagina` | `10` |
| `order_type` | `asc` |
| `order_by` | `id_nota_fiscal` |
| `status` | `todas` |

**Descrição:**

No método `GET`, será possível consultar as Notas de Telecom emitidas e obter o retorno no formato `JSON` como resposta. Os seguintes `Query Params` podem/devem ser utilizados

| **Atributo** | **Descrição** | **Obrigatório** |
| --- | --- | --- |
| `tipo_data` | Tipo de data que será filtrada nos campos  <br>`data_inicio` e `data_fim`. Valor disponíveis: data_cadastro, data_cancelamento, data_emissao | Não |
| `data_inicio` | Data Inicial no formato YYYY-MM-DD | Sim |
| `data_fim` | Data Final no formato YYYY-MM-DD | Sim |
| `documento` | CNPJ da Empresa emitente | Sim |
| `modelo` | Modelo da Nota Fiscal. Valores aceitos: 0,21,22 | Sim |
| `pagina` | Página a ser exibida | Sim |
| `itens_por_pagina` | Itens por Página a serem exibidos. Mínimo: 1, Máximo: 500 | Sim |
| `id_nota_fiscal` | Filtra pelo ID da Nota | Não |
| `numero` | Filtra pelo número da Nota | Não |
| `order_type` | Tipo de ordenação: asc, desc | Não |
| `order_by` | Coluna para ordenação: id_nota_fiscal, numero_nota | Não |
| `status` | Coluna para consultar pelo status da nota: todas, normal ou cancelada. | Não |
| `campo_id_externo2` | Filtra Notas com base no campo id_externo2. Valores Válidos: preenchido, nao_preenchido, todos. Valor Padrão: todos | Não |
| `adiantamento` | Pode ser utilizado para filtrar notas telecom conforme o tipo de adiantamento. Os valores permitidos são: `com_adiantamento`, `sem_adiantamento` ou `todos`. O valor padrão é `todos`. | Não |

OBS: Caso queira filtrar por exemplo somente as notas fiscais canceladas, basta preencher o parâmetro `tipo_data` com o valor `data_cancelamento`.

**IMPORTANTE**: A regra para o campo de adiantamento é a seguinte: por padrão, são retornadas todas as notas. Se informado o valor com_adiantamento, serão retornadas apenas as Notas Telecom (0,21,22) em que a data de pagamento da cobrança é anterior à data de vencimento da cobrança e também anterior à data de emissão da nota. Já o valor sem_adiantamento retorna todas as demais notas que não se enquadram no critério de com_adiantamento.

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "paginacao": {
        "primeira_pagina": 0,
        "ultima_pagina": 0,
        "pagina_atual": 0,
        "total_registros": 8
    },
    "notas_fiscais": [
        {
            "id_nota_fiscal": 1254,
            "numero": "000000001",
            "serie": "U",
            "modelo": "22",
            "cfop": "5307",
            "data_emissao": "2020-01-10",
            "data_cancelamento": null,
            "valor": 35,
            "valor_bc_icms": 0,
            "valor_bc_pis": 0,
            "valor_bc_cofins": 0,
            "valor_icms": 0,
            "valor_pis": 0,
            "valor_cofins": 0,
            "valor_operacao_isenta": 35,
            "valor_fust": 0,
            "valor_funttel": 0,
            "valor_irrf": 0,
            "valor_csll": 0,
            "valor_outros": 0,
            "aliquota_icms": 0,
            "aliquota_pis": 0,
            "aliquota_cofins": 0,
            "situacao": "N",
            "informacao_complementar": "",
            "codigo_tipo_utilizacao": 2,
            "codigo_autenticacao": "E042.F575.F850.8804.ADF6.8B77.7C24.3F29",
            "competencia_fechada": false,
            "prestador": {
                "documento": "29507487000185",
                "nome_razaosocial": "HUBSOFT BRASIL LTDA",
                "nome_fantasia": "HUBSOFT"
            },
            "tomador": {
                "codigo": 1158,
                "documento": "43070592040",
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "Favor preencher os campos obrigatórios de acordo com as especificações",
  "errors": [
    "O campo modelo não contém um valor válido."
  ]
}
```

---
### PUT — Update ID Externo 2
*Nota Fiscal / Telecom (21/22)*

```
PUT {{url}}/api/v1/integracao/nota_fiscal/telecom/update_id_externo2/:id_nota_fiscal
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

Através deste `endpoint` , será possível efetuar a atualização do id_externo2 da Nota Fiscal Telecom

Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_externo2 | ID Externo2 a ser vinculado na HubSoft | Sim |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_externo2 | String | Campo livre |

**Corpo da requisição (JSON):**

```json
{
  "id_externo2": "SAP-3432"
}
```

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "O campo ID Externo 2 da Nota Fiscal foi alterado de CAMPO_VAZIO para sap_1608",
  "nota_fiscal": {
    "id_nota_fiscal": 140742
  }
}
```

---
## NFCOM

Para fazer requisições nos dados de NFCOM, é necessário que você já possua o `access_token`, conseguido na etapa `(oAuth)`

### GET — Listar
*Nota Fiscal / NFCOM*

```
GET {{url}}/api/v1/integracao/nota_fiscal/nfcom
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `tipo_data` | `data_emissao` |
| `data_inicio` | `2025-09-01` |
| `data_fim` | `2025-10-31` |
| `documento` | `29507487000185` |
| `pagina` | `0` |
| `itens_por_pagina` | `100` |
| `order_type` | `asc` |
| `order_by` | `id_nfcom` |
| `status` | `todos` |

**Descrição:**

No método `GET`, será possível consultar as Notas de Telecom emitidas e obter o retorno no formato `JSON` como resposta. Os seguintes `Query Params` podem/devem ser utilizados

| **Atributo** | **Descrição** | **Obrigatório** |
| --- | --- | --- |
| `tipo_data` | Tipo de data que será filtrada nos campos  <br>`data_inicio` e `data_fim`. Valor disponíveis: data_cadastro, data_cancelamento, data_emissao | Não |
| `data_inicio` | Data Inicial no formato `YYYY-MM-DD` | Sim |
| `data_fim` | Data Final no formato `YYYY-MM-DD` | Sim |
| `documento` | CNPJ da Empresa emitente | Sim |
| `pagina` | Página a ser exibida | Sim |
| `itens_por_pagina` | Itens por Página a serem exibidos. Mínimo: 1, Máximo: 500 | Sim |
| `id_nfcom` | Filtra pelo ID da Nota | Não |
| `n_nf` | Filtra pelo Número da Nota | Não |
| `order_type` | Tipo de ordenação: `asc`, `desc` | Não |
| `order_by` | Coluna para ordenação: `id_nfcom` | Não |
| `status` | Coluna para consultar pelo status da nota:  <br>`todos,em_transmissao,em_cancelamento,transmitida,efetivada,cancelada,rejeitada,denegada,retransmissao,timeout` | Não |
| `campo_id_externo` | Filtra Nfes com base no campo id_externo. Valores Válidos: `preenchido`, `nao_preenchido`, `todos`. Valor Padrão: `todos` | Não |
| `adiantamento` | Pode ser utilizado para filtrar nfcom conforme o tipo de adiantamento. Os valores permitidos são: `com_adiantamento`, `sem_adiantamento` ou `todos`. O valor padrão é `todos`. | Não |
| `relacoes` | Carrega os dados especificados.  <br>`xml`,  <br>`link`,  <br>`qrcode` | Não |

**IMPORTANTE1**: Caso queira filtrar por exemplo somente as notas fiscais canceladas, basta preencher o parâmetro `tipo_data` com o valor `data_cancelamento`, ou filtrar o status cancelada.

**IMPORTANTE2**: Caso queira filtrar mais de um status, basta separar por virgula, exemplo: `efetivada, cancelada.`

**IMPORTANTE3**: A regra para o campo de adiantamento é a seguinte: por padrão, são retornadas todas as notas. Se informado o valor com_adiantamento, serão retornadas apenas as NFCOM em que a data de pagamento da cobrança é anterior à data de vencimento da cobrança e também anterior à data de emissão da nota. Já o valor sem_adiantamento retorna todas as demais notas que não se enquadram no critério de com_adiantamento.

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "paginacao": {
        "primeira_pagina": 0,
        "ultima_pagina": 1,
        "pagina_atual": 0,
        "total_registros": 105
    },
    "nfcoms": [
        {
            "id_nfcom": 2856,
            "id_externo": null,
            "status": "cancelada",
            "status_codigo": "135",
            "status_mensagem": "Evento registrado e vinculado a NFCom.",
            "chave": "31250709613622000160620010000014971083623670",
            "numero_nf": 1497,
            "serie": "1",
            "modelo": "62",
            "uf": {
                "codigo": "31",
                "uf": "MG"
            },
            "ambinte": {
                "codigo_ambiente": "2",
                "descricao_ambiente": "Homologação"
            },
            "data_emissao": "2025-07-01 13:35:05-03",
            "tipo_emissao": {
                "codigo": "1",
                "descricao": "Emissão Normal"
            },
            "versao": "1.00",
            "informacao_complementar": "Contribuições para FUST (1%) e FUNTTEL (0,5%) não são repassadas às tarifas.",
            "valor_base_calculo_icms": "493.9",
            "valor_icms": "88.9",
            "valor_icms_desonado": "0",
            "valor_fundo_combate_pobreza": "9.88",
            "valor_pis": "9.88",
            "valor_cofins": "9.88",
            "valor_fust": "0.97",
            "valor_funttel": "1.93",
            "valor_retido_pis": "9.88
```
**Exemplo de resposta — Erro** (`HTTP 200 OK`)

```json
{
  "status": "error",
  "msg": "Favor preencher os campos obrigatórios de acordo com as especificações",
  "errors": [
    "O documento informado não contém um valor válido."
  ]
}
```

---
### PUT — Update ID Externo
*Nota Fiscal / NFCOM*

```
PUT {{url}}/api/v1/integracao/nota_fiscal/nfcom/update_id_externo/:id_nfcom
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

Através deste `endpoint` , será possível efetuar a atualização do id_externo da NFCOM

Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_externo | ID Externo a ser vinculado na HubSoft | Sim |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_externo | String | Campo livre |

**Corpo da requisição (JSON):**

```json
{
  "id_externo2": "SAP-3432"
}
```

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "O campo ID Externo da NFCOM foi alterado de CAMPO_VAZIO para sap_1608",
  "nfcom": {
    "id_nfcom": 1129
  }
}
```

---
## NFE (55)

### GET — Listar
*Nota Fiscal / NFE (55)*

```
GET {{url}}/api/v1/integracao/nota_fiscal/nfe
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `tipo_data` | `data_emissao` |
| `data_inicio` | `2024-06-01` |
| `data_fim` | `2024-06-30` |
| `documento` | `29507487000185` |
| `pagina` | `0` |
| `itens_por_pagina` | `10` |
| `order_type` | `asc` |
| `order_by` | `id_nfe` |

**Descrição:**

No método `GET`, será possível consultar as NFes(Nota Fiscal Eletronica - 55) emitidas e obter o retorno no formato `JSON` como resposta. Os seguintes `Query Params` podem/devem ser utilizados

| **Atributo** | **Descrição** | **Obrigatório** |
| --- | --- | --- |
| `tipo_data` | Tipo de data que será filtrada nos campos  <br>`data_inicio` e `data_fim`. Valor disponíveis: data_cadastro, , data_emissao | Não |
| `data_inicio` | Data Inicial no formato YYYY-MM-DD | Sim |
| `data_fim` | Data Final no formato YYYY-MM-DD | Sim |
| `documento` | CNPJ da Empresa emitente | Sim |
| `pagina` | Página a ser exibida | Sim |
| `itens_por_pagina` | Itens por Página a serem exibidos. Mínimo: 1, Máximo: 500 | Sim |
| `id_nfe` | Filtra pelo ID da Nota | Não |
| `numero` | Filtra pelo número da Nota | Não |
| `natureza_operacao` | Filtra a natureza de operação da Nota (Será utilizado ilike para busca) | Não |
| `cfop_produto` | Filtra o cfop dos produtos da Nota | Não |
| `order_type` | Tipo de ordenação: asc, desc | Não |
| `order_by` | Coluna para ordenação: id_nfe, numero_nf | Não |
| `status` | Coluna para consultar pelo status da nota: todos,aguardando_efetivacao,aguardando_cancelamento,cancelada,denegada,efetivada,em_transmissao,retransmissao,inutilizada,outro,aguardando_envio,rejeitada,timeout. | Não |
| `campo_id_externo` | Filtra Nfes com base no campo id_externo. Valores Válidos: preenchido, nao_preenchido, todos. Valor Padrão: todos | Não |
| `adiantamento` | Pode ser utilizado para filtrar nfes conforme o tipo de adiantamento. Os valores permitidos são: `com_adiantamento`, `sem_adiantamento` ou `todos`. O valor padrão é `todos`. | Não |
| `incluir_movimento_estoque` | Retorna os dados do movimento de estoque vinculado na NFe, caso esteja vinculado. Os valores permitidos são: `sim` ou `nao`. O valor padrão é `nao` | Não |

**Observação**: Caso não seja inserido o parâmetro status, por padrão irá consultar todos.

**IMPORTANTE**: A regra para o campo de adiantamento é a seguinte: por padrão, são retornadas todas as notas. Se informado o valor com_adiantamento, serão retornadas apenas as NFe55 vinculadas a cobranças e em que a data de pagamento da cobrança é anterior à data de vencimento da cobrança e também anterior à data de emissão da nota. Já o valor sem_adiantamento retorna todas as demais notas que não se enquadram no critério de com_adiantamento.

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "paginacao": {
        "primeira_pagina": 0,
        "ultima_pagina": 0,
        "pagina_atual": 0,
        "total_registros": 2
    },
    "nfes": [
        {
            "id_nfe": 686,
            "numero_nf": "000001051",
            "serie": "001",
            "modelo": "55",
            "valor": "151",
            "status": "rejeitada",
            "tipo_nota": {
                "codigo": "1",
                "descricao": "Saída"
            },
            "natureza_operacao": "REMESSA",
            "destino": "cliente",
            "consumidor_final": {
                "codigo": "1",
                "descricao": "Sim"
            },
            "finalidade": {
                "codigo": "1",
                "descricao": "NF-e normal"
            },
            "data_emissao": "2024-06-21T16:55:56-03:00",
            "chave": "NFe31240609613622000160550010000010511000006867",
            "recibo": "310000085097347",
            "informacao_complementar": "I - \"DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL\"\nII - \"NÃO GERA DIREITO A CRÉDITO FISCAL DE IPI\"",
            "informacao_ibpt": "VALOR APROXIMADO DE TRIBUTOS. R$ 22,29 FEDERAL, R$ 18,00 ESTADUAL, R$ 0,00 MUNICIPAL (FONTE: IBPT/EMPRESOMETRO.COM.BR | VERSÃO: 24.1.E)",
            "informacao_ad_fisco": null,
            "emitente": {
                "tipo_pessoa": "pj",
                "nome_razaosocial": "TELECOM E HARDWAR
```

---
### PUT — Update ID Externo
*Nota Fiscal / NFE (55)*

```
PUT {{url}}/api/v1/integracao/nota_fiscal/nfe/update_id_externo/:id_nfe
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

Através deste `endpoint` , será possível efetuar a atualização do id_externo da NFe

Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_externo | ID Externo a ser vinculado na HubSoft | Sim |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_externo | String | Campo livre |

**Corpo da requisição (JSON):**

```json
{
  "id_externo": "SAP-3432"
}
```

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "O campo ID Externo da NFE foi alterado de CAMPO_VAZIO para sap_1608",
  "nfe": {
    "id_nfe": 252
  }
}
```

---
## Nota de Entrada

### GET — Listar
*Nota Fiscal / Nota de Entrada*

```
GET {{url}}/api/v1/integracao/nota_fiscal/nota_entrada
```

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `data_inicio` | `2020-07-01` |
| `data_fim` | `2022-08-31` |
| `pagina` | `0` |
| `itens_por_pagina` | `50` |
| `possui_xml` | `sim` |

**Descrição:**

No método `GET`, será possível consultar as Notas de Entrada recebidas e obter o retorno no formato `JSON` como resposta. Os seguintes `Query Params` podem/ ser utilizados:

| **Atributo** | **Descrição** | **Obrigatório** |
| --- | --- | --- |
| `tipo_data` | Tipo de Data. Valores Aceitos: (`data_emissao, data_cadastro, data_entrada`). Valor Padrão: `data_emissao` |  |
| `data_inicio` | Data Inicial no formato YYYY-MM-DD | Não |
| `data_fim` | Data Final no formato YYYY-MM-DD | Não |
| `pagina` | Página a ser exibida | Não |
| `itens_por_pagina` | Itens por Página a serem exibidos. Mínimo: 1, Máximo: 50 | Não |
| `possui_xml` | Filtra pelas notas que possuem XML. Valores Aceitos: (`sim, nao, todos`). Valor Padrão: `todos` | Não |
| busca | Tipo de busca que deseja fazer. Valores Aceitos: (id_nota_entrada, numero_nota, id_empresa, id_fornecedor, id_movimento_estoque) | Não |
| termo_busca | Termo utilizado para fazer a busca | Não |

**Observação**: Caso não seja inserido os parâmetros data_inicio e data_fim, o sistema vai consultar as notas de entrada do mês vigente.

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "paginacao": {
        "primeira_pagina": 0,
        "ultima_pagina": 0,
        "pagina_atual": 1,
        "total_registros": 3
    },
    "notas_entrada": [
        {
            "id_nota_entrada": 201,
            "id_empresa": 37,
            "id_fornecedor": 2612,
            "id_usuario": 708,
            "tipo": "produto",
            "numero_nota": "236630",
            "serie": "1",
            "modelo": "55",
            "cfop": "5101",
            "valor_total": "164.81",
            "valor_icms": null,
            "valor_isento": null,
            "valor_outros": null,
            "aliquota_icms": null,
            "data_emissao": "2021-10-18 00:00:00",
            "data_entrada": "2021-10-18 00:00:00",
            "data_cadastro": "2021-11-18 10:21:37",
            "situacao": "cancelada",
            "id_xml_importado": 243,
            "chave": "31211042965269000152550010002366301537506033",
            "bc_icms": null,
            "id_estado": 11,
            "tipo_nota": "saida",
            "frete": null,
            "valor_frete": null,
            "valor_seguro": null,
            "valor_ipi": null,
            "sped_sintegra": true,
            "id_situacao_documento_fiscal": 3,
            "data_emissao_br": "18/10/2021",
            "data_entrada_br": "18/10/2021",
            "data_cadastro_br": "18/11/2021",
            "data_emissao_timestamp": 1634569200000,
            "data
```

---