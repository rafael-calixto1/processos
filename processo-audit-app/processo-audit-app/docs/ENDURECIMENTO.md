# Endurecimento do backend (Fase 4b)

O que mudou, como configurar em produção e como desfazer. **Nada daqui exige migração de banco.** Tudo vale depois de um `pm2 restart processo-audit-backend` (o código só muda no processo que reiniciar).

## 1. Variáveis de ambiente (arquivo `.env` do servidor)

| Variável | Padrão | O que faz |
|---|---|---|
| `ALLOW_PUBLIC_REGISTER` | desligado | Só o valor `1` reabre o "Registre-se" público (cria usuário só-leitura, no máximo 5 cadastros por IP por hora). Desligado, `POST /api/auth/register` responde 403 e a tela de login do web manda pedir acesso a um administrador. Quem cria usuários é o admin (tela *Usuários*, `POST /api/auth/users`). |
| `TRUST_PROXY` | `loopback` | De quem o servidor aceita o `X-Forwarded-For` para saber o IP do cliente (usado no limite de tentativas de login). Padrão: só de proxy **na mesma máquina** (nginx, Caddy, cloudflared, proxy do Vite). `1`/`2` = nº de proxies à frente; `false` = nunca; `true` = qualquer origem (**não use**: deixa trocar de IP só mudando o cabeçalho; era o comportamento antigo). |
| `CORS_ALLOWED_ORIGINS` | vazio (aceita qualquer origem) | Lista separada por vírgula das origens de **navegador** permitidas, ex.: `https://os.conexaoweb.com.br,https://app.conexaoweb.com.br`. O app do celular não usa CORS e não é afetado. Sem a lista o servidor avisa no log ao iniciar. **Defina antes de abrir o servidor na internet.** |

## 2. Upload de arquivos: multer 2.x
As rotas antigas de upload (passos de processo, execução, arquivos, identidade visual, fluxo visual) saíram do multer 1.x (depreciado por vulnerabilidades) para o 2.x, o mesmo das fotos de OS. Há testes de caracterização (`tests/uploads.test.js`) que passam iguais nas duas versões. Junto foi corrigido um defeito antigo: **nomes de arquivo com acento eram gravados corrompidos** (`relatÃ³rio.pdf`); agora saem certos. Nomes já gravados continuam como estão.
Depois do próximo `npm install` no servidor o pacote `multer` 1.x sai de `node_modules` (a dependência foi removida; o código usa o alias `multer-v2`).

## 3. Catálogos da finalização (motivos e checklist)
Rotas só para **admin**, em `/api/os-catalogos` (tela no web: *Catálogos da finalização*):

| Rota | Uso |
|---|---|
| `GET /motivos`, `GET /checklist` | Lista tudo, inclusive desativados (com `usos` = fechamentos que usam o motivo). |
| `POST /motivos` `{rotulo}` · `POST /checklist` `{rotulo, tipo: boolean\|number\|text, unidade?, obrigatorio?}` | Cria. O `codigo` sai do nome (sem acento, `snake_case`) ou pode ser informado; repetido = 409. |
| `PUT /motivos/:id` `{rotulo?, ordem?, ativo?}` · `PUT /checklist/:id` `{rotulo?, unidade?, obrigatorio?, ordem?, ativo?}` | Edita. **Código e tipo de resposta não mudam depois de criados.** |

Regras: nada é apagado (os fechamentos já feitos guardam uma cópia do rótulo e referenciam o motivo): o que não serve mais é **desativado** e some do app na próxima sincronização. **Sempre fica ao menos um motivo ativo** (sem motivo o técnico não finaliza). Uma finalização que já estava na fila com um motivo depois desativado volta como "Requer atenção" (400).

## 4. Backup das fotos de OS
`scripts/backup_os_fotos.sh [destino] [cópias]` compacta `storage/os_fotos` (ou `FOTOS_DIR`) em `os_fotos_AAAA-MM-DD_HHMMSS.tar.gz`, confere que o arquivo abre, e guarda só as N mais recentes (padrão 14, em `/root/backups/os_fotos`). Não altera a origem. Sugestão de agendamento (**instalar só com autorização**): `0 3 * * * /caminho/processo-audit-app/scripts/backup_os_fotos.sh >> /var/log/backup_os_fotos.log 2>&1`.
Restaurar: `tar -xzf os_fotos_....tar.gz -C storage/os_fotos`.
**Falta decidir:** copiar `/root/backups` (banco e fotos) para **fora desta máquina**; hoje um disco com defeito leva tudo junto.

## 5. Como desfazer
Código: voltar ao commit anterior ao deploy (`git revert` dos commits da 4b ou `git checkout <commit>` + `pm2 restart processo-audit-backend`). Configuração: apagar as variáveis acima do `.env` volta ao padrão seguro (cadastro desligado, `loopback`, CORS aberto com aviso). Para reabrir o cadastro público basta `ALLOW_PUBLIC_REGISTER=1`.

## 6. Conferir depois do deploy
```bash
pm2 logs processo-audit-backend --lines 50     # sem erros; aviso de CORS se a lista estiver vazia
curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:5002/api/auth/register -H 'Content-Type: application/json' -d '{"email":"x@x.com","password":"123456","name":"x"}'   # 403
```
No web: tela de login sem o link de cadastro; enviar um arquivo com acento no gerenciador de arquivos e ver o nome certo; entrar como admin em *Catálogos da finalização*.

## 7. Riscos que **não** foram mexidos (decidir depois)
- `/uploads/*` é servido **sem login** (`express.static`): quem souber a URL baixa o arquivo. As fotos de OS **não** estão aí (têm pasta privada e rota autenticada).
- A identidade visual aceita **SVG**; um SVG com script aberto direto da URL do servidor roda no domínio do servidor. Convém restringir a PNG/JPG/ICO ou servir com `Content-Security-Policy`/`Content-Disposition`.
- `express.json({ limit: '50mb' })` vale para todas as rotas.
- O limite de login por IP é em memória (um único processo): reiniciar zera.
- O roteamento por vias usa o servidor demonstrativo público do OSRM (sem garantia de disponibilidade).
