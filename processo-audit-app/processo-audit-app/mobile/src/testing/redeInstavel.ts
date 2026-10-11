/**
 * Rede de campo simulada por cima de um `fetch` real: pode cair, perder a resposta DEPOIS de o servidor já ter aplicado
 * a operação (o pior caso para duplicar baixa) ou "congelar" como se o app tivesse sido encerrado nesse instante.
 */
export interface FalhaDeRede {
  online: boolean;
  /** O servidor aplica, mas a resposta nunca chega (a próxima chamada cujo caminho casar). */
  perderRespostaDe: RegExp | null;
  /** O servidor aplica e o app "morre": a chamada nunca termina. */
  congelarDepoisDe: RegExp | null;
}

export const criarRedeInstavel = (real: typeof fetch) => {
  const estado: FalhaDeRede = { online: true, perderRespostaDe: null, congelarDepoisDe: null };
  const chamadas: Array<{ metodo: string; url: string; status: number | 'sem-resposta' }> = [];
  const fetchImpl = (async (url: string, init: { method?: string } & Record<string, unknown>) => {
    const metodo = String(init?.method ?? 'GET');
    if (!estado.online) { chamadas.push({ metodo, url, status: 'sem-resposta' }); throw new TypeError('Network request failed'); }
    const resposta = await (real as unknown as (u: string, i: unknown) => Promise<Response>)(url, init);
    if (metodo !== 'GET' && estado.perderRespostaDe?.test(url)) {
      estado.perderRespostaDe = null;
      chamadas.push({ metodo, url, status: 'sem-resposta' });
      throw new TypeError('Network request failed');
    }
    if (metodo !== 'GET' && estado.congelarDepoisDe?.test(url)) {
      estado.congelarDepoisDe = null;
      chamadas.push({ metodo, url, status: 'sem-resposta' });
      await new Promise<never>(() => undefined); // o app foi encerrado aqui: nunca volta
    }
    chamadas.push({ metodo, url, status: resposta.status });
    return resposta;
  }) as unknown as typeof fetch;
  return { fetchImpl, estado, chamadas };
};
