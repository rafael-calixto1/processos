#!/usr/bin/env node
/**
 * Tela "Catálogos da finalização" do web (só admin) no navegador, contra um backend DE TESTE: lista, cria, edita, desativa/ativa e confere
 * pela API do técnico que o app/web dos técnicos passam a ver (ou deixam de ver) a mudança. Também confere que o estoque não entra.
 *
 *   APP_URL=http://localhost:3995 API_URL=http://localhost:5996/api node scripts/verificar-catalogos-web.mjs <pasta-de-capturas>
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(import.meta.url)(path.resolve(aqui, '../frontend/node_modules/playwright'));
const [saida = 'capturas-catalogos'] = process.argv.slice(2);
const BASE = process.env.APP_URL ?? 'http://localhost:3995';
const API = process.env.API_URL ?? 'http://localhost:5996/api';
fs.mkdirSync(saida, { recursive: true });
const falhas = [];
const confere = (ok, msg) => { console.log(`${ok ? '  ok ' : ' FALHOU'} ${msg}`); if (!ok) falhas.push(msg); };
const emails = { joao: 'joao@exemplo.com', admin: 'admin@exemplo.com' };
const tokens = {};
const api = async (quem, caminho) => {
  if (!tokens[quem]) tokens[quem] = (await (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emails[quem], password: 'senha123' }) })).json()).token;
  return (await fetch(`${API}${caminho}`, { headers: { Authorization: `Bearer ${tokens[quem]}` } })).json();
};

const navegador = await chromium.launch();
const entrar = async (email) => {
  const contexto = await navegador.newContext({ viewport: { width: 1100, height: 800 }, serviceWorkers: 'block' });
  const page = await contexto.newPage();
  await page.goto(BASE);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill('senha123');
  await page.getByRole('button', { name: /^Entrar/ }).click();
  await page.waitForURL(/dashboard|\/os/, { timeout: 20000 });
  return { contexto, page };
};
let n = 0;
const sufixo = Date.now() % 100000;
try {
  const { contexto, page } = await entrar('admin@exemplo.com');
  const foto = async (nome) => { n += 1; await page.screenshot({ path: path.join(saida, `${String(n).padStart(2, '0')}-${nome}.png`) }); };
  const erros = []; page.on('pageerror', (e) => erros.push(String(e)));

  await page.goto(`${BASE}/estoque`);
  await page.getByRole('link', { name: /Catálogos da finalização/ }).waitFor({ timeout: 15000 }).catch(() => undefined); // a página carrega sob demanda
  confere(await page.getByRole('link', { name: /Catálogos da finalização/ }).isVisible(), 'o atalho aparece no Estoque para o admin');
  await page.getByRole('link', { name: /Catálogos da finalização/ }).click();
  await page.getByRole('heading', { name: 'Catálogos da finalização' }).waitFor();
  await page.getByText('Rota lançada com sucesso').first().waitFor();
  confere(await page.locator('tbody tr').count() >= 3, 'lista os motivos semeados');
  await foto('motivos');

  // criar motivo
  const nome = `Cliente ausente ${sufixo}`;
  await page.getByRole('button', { name: /^Novo/ }).click();
  await page.locator('form input').first().fill(nome);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.getByText(nome).first().waitFor();
  const motivo = (await api('admin', '/os-catalogos/motivos')).find((m) => m.rotulo === nome);
  confere(Boolean(motivo) && motivo.codigo.startsWith('cliente_ausente_'), `motivo criado com código gerado (${motivo?.codigo})`);
  confere((await api('joao', '/os/catalogos-fechamento')).motivos.some((m) => m.rotulo === nome), 'o técnico já recebe o motivo novo');

  // editar o nome
  await page.getByRole('button', { name: `Editar ${nome}` }).click();
  await page.locator('form input').first().fill(`${nome} (reagendar)`);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.getByText(`${nome} (reagendar)`).first().waitFor();
  confere((await api('admin', '/os-catalogos/motivos')).find((m) => m.id === motivo.id).rotulo === `${nome} (reagendar)`, 'nome editado; o código continua o mesmo');

  // desativar (com confirmação) e ativar
  await page.getByRole('button', { name: `Desativar ${nome} (reagendar)` }).click();
  await page.getByText(/deixa de aparecer para os técnicos/).waitFor();
  await foto('confirmar-desativar');
  await page.getByRole('button', { name: 'Desativar', exact: true }).click();
  await page.getByText('Desativado', { exact: true }).first().waitFor();
  confere(!(await api('joao', '/os/catalogos-fechamento')).motivos.some((m) => m.id === motivo.id), 'desativado: some do catálogo do técnico');
  await page.getByRole('button', { name: `Ativar ${nome} (reagendar)` }).click();
  await page.getByRole('button', { name: 'Ativar', exact: true }).click();
  await page.waitForTimeout(600);
  confere((await api('joao', '/os/catalogos-fechamento')).motivos.some((m) => m.id === motivo.id), 'ativado de novo: volta para o técnico');

  // checklist
  await page.getByRole('tab', { name: 'Checklist' }).click();
  await page.getByText('Metros de fibra lançados?').first().waitFor();
  await foto('checklist');
  const antes = (await api('admin', '/os-catalogos/checklist')).length;
  // cria pelo formulário escolhendo "Número" (o seletor do sistema é um componente próprio: usa o teclado)
  await page.getByRole('button', { name: /^Novo/ }).click();
  await page.locator('form input').first().fill(`Sobra de cabo deixada ${sufixo}`);
  const campoTipo = page.locator('form').getByText('Sim / Não').first();
  await campoTipo.click();
  await page.getByRole('option', { name: 'Número' }).click();
  await page.locator('form input[maxlength="10"]').fill('m');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.getByText(`Sobra de cabo deixada ${sufixo}`).first().waitFor();
  const itens = await api('admin', '/os-catalogos/checklist');
  const item = itens.find((i) => i.rotulo === `Sobra de cabo deixada ${sufixo}`);
  confere(itens.length === antes + 1 && item?.tipo === 'number' && item.unidade === 'm', `item de checklist criado (${item?.tipo}, ${item?.unidade})`);
  confere((await api('joao', '/os/catalogos-fechamento')).checklist.some((i) => i.id === item.id), 'o técnico já recebe o item novo');
  await foto('checklist-novo');
  confere(erros.length === 0, `nenhum erro de JavaScript ${erros.join(' | ')}`);
  await contexto.close();

  // estoque não administra
  const e = await entrar('estoque@exemplo.com');
  await e.page.goto(`${BASE}/estoque/catalogos-os`);
  await e.page.waitForTimeout(1200);
  confere(!/catalogos-os/.test(e.page.url()), `estoque é redirecionado (${new URL(e.page.url()).pathname})`);
  await e.contexto.close();
} catch (e) {
  console.error('ERRO:', e.message);
  falhas.push(e.message);
} finally {
  await navegador.close();
}
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTudo certo.');
process.exit(falhas.length ? 1 : 0);
