# Rede

**Necessário**

Para fazer requisições nos dados de REDE, é necessário que você já possua o `access_token`, conseguido na etapa (`oAuth`)

## CPE

### GET — Todos
*Rede / CPE*

```
GET {{url}}/api/v1/integracao/rede/cpe/todos
```

**Descrição:**

O método **POST** /todos permite filtrar as CPEs de forma paginada. O atributo **parametros** retorna até 5 parâmetros por CPE.

Neste `endpoint`, será possível consultar todas as O.S., obtendo o retorno no formato `JSON` como resposta. Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| pagina | Página a ser exibida | Sim |
| itens_por_pagina | Itens por Página a serem exibidos. Mínimo: 20, Máximo: 500. | Sim |
| data_inicio | Data inicial de referência para consulta de ordens de serviço em um intervalo | Não |
| data_fim | Data final de referência para consulta de ordens de serviço em um intervalo | Não |
| busca | Tipo de busca que deseja fazer na cpe | Não |
| termo_busca | Termo utilizado para fazer a busca | Não |
| somente_assinante_associado | Informa se deve retornar somente CPEs vinculadas a serviços e que não estão cancelados | Não |
| tipo_data | Tipo de Data | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| pagina | Campo Inteiro (integer) | 0 |
| itens_por_pagina | Campo Inteiro (integer) | 50 |
| data_inicio | Formato Timestamp (YYYY-MM-DD HH:MI:SS ) | Nenhum |
| data_fim | Formato date (YYYY-MM-DD HH:MI:SS) | Nenhum |
| busca | login, phy_addr, id_cliente_servico | Nenhum |
| termo_busca | Campo livre (Qualquer valor será aceito) | Nenhum |
| somente_assinante_associado | Campo texto (sim ou nao) | sim |
| tipo_data | Valores Aceitos: data_ultima_atualizacao, data_cadastro_historico_parametro | Nenhum |

**Corpo da requisição (JSON):**

