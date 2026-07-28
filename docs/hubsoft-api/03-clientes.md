# Clientes

Para realizar requisições nos dados de clientes, é necessário que você já possua o `access_token`, conseguido na etapa `(oAuth)`

## Atendimento

### GET — Consultar
*Clientes / Atendimento*

```
GET {{url}}/api/v1/integracao/cliente/atendimento
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**GET**

No método `GET`, será possível consultar os atendimentos em aberto/fechados dos clientes e obter o retorno no formato `JSON` como resposta. Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| busca | Tipo de busca que deseja fazer no cliente | Sim |
| termo_busca | Termo utilizado para fazer a busca | Sim |
| limit | Limite de resultados | Não |
| apenas_pendente | Informa de deseja trazer apenas os atendimentos pendentes (abertos) | Não |
| order_by | Campo que será utilizado para ordenação | Não |
| order_type | Tipo de Ordenação | Não |
| data_inicio | Data de Início (Utiliza a data de cadastro como base) | Não |
| data_fim | Data de Fim (Utiliza a data de cadastro como base) | Não |
| tipo_data | Tipo de Data a ser consultado | Não |
| relacoes | Carrega apenas os relacionamentos especificados | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| busca | codigo_cliente, cpf_cnpj, id_cliente_servico, protocolo | Nenhum |
| termo_busca | Campo livre (Qualquer valor será aceito) | Nenhum |
| limit | Valor mínimo 1, Valor máximo 50. | 20 |
| apenas_pendente | sim,nao | sim |
| order_by | data_cadastro,data_fechamento | data_cadastro |
| order_type | asc,desc | asc |
| data_inicio | Campo no formato DateTime (YYYY-MM-DD) | Nenhum |
| data_fim | Campo no formato DateTime (YYYY-MM-DD) | Nenhum |
| tipo_data | data_cadastro,data_fechamento | data_cadastro |
| relacoes | atendimento_mensagem,ordem_servico_mensagem,checklists | Nenhum |

**Exemplo de resposta — Sucesso**

```json
{
    "status": "suscess",
    "msg": "Dados consultados com sucesso",
    "atendimentos": [
        {
            "id_atendimento": 110,
            "protocolo": "201806191505251",
            "descricao_abertura": "VERIFICAR CONEXÃO",
            "descricao_fechamento": null,
            "tipo_atendimento": "TÉCNICO - QUEDAS DE CONEXÃO",
            "usuario_abertura": "Bianca Couto",
            "usuario_responsavel": "Bianca Couto",
            "usuario_fechamento": null,
            "data_cadastro": "19/06/2018",
            "data_fechamento": null,
            "setor_responsavel": null,
            "status_fechamento": null,
            "motivo_fechamento": null,
            "status": "Pendente",
            "cliente": {
                "codigo_cliente": 1204,
                "nome_razaosocial": "BIANCA COUTO",
                "cpf_cnpj": "86214941081"
            },
            "servico": {
                "id_cliente_servico":"123",
            "numero_plano": 0,
            "nome": "5MB-WIRELLES-TESTE",
            "valor": 199.9,
            "status": "Cancelado",
            "status_prefixo": "cancelado"
        },
            "ordens_servico": [
                {
                    "id_ordem_servico": 131,
                    "numero_ordem_servico": "125",
                    "data_cadastro": "19/06/2018 15:05:25",
                    "tipo": "SUPORTE",
                    "data_inicio_programado": "19/06/2018 14:02:00",
```

---
## Cliente Serviço

### Documentação de Senhas

#### POST — Adicionar
*Clientes / Cliente Serviço / Documentação de Senhas*

```
POST {{url}}/api/v1/integracao/cliente/cliente_servico/senhas
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

Através deste `endpoint`, será possível fazer o cadastro de senhas para o serviço do cliente.

**Aviso**

`IMPORTANTE`: É necessário informar o `id_cliente_servico`, a `descricao`, o `usuario` e a `senha.`

**Atributos da Requisição**

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_cliente_servico | Identificador único do serviço do cliente | Sim |
| descricao | Descrição da Documentação da Senha | Sim |
| usuario | Usuário da Documentação da Senha | Sim |
| senha | Senha da Documentação da Senha | Sim |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_cliente_servico | Deve conter um número inteiro maior que 0 | Nenhum |
| descricao | Textual | Nenhum |
| usuario | Textual | Nenhum |
| senha | Textual | Nenhum |

**Corpo da requisição (JSON):**

```json
{
  "id_cliente_servico": "1423",
  "descricao": "ACESSO ROTEADOR",
  "usuario": "admin",
  "senha": "admin2"
}
```

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Cliente Serviço Senha cadastrado com sucesso",
  "cliente_servico_senha": {
    "id_cliente_servico_senha": 971,
    "id_cliente_servico": "22336",
    "descricao": "ACESSO ROTEADOR",
    "usuario": "admin",
    "senha": "admin2"
  }
}
```

---
#### GET — Consultar
*Clientes / Cliente Serviço / Documentação de Senhas*

```
GET {{url}}/api/v1/integracao/cliente/cliente_servico/:id_cliente_servico/senhas
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**GET**

Através deste `endpoint`, será possível consultar as senhas de um serviço do cliente.

**Aviso**

`IMPORTANTE`: É necessário informar o `id_cliente_servico` nos parametros

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Senhas do cliente serviço recuperada com sucesso",
  "cliente_servico_senha": [
    {
      "id_cliente_servico_senha": 967,
      "id_cliente_servico": 22390,
      "descricao": "SENHA ROTEADOR",
      "usuario": "admin",
      "senha": "admin"
    },
    {
      "id_cliente_servico_senha": 966,
      "id_cliente_servico": 22390,
      "descricao": "AP_API",
      "usuario": "testeapi",
      "senha": "senhaapi"
    }
  ]
}
```

---
#### PUT — Editar
*Clientes / Cliente Serviço / Documentação de Senhas*

```
PUT {{url}}/api/v1/integracao/cliente/cliente_servico/senhas/:id_cliente_servico_senha
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

Através deste `endpoint`, será possível realizar a edição de senhas do serviço do cliente.

**IMPORTANTE:** É obrigatório informar o `id_cliente_servico_senha` como parâmetro. Os campos `descricao`, `usuario` e `senha` no corpo da requisição são opcionais, podendo ser enviados individualmente conforme a necessidade. No entanto, é necessário que pelo menos um desses campos seja informado para que a atualização seja realizada.

**Atributos da Requisição**

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| descricao | Descrição da Documentação da Senha | Não |
| usuario | Usuário da Documentação da Senha | Não |
| senha | Senha da Documentação da Senha | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| descricao | Textual | Nenhum |
| usuario | Textual | Nenhum |
| senha | Textual | Nenhum |

**Corpo da requisição (JSON):**

```json
{
  "descricao": "ACESSO ROTEADOR",
  "usuario": "adminnovo",
  "senha": "admin2"
}
```

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Cliente Serviço Senha editado com sucesso",
  "cliente_servico_senha": {
    "id_cliente_servico_senha": 971,
    "id_cliente_servico": 22336,
    "descricao": "ACESSO ROTEADOR",
    "usuario": "adminnovo",
    "senha": "admin2"
  }
}
```

---
#### DELETE — Remover
*Clientes / Cliente Serviço / Documentação de Senhas*

```
DELETE {{url}}/api/v1/integracao/cliente/cliente_servico/senhas/:id_cliente_servico_senha
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

Através deste `endpoint`, será possível apagar a senha do serviço do cliente.

**IMPORTANTE:** É obrigatório informar o `id_cliente_servico_senha` como parâmetro.

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Cliente Serviço Senha apagado com sucesso"
}
```

---
### PUT — Editar Cliente Serviço
*Clientes / Cliente Serviço*

```
PUT {{url}}/api/v1/integracao/cliente/cliente_servico/editar/:id_cliente_servico
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**PUT**

No método PUT, será possível editar os dados de cadastro do cliente.

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_forma_cobranca | Forma de Cobrança | Somente se for o único parâmetro informado. |
| id_usuario_vendedor | Usuário Vendedor | Somente se for o único parâmetro informado. |
| id_servico_status | Status do Serviço | Somente se for o único parâmetro informado. |
| data_venda | Data de Venda do Serviço | Somente se for o único parâmetro informado. |
| id_perfil_suspensao | Perfil de Suspensão | Somente se for o único parâmetro informado. |
| grupos_cliente_servico | Dados para alteração dos grupos do serviço | Somente se for o único parâmetro informado. |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_forma_cobranca | Inteiro | Nenhum |
| id_usuario_vendedor | Inteiro | Nenhum |
| id_servico_status | Inteiro | Nenhum |
| data_venda | Date (YYYY-MM-DD) | Nenhum |
| id_perfil_suspensao | Inteiro ou texto padrao_forma_cobranca | Nenhum |
| grupos_cliente_servico | Objeto | Nenhum |

Quando grupos_cliente_servico for informado, os campos abaixo são obrigatórios:

| Atributo | Descrição | Obrigatório | Valor Default |
| --- | --- | --- | --- |
| grupos_cliente_servico.tipo_acao | Tipo da ação sobre os grupos | Sim | Nenhum |
| grupos_cliente_servico.ids | Lista de IDs de grupos | Sim | Nenhum |

Valores aceitos para grupos_cliente_servico.tipo_acao:

| Valor | Descrição |
| --- | --- |
| acrescimo | Adiciona os grupos informados ao serviço |
| remocao | Remove os grupos informados do serviço |
| substituicao | Substitui os grupos atuais pelos grupos informados |

Formato de grupos_cliente_servico.ids:
- Array de inteiros positivos.
- Exemplo: [5, 8, 12].

**Corpo da requisição (JSON):**

```json
{
  "id_forma_cobranca": "220",
  "id_usuario_vendedor": "7599",
  "id_perfil_suspensao": "padrao_forma_cobranca",
  "grupos_cliente_servico": {
    "ids": [
      803,
      812
    ],
    "tipo_acao": "acrescimo"
  }
}
```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Cliente Serviço atualizado com sucesso.",
    "alteracoes_realizadas": "As alterações realizadas foram em: Forma de Cobrança, Usuário Vendedor, Perfil de Suspensão, Grupos de Serviço",
    "cliente_servico": {
        "id_cliente_servico": 23133,
        "id_cliente": 26944,
        "id_servico": 3535,
        "id_vencimento": 187,
        "id_forma_cobranca": 904,
        "id_servico_status": 9,
        "valor": 200,
        "numero_plano": 4,
        "data_cadastro": "2026-04-16 12:10:14",
        "data_primeiro_vencimento": "2026-05-19 00:00:00",
        "data_habilitacao": "2026-04-16 12:14:43",
        "id_motivo_cancelamento": null,
        "id_usuario_vendedor": 4874,
        "nota_fiscal_separado": false,
        "carne": false,
        "boleto_separado": false,
        "data_venda": "2026-04-16 15:09:45",
        "data_cancelamento": null,
        "id_cliente_conta_bancaria": null,
        "data_ultima_cobranca": null,
        "origem": "novo",
        "anotacoes": null,
        "data_ultima_suspensao": null,
        "id_cliente_servico_antigo": null,
        "referencia": null,
        "_id_porta_atendimento": null,
        "tipo_cobranca": "postecipada",
        "id_cliente_servico_associado": null,
        "validade": 12,
        "data_reajuste": "2026-04-16",
        "id_perfil_suspensao": null,
        "id_servico_tecnologia": 2,
        "id_usuario_cadastro": 8585,
        "agrupamento_nota": "desagrupado",
        "id_cli
```

---
### POST — Ativar Cliente Serviço
*Clientes / Cliente Serviço*

```
POST {{url}}/api/v1/integracao/cliente/cliente_servico/ativar/:id_cliente_servico
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

No método `POST`, será possível ativar o serviço do cliente

`Importante`: Para utilizar o endpoint, é necessário possuir permissão.

`Importante2:` Somente é possível ativar serviços que não possuem data_habilitacao e que não esteja com status de aguardando_migracao.

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
  "status": "success",
  "msg": "Serviço habilitado com sucesso ",
  "cliente_servico": {
    "id_cliente_servico": 22668,
    "numero_plano": 35,
    "servico": {
      "id_servico": 3507,
      "descricao": "TESTE PLANO - 100MB"
    },
    "servico_status": {
      "id_servico_status": 9,
      "descricao": "Serviço Habilitado"
    },
    "cliente": {
      "id_cliente": 26769,
      "codigo_cliente": 2591,
      "nome_razaosocial": "CLIENTE"
    }
  }
}
```

---
### POST — Habilitar Cliente Serviço
*Clientes / Cliente Serviço*

```
POST {{url}}/api/v1/integracao/cliente/cliente_servico/habilitar/:id_cliente_servico
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

No método `POST`, será possível habilitar o serviço do cliente, lembrando que é obrigatório passar no body o atributo de motivo_habilitacao.

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| motivo_habilitacao | Motivo de Habilitação | Sim |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| motivo_habilitacao | `String` | Nenhum |

`Importante`: Para utilizar o endpoint, é necessário possuir permissão.

`Importante2:` Somente é possível habilitar serviços que estão com o status Suspenso por Débito, Suspenso Parcialmente e Suspenso Pedido Cliente.

**Corpo da requisição (JSON):**

```json
{
  "motivo_habilitacao": "HABILITANDO SERVIÇO API"
}
```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
  "status": "success",
  "msg": "Serviço habilitado com sucesso ",
  "cliente_servico": {
    "id_cliente_servico": 22668,
    "numero_plano": 35,
    "servico": {
      "id_servico": 3507,
      "descricao": "TESTE PLANO - 100MB"
    },
    "servico_status": {
      "id_servico_status": 9,
      "descricao": "Serviço Habilitado"
    },
    "cliente": {
      "id_cliente": 26769,
      "codigo_cliente": 2591,
      "nome_razaosocial": "CLIENTE"
    }
  }
}
```

---
### POST — Suspender Cliente Serviço
*Clientes / Cliente Serviço*

```
POST {{url}}/api/v1/integracao/cliente/cliente_servico/suspender/:id_cliente_servico
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

