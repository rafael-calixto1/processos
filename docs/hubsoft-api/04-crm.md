# CRM

**Necessário**

Para fazer requisições nos dados de `CRM`, é necessário que você já possua o `access_token`, conseguido na etapa `(oAuth)`.

OBS: Essa rota irá retornar todos os dados de `CRM.`

## GET — Consulta
*CRM*

```
GET {{url}}/api/v1/integracao/crm/all
```

**Headers:**

| Header | Valor |
| --- | --- |
| `Authorization` | `{{access_token}}` |

**Descrição:**

**GET**

No método `GET`, irá consultar os dados dos CRM e retornar um `JSON` como resposta.

**Exemplo de resposta — Sucesso**

```json
{
  "status": "success",
  "msg": "Dados consultados com sucesso",
  "crms": [
    {
      "id_crm": 1,
      "nome": "CRM - VENDAS"
    },
    {
      "id_crm": 201,
      "nome": "TESTE INTEGRACAO API"
    }
  ]
}
```

---