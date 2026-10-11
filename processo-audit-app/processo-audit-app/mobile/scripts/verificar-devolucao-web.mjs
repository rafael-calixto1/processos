#!/usr/bin/env node
/**
 * Devolução de material no navegador (build web + Playwright, celular 390×844): pede SEM conexão, vê "na fila", religa a rede,
 * vê "aguardando o estoque", o estoque nega um e aprova outro (pela API, como o web faria) e o app mostra a decisão com o motivo.
 * Leitor de QR é SIMULAÇÃO no navegador. Não prova: câmera/QR reais, rede real de celular.
 *
 *   (backend de teste e `node scripts/preview-web.mjs <dist> <porta>` no ar; o banco precisa ter rodado `teste_mobile.js cenario`)
 *   APP_URL=http://localhost:3996 API_URL=http://localhost:5996/api node scripts/verificar-devolucao-web.mjs <pasta-de-capturas>
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(import.meta.url)(path.resolve(aqui, '../../frontend/node_modules/playwright'));
const [saida = 'capturas'] = process.argv.slice(2);
const BASE = process.env.APP_URL ?? 'http://localhost:3996';
const API = process.env.API_URL ?? 'http://localhost:5996/api';
fs.mkdirSync(saida, { recursive: true });

let n = 0;
const falhas = [];
const confere = (ok, msg) => { console.log(`${ok ? '  ok ' : ' FALHOU'} ${msg}`); if (!ok) falhas.push(msg); };
const chamar = async (email, metodo, caminho, corpo) => {
  const login = await (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'senha123' }) })).json();
  const r = await fetch(`${API}${caminho}`, { method: metodo, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` }, body: corpo ? JSON.stringify(corpo) : undefined });
  return { status: r.status, corpo: await r.json().catch(() => null) };
};

const navegador = await chromium.launch();
const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await contexto.newPage();
const errosDaPagina = [];
page.on('pageerror', (e) => errosDaPagina.push(String(e)));
page.on('dialog', (d) => d.accept());
if (process.env.DEPURAR) page.on('response', async (r) => { if (r.url().includes('/mobile/bootstrap')) { const j = await r.json().catch(() => null); console.log('  [bootstrap]', r.status(), 'devolucoes:', j?.devolucoes?.length, j?.devolucoes?.map((d) => d.status).join(',')); } });
const foto = async (nome) => { n += 1; await page.screenshot({ path: path.join(saida, `${String(n).padStart(2, '0')}-${nome}.png`) }); };
const id = (t) => page.locator(`[data-testid="${t}"]:visible`);
const texto = (t, o = {}) => page.getByText(t, o).and(page.locator(':visible'));
const aguardar = (l, ms = 20000) => l.first().waitFor({ state: 'visible', timeout: ms });

try {
  await page.goto(BASE);
  await aguardar(id('campo-email'));
  await id('campo-email').fill('joao@exemplo.com');
  await id('campo-senha').fill('senha123');
  await id('botao-entrar').click();
  await aguardar(texto('Minhas OS'));
  await page.getByRole('tab', { name: /Meu estoque/ }).click().catch(async () => { await page.getByText('Meu estoque').last().click(); });
  await aguardar(id('botao-devolver'));
  await aguardar(texto(/Cabo óptico ASU 12F/)); // espera o saldo baixar antes da captura
  await foto('meu-estoque');
  confere(await id('botao-minhas-devolucoes').isVisible(), 'Meu estoque tem o atalho "Minhas devoluções"');

  await id('botao-devolver').click();
  await aguardar(texto('Devolver material', { exact: true }));
  await foto('devolver-vazio');
  confere(await id('botao-pedir-devolucao').getAttribute('aria-disabled') === 'true', 'sem seleção o botão "Pedir devolução" fica travado');

  console.log('Sem conexão a partir daqui…');
  await contexto.setOffline(true);
  await id('grupo-l1').click();
  await id('qtd-l1').fill('999');
  await id('condicao-l1-usado').click();
  confere((await id('limite-l1').textContent()).includes('Você tem 400 m em posse'), 'acima da posse: "Você tem 400 m em posse"');
  confere(await id('botao-pedir-devolucao').getAttribute('aria-disabled') === 'true', '…e o botão continua travado');
  await foto('devolver-acima-da-posse');
  await id('qtd-l1').fill('100');
  confere((await id('limite-l1').textContent()).includes('até 400 m'), 'quantidade válida: mostra o limite "até 400 m"');
  await page.locator('[data-testid^="grupo-i"]:visible').first().click();
  await page.locator('input[data-testid^="qtd-i"]:visible').first().fill('35');
  await foto('devolver-sem-condicao-do-conector');
  confere(await id('botao-pedir-devolucao').getAttribute('aria-disabled') === 'true', 'falta a condição do conector: botão travado (o app nunca assume novo/usado)');
  await page.locator('[data-testid^="condicao-i"][data-testid$="-novo"]:visible').first().click();
  await id('campo-observacao').fill('sobra da obra da OS 2');
  await foto('devolver-pronto');
  await id('botao-pedir-devolucao').click();
  await aguardar(texto('Minhas devoluções', { exact: true }));
  await aguardar(texto('Na fila para enviar'));
  confere(await texto('Na fila para enviar').count() >= 3, 'sem conexão: os 3 pedidos (cabo + 2 lotes de conector) aparecem "Na fila para enviar"');
  confere(await id('cancelar-o1').isVisible(), 'pedido ainda na fila pode ser cancelado');
  await foto('minhas-devolucoes-na-fila');

  console.log('Religando a rede…');
  await contexto.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await aguardar(texto('Aguardando o estoque'), 30000);
  await page.waitForFunction(() => !document.body.innerText.includes('Na fila para enviar'), null, { timeout: 30000 }).catch(() => undefined);
  const aguardando = await texto('Aguardando o estoque').count();
  confere(aguardando >= 3, `rede voltou: os pedidos foram enviados e ficaram "Aguardando o estoque" (${aguardando})`);
  await foto('minhas-devolucoes-enviadas');

  const lista = (await chamar('estoque@exemplo.com', 'GET', '/estoque/devolucoes?status=pendente')).corpo;
  confere(lista.length === 3, `o servidor tem exatamente 3 solicitações pendentes (sem duplicata): ${lista.length}`);
  const cabo = lista.find((d) => d.item_nome.startsWith('Cabo'));
  const con = lista.filter((d) => d.item_nome.startsWith('Conector'));
  confere((await chamar('estoque@exemplo.com', 'POST', `/estoque/devolucoes/${cabo.id}/negar`, { motivo: 'Cabo com a capa danificada' })).status === 200, 'estoque negou o cabo');
  for (const d of con) await chamar('estoque@exemplo.com', 'POST', `/estoque/devolucoes/${d.id}/aprovar`, {});

  // Atualiza pela aba Conta ("Sincronizar agora"); recarregar a página perderia a sessão da pré-visualização web
  await page.locator('[aria-label="Voltar"]:visible').first().click();
  await page.getByRole('tab', { name: /Conta/ }).click().catch(async () => { await page.getByText('Conta', { exact: true }).last().click(); });
  await aguardar(id('botao-sincronizar'));
  await id('botao-sincronizar').click();
  await page.waitForTimeout(1500);
  await page.getByRole('tab', { name: /Meu estoque/ }).click().catch(async () => { await page.getByText('Meu estoque').last().click(); });
  await aguardar(id('botao-minhas-devolucoes'));
  await id('botao-minhas-devolucoes').click();
  await aguardar(texto('Negada', { exact: true }), 30000);
  confere(await texto('Cabo com a capa danificada').isVisible(), 'a negação mostra o motivo do estoque');
  confere(await texto('O material continua com você.').isVisible(), '…e diz que o material continua com o técnico');
  confere(await texto('Aprovada', { exact: true }).count() >= 2, 'os conectores aparecem "Aprovada"');
  await foto('minhas-devolucoes-decididas');

  await id('botao-nova-devolucao').click();
  await aguardar(texto('Devolver material', { exact: true }));
  confere(await id('grupo-l1').isVisible(), 'após a negação o cabo volta a poder ser devolvido (400 m disponíveis)');
  confere((await id('grupo-l1').textContent()).includes('400 m'), '…com os 400 m disponíveis');
  await foto('devolver-depois-da-decisao');
  confere(errosDaPagina.length === 0, `nenhum erro de JavaScript na página ${errosDaPagina.join(' | ')}`);
} catch (e) {
  console.error('ERRO:', e.message);
  await foto('erro').catch(() => undefined);
  falhas.push(e.message);
} finally {
  await navegador.close();
}
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTudo certo.');
process.exit(falhas.length ? 1 : 0);
