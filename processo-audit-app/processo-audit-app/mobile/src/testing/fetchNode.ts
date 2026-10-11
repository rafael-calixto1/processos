import http from 'node:http';
import https from 'node:https';

/**
 * `fetch` mínimo sobre node:http, só para testes de integração. No Jest do Expo o `fetch` global é o nativo
 * (expo/fetch) e não funciona fora do aparelho; no celular o app usa o fetch real normalmente.
 */
export const fetchNode = ((url: string, init: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal } = {}) =>
  new Promise<Response>((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(u, { method: init.method ?? 'GET', headers: init.headers }, (res) => {
      const partes: Buffer[] = [];
      res.on('data', (c: Buffer) => partes.push(c));
      res.on('end', () => {
        const texto = Buffer.concat(partes).toString('utf8');
        resolve({
          status: res.statusCode ?? 0,
          text: async () => texto,
          headers: { get: (k: string) => { const v = res.headers[k.toLowerCase()]; return Array.isArray(v) ? v[0] : (v ?? null); } },
        } as unknown as Response);
      });
    });
    req.on('error', reject);
    init.signal?.addEventListener('abort', () => req.destroy(Object.assign(new Error('abortado'), { name: 'AbortError' })));
    if (init.body) req.write(init.body);
    req.end();
  })) as unknown as typeof fetch;
