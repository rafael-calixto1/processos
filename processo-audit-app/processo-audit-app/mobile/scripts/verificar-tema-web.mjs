#!/usr/bin/env node
/**
 * Tema claro e escuro no navegador (build web + Playwright, celular 390×844, emulando "prefers-color-scheme"): captura as telas
 * principais nos dois temas e confere que o fundo da página muda de verdade. Não prova o comportamento do Android real.
 *
 *   APP_URL=http://localhost:3996 node scripts/verificar-tema-web.mjs <pasta-de-capturas>
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(import.meta.url)(path.resolve(aqui, '../../frontend/node_modules/playwright'));
const [saida = 'capturas'] = process.argv.slice(2);
const BASE = process.env.APP_URL ?? 'http://localhost:3996';
fs.mkdirSync(saida, { recursive: true });
const falhas = [];
const confere = (ok, msg) => { console.log(`${ok ? '  ok ' : ' FALHOU'} ${msg}`); if (!ok) falhas.push(msg); };

const navegador = await chromium.launch();
for (const esquema of ['light', 'dark']) {
  console.log(`Tema ${esquema}…`);
  const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: esquema });
  const page = await contexto.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  const id = (t) => page.locator(`[data-testid="${t}"]:visible`);
  const texto = (t, o = {}) => page.getByText(t, o).and(page.locator(':visible'));
  const aguardar = (l, ms = 20000) => l.first().waitFor({ state: 'visible', timeout: ms });
  let n = 0;
  const foto = async (nome) => { n += 1; await page.screenshot({ path: path.join(saida, `${esquema}-${String(n).padStart(2, '0')}-${nome}.png`) }); };
  const aba = async (nome) => { await page.getByRole('tab', { name: new RegExp(nome) }).click().catch(async () => { await page.getByText(nome, { exact: true }).last().click(); }); };
  const fundoDoCorpo = () => page.evaluate(() => { let el = document.querySelector('#root > div > div') || document.body; return getComputedStyle(el).backgroundColor; });

  await page.goto(BASE);
  await aguardar(id('campo-email'));
  await foto('login');
  await id('campo-email').fill('joao@exemplo.com');
  await id('campo-senha').fill('senha123');
  await id('botao-entrar').click();
  await aguardar(texto('Minhas OS'));
  await page.waitForTimeout(1200);
  await foto('minhas-os');
  await aba('Meu estoque'); await aguardar(id('botao-devolver')); await aguardar(texto(/Cabo óptico/)); await foto('meu-estoque');
  await id('botao-devolver').click(); await aguardar(id('botao-pedir-devolucao'));
  await id('grupo-l1').click(); await id('qtd-l1').fill('120'); await id('condicao-l1-usado').click();
  await foto('devolver');
  await page.locator('[aria-label="Voltar"]:visible').first().click(); await aguardar(id('botao-ficha'));
  await id('botao-ficha').click(); await aguardar(texto('Em posse agora')); await foto('ficha');
  await page.locator('[aria-label="Voltar"]:visible').first().click(); await aguardar(id('botao-ficha'));
  await aba('Conta'); await aguardar(id('botao-sincronizar')); await foto('conta');
  const corpo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const claro = (c) => { const [r, g, b] = c.match(/\d+/g).map(Number); return (r * 299 + g * 587 + b * 114) / 1000 > 128; };
  // a tela (não o body, que é do navegador) precisa ter o fundo do tema: procura o maior bloco visível
  const fundoTela = await page.evaluate(() => {
    const els = [...document.querySelectorAll('div')].filter((e) => e.offsetWidth >= 380 && e.offsetHeight >= 600);
    return els.map((e) => getComputedStyle(e).backgroundColor).filter((c) => c !== 'rgba(0, 0, 0, 0)').pop();
  });
  confere(esquema === 'dark' ? !claro(fundoTela) : claro(fundoTela), `tema ${esquema}: fundo da tela ${fundoTela} é ${esquema === 'dark' ? 'escuro' : 'claro'}`);
  confere(erros.length === 0, `tema ${esquema}: nenhum erro de JavaScript ${erros.join(' | ')}`);
  void corpo;
  await contexto.close();
}
await navegador.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTudo certo.');
process.exit(falhas.length ? 1 : 0);
