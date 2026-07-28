# Mapeamento

**Necessário**

Para fazer requisições no `Mapeamento`, é necessário que você já possua o `access_token`, conseguido na etapa `(oAuth)`.

## Caixas Ópticas

Para fazer requisições nos dados das Caixas Ópticas, é necessário que você já possua o `access_token`, conseguido na etapa `(oAuth).`

### GET — Consulta
*Mapeamento / Caixas Ópticas*

```
GET {{url}}/api/v1/integracao/mapeamento/caixa_optica
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

No método `GET,` irá consultar os dados das caixas opticas e retornar um `JSON` como resposta. Os seguintes parâmetros podem/devem ser utilizados:

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| busca | Tipo de busca que deseja fazer na caixa optica | Sim |
| termo_busca | Termo utilizado para fazer a busca | Sim |
| id_projeto | ID do Projeto a encontrar caixas | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| busca | id_caixa_optica, nome_caixa, id_porta_atendimento | Nenhum |
| termo_busca | Campo livre (Qualquer valor será aceito) | Nenhum |
| id_projeto | ID Projeto existente na base | Nenhum |

Avisos:

IMPORTANTE: Ao utilizar a busca pelo campo `nome_caixa`, a consulta será realizada com um operador `ILIKE`, o que pode impactar o desempenho caso um termo genérico seja utilizado. Para otimizar a busca e evitar lentidão, informe um nome específico que identifique exclusivamente a caixa desejada.

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "CaixaOptica consultada com sucesso!",
    "caixas": [
        {
            "id_caixa_optica": 76,
            "id_tipo_caixa_optica": 6,
            "id_ponto_juncao": 872,
            "nome": "Caixa-01334a9",
            "area_cobertura": [],
            "cor_mapa": null,
            "id_externo": null,
            "atendimento": false,
            "parametros": null,
            "observacao": null,
            "emenda": false,
            "permite_viabilidade": true,
            "id_interface_conexao": null,
            "portas_reservadas": 0,
            "portas_vinculadas": 0,
            "portas_disponiveis": 8,
            "display": "Caixa-01334a9",
            "portas": [
                {
                    "id_porta_atendimento": 3141,
                    "sequencia": 0,
                    "reservado": false,
                    "id_caixa_optica": 76,
                    "display": "Porta #01",
                    "clientes_servicos": [],
                    "saida_elemento_rede": null,
                    "saida_splitter": null,
                    "equipamento": null
                },
                {
                    "id_porta_atendimento": 3142,
                    "sequencia": 1,
                    "reservado": false,
                    "id_caixa_optica": 76,
                    "display": "Porta #02",
                    "clientes_servicos": [],
                    "saida_elemento_rede": null,
```

---
### GET — Listar
*Mapeamento / Caixas Ópticas*

```
GET {{url}}/api/v1/integracao/mapeamento/projeto/{id_projeto}/caixa_optica
```

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `busca` | `{busca}` |
| `termo_busca` | `{termo_busca}` |
| `pagina` | `1` |
| `itens_por_pagina` | `10` |

**Descrição:**

**GET**

No método `GET`, irá consultar/listar os dados das caixas ópticas e retornar um `JSON` como resposta.

Os seguintes parâmetros podem/devem ser utilizados:

