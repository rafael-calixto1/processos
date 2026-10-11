/** Servidor falso para os testes: responde em sequência, registra o que recebeu. */
export interface RespostaFalsa { status: number; body?: unknown; texto?: string; headers?: Record<string, string>; atraso?: number; erro?: Error }
export interface Chamada { url: string; method: string; headers: Record<string, string>; body?: string }

export const criarFetchFalso = (respostas: RespostaFalsa[] | ((c: Chamada, n: number) => RespostaFalsa)) => {
  const chamadas: Chamada[] = [];
  const fetchImpl = (async (url: string, init: RequestInit & { signal?: AbortSignal }) => {
    const chamada: Chamada = { url, method: String(init.method), headers: init.headers as Record<string, string>, body: init.body as string | undefined };
    chamadas.push(chamada);
    const n = chamadas.length - 1;
    const r = typeof respostas === 'function' ? respostas(chamada, n) : respostas[Math.min(n, respostas.length - 1)];
    if (r.erro) throw r.erro;
    if (r.atraso !== undefined) {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, r.atraso);
        init.signal?.addEventListener('abort', () => { clearTimeout(t); reject(Object.assign(new Error('abortado'), { name: 'AbortError' })); });
      });
    }
    const texto = r.texto ?? (r.body === undefined ? '' : JSON.stringify(r.body));
    const headers = Object.fromEntries(Object.entries(r.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    return { status: r.status, text: async () => texto, headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } } as unknown as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, chamadas };
};
