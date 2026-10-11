#!/usr/bin/env node
/**
 * Percorre no navegador (build web + Playwright, celular 390×844) uma OS inteira SEM CONEXÃO — iniciar, descrição, motivo,
 * local (GPS simulado), checklist, lançamento de material (com leitor de QR simulado), retirados, foto (câmera simulada) e
 * finalizar — e depois religa a rede e confere no banco de teste que o fechamento, a foto e a baixa chegaram uma vez só.
 * Câmera, GPS e QR NÃO existem no navegador: aqui são SIMULAÇÕES marcadas na tela. O que isto NÃO prova: câmera, GPS e rede reais.
 *
 *   (backend de teste na 5998 e `node scripts/preview-web.mjs <dist> 3998` no ar)
 *   DB_NAME=processo_audit_test OS_ID=2 RAIZ_BACKEND=.. node scripts/verificar-web.mjs <pasta-de-capturas>
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(import.meta.url)(path.resolve(aqui, '../../frontend/node_modules/playwright'));
const [saida = 'capturas'] = process.argv.slice(2);
const BASE = process.env.APP_URL ?? 'http://localhost:3998';
const OS_ID = Number(process.env.OS_ID ?? 2);
const RAIZ = path.resolve(process.env.RAIZ_BACKEND ?? path.resolve(aqui, '../..'));
fs.mkdirSync(saida, { recursive: true });

const consulta = (cmd, ...a) => JSON.parse(execFileSync(process.execPath, ['scripts/teste_mobile.js', cmd, ...a.map(String)], { cwd: RAIZ, env: { ...process.env, DB_NAME: 'processo_audit_test' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n').filter((l) => l.startsWith('{') || l.startsWith('[')).pop());
let n = 0;
const falhas = [];
const confere = (ok, msg) => { console.log(`${ok ? '  ok ' : ' FALHOU'} ${msg}`); if (!ok) falhas.push(msg); };

const navegador = await chromium.launch();
const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await contexto.newPage();
const errosDaPagina = [];
page.on('pageerror', (e) => errosDaPagina.push(String(e)));
page.on('dialog', (d) => d.accept());
const foto = async (nome) => { n += 1; await page.screenshot({ path: path.join(saida, `${String(n).padStart(2, '0')}-${nome}.png`) }); };
// o React Navigation mantém as telas anteriores montadas (escondidas): só vale o que está visível
const id = (t) => page.locator(`[data-testid="${t}"]:visible`);
const texto = (t, o = {}) => page.getByText(t, o).and(page.locator(':visible'));
const aguardar = (l, ms = 20000) => l.first().waitFor({ state: 'visible', timeout: ms });

try {
  console.log('Entrando…');
  await page.goto(BASE);
  await aguardar(id('campo-email'));
  await id('campo-email').fill(process.env.API_EMAIL ?? 'joao@exemplo.com');
  await id('campo-senha').fill(process.env.API_SENHA ?? 'senha123');
  await foto('login');
  await id('botao-entrar').click();
  await aguardar(texto('Minhas OS'));
  await aguardar(page.getByLabel(new RegExp(`^OS ${OS_ID},`)));
  await foto('minhas-os-online');
  await page.getByLabel(new RegExp(`^OS ${OS_ID},`)).first().click();
  await aguardar(id('botao-iniciar'));
  await foto('detalhe-os');

  console.log('Sem conexão a partir daqui…');
  await contexto.setOffline(true);
  await id('botao-iniciar').click();
  await aguardar(id('botao-continuar'));
  confere(await texto(/Execução iniciada às/).first().isVisible(), 'iniciou a execução sem conexão (status "em andamento" na hora)');
  confere(await id('sync-pendente').count() > 0, 'a OS mostra o ícone "Aguardando envio"');
  await foto('iniciada-sem-conexao');
  await id('botao-continuar').click();
  await aguardar(id('etapa-descricao'));
  await foto('hub-vazio');

  const etapa = async (chave) => { await id(`etapa-${chave}`).click(); };
  const voltar = async () => { await id('botao-salvar-voltar').click(); await aguardar(id('etapa-descricao')); };
  const voltarPelaSeta = async () => { await page.locator('[aria-label="Voltar"]:visible').first().click(); await aguardar(id('etapa-descricao')); };

  await etapa('descricao');
  await id('campo-descricao').fill('curta');
  confere(await texto(/faltam 6 para chegar ao mínimo de 11/).isVisible(), 'descrição curta mostra quantos caracteres faltam');
  await id('campo-descricao').fill('Lançados 120,5 m de ASU 12F entre PL-0932 e CEO-03; CEO vedada.');
  await foto('descricao');
  await voltar();

  await etapa('motivo'); await id('motivo-route_launched').click(); await foto('motivo'); await voltar();

  await etapa('local'); await id('botao-gps').click();
  await aguardar(id('local-coordenadas'));
  confere(await texto(/SIMULAÇÃO: esta pré-visualização no navegador não tem GPS/).isVisible(), 'o GPS do navegador é identificado como simulação');
  confere((await id('local-origem').textContent()).includes('precisão de 8 m'), 'mostra a precisão do GPS em metros');
  await foto('local'); await voltar();

  await etapa('checklist');
  for (const b of await page.locator('[data-testid^="check-"][data-testid$="-sim"]').all()) await b.click();
  for (const i of await page.locator('input[data-testid^="check-"]').all()) await i.fill('4');
  await foto('checklist'); await voltar();

  await etapa('usados');
  await id('usados-pergunta-sim').click();
  await id('botao-novo-lancamento').click();
  await aguardar(id('campo-servico'));
  await id('campo-servico').fill('Lançamento de cabo ASU 12F');
  await id('campo-trecho').fill('PL-0932 → CEO-03');
  await id('botao-ler-qr').click();
  await aguardar(texto(/Leitor de QR \(simulado\)/));
  await id('leitor-codigo').fill('lote-bob-0001');
  await id('leitor-ler').click();
  await aguardar(texto(/Lote LOTE-BOB-0001 encontrado: Cabo óptico ASU 12F/));
  await id('qtd-l1').fill('999');
  confere(await id('limite-l1').textContent() === 'Você tem 400 m em posse', 'acima da posse: mensagem imediata "Você tem 400 m em posse"');
  confere(await id('botao-salvar-lancamento').getAttribute('aria-disabled') === 'true', '…e o botão Salvar fica travado');
  await foto('lancamento-acima-da-posse');
  await id('qtd-l1').fill('120,5');
  await id('botao-salvar-lancamento').click();
  await aguardar(texto('Aguardando envio'));
  confere(await texto(/120,5 m/).first().isVisible(), 'o lançamento aparece na lista com a unidade, aguardando envio');
  await foto('lancamento-salvo'); await voltarPelaSeta();

  await etapa('retirados'); await id('retirados-pergunta-nao').click(); await foto('retirados'); await voltar();

  await etapa('fotos');
  await id('botao-tirar-foto').click();
  await aguardar(texto(/Câmera \(simulada\)/));
  await id('camera-disparar').click();
  await page.waitForTimeout(2500);
  await id('camera-concluir').click();
  await aguardar(id('contador-fotos'));
  confere((await id('contador-fotos').textContent()).startsWith('1 de 30'), 'a foto (comprimida no navegador) entrou na lista');
  await foto('fotos'); await voltarPelaSeta();

  await foto('hub-completo');
  confere(await texto('7 de 7 etapas obrigatórias concluídas').isVisible(), 'as 7 etapas obrigatórias estão concluídas');
  await id('botao-finalizar').click();
  await aguardar(texto('Finalização salva no aparelho'));
  confere(!(await texto(/finalizada$/).count()), 'sem conexão NÃO mostra sucesso falso: "salva no aparelho, ainda não chegou ao servidor"');
  await foto('finalizada-sem-conexao');

  await id('botao-minhas-os').click(); await aguardar(texto('Minhas OS'));
  await foto('minhas-os-pendentes');
  const banner = texto(/envios? aguardando/);
  confere(await banner.first().isVisible(), 'Minhas OS mostra o contador de envios aguardando');
  confere((await consulta('movimentacoes', OS_ID)).length === 0, 'NADA chegou ao servidor enquanto estava sem conexão');

  console.log('Religando a conexão…');
  await contexto.setOffline(false);
  const inicio = Date.now();
  for (;;) {
    if ((await consulta('fechamento', OS_ID)).os.status === 'concluida') break;
    if (Date.now() - inicio > 90000) break;
    const manual = page.getByRole('button', { name: 'Sincronizar agora' });
    if (Date.now() - inicio > 15000 && await manual.count()) await manual.first().click().catch(() => undefined);
    await page.waitForTimeout(2000);
  }
  await page.waitForTimeout(2500);
  await foto('minhas-os-depois-de-sincronizar');

  const f = consulta('fechamento', OS_ID); const movs = consulta('movimentacoes', OS_ID);
  confere(f.os.status === 'concluida', 'o servidor tem a OS concluída');
  confere(f.fechamento?.descricao?.startsWith('Lançados 120,5 m'), 'o fechamento tem a descrição digitada');
  confere(f.fechamento?.local_origem === 'gps', 'o fechamento tem o local (GPS)');
  confere(f.fotos.length === 1, `uma foto no servidor (${f.fotos.length})`);
  confere(movs.length === 1 && movs[0].quantidade === 120.5, `a baixa de estoque chegou UMA vez só: ${JSON.stringify(movs.map((m) => m.quantidade))}`);
  confere(f.servicos.length === 1 && f.servicos[0].trecho === 'PL-0932 → CEO-03', 'o lançamento (serviço + trecho) está no servidor');
  confere(f.rascunhos === 0, 'nada depende do rascunho no servidor');

  await page.getByLabel(new RegExp(`^OS ${OS_ID},`)).first().click().catch(() => undefined);
  await page.getByRole('tab', { name: /Encerradas/ }).click().catch(() => undefined);
  await foto('encerradas');
} catch (e) {
  falhas.push(`erro no roteiro: ${String(e).split('\n')[0]}`);
  await page.screenshot({ path: path.join(saida, 'ERRO.png') }).catch(() => undefined);
} finally {
  await navegador.close();
}
if (errosDaPagina.length) console.log('Erros na página:', [...new Set(errosDaPagina)].slice(0, 5));
console.log(falhas.length ? `\nFALHAS (${falhas.length}):\n- ${falhas.join('\n- ')}` : '\nTODAS AS VERIFICAÇÕES PASSARAM');
process.exit(falhas.length ? 1 : 0);