| **Atributo** | **Descrição** | **Obrigatório** |
| --- | --- | --- |
| id_projeto | ID do Projeto de Mapeamento | Sim |
| itens_por_pagina | Determina quantas caixas vo ser retornadas | Não |
| pagina | Determina qual pagina atual | Não |
| termo_busca | Tipo de busca utilizado para buscar uma caixa especifíca. Valores aceitos: `nome, id_caixa_optica, id_porta_atendimento` | Não |
| busca | Termo utilizado para fazer a busca | Não |
| atendimento | Consulta as CTOs de Atendimento. Valores Aceitos: (`sim, nao, todos`). Valor Padrão: `todos` | Não |
| emenda | Consulta as CTOs de Emenda. Valores Aceitos: (`sim, nao, todos`). Valor Padrão: `todos` | Não |

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "CaixaOpticas consultados com sucesso!",
    "caixas": [
        {
            "id_caixa_optica": 1005,
            "id_tipo_caixa_optica": 6,
            "id_ponto_juncao": 1455,
            "nome": "Caixa-f679386",
            "area_cobertura": [],
            "cor_mapa": null,
            "id_externo": null,
            "id_interface_conexao": null,
            "atendimento": false,
            "parametros": null,
            "observacao": null,
            "emenda": false,
            "display": "Caixa-f679386"
        },
        {
            "id_caixa_optica": 173,
            "id_tipo_caixa_optica": 5,
            "id_ponto_juncao": 1139,
            "nome": "caixa 2",
            "area_cobertura": [],
            "cor_mapa": null,
            "id_externo": null,
            "id_interface_conexao": null,
            "atendimento": false,
            "parametros": null,
            "observacao": null,
            "emenda": false,
            "display": "caixa 2"
        },
        {
            "id_caixa_optica": 23032,
            "id_tipo_caixa_optica": 5,
            "id_ponto_juncao": 1451,
            "nome": "Caixa-24cb8a5",
            "area_cobertura": [],
            "cor_mapa": null,
            "id_externo": null,
            "id_interface_conexao": null,
            "atendimento": false,
            "parametros": null,
            "observacao": null,
            "emenda": fal
```

---
## Viabilidade

Para fazer requisições de `Viabilidade`, é necessário que você já possua o `access_token`, conseguido na etapa `(oAuth).`

### POST — Endereço
*Mapeamento / Viabilidade*

```
POST {{url}}/api/v1/integracao/mapeamento/viabilidade/consultar
```

**Descrição:**

**POST**

Para fazer requisições de Viabilidade, é necessário que você já possua o `access_token`, conseguido na etapa `(oAuth).`

Em seguida preciso passar os seguintes parmetros:

| Atributo | Descriço | Obrigatório |
| --- | --- | --- |
| `tipo_busca` | Defina o tipo de viabilidade como "endereco" | Sim |
| `raio` | Defina um valor numerico do raio de busca, como 250 | Sim |
| `numero` | Numero da residencia do endereço | Sim |
| `endereco` | Rua ou avenida do endereço | Sim |
| `bairro` | Bairro do endereço | Sim |
| `cidade` | Cidade do endereço | Sim |
| `estado` | Estado do endereço | Sim |
| `detalhar_portas` | Boolean (true/false) se deseja que detalhe as portas disponiveis/reservadas/ocupadas.  <br>**Padrão: false** | Não |
| `id_projeto` | ID do Projeto que queira realizar a viabilidade. (Caso não seja passado, consulta em todos os projetos ativos) | Não |

**Corpo da requisição (JSON):**

```json
{
  "tipo_busca": "endereco",
  "raio": 250,
  "endereco": {
    "numero": "85",
    "endereco": "RUA  JOSE JOAO",
    "bairro": "SÃO GERALDO",
    "cidade": "Santo Antônio do Monte",
    "estado": "MG"
  },
  "detalhar_portas": true
}
```

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Viabilidade consultado com sucesso",
    "resultado": {
        "origem": "mapeamento_local",
        "projetos": [
            {
                "projeto": {
                    "id_mapeamento_projeto": 153,
                    "nome": "Mapeamento Grandella",
                    "descricao": "Teste",
                    "coordenadas": null,
                    "producao": false,
                    "latitude": null,
                    "longitude": null
                },
                "busca": {
                    "status": "success",
                    "msg": "Elementos consultados com sucesso!",
                    "elementos": {
                        "data": [
                            {
                                "caixa": "Caixa-4c013b0",
                                "id_caixa_optica": 312,
                                "distancia": "16.34m",
                                "total": 3,
                                "disponiveis": 10,
                                "reservadas": 0,
                                "utilizadas": 0,
                                "portas_disponiveis": [
                                    {
                                        "id_porta_atendimento": 3079,
                                        "id_caixa_optica": 312,
                                        "sequencia": 0,
                                        "numero_porta": 1,
```

---
### POST — Coordenadas
*Mapeamento / Viabilidade*

```
POST {{url}}/api/v1/integracao/mapeamento/viabilidade/consultar
```

**Descrição:**

**POST**

Para fazer requisições de Viabilidade, é necessário que você já possua o `access_token`, conseguido na etapa `(oAuth).`

Em seguida preciso passar os seguintes parmetros:

| Atributo | Descriço | Obrigatório |
| --- | --- | --- |
| `tipo_busca` | Defina o tipo de viabilidade como "endereco" | Sim |
| `raio` | Defina um valor numrico do raio de busca, como 250 | Sim |
| `latitude` | Latitude do ponto a ser verificado a viabilidade | Sim |
| `longitude` | Longitude do ponto a ser verificado a viabilidade | Sim |
| `detalhar_portas` | Boolean (true/false) se deseja que detalhe as portas disponiveis/reservadas/ocupadas. **Padrão: false** | Não |
| `id_projeto` | ID do Projeto que queira realizar a viabilidade. (Caso não seja passado, consulta em todos os projetos ativos) | Não |

**Corpo da requisição (JSON):**

```json
{
  "tipo_busca": "coordenadas",
  "raio": 250,
  "latitude": -20.087333797519086,
  "longitude": -45.29056616400146,
  "detalhar_portas": true
}
```

**Exemplo de resposta — Sucesso** (`HTTP 272812 None`)

```json
{
    "status": "success",
    "msg": "Viabilidade consultado com sucesso",
    "resultado": {
        "origem": "mapeamento_local",
        "alertas": [],
        "projetos": [
            {
                "projeto": {
                    "id_mapeamento_projeto": 247,
                    "nome": "00_Projeto teste - Samuel",
                    "descricao": "Samonte",
                    "producao": true,
                    "created_at": "2021-06-16 15:25:06",
                    "updated_at": "2024-09-23 11:23:37",
                    "coordenadas": {
                        "type": "Point",
                        "coordinates": [
                            -45.293779,
                            -20.083779
                        ]
                    },
                    "deleted_at": null,
                    "id_integracao_mapeamento": null,
                    "em_sincronizacao": false,
                    "erro_sincronizacao": null,
                    "sequencias_individuais": true,
                    "cliente_unico_porta": true,
                    "bloquear_vinculo_porta_reservada": false,
                    "ultima_sincronizacao": null,
                    "validar_permissao_usuario": false,
                    "data_sincronizacao_completa": null,
                    "latitude": -20.083779,
                    "longitude": -45.293779
                },
                "busca": {
                    "status": "success",
                    "msg": "Elementos
```
**Exemplo de resposta — Sucesso Portas Detalhadas**

```json
{
    "status": "success",
    "msg": "Viabilidade consultado com sucesso",
    "resultado": {
        "origem": "mapeamento_local",
        "projetos": [
            {
                "projeto": {
                    "id_mapeamento_projeto": 247,
                    "nome": "00_Projeto teste - Samuel",
                    "descricao": "Samonte",
                    "coordenadas": {
                        "type": "Point",
                        "coordinates": [
                            -45.293779,
                            -20.083779
                        ]
                    },
                    "producao": true,
                    "latitude": -20.083779,
                    "longitude": -45.293779
                },
                "busca": {
                    "status": "success",
                    "msg": "Elementos consultados com sucesso!",
                    "elementos": {
                        "data": [
                            {
                                "caixa": "Caixa-4b1f7dd",
                                "id_caixa_optica": 336677,
                                "distancia": "99.53m",
                                "total": 6,
                                "disponiveis": 3,
                                "reservadas": 1,
                                "utilizadas": 2,
                                "portas_disponiveis": [
                                    {
                                        "id_porta_atendimento": 20948
```

---
## Porta Atendimento

Para fazer requisições nas `Portas de Atendimento`, é necessário que você já possua o `access_token`, conseguido na etapa `(oAuth).`

### PUT — Vincular
*Mapeamento / Porta Atendimento*

```
PUT {{url}}/api/v1/integracao/mapeamento/projeto/cliente_servico/porta_atendimento/{id_cliente_servico}
```

**Descrição:**

Para fazer os vinculos de porta de atendimento com o serviço do cliente, é necessário que você já possua o `access_token`, conseguido na etapa `(oAuth).`

Em seguida preciso passar os seguintes parmetros:

| Atributo | Descriço | Obrigatório |
| --- | --- | --- |
| `id_cliente_servico` | Identificador do servico do cliente que vai ser vinculado | Sim |
| `id_porta_atendimento` | Identificador da porta de atendimento que vai ser vinculada | Sim |
| `forcar_troca_porta` | Parametro para definir se deve realizar a troca de portas caso o serviço do cliente ja esteja vinculado a uma porta de atendimento. Deve ser definido um valor `true` para que seja feita a acao | Nao |
| `forcar_remocao_reserva` | Parametro para definir se deve realizar a remocao da reserva aplicada na porta de atendimento. Deve ser definido um valor `true` para que seja feita a acao | Nao |

**Corpo da requisição (JSON):**

```json
{
  "id_porta_atendimento": 2589528,
  "forcar_troca_porta": true,
  "forcar_remocao_reserva": true
}
```

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Porta vinculada ao serviço (10) 2B PREMIUM do cliente (2366) GUSTAVO HENRIQUE, de endereço RUA DA CARIOCA 4, MANGABEIRAS, DIVINÓPOLIS/MG | CEP: 35500365",
    "cliente": {
        "id_cliente": 25829,
        "nome_razaosocial": "GUSTAVO HENRIQUE",
        "nome_fantasia": null,
        "telefone_primario": "",
        "telefone_secundario": "",
        "telefone_terciario": "",
        "cpf_cnpj": "830******59",
        "rg": null,
        "rg_emissor": null,
        "inscricao_municipal": null,
        "inscricao_estadual": null,
        "tipo_pessoa": "pf",
        "codigo_cliente": 2366
    },
    "cliente_servico": {
        "id_cliente": 25829,
        "id_servico": 1421,
        "id_servico_status": 7,
        "valor": 119.9,
        "numero_plano": 10,
        "data_cadastro": "2024-09-02 17:47:51",
        "data_habilitacao": null,
        "data_venda": "2024-09-02 20:47:27",
        "data_cancelamento": null,
        "servico": {
            "id_servico": 1421,
            "descricao": "2b Premium",
            "valor": 119.9,
            "valor_com_pacote": 119.9
        }
    },
    "porta_atendimento": {
        "id_porta_atendimento": 2091142,
        "id_equipamento": 336632,
        "tipo_equipamento": 100,
        "sequencia": 2,
        "id_caixa_optica": 336632,
        "reservado": false,
        "observacao": null,
        "display": "Porta #03 | Caixa-49b55bd",
        "pr
```

---
### PUT — Remover
*Mapeamento / Porta Atendimento*

```
PUT {{url}}/api/v1/integracao/mapeamento/projeto/cliente_servico/porta_atendimento/{id_cliente_servico}
```

**Descrição:**

Para remover os vinculos de porta de atendimento com o serviço do cliente, é necessário que você já possua o `access_token`, conseguido na etapa `(oAuth).`

Em seguida preciso passar os seguintes parmetros:

| Atributo | Descriço | Obrigatório |
| --- | --- | --- |
| `remover` | Parametro que deve ser passado com o valor `true` para remover a o vinculo do serviço do cliente com a porta de atendimento | Sim |

**Corpo da requisição (JSON):**

```json
{
  "remover": true
}
```

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Porta #03 | Caixa-49b55bd (Poste-81c2c9e) desvinculada do serviço (10) 2B PREMIUM",
  "cliente": {
    "id_cliente": 25829,
    "nome_razaosocial": "GUSTAVO HENRIQUE",
    "nome_fantasia": null,
    "telefone_primario": "",
    "telefone_secundario": "",
    "telefone_terciario": "",
    "cpf_cnpj": "830******59",
    "rg": null,
    "rg_emissor": null,
    "inscricao_municipal": null,
    "inscricao_estadual": null,
    "tipo_pessoa": "pf",
    "codigo_cliente": 2366
  },
  "cliente_servico": {
    "id_cliente": 25829,
    "id_servico": 1421,
    "id_servico_status": 7,
    "valor": 119.9,
    "numero_plano": 10,
    "data_cadastro": "2024-09-02 17:47:51",
    "data_habilitacao": null,
    "data_venda": "2024-09-02 20:47:27",
    "data_cancelamento": null,
    "servico": {
      "id_servico": 1421,
      "descricao": "2b Premium",
      "valor": 119.9,
      "valor_com_pacote": 119.9
    }
  },
  "porta_atendimento": null
}
```

---
### PATCH — Reserva
*Mapeamento / Porta Atendimento*

```
PATCH {{url}}/api/v1/integracao/mapeamento/projeto/porta_atendimento/reservar/{id_porta_atendimento}
```

**Query Params (exemplo da coleção):**

| Parâmetro | Valor de exemplo |
| --- | --- |
| `reservado` | `true` |
| `observacao` | `teste` |

**Descrição:**

**POST**

Para fazer requisições de Viabilidade, é necessário que você já possua o `access_token`, conseguido na etapa `(oAuth).`

Em seguida preciso passar os seguintes parmetros:

| Atributo | Descriço | Obrigatório |
| --- | --- | --- |
| `id_porta_atendimento` | Identificador da porta de atendimento a ser reservada ou ter ela removida | Sim |
| `reservado` | Parametro deve ser passado como `true` caso deseje reservar a porta e `false` caso deseje remover a reserva da porta de atendimento | Sim |
| `observacao` | Observacao deve ser colocada ao reservar uma porta de atendimento | Sim (ao reservar a porta de atendimento) |

**Exemplo de resposta — Sucesso - Reserva**

```json
{
    "status": "success",
    "msg": "Porta #08 | Caixa-49b55bd reservada com sucesso",
    "porta_atendimento": {
        "id_porta_atendimento": 2091147,
        "id_equipamento": 336632,
        "tipo_equipamento": 100,
        "sequencia": 7,
        "id_caixa_optica": 336632,
        "id_distribuidor_optico": null,
        "id_interface_conexao": null,
        "id_porta_atendimento_conexao": null,
        "reservado": true,
        "observacao": "teste",
        "id_externo": null,
        "id_entrada_splitter_conexao": null,
        "id_saida_splitter_conexao": null,
        "data_tentativa_transmissao": null,
        "nome": null,
        "tag": null,
        "id_elemento_rede": null,
        "display": "Porta #08 | Caixa-49b55bd",
        "display_full": "Porta #08 | Caixa-49b55bd (Poste-81c2c9e)",
        "display_poste": "Porta #08 | Poste-81c2c9e",
        "display_visualizacao": "Porta #08",
        "saida_elemento_rede": null,
        "saida_splitter": null,
        "equipamento": {
            "id_caixa_optica": 336632,
            "id_tipo_caixa_optica": 17,
            "id_ponto_juncao": 401091,
            "nome": "Caixa-49b55bd",
            "area_cobertura": [
                {
                    "latitude": -19.949841,
                    "longitude": -45.084921
                },
                {
                    "latitude": -19.950015,
                    "longitude": -45.084235
                },
```
**Exemplo de resposta — Sucesso - Desreserva**

```json
{
    "status": "success",
    "msg": "Reserva da Porta #08 | Caixa-49b55bd removida com sucesso",
    "porta_atendimento": {
        "id_porta_atendimento": 2091147,
        "id_equipamento": 336632,
        "tipo_equipamento": 100,
        "sequencia": 7,
        "id_caixa_optica": 336632,
        "id_distribuidor_optico": null,
        "id_interface_conexao": null,
        "id_porta_atendimento_conexao": null,
        "reservado": false,
        "observacao": null,
        "id_externo": null,
        "id_entrada_splitter_conexao": null,
        "id_saida_splitter_conexao": null,
        "data_tentativa_transmissao": null,
        "nome": null,
        "tag": null,
        "id_elemento_rede": null,
        "display": "Porta #08 | Caixa-49b55bd",
        "display_full": "Porta #08 | Caixa-49b55bd (Poste-81c2c9e)",
        "display_poste": "Porta #08 | Poste-81c2c9e",
        "display_visualizacao": "Porta #08",
        "saida_elemento_rede": null,
        "saida_splitter": null,
        "equipamento": {
            "id_caixa_optica": 336632,
            "id_tipo_caixa_optica": 17,
            "id_ponto_juncao": 401091,
            "nome": "Caixa-49b55bd",
            "area_cobertura": [
                {
                    "latitude": -19.949841,
                    "longitude": -45.084921
                },
                {
                    "latitude": -19.950015,
                    "longitude": -45.084235
                },
```

---
### PUT — Atualizar
*Mapeamento / Porta Atendimento*

```
PUT {{url}}/api/v1/integracao/mapeamento/projeto/porta_atendimento
```

**Descrição:**

Para fazer a atualizaço em uma porta de atendimento, importante verificar as informaçoes necessarias e como devem ser usadas:

| Atributo | Descriço | Obrigatório |
| --- | --- | --- |
| `id_porta_atendimento` | Identificador da porta de atendimento que vai ser vinculada | Sim |
| `referencia` | String que serve para atribuir alguma informaçao especifica para a porta de atendimento. | Nao |

**Corpo da requisição (JSON):**

```json
{
  "id_porta_atendimento": "2589721",
  "referencia": "teste"
}
```

**Exemplo de resposta — Sucesso**

```json
{
    "status": "success",
    "msg": "Porta #01 | SPlitter 1x4 atualizada com sucesso",
    "porta_atendimento": {
        "id_porta_atendimento": 2094888,
        "id_equipamento": 336677,
        "tipo_equipamento": 100,
        "sequencia": 0,
        "id_caixa_optica": 336677,
        "id_distribuidor_optico": null,
        "id_interface_conexao": null,
        "id_porta_atendimento_conexao": null,
        "reservado": false,
        "observacao": null,
        "id_externo": null,
        "id_entrada_splitter_conexao": null,
        "id_saida_splitter_conexao": null,
        "data_tentativa_transmissao": null,
        "nome": null,
        "tag": null,
        "id_elemento_rede": null,
        "referencia": "testebianca",
        "display": "Porta #01 | SPlitter 1x4",
        "display_full": "Porta #01 | Caixa-4b1f7dd (Poste-c4430e6)",
        "display_poste": "Porta #01 | Poste-c4430e6",
        "display_visualizacao": "Porta #01",
        "saida_elemento_rede": null,
        "saida_splitter": {
            "id_saida_splitter": 2087417,
            "id_splitter": 173437,
            "id_cor_esquema_coloracao": 51,
            "id_fibra_optica": null,
            "id_porta_atendimento": 2094888,
            "sequencia": 0,
            "display": "Saída #1",
            "splitter": {
                "id_splitter": 173437,
                "id_tipo_splitter": 11,
                "id_fibra_optica_entrada": null,
                "id_caixa_optica": 336677,
                "id_
```

---
## Projetos

### GET — Listar
*Mapeamento / Projetos*

```
GET {{url}}/api/v1/integracao/mapeamento/projeto/listar
```

**Descrição:**

**GET**

No método `GET`, irá consultar/listar os dados dosp rojetos e retornar um `JSON` como resposta.

Nao e necessario passar nenhum paramentro.

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Dados consultados com sucesso",
  "projetos": [
    {
      "id_projeto": 247,
      "nome": "00_Projeto teste"
    },
    {
      "id_projeto": 45,
      "nome": "Area 2"
    },
    {
      "id_projeto": 48,
      "nome": "Cidade Nova"
    },
    {
      "id_projeto": 339,
      "nome": "Documentação - CTOs"
    },
    {
      "id_projeto": 131,
      "nome": "FTTH - THIAGO"
    },
    {
      "id_projeto": 204,
      "nome": "FTTH Padrão"
    },
    {
      "id_projeto": 490,
      "nome": "Geosite Teste"
    },
    {
      "id_projeto": 70,
      "nome": "HUBSOFT BRASIL LTDA"
    },
    {
      "id_projeto": 485,
      "nome": "HubSoft"
    }
  ]
}
```

---