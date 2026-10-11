#!/usr/bin/env node
/**
 * Fluxo de campo do WEB de ponta a ponta no navegador (Playwright, celular 390×844) contra um backend DE TESTE: o técnico inicia a OS,
 * preenche todas as etapas com os catálogos reais do servidor, envia fotos, e finaliza com `POST /os/:id/finalizar`. Depois confere,
 * pela API, que tudo ficou gravado (motivo, local, checklist, retirados com condição, participantes, fotos), o que o `/fechar` antigo perdia.
 *
 *   node scripts/servir-web-teste.mjs <build-do-web> 3995 5996 &        (backend de teste na 5996, banco processo_audit_test)
 *   DB_NAME=processo_audit_test node scripts/teste_mobile.js cenario    (cria uma OS aberta + estoque para o João; rode `preparar` antes se o banco estiver vazio)
 *   APP_URL=http://localhost:3995 API_URL=http://localhost:5996/api node scripts/verificar-finalizacao-web.mjs <pasta-de-capturas>
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(import.meta.url)(path.resolve(aqui, '../frontend/node_modules/playwright'));
const [saida = 'capturas-web'] = process.argv.slice(2);
const BASE = process.env.APP_URL ?? 'http://localhost:3995';
const API = process.env.API_URL ?? 'http://localhost:5996/api';
fs.mkdirSync(saida, { recursive: true });

const falhas = [];
const confere = (ok, msg) => { console.log(`${ok ? '  ok ' : ' FALHOU'} ${msg}`); if (!ok) falhas.push(msg); };
const cenario = () => JSON.parse(execFileSync(process.execPath, ['scripts/teste_mobile.js', 'cenario'], { cwd: path.resolve(aqui, '..'), env: { ...process.env, DB_NAME: 'processo_audit_test' }, encoding: 'utf8' }).trim().split('\n').filter((l) => l.startsWith('{')).pop());
const tokens = {};
const api = async (quem, metodo, caminho, corpo) => {
  const email = { joao: 'joao@exemplo.com', admin: 'admin@exemplo.com' }[quem];
  if (!tokens[quem]) tokens[quem] = (await (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'senha123' }) })).json()).token;
  const r = await fetch(`${API}${caminho}`, { method: metodo, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens[quem]}` }, body: corpo ? JSON.stringify(corpo) : undefined });
  return { status: r.status, corpo: await r.json().catch(() => ({})) };
};
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const navegador = await chromium.launch();
const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
const page = await contexto.newPage();
const errosDaPagina = [];
page.on('pageerror', (e) => errosDaPagina.push(String(e)));
let n = 0;
const foto = async (nome) => { n += 1; await page.screenshot({ path: path.join(saida, `${String(n).padStart(2, '0')}-${nome}.png`) }); };
const texto = (t, o = {}) => page.getByText(t, o).first();
const aguardar = (l, ms = 20000) => l.waitFor({ state: 'visible', timeout: ms });
const botao = (nome, o = {}) => page.getByRole('button', { name: nome, ...o });
const ok = () => botao('Ok', { exact: true }).click();
const etapa = async (rotulo) => { await page.locator('ul button', { hasText: rotulo }).first().click(); };

try {
  // ── preparação pela API: uma OS aberta do João com um lançamento de material já feito (o lançamento tem tela própria, já testada) ──
  const c = cenario();
  const posse = (await api('joao', 'GET', '/estoque/posse/minha')).corpo;
  const lote = posse.find((p) => p.lote_codigo === c.cabo.lote);
  const lanc = await api('joao', 'POST', `/os/${c.os_id}/lancamentos`, { descricao: 'Lançamento de cabo', trecho: 'PL-1 → PL-2', materiais: [{ lote_id: lote.lote_id, quantidade: 100 }] });
  confere(lanc.status === 201, `preparação: lançamento de 100 m criado na OS ${c.os_numero} (${lanc.status})`);

  // ── login e lista ──
  await page.goto(BASE);
  await page.locator('#email').fill('joao@exemplo.com');
  await page.locator('#password').fill('senha123');
  await page.getByRole('button', { name: /^Entrar/ }).click();
  await aguardar(texto('OS pendentes'));
  await foto('lista-os');
  await page.getByRole('button', { name: new RegExp(`OS-${c.os_numero}`) }).click();
  await aguardar(botao(/Iniciar Execução/));
  await foto('detalhe-os');
  await botao(/Iniciar Execução/).click();
  await aguardar(texto('Finalização'));
  await foto('hub-vazio');
  confere(await botao(/Finalizar$/).isDisabled(), 'sem etapas concluídas o botão "Finalizar" fica travado');

  // ── descrição: o mínimo vem do servidor ──
  await etapa('Descrição');
  await page.locator('#desc').fill('curta');
  await aguardar(texto(/Mínimo de 11 caracteres/));
  confere(await page.getByRole('alert').first().isVisible(), 'descrição curta mostra o aviso');
  await page.locator('#desc').fill('Lançados 100 m de ASU 12F entre PL-1 e PL-2; CEO vedada.');
  await ok();

  // ── motivo: opções do catálogo do servidor ──
  await etapa('Motivo de Fechamento');
  const motivos = await page.getByRole('radio').allTextContents();
  const catalogo = (await api('joao', 'GET', '/os/catalogos-fechamento')).corpo;
  confere(motivos.length === catalogo.motivos.length && catalogo.motivos.every((m) => motivos.includes(m.rotulo)), `motivos na tela = motivos do servidor (${motivos.length})`);
  await page.getByRole('radio', { name: 'Rota lançada com sucesso' }).click();
  await foto('motivo');
  await ok();

  // ── local: coordenadas do poste ──
  await etapa('Local do Endereço');
  await page.getByRole('button', { name: /^Usar coordenadas do/ }).click();
  await aguardar(texto(/Referência do/));
  await ok();

  // ── checklist: itens do catálogo do servidor ──
  await etapa('Checklists');
  await aguardar(texto(/Metros de fibra lançados/));
  const obrigatorios = catalogo.checklist.filter((i) => i.obrigatorio).length;
  confere(await page.locator('span[aria-hidden="true"]:has-text("*")').count() === obrigatorios, `${obrigatorios} itens obrigatórios marcados com *`);
  for (const b of await page.getByRole('button', { name: 'Sim', exact: true }).all()) await b.click();
  for (const i of await page.locator('input[type="number"]').all()) await i.fill('4');
  await foto('checklist');
  await ok();

  // ── materiais usados: vêm dos lançamentos do servidor ──
  await aguardar(texto(/1 lançamento\(s\)/));
  confere(true, 'hub mostra "1 lançamento(s)" vindo do servidor');

  // ── materiais retirados: itens reais, quantidade e condição ──
  await etapa('Materiais Retirados');
  await page.getByRole('switch').click();
  await botao(/Adicionar produto/).click();
  await page.getByRole('button', { name: /Conector SC\/APC/ }).click();
  await page.getByLabel(/Quantidade de Conector SC\/APC/).fill('3');
  confere(await texto(/Informe se cada material está novo ou usado/).isVisible(), 'sem condição escolhida, a tela avisa');
  await page.getByRole('radio', { name: 'Usado' }).first().click();
  await botao(/Adicionar produto/).click();
  await botao(/Outro material \(descrever\)/).click();
  await page.getByLabel('Descrição do outro material').fill('Splitter 1:8 antigo');
  await page.getByLabel(/Quantidade de/).last().fill('1');
  await page.getByRole('radio', { name: 'Novo' }).last().click();
  await foto('retirados');
  await ok();

  // ── fotos: vão para o servidor na hora ──
  await etapa('Fotos do Serviço');
  const galeria = page.locator('input[type="file"][multiple]');
  await galeria.setInputFiles([{ name: 'a.png', mimeType: 'image/png', buffer: PNG }, { name: 'b.png', mimeType: 'image/png', buffer: PNG }]);
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="foto-servico"] img').length === 2, null, { timeout: 20000 });
  confere((await api('joao', 'GET', `/os/${c.os_id}/fotos`)).corpo.length === 2, 'as 2 fotos estão no servidor');
  await page.getByRole('button', { name: 'Remover foto' }).first().click();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="foto-servico"]').length === 1, null, { timeout: 20000 });
  confere((await api('joao', 'GET', `/os/${c.os_id}/fotos`)).corpo.length === 1, 'remover apaga também no servidor (sobra 1)');
  await foto('fotos');
  await ok();

  // ── participantes: técnicos/equipes reais ──
  await etapa('Participantes');
  await aguardar(texto('Equipe Apoio'));
  confere(!(await page.getByText('Anderson Souza').count()), 'participantes não são mais a lista de mentira');
  await page.getByRole('checkbox', { name: /Equipe Apoio/ }).click();
  await ok();

  // ── finalizar ──
  await aguardar(texto(/8 de 7|7 de 7/).or(texto(/etapas obrigatórias concluídas/)));
  await foto('hub-completo');
  confere(!(await botao(/Finalizar$/).isDisabled()), 'com tudo pronto o "Finalizar" libera');
  await botao(/Finalizar$/).click();
  await botao('Sim, finalizar').click();
  await aguardar(texto(/finalizada/));
  await foto('finalizada');
  confere(true, 'tela de OS finalizada');

  // ── o que ficou no servidor ──
  const os = (await api('admin', 'GET', `/os/${c.os_id}`)).corpo;
  confere(os.status === 'concluida', `OS concluída no servidor (${os.status})`);
  confere(os.fechamento?.motivo === 'Rota lançada com sucesso', `motivo gravado: ${os.fechamento?.motivo}`);
  confere(os.fechamento?.descricao.startsWith('Lançados 100 m'), 'descrição gravada');
  confere(os.fechamento?.local?.origem === 'pole_reference' && Math.abs(os.fechamento.local.lat) > 1, `local gravado (${os.fechamento?.local?.origem})`);
  confere(os.fechamento?.checklist.length === obrigatorios && os.fechamento.checklist.every((x) => x.resposta !== undefined), `checklist gravado (${os.fechamento?.checklist.length} respostas)`);
  confere(os.materiais_retirados?.length === 2 && os.materiais_retirados.map((m) => m.condicao).sort().join() === 'novo,usado', 'materiais retirados gravados com a condição (novo/usado)');
  confere(os.materiais_retirados?.some((m) => m.descricao === 'Splitter 1:8 antigo' && m.item_id === null), 'material livre gravado como texto');
  confere(os.materiais_retirados?.some((m) => m.item_id && m.quantidade === 3), 'item do estoque gravado com o id e a quantidade');
  confere(os.fechamento?.participantes.length === 1 && os.fechamento.participantes[0].nome === 'Equipe Apoio', 'participante real gravado');
  confere(os.fotos?.length === 1, 'a foto do serviço está na OS');
  confere(os.fechamento?.versao_app === 'web' && Boolean(os.fechamento?.iniciado_em), 'origem "web" e hora de início gravadas');
  confere(os.materiais?.filter((m) => !m.estorno_id).length === 1, 'o material do lançamento não foi baixado de novo');

  // ── erro do servidor aparece (a OS segue aberta): foto some do servidor depois de a tela achar que estava tudo pronto ──
  const c2 = cenario();
  const posse2 = (await api('joao', 'GET', '/estoque/posse/minha')).corpo;
  const lote2 = posse2.find((p) => p.lote_codigo === c2.cabo.lote);
  await api('joao', 'POST', `/os/${c2.os_id}/lancamentos`, { descricao: 'Lançamento B', trecho: 'A → B', materiais: [{ lote_id: lote2.lote_id, quantidade: 10 }] });
  await page.goto(`${BASE}/os`);
  await page.getByRole('button', { name: new RegExp(`OS-${c2.os_numero}`) }).click();
  await botao(/Iniciar Execução/).click();
  await aguardar(texto('Finalização'));
  await etapa('Descrição'); await page.locator('#desc').fill('Segunda OS, descrição suficiente.'); await ok();
  await etapa('Motivo de Fechamento'); await page.getByRole('radio').first().click(); await ok();
  await etapa('Local do Endereço'); await page.getByRole('button', { name: /^Usar coordenadas do/ }).click(); await ok();
  await etapa('Checklists');
  for (const b of await page.getByRole('button', { name: 'Sim', exact: true }).all()) await b.click();
  for (const i of await page.locator('input[type="number"]').all()) await i.fill('2');
  await ok();
  await etapa('Materiais Retirados'); await botao('Nenhum material').click(); await ok();
  await etapa('Fotos do Serviço');
  await galeria.setInputFiles([{ name: 'c.png', mimeType: 'image/png', buffer: PNG }]);
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="foto-servico"] img').length === 1, null, { timeout: 20000 });
  await ok();
  const fotoId = (await api('joao', 'GET', `/os/${c2.os_id}/fotos`)).corpo[0].id;
  await api('joao', 'DELETE', `/os/${c2.os_id}/fotos/${fotoId}`); // alguém apagou a foto por fora: a tela ainda acha que há uma
  await botao(/Finalizar$/).click();
  await botao('Sim, finalizar').click();
  await aguardar(texto(/Envie ao menos 1 foto do serviço/));
  await foto('erro-do-servidor');
  confere(true, 'recusa do servidor ("Envie ao menos 1 foto") aparece na tela');
  confere((await api('admin', 'GET', `/os/${c2.os_id}`)).corpo.status !== 'concluida', 'e a OS continua aberta');

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
