# Roteiro de teste no celular (modo avião) — Fase 3

Para quem vai testar com um **aparelho de verdade e o Expo Go**. O que foi provado por teste automático está no README; este roteiro cobre o que **só o aparelho prova**: câmera, GPS, leitura de QR, modo avião de verdade e o envio de foto pelo sistema de arquivos do celular.

> **Não use dados reais para testar.** Lançar material **baixa estoque de verdade**. Use o **banco de teste** (abaixo) ou, em produção, uma OS e um lote criados só para o teste, e estorne depois.

## 0. Preparação (no computador)

**Backend de teste, visível na rede do escritório** (o celular precisa enxergá-lo):

```bash
cd processo-audit-app/processo-audit-app
DB_NAME=processo_audit_test node scripts/teste_mobile.js preparar        # recria o banco de TESTE com usuários e itens
DB_NAME=processo_audit_test PORT=5998 FOTOS_DIR=/tmp/fotos-teste node server.js
```

Usuários do banco de teste (senha `senha123`): técnico `joao@exemplo.com`, técnica `ana@exemplo.com`, estoque `estoque@exemplo.com`, admin `admin@exemplo.com`.
Pelo sistema web (entre como `estoque@exemplo.com`/`admin@exemplo.com` apontando o web para esse backend, ou use `curl`), crie:

1. Uma **compra de bobina** do item *Cabo óptico ASU 12F* (1000 m) e **retire 400 m para o João**.
2. Uma **compra de conectores** (tipo *unidade*, lotes de 30 e 20) e **retire os dois lotes para o João**.
3. Uma **OS** para o João com latitude/longitude (para o botão "coordenadas do poste").
4. **Imprima ou abra na tela** a etiqueta QR do lote da bobina (o QR contém só o código, ex.: `LOTE-BOB-0001`).

**App:** em `mobile/.env` coloque `EXPO_PUBLIC_API_URL=http://<IP-do-computador>:5998/api`, rode `npx expo start --clear` e abra no Expo Go.

Marque `[x]` no que passar. Anote o que falhar com a mensagem exata da tela.

## A. Entrar e baixar (com internet)
- [ ] Entra como `joao@exemplo.com`. A lista mostra a OS e **"Sincronizada"** no cartão.
- [ ] **Meu estoque** mostra o cabo (400 m) e os conectores (50 un, "2 lotes").

## B. Sem sinal: iniciar e preencher
Ligue o **modo avião** (Wi-Fi e dados desligados).
- [ ] Abra a OS e toque **Iniciar execução**: vira "Em andamento" na hora, **sem erro de conexão**, e o cartão mostra **"Aguardando envio"**.
- [ ] **Continuar execução** → *Finalização*. O botão **Finalizar** está travado e diz por quê.
- [ ] **Descrição**: com menos de 11 caracteres o contador diz quantos faltam; ao completar fica verde.
- [ ] **Motivo**: escolha um. **Checklist**: responda tudo (Sim/Não grandes; número com teclado decimal).
- [ ] **Local**: toque **Capturar posição por GPS** → pede permissão de localização; mostra coordenadas e **"precisão de N m"**. Teste também **negar** a permissão: a mensagem aparece em português e oferece o poste.
- [ ] **Usar coordenadas do poste** funciona sem sinal. A busca de endereço diz que **precisa de internet**.
- [ ] Saia de uma etapa e volte: **o que você digitou continua**. Feche o Expo Go por completo e reabra: o rascunho continua.

## C. Sem sinal: material
- [ ] **Materiais Utilizados → Sim → Adicionar lançamento**. Preencha serviço e trecho.
- [ ] **Ler QR do lote**: pede permissão da câmera, lê a etiqueta e seleciona o cabo ("Lote … encontrado").
- [ ] Digite **mais do que a posse** (ex.: 999 m): aparece **"Você tem 400 m em posse"** e o botão Salvar trava.
- [ ] Em conectores, digite **2,5**: "Este item é contado em unidades: informe um número inteiro".
- [ ] **Marcar o trecho no mapa** (precisa de internet): toque no ponto de **início**, nos pontos do meio e no **fim** (aparecem I, 2, 3… F); o trajeto é traçado pelas ruas e mostra a distância. Arraste um ponto, use **Desfazer último** e **Limpar**. Toque num lugar sem rua: deve recusar com "Marque os pontos sobre uma rua, estrada ou rodovia." Ao **Usar este trecho**, o campo *Trecho* é sugerido (se estava vazio). Sem internet o botão fica indisponível e o texto continua valendo.
- [ ] Salve **120,5 m**. Em **Meu estoque** o cabo mostra **279,5 m** com **"Reservado em lançamentos não enviados: 120,5 m"**.
- [ ] Faça um 2º lançamento de **300 m** → recusado ("Você tem 279,5 m em posse"): **não dá para usar o mesmo material duas vezes sem sinal**.
- [ ] **Corrigir quantidades** e **Remover** funcionam num lançamento "Aguardando envio" (a reserva acompanha).
- [ ] **Retirados**: "Sim" → adicione do catálogo e um item descrito; exija quantidade e Novo/Usado. Peça com vírgula é recusada.
- [ ] **Participantes** (opcional): marque alguém.