No método `POST`, será possível suspender o serviço do cliente, lembrando que é obrigatório passar no body o atributo de tipo_suspensao.

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| tipo_suspensao | Tipo da Suspensão a ser realizada | Sim |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| tipo_suspensao | `String` (`suspenso_debito` / `suspenso_pedido_cliente`) | Nenhum |

`Importante`: Para utilizar o endpoint, é necessário possuir permissão.

`Importante2:` Somente é possível suspender serviços para os status de Suspenso por Débito e Suspenso Pedido Cliente.

**Corpo da requisição (JSON):**

```json
{
  "tipo_suspensao": "suspenso_debito"
}
```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
  "status": "success",
  "msg": "Serviço suspenso com sucesso",
  "cliente_servico": {
    "id_cliente_servico": 22683,
    "numero_plano": 37,
    "servico": {
      "id_servico": 3522,
      "descricao": "100MB - FIBRA - TREINAMENTO FISCAL."
    },
    "servico_status": {
      "id_servico_status": 4,
      "descricao": "Suspenso por Débito"
    },
    "cliente": {
      "id_cliente": 26769,
      "codigo_cliente": 2591,
      "nome_razaosocial": "CLIENTE"
    }
  }
}
```

---
### POST — Vincular CPE
*Clientes / Cliente Serviço*

```
POST {{url}}/api/v1/integracao/cliente/vincular_cpe
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

No método POST, será possível vincular a CPE ao serviço do cliente.

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_cliente_servico | Identificador do servico do cliente | Somente se for o único parâmetro informado. |
| phy_addr | MAC/Serial da ONU ou equipamento equivalente do cliente, que forneça acesso em camada 2 | Somente se for o único parâmetro informado. |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_cliente_servico | `Inteiro` | Nenhum |
| phy_addr | Deve conter uma sequencia de letras e caracteres, sem espaço | Nenhum |

###### **Obs.:** A requisição deve conter **apenas um** dos campos por vez: `id_cliente_servico` **ou** `phy_addr`.

- Se enviado o `id_cliente_servico`, o sistema buscará o MAC ou serial da autenticação configurada nesse serviço para realizar a sincronização da CPE.
    
- Se enviado o `phy_addr`, o sistema procurará uma autenticação associada a esse MAC no serviço correspondente e, em seguida, realizará a sincronização da CPE.

**Corpo da requisição (JSON):**

```json
{
  "id_cliente_servico": 00102
}
```

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "CPE vinculada com sucesso à autenticação do cliente",
    "data": {
        "id_cliente_servico":00102,
        "phy_addr": "FF:FF:FF:FF:FF:FF"
    }
}
```

---
## Contrato

### POST — Adicionar
*Clientes / Contrato*

```
POST {{url}}/api/v1/integracao/cliente/contrato/adicionar_contrato
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

Através deste `endpoint`, será possível fazer o cadastro de contratos para o serviço do cliente.

**Aviso**

`IMPORTANTE`: É necessário informar o `id_cliente_servico`, o `id_contrato e o id_empresa`, eles podem retornados nas rotas Clientes > Consulta (passar o parametro incluir_contrato) e Configuração > Modelos de Contrato e Configuração > Empresas respectivamente

**Atributos da Requisição**

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_cliente_servico | Identificador único do serviço do cliente | Sim |
| id_contrato | Identificador único do modelo de contrato | Sim |
| id_empresa | Identificador único da empresa | Sim |
| autorizacao_nome | Nome do Reponsável Autorização | Não |
| autorizacao_cpf | CPF do Reponsável Autorização | Não |
| autorizacao_rg | RG do Reponsável Autorização | Não |
| informacao_adicional | Informação Adicional do Contrato do Cliente | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_cliente_servico | Deve conter um número inteiro maior que 0 | Nenhum |
| id_contrato | Deve conter um número inteiro maior que 0 | Nenhum |
| id_empresa | Deve conter um número inteiro maior que 0 | Nenhum |
| autorizacao_nome | Textual | Nenhum |
| autorizacao_cpf | Textual | Nenhum |
| autorizacao_rg | Textual | Nenhum |
| informacao_adicional | Textual | Nenhum |

**Corpo da requisição (JSON):**

```json
{
  "id_cliente_servico": 18950,
  "id_contrato": 10,
  "id_empresa": 3,
  "autorizacao_nome": "BIANCA COUTO",
  "autorizacao_cpf": "39415497076",
  "informacao_adicional": "CONTRATO FOI GRAVADO"
}
```

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Contrato adicionado com sucesso para este Serviço",
  "cliente_servico_contrato": {
    "id_cliente_servico_contrato": 9320,
    "id_cliente_servico": 18950,
    "id_contrato": 10,
    "validade": 12,
    "numero_contrato": 6432,
    "id_empresa": 3,
    "autorizacao_nome": "BIANCA COUTO",
    "autorizacao_cpf": "12704685614",
    "autorizacao_rg": "MG-1904960",
    "informacao_adicional": "CONTRATO ADICIONADO VIA API",
    "data_cadastro_br": "04/08/2023 13:41",
    "contrato": {
      "id_contrato": 10,
      "descricao": "TERMO DE CONTRATAÇÃO E AUTORIZAÇÃO DE DÉBITOS EQUIPAMENTO EM COMODATO(JANAUBA) ",
      "validade": 12,
      "gera_multa": false,
      "valor_multa": null
    },
    "empresa": {
      "id_empresa": 3,
      "display": "TELECOM E HARDWARE LTDA (CNPJ: 09.613.622/0001-60)"
    },
    "cliente_servico": {
      "id_cliente_servico": 18950,
      "display": "(5) 1.5-MBPS-PROMOCIONAL-WIRELESS-2018/09 COELHO",
      "cliente": {
        "id_cliente": 25246,
        "display": "(2082) BORGES SILVA"
      }
    }
  }
}
```

---
### POST — Enviar por Email
*Clientes / Contrato*

```
POST {{url}}/api/v1/integracao/cliente/contrato/enviar_email
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

Através deste `endpoint,` será possível fazer o disparo dos contratos não aceitos do cliente por e-mail.

Caso não seja passado os `ids_cliente_servico_contrato`, será enviado todos os contratos pendentes daquele cliente servico.

Também podem ser passados e-mails adicionais, além dos que já estão cadastrados no sistema.

**Aviso**

`IMPORTANTE`: O sistema vai fazer a validação dos dados de e-mail e verificar se a `API` possui um servidor de e-mail válido configurado. Caso todas as regras sejam atendidas, o disparo do e-mail será efetuado instantaneamente, ou seja, é enviado em tempo real. Por esse motivo, o tempo de resposta da `API`, irá variar de acordo com a quantidade de e-mails que está na requisição para ser disparado.

`IMPORTANTE 2`: O(s) servidor(es) de e-mails configurados no HubSoft possuem configuração de timeout entre um disparo e outro, dessa forma evita-se que o servidor seja adicionado em `BlackLists` de `SPAM`. Por esse motivo, a chamada da `API`, poderá ter um tempo de resposta diferente do comum.

**Atributos da Requisição**

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_cliente_servico | Identificador único da serviço do cliente | Sim |
| ids_cliente_servico_contrato | Identificadores único dos contratos do cliente | Não |
| email_adicional | Outros e-mails adicionais, podem ser enviados na requisição. | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_cliente_servico | Deve conter um número inteiro maior que 0 | Nenhum |
| ids_cliente_servico_contrato | Deve conter um array de números inteiro maior que 0 | Nenhum |
| email_adicional | Deve conter um array de strings (emails) | Nenhum |

**Corpo da requisição (JSON):**

