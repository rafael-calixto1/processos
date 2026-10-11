#!/usr/bin/env node
/**
 * Serve o build web (`expo export --platform web`) com os cabeçalhos que o expo-sqlite exige no navegador
 * (isolamento de origem). Serve só para olhar as telas no computador; o app de verdade é Android/iOS.
 *
 *   EXPO_PUBLIC_API_URL=http://localhost:5000/api npx expo export --platform web --output-dir dist
 *   node scripts/preview-web.mjs dist 3998
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const [dir = 'dist', porta = '3998'] = process.argv.slice(2);
const raiz = path.resolve(dir);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.css': 'text/css' };

http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  let arquivo = path.join(raiz, decodeURIComponent(url.pathname));
  if (!arquivo.startsWith(raiz)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) arquivo = path.join(raiz, 'index.html'); // rotas do app (SPA)
  res.writeHead(200, {
    'Content-Type': TIPOS[path.extname(arquivo)] ?? 'application/octet-stream',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'credentialless',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(arquivo).pipe(res);
}).listen(Number(porta), () => console.log(`Pré-visualização em http://localhost:${porta} (${raiz})`));