```json

```

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "paginacao": {
        "primeira_pagina": 0,
        "ultima_pagina": 0,
        "pagina_atual": 0,
        "total_registros": 3
    },
    "cpes": [
        {
            "id_cpe": 71189,
            "phy_addr": "MKPGb48204d8",
            "data_ultima_atualizacao": "2023-12-22 16:28:20",
            "historico_parametros": [],
            "servicos": [
                {
                    "id_cliente": 24402,
                    "cliente": "(1664) WALLAS BATISTA DA SILVA - (INATIVO)",
                    "cpf_cnpj": "04430928185",
                    "servico": "(0) COMBO 10 MEGA - NOVO",
                    "status": "servico_habilitado",
                    "id_cliente_servico": 15594,
                    "login": "batista.035"
                }
            ]
        },
        {
            "id_cpe": 73324,
            "phy_addr": "ZTEGCF2C769C",
            "data_ultima_atualizacao": "2024-01-19 13:19:09",
            "historico_parametros": [],
            "servicos": [
                {
                    "id_cliente": 24881,
                    "cliente": "(1858) ANDRÉ AUGUSTO - (INATIVO)",
                    "cpf_cnpj": "14223486608",
                    "servico": "(0) 200MB",
                    "status": "servico_habilitado",
                    "id_cliente_servico": 17061,
                    "login": "hubsoft.augusto"
                }
            ]
        },
        {
            "i
```

---
### POST — Reiniciar
*Rede / CPE*

```
POST {{url}}/api/v1/integracao/rede/reiniciar_cpe/:phy_addr
```

**Descrição:**

O método **POST** /rede/reiniciar_cpe/ permite reiniciar a CPE do cliente. Apenas CPES já encontradas pelo sistema web uma unica vez poderão ser reiniciadas através deste endpoint.

**Corpo da requisição (form-data):**

| Campo | Tipo | Exemplo/Descrição |
| --- | --- | --- |

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Comando de reinicialização executado com sucesso!"
}
```
**Exemplo de resposta — Erro**

```json
{
  "status": "error",
  "msg": "Equipamento não encontrado!",
  "errors": []
}
```

---
### POST — Restaurar
*Rede / CPE*

```
POST {{url}}/api/v1/integracao/rede/restaurar_cpe/:phy_addr
```

**Descrição:**

O método **POST** /rede/restaurar_cpe/ permite restaurar a CPE do cliente aos padroes de fábrica. Apenas CPES já encontradas pelo sistema web uma unica vez poderão ser restauradas através deste endpoint.

**Corpo da requisição (form-data):**

| Campo | Tipo | Exemplo/Descrição |
| --- | --- | --- |

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "O Comando de restauração de configurações de fábrica foi executado com sucesso!"
}
```
**Exemplo de resposta — Erro**

```json
{
  "status": "error",
  "msg": "Equipamento não encontrado!",
  "errors": []
}
```

---
### GET — Iniciar Gerenciamento
*Rede / CPE*

```
GET {{url}}/api/v1/integracao/rede/cpe/iniciar_gerenciamento
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `phy_addr` | `ZTEXX12345AB` |

**Descrição:**

No método `GET`, irá consultar os parâmetros atuais da configuração de Wifi da CPE.

> Os seguintes parâmetros podem/devem ser utilizados: 
  

| **Atributo** | **Descrição** | **Obrigatório** |
| --- | --- | --- |
| id_cpe | Identificador da CPE | **Não** |
| phy_addr | Endereço físico da CPE | **Não** |

Os atributos podem conter os seguintes valores:

| **Atributo** | **Descrição** | **Valor Default** |
| --- | --- | --- |
| id_cpe | Valor númerico | Nenhum |
| phy_addr | Valor no formato string (Mac Address ou Serial da CPE) | Nenhum |

**IMPORTANTE:** Deve ser utilizado somente um parâmetro, sendo assim, deve ser informado o **id_cpe** ou **phy_addr**, ambos juntos irá gerar um erro de validação na requisição.

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Gerenciamento iniciado com sucesso!",
  "cpe": {
    "id_cpe": 1000,
    "phy_addr": "ZTEXX12345AB",
    "parametros": [
      {
        "descricao": "Nome da Rede Wifi",
        "prefixo": "wifi_ssid",
        "parametro": "wifi_ssid",
        "valor": "SSID_01"
      },
      {
        "descricao": "Senha da Rede Wifi",
        "prefixo": "wifi_password",
        "parametro": "wifi_password",
        "valor": "ssid01_password"
      },
      {
        "descricao": "Nome da Rede Wifi 5Ghz",
        "prefixo": "wifi_ssid_5ghz",
        "parametro": "wifi_ssid_5ghz",
        "valor": "SSID_02"
      },
      {
        "descricao": "Senha da Rede Wifi 5Ghz",
        "prefixo": "wifi_password_5ghz",
        "parametro": "wifi_password_5ghz",
        "valor": "ssid02_password"
      }
    ]
  }
}
```

---
### POST — Gerenciar (Configurar)
*Rede / CPE*

```
POST {{url}}/api/v1/integracao/rede/cpe/gerenciar
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

Através deste endpoint, será possível realizar a configuração/alteração dos parâmetros da CPE.

**Aviso:** a requisição será enviada ao gerenciador de CPE a qual a CPE estiver vinculada no sistema, consequentemente as alterações serão refletidas na configuração atual da CPE.

**Atributos da Requisição**

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| id_cpe | Identificador único da CPE | Sim |
| parametros | Identificador único do modelo de contrato | Sim |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| id_cpe | Deve conter um valor númerico | Nenhum |
| parametros | Deve conter um array de objetos contendo as chaves: prefixo e valor | Nenhum |

**Aviso:** Os dados enviados no array de parâmetros (prefixo/valor) devem estar em conformidade com o mesmo nome e formato retornados pela consulta de configuração da CPE (endpoint: `iniciar_gerenciamento`). Caso sejam enviados dados com prefixos ou valores divergentes, a requisição será rejeitada com um erro de validação, informando que os parâmetros fornecidos são inválidos.

**Corpo da requisição (JSON):**