## D. Sem sinal: fotos
- [ ] **Tirar foto** abre a câmera **dentro do app**; tire 2–3 (a câmera continua aberta) → **Concluir**. A lista mostra **"Aguardando envio"**.
- [ ] **Escolher da galeria**: marque várias de uma vez. (iPhone: inclua uma foto **HEIC**.)
- [ ] Remova uma (pede confirmação). O contador "N de 30 fotos" acompanha.

## E. Finalizar sem sinal
- [ ] Com 7 de 7 etapas, **Finalizar** habilita. Confirme ("depois de finalizada a OS fica somente leitura").
- [ ] A tela diz **"Finalização salva no aparelho — ainda não chegou ao servidor"** (e **não** "OS finalizada").
- [ ] Em **Minhas OS** há o aviso "N envios aguardando conexão. Está tudo salvo no aparelho." e o cartão está "Aguardando envio".
- [ ] **Feche o aplicativo à força** e reabra (ainda em modo avião): tudo continua lá, nada pedindo atenção.

## F. Religar e conferir (a prova principal)
Desligue o modo avião, abra o app e toque **Sincronizar agora**.
- [ ] Os envios caem para 0 e a OS vai para **Encerradas** como **Concluída**.
- [ ] **No sistema web**, no detalhe da OS: o lançamento aparece com o **trecho desenhado no mapa**; no card de fechamento: descrição, motivo, local (com origem GPS e o nome da rua), checklist com rótulos, retirados, participantes e **as fotos abrem**.
- [ ] **Estoque → histórico do lote**: **uma única baixa por lançamento** (120,5 m — não duas).
- [ ] Meu estoque do app: cabo **279,5 m**, sem "reservado".
- [ ] **A foto chegou com conteúdo** (abre e é a que você tirou). *Este é o primeiro ponto a observar: o envio de foto em multipart pelo `File` do expo-file-system só foi provado em teste automático com um substituto.*

## G. App encerrado no meio do envio
Repita B–E com uma OS nova, desta vez com **3 fotos**. Religue a rede, toque **Sincronizar agora** e, **em 1–2 segundos, feche o app à força**.
- [ ] Reabra: o envio **retoma sozinho**. No web: nenhuma baixa e nenhuma foto **duplicadas**.

## H. Conflitos (devem virar "Requer atenção", nunca sumir)
1. **Posse mudou:** baixe os dados online; ligue o modo avião; no sistema web **devolva/ajuste** parte do lote do João; no app lance um valor que só cabia antes. Religue: o lançamento aparece em **Requer atenção** com a mensagem do servidor ("Quantidade maior que a posse do técnico neste lote (N)"). **Corrigir quantidades** → envia. Nada baixado enquanto estava recusado.
2. **OS cancelada** pelo escritório enquanto o técnico trabalha sem sinal → ao religar: "OS encerrada: não aceita novos lançamentos", item em atenção, **nada baixado**.
3. **OS passada para a Ana**: "Esta OS não está atribuída a você"; o item continua visível com o número da OS mesmo ela sumindo da lista.
- [ ] Em todos: a aba **Minhas OS** mostra o selo vermelho com o número de itens; **Descartar** pede confirmação.

## I. Sessão e troca de técnico
- [ ] Deixe o app aberto **mais de 15 min** (o login de 15 min vence) e então use/ligue a rede: **segue funcionando**, sem pedir senha.
- [ ] Com pendências, **Conta → Sair**: oferece **"Sair e manter"** (padrão), "Sair e descartar tudo" (pede **segunda confirmação**) e Cancelar.
- [ ] Saia mantendo e **entre como `ana@exemplo.com`**: aparece **"Há trabalho não enviado neste aparelho"** e **nada** do João é mostrado nem apagado. "Sair desta conta" volta ao login; entrando como João, a fila continua e é enviada.

## J. O que ainda NÃO foi testado em aparelho (confirme você)
Câmera, GPS, QR, modo avião e fechamento forçado reais · upload de foto via `File` do expo-file-system · galeria com o Android encerrando o app (`getPendingResultAsync`) · HEIC no iPhone · permissões negadas em cada tela · desempenho em aparelho lento · teclado e toque com luvas.
