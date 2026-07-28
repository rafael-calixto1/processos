# PBX

**Necessário**

Para fazer requisições nas rotas de notificação de ligação do PBX, é necessário que você já possua o `access_token`, conseguido na etapa `(oAuth)`

## POST — Notificar
*PBX*

```
POST {{url}}/api/v1/integracao/pbx/ligacao/notificar
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

Através deste `endpoint`, de ambas as rotas poderão ser realizadas as notificações e cancelamento de ligações.

**Aviso**

**`IMPORTANTE:`** Ao realizar a requisição na rota de `«notificação»`, o sistema irá automaticamente abrir uma janela pro usuário de destino, com os dados da chamada: ramal, identificador interno, telefone de origem da ligação. Caso algum cliente tenha sido identificado, será possível abrir o atendimento e já fornecer o protocolo ao cliente, caso contrário terá a opção de consultar um cliente na base. Ao realizar a requisição na rota de `«cancelamento»` da ligação, a janela de ligação será fechada automaticamente caso ela ainda esteja aberta.

**Atributos da Requisição de ambas as rotas**

| Atributo | Descrição | Obrigatório |
| --- | --- | --- |
| ramal | Número de ramal correspondente ao usuário | **(Obrigatório caso o identificador_interno não seja informado)** |
| identificador_interno | ID Interno correspondente ao usuário | **(Obrigatório caso o ramal não seja informado)** |
| codigo_cliente | Código único do cliente | Não |
| id_cliente | Identificador (chave primária) do cliente | Não |
| telefone | Telefone da ligação externa do PBX | Não |
| ligacao_params | Objeto JSON para serem informados parametros da ligação | Não |

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| ramal | Deve ser um valor numérico | Nenhum |
| identificador_interno | Deve ser um valor alfanumérico | Nenhum |
| codigo_cliente | Deve ser um valor númerico e existir na base de dados | Nenhum |
| id_cliente | Deve ser um valor númerico e existir na base de dados | Nenhum |
| telefone | Deve ser um valor númerico | Nenhum |
| ligacao_params | Deve ser um objeto no formato JSON | Nenhum |

**Corpo da requisição (JSON):**

```json
{
  "ramal": 111,
  "telefone": "37999912222",
  "ligacao_params": {
    "origem": "PBX",
    "atendente": "João"
  }
}
```

**Exemplo de resposta — Notificação**

```json
{
  "status": "success",
  "msg": "Ligação notificada com sucesso"
}
```

---
## POST — Cancelar
*PBX*

```
POST {{url}}/api/v1/integracao/pbx/ligacao/cancelar
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**POST**

Através deste `endpoint`, será realizado o cancelamento de um notificação realizada anteriormente.

**Aviso**

**`IMPORTANTE:`** Ao realizar a requisição na rota de `«notificação»`, o sistema irá automaticamente abrir uma janela pro usuário de destino, com os dados da chamada: ramal, identificador interno, telefone de origem da ligação. Caso algum cliente tenha sido identificado, será possível abrir o atendimento e já fornecer o protocolo ao cliente, caso contrário terá a opção de consultar um cliente na base. Ao realizar a requisição na rota de `«cancelamento»` da ligação, a janela de ligação será fechada automaticamente caso ela ainda esteja aberta.

**Atributos da Requisição de ambas as rotas**

Os atributos podem conter os seguintes valores:

| Atributo | Descrição | Valor Default |
| --- | --- | --- |
| ramal | Deve ser um valor numérico | Nenhum |
| identificador_interno | Deve ser um valor alfanumérico | Nenhum |
| telefone | Deve ser um valor númerico | Nenhum |

**Corpo da requisição (JSON):**

```json
{
  "ramal": 111,
  "telefone": "37999912222"
}
```

**Exemplo de resposta — Cancelamento**

```json
{
  "status": "success",
  "msg": "Ligação cancelada com sucesso"
}
```

---