```json
{
  "id_cpe": 1000,
  "parametros": [
    {
      "prefixo": "wifi_ssid",
      "valor": "NovoWifiSSID"
    }
  ]
}
```

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Parâmetros alterados com sucesso!",
  "cpe": {
    "id_cpe": 1000,
    "phy_addr": "ZTEXX12345AB",
    "parametros": [
      {
        "descricao": "Nome da Rede Wifi",
        "prefixo": "wifi_ssid",
        "parametro": "wifi_ssid",
        "valor": "NovoWifiSSID"
      },
      {
        "descricao": "Senha da Rede Wifi",
        "prefixo": "wifi_password",
        "parametro": "wifi_password",
        "valor": "ssid01_password"
      },
      {
        "descricao": "Nome da Rede Wifi 5Ghz",
        "prefixo": "wifi_ssid_5ghz",
        "parametro": "wifi_ssid_5ghz",
        "valor": "SSID_02"
      },
      {
        "descricao": "Senha da Rede Wifi 5Ghz",
        "prefixo": "wifi_password_5ghz",
        "parametro": "wifi_password_5ghz",
        "valor": "ssid02_password"
      }
    ]
  }
}
```

---
## GET — Equipamento
*Rede*

```
GET {{url}}/api/v1/integracao/rede/equipamento
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

## GET

No método `GET`, será possível consultar os equipamentos que estão cadastrados dentro do sistema.

Os seguintes `Query Params` estão disponíveis para consulta e personalização da resposta.

| **Atributo** | **Descrição** | **Obrigatório** |
| --- | --- | --- |
| `busca` | Tipo de busca que deseja fazer no equipamento | Não |
| `termo_busca` | Termo utilizado para fazer a busca | Não |

Os atributos podem conter os seguintes valores:

| **Atributo** | **Descrição** | **Valor Default** |
| --- | --- | --- |
| `busca` | `id_equipamento`, `ipv4`, `ipv6`, `id_modelo_equipamento`, `id_tipo_equipamento`, `nome_modelo_equipamento`, `nome_tipo_equipamento` | `NULL` |
| `termo_busca` | Campo livre (Qualquer valor será aceito) | `NULL` |

**`IMPORTANTE:`** Os filtros `nome_modelo_equipamento` e `nome_tipo_equipamento` fazem busca parcial e ignoram maiúsculas/minúsculas. Os demais filtros fazem busca por correspondência exata.

