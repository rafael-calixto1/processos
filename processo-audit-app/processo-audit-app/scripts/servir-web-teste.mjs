#!/usr/bin/env node
/**
 * Serve o build do web (`vite build`) e encaminha /api e /uploads para um backend DE TESTE. Serve só para verificar telas no
 * navegador com Playwright; nunca aponte para a produção.
 *   node scripts/servir-web-teste.mjs <pasta-do-build> <porta-web> <porta-backend-de-teste>
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const [dir, porta = '3995', backend = '5996'] = process.argv.slice(2);
if (!dir) { console.error('Uso: servir-web-teste.mjs <pasta-do-build> [porta] [porta-do-backend]'); process.exit(2); }
if (backend === '5002') { console.error('Recusado: 5002 é o backend de produção.'); process.exit(2); }
const raiz = path.resolve(dir);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/uploads')) {
    const p = http.request({ host: '127.0.0.1', port: Number(backend), path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${backend}` } }, (r) => { res.writeHead(r.statusCode ?? 502, r.headers); r.pipe(res); });
    p.on('error', () => { res.writeHead(502).end('backend de teste fora do ar'); });
    req.pipe(p);
    return;
  }
  let arquivo = path.join(raiz, decodeURIComponent(url.pathname));
  if (!arquivo.startsWith(raiz)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) arquivo = path.join(raiz, 'index.html');
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(arquivo).pipe(res);
}).listen(Number(porta), () => console.log(`Web de teste em http://localhost:${porta} → backend ${backend}`));
