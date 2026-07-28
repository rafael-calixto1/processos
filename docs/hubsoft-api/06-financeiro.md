# Financeiro

**Necessário**

Para fazer requisições nos dados de clientes, é necessário que você já possua o `access_token`, conseguido na etapa (`oAuth`)

## Evento de Faturamento

### POST — Adicionar
*Financeiro / Evento de Faturamento*

```
POST {{url}}/api/v1/integracao/financeiro/evento_faturamento
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

Através deste `endpoint`, será possível fazer o cadastro de evento de faturamento. Pode ser cadastrado um evento de Acréscimo ou Desconto, permitindo também parcelamento.

**Aviso**

`IMPORTANTE`: É necessário informar o `id_cliente_servico` e o `id_tipo_servico,` ambos retornados nas rotas Clientes > Consulta e Tipo de Serviço > All respectivamente

`IMPORTANTE 2:` Ao enviar a o parâmetro parcelado como true, os parâmetros `numero_total_parcelas`, `mes_primeira_parcela` e `ano_primeira_parcela` tornam-se obrigatórios

`IMPORTANTE 3`: Ao enviar a o parâmetro parcelado como false, o parâmetro `proximo_faturamento` torna-se obrigatório. Caso ele seja enviado como false, os parâmetros `mes_processar` e `ano_processar` também deverão ser enviados

**Atributos da Requisição**

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_cliente_servico | Identificador único do serviço do cliente | Sim |
| id_tipo_servico | Identificador único do tipo de serviço | Sim |
| tipo | Textual (aceita os valores acrescimo e desconto). | Sim |
| descricao | Descrição textual para o evento. | Sim |
| valor | Campo númerico (aceita valor decimal separado por ponto. Ex.: 10.2). | Sim |
| parcelado | Boolean para identificar se o evento é parcelado ou não | Sim |
| numero_total_parcelas | Valor maior que 0 para identificar o total de parcelas | Sim (Se parcelado = true) |
| mes_primeira_parcela | Valor inteiro que representa o mês do ano (Dezembro = 12). Utilizado para verificar o mês da primeira parcela | Sim (Se parcelado = true) |
| ano_primeira_parcela | Valor inteiro que representa o ano. Utilizado para verificar o ano da primeira parcela | Sim (Se parcelado = true) |
| proximo_faturamento | Boolean para identificar se o evento será lançado no próximo faturamento | Sim (Se parcelado = false) |
| mes_processar | Valor inteiro que representa o mês do ano (Dezembro = 12). Utilizado para verificar o mês de processamento do faturamento | Sim (Se proximo_faturamento = false) |
| ano_processar | Valor inteiro que representa o ano. Utilizado para verificar o ano de processamento do faturamento | Sim (Se proximo_faturamento = false) |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_cliente_servico | Deve conter um número inteiro maior que 0 | Nenhum |
| id_tipo_servico | Deve conter um número inteiro maior que 0 | Nenhum |
| tipo | Textual | Nenhum |
| descricao | Textual | Nenhum |
| valor | Número Inteiro/Decimal | Nenhum |
| parcelado | Boolean | Nenhum |
| numero_total_parcelas | Número Inteiro | Nenhum |
| mes_primeira_parcela | Número Inteiro (maior que 0 e menor que 13) | Nenhum |
| ano_primeira_parcela | Número Inteiro | Nenhum |
| proximo_faturamento | Boolean | Nenhum |
| mes_processar | Número Inteiro (maior que 0 e menor que 13) | Nenhum |
| ano_processar | Número Inteiro | Nenhum |

**Corpo da requisição (JSON):**

```json
{
  "id_cliente_servico": 13579,
  "id_tipo_servico": 2,
  "descricao": "Acréscimo Ref Compra de Produto ABC",
  "parcelado": false,
  "proximo_faturamento": true,
  "tipo": "acrescimo",
  "valor": 10.3
}
```

**Exemplo de resposta — Evento de Faturamento**

```json
{
  "status": "success",
  "msg": "1 Evento(s) de Faturamento de acréscimo cadastrados com sucesso. VALOR TOTAL: R$ 10.30",
  "eventos_faturamento": [
    {
      "id_evento_faturamento": 9714,
      "descricao": "Acréscimo Ref Compra de Produto ABC",
      "valor": 10.3
    }
  ]
}
```

---
## Fatura

### GET — Listar
*Financeiro / Fatura*

```
GET {{url}}/api/v1/integracao/financeiro/fatura
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `tipo_data` | `data_vencimento` |
| `data_inicio` | `2023-03-01` |
| `data_fim` | `2023-03-31` |
| `documento` | `00111222000155` |
| `tipo_resultado` | `simplificado` |
| `pagina` | `0` |
| `itens_por_pagina` | `100` |

**Descrição:**

**GET**

