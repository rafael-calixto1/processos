#!/usr/bin/env node
/**
 * Confere no navegador (build web + Playwright) o editor de trecho no mapa do formulário de lançamento: toques, trajeto pelas ruas,
 * ponto arrastado, desfazer/limpar e confirmação. O mapa é o MESMO Leaflet/OpenStreetMap do celular (dentro de um iframe).
 * NÃO abre a OS nem lança material: só abre o formulário e marca o trecho. Precisa de internet (Leaflet, mapas e rotas).
 *   OS_ID=<id> node scripts/verificar-trecho-web.mjs <pasta-de-capturas>
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(import.meta.url)(path.resolve(aqui, '../../frontend/node_modules/playwright'));
const [saida = 'capturas-trecho'] = process.argv.slice(2);
const BASE = process.env.APP_URL ?? 'http://localhost:3998';
const OS_ID = Number(process.env.OS_ID ?? 3);
fs.mkdirSync(saida, { recursive: true });
const falhas = []; let n = 0;
const confere = (ok, msg) => { console.log(`${ok ? '  ok ' : ' FALHOU'} ${msg}`); if (!ok) falhas.push(msg); };

const navegador = await chromium.launch();
const page = await (await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
const erros = []; page.on('pageerror', (e) => erros.push(String(e)));
const foto = async (nome) => { n += 1; await page.screenshot({ path: path.join(saida, `${String(n).padStart(2, '0')}-${nome}.png`) }); };
const id = (t) => page.locator(`[data-testid="${t}"]:visible`);
const texto = (t) => page.getByText(t).and(page.locator(':visible'));
const mapa = page.frameLocator('iframe[data-testid="mapa-trecho"]');
const clicar = async (dx, dy) => { await mapa.locator('.leaflet-container').click({ position: { x: 195 + dx, y: 250 + dy }, timeout: 15000 }); };

try {
  await page.goto(BASE);
  await id('campo-email').waitFor({ timeout: 20000 });
  await id('campo-email').fill('joao@exemplo.com'); await id('campo-senha').fill('senha123'); await id('botao-entrar').click();
  await texto('Minhas OS').first().waitFor({ timeout: 20000 });
  await page.goto(`${BASE}/os/${OS_ID}/finalizar/lancamento`);
  await id('botao-marcar-trecho').waitFor({ timeout: 25000 });
  await foto('formulario');
  await id('botao-marcar-trecho').click();
  await mapa.locator('.leaflet-container').waitFor({ timeout: 30000 });
  confere(await texto('Toque no mapa no ponto de INÍCIO do trecho.').first().isVisible(), 'o editor abre pedindo o ponto de início');
  await page.waitForTimeout(2500); // tiles
  await foto('editor-vazio');

  await clicar(0, 0);
  await texto(/Agora toque nos pontos seguintes/).first().waitFor({ timeout: 10000 });
  confere(await mapa.locator('.pino').count() === 1, 'o 1º toque criou o ponto de início');
  confere((await mapa.locator('.pino').first().textContent()) === 'I', 'o primeiro pino é o "I" (início)');

  await clicar(70, -40);
  await Promise.race([texto(/2 pontos · ≈ .* (pelas ruas|em linha reta)/).first().waitFor({ timeout: 40000 }), texto(/Marque os pontos sobre uma rua|Não há trajeto/).first().waitFor({ timeout: 40000 })]);
  const dois = await texto(/2 pontos · ≈/).count() > 0;
  confere(dois, 'o 2º toque gerou o trecho de 2 pontos (se falhar: o ponto ficou fora de rua e foi recusado, ver captura)');
  await page.waitForTimeout(1500);
  await foto('dois-pontos');

  if (dois) {
    confere((await mapa.locator('.pino').nth(1).textContent()) === 'F', 'o último pino é o "F" (fim)');
    await clicar(-60, -120);
    await Promise.race([texto(/3 pontos · ≈/).first().waitFor({ timeout: 40000 }), texto(/Marque os pontos sobre uma rua|Não há trajeto/).first().waitFor({ timeout: 40000 })]);
    const tres = await texto(/3 pontos · ≈/).count() > 0;
    confere(tres, '3º toque: ponto intermediário entra e o fim passa a ser o último');
    if (tres) confere((await mapa.locator('.pino').allTextContents()).join('') === 'I2F', 'pinos na ordem: I, 2, F');
    await page.waitForTimeout(1500);
    await foto('tres-pontos');
    const caminhoPelasRuas = await mapa.locator('path.leaflet-interactive').count();
    confere(caminhoPelasRuas >= 1, 'o trajeto está desenhado no mapa');

    await id('trecho-desfazer').click();
    await texto(/2 pontos · ≈/).first().waitFor({ timeout: 40000 });
    confere(await mapa.locator('.pino').count() === 2, 'desfazer tirou o último ponto');
    await id('trecho-usar').click();
    await id('trecho-marcado').waitFor({ timeout: 10000 });
    confere(await texto(/Trecho marcado no mapa: 2 pontos/).first().isVisible(), 'ao usar o trecho o formulário mostra o resumo');
    const valor = await id('campo-trecho').inputValue();
    confere(/→/.test(valor) && /^-?\d+\.\d+, -?\d+\.\d+ → /.test(valor), `o campo "Trecho" foi sugerido: ${valor}`);
    await foto('formulario-com-trecho');
  }
} catch (e) {
  falhas.push(`erro no roteiro: ${String(e).split('\n')[0]}`);
  await page.screenshot({ path: path.join(saida, 'ERRO.png') }).catch(() => undefined);
} finally { await navegador.close(); }
if (erros.length) console.log('Erros na página:', [...new Set(erros)].slice(0, 4));
console.log(falhas.length ? `\nFALHAS (${falhas.length}):\n- ${falhas.join('\n- ')}` : '\nTODAS AS VERIFICAÇÕES PASSARAM');
process.exit(falhas.length ? 1 : 0);