```json
{
  "id_cliente_servico": "18937",
  "ids_cliente_servico_contrato": [
    9346
  ],
  "email_adicional": [
    "email1@email.com",
    "email2@email.com"
  ]
}
```

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Um total de 3 / 3 email(s) foram enviados com sucesso",
    "emails_enviados": [
        {
            "id_cliente": 25246,
            "id_usuario": 1045,
            "id_usuario_envio": 1045,
            "host": "smtp.mailtrap.io",
            "email_origem": "b860cbd1ea1dca",
            "email_destino": "sara.borges@hubsoft.com.br",
            "tipo_envio": "manual",
            "tipo_documento": "contrato",
            "data_envio": "2023-08-09 14:42:38",
            "enviado": true,
            "mensagem_erro": null,
            "assunto": "Contrato Digital",
            "id_email_enviado": 2023,
            "data_envio_br": "09/08/2023 14:42",
            "data_envio_timestamp": 1691602958000
        },
        {
            "id_cliente": 25246,
            "id_usuario": 1045,
            "id_usuario_envio": 1045,
            "host": "smtp.mailtrap.io",
            "email_origem": "b860cbd1ea1dca",
            "email_destino": "email1@email.com",
            "tipo_envio": "manual",
            "tipo_documento": "contrato",
            "data_envio": "2023-08-09 14:42:42",
            "enviado": true,
            "mensagem_erro": null,
            "assunto": "Contrato Digital",
            "id_email_enviado": 2024,
            "data_envio_br": "09/08/2023 14:42",
            "data_envio_timestamp": 1691602962000
        },
        {
            "id_cliente": 25246,
            "id_usuario": 1
```

---
### PUT — Marcar como Aceito
*Clientes / Contrato*

```
PUT {{url}}/api/v1/integracao/cliente/contrato/aceitar_contrato
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**PUT**

Através deste `endpoint`, será possível marcar como aceito os contratos vinculados nos serviços dos clientes.

**Aviso**

`IMPORTANTE`: É necessário informar o(s) `ids_cliente_servico_contrato`, é necessário ser um array, pode contar somente um id ou mais, eles podem retornados nas rotas Clientes > Consulta.

**Atributos da Requisição**

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| ids_cliente_servico_contrato | Identificadores único dos contratos dos serviços dos clientes | Sim |
| data_aceito | Data do Aceite do Contrato | Sim |
| observacao | Textual com o motivo de estar marcando aqueles contratos como aceitos | Sim |
| hora_aceito | Hora do Aceite do Contrato | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| ids_cliente_servico_contrato | Array com os número inteiro maiores que 0. ( \[1234, 456\] ) | Nenhum |
| data_aceito | Date (YYYY-MM-DD) | Nenhum |
| observacao | Textual | Nenhum |
| hora_aceito | Hora (HH:MI) | 00:00 |

**Corpo da requisição (JSON):**

```json
{
  "ids_cliente_servico_contrato": [
    9342,
    9343
  ],
  "data_aceito": "2023-08-07",
  "hora_aceito": "14:35",
  "observacao": "ACEITOU O CONTRATO POR LINK"
}
```

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "2 contrato(s) foi(ram) aceito(s) com sucesso!",
  "itens_aceito": [
    {
      "id_cliente_servico_contrato": 9342,
      "data_aceito_br": "07/08/2023 14:35",
      "aceito": true,
      "numero_contrato": 6452,
      "cliente_servico": {
        "id_cliente_servico": 18960,
        "id_cliente": 25261,
        "display": "(1) 100MB-PACOTE-ADICIONAL",
        "cliente": {
          "id_cliente": 25261,
          "display": "(2090) TESTE"
        }
      },
      "contrato": {
        "id_contrato": 156,
        "descricao": "200 Mega s/fidelidade - conta fidelidade"
      }
    },
    {
      "id_cliente_servico_contrato": 9343,
      "data_aceito_br": "07/08/2023 14:35",
      "aceito": true,
      "numero_contrato": 6453,
      "cliente_servico": {
        "id_cliente_servico": 18960,
        "id_cliente": 25261,
        "display": "(1) 100MB-PACOTE-ADICIONAL",
        "cliente": {
          "id_cliente": 25261,
          "display": "(2090) TESTE"
        }
      },
      "contrato": {
        "id_contrato": 48,
        "descricao": "CONTRATO DE PRESTAÇÃO DE SERVIÇOS "
      }
    }
  ]
}
```

---
### DELETE — Remover
*Clientes / Contrato*

```
DELETE {{url}}/api/v1/integracao/cliente/contrato/:id_cliente_servico_contrato
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

No método `DELETE`, será possível remover os contratos do o serviço do cliente.

**Aviso**

`IMPORTANTE`: É necessário informar na requisição o `id_cliente_servico_contrato`, eles podem retornados nas rotas Clientes > Consulta.

**Atributos da Requisição**

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| motivo | Descrição textual do motivo da remoção do contrato. | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| motivo | Textual | Nenhum |

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
  "msg": "Contrato inativado com sucesso",
  "cliente_servico_contrato": {
    "id_cliente_servico_contrato": 9308,
    "id_cliente_servico": 18950,
    "id_contrato": 77,
    "validade": 12,
    "numero_contrato": 6421,
    "id_empresa": 14,
    "deleted_at_br": "04/08/2023 14:26:42",
    "contrato": {
      "id_contrato": 77,
      "descricao": "-Ápice - Contrato Cliente Rádio",
      "validade": 12,
      "gera_multa": false,
      "valor_multa": null
    },
    "empresa": {
      "id_empresa": 14,
      "display": "COMUNICAÇÕES LTDA (CNPJ: 24.605.227/0001-29)"
    },
    "cliente_servico": {
      "id_cliente_servico": 18950,
      "display": "(5) 1.5-MBPS-PROMOCIONAL-WIRELESS-2018/09 COELHO",
      "cliente": {
        "id_cliente": 25246,
        "display": "(2082) BORGES SILVA"
      }
    }
  }
}
```

---
### POST — Adicionar Anexos Contrato
*Clientes / Contrato*

```
POST {{url}}/api/v1/integracao/cliente/contrato/adicionar_anexo_contrato/:id_cliente_servico_contrato
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse endpoint será possível adicionar anexos no contrato vinculado no cliente serviço e obter o retorno no formato JSON como resposta. Lembre de enviar o ID do Cliente como um parâmetro na URL, conforme o exemplo acima. Os seguintes parâmetros podem/devem estar presentes no corpo do requisição:

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

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
  "status": "success",
  "msg": "Anexo Adicionado com sucesso",
  "numero_contrato": 7882
}
```

---
## Financeiro

### GET — Consultar Faturas
*Clientes / Financeiro*

```
GET {{url}}/api/v1/integracao/cliente/financeiro
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**GET**

No método `GET`, será possível consultar as faturas em aberto/liquidadas dos clientes e obter o retorno no formato `JSON` como resposta. Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| busca | Tipo de busca que deseja fazer no cliente | Sim |
| termo_busca | Termo utilizado para fazer a busca | Sim |
| limit | Limite de resultados | Não |
| apenas_pendente | Informa de deseja trazer apenas as faturas pendentes | Não |
| order_by | Campo que será utilizado para ordenação | Não |
| order_type | Tipo da Ordenação | Não |
| data_inicio | Data de Início (Utiliza a data de vencimento como base) | Não |
| data_fim | Data de Fim (Utiliza a data de vencimento como base) | Não |
| cobrancas_agrupadas | Verificar Nota 2 | Não |
| retornar_composicao_cobranca | Verificar Nota 3 | Não |
| relacoes | Carrega apenas os relacionamentos especificados | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| busca | cpf_cnpj, codigo_cliente, id_cliente_servico | Nenhum |
| termo_busca | Campo livre | Sim |
| limit | Valor mínimo 1, Valor máximo 50. | 20 |
| apenas_pendente | sim,nao. | sim |
| order_by | data_vencimento,data_pagamento,data_cadastro,valor. | data_vencimento |
| order_type | asc,desc. | asc |
| data_inicio | Campo no formato DateTime (YYYY-MM-DD) | Nenhum |
| data_fim | Campo no formato DateTime (YYYY-MM-DD) | Nenhum |
| tipo_data | data_vencimento, data_pagamento, data_cadastro | data_vencimento |
| cobrancas_agrupadas | sim,nao | nao |
| retornar_composicao_cobranca | sim,nao | nao |
| relacoes | processamento_cartao | Nenhum |

**Nota 1:**

`INFORMAÇÃO`: O atributo `«tipo_data»` somente será validado, caso seja informado o atributo `data_inicio` e/ou `data_fim`, pois o filtro o tipo de data selecionado, será aplicado em cima da data inicial e/ou data final.

**Nota 2:**

`INFORMAÇÃO`: O atributo `«cobrancas_agrupadas»` indica se as cobranças de uma fatura estão agrupadas. Esse atributo é relevante quando uma fatura inclui cobranças de múltiplos planos. Caso o atributo esteja definido como `'sim'` e a busca seja feita pelo campo `id_cliente_servico`, o sistema irá buscar tanto as faturas vinculadas diretamente ao `id_cliente_servico` especificado quanto aquelas que contêm cobranças associadas a esse `id_cliente_servico`.

**Nota 3:**

