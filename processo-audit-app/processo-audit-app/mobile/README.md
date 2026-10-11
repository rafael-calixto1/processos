# OS Técnicos (app mobile)

App dos técnicos de campo para ver e executar as Ordens de Serviço e acompanhar o material em posse. É um cliente do mesmo backend do sistema (pasta acima): a API está documentada em [`../docs/APP_MOBILE_API.md`](../docs/APP_MOBILE_API.md).

Feito com Expo (SDK 57), React Native, TypeScript e Expo Router. Tudo em português do Brasil.

## Estado atual (Fase 2)

| Já funciona | Ainda não |
|---|---|
| Login só para perfil técnico, sessão que se renova sozinha e fica guardada no cofre do aparelho | Registrar material usado, fotos, GPS e finalizar a OS (Fase 3) |
| **Minhas OS** (pendentes e encerradas, por prazo), detalhe da OS, "Abrir no mapa" | Trabalhar sem sinal **escrevendo** dados: hoje só dá para consultar (Fase 3) |
| **Iniciar execução** (precisa de internet nesta fase) | Leitor de QR/código de barras do lote (Fase 3) |
| **Meu estoque** com busca (itens por unidade somam entre lotes) | Devolução, rota no mapa, push, build instalável (Fase 4) |
| Abrir sem sinal e ver tudo o que foi baixado da última vez, com aviso "Sem conexão. Mostrando os dados de HH:MM" | |

## Rodar no celular (Expo Go)

1. No celular, instale o **Expo Go** (Play Store / App Store).
2. Neste computador: `npm install` (uma vez).
3. Crie o arquivo `.env` (copie de `.env.example`) com o endereço do backend **como o celular o enxerga**, por exemplo `EXPO_PUBLIC_API_URL=http://10.100.100.130:5002/api`. O celular precisa estar na **mesma rede** do servidor. Também dá para deixar em branco e digitar o endereço na tela de login.
4. `npx expo start` e leia o QR code com o Expo Go (Android) ou com a câmera (iPhone).

> Ao **mudar o `.env`**, reinicie com `npx expo start --clear`: o Metro guarda o valor antigo em cache.

Se a rede do escritório bloquear a conexão entre celular e computador, `npx expo start --tunnel` costuma resolver (o Expo instala o que precisar).

### Antes de testar com o backend de produção

- O app usa os **dados reais**. Para testar, crie no sistema web um usuário com perfil **técnico** (Usuários) e vincule-o a um técnico (Estoque → Técnicos). Use uma **OS de teste**: "Iniciar execução" muda o status da OS de verdade.
- Em desenvolvimento (Expo Go) o app aceita `http://`. **Builds de produção no Android bloqueiam `http://`**: para publicar o app o backend precisa responder em `https://` (Fase 4).

## Testes e verificações

```bash
npm test                 # unitários e de tela (Jest), roda sem celular nem servidor
npm run typecheck        # TypeScript
npx expo-doctor          # dependências e configuração do Expo
npx expo export --platform android --output-dir /tmp/bundle   # gera o bundle: prova que todos os imports e rotas resolvem
```

Integração com o **backend real** (use sempre o banco de teste, nunca o de produção): suba o backend com `DB_NAME=processo_audit_test`, e rode

```bash
API_URL=http://localhost:5998/api API_EMAIL=joao@exemplo.com API_SENHA=senha123 npx jest tests/integracao
```

Sem `API_URL` esses testes são ignorados.

### Ver as telas no computador (opcional)

O app de verdade é Android/iOS, mas dá para olhar as telas no navegador (com SQLite e tudo):

```bash
EXPO_PUBLIC_API_URL=http://localhost:5000/api npx expo export --platform web --clear --output-dir dist
node scripts/preview-web.mjs dist 3998     # http://localhost:3998
```

No web os tokens ficam em `localStorage` em vez do cofre do sistema (só para esta pré-visualização).

## Como o código está organizado

```
src/
  app/        telas (Expo Router: cada arquivo é uma rota)
  domain/     regras puras, sem React: agrupar posse, distribuir entre lotes (FIFO), unidades, prazo, etapas da finalização
  api/        cliente HTTP (renova o token e repete a chamada), contrato dos endpoints, erros
  auth/       sessão: tokens no cofre, renovação única por vez, nunca derruba o login por falta de rede
  db/         SQLite local: fila serial, migrações versionadas, espelho dos dados do servidor
  sync/       baixar o retrato do servidor e iniciar a execução
  estado/     provedores do React (serviços, dados, rede)
  components/ botões, cartões, avisos... (alvos de 48 dp, texto grande, contraste alto)
  theme/      cores da marca e medidas
  testing/    apoio aos testes (servidor falso, SQLite em memória, massa de dados)
tests/        testes de tela e de integração com o backend
```

Decisões que valem saber:

- **O banco local é a fonte da tela.** Ao abrir, o app mostra na hora o que está guardado e atualiza em segundo plano (ao entrar, ao voltar para o app e ao recuperar a conexão). Falta de rede nunca esconde nem apaga dados.
- **Outro técnico no mesmo aparelho nunca vê os dados do anterior:** o espelho é apagado ao trocar de usuário e ao sair.
- **O servidor é a fonte da verdade.** O saldo mostrado é o do último download; o servidor confere de novo a cada registro.
- **Renovação de sessão:** o servidor trata reuso de refresh token como roubo, então várias chamadas com token vencido compartilham uma única renovação.
- `expo-sqlite`: todas as operações passam por uma fila serial para uma consulta de outra tarefa não entrar numa transação aberta e ser desfeita junto.

## Pendências conhecidas

- Ícones e splash são os padrões do Expo (trocar na Fase 4). `android.package` e `ios.bundleIdentifier` (`br.com.conexaoweb.ostecnicos`) são provisórios.
- `npm audit` aponta vulnerabilidades (`braces`, `node-forge`, `uuid`, `decode-uri-component`, `sprintf-js`) em dependências transitivas do `@expo/cli`, do Metro e do Jest: são ferramentas de build e de teste, que não vão dentro do app instalado. **Não** rode `npm audit fix --force` (quebra o SDK); acompanhe pelas atualizações do Expo.
