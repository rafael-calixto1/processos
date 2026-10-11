# Publicação do app dos técnicos (EAS Build, teste interno e atualização pelo ar)

Este guia é do que **você** precisa fazer (contas, senhas e chaves ficam com você; nada disso passa pelo Claude) e do que já está pronto no projeto. A checagem automática é `npm run verificar:publicacao` (veja abaixo).

## O que já está no projeto
- `eas.json` com 3 perfis: **development** (cliente de desenvolvimento), **preview** (APK interno para testar no celular, canal `preview`) e **production** (pacote `.aab` da loja, versão incrementada sozinha, canal `production`).
- Permissões enxutas: câmera, localização, internet (o resto que vinha do modelo do Expo é bloqueado; microfone nunca). Backup do Android desligado de propósito: restaurar a fila de envio em outro celular repetiria operações.
- `expo-updates` instalado e `runtimeVersion` pela versão do app: **um build novo só é necessário quando muda código nativo ou a versão do app** (`version` em `app.json`); o resto vai pelo ar.
- Ícone e splash da marca.

## O que falta e só você faz
| # | Passo | Por quê |
|---|---|---|
| 1 | **URL https pública do servidor** (decisão A: túnel ou proxy com certificado) e colocá-la em `eas.json` (`preview` e `production` → `EXPO_PUBLIC_API_URL`) | Build de produção do Android **bloqueia `http://`**. Hoje há um modelo `https://api.SEU-DOMINIO.com.br/api` que o verificador recusa. |
| 2 | Conta em **expo.dev**; no terminal: `cd mobile && npx eas-cli@latest login` e depois `npx eas-cli@latest init` | Vincula o projeto (grava `extra.eas.projectId`). |
| 3 | `npx eas-cli@latest update:configure` | Grava `updates.url` (atualização pelo ar). Sem isso o app é gerado com a atualização desligada. |
| 4 | **Confirmar o identificador** `br.net.cwtelecom.campo` (Android e iOS; nome do app: **CW Campo**) | Segue o padrão da empresa (`br.net.cwtelecom...`). Pode mudar à vontade **até o primeiro envio à Play Store/App Store ou o primeiro build entregue a um técnico**: depois disso é outro app (instala ao lado e não leva os dados, nem o que ainda não foi enviado). Para confirmar: `IDENTIFICADOR_CONFIRMADO=1 npm run verificar:publicacao`. |
| 5 | Para a Play Store (teste interno): conta de desenvolvedor do Google (taxa única de US$ 25), app criado no Play Console com esse identificador, **política de privacidade** (URL pública; o app usa câmera, localização e fotos) e o formulário de segurança de dados | A Play exige. |
| 6 | iOS (só se quiser): conta Apple Developer (US$ 99/ano) | Sem ela, só Android. |
| 7 | Push de nova OS (4c): projeto no **Firebase** e a credencial FCM enviada ao EAS por você | O push do Android depende dele. |

## Gerar o APK para testar no celular (perfil preview) — sem HTTPS
O perfil **preview** foi feito para teste interno **sem precisar de URL https**: ele libera `http://` só nele (`app.config.js`) e já aponta para o servidor de teste da rede da empresa (`http://10.100.100.130:5998/api`). Isso funciona com o celular **na mesma rede** (Wi-Fi da empresa). Na tela de login ainda dá para trocar o endereço do servidor sem gerar outro build. O perfil **production** nunca libera `http`.

Pré-requisitos: o servidor de teste no ar (porta 5998) e um **token do Expo** só para o terminal (crie em *Access tokens*, perfil de robô; cole escondido com `read -rs EXPO_TOKEN && export EXPO_TOKEN` e apague o token depois).
```bash
cd mobile
npm run verificar:publicacao -- --preview      # confere URL, commit e ícones
npx eas-cli@latest build --platform android --profile preview
```
A primeira vez o EAS pergunta se deve **gerar a chave de assinatura** do Android: responda sim (ela fica guardada no EAS; depois baixe uma cópia com `npx eas-cli@latest credentials`). No fim o EAS mostra um link/QR para baixar e instalar o APK (permita "instalar apps desconhecidos"). Teste com o roteiro `docs/ROTEIRO_TESTE_MANUAL.md`: agora **a splash, o ícone, o nome "CW Campo" e a permissão de câmera** passam a valer de verdade. Cada build consome 1 dos builds do plano gratuito.

## Atualizar pelo ar (sem novo APK)
```bash
npx eas-cli@latest update --channel preview --message "o que mudou" --environment preview
```
Só chega a aparelhos com build da **mesma versão do app** (`runtimeVersion`). Mudou código nativo, dependência com parte nativa ou `version`? Gere um build novo. **Voltar atrás:** publique de novo a versão boa no mesmo canal (`eas update`) ou use `eas update:rollback`.

## Teste interno na Play Store (produção)
```bash
npm run verificar:publicacao                    # exige tudo
npx eas-cli@latest build --platform android --profile production      # gera o .aab
```
Na **primeira vez** envie o `.aab` você mesmo pelo Play Console (faixa *Teste interno*, lista de testadores por e-mail). Depois dá para usar `npx eas-cli@latest submit --platform android --profile production` (pede uma chave de serviço do Google, que **você** cadastra no EAS; nunca a envie por aqui). **Voltar atrás:** no Play Console, pause a distribuição ou promova a versão anterior.

## Monitoramento depois de publicar
- Servidor: `pm2 logs processo-audit-backend --lines 100` (erros, pedidos recusados). O app mostra "Requer atenção" para o que o servidor recusa, com a mensagem dele.
- Ver o que o técnico não conseguiu enviar: tela *Conta* do app (contadores) e a tela *Requer atenção*.
- Servidor fora do ar: o app continua funcionando offline e envia quando voltar (testado).