**`IMPORTANTE 2:`** Caso deseje filtrar por IDs para realizar uma busca mais precisa, utilize as rotas `/api/v1/integracao/configuracao/modelo_equipamento` e `/api/v1/integracao/configuracao/tipo_equipamento` para consultar os IDs e nomes corretos dos modelos e tipos de equipamentos que deseja buscar.

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso.",
    "equipamentos": [
        {
            "id_equipamento": 1374,
            "nome": "ACCEL-SDT-01",
            "ipv4": "10.20.1.80",
            "ipv6": null,
            "autentica_radius": true,
            "modelo": "SERVERU L800",
            "tipo": "ROTEADOR",
            "fabricante": "SERVERU",
            "interfaces": [
                {
                    "id_interface_conexao": 419,
                    "nome": "VLAN100",
                    "descricao": "VLAN100",
                    "tipo": "vlan",
                    "interface_conexao_roteamento": {
                        "id_interface_conexao": 419,
                        "nome": "VLAN100",
                        "descricao": "VLAN100",
                        "tipo": "vlan",
                        "equipamento_conexao": {
                            "id_equipamento": 1374,
                            "nome": "ACCEL-SDT-01",
                            "ipv4": "10.20.1.80",
                            "ipv6": null
                        }
                    }
                },
                {
                    "id_interface_conexao": 420,
                    "nome": "bridge0",
                    "descricao": "bridge0",
                    "tipo": "bridge",
                    "interface_conexao_roteamento": {
                        "id_interface_conexao": 420,
```

---
## GET — POP
*Rede*

```
GET {{url}}/api/v1/integracao/rede/pop
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**GET**

No método `GET`, será possível consultar os `POPs` e seus equipamentos de conexão que estão cadastrados no sistema.

Nota

OBSERVAÇÃO: Um `POP` pode conter 0 ou mais equipamentos de conexão associados, de acordo com as configurações estabelecidas no sistema.

**Exemplo de resposta — POP**

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso.",
    "pops": [
        {
            "id_pop": 51,
            "nome": "NOVO POP",
            "equipamentos": [
                {
                    "id_equipamento": 1402,
                    "nome": "NOVO EQUIP CADASTRADO",
                    "ipv4": "192.168.100.254",
                    "ipv6": null,
                    "modelo": "DELL 5524",
                    "fabricante": "DELL"
                }
            ]
        },
        {
            "id_pop": 53,
            "nome": "POP EXEMPLO WIKI",
            "equipamentos": [
                {
                    "id_equipamento": 1400,
                    "nome": "EXEMPLO WIKI",
                    "ipv4": "10.10.10.100",
                    "ipv6": null,
                    "modelo": "RB433AH",
                    "fabricante": "MIKROTIK"
                }
            ]
        },
        {
            "id_pop": 48,
            "nome": "POP TESTE",
            "equipamentos": [
                {
                    "id_equipamento": 1413,
                    "nome": "HUAWEI-NICNET",
                    "ipv4": "45.4.33.194",
                    "ipv6": null,
                    "modelo": "NE20E-S2F",
                    "fabricante": "HUAWEI"
                },
                {
                    "id_equipamento": 1410,
                    "nome": "OLT BDCOM",
                    "ipv4": "177.5
```

---
## GET — Zona de Atendimento
*Rede*

```
GET {{url}}/api/v1/integracao/rede/zona_atendimento
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**GET**

No método `GET`, será possível consultar as Zonas de Atendimento que estão cadastradas no sistema:

**Nota**

`OBSERVAÇÃO`: Uma zona de atendimento poderá conter 0 ou mais interfaces de conexão configuradas. O ideal de se utilizar essa rota da `API,` é que todas as Interfaces de Conexões, estejam associadas com as Zonas de Atendimento de forma correta. Verifique com o gestor da Rede do provedor, para verificar se todos os cadastros estão corretos.

**Exemplo de resposta — Zona de Atendimento**

```json
{
    "status": "success",
    "msg": "Dados consultados com sucesso.",
    "zonas_atendimento": [
        {
            "id_zona_atendimento": 12,
            "nome": "FIBRA - PIUMHI - A1R3",
            "descricao": "ATENDIMENTO FIBRA AREA 1 ROTA 3 EM PIUMHI - TESTE",
            "interfaces": [
                {
                    "id_interface_conexao": 355,
                    "nome": "A1R3_INTELBRAS",
                    "descricao": null,
                    "tipo": "gpon",
                    "equipamento_conexao": {
                        "nome": "PIU_CHASSI_INTELBRAS_ESCRIT?RIO_02",
                        "ipv4": "10.37.1.249",
                        "ipv6": null,
                        "modelo": "8820G",
                        "fabricante": "INTELBRAS"
                    }
                }
            ]
        },
        {
            "id_zona_atendimento": 13,
            "nome": "WIRELESS RAUL",
            "descricao": "REDE WIRELESS PERTO DO AP RAUL",
            "interfaces": [
                {
                    "id_interface_conexao": 51,
                    "nome": "ath0",
                    "descricao": null,
                    "tipo": "wireless",
                    "equipamento_conexao": {
                        "nome": "AP_RAUL",
                        "ipv4": "10.20.72.12",
                        "ipv6": null,
                        "modelo": "BULLET2",
                        "fabricante": "UBIQ
```

---
## GET — Caixa Optica
*Rede*

```
GET {{url}}/api/v1/integracao/rede/caixa_optica
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**GET**

No método `GET`, será possível consultar as Caixas Ópticas que estão cadastradas no sistema.

**Exemplo de resposta — Zona de Atendimento**

```json
{
  "status": "success",
  "msg": "Dados consultados com sucesso.",
  "caixas_opticas": [
    {
      "id_caixa_optica": 1,
      "nome": "A1-A1",
      "display": "A1-A1"
    },
    {
      "id_caixa_optica": 2,
      "nome": "B1-B1",
      "display": "B1-B1"
    }
  ]
}
```

---