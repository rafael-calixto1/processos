# Prospectos

**Necessário**

Para fazer requisições nos dados de prospectos, é necessário que você já possua o `access_token`, adquirido na etapa `(oAuth)`

## GET — Consultar (Todos)
*Prospectos*

```
GET {{url}}/api/v1/integracao/prospecto/all
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**GET**

No método `GET`, irá consultar os dados de prospectos e retornar um `JSON` como resposta. Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| convertido | Retornar prospectos convertidos | Não |
| data_inicio | Data de Cadastro do Prospecto | Não |
| data_fim | Data de Cadastro do Prospecto | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| convertido | sim,nao | nao |
| data_inicio | Formato Date (YYYY-MM-DD) | NULL |
| data_fim | Formato Date (YYYY-MM-DD) | NULL |

**Exemplo de resposta — TodosProspectos**

```json
{
  "status": "success",
  "msg": "Dados consultados com sucesso",
  "prospectos": [
      {
          "id_prospecto": 3,
          "nome_razaosocial": "FULANO DE TAL",
          "cpf_cnpj": "54691185097",
          "email": null,
          "telefone": null,
          "observacao": null,
          "id_cliente": 23360,
          "id_endereco_numero": 34934,
          "created_at": "2020-02-20 08:52:44",
          "updated_at": "2020-02-20 17:53:45",
          "tipo_pessoa": "pf",
          "id_usuario": 1,
          "origem": "web",
          "rg": null,
          "telefone_secundario": null,
          "data_nascimento": null,
          "id_vendedor": null,
          "id_vencimento": null,
          "nome_pai": null,
          "nome_mae": null,
          "estado_civil": null,
          "genero": null,
          "nacionalidade": "brasileiro",
          "profissao": null,
          "created_at_br": "20/02/2020"
      }
  }
```

---
## GET — Serviços/Planos Disponíveis
*Prospectos*

```
GET {{url}}/api/v1/integracao/prospecto/create
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `cep` | `<numero_cep>` |

**Descrição:**

## Rota e parâmetros da requisição

A rota em questão é do tipo **`GET`** e possui 1 único parâmetro obrigatório que deve ser informado junto a `URL`, o `«cep».` O parâmetro deve ser informado no formato de `_query string_`, da seguinte forma: `?cep=(numero_cep)`. O `(numero_cep),` deve ser substituído pelo valor equivalente ao CEP a ser informado para busca de serviços / planos disponíveis. Os planos disponiveis vão estar configurados na Unidade de Negocio, a aba Serviços Prospectos.

**Exemplo de resposta — CEP Válido**

```json
{
  "status": "success",
  "msg": "Dados consultados com sucesso",
  "servicos": [
    {
      "id_servico": 1330,
      "descricao": "COMBO 10 MB EM DOBRO FIXO E 3 CAMERAS RAP10",
      "valor": 254.9,
      "nome_radius": "HUBSOFT-SERVICE-1330",
      "display": "COMBO 10 MB EM DOBRO FIXO E 3 CAMERAS RAP10 - (R$ 254.90) (INATIVO)",
      "velocidade_download": 20480,
      "velocidade_upload": 4096
    },
    {
      "id_servico": 1308,
      "descricao": "PLANO 10 MBPS + IP FIXO",
      "valor": 129.9,
      "nome_radius": "HUBSOFT-SERVICE-1308",
      "display": "PLANO 10 MBPS + IP FIXO - (R$ 129.90) (INATIVO)",
      "velocidade_download": 10240,
      "velocidade_upload": 2048
    },
    {
      "id_servico": 1318,
      "descricao": "PLANO 10 MBPS RAP10 E FIXO EM DOBRO",
      "valor": 129.9,
      "nome_radius": "HUBSOFT-SERVICE-1318",
      "display": "PLANO 10 MBPS RAP10 E FIXO EM DOBRO - (R$ 129.90) (INATIVO)",
      "velocidade_download": 20480,
      "velocidade_upload": 4096
    },
    {
      "id_servico": 1319,
      "descricao": "PLANO 25 MBPS RAP10 E FIXO EM DOBRO",
      "valor": 169.9,
      "nome_radius": "HUBSOFT-SERVICE-1319",
      "display": "PLANO 25 MBPS RAP10 E FIXO EM DOBRO - (R$ 169.90) (INATIVO)",
      "velocidade_download": 51200,
      "velocidade_upload": 10240
    }
  ]
}
```
**Exemplo de resposta — CEP Válido sem unidade de négocio**

```json
{
  "status": "success",
  "msg": "Dados consultados com sucesso",
  "servicos": [
    {
      "id_servico": 1303,
      "descricao": "100-FIBRA-CLONE-TEST",
      "valor": 100,
      "nome_radius": "HUBSOFT-SERVICE-1303",
      "display": "100-FIBRA-CLONE-TEST - (R$ 100.00) (INATIVO)",
      "velocidade_download": 150000,
      "velocidade_upload": 35000
    },
    {
      "id_servico": 1292,
      "descricao": "100GB-FIBRA-CLONADO",
      "valor": 100,
      "nome_radius": "HUBSOFT-SERVICE-1292",
      "display": "100GB-FIBRA-CLONADO - (R$ 100.00) (INATIVO)",
      "velocidade_download": 150000,
      "velocidade_upload": 35000
    },
    {
      "id_servico": 1417,
      "descricao": "100GB-FIBRA-CLONE-imprimir-carne",
      "valor": 80,
      "nome_radius": "HUBSOFT-SERVICE-1417",
      "display": "100GB-FIBRA-CLONE-imprimir-carne - (R$ 80.00) (INATIVO)",
      "velocidade_download": 150000,
      "velocidade_upload": 35000
    },
    {
      "id_servico": 1410,
      "descricao": "100GB-FIBRA-XPTO",
      "valor": 80,
      "nome_radius": "HUBSOFT-SERVICE-1410",
      "display": "100GB-FIBRA-XPTO - (R$ 80.00) (INATIVO)",
      "velocidade_download": 150000,
      "velocidade_upload": 35000
    },
    {
      "id_servico": 1394,
      "descricao": "100MB + HBO",
      "valor": 100,
      "nome_radius": "HUBSOFT-SERVICE-1394",
      "display": "100MB + HBO - (R$ 100.00) (INATIVO)",
      "velocidade_download": 150000,
      "v
```

---
## POST — Adicionar Prospectos
*Prospectos*

```
POST {{url}}/api/v1/integracao/prospecto
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

A rota em questão é do tipo `POST` e o copo da requisição deve possuir os campos abaixo no JSON.

**Obs.:** _A obrigatoriedade dos campos pode ser personalizada pelo usuário no sistema._

| Campo | Descrição | Obrigatório |
| --- | --- | --- |
| cep | CEP referente ao endereço de instalação | Sim |
| servico.id_servico | Identificador único do serviço / plano de contratação | Sim |
| servico.valor | Valor em reais (R$) do serviço / plano ofertado | Sim |
| nome_razaosocial | Nome ou Razão Social do contratante | Sim |
| cpf_cnpj | CPF ou CNPJ do contratante | Não |
| telefone | Telefone principal do contratante | Sim |
| email | email principal do contratante | Não |
| observacao | Campo livre para observações do contratante | Não |
| tipo_pessoa | Informar «pj» para pessoa jurídica ou «pf» para pessoa física | Sim |
| bairro | Bairro referente ao endereço de instalação | Sim |
| endereco | Endereço referente ao local de instalação | Sim |
| numero | Número referente ao endereço de instalação | Sim |
| complemento | Complemento referente ao endereço de instalação | Não |
| referencia | Referência do endereço de instalação | Não |
| latitude | Latitude referente ao endereço de instalação | Não |
| longitude | Longitude referente ao endereço de instalação | Não |
| id_crm | ID referente ao CRM que será vinculado o prospecto | Nao |
| id_origem_cliente | ID referente a Origem do Cliente que será vinculado o prospecto | Nao |
| id_motivo_contratacao | ID referente ao Motivo de Contratao que será vinculado o prospecto | Nao |
| id_vendedor | ID referente ao Vendedor que será vinculado o prospecto | Nao |
| rg | RG que será vinculado o prospecto | Nao |
| data_nascimento | Data de Nascimento (YYYY-MM-DD) que será vinculado o prospecto | Nao |
| telefone_secundario | Telefone secundário que será vinculado o prospecto | Nao |
| id_vencimento | ID referente ao Vencimento que será vinculado o prospecto | Nao |
| nome_pai | Nome do Pai que será vinculado o prospecto | Nao |
| nome_mae | Nome da Mãe que será vinculado o prospecto | Nao |
| estado_civil | Estado Cívil que será vinculado o prospecto (solteiro,casado,viuvo,separado_judicialmente,divorciado) | Nao |
| genero | Gênero que será vinculado o prospecto (masculino,feminino,outro) | Nao |
| nacionalidade | Nacionalidade que será vinculado o prospecto (brasileiro,estrangeiro) | Nao |
| rg_emissor | RG Emissor que será vinculado o prospecto | Nao |
| id_externo | ID Externo para permitir integrações com outras plataformas | Nao |
| id_origem_servico | ID referente à Origem do Serviço | Nao |

\* Tipo de valores aceitos pelos campos:

| Campo | Tipo |
| --- | --- |
| cep | Numérico |
| servico.id_servico | Numérico |
| servico.valor | Numérico |
| nome_razaosocial | Texto |
| cpf_cnpj | Numérico |
| telefone | Numérico |
| email | Texto |
| observacao | Texto |
| tipo_pessoa | Texto |
| bairro | Texto |
| endereco | Texto |
| numero | Numérico |
| complemento | Texto |
| referencia | Texto |
| latitude | Numérico |
| longitude | Númerico |
| id_crm | Numérico |
| id_origem_cliente | Numérico |
| id_motivo_contratacao | Numérico |
| id_vendedor | Numérico |
| rg | Texto |
| data_nascimento | Date |
| telefone_secundario | Numérico |
| id_vencimento | Numérico |
| nome_pai | Texto |
| nome_mae | Texto |
| estado_civil | Texto |
| genero | Texto |
| nacionalidade | Texto |
| rg_emissor | Texto |
| id_externo | Texto |
| id_origem_servico | Numérico |

**Corpo da requisição (JSON):**

```json
{
  "cep": "35560000",
  "servico": {
    "id_servico": 1,
    "valor": 100
  },
  "cpf_cnpj": "68346567000158",
  "telefone": "3732818000",
  "nome_razaosocial": "Empresa XPTO LTDA",
  "tipo_pessoa": "pj",
  "bairro": "Centro",
  "endereco": "Praça Getúlio Vargas",
  "numero": 77,
  "latitude": "-20.0916229",
  "longitude": "-45.2929515"
}
```

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Prospecto adicionado com sucesso",
  "prospecto": {
    "nome_razaosocial": "EMPRESA XPTO LTDA",
    "telefone": "3732818000",
    "email": null,
    "observacao": null,
    "id_endereco_numero": 33320,
    "tipo_pessoa": "pj",
    "cpf_cnpj": "41483316000169",
    "id_usuario": 1,
    "origem": "API",
    "updated_at": "2020-07-28 10:27:56",
    "created_at": "2020-07-28 10:27:56",
    "id_prospecto": 100,
    "created_at_br": "28/07/2020",
    "prospecto_servico": {
      "id_prospecto_servico": 99,
      "id_prospecto": 100,
      "id_servico": 1,
      "valor": "100"
    }
  }
}
```
**Exemplo de resposta — Erro - CPF/CNPJ já cadastrado**

```json
{
  "status": "error",
  "msg": "O CPF/CNPJ já foi cadastrado antes no prospecto EMPRESA XPTO LTDA"
}
```

---
## PATCH — Editar Prospectos (Versão 1.117)
*Prospectos*

```
PATCH {{url}}/api/v1/integracao/prospecto/:id_prospecto
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

# Atualizar Prospecto

A rota em questão é do tipo `PATCH` e o corpo da requisição pode possuir os campos abaixo no JSON.

**Obs.:** _A obrigatoriedade dos campos pode ser personalizada pelo usuário no sistema._

## Campos Disponíveis

### Dados Básicos

| Campo | Descrição | Obrigatório | Tipo |
| --- | --- | --- | --- |
| tipo_pessoa | Tipo de Pessoa do Prospecto («pf» para pessoa física ou «pj» para pessoa jurídica) | Não | Texto |
| cpf_cnpj | CPF ou CNPJ do contratante | Não | Texto/Numérico |
| nome_razaosocial | Nome ou Razão Social do contratante | Não | Texto |
| email | Email principal do contratante | Não | Texto |
| telefone | Telefone principal do contratante | Não | Numérico |
| telefone_secundario | Telefone secundário do contratante | Não | Numérico |
| observacao | Campo livre para observações do contratante | Não | Texto |
| id_externo | ID Externo para permitir integrações com outras plataformas | Não | Texto |

### Dados Pessoais (Apenas para Pessoa Física)

| Campo | Descrição | Obrigatório | Tipo |
| --- | --- | --- | --- |
| rg | RG do contratante | Não | Texto |
| rg_emissor | Órgão emissor do RG | Não | Texto |
| data_nascimento | Data de Nascimento (formato: dd/mm/YYYY) | Não | Date |
| nome_pai | Nome do Pai | Não | Texto |
| nome_mae | Nome da Mãe | Não | Texto |
| estado_civil | Estado Civil (solteiro, casado, viuvo, separado_judicialmente, divorciado) | Não | Texto |
| genero | Gênero (masculino, feminino, outro) | Não | Texto |
| nacionalidade | Nacionalidade (brasileiro, estrangeiro) | Não | Texto |

### Dados de Relacionamento

| Campo | Descrição | Obrigatório | Tipo |
| --- | --- | --- | --- |
| id_origem_cliente | ID referente à Origem do Cliente | Não | Numérico |
| id_motivo_contratacao | ID referente ao Motivo de Contratação | Não | Numérico |
| id_vencimento | ID referente ao Dia de Vencimento | Não | Numérico |
| id_origem_contato | ID referente à Origem do Contato | Não | Numérico |
| id_vendedor | ID referente ao Vendedor | Não | Numérico |

### Dados do Serviço (prospecto_servico)

| Campo | Descrição | Obrigatório | Tipo |
| --- | --- | --- | --- |
| prospecto_servico.id_servico | ID do serviço/plano de contratação | Não | Numérico |
| prospecto_servico.valor | Valor em reais (R$) do serviço/plano ofertado | Não | Numérico |
| prospecto_servico.id_origem_servico | ID referente à Origem do Serviço | Não | Numérico |
| prospecto_servico.anotacoes | Anotações do Serviço | Não | Texto |

### Dados de Endereço (prospecto_endereco)

| Campo | Descrição | Obrigatório | Tipo |
| --- | --- | --- | --- |
| prospecto_endereco.cep | CEP referente ao endereço de instalação | Não | Texto |
| prospecto_endereco.endereco | Logradouro referente ao local de instalação | Não | Texto |
| prospecto_endereco.bairro | Bairro referente ao endereço de instalação | Não | Texto |
| prospecto_endereco.numero | Número referente ao endereço de instalação | Não | Texto |
| prospecto_endereco.complemento | Complemento referente ao endereço de instalação | Não | Texto |
| prospecto_endereco.referencia | Referência do endereço de instalação | Não | Texto |
| prospecto_endereco.latitude | Latitude referente ao endereço de instalação | Não | Numérico |
| prospecto_endereco.longitude | Longitude referente ao endereço de instalação | Não | Numérico |

## Importante

⚠️ **Atualização Parcial**: Todos os campos são opcionais. Os campos que não forem enviados na requisição manterão seus valores originais no banco de dados. Apenas os campos enviados serão atualizados.

⚠️ **Validação Dinâmica**: A obrigatoriedade real dos campos depende da configuração do formulário no sistema. Caso um campo seja marcado como obrigatório nas configurações e não possua valor no banco de dados, será necessário enviá-lo na requisição.

## Exemplo de Requisição

``` json
{
  "tipo_pessoa": "pf",
  "nome_razaosocial": "JOÃO DA SILVA",
  "cpf_cnpj": "12345678901",
  "email": "joao@email.com",
  "telefone": "11999998888",
  "prospecto_servico": {
    "id_servico": 10,
    "valor": 99.90
  },
  "prospecto_endereco": {
    "cep": "01001000",
    "endereco": "Praça da Sé",
    "bairro": "Sé",
    "numero": "100"
  }
}

 ```

## Respostas

### Sucesso (200)

``` json
{
  "status": "success",
  "msg": "Prospecto atualizado com sucesso"
}

 ```

### Erro - Prospecto não encontrado (200)

``` json
{
  "status": "error",
  "msg": "Prospecto não encontrado"
}

 ```

### Erro - Prospecto já convertido (200)

``` json
{
  "status": "error",
  "msg": "Prospecto foi convertido para o cliente: \"Nome do Cliente\". Não é possível alterar."
}

 ```

### Erro - Nenhum campo enviado (200)

``` json
{
  "status": "error",
  "msg": "Nenhum campo foi enviado para atualização. Envie ao menos um campo válido para alterar o prospecto."
}

 ```

### Erro - Validação (200)

``` json
{
  "status": "error",
  "msg": "Favor preencher os campos obrigatórios de acordo com as especificações",
  "errors": [
    "Email é obrigatório",
    "Telefone é obrigatório"
  ]
}

 ```

**Corpo da requisição (JSON):**

```json
{
  "nome_mae": "JOANA CAROLINA",
  "nome_pai": "JOÃO PEDRO",
  "prospecto_endereco": {
    "numero": "1563",
    "logradouro": "RUA FATIMA BERNADES",
    "referencia": "loja do toe"
  },
  "prospecto_servico": {
    "id_servico": "10"
  },
  "id_vendedor": "4870"
}
```

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Prospecto atualizado com sucesso"
}
```

---
## GET — Buscar Prospectos
*Prospectos*

```
GET {{url}}/api/v1/integracao/prospecto
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `busca` | `nome_razaosocial` |
| `termo_busca` | `xpto` |

**Descrição:**

## Rota e parâmetros da requisição

No método `GET,` irá consultar os dados dos prospectos e retornar um `JSON` como resposta. Os seguintes parâmetros devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| busca | Tipo de busca que deseja no prospecto | Sim |
| termo_busca | Busca os prospectos de acordo com o tipo de busca que for definido | Sim |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| busca | id_prospecto, nome_razaosocial, telefone, origem, email, id_externo, id_cliente, id_cliente_servico | Nenhum |
| termo_busca | Campo livre (Qualquer valor será aceito) | Nenhum |

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Dados consultados com sucesso",
  "prospectos": [
    {
      "id_prospecto": 100,
      "nome_razaosocial": "EMPRESA XPTO LTDA",
      "cpf_cnpj": "41483316000169",
      "email": null,
      "telefone": "3732818000",
      "observacao": null,
      "id_cliente": null,
      "id_endereco_numero": 33320,
      "created_at": "2020-07-28 10:27:56",
      "updated_at": "2020-07-28 10:27:56",
      "tipo_pessoa": "pj",
      "id_usuario": 1,
      "origem": "API",
      "created_at_br": "28/07/2020"
    }
  ]
}
```
**Exemplo de resposta — Erro**


---