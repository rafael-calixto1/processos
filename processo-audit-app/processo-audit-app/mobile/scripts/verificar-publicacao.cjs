#!/usr/bin/env node
/**
 * Checklist automático ANTES de gerar um build para o técnico (preview) ou para a loja (production). Só olha arquivos do projeto:
 * não acessa a conta do EAS nem da Play Store. Sai com código 1 se algum item OBRIGATÓRIO estiver pendente.
 *   npm run verificar:publicacao            # exige tudo
 *   npm run verificar:publicacao -- --preview   # só o necessário para um APK de teste interno (não exige projeto EAS nem identificador confirmado)
 *   IDENTIFICADOR_CONFIRMADO=1 npm run verificar:publicacao   # você confirma que o identificador do app é o definitivo
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const lerJson = (arquivo) => JSON.parse(fs.readFileSync(arquivo, 'utf8'));

/** Recebe o que está nos arquivos e devolve a lista de itens { id, ok, obrigatorio, texto, ajuda }. Pura, para ser testada. */
const verificar = ({ app, eas, arquivosExistem, repositorioLimpo, identificadorConfirmado, soPreview }) => {
  const itens = [];
  const item = (id, ok, texto, ajuda, obrigatorio = true) => itens.push({ id, ok, obrigatorio, texto, ajuda });
  const urlOk = (perfil) => {
    const u = eas?.build?.[perfil]?.env?.EXPO_PUBLIC_API_URL;
    return typeof u === 'string' && /^https:\/\/[^\s/]+\.[^\s/]+/.test(u) && !/SEU-|exemplo\.com|localhost/i.test(u);
  };
  // Teste interno: o perfil "preview" libera http (app.config.js) para a rede da empresa; endereço de rede privada vale. A produção nunca.
  const redeInterna = (perfil) => {
    const u = eas?.build?.[perfil]?.env?.EXPO_PUBLIC_API_URL;
    return typeof u === 'string' && /^http:\/\/(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?\//.test(u);
  };
  item('url-preview', urlOk('preview') || (soPreview && redeInterna('preview')), 'Perfil "preview" aponta para um servidor alcançável (eas.json → build.preview.env.EXPO_PUBLIC_API_URL)',
    'Use uma URL https de verdade ou, só para teste interno (--preview), um endereço da rede da empresa (http://10.x.x.x:porta/api). Só funciona com o celular nessa rede.');
  item('url-production', urlOk('production'), 'Perfil "production" aponta para uma URL https de verdade', 'Mesma URL do preview, normalmente.', !soPreview);
  item('icones', arquivosExistem.every(Boolean), 'Ícone, ícone adaptativo e splash existem', 'Rode a geração dos arquivos em mobile/assets.');
  item('repositorio-limpo', repositorioLimpo, 'Tudo commitado (o EAS Build usa o último commit: "requireCommit": true)', 'Faça o commit das mudanças antes de gerar o build.');
  item('projeto-eas', Boolean(app?.extra?.eas?.projectId), 'Projeto do EAS vinculado (app.json → extra.eas.projectId)', 'Faça `eas login` e `eas init` (conta Expo do dono do app).', !soPreview);
  item('atualizacao-pelo-ar', Boolean(app?.updates?.url), 'Atualização pelo ar configurada (app.json → updates.url)', 'Rode `eas update:configure` depois do `eas init`.', !soPreview);
  item('identificador', identificadorConfirmado, `Identificador do app confirmado como definitivo (${app?.android?.package})`,
    'No Google Play o identificador NUNCA muda depois de publicado. Confirme com IDENTIFICADOR_CONFIRMADO=1.', !soPreview);
  item('versao', Boolean(app?.version) && Number.isInteger(app?.android?.versionCode), `Versão ${app?.version} (código ${app?.android?.versionCode}) definida`, 'Ajuste app.json → version e android.versionCode.');
  return itens;
};

const principal = () => {
  const raiz = path.resolve(__dirname, '..');
  const app = lerJson(path.join(raiz, 'app.json')).expo;
  const eas = lerJson(path.join(raiz, 'eas.json'));
  const assets = [app.icon, app.android?.adaptiveIcon?.foregroundImage, app.android?.adaptiveIcon?.monochromeImage, app.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen')?.[1]?.image];
  let limpo = true;
  try { limpo = execFileSync('git', ['status', '--porcelain', '--', '.'], { cwd: raiz, encoding: 'utf8' }).trim() === ''; } catch { limpo = false; }
  const itens = verificar({
    app, eas, arquivosExistem: assets.map((a) => Boolean(a) && fs.existsSync(path.join(raiz, a))), repositorioLimpo: limpo,
    identificadorConfirmado: process.env.IDENTIFICADOR_CONFIRMADO === '1', soPreview: process.argv.includes('--preview'),
  });
  for (const i of itens) {
    console.log(`${i.ok ? ' ok ' : i.obrigatorio ? 'FALTA' : 'aviso'}  ${i.texto}${i.ok ? '' : `\n         → ${i.ajuda}`}`);
  }
  const faltando = itens.filter((i) => !i.ok && i.obrigatorio);
  console.log(faltando.length ? `\n${faltando.length} item(ns) obrigatório(s) pendente(s).` : '\nTudo pronto para gerar o build.');
  process.exit(faltando.length ? 1 : 0);
};

module.exports = { verificar };
if (require.main === module) principal();