No método `GET`, irá consultar/listar os dados de faturas e retornar um `JSON` como resposta. Os dados serão retornados de forma paginada, portanto fique atento ao conjunto da dados "paginacao" que é retornado na resposta, para saber se será necessário consultar outras páginas ou não.

Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| pagina | Página a ser exibida | Não |
| itens_por_pagina | Itens por Página a serem exibidos. Mínimo: 1, Máximo: 500. | Não |
| documento | CNPJ da Empresa emissora da fatura | Não |
| busca | Tipo de busca que deseja fazer no cliente | Não |
| termo_busca | Termo utilizado para fazer a busca | Não |
| tipo_data | Tipo de data que será utilizada | Não |
| tipo_resultado | Tipo de resultado que será devolvido na resposta | Não |
| data_inicio | Data de início da filtragem de dados | Não |
| data_fim | Data final da filtragem de dados | Não |
| apenas_quitado | Indica o status desejado das faturas | Não |
| apenas_em_aberto | Indica se deseja visualizar apenas as faturas em aberto | Não |
| valor_zerado | Indica se deseja listar as faturs com valor = 0 | Não |
| exibir_pix_copia_cola | Indica se deseja exibir dados do PIX na resposta | Não |
| status_cadastro_cliente | Indica como Deve estar o cadastro do Cliente | Não |
| exibir_fatura_inativa | Parametro utilizado para retornar tambem as faturas inativas | Não |
| exibir_faturas_renegociacao | Parametro utilizado para retornar faturas de renegociacao | Não |
| grupo_cliente_servico | Filtro que ao ser preenchido irá trazer somente as faturas em que os plano dela esta vinculada aos Grupos de Serviço do Cliente que estão sendo filtrados | Não |
| grupo_cliente | Filtro que ao ser preenchido irá trazer somente as faturas em que os plano dela esta vinculada aos Grupos do Cliente que estão sendo filtrados | Não |
| relacoes | Carrega apenas os relacionamentos especificados | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| pagina | Campo Inteiro (integer) | 0 |
| itens_por_pagina | Campo Inteiro (integer) | 50 |
| documento | CNPJ da Empresa emissora | `NULL` |
| busca | id_cliente, codigo_cliente, cpf_cnpj, id_cliente_servico, uuid_cliente, uuid_cliente_servico, tipo_pessoa, nosso_numero, id_fatura, id_nota_fiscal, id_nfe, id_nfse e id_nfcom, id_perfil_suspensao | `NULL` |
| termo_busca | Campo livre (Qualquer valor será aceito) | `NULL` |
| tipo_data | data_vencimento, data_pagamento, data_cadastro | data_vencimento |
| tipo_resultado | simplificado, detalhado, completo | simplificado |
| data_inicio | Campo no formato Date (YYYY-MM-DD) | 10 dias anterioes à data atual |
| data_fim | Campo no formato Date (YYYY-MM-DD) | Data Atual |
| apenas_quitado | sim,nao | nao |
| apenas_em_aberto | sim,nao | nao |
| valor_zerado | sim,nao | nao |
| exibir_pix_copia_cola | sim,nao | nao |
| status_cadastro_cliente | ativo,inativo | todos |
| exibir_fatura_inativa | sim,nao | nao |
| exibir_faturas_renegociacao | sim,nao | sim |
| grupo_cliente_servico | Valor no formato string | NULL |
| grupo_cliente | Valor no formato string | NULL |
| relacoes | processamento_cartao | Nenhum |

**Observação**: Caso utilize o `busca` como `tipo_pessoa`, o valor de `termo_busca` deve ser `pj` ou `pf`

