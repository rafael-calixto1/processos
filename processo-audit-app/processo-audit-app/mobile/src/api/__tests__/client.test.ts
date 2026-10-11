import { ApiClient, type FonteDeToken } from '../client';
import { ApiError, ArquivoAusenteError, NetworkError } from '../erros';
import { criarFetchFalso } from '@/testing/servidorFalso';

const tokens = (sobrescrever: Partial<FonteDeToken> = {}) => {
  let access: string | null = 'velho';
  const t = {
    renovacoes: 0, perdida: 0,
    tokenDeAcesso: () => access,
    renovar: jest.fn(async () => { t.renovacoes++; access = 'novo'; return true; }),
    sessaoPerdida: jest.fn(() => { t.perdida++; }),
    ...sobrescrever,
  };
  return t;
};
const cliente = (fetchImpl: typeof fetch, t: FonteDeToken, timeoutMs?: number) => new ApiClient({ baseUrl: () => 'http://srv/api', tokens: t, fetchImpl, timeoutMs });

describe('ApiClient', () => {
  it('envia o token e devolve o JSON; sem auth não manda Authorization', async () => {
    const { fetchImpl, chamadas } = criarFetchFalso([{ status: 200, body: { ok: 1 } }]);
    const c = cliente(fetchImpl, tokens());
    expect(await c.request('GET', '/x')).toEqual({ ok: 1 });
    expect(chamadas[0].url).toBe('http://srv/api/x');
    expect(chamadas[0].headers.Authorization).toBe('Bearer velho');
    await c.request('POST', '/auth/login', { body: { a: 1 }, auth: false });
    expect(chamadas[1].headers.Authorization).toBeUndefined();
    expect(chamadas[1].headers['Content-Type']).toBe('application/json');
    expect(chamadas[1].body).toBe('{"a":1}');
  });

  it('manda a Idempotency-Key e aceita resposta vazia', async () => {
    const { fetchImpl, chamadas } = criarFetchFalso([{ status: 200 }]);
    expect(await cliente(fetchImpl, tokens()).request('POST', '/os/1/iniciar', { body: {}, idempotencyKey: 'abc-123' })).toBeNull();
    expect(chamadas[0].headers['Idempotency-Key']).toBe('abc-123');
  });

  it.each([
    ['403 token_expirado', { status: 403, body: { error: 'Token inválido ou expirado', code: 'token_expirado' } }],
    ['403 token_invalido', { status: 403, body: { error: 'Token inválido ou expirado', code: 'token_invalido' } }],
    ['401', { status: 401, body: { error: 'Token não fornecido' } }],
  ])('renova a sessão e repete a chamada uma vez (%s)', async (_n, recusa) => {
    const { fetchImpl, chamadas } = criarFetchFalso([recusa, { status: 200, body: { ok: true } }]);
    const t = tokens();
    expect(await cliente(fetchImpl, t).request('GET', '/os')).toEqual({ ok: true });
    expect(t.renovar).toHaveBeenCalledTimes(1);
    expect(chamadas).toHaveLength(2);
    expect(chamadas[0].headers.Authorization).toBe('Bearer velho');
    expect(chamadas[1].headers.Authorization).toBe('Bearer novo');
    expect(t.sessaoPerdida).not.toHaveBeenCalled();
  });

  it('um 403 de regra de negócio NÃO renova nem desloga', async () => {
    const { fetchImpl } = criarFetchFalso([{ status: 403, body: { error: 'Esta OS não está atribuída a você' } }]);
    const t = tokens();
    await expect(cliente(fetchImpl, t).request('GET', '/os/9')).rejects.toMatchObject({ name: 'ApiError', status: 403, message: 'Esta OS não está atribuída a você' });
    expect(t.renovar).not.toHaveBeenCalled();
    expect(t.sessaoPerdida).not.toHaveBeenCalled();
  });

  it('se o servidor recusa a renovação, a sessão é dada como perdida e a chamada não é repetida', async () => {
    const { fetchImpl, chamadas } = criarFetchFalso([{ status: 401, body: { error: 'x' } }]);
    const t = tokens({ renovar: jest.fn(async () => false) });
    await expect(cliente(fetchImpl, t).request('GET', '/os')).rejects.toMatchObject({ status: 401, code: 'sessao_expirada' });
    expect(t.sessaoPerdida).toHaveBeenCalledTimes(1);
    expect(chamadas).toHaveLength(1);
  });

  it('sem rede na renovação: o erro de rede sobe e a sessão NÃO é perdida', async () => {
    const { fetchImpl } = criarFetchFalso([{ status: 403, body: { error: 'Token inválido ou expirado', code: 'token_expirado' } }]);
    const t = tokens({ renovar: jest.fn(async () => { throw new NetworkError(); }) });
    await expect(cliente(fetchImpl, t).request('GET', '/os')).rejects.toBeInstanceOf(NetworkError);
    expect(t.sessaoPerdida).not.toHaveBeenCalled();
  });

  it('se mesmo depois de renovar o servidor recusa o token, a sessão é perdida (sem laço infinito)', async () => {
    const { fetchImpl, chamadas } = criarFetchFalso([{ status: 401, body: { error: 'x' } }]);
    const t = tokens();
    await expect(cliente(fetchImpl, t).request('GET', '/os')).rejects.toMatchObject({ code: 'sessao_expirada' });
    expect(t.renovar).toHaveBeenCalledTimes(1);
    expect(chamadas).toHaveLength(2);
    expect(t.sessaoPerdida).toHaveBeenCalledTimes(1);
  });

  it('requisições sem auth (login) com 401 não tentam renovar', async () => {
    const { fetchImpl } = criarFetchFalso([{ status: 401, body: { error: 'Email ou senha inválidos' } }]);
    const t = tokens();
    await expect(cliente(fetchImpl, t).request('POST', '/auth/login', { body: {}, auth: false })).rejects.toMatchObject({ status: 401, message: 'Email ou senha inválidos' });
    expect(t.renovar).not.toHaveBeenCalled();
  });

  it('erro de conexão e tempo esgotado viram NetworkError', async () => {
    const off = criarFetchFalso([{ status: 0, erro: new TypeError('Network request failed') }]);
    await expect(cliente(off.fetchImpl, tokens()).request('GET', '/x')).rejects.toBeInstanceOf(NetworkError);
    const lento = criarFetchFalso([{ status: 200, atraso: 500 }]);
    await expect(cliente(lento.fetchImpl, tokens(), 20).request('GET', '/x')).rejects.toMatchObject({ name: 'NetworkError', message: expect.stringMatching(/demorou demais/) });
  });

  it('lê detalhes de validação, Retry-After e respostas que não são JSON', async () => {
    const detalhes = [{ campo: 'fotos', mensagem: 'Envie ao menos 1 foto do serviço' }];
    const a = criarFetchFalso([{ status: 400, body: { error: 'A OS não pode ser finalizada', detalhes } }]);
    await expect(cliente(a.fetchImpl, tokens()).request('POST', '/os/1/finalizar', { body: {} })).rejects.toMatchObject({ status: 400, detalhes });
    const b = criarFetchFalso([{ status: 429, body: { error: 'Muitas tentativas' }, headers: { 'Retry-After': '120' } }]);
    await expect(cliente(b.fetchImpl, tokens()).request('POST', '/auth/login', { auth: false })).rejects.toMatchObject({ status: 429, retryAfter: 120 });
    const c = criarFetchFalso([{ status: 502, texto: '<html>Bad Gateway</html>' }]);
    await expect(cliente(c.fetchImpl, tokens()).request('GET', '/x')).rejects.toMatchObject({ status: 502, message: expect.stringMatching(/502/) });
    expect(new ApiError(500, 'x')).toBeInstanceOf(Error);
  });

  describe('corpo multipart (fotos)', () => {
    it('monta o corpo a cada tentativa — inclusive a repetida depois de renovar o token — e não define Content-Type (o fetch põe o boundary)', async () => {
      const { fetchImpl, chamadas } = criarFetchFalso([{ status: 403, body: { error: 'Token inválido ou expirado', code: 'token_expirado' } }, { status: 201, body: { id: 5 } }]);
      const formulario = jest.fn(async () => ({ marca: 'corpo-multipart' }) as unknown as FormData);
      const r = await cliente(fetchImpl, tokens()).request('POST', '/os/1/fotos', { formulario, idempotencyKey: 'chave-foto-1' });
      expect(r).toEqual({ id: 5 });
      expect(formulario).toHaveBeenCalledTimes(2);
      expect(chamadas[0].headers['Content-Type']).toBeUndefined();
      expect(chamadas[0].headers['Idempotency-Key']).toBe('chave-foto-1');
      expect((chamadas[1].body as unknown as { marca: string }).marca).toBe('corpo-multipart');
      expect(chamadas[1].headers.Authorization).toBe('Bearer novo');
    });
    it('se o arquivo não existe mais, o erro da montagem sobe sem chamar o servidor', async () => {
      const { fetchImpl, chamadas } = criarFetchFalso([{ status: 201 }]);
      const formulario = async () => { throw new ArquivoAusenteError(); };
      await expect(cliente(fetchImpl, tokens()).request('POST', '/os/1/fotos', { formulario })).rejects.toBeInstanceOf(ArquivoAusenteError);
      expect(chamadas).toHaveLength(0);
    });
  });
});
