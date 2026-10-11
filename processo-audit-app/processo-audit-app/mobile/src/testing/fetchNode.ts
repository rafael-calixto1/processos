import http from 'node:http';
import https from 'node:https';

/** Corpo multipart para os testes de integração (no celular quem monta é um `File` do expo-file-system). */
export class FormularioNode {
  readonly campos: Record<string, string>;
  readonly arquivo: { campo: string; nome: string; mime: string; bytes: Buffer };
  constructor(campos: Record<string, string>, arquivo: { campo: string; nome: string; mime: string; bytes: Buffer }) {
    this.campos = campos;
    this.arquivo = arquivo;
  }
  serializar(): { tipo: string; corpo: Buffer } {
    const limite = `----teste${Math.random().toString(16).slice(2)}`;
    const partes: Buffer[] = [];
    for (const [k, v] of Object.entries(this.campos)) partes.push(Buffer.from(`--${limite}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
    const a = this.arquivo;
    partes.push(Buffer.from(`--${limite}\r\nContent-Disposition: form-data; name="${a.campo}"; filename="${a.nome}"\r\nContent-Type: ${a.mime}\r\n\r\n`), a.bytes, Buffer.from('\r\n'));
    partes.push(Buffer.from(`--${limite}--\r\n`));
    return { tipo: `multipart/form-data; boundary=${limite}`, corpo: Buffer.concat(partes) };
  }
}

/**
 * `fetch` mínimo sobre node:http, só para testes de integração. No Jest do Expo o `fetch` global é o nativo
 * (expo/fetch) e não funciona fora do aparelho; no celular o app usa o fetch real normalmente.
 */
export const fetchNode = ((url: string, init: { method?: string; headers?: Record<string, string>; body?: string | FormularioNode; signal?: AbortSignal } = {}) =>
  new Promise<Response>((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const headers = { ...init.headers };
    let corpo: string | Buffer | undefined;
    if (init.body instanceof FormularioNode) {
      const m = init.body.serializar();
      headers['Content-Type'] = m.tipo; headers['Content-Length'] = String(m.corpo.length);
      corpo = m.corpo;
    } else corpo = init.body;
    const req = lib.request(u, { method: init.method ?? 'GET', headers }, (res) => {
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
    if (corpo) req.write(corpo);
    req.end();
  })) as unknown as typeof fetch;