**Exemplo de resposta — Sucesso Simplificado**

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso.",
    "paginacao": {
        "primeira_pagina": 0,
        "ultima_pagina": 6,
        "pagina_atual": 0,
        "total_registros": 68
    },
    "faturas": [
        {
            "id_fatura": 62636,
            "nosso_numero": "1900247",
            "data_vencimento": "2020-04-05",
            "data_pagamento": "2020-04-05",
            "data_credito":"2020-04-06",
            "data_cadastro": "2020-01-01 12:52:12",
            "valor": "119.9",
            "valor_pago": "109.9",
            "valor_juros_pago": null,
            "valor_desconto": 0,
            "linha_digitavel": "75691.31662 01006.726101 27182.400013 8 72930000002827",
            "codigo_barras": "75698729300000028271316601006726102718240001",
            "tipo_cobranca": "boleto_bancario",
            "link": "https://api.meuservidor.com.br/pdf/fatura/60f15db140511d53a1fdab6367ee06bb9326b33e9fa55e8b00a52b209c09ab914b81813703f68f",
            "empresa": {
                "documento": "36636392000127",
                "nome_razaosocial": "SERVIÇOS DE TECNOLOGIA",
                "nome_fantasia": "SERVIÇOS"
            },
            "cliente": {
                "id_cliente": 11943,
                "codigo_cliente": 1162,
                "nome_razaosocial": "GUILHERME DA COSTA COUTO",
                "nome_fantasia": null,
                "tipo_pessoa": "pf",
                "cpf_cnpj": "41107296617",
```
**Exemplo de resposta — Sucesso Detalhado**

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "paginacao": {
        "primeira_pagina": 0,
        "ultima_pagina": 3,
        "pagina_atual": 0,
        "total_registros": 350
    },
    "faturas": [
        {
            "id_fatura": 109141,
            "id_carne": null,
            "id_cliente_servico": 16039,
            "nosso_numero": "66409",
            "data_vencimento": "2024-03-02",
            "data_pagamento": null,
            "data_cadastro": "2023-03-02 08:20:15",
            "data_credito": null,
            "valor_original": 253.75,
            "valor": 253.75,
            "valor_pago": 0,
            "valor_juros_pago": 0,
            "valor_desconto": 0,
            "linha_digitavel": null,
            "codigo_barras": null,
            "tipo_cobranca": "boleto_bancario",
            "link": "http://localhost:8000/pdf/fatura/869168404aa2db10fbe2818e7536772d02ea87592192b47fe3da52f247df5be79685ddb014be0616",
            "empresa": {
                "documento": "24605227000129",
                "nome_razaosocial": "COMUNICAÇÕES LTDA",
                "nome_fantasia": "XPTO"
            },
            "cliente": {
                "id_cliente": 24544,
                "codigo_cliente": 1686,
                "nome_razaosocial": "TESTE",
                "nome_fantasia": null,
                "tipo_pessoa": "pf",
                "cpf_cnpj": "09627329070",
                "data_nascimento": "1998-
```

---
### POST — Liquidar
*Financeiro / Fatura*

```
POST {{url}}/api/v1/integracao/financeiro/fatura/liquidar
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse `endpoint`, será possível fazer a liquidação de uma fatura no HubSoft. Esse endpoint é normalmente utilizado, quando se deseja utilizar uma forma externa ao HubSoft para receber o boleto de um cliente, por exemplo, um aplicativo customizado, uma central do assinante customizada, totem para auto atendimento, etc.

Os seguintes parâmetros podem/devem ser utilizados:

| **Atributo** | **Descrição** | **Obrigatório** |
| --- | --- | --- |
| id_fatura | ID da Fatura | Sim |
| id_caixa_financeiro | ID do Caixa Financeiro | Sim |
| data_pagamento | Data do Pagamento | Sim |
| data_credito | Data do Crédito | Não |
| valor_pago | Valor Pago | Sim |
| juros | Valor de Juros/Multas | Não |
| meio_pagamento | Meio de Pagamento | Não |
| tarifa | Valor de Tarifas Bancárias | Não |
| desconto | Valor de Descontos concedidos | Não |

Os atributos podem conter os seguintes valores:

| **Atributo** | **Descrição** | **Valor Default** |
| --- | --- | --- |
| id_fatura | Campo Inteiro (integer) | `NULL` |
| id_caixa_financeiro | Campo Inteiro (integer) | `NULL` |
| data_pagamento | Campo no formato Date (YYYY-MM-DD) | `NULL` |
| data_credito | Campo no formato Date (YYYY-MM-DD) | data_pagamento |
| valor_pago | Campo númerico com 2 casas decimais. EX: R$ 99,85 = 99.87 | `NULL` |
| juros | Campo númerico com 2 casas decimais. EX: R$ 99,90 = 99.90 | `NULL` |
| meio_pagamento | Prefixo do Meio de Pagamento. | dinheiro |
| tarifa | Campo númerico com 2 casas decimais. EX: R$ 2.10 = 2.10 | Nota 1\* |
| desconto | Campo número com 2 casas decimais. Ex: R$ 0.99 = 0.99 | Nota 2\* |

O campo `meio_pagamento` possui por padrão os seguintes prefixos:

- `boleto`
- `cartao_credito`
- `cartao_debito`
- `cheque`
- `debito_automatico`
- `dinheiro`
- `pix`
- `transferencia`
    

Porém, caso seja necessário utilizar outros meios de pagamento, basta fazer o cadastro pela interface WEB do sisema em `Configuração > Financeiro > Meios de Pagamento`

Para consultar via API todos os meios de pagamento, você pode verificar através do endpoint de [Configuração > Meio de Pagamento](https://docs.hubsoft.com.br/#e3ef9dcf-aaf7-4ebd-a6b2-f890827653e3)

Para consultar via API todos os IDs dos Caixas Financeiros disponíveis, você pode verificar através do endpoint de [Configuração > Caixa Financeiro](https://docs.hubsoft.com.br/#431b8688-0ae9-44b1-bc16-5ae888b0dc99)

- **Nota 1:** O campo de `tarifa` caso não seja passado na request, irá validar se possui a tarifa com ocorrencia liquidado_api cadastrada na configuração da forma de cobrança, caso tenha, utiliza ela, senão irá possuir o valor 0.
- **Nota 2:** O campo de `desconto` mesmo sendo enviado na request, não subtrai do saldo final. Ele apenas será documentado no sistema, porém para abater o saldo final, deverá já ser enviado no campo `valor_pago`

**Corpo da requisição (JSON):**

```json
{
  "id_fatura": 93723,
  "id_caixa_financeiro": 123,
  "meio_pagamento": "cartao_credito",
  "data_pagamento": "2022-11-23",
  "valor_pago": 89.9
}
```

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Liquidação efetuada com sucesso",
  "recibo": {
    "id_recibo": 2514,
    "numero_recibo": "622fffb79b057",
    "data_pagamento": "2022-11-23",
    "data_credito": "2022-11-23",
    "valor_pago": 89.9,
    "tarifa": 2.1,
    "cliente": {
      "codigo_cliente": 1382,
      "nome_razaosocial": "GUILHERME DA COSTA COUTO",
      "cpf_cnpj": "12345678900"
    }
  }
}
```
**Exemplo de resposta — Erro**

```json
{
  "status": "error",
  "msg": "A fatura de ID 93723 já encontra-se quitada com data de pagamento em 23/11/2022",
  "errors": []
}
```

---
## Renegociação

### GET — Listar
*Financeiro / Renegociação*

```
GET {{url}}/api/v1/integracao/financeiro/renegociacao
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
| `data_inicio` | `2024-06-01` |
| `data_fim` | `2024-06-30` |
| `ducumento_empresa` | `` |
| `documento_cliente` | `` |
| `usuario` | `` |
| `status` | `` |

**Descrição:**

**GET**

No método `GET`, irá consultar/listar os dados de renegociações e retornar um `JSON` como resposta. Os dados serão retornados de forma paginada, portanto fique atento ao conjunto da dados "paginacao" que é retornado na resposta, para saber se será necessário consultar outras páginas ou não.

Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| pagina | Página a ser exibida | Não |
| itens_por_pagina | Itens por Página a serem exibidos. Mínimo: 1, Máximo: 500. | Não |
| data_inicio | Data de início da filtragem de dados | Não |
| data_fim | Data final da filtragem de dados | Não |
| ducumento_empresa | CNPJ da Empresa Responsável pela Renegociação | Não |
| documento_cliente | CPF/CNPJ do Cliente que teve Renegociação | Não |
| usuario | Email do Usuário Responsável pela Renegociação | Não |
| status | Status da Renegociação | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| pagina | Campo Inteiro (integer) | 0 |
| itens_por_pagina | Campo Inteiro (integer) | 50 |
| data_inicio | Campo no formato Date (YYYY-MM-DD) | 30 dias anterioes à data atual |
| data_fim | Campo no formato Date (YYYY-MM-DD) | Data Atual |
| ducumento_empresa | CNPJ da Empresa Responsável pela Renegociação | NULL |
| documento_cliente | CPF/CNPJ do Cliente que teve Renegociação | NULL |
| usuario | Email | NULL |
| status | todos, aguardando, vencido, pago, cancelado | todos |

**Importante**: Os campos `documento_empresa`, `documento_cliente`, `usuario` e `status` podem receber múltiplos valores separados por vírgulas. Por exemplo, para filtrar por múltiplos usuários, você pode fornecer uma string como `bianca@hubsoft.com.br, teste@hubsoft.com.br`.

Exemplos de Uso:

- **documento_empresa**: 12345678901234, 98765432109876
    
- **documento_cliente**: 11122233344, 55566677788
    
- **usuario**: [bianca.couto@hubsoft.com.br](https://mailto:bianca.couto@hubsoft.com.br), [teste@hubsoft.com.br](https://mailto:teste@hubsoft.com.br)
    
- **status**: pendente, pago

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "paginacao": {
        "primeira_pagina": 0,
        "ultima_pagina": 0,
        "pagina_atual": 0,
        "total_registros": 19
    },
    "renegociacoes": [
        {
            "id_renegociacao": 795,
            "codigo": "795",
            "tipo": "avista",
            "parcelas": 1,
            "valor_total": "717.13",
            "valor_descontos": "0",
            "valor_encargos": "41.24",
            "valor_final": "758.37",
            "status": "cancelado",
            "valor_pago": 0,
            "valor_vencido": 0,
            "valor_aguardando": 0,
            "data_cadastro": "19/06/2024 18:05",
            "observacao": "teste teste",
            "empresa": {
                "id_empresa": 217,
                "documento": "92469725000141",
                "nome_razaosocial": "EMPRESA TESTE C",
                "nome_fantasia": "EMPRESA TESTE"
            },
            "usuario": {
                "id_usuario": 4897,
                "nome": "Iasmin",
                "email": "iasmin@hubsoft.com.br"
            },
            "cliente": {
                "id_cliente": 10826,
                "uuid_cliente": "8116d324-e901-48bf-a7ea-b3f9d4cabde0",
                "codigo_cliente": 46,
                "nome_razaosocial": "ALINE APARECIDA RODRIGUES",
                "tipo_pessoa": "pf",
                "documento": "11553476689",
                "
```

---
### POST — Simular
*Financeiro / Renegociação*

```
POST {{url}}/api/v1/integracao/financeiro/renegociacao/simular
```

**Descrição:**

**POST**

No método `POST`, irá realizar a simulação da renegociação e retornar um `JSON` como resposta. A simulação será feita de duas formas dependendo se o Provedor utiliza ou não as Regras de Renegociação. Caso o Provedor utilize as Regras, a simulação vai buscar uma Regra ideal para a mesma.  
  
Caso o provedor utilize regras de renegociação, mas as faturas selecionadas não se adequem a nenhuma regra, será validado se existe alguma Regra de Renegociação Recomendada (no caso, será a Regra de Renegociação que necessita que a menor quantidade de faturas sejam removidas para que a renegociação seja válida). Caso nenhuma Regra de Renegociação se torne válida com ao menos uma das faturas estando válidas, nenhuma Regra de Renegociação será recomendada.  

Os seguintes parâmetros podem/devem ser utilizados para Renegociação utilizando uma Regra de Renegociação (os mesmos também são necessários para a Renegociação sem regra):

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| vencimento | Data de Vencimento da primeira parcela da Renegociação | Sim |
| faturas | Define se vai pegar todas as faturas vencidas do cliente ou se vão ser apenas uma/algumas selecionada(s) | Sim |
| ids_faturas | Os id's das faturas escolhidas | Apenas se o campo faturas for `definir_faturas` |
| tipo_dados_cliente | Define se o cliente titular das faturas para renegociação vai ser identificado pelo id ou código do cliente | Sim |
| dados_cliente | Dados do Cliente titular da Renegociação | Sim |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| vencimento | Campo no formato Date (YYYY-MM-DD) | NULL |
| faturas | `todas_faturas_vencidas` ou `definir_faturas` | NULL |
| ids_faturas | Campo Inteiro (integer) - Separar por virgulas ex: `[163990, 161938]` | NULL |
| tipo_dados_cliente | `id_cliente` ou `codigo_cliente` | NULL |
| dados_cliente | Campo Inteiro (integer) | NULL |
| quantidade_parcelas | Campo Inteiro (integer) | 1 |

Quando uma Regra de Renegociação não for encontrada, será necessário/opcional adicionar os seguintes campos:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| categoria_desconto | o ID desejado para a Categoria de Desconto da Renegociação | Não |
| cliente_servico | o ID do Serviço do Cliente que ficará definido nas Faturas da Renegociação | Não |
| empresa | o ID da Empresa que ficará vinculada na Renegociação | Sim |
| forma_cobranca | o ID da Forma de Cobrança que será utilizada nas Faturas da Renegociação | Sim |
| encargos | Numérico | Não |
| descontos | Numérico | Não |
| observacao | Texto (string) | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| categoria_desconto | Campo Inteiro (integer) | id referente à Categoria de Desconto de Renegociação padrão do sistema. |
| cliente_servico | Campo Inteiro (integer) | Será definido algum dos serviços presentes nas faturas, caso não passe nenhum. |
| empresa | Campo Inteiro (integer) | NULL |
| forma_cobranca | Campo Inteiro (integer) | NULL |
| encargos | Numérico | 0.00 |
| descontos | Numérico | 0.00 |
| observacao | Texto (string) | NULL |
| data_base | Campo no formato Date (YYYY-MM-DD) | NULL |

**Corpo da requisição (JSON):**

```json
//PARA RENEGOCIAÇÃO COM REGRA DE RENEGOCIAÇÃO:
{
  "vencimento": "2025-04-15",
  "faturas": "definir_faturas",
  "quantidade_parcelas": 3,
   "ids_faturas": [163990, 161938],
  "tipo_dados_cliente": "id_cliente",
  "dados_cliente": 25586
}
//PARA RENEGOCIAÇÃO SEM REGRA DE RENEGOCIAÇÃO:
{
  "vencimento": "2025-04-05",
  "faturas": "definir_faturas",
  "quantidade_parcelas": 3,
   "ids_faturas": [163990, 161938],
  "tipo_dados_cliente": "id_cliente",
  "dados_cliente": 25586,
  "cliente_servico": 19376,
  "forma_cobranca": 904,
  "empresa": 218
}
```

**Exemplo de resposta — Simular** (`HTTP 200 OK`)

```json
{
  "status": "success",
  "msg": "Renegociação efetuada com sucesso, no valor de R$ 153,55",
  "regra_utilizada": "Regra de Renegociação - Padrão",
  "faturas_que_foram_geradas": [
    {
      "parcela": 1,
      "totalParcelas": 3,
      "valor": 51.18,
      "data_vencimento": "2025-06-17",
      "data_base": "2025-06-16",
      "descricao": "Ref. Negociação em 16/06/2025. Parcela (1/3)"
    },
    {
      "parcela": 2,
      "totalParcelas": 3,
      "valor": 51.18,
      "data_vencimento": "2025-07-17",
      "data_base": "2025-06-16",
      "descricao": "Ref. Negociação em 16/06/2025. Parcela (2/3)"
    },
    {
      "parcela": 3,
      "totalParcelas": 3,
      "valor": 51.19,
      "data_vencimento": "2025-08-17",
      "data_base": "2025-06-16",
      "descricao": "Ref. Negociação em 16/06/2025. Parcela (3/3)"
    }
  ]
}
```

---
### POST — Efetivar
*Financeiro / Renegociação*

```
POST {{url}}/api/v1/integracao/financeiro/renegociacao/efetivar
```

**Descrição:**

**POST**

No método `POST`, irá realizar a efetivação da renegociação e retornar um `JSON` como resposta. A efetivação será feita de duas formas dependendo se o Provedor utiliza ou não as Regras de Renegociação. Caso o Provedor utilize as Regras, a efetivação pegará a Regra ideal para a mesma. É sempre recomendado utilizar a rota de simulação antes de fazer a efetivação da Renegociação.

Os seguintes parâmetros podem/devem ser utilizados para Renegociação utilizando uma Regra de Renegociação (os mesmos também são necessários para a Renegociação sem regra):

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| vencimento | Data de Vencimento da primeira parcela da Renegociação | Sim |
| faturas | Define se vai pegar todas as faturas vencidas do cliente ou se vão ser apenas uma/algumas selecionada(s) | Sim |
| ids_faturas | Os id's das faturas escolhidas | Apenas se o campo faturas for `definir_faturas` |
| tipo_dados_cliente | Define se o cliente titular das faturas para renegociação vai ser identificado pelo id ou código do cliente | Sim |
| dados_cliente | Dados do Cliente titular da Renegociação | Sim |
| quantidade_parcelas | Define a quantidade de parcelas | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| vencimento | Campo no formato Date (YYYY-MM-DD) | NULL |
| faturas | `todas_faturas_vencidas` ou `definir_faturas` | NULL |
| ids_faturas | Campo Inteiro (integer) - Separar por virgulas ex: `[163990, 161938]` | NULL |
| tipo_dados_cliente | `id_cliente` ou `codigo_cliente` | NULL |
| dados_cliente | Campo Inteiro (integer) | NULL |
| quantidade_parcelas | Campo Inteiro (integer) | 1 |

Quando uma Regra de Renegociação não for encontrada, será necessário/opcional adicionar os seguintes campos:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| categoria_desconto | o ID desejado para a Categoria de Desconto da Renegociação | Não |
| cliente_servico | o ID do Serviço do Cliente que ficará definido nas Faturas da Renegociação | Não |
| empresa | o ID da Empresa que ficará vinculada na Renegociação | Sim |
| forma_cobranca | o ID da Forma de Cobrança que será utilizada nas Faturas da Renegociação | Sim |
| encargos | Numérico | Não |
| descontos | Numérico | Não |
| observacao | Texto (string) | Não |
| data_base | Data Base das parcelas da Renegociação | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| categoria_desconto | Campo Inteiro (integer) | id referente à Categoria de Desconto de Renegociação padrão do sistema. |
| cliente_servico | Campo Inteiro (integer) | Será definido algum dos serviços presentes nas faturas, caso não passe nenhum. |
| empresa | Campo Inteiro (integer) | NULL |
| forma_cobranca | Campo Inteiro (integer) | NULL |
| encargos | Numérico | 0.00 |
| descontos | Numérico | 0.00 |
| observacao | Texto (string) | NULL |
| data_base | Campo no formato Date (YYYY-MM-DD) | NULL |

Dessa forma, as novas faturas serão criadas assim como uma nova renegociação em nome do Cliente escolhido.

**Corpo da requisição (JSON):**

```json
//PARA RENEGOCIAÇÃO COM REGRA DE RENEGOCIAÇÃO:
{
  "vencimento": "2025-04-15",
  "faturas": "definir_faturas",
  "quantidade_parcelas": 3,
   "ids_faturas": [163990, 161938],
  "tipo_dados_cliente": "id_cliente",
  "dados_cliente": 25586
}
//PARA RENEGOCIAÇÃO SEM REGRA DE RENEGOCIAÇÃO:
{
  "vencimento": "2025-04-05",
  "faturas": "definir_faturas",
  "quantidade_parcelas": 3,
   "ids_faturas": [163990, 161938],
  "tipo_dados_cliente": "id_cliente",
  "dados_cliente": 25586,
  "cliente_servico": 19376,
  "forma_cobranca": 904,
  "empresa": 218
}
```

**Exemplo de resposta — Efetivar** (`HTTP 200 OK`)

```json
{
  "status": "success",
  "msg": "Renegociação efetuada com sucesso, no valor de R$ 1394,70",
  "regra_utilizada": "Regra de Renegociação Padrão",
  "faturas_que_foram_geradas": [
    {
      "parcela": 1,
      "totalParcelas": 3,
      "valor": 464.9,
      "data_vencimento": "2025-04-15",
      "descricao": "Ref. Negociação em 07/04/2025. Parcela (1/3)"
    },
    {
      "parcela": 2,
      "totalParcelas": 3,
      "valor": 464.9,
      "data_vencimento": "2025-05-15",
      "descricao": "Ref. Negociação em 07/04/2025. Parcela (2/3)"
    },
    {
      "parcela": 3,
      "totalParcelas": 3,
      "valor": 464.9,
      "data_vencimento": "2025-06-15",
      "descricao": "Ref. Negociação em 07/04/2025. Parcela (3/3)"
    }
  ]
}
```

---
## Cobranca

### Cobrança Avulsa

#### GET — Listar
*Financeiro / Cobranca / Cobrança Avulsa*

```
GET {{url}}/api/v1/integracao/financeiro/cobranca/cobranca_avulsa
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
| `tipo_data` | `data_vencimento` |
| `data_inicio` | `2025-04-01` |
| `data_fim` | `2025-04-30` |

**Descrição:**

**GET**

No método `GET`, irá consultar/listar os dados de faturas e retornar um `JSON` como resposta. Os dados serão retornados de forma paginada, portanto fique atento ao conjunto da dados "paginacao" que é retornado na resposta, para saber se será necessário consultar outras páginas ou não.

Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| pagina | Página a ser exibida | Não |
| itens_por_pagina | Itens por Página a serem exibidos. Mínimo: 1, Máximo: 500. | Não |
| documento | CNPJ da Empresa emissora da cobrança | Não |
| busca | Tipo de busca que deseja fazer no cliente | Não |
| termo_busca | Termo utilizado para fazer a busca | Não |
| tipo_data | Tipo de data que será utilizada | Não |
| data_inicio | Data de início da filtragem de dados | Não |
| data_fim | Data final da filtragem de dados | Não |
| apenas_quitado | Indica o status desejado das cobranças | Não |
| apenas_em_aberto | Indica se deseja visualizar apenas as cobranças em aberto | Não |
| valor_zerado | Indica se deseja listar as cobranças com valor = 0 | Não |
| status_cadastro_cliente | Indica como Deve estar o cadastro do Cliente | Não |
| exibir_cobranca_inativa | Parametro utilizado para retornar tambem as cobranças inativas | Não |
| grupo_cliente_servico | Filtro que ao ser preenchido irá trazer somente as cobranças em que os plano dela esta vinculada aos Grupos de Serviço do Cliente que estão sendo filtrados |  |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| pagina | Campo Inteiro (integer) | 0 |
| itens_por_pagina | Campo Inteiro (integer) | 50 |
| documento | CNPJ da Empresa emissora | `NULL` |
| busca | id_cliente, codigo_cliente, cpf_cnpj, id_cliente_servico, uuid_cliente, uuid_cliente_servico, tipo_pessoa, id_cobranca | `NULL` |
| termo_busca | Campo livre (Qualquer valor será aceito) | `NULL` |
| tipo_data | data_vencimento, data_pagamento, data_cadastro | data_vencimento |
| data_inicio | Campo no formato Date (YYYY-MM-DD) | 10 dias anterioes à data atual |
| data_fim | Campo no formato Date (YYYY-MM-DD) | Data Atual |
| apenas_quitado | sim,nao | nao |
| apenas_em_aberto | sim,nao | nao |
| valor_zerado | sim,nao | nao |
| status_cadastro_cliente | ativo,inativo | todos |
| exibir_cobranca_inativa | sim,nao | nao |
| grupo_cliente_servico | Valor no formato string | NULL |

**Observação**: Caso utilize o `busca` como `tipo_pessoa`, o valor de `termo_busca` deve ser `pj` ou `pf`

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "paginacao": {
        "primeira_pagina": 0,
        "ultima_pagina": 0,
        "pagina_atual": 0,
        "total_registros": 77
    },
    "cobrancas_avulsas": [
        {
            "id_cobranca": 411335,
            "uuid_cobranca": "bc05b8e3-20d5-4fbe-9aea-8f04af7613b5",
            "descricao": "teste",
            "status": "Aguardando",
            "data_vencimento": "2025-01-07",
            "data_pagamento": null,
            "data_cadastro": "2025-01-20 12:27:09",
            "data_credito": null,
            "valor_original": 100,
            "valor": 100,
            "valor_pago": 0,
            "valor_desconto": 0,
            "tipo_cobranca": "boleto_bancario",
            "nota_fiscal": {
                "id_nota": null,
                "modelo": null
            },
            "id_cliente_servico": 13230,
            "empresa": {
                "documento": "29507487000185",
                "nome_razaosocial": "HUBSOFT BRASIL LTDA",
                "nome_fantasia": "HUBSOFT"
            },
            "cliente": {
                "id_cliente": 12051,
                "uuid_cliente": "fba80ba8-cf24-4164-a915-add6e94be61a",
                "codigo_cliente": 1235,
                "nome_razaosocial": "LEVITA SIMÕES DE SOUSA",
                "nome_fantasia": null,
                "tipo_pessoa": "pf",
                "cpf_cnpj": "14304268619",
```

---
## Conta a Pagar

### GET — Listar
*Financeiro / Conta a Pagar*

```
GET {{url}}/api/v1/integracao/financeiro/conta_pagar
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `tipo_data` | `data_vencimento` |
| `data_inicio` | `2025-11-01` |
| `data_fim` | `2025-11-30` |
| `pagina` | `0` |
| `itens_por_pagina` | `100` |

**Descrição:**

**GET**

No método `GET`, irá consultar/listar os dados de conta a pagar e retornar um `JSON` como resposta. Os dados serão retornados de forma paginada, portanto fique atento ao conjunto da dados "paginacao" que é retornado na resposta, para saber se será necessário consultar outras páginas ou não.

Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| pagina | Página a ser exibida | Não |
| itens_por_pagina | Itens por Página a serem exibidos. Mínimo: 1, Máximo: 500. | Não |
| documento | CNPJ da Empresa vinculada na Conta a Pagar | Não |
| busca | Tipo de busca que deseja fazer no cliente | Não |
| termo_busca | Termo utilizado para fazer a busca | Não |
| tipo_data | Tipo de data que será utilizada | Não |
| data_inicio | Data de início da filtragem de dados | Não |
| data_fim | Data final da filtragem de dados | Não |
| status | Indica se filtrará as contas pagas/em_aberto | Não |
| ativo | Indica se listará as contas ativas/canceladas | Não |
| order_by | Ordenação da listagem | Não |
| order_type | Tipo de Ordenação da listagem | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| pagina | Campo Inteiro (integer) | 0 |
| itens_por_pagina | Campo Inteiro (integer) | 50 |
| documento | CNPJ da Empresa vinculada na Conta a Pagar | `NULL` |
| busca | id_conta_pagar, descricao, valor, valor_pago, fornecedor, plano_conta | `NULL` |
| termo_busca | Campo livre (Qualquer valor será aceito) | `NULL` |
| tipo_data | data_vencimento, data_pagamento, data_cadastro, data_nota_fiscal, data_emissao | data_vencimento |
| data_inicio | Campo no formato Date (YYYY-MM-DD) | 10 dias anterioes à data atual |
| data_fim | Campo no formato Date (YYYY-MM-DD) | 10 dias posteriores à data Atual |
| status | pago, nao_pago, quitado_parcial, todos | todos |
| ativo | sim, nao, todos | sim |
| order_by | id_conta_pagar, data_vencimento, data_pagamento, data_cadastro, valor | id_conta_pagar |
| order_type | ASC, DESC | ASC |

**Exemplo de resposta — Sucesso**

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
    "contas_pagar": [
        {
            "id_conta_pagar": 18824,
            "ativo": true,
            "descricao": "salario bianca",
            "status": "nao_pago",
            "status_formatado": "Aguardando",
            "data_vencimento": "2025-11-30",
            "data_pagamento": null,
            "data_cadastro": "2025-08-15 09:11:06",
            "data_emissao": null,
            "valor": 1000,
            "valor_pago": 0,
            "valor_acrescimo": 0,
            "valor_desconto": 0,
            "empresa": {
                "id_empresa": 59,
                "documento": "39809271000128",
                "nome_razaosocial": "ABC TECH LTDA",
                "nome_fantasia": null
            },
            "fornecedor": {
                "id_fornecedor": 3744,
                "documento": "01684597000101",
                "nome_razaosocial": "BIANCA EQUIPAMENTOS LTDA",
                "nome_fantasia": null,
                "tipo_pessoa": null
            },
            "plano_conta": [
                {
                    "id_plano_conta": 482,
                    "descricao": "02.02.07.Telefonia - Fixa - teste",
                    "valor": 200,
                    "percentual": 20
                },
```

---