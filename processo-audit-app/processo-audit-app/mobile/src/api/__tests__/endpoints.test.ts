import { ApiClient } from '../client';
import { criarApi, TIMEOUT_UPLOAD_MS } from '../endpoints';
import { criarFetchFalso } from '@/testing/servidorFalso';

const montar = (respostas: Parameters<typeof criarFetchFalso>[0] = [{ status: 200, body: {} }], criarFormulario?: Parameters<typeof criarApi>[1]) => {
  const f = criarFetchFalso(respostas);
  const cliente = new ApiClient({ baseUrl: () => 'http://srv/api', tokens: { tokenDeAcesso: () => 't', renovar: async () => true, sessaoPerdida: () => undefined }, fetchImpl: f.fetchImpl });
  return { api: criarApi(cliente, criarFormulario), ...f };
};

describe('endpoints da fase 3', () => {
  it('lançamento: POST /os/:id/lancamentos com o corpo e a Idempotency-Key', async () => {
    const { api, chamadas } = montar();
    const corpo = { descricao: 'Lançamento', trecho: 'A → B', materiais: [{ lote_id: 11, quantidade: 350.5 }] };
    await api.lancar(102, corpo, 'chave-lanc-1');
    expect(chamadas[0]).toMatchObject({ url: 'http://srv/api/os/102/lancamentos', method: 'POST' });
    expect(chamadas[0].headers['Idempotency-Key']).toBe('chave-lanc-1');
    expect(JSON.parse(chamadas[0].body!)).toEqual(corpo);
  });
  it('finalizar: POST /os/:id/finalizar com a Idempotency-Key', async () => {
    const { api, chamadas } = montar();
    await api.finalizar(102, { client_uuid: 'u' } as never, 'chave-fin-1');
    expect(chamadas[0]).toMatchObject({ url: 'http://srv/api/os/102/finalizar', method: 'POST' });
    expect(chamadas[0].headers['Idempotency-Key']).toBe('chave-fin-1');
  });
  it('rascunho: PUT /os/:id/rascunho com { rascunho }, sem chave (já é idempotente)', async () => {
    const { api, chamadas } = montar();
    await api.salvarRascunho(102, { versao: 2, origem: 'mobile' });
    expect(chamadas[0]).toMatchObject({ url: 'http://srv/api/os/102/rascunho', method: 'PUT' });
    expect(JSON.parse(chamadas[0].body!)).toEqual({ rascunho: { versao: 2, origem: 'mobile' } });
    expect(chamadas[0].headers['Idempotency-Key']).toBeUndefined();
  });
  it('remover foto: DELETE /os/:id/fotos/:fotoId; detalhe: GET /os/:id', async () => {
    const { api, chamadas } = montar();
    await api.removerFoto(102, 9); await api.detalheOS(102);
    expect(chamadas.map((c) => `${c.method} ${c.url}`)).toEqual(['DELETE http://srv/api/os/102/fotos/9', 'GET http://srv/api/os/102']);
  });
  it('foto: multipart montado só na hora do envio, com a chave e um prazo longo para rede ruim', async () => {
    const criarFormulario = jest.fn(async () => ({ marca: 'form' }) as unknown as FormData);
    const { api, chamadas } = montar([{ status: 201, body: { id: 1 } }], { criarFormulario });
    const arquivo = { uri: 'file:///a.jpg', nome: 'a.jpg', mime: 'image/jpeg' };
    await api.enviarFoto(102, arquivo, { client_uuid: 'u1' }, 'chave-foto-1');
    expect(criarFormulario).toHaveBeenCalledWith({ client_uuid: 'u1' }, arquivo);
    expect(chamadas[0]).toMatchObject({ url: 'http://srv/api/os/102/fotos', method: 'POST' });
    expect(chamadas[0].headers['Idempotency-Key']).toBe('chave-foto-1');
    expect(chamadas[0].headers['Content-Type']).toBeUndefined();
    expect(TIMEOUT_UPLOAD_MS).toBeGreaterThanOrEqual(60_000);
  });
  it('foto sem montador de formulário configurado falha com mensagem clara em vez de enviar vazio', () => {
    const { api } = montar();
    expect(() => api.enviarFoto(102, { uri: 'x', nome: 'x', mime: 'image/jpeg' }, {}, 'chave-x-12345')).toThrow(/não configurado/);
  });
});
