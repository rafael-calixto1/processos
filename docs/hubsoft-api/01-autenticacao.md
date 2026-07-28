# Autenticação

**Necessário**

Para autenticar na API, será necessário possuir os seguintes dados em mãos:

\* client_id  
\* client_secret  
\* username  
\* password

Após a autenticação você receberá um `access_token` que deverá ser utilizado nos demais endpoints.

Esse token deverá ser enviado no `Header Authorization` no seguinte formato:

`Bearer`

**IMPORTANTE:** O token irá expirar conforme o tempo retornado no parametro `expires_in`.

**Observação:** O valor 2592000 é equivalente a 30 dias. Sugerimos que armazenem o token e reutilizem o mesmo, conforme for necessário. Será necessário gerar um novo token sempre que o mesmo expirar. Porém, caso não queira esperar o token expirar, você poderá programar sua aplicação para gerar um novo token, recomendamos a geração de um novo token a cada 24 horas ou sempre que receber um `HTTP 401` no status de alguma requisição.

**Observação 2:** Caso a API retorne em qualquer momento o código de status `HTTP 401`, significa que é necessário gerar um novo token, pois o mesmo pode ter sido cancelado / expirado manualmente através de algum usuário administrador do sistema (por exemplo, durante atualizações o sistema poderá invalidar todos os TOKENS, fazendo com que uma nova autenticação seja necessária)

## POST — oAuth
*Autenticação*

```
POST {{url}}/oauth/token
```

**Descrição:**

A autenticação se faz necessária para obter o `access_token` que será utilizado em todos os demais endpoints do sistema.

**Corpo da requisição (JSON):**

```json
{
  "client_id": "{{client_id}}",
  "client_secret": "{{client_secret}}",
  "username": "{{username}}",
  "password": "{{password}}",
  "grant_type": "{{grant_type}}"
}
```

**Exemplo de resposta — Sucesso**

```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6Ijg0MTM2O",
  "expires_in": 2592000,
  "refresh_token": "def502007d459fb49e6b09071f127a0163714607233687eac066",
  "token_type": "Bearer"
}
```
**Exemplo de resposta — Erro** (`HTTP 401 Unauthorized`)

```json
{
  "error": "invalid_credentials",
  "error_description": "The user credentials were incorrect.",
  "message": "The user credentials were incorrect."
}
```

---