`INFORMAÇÃO`: O atributo `«retornar_composicao_cobranca»` indica se as cobranças retornadas deve trazer as configurações da composição da cobrança. Caso o atributo esteja definido como `'sim',` será retornado um objeto de composicao dentro do detalhamento da cobranca.

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "faturas": [
        {
            "id_fatura": 54864,
            "quitado": false,
            "status": "vencido",
            "nosso_numero": "1903427",
            "nosso_numero_dv": "1903427-9",
            "linha_digitavel": "75691.31662 01006.726119 90342.790012 7 80380000019000",
            "codigo_barras": "75697803800000190001316601006726119034279001",
            "pix_copia_cola": null,
            "link": "http://localhost:8000/pdf/fatura/7aaadca2b50414930c1ff6936b0fbb0d1fd3aff14107c1f07635d556c237a7788ea51eb3146e98",
            "agencia_codigo_beneficiario": "3166 / 67261",
            "beneficiario": "SERVIÇOS DE TECNOLOGIA / CNPJ: 36.636.392/0001-27",
            "numero_documento": 54864,
            "especie": "DS",
            "especie_dinheiro": "R$",
            "aceite": "N",
            "local_pagamento": "PAGÁVEL EM QUALQUER BANCO ATÉ O VENCIMENTO",
            "carteira": "1",
            "tipo_cobranca": "boleto_bancario",
            "valor": 190,
            "valor_pago": null,
            "data_vencimento": "10/10/2019",
            "data_cadastro": "23/08/2019",
            "data_pagamento": null,
            "data_documento": "11/04/2024",
            "data_processamento": "11/04/2024",
            "empresa": {
                "documento": "36636392000127",
                "nome_razaosocial": "SERVIÇOS DE TECNOLOGIA",
                "no
```

---
### POST — Enviar por Email
*Clientes / Financeiro*

```
POST {{url}}/api/v1/integracao/cliente/financeiro/enviar_email
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

Através deste `endpoint,` será possível fazer o disparo da fatura do cliente por e-mail. Podem ser passados e-mails adicionais, além dos que já estão cadastrados no sistema.

**Aviso**

`IMPORTANTE`: O sistema vai fazer a validação dos dados de e-mail e verificar se a `API` possui um servidor de e-mail válido configurado. Caso todas as regras sejam atendidas, o disparo do e-mail será efetuado instantaneamente, ou seja, é enviado em tempo real. Por esse motivo, o tempo de resposta da `API`, irá variar de acordo com a quantidade de e-mails que está na requisição para ser disparado.

`IMPORTANTE 2`: O(s) servidor(es) de e-mails configurados no HubSoft possuem configuração de timeout entre um disparo e outro, dessa forma evita-se que o servidor seja adicionado em `BlackLists` de `SPAM`. Por esse motivo, a chamada da `API`, poderá ter um tempo de resposta diferente do comum.

**Atributos da Requisição**

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_fatura | Identificador único da fatura do cliente | Sim |
| email_adicional | Outros e-mails adicionais, podem ser enviados na requisição. | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_fatura | Deve conter um número inteiro maior que 0 | Nenhum |
| email_adicional | Deve conter um array de strings (emails) | Nenhum |

**Corpo da requisição (JSON):**

```json
{
  "id_fatura": "11000",
  "email_adicional": [
    "email1@email.com",
    "email2@email.com"
  ]
}
```

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "As faturas foram adicionadas para serem disparadas por e-mail. Por se tratar de um processo de envio massivo, o sistema fará o agendamento do disparo. Dentro de alguns minutos o cliente irá receber os e-mails com as faturas. OBS: Para cada fatura selecionada será enviado um e-mail",
    "job": {
        "tries": 1,
        "timeout": 172800,
        "memory": 2048,
        "faturas": [
            {
                "id_fatura": 50949
            }
        ],
        "emails": [
            {
                "id_contato": null,
                "id_cliente": 12025,
                "email": "macielrsf@gmail.com",
                "nome": "MACIEL RODRIGUES",
                "name": "MACIEL RODRIGUES",
                "permite_enviar_email": true,
                "origem": "cadastro_cliente"
            },
            {
                "id_contato": null,
                "id_cliente": 12025,
                "email": "macielrsf@gmail.com",
                "nome": "MACIEL RODRIGUES",
                "name": "MACIEL RODRIGUES",
                "permite_enviar_email": true,
                "origem": "cadastro_cliente"
            },
            {
                "id_contato": 12035,
                "id_cliente": 12025,
                "email": "macielrsf@gmail.com",
                "nome": "MACIEL RODRIGUES",
                "name": "MACIEL RODRIGUES",
                "permite_enviar_email": "sim",
```

---
### POST — Enviar por SMS
*Clientes / Financeiro*

```
POST {{url}}/api/v1/integracao/cliente/financeiro/enviar_sms
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

Através deste `endpoint`, será possível fazer o disparo da fatura do cliente por `SMS`. Podem ser passados números de telefones adicionais, além dos que já estão cadastrados no sistema.

**Aviso**

`IMPORTANTE`: O disparo do SMS é efetuado para a Plataforma de `SMS`. Caso o HubSoft consiga entregar o SMS para plataforma, o resultado da requisição será uma resposta de SUCESSO, mesmo que a plataforma não efetue o disparo, para o HubSoft a tarefa foi efetuada com sucesso.

**Atributos da Requisição**

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_fatura | Identificador único da fatura do cliente | Sim |
| telefone_adicional | Outros telefones adicionais, podem ser enviados na requisição. | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_fatura | Deve conter um número inteiro maior que 0 | Nenhum |
| telefone_adicional | Deve conter um array de strings com os telefones no formato DDNNNNNNNN ou D | Nenhum |

**Corpo da requisição (JSON):**

```json
{
  "id_fatura": "11000",
  "telefone_adicional": [
    "11988887777",
    "1188887776"
  ]
}
```

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "As faturas foram adicionadas para serem disparadas por SMS. Por se tratar de um processo de envio massivo, o sistema fará o agendamento do disparo. Dentro de alguns minutos o cliente irá receber as mensgens SMS com os dados das faturas. OBS: Para cada fatura selecionada será enviado um SMS",
  "job": {
    "tries": 1,
    "timeout": 172800,
    "memory": 2048,
    "faturas": [
      {
        "id_fatura": 50949
      }
    ],
    "telefones": [
      {
        "id_contato": null,
        "id_cliente": 12025,
        "telefone": "37999931412",
        "nome": "MACIEL RODRIGUES",
        "permite_enviar_sms": true,
        "origem": "cadastro_cliente"
      }
    ],
    "connection": null,
    "queue": "teste",
    "delay": {
      "date": "2019-10-07 13:20:51.000000",
      "timezone_type": 3,
      "timezone": "America/Sao_Paulo"
    }
  }
}
```

---
### POST — Enviar por Push
*Clientes / Financeiro*

```
POST {{url}}/api/v1/integracao/cliente/financeiro/enviar_push
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

Através deste endpoint, será possível fazer o disparo da fatura do cliente por push notification.

**IMPORTANTE**: O cliente só receberá o push notification, caso ele possua o aplicativo do cliente instalado e esteja autenticado com o CPF/CNPJ.

**Atributos da Requisição**

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_fatura | Identificador único da fatura do cliente | Sim |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_fatura | Deve conter um número inteiro maior que 0 | Nenhum |

**Corpo da requisição (JSON):**

```json
{
  "id_fatura": "11000"
}
```

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Fatura enviada com sucesso via push notification"
}
```

---
## Nota Fiscal

### GET — Consultar Notas
*Clientes / Nota Fiscal*

```
GET {{url}}/api/v1/integracao/cliente/nota_fiscal
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**GET**

No método `GET`, será possível consultar as notas fiscais modelos 0, 21 e 22 e obter o retorno no formato `JSON` como resposta. Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| busca | Tipo de busca que deseja fazer no cliente | Sim |
| termo_busca | Termo utilizado para fazer a busca | Sim |
| data_inicio | Data de Início (Utiliza a data de emissão da nota como base) | Não |
| data_fim | Data de Fim (Utiliza a data de emissão da nota como base) | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| busca | id_cliente | Nenhum |
| termo_busca | Campo livre | Sim |
| data_inicio | Campo no formato DateTime (YYYY-MM-DD) | Nenhum |
| data_fim | Campo no formato DateTime (YYYY-MM-DD) | Nenhum |

**Aviso**

A `API` vai retornar somente notas que já foram processadas e enviadas aos respectivos orgãos responsáveis, sendo assim será retornado somente as notas com os seguintes status: NFe: efetivada / NFSe: autorizado / Nota Fiscal Telecom 21/22: normal

**Nota**

Para os parâmetros `data_inicio` e `data_fim` não pode ser informado um intervalo de datas maior que 60 dias.

**Exemplo de resposta — Sucesso**

```json
{
"status": "success",
"msg": "Dados carregados com sucesso",
"cliente": {
  "id_cliente": 23285,
  "codigo_cliente": 1382,
  "nome_razaosocial": "HUBSOFT BRASIL"
},
"notas_fiscais": [
  {
    "id_nota_fiscal": 3064,
    "id_tipo_documento_fiscal": 1,
    "numero_nota": 427,
    "serie_nota": "U",
    "cfop": "5307",
    "identificacao": "XYWNrpBhW5D8p2yuvAoL",
    "valor": "5",
    "data_cadastro_br": "25/02/2022 09:07",
    "data_emissao_br": "25/02/2022",
    "data_cancelamento_br": null,
    "cancelado": false,
    "tipo_documento_fiscal": {
      "id_tipo_documento_fiscal": 1,
      "descricao": "Nota Fiscal de Serviço de Comunicação",
      "codigo": "21",
      "ativo": true,
      "display": "21 - Nota Fiscal de Serviço de Comunicação"
    }
  }
],
"nfes": [
  {
    "id_nfe": 351,
    "modelo": "55",
    "serie": "1",
    "numero_nf": 60,
    "chave": "NFe16922351872769307419",
    "recibo": "16922351872769307419",
    "autorizacao": null,
    "status": "efetivada",
    "status_mensagem": "Autorizado o uso da NF-e",
    "data_cadastro": "2021-12-09 17:31:39",
    "protocolo_autorizacao": "16922351872769307419",
    "cancelado": false,
    "data_cadastro_br": "09/12/2021 17:31:39",
    "data_cadastro_timestamp": 1639081899000,
    "data_emissao_br": "25/02/2022 09:07:06",
    "data_emissao_timestamp": 1645790826000,
    "data_contigencia_br": null,
    "data_contigencia_timestamp": null,
    "data_saida_br": null,
```

---
### POST — Enviar por Email
*Clientes / Nota Fiscal*

```
POST {{url}}/api/v1/integracao/cliente/nota_fiscal/enviar_email
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

Através deste `endpoint`, será possível fazer o disparo da nota fiscal do cliente por e-mail. Podem ser passados e-mails adicionais, além dos que já estão cadastrados no sistema.

O campo `tipo_documento`, poderá conter um dos valores abaixo:

- `nf_telecom`
- `nfe`
- `nfse`
    

**Aviso**

`IMPORTANTE`: O sistema vai fazer a validação dos dados de e-mail e verificar se a API possui um servidor de e-mail válido configurado. Caso todas as regras sejam atendidas, o disparo do e-mail será efetuado instantaneamente, ou seja, é enviado em tempo real. Por esse motivo, o tempo de resposta da API, irá variar de acordo com a quantidade de e-mails que está na requisição para ser disparado.

`IMPORTANTE 2:` O(s) servidor(es) de e-mails configurados no HubSoft possuem configuração de timeout entre um disparo e outro, dessa forma evita-se que o servidor seja adicionado em `BlackLists` de `SPAM`. Por esse motivo, a chamada da `API`, poderá ter um tempo de resposta diferente do comum.

**Corpo da requisição (JSON):**

```json
{
  "id_nota_fiscal": "123",
  "tipo_documento": "nf_telecom",
  "email_adicional": [
    "email1@email.com"
  ]
}
```

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Um total de 2/3 email(s) foram enviados com sucesso",
  "emails_enviados": [
    {
      "id_cliente": 23285,
      "id_usuario": 1,
      "id_usuario_envio": 915,
      "host": "smtp.mailtrap.io",
      "email_origem": "b860cbd1ea1dca",
      "email_destino": "naotem@naotem.com.br",
      "tipo_envio": "manual",
      "tipo_documento": "nota_fiscal_produto",
      "data_envio": "2022-02-25 09:59:46",
      "enviado": true,
      "mensagem_erro": null,
      "id_email_enviado": 1416,
      "data_envio_br": "25/02/2022 09:59",
      "data_envio_timestamp": 1645793986000
    },
    {
      "id_cliente": 23285,
      "id_usuario": 1,
      "id_usuario_envio": 915,
      "host": "smtp.mailtrap.io",
      "email_origem": "b860cbd1ea1dca",
      "email_destino": "email1@email.com.br",
      "tipo_envio": "manual",
      "tipo_documento": "nota_fiscal_produto",
      "data_envio": "2022-02-25 10:00:30",
      "enviado": true,
      "mensagem_erro": null,
      "id_email_enviado": 1417,
      "data_envio_br": "25/02/2022 10:00",
      "data_envio_timestamp": 1645794030000
    }
  ]
}
```

---
## Ordem de Serviço

### GET — Consultar
*Clientes / Ordem de Serviço*

```
GET {{url}}/api/v1/integracao/cliente/ordem_servico
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**GET**

No método `GET`, será possível consultar as ordens de serviço de um determinado cliente e obter o retorno no formato `JSON` como resposta. Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| busca | Tipo de busca que deseja fazer no cliente | Sim |
| termo_busca | Termo utilizado para fazer a busca (Campo Livre) | Não |
| limit | Limite de resultados | Não |
| status | Informa o status que deseja trazer como retorno | Não |
| order_by | Campo que será utilizado para ordenação | Não |
| order_type | Tipo da Ordenação | Não |
| data_inicio | Data de Início dos resultados | Não |
| data_fim | Data de Fim dos resultados | Não |
| exibir_atendimento | Se deseja visualizar o atendimento vinculado na O.S | Não |
| relacoes | Carrega apenas os relacionamentos especificados | Não |
| reservada | Filtro de O.S revervada | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| busca | codigo_cliente, cpf_cnpj, id_cliente_servico, numero_ordem_servico | Nenhum |
| termo_busca | Campo livre | Nenhum |
| limit | Valor mínimo 1, Valor máximo 50. | 20 |
| status | pendente,aguardando_agendamento,finalizado | Todos |
| order_by | data_cadastro,data_inicio_programado | data_cadastro |
| order_type | asc,desc | desc |
| data_inicio | Campo no formato DateTime (YYYY-MM-DD). Será aplicado o filtro em cima da data de cadastro | Nenhum |
| data_fim | Campo no formato DateTime (YYYY-MM-DD). Será aplicado o filtro em cima da data de cadastro | Nenhum |
| exibir_atendimento | Boolean (true,false) | false |
| relacoes | ordem_servico_mensagem, anexos | Nenhum |
| reservada | Filtro de O.S reservada (Valores Válidos: sim, nao, reservada_em_execucao, reservada_sem_execucao) | Nenhum |

**Exemplo de resposta — Sucesso**

```json
{
    "status": "suscess",
    "msg": "Dados consultados com sucesso",
    "ordens_servico": [
        {
            "id_ordem_servico": 78,
            "numero_ordem_servico": "74",
            "data_cadastro": "12/04/2018 15:26:28",
            "tipo": "SUPORTE",
            "data_inicio_programado": "02/05/2018 10:00:00",
            "data_termino_programado": "16/04/2018 12:00:00",
            "data_inicio_executado": null,
            "data_termino_executado": null,
            "descricao_abertura": "cliente reclama de conexão lenta",
            "descricao_servico": "CLIENTE TESTE TESTE",
            "descricao_fechamento": null,
            "usuario_abertura": "Master",
            "usuario_fechamento": null,
            "status": "aguardando_agendamento",
            "status_fechamento": null,
            "atendimento": {
                "protocolo": "201804121526287",
                "id_atendimento": 60,
                "tipo_atendimento": "TÉCNICO - CONEXÃO LENTA",
                "usuario_abertura": "Master",
                "usuario_responsavel": "Guilherme Couto",
                "usuario_fechamento": null,
                "data_cadastro": "12/04/2018",
                "data_fechamento": null,
                "setor_responsavel": null,
                "status_fechamento": null,
                "motivo_fechamento": null
            },
            "cliente": {
                "codigo_cliente": 1188,
                "nome_razaosoc
```

---
## Pacote

### GET — Consultar
*Clientes / Pacote*

```
GET {{url}}/api/v1/integracao/pacote/consultar
```

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `pagina` | `1` |
| `itens_por_pagina` | `10` |
| `tipo_busca` | `id_pacote` |
| `termo_busca` | `53` |
| `data_inicio` | `20-01-2000` |
| `data_fim` | `20-12-2025` |

**Descrição:**

**Endpoint (Rota)**

Neste `endpoint`, será possível consultar os pacotes que irão retornar de forma paginada.

No método `GET,` irá consultar os dados dos clientes e retornar um `JSON` como resposta. Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | **Obrigatório** |
| --- | --- | --- |
| pagina | Define o página que será consultada | Sim |
| itens_por_pagina | Define a quantidade de pacotes que virão por página | Sim |
| tipo_busca | Tipo de busca que deseja fazer | Sim |
| termo_busca | Termo utilizado para fazer a busca | Não |
| status | Status do Cliente Servico Pacote | Não |
| tipo_data | Define o tipo de Data | Não |
| data_inicio | Data de inicio da Consulta | Não |
| data_fim | Data Fim da Consulta | Não |
| id_status_cliente_servico | ID Status Serviço do Cliente | Não |
| relacoes | Carrega apenas os relacionamentos especificados | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | **Valor Default** |
| --- | --- | --- |
| pagina | numérico | Não |
| itens_por_pagina | numérico | Não |
| tipo_busca | id_pacote ou codigo_pacote | Nenhum |
| termo_busca | Campo livre (Qualquer valor será aceito) | Nenhum |
| Status | ativo, inativo, todos | ativo |
| tipo_data | data_cadastro, data_atualizacao, data_limite, data_remocao | data_cadastro |
| data_inicio | date | Não |
| data_fim | date | Não |
| id_status_cliente_servico | string | Não |
| relacoes | parametros | Nenhum |

**IMPORTANTE 1:** Para utilizar o campo `tipo_data` com a opção **data_remocao**, é necessário que o filtro de **status** esteja configurado como **inativo** ou **todos**. Isso garante que haja registros disponíveis para que o filtro de data seja aplicado corretamente.

**IMPORTANTE 2:** Se desejar utilizar o filtro `id_status_cliente_servico` para consultar múltiplos status, basta separar os valores por vírgula (por exemplo, `1,2`). Para obter os IDs, utilize o endpoint documentado em **Configuração > Serviços > Status de serviço**.

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "paginacao": {
        "primeira_pagina": 0,
        "ultima_pagina": 4,
        "pagina_atual": 1,
        "total_registros": 45
    },
    "pacotes": [
        {
            "id_cliente_servico_pacote": 5377,
            "id_cliente_servico": 17652,
            "id_pacote": 53,
            "valor": "10",
            "descricao": "",
            "data_cadastro": "2022-09-12 16:56:18",
            "deleted_at": null,
            "id_externo": null,
            "status": "aguardando_exclusao",
            "status_em": null,
            "status_mensagem": null,
            "data_tentativa": null,
            "em_transmissao": false,
            "migrar": false,
            "transmitir": true,
            "data_limite": null,
            "data_atualizacao": "2022-09-12 16:56:18",
            "id_usuario_vendedor": null,
            "substituir_equipamento": null,
            "moeda": "BRL",
            "cliente_servico": [
                {
                    "id_cliente_servico": 17652,
                    "id_cliente": 12116,
                    "id_servico": 2793,
                    "numero_plano": 9,
                    "anotacoes": "novo teste",
                    "id_cliente_servico_antigo": 17615,
                    "referencia": null,
                    "uuid": "25ec9513-e2aa-4b0e-a037-1836b4ff8367",
                    "data_ultima_suspensao_pedido_cliente": null,
                    "data_a
```

---
### PATCH — Ativar
*Clientes / Pacote*

```
PATCH {{url}}/api/v1/integracao/pacote/ativar/{id_cliente_servico_pacote}
```

**Descrição:**

**Endpoint (Rota)**

Neste `endpoint`, será possível ativar pacotes vinculados ao serviço do cliente que estejam inativos, basta passar o parametro `id_cliente_servico_pacote`.

| Atributo | Descrição |
| --- | --- |
| id_cliente_servico_pacote | Campo Inteiro (integer) |

---
### DELETE — Inativar
*Clientes / Pacote*

```
DELETE {{url}}/api/v1/integracao/pacote/{id_cliente_servico_pacote}
```

**Descrição:**

**Endpoint (Rota)**

Neste `endpoint`, será possível inativar pacotes vinculados ao serviço do cliente, basta passar o parametro `id_cliente_servico_pacote`.

| Atributo | Descrição |
| --- | --- |
| id_cliente_servico_pacote | Campo Inteiro (integer) |

---
### PUT — Atualizar
*Clientes / Pacote*

```
PUT {{url}}/api/v1/integracao/pacote/{id_cliente_servico_pacote}
```

**Descrição:**

**Endpoint (Rota)**

Neste `endpoint`, será possível alterar a descrição dos pacotes vinculados ao serviço do cliente, basta passar o parametro `id_cliente_servico_pacote` na url e `descricao` e `valor` no body.

| Atributo | Descrição |
| --- | --- |
| id_cliente_servico_pacote | Campo Inteiro (integer) |
| descricao | Campo String |
| valor | Campo Float |

**Corpo da requisição (JSON):**

```json
{
  "descricao": "Teste Descricao",
  "valor": 12.99
}
```

---
### POST — Adicionar
*Clientes / Pacote*

```
POST {{url}}/api/v1/integracao/pacote
```

**Descrição:**

**Endpoint (Rota)**

Neste `endpoint`, será possível adicionar um pacote no serviço do cliente.

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_cliente_servico | Campo Inteiro (integer) | Sim |
| id_pacote | Campo Inteiro (integer) | Sim |
| descricao | Campo String | Nao |
| valor | Campo Float | Sim |
| data_limite | Campo Date ("dd-mm-YY") | Nao |
| cliente_servico_pacote_parametro | Objeto (Json com Decricao (String) e Valor (Float)) | Nao |

**Corpo da requisição (JSON):**

```json
{
  "id_cliente_servico": 20471,
  "id_pacote": 275,
  "descricao": "Pacote Integração",
  "valor": 30,
  "data_limite": "23-10-2024",
  "cliente_servico_pacote_parametro": [
    {
      "chave": "teste",
      "valor": 30
    }
  ]
}
```

---
## Outros

### POST — Autenticação
*Clientes / Outros*

```
POST {{url}}/api/v1/integracao/cliente/autenticacao/
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**Necessário**

Para fazer requisições nos dados de clientes, é necessário que você já possua o TOKEN, conseguido na etapa (Autenticação)

As requisições de clientes, devem ser feitos na rota:

StartFragment

`/api/v1/integracao/cliente`  

EndFragment

Através desse `endpoint` será possível realizar a autenticação do cliente, com seu usuário e senha. Essa autenticação respeita os mesmos dados que o cliente utiliza para conectar na Central do Assinante `WEB` ou `APP`. Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| usuario | Usuário de Autenticação da Central | Sim |
| senha | Senha de Autenticação da Central | Sim |

Com esse endpoint é possível criar outras soluções para os clientes da empresa e manter toda a autenticação centralizada na central do assinante do HubSoft. Por exemplo, é possível criar plataformas de conteúdo e o cliente usar o mesmo login e senha em todas elas.

**Corpo da requisição (JSON):**

```json
{
  "usuario": "09148213622",
  "senha": "#M1nh4$3NH4!"
}
```

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Usuário autenticado com sucesso",
  "cliente": {
    "id_cliente": 23285,
    "codigo_cliente": 1382,
    "nome_razaosocial": "GUILHERME DA COSTA COUTO",
    "nome_fantasia": null,
    "cpf_cnpj": "09141806654",
    "data_nascimento": "1994-03-11",
    "telefone_primario": "37911112222",
    "telefone_secundario": "3734151100",
    "telefone_terciario": "11988887777",
    "email_principal": "naotem@naotem.com.br",
    "email_secundario": "naotem@naotem.com.br"
  }
}
```

---
### POST — Configurar Autenticação
*Clientes / Outros*

```
POST {{url}}/api/v1/integracao/cliente/configurar_autenticacao
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

## Configurar Autenticação do Serviço

**POST**

Através deste endpoint, é possível alterar parâmetros de autenticação de um serviço do cliente, como interface de conexão, MAC/Serial da ONU, login, senha e observações.

### Regras da requisição

- O campo `id_cliente_servico` é obrigatório.
    
- É obrigatório informar pelo menos um dos campos de alteração:
    - `id_interface_conexao`
        
    - `phy_addr`
        
    - `login`
        
    - `password`
        
    - `observacoes`
        
- O serviço informado deve possuir dados de autenticação cadastrados.
    
- Não é permitido alterar dados de autenticação de serviços cancelados.
    
- Caso o `login` seja alterado, ele não pode estar em uso por outro cliente ou por um usuário do sistema.
    
- Caso o `phy_addr` seja alterado, ele não pode estar em uso por outro assinante em uma interface de conexão diferente.
    
- Caso `observacoes` seja enviado como `null` ou vazio, o campo será atualizado conforme o valor informado.
    

### Parâmetros

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| `id_cliente_servico` | Identificador único do serviço do cliente. | Sim |
| `id_interface_conexao` | Identificador da interface de conexão à qual a autenticação será vinculada. | Não |
| `phy_addr` | MAC/Serial da ONU ou equipamento equivalente do cliente, utilizado para acesso em camada 2. | Não |
| `login` | Login de autenticação do cliente. | Não |
| `password` | Senha de autenticação do cliente. | Não |
| `observacoes` | Observações da autenticação do cliente. | Não |

### Validações dos campos

| Atributo | Validação | Valor padrão |
| --- | --- | --- |
| `id_cliente_servico` | Deve ser um número inteiro válido e existir no cadastro de serviços do cliente. | Nenhum |
| `id_interface_conexao` | Deve ser um número inteiro válido e existir no cadastro de interfaces de conexão. | Nenhum |
| `phy_addr` | Deve conter no mínimo 5 caracteres e não pode possuir espaços. | Nenhum |
| `login` | Deve conter entre 3 e 255 caracteres e respeitar a regra de validação de login configurada no sistema. | Nenhum |
| `password` | Deve conter no mínimo 3 caracteres. | Nenhum |
| `observacoes` | Deve ser uma string. Pode ser enviado vazio ou `null` para limpar o campo. | Nenhum |

**Corpo da requisição (JSON):**

```json
{
  "id_cliente_servico": 12345,
  "id_interface_conexao": 10,
  "phy_addr": "A1:B2:C3:D4:E5:F6",
  "login": "cliente123",
  "password": "novaSenha123",
  "observacoes": "Alteração realizada via integração"
}
```

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Parâmetros de autenticação modificados com sucesso.",
  "alteracoes_realizadas": "As alterações realizadas foram em: MAC Layer2, Senha, Observações, Login"
}
```

---
### POST — Desbloqueio em Confiança
*Clientes / Outros*

```
POST {{url}}/api/v1/integracao/cliente/desbloqueio_confianca
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

Através deste `endpoint` , será possível efetuar o desbloqueio em confiança, pela quantidade de dias desejados.

Aviso

`IMPORTANTE`: O sistema vai fazer a validação da regra configurada pelo painel do administrador. Por exemplo, se a regra configurada pelo painel, estiver definido que o máximo de dias para desbloqueio for menor ou igual a 3 dias e a requisição da `API`, possuir um valor maior que 3 (no atributo `dias_desbloqueio`), o desbloqueio não será efetuado, e uma mensagem de erro será retornada, avisando que o valor informado para os dias de desbloqueio não é permitido, pois ultrapassa a configuração pré-estabelecida.

Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_cliente_servico | Identificador único do serviço do cliente | Sim |
| dias_desbloqueio | Quantidade de dias, a partir da data atual que o cliente ficará desbloqueado em confiança | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_cliente_servico | Deve conter um número inteiro maior que 0 | Nenhum |
| dias_desbloqueio | Deve conter um número inteiro maior que 0. Se não for preenchido o valor 1 será atributo, ou seja, será desbloqueado até o próximo dia | Nenhum |

**Corpo da requisição (JSON):**

```json
{
  "id_cliente_servico": "11000",
  "dias_desbloqueio": "1"
}
```

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Desbloqueio em confiança realizado com sucesso até a data 26/11/2018"
}
```

---
### GET — Desconexão do Cliente
*Clientes / Outros*

```
GET {{url}}/api/v1/integracao/cliente/solicitar_desconexao/<id_cliente_servico>
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**GET**

No método `GET`, será possível efetuar a desconexão da conexão do cliente.

**Aviso**

`IMPORTANTE`: A desconexão apenas será realizada se a porta INCOMING estiver habilitada no equipamento de conexão (Concentrador). É necessário estar configurado no `HubSoft` em Rede > Equipamentos de Conexão e também é importante que o servidor `RADIUS` possua comunicação com o equipamento de conexão (Concentrador) no momento da solicitação. Todos esses fatores devem trabalhar em conjunto, para que o sistema consiga executar a operação com sucesso.

**Atributos da Requisição**

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_cliente_servico | Identificador único do serviço do cliente | Sim |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_cliente_servico | Deve conter um número inteiro maior que 0 | Nenhum |

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "A desconexão foi bem sucedida para o login hubsoft!",
  "login": "hubsoft"
}
```
**Exemplo de resposta — Falha**

```json
{
  "status": "error",
  "msg": "A desconexão não foi bem sucedida para o login hubsoft!",
  "errors": []
}
```

---
### GET — Extrato de Conexão
*Clientes / Outros*

```
GET {{url}}/api/v1/integracao/cliente/extrato_conexao
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**GET**

No método `GET`, será possível consultar os extratos de conexão de um determinado login e obter o retorno no formato `JSON` como resposta. Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| busca | Tipo de busca que deseja fazer no cliente | Sim |
| termo_busca | Termo utilizado para fazer a busca | Sim |
| limit | Limite de resultados | Não |
| data_inicio | Data de Início (Utiliza a data de vencimento como base) | Não |
| data_fim | Data de Fim (Utiliza a data de vencimento como base) | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| busca | login,ipv4,ipv6_wan,ipv6_lan, mac | Nenhum |
| termo_busca | Campo livre | Nehum |
| limit | Valor mínimo 1, Valor máximo 50 | 20 |
| data_inicio | Campo no formato DateTime (YYYY-MM-DD). | Data atual menos 30 dias |
| data_fim | Campo no formato DateTime (YYYY-MM-DD). | Data atual |

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Dados consultados com sucesso",
  "registros": [
    {
      "acctstarttime": "2017-09-27 18:14:08-03",
      "acctstarttimebr": "27/09/2017 18:14:08",
      "acctstoptime": null,
      "acctstoptimebr": null,
      "calledstationid": "service2",
      "callingstationid": "58:10:8C:4B:FF:AA",
      "download_megabytes": 4594.95,
      "upload_megabytes": 156.12,
      "framedipaddress": "10.99.1.152",
      "nasipaddress": "172.17.22.132",
      "nasportid": "ether3",
      "nasporttype": "Ethernet",
      "username": "antoniomas",
      "servico": {
        "numero_plano": 49,
        "nome": "100GB-DE-TESTE-",
        "valor": 100,
        "status": "Serviço Habilitado",
        "status_prefixo": "servico_habilitado"
      },
      "cliente": {
        "codigo_cliente": 1161,
        "nome_razaosocial": "ANTONIO MODESTO",
        "cpf_cnpj": "09350012345"
      }
    }
  ],
  "estatisticas": {
    "total_conexoes": 1,
    "download_total": 4594.95,
    "upload_total": 156.12,
    "trafego_total": 4751.07,
    "media_download": 0.23,
    "media_upload": 0.01
  }
}
```

---
### POST — Resetar MAC do Cliente
*Clientes / Outros*

```
POST {{url}}/api/v1/integracao/cliente/reset_mac_addr
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

Através deste `endpoint`, será possível resetar o MAC ADDRESS configurado na autenticação do plano do cliente. Após resetar o MAC, qualquer equipamento com o login e senha corretos estará apto a realizar a autenticação. Esse endpoint será útil para provedores que fazem controle / restrição de MAC ADDRESS na rede.

**Aviso**

`IMPORTANTE`: O sistema irá validar se o serviço informado possui dados de autenticação. Caso o serviço selecionado não possua, uma mensagem de erro será retornada, impedindo que a solicitação seja executada.

**Atributos da Requisição**

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_cliente_servico | Identificador único do serviço do cliente | Sim |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_cliente_servico | Deve conter um número inteiro maior que 0 | Nenhum |

**Corpo da requisição (JSON):**

```json
{
  "id_cliente_servico": "11000"
}
```

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Endereço MAC resetado com sucesso!"
}
```

---
### POST — Resetar MAC Layer2 do Cliente
*Clientes / Outros*

```
POST {{url}}/api/v1/integracao/cliente/reset_phy_addr
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

Através deste `endpoint`, será possível resetar o MAC Layer2 configurado na autenticação do plano do cliente. Após resetar o MAC Layer2, qualquer equipamento com o login e senha corretos estará apto a realizar a autenticação. Esse endpoint será útil para provedores que fazem controle / restrição de MAC Layer2 na rede.

**Aviso**

`IMPORTANTE`: O sistema irá validar se o serviço informado possui dados de autenticação. Caso o serviço selecionado não possua, uma mensagem de erro será retornada, impedindo que a solicitação seja executada.

**Atributos da Requisição**

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_cliente_servico | Identificador único do serviço do cliente | Sim |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_cliente_servico | Deve conter um número inteiro maior que 0 | Nenhum |

**Corpo da requisição (JSON):**

```json
{
  "id_cliente_servico": "11000"
}
```

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Endereço MAC Layer2 resetado com sucesso!"
}
```
**Exemplo de resposta — Erro**

```json
{
  "status": "error",
  "msg": "O serviço/plano informado não possui dados de autenticação",
  "errors": []
}
```

---
### PUT — Update ID Externo Cliente
*Clientes / Outros*

```
PUT {{url}}/api/v1/integracao/cliente/update_id_externo/:id_cliente
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

Através deste `endpoint` , será possível efetuar a atualização do id_externo do Cliente

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
    "msg": "O campo ID Externo do Cliente (2336) TESTE FINANCEIRO - BIANCA foi alterado de CAMPO_VAZIO para SAP-3432 via API de Atualizar ID Externo",
    "cliente": {
        "id_cliente": 25788,
        "id_origem_cliente": null,
        "nome_razaosocial": "TESTE FINANCEIRO - BIANCA",
        "nome_fantasia": null,
        "telefone_primario": "37999098100",
        "telefone_secundario": null,
        "telefone_terciario": null,
        "cpf_cnpj": "93285198028",
        "rg": null,
        "rg_emissor": null,
        "inscricao_municipal": null,
        "inscricao_estadual": "0040330800094",
        "tipo_pessoa": "pf",
        "codigo_cliente": 2336,
        "data_nascimento": "1988-03-15 00:00:00",
        "email_principal": null,
        "email_secundario": null,
        "data_cadastro": "2024-04-05 12:01:01",
        "id_usuario": 1045,
        "ativo": true,
        "id_push_notification": null,
        "nome_pai": "TESTE PAI",
        "nome_mae": "TESTE MAE",
        "estado_civil": "solteiro",
        "genero": "feminino",
        "nacionalidade": "brasileiro",
        "profissao": "TESTE",
        "blocklist": false,
        "motivo_blocklist": null,
        "id_motivo_contratacao": null,
        "consumidor_final": "1",
        "indicador_inscricao_estadual": "9",
        "representante_legal_nome_razaosocial": null,
        "representante_legal_cpf_cnpj": null,
        "representante_legal_rg": nu
```

---
## GET — Todos
*Clientes*

```
GET {{url}}/api/v1/integracao/cliente/todos
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
| `cancelado` | `` |
| `possui_pacote` | `` |
| `codigo_pacote` | `` |
| `servico_status` | `` |
| `relacoes` | `` |
| `grupo_cliente_servico` | `` |
| `aguardando_migracao` | `` |

**Descrição:**

No método `GET`, irá consultar os dados dos clientes e retornar um `JSON` como resposta. O resultado é retornado de forma paginada, portanto é importante fazer um loop de consultas em sua aplicação, caso queria percorrer os dados em sua totalidade.

Os seguintes parâmetros podem/devem ser utilizados:

| **Atributo** | **Descrição** | **Obrigatório** |
| --- | --- | --- |
| pagina | Número da Página da Consulta | **Sim** |
| itens_por_pagina | Quantidade de Registro por Página da consulta | **Sim** |
| tipo_data_cliente | Tipo de Data Cliente | Não |
| data_inicio | Data de Cadastro Cliente Inicial | Não |
| data_fim | Data de Cadastro Cliente Final | Não |
| tipo_data_cliente_servico | Tipo de Data Cliente Serviço | Não |
| data_inicio_cliente_servico | Data de Inicio Cliente Servico | Não |
| data_fim_cliente_servico | Data de Fim Cliente Servico | Não |
| cancelado | Retornar serviços cancelados | Não |
| possui_pacote | Retorna apenas clientes que possuem ou não pacotes | Não |
| codigo_pacote | Retorna apenas os clientes que contém pacotes com o código especificado | Não |
| servico_status | Filtro que ao ser preenchido irá trazer somente clientes que possuem planos com esse status | Não |
| relacoes | Carrega apenas os relacionamentos especificados | Não |
| grupo_cliente_servico | Filtro que ao ser preenchido irá trazer somente os clientes que estão vinculados aos Grupos de Serviço do Cliente que estão sendo filtrados | Não |
| grupo_cliente | Filtro que ao ser preenchido irá trazer somente os clientes que estão vinculados aos Grupos de Cliente que estão sendo filtrados | Não |
| motivo_cancelamento | Filtro que ao ser preenchido irá trazer somente os serviços cancelados que estão vinculados aos Motivos de Cancelamento que estão sendo filtrados. Para poder utilizar o filtro corretamente, precisa que retorne os dados dos serviços cancelados, para poder filtrar os motivos. | Não |
| vendedor | Filtro que ao ser preenchido irá trazer somente os clientes que estão vinculados vendedor que estão sendo filtrados. Necessário filtrar o ID do usuário | Não |
| ibge_cidade_instalacao | Filtro que, ao ser preenchido, exibirá apenas os clientes vinculados à cidade cujo código IBGE foi informado no filtro, considerando o endereço de instalação do serviço. | Não |
| cancelado_mas_possui_fatura_em_aberto_desde | Filtra clientes cancelados que possuem faturas em aberto com vencimento a partir da data informada. (Nota 1) | Não |
| aguardando_migracao | Retorna clientes com o status Aguardando Migração | Não |

Os atributos podem conter os seguintes valores:

| **Atributo** | **Descrição** | **Valor Default** |
| --- | --- | --- |
| pagina | Valor númerico. A primeira página será 0 | Nenhum |
| itens_por_pagina | Valor númerico. Mínimo: 1, Máximo: 500 | Nenhum |
| tipo_data_cliente | Valores Aceitos: data_cadastro, data_nascimento, data_atualizacao | data_cadastro |
| data_inicio | Valor no formato DateTime (YYYY-MM-DD) | Nenhum |
| data_fim | Valor no formato DateTime (YYYY-MM-DD) Obs: Maior ou igual data_inicio | Nenhum |
| tipo_data_cliente_servico | Valores Aceitos: data_cadastro, data_cancelamento, data_habilitacao, data_venda, data_atualizacao | data_cadastro |
| data_inicio_cliente_servico | Valor no formato DateTime (YYYY-MM-DD) | Nenhum |
| data_fim_cliente_servico | Valor no formato DateTime (YYYY-MM-DD) Obs: Maior ou igual data_inicio_cliente_servico | Nenhum |
| cancelado | sim,nao | nao |
| possui_pacote | sim,nao | nao |
| codigo_pacote | Valor no formato string | Nenhum |
| servico_status | `agendado_para_instalacao`  <br>`aguardando_assinatura_contrato`  <br>`aguardando_configuracao`  <br>`aguardando_instalacao`  <br>`aguardando_liberacao_ti`  <br>`aguardando_migracao`  <br>`cancelado`  <br>`franquia_excedida`  <br>`inativo`  <br>`servico_habilitado`  <br>`suspenso_debito`  <br>`suspenso_parcialmente`  <br>`suspenso_pedido_cliente` |  |
| relacoes | `endereco_instalacao,   endereco_cadastral,   endereco_cobranca,   endereco_fiscal,   pacotes,   interface,   interface_roteamento   equipamento_conexao,   equipamento_roteamento,   grupos,   porta_atendimento,   senhas,   cpes,   endereco_cadastral_cliente,   stfc,   mvno,   anexos,   parametros_pacote,   parametros_mvno, cliente_servico_mapeamento,   parametros,   parametros_servico` | Nenhum |
| grupo_cliente_servico | Valor no formato string | Nenhum |
| grupo_cliente | Valor no formato string | Nenhum |
| motivo_cancelamento | Valor no formato string (id_motivo_cancelamento) | Nenhum |
| vendedor | Valor no formato string (id) | Nenhum |
| ibge_cidade_instalacao | Valor no formato string (ibge) | Nenhum |
| cancelado_mas_possui_fatura_em_aberto_desde | Valor no formato DateTime (YYYY-MM-DD) - (Nota 1) | Nenhum |
| aguardando_migracao | sim,nao | nao |

**IMPORTANTE:** Lembre-se que essa é uma requisição que poderá retornar um volume muito grande de dados, portanto, utilize as relações com cautela, pois quanto mais relações forem utilizados, maior poderá ser o tempo de resposta da API.

**IMPORTANTE 2:** Caso deseje enviar o parâmetro `servico_status` com mais de um status simultaneamente, separe os valores por vírgula.  
Exemplo: `servico_habilitado,suspenso_debito`

**IMPORTANTE 3:** Caso deseje enviar o parâmetro `motivo_cancelamento`/`grupo_cliente_servico` / `grupo_cliente` / `vendedor` com mais de um id simultaneamente, separe os valores por vírgula. Lembrando que deve ser enviado os ids.  
Exemplo: `123,123`

**NOTA 1:** Ao utilizar o parâmetro `cancelado_mas_possui_fatura_em_aberto_desde`, serão filtrados apenas os serviços que estão cancelados **e** que possuem faturas em aberto a partir da data informada.  
A data deve ser enviada no formato **DateTime (YYYY-MM-DD)**.  
**Importante:** este filtro **só funciona** se o parâmetro `cancelado` estiver com o valor **"sim"**, pois é necessário primeiro considerar apenas os serviços cancelados para, então, aplicar o filtro por fatura em aberto.

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "paginacao": {
        "primeira_pagina": 0,
        "ultima_pagina": 501,
        "pagina_atual": 496,
        "total_registros": 1506
    },
    "clientes": [
        {
            "id_cliente": 25138,
            "codigo_cliente": 2023,
            "nome_razaosocial": "TESTE",
            "nome_fantasia": null,
            "tipo_pessoa": "pf",
            "cpf_cnpj": "57893953098",
            "telefone_primario": "3799999999",
            "telefone_secundario": null,
            "telefone_terciario": null,
            "email_principal": null,
            "email_secundario": null,
            "rg": null,
            "rg_emissao": null,
            "inscricao_municipal": null,
            "inscricao_estadual": null,
            "data_cadastro": "2022-09-28 15:06:27",
            "data_nascmento": null,
            "servicos": [
                {
                    "id_cliente_servico": 17711,
                    "id_servico": 2734,
                    "numero_plano": 0,
                    "nome": "COMBO 30MBPS + 30MBPS",
                    "valor": 89.9,
                    "status": "Aguardando Instalação",
                    "status_prefixo": "aguardando_instalacao",
                    "tecnologia": "FIBRA",
                    "velocidade_download": "30 Mbits",
                    "velocidade_upload": "30 Mbits",
                    "login": "teste20230",
                    "senha": "8459f16
```

---
## PUT — Editar Cadastro
*Clientes*

```
PUT {{url}}/api/v1/integracao/cliente/cadastro/:id_cliente 
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**PUT**

No método `PUT`, será possível editar os dados de cadastro do cliente.

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| tipo_pessoa | Tipo de Pessoa | Sim |
| ativo | Cliente Ativo | Sim |
| nome_razaosocial | Nome Razão Social Cliente | Sim |
| nome_fantasia | Nome Fantasia do Cliente | Não |
| cpf_cnpj | CPF ou CNPJ | Sim |
| inscricao_estadual | Inscrição Estadual | Valida o Formulario de Cadastro e Edição de Clientes |
| inscricao_municipal | Inscrição Municipal | Valida o Formulario de Cadastro e Edição de Clientes |
| rg | RG do Cliente | Valida o Formulario de Cadastro e Edição de Clientes |
| rg_emissor | RG Emissor | Valida o Formulario de Cadastro e Edição de Clientes |
| data_nascimento | Data de Nascimento | Valida o Formulario de Cadastro e Edição de Clientes |
| telefone_primario | Telefone Primario | Sim |
| telefone_secundario | Telefone Secundario | Valida o Formulario de Cadastro e Edição de Clientes |
| telefone_terciario | Telefone Terciario | Valida o Formulario de Cadastro e Edição de Clientes |
| email_principal | E-mail Principal | Valida o Formulario de Cadastro e Edição de Clientes |
| email_secundario | E-mail Secundario | Valida o Formulario de Cadastro e Edição de Clientes |
| grupos | Grupos de Cliente | Valida o Formulario de Cadastro e Edição de Clientes |
| origem_cliente | Origem do Cliente | Valida o Formulario de Cadastro e Edição de Clientes |
| motivo_contratacao | Motivo de Contratação do Cliente | Valida o Formulario de Cadastro e Edição de Clientes |
| nome_pai | Nome do Pai | Valida o Formulario de Cadastro e Edição de Clientes |
| nome_mae | Nome da Mãe | Valida o Formulario de Cadastro e Edição de Clientes |
| estado_civil | Estado Civil | Valida o Formulario de Cadastro e Edição de Clientes |
| genero | Genero | Valida o Formulario de Cadastro e Edição de Clientes |
| nacionalidade | Nacionalidade | Valida o Formulario de Cadastro e Edição de Clientes |
| profissao | Profissão | Valida o Formulario de Cadastro e Edição de Clientes |
| id_externo | ID Externo | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| tipo_pessoa | `pj / pf` | `NULL` |
| ativo | `Booleano (true/false)` | `NULL` |
| nome_razaosocial | `Text` | `NULL` |
| nome_fantasia | `Text` | `NULL` |
| cpf_cnpj | `Integer` | `NULL` |
| inscricao_estadual | `Integer` | `NULL` |
| inscricao_municipal | `Integer` | `NULL` |
| rg | `Integer` | `NULL` |
| rg_emissor | `Integer` | `NULL` |
| data_nascimento | `Formato Date (YYYY-MM-DD)` | `NULL` |
| telefone_primario | `Integer` | `NULL` |
| telefone_secundario | `Integer` | `NULL` |
| telefone_terciario | `Integer` | `NULL` |
| email_principal | `Text` | `NULL` |
| email_secundario | `Text` | `NULL` |
| grupos | `Array de objetos contendo (id_grupo_cliente)` | `NULL` |
| origem_cliente | `Id origem_cliente` | `NULL` |
| motivo_contratacao | `Id motivo_contratacao` | `NULL` |
| nome_pai | `Text` | `NULL` |
| nome_mae | `Text` | `NULL` |
| estado_civil | `Prefixo estado_civil (solteiro / casado / viuvo / separado_judicialmente / divorciado)` | `NULL` |
| genero | `Prefixo generos (feminino/ masculino / outro)` | `NULL` |
| nacionalidade | `Prefixo nacionalidades (brasileiro / estrangeiro)` | `brasileiro` |
| profissao | `Text` | `NULL` |
| id_externo | `Text` | `NULL` |

**Corpo da requisição (JSON):**

```json
{
  "tipo_pessoa": "pf",
  "ativo": true,
  "nome_razaosocial": "Teste Fellipe",
  "nome_fantasia": "Teste Fantasia",
  "cpf_cnpj": "92085857000",
  "inscricao_municipal": "397868341044",
  "inscricao_estadual": "206731852242",
  "rg": "237004185",
  "rg_emissor": "SSP",
  "data_nascimento": "2000/11/11",
  "telefone_primario": "53994425846",
  "telefone_secundario": "99989590565",
  "telefone_terciario": "73993842392",
  "email_principal": "teste01@gmail.com",
  "email_secundario": "teste02@gmail.com",
  "grupos": [
    {
      "id_grupo_cliente": 47
    }
  ],
  "origem_cliente": 20,
  "motivo_contratacao": 1,
  "nome_pai": "teste pai",
  "nome_mae": "teste mae",
  "estado_civil": "solteiro",
  "genero": "feminino",
  "nacionalidade": "brasileiro",
  "profissao": "TESTE"
}
```

**Exemplo de resposta — Sucesso** (`HTTP 200 OK`)

```json
{
    "status": "success",
    "msg": "Cliente atualizado com sucesso!",
    "cliente": {
        "id_cliente": 12088,
        "id_origem_cliente": 20,
        "nome_razaosocial": "TESTE FELLIPE",
        "nome_fantasia": "TESTE FANTASIA",
        "telefone_primario": "53994425846",
        "telefone_secundario": "99989590565",
        "telefone_terciario": "73993842392",
        "cpf_cnpj": "92085857000",
        "rg": "237004185",
        "rg_emissor": "SSP",
        "inscricao_municipal": "397868341044",
        "inscricao_estadual": "206731852242",
        "tipo_pessoa": "pf",
        "codigo_cliente": 1266,
        "data_nascimento": "2000-11-11 00:00:00",
        "email_principal": "teste01@gmail.com",
        "email_secundario": "teste02@gmail.com",
        "data_cadastro": "2019-01-07 15:31:33",
        "id_usuario": 22,
        "ativo": true,
        "id_push_notification": null,
        "nome_pai": "TESTE PAI",
        "nome_mae": "TESTE MAE",
        "estado_civil": "solteiro",
        "genero": "feminino",
        "nacionalidade": "brasileiro",
        "profissao": "TESTE",
        "blocklist": false,
        "motivo_blocklist": null,
        "id_motivo_contratacao": 1,
        "consumidor_final": "1",
        "indicador_inscricao_estadual": "9",
        "representante_legal_nome_razaosocial": null,
        "representante_legal_cpf_cnpj": null,
        "representante_legal_rg": null,
        "representante_legal_endereco": null,
        "representante_legal_nacion
```

---
## GET — Consultar
*Clientes*

```
GET {{url}}/api/v1/integracao/cliente
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
| `inativo` | `` |
| `limit` | `` |
| `cancelado` | `` |
| `ultima_conexao` | `` |
| `incluir_alarmes` | `` |
| `incluir_contrato` | `` |
| `incluir_stfc` | `` |
| `incluir_mvno` | `` |
| `servico_status` | `` |
| `order_by` | `` |
| `order_type` | `` |

**Descrição:**

No método `GET,` irá consultar os dados dos clientes e retornar um `JSON` como resposta. Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| busca | Tipo de busca que deseja fazer no cliente | Sim |
| Inativo | buscar os clientes que tem o cadastro inativo | não |
| termo_busca | Termo utilizado para fazer a busca | Sim |
| limit | Limite de resultados | Não |
| cancelado | Informa se deseja trazer os serviços cancelados ou não | Não |
| ultima_conexao | Informa se deseja trazer os dados da última conexão | Não |
| incluir_alarmes | Informa se deseja incluir os alarmes de conexão do serviço | Não |
| incluir_contrato | Informa se deseja incluir os contratos do serviço | Não |
| incluir_stfc | Informa se deseja incluir os dados de STFC vinculados ao serviço | Não |
| incluir_mvno | Informa se deseja incluir os dados de MVNO vinculados ao serviço | Não |
| incluir_anexos | Informa se deseja incluir os dados de anexos vinculados ao cliente | Não |
| incluir_desbloqueios | Informa se deseja incluir os dados de desbloqueio em confiança vinculados ao serviço | Não |
| servico_status | Filtro que ao ser preenchido irá trazer somente clientes que possuem planos com esse status | Não |
| grupo_cliente_servico | Filtro que ao ser preenchido irá trazer somente clientes que possuem planos com esse grupo | Não |
| cancelado_mas_possui_fatura_em_aberto_desde | Filtra clientes cancelados que possuem faturas em aberto com vencimento a partir da data informada. (Nota 1) | Não |
| pagina | Número da Página da Consulta Cliente Serviço (Nota 2) | Não |
| itens_por_pagina | Quantidade de Registro por Página da consulta Cliente Serviço (Nota 2) | Não |
| order_by | Campo que será utilizado para ordenação | Não |
| order_type | Tipo de Ordenação | Não |
| relacoes | Carrega apenas os relacionamentos especificados | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| inativo | sim,nao,todos | Não |
| busca | nome_razaosocial,  <br>nome_fantasia,  <br>cpf_cnpj,  <br>codigo_cliente,  <br>telefone,  <br>login_radius,  <br>ipv4,  <br>mac,  <br>id_cliente_servico,  <br>uuid_cliente,  <br>uuid_cliente_servico,  <br>id_prospecto,  <br>id_externo,  <br>referencia_alias,  <br>id_porta_atendimento,  <br>id_caixa_optica,  <br>observacoes_autenticacao,  <br>id_servico,  <br>id_cliente_servico_mapeamento,  <br>id_cliente | Nenhum |
| termo_busca | Campo livre (Qualquer valor será aceito) | Nenhum |
| limit | Valor mínimo 1, Valor Máximo 100. | 5 |
| cancelado | sim,nao | nao |
| ultima_conexao | sim,nao | nao |
| incluir_alarmes | sim,nao | nao |
| incluir_contrato | sim,nao | nao |
| incluir_stfc | sim,nao | nao |
| incluir_mvno | sim,nao | nao |
| incluir_anexos | sim,nao | nao |
| incluir_desbloqueios | sim,nao | nao |
| servico_status | `agendado_para_instalacao`  <br>`aguardando_assinatura_contrato`  <br>`aguardando_configuracao`  <br>`aguardando_instalacao`  <br>`aguardando_liberacao_ti`  <br>`aguardando_migracao`  <br>`cancelado`  <br>`franquia_excedida`  <br>`inativo`  <br>`servico_habilitado`  <br>`suspenso_debito`  <br>`suspenso_parcialmente`  <br>`suspenso_pedido_cliente` |  |
| grupo_cliente_servico | Valor no formato String (Nota 3) |  |
| cancelado_mas_possui_fatura_em_aberto_desde | Valor no formato DateTime (YYYY-MM-DD) - (Nota 1) |  |
| pagina | Valor númerico. A primeira página será 1 (Nota 2) | 1 (Caso tenha mais de 1000 registros) |
| itens_por_pagina | Valor númerico. Mínimo: 1, Máximo: 500 (Nota 2) | 200 (Caso tenha mais de 1000 registros) |
| order_by | data_cadastro,data_fechamento | data_cadastro |
| order_type | asc,desc | asc |
| relacoes | `grupos, porta_atendimento, interface, interface_roteamento, equipamento_conexao, equipamento_roteamento, cpes, pacotes, parametros_pacote, senhas, endereco_instalacao, endereco_cadastral, endereco_cobranca, endereco_fiscal, status_conexao, parametros_mvno, cliente_servico_mapeamento,`  <br>`parametros,   parametros_servico` | Nnehum |

Avisos:

`IMPORTANTE`: Para trazer os dados da última autenticação, é necessário enviar o parâmetro `ultima_conexao`\=sim. A última conexão utiliza como base o extrato de conexão do `RADIUS`, por isso, caso existam problemas na rede do provedor, essa informação poderá não ser 100% confiável, uma vez, que ela depende que o concentrador do provedor, informe ao servidor `RADIUS` o estado atual da conexão do cliente.

`IMPORTANTE 2`: Para que o `HubSoft` consiga retornar os dados de coordenadas do endereço, é importante que o provedor tenha configurado em seus sistema, as credenciais de integração com o Google Maps API. O `HubSoft` irá verificar apenas os endereços de instalação, para fazer a atualização de coordenadas.

`IMPORTANTE 3`: O provedor poderá cadastrar os alertas, que serão retornados aqui na `API`, pelos atributos alerta e `alerta_mensagens`. Esses alertas, podem ser utilizados pelo software que está consumindo a `API`, para enviar uma mensagem automática em um `BOT` para o cliente, ou soltar um áudio customizado no PBX, quando o cliente ligar, ou ainda exibir o cliente de uma cor diferente no mapa. As possibilidades são muitas e vão depender exclusivamente da criatividade do integrador. A equipe do `HubSoft` estará sempre a disposição para ajudar os desenvolvedores em suas integrações conosco :)

`IMPORTANTE 4`**:** Caso deseje enviar o parâmetro `servico_status` com mais de um status simultaneamente, separe os valores por vírgula.  
Exemplo: `servico_habilitado,suspenso_debito IMPORTANTE 5`**:** Caso deseje enviar o parâmetro `parametros` com mais de uma relação simultaneamente, separe os valores por vírgula.  
Exemplo: `grupos,endereco_instalacao`

**NOTA 1:** Ao utilizar o parâmetro `cancelado_mas_possui_fatura_em_aberto_desde`, serão filtrados apenas os serviços que estão cancelados **e** que possuem faturas em aberto a partir da data informada.  
A data deve ser enviada no formato **DateTime (YYYY-MM-DD)**.  
**Importante:** este filtro **só funciona** se o parâmetro `cancelado` estiver com o valor **"sim"**, pois é necessário primeiro considerar apenas os serviços cancelados para, então, aplicar o filtro por fatura em aberto.

**NOTA 2:** Caso o cliente consultado possua mais de 1000 serviços, a consulta individual pode apresentar lentidão. Nesses casos, a Hubsoft aplicará automaticamente a paginação dos serviços. Para navegar entre as páginas, utilize os parâmetros `pagina` e `itens_por_pagina`.

**NOTA 3:** Deve ser enviado o ID do Grupo. Caso deseje enviar o parâmetro `grupo_cliente_servico` com mais de um grupo simultaneamente, separe os valores por vírgula.

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso",
    "clientes": [
        {
            "id_cliente": 11201,
            "codigo_cliente": 421,
            "nome_razaosocial": "GUILHERME SILVA",
            "nome_fantasia": null,
            "tipo_pessoa": "pf",
            "cpf_cnpj": "10682083681",
            "telefone_primario": "37988242968",
            "telefone_secundario": "37988242968",
            "telefone_terciario": "",
            "email_principal": "guilherme@silva.com.br",
            "email_secundario": null,
            "rg": "MG16999888",
            "rg_emissao": null,
            "inscricao_municipal": null,
            "inscricao_estadual": null,
            "data_cadastro": "2017-08-05 00:00:00",
            "data_nascmento": "1969-12-31 04:00:00",
            "alerta": true,
            "alerta_mensagens": [
                "Existe um rompimento de fibra no bairro Centro, na cidade Divinópolis que está afetando esse cliente",
                "A equipe técnica já está a caminho para resolver o rompimento de fibra"
            ],
            "servicos": [
                {
                    "id_cliente_servico": 11201,
                    "numero_plano": 1,
                    "nome": "4M",
                    "valor": 119.9,
                    "status": "Serviço Habilitado",
                    "status_prefixo": "servico_habilitado",
                    "tecnologia": "WIRELESS",
                    "login": "guilhermesilva1068
```

---
## POST — Adicionar Anexos
*Clientes*

```
POST {{url}}/api/v1/integracao/cliente/adicionar_anexo/{id_cliente}
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

Através desse endpoint será possível adicionar anexos no cadastro do cliente e obter o retorno no formato JSON como resposta. Lembre de enviar o ID do Cliente como um parâmetro na URL, conforme o exemplo acima. Os seguintes parâmetros podem/devem estar presentes no corpo do requisição:

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