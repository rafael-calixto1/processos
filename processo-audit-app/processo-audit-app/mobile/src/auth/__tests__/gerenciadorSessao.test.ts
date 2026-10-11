import { ApiClient } from '@/api/client';
import { ApiError, NetworkError } from '@/api/erros';
import { criarApi, type Api, type Sessao } from '@/api/endpoints';
import { criarFetchFalso } from '@/testing/servidorFalso';
import { armazenamentoEmMemoria } from '../armazenamento';
import { GerenciadorSessao } from '../gerenciadorSessao';

const sessao = (n: number, role = 'tecnico'): Sessao => ({ token: `acesso-${n}`, refresh_token: `refresh-${n}`, expires_in: 900, user: { id: 7, email: 'joao@exemplo.com', name: 'João', role } });

const montar = (api: Partial<Api>, inicial: Record<string, string> = {}) => {
  const armazenamento = armazenamentoEmMemoria(inicial);
  const sets: string[] = [];
  const set = armazenamento.set; armazenamento.set = async (k, v) => { sets.push(k); await set(k, v); };
  const g = new GerenciadorSessao({ armazenamento, api: () => api as Api, dispositivo: () => 'Teste 1' });
  return { g, armazenamento, sets };
};
const logado = { 'os.sessao.access': 'acesso-0', 'os.sessao.refresh': 'refresh-0', 'os.sessao.usuario': JSON.stringify(sessao(0).user) };

describe('GerenciadorSessao', () => {
  it('entrar guarda os tokens no cofre e muda para logado', async () => {
    const login = jest.fn(async () => sessao(1));
    const { g, armazenamento } = montar({ login });
    const estados: string[] = []; g.assinar(() => estados.push(g.getEstado().status));
    await g.entrar('  joao@exemplo.com ', 'segredo');
    expect(login).toHaveBeenCalledWith('joao@exemplo.com', 'segredo', 'Teste 1');
    expect(g.getEstado()).toEqual({ status: 'logado', usuario: sessao(1).user });
    expect(g.tokenDeAcesso()).toBe('acesso-1');
    expect(armazenamento.dados.get('os.sessao.refresh')).toBe('refresh-1');
    expect(estados).toEqual(['logado']);
  });

  it('recusa quem não é técnico, sem guardar nada', async () => {
    const { g, armazenamento } = montar({ login: async () => sessao(1, 'admin') });
    await expect(g.entrar('a@b.c', 'x')).rejects.toMatchObject({ status: 403, message: 'Este aplicativo é exclusivo para técnicos' });
    expect(armazenamento.dados.size).toBe(0);
    expect(g.getEstado().status).not.toBe('logado');
  });

  it('erro de login (senha errada, 429) sobe com a mensagem do servidor e não guarda nada', async () => {
    const { g, armazenamento } = montar({ login: async () => { throw new ApiError(401, 'Email ou senha inválidos'); } });
    await expect(g.entrar('a@b.c', 'x')).rejects.toThrow('Email ou senha inválidos');
    expect(armazenamento.dados.size).toBe(0);
  });

  it('restaurar: com tokens volta logado (mesmo com o acesso vencido); sem eles ou corrompido fica deslogado e limpo', async () => {
    const a = montar({}, logado); await a.g.restaurar();
    expect(a.g.getEstado().status).toBe('logado');
    const b = montar({}); await b.g.restaurar();
    expect(b.g.getEstado()).toEqual({ status: 'deslogado' });
    const c = montar({}, { ...logado, 'os.sessao.usuario': '{quebrado' }); await c.g.restaurar();
    expect(c.g.getEstado().status).toBe('deslogado');
    expect(c.armazenamento.dados.size).toBe(0);
  });

  it('renovar troca o par e grava o refresh ANTES do acesso', async () => {
    const renovar = jest.fn(async () => sessao(1));
    const { g, armazenamento, sets } = montar({ renovar }, logado); await g.restaurar();
    expect(await g.renovar()).toBe(true);
    expect(renovar).toHaveBeenCalledWith('refresh-0', 'Teste 1');
    expect(g.tokenDeAcesso()).toBe('acesso-1');
    expect(armazenamento.dados.get('os.sessao.refresh')).toBe('refresh-1');
    expect(sets.slice(0, 2)).toEqual(['os.sessao.refresh', 'os.sessao.access']);
  });

  it('renovações simultâneas viram uma só chamada ao servidor', async () => {
    let n = 0;
    const renovar = jest.fn(async () => { await new Promise((r) => setTimeout(r, 20)); return sessao(++n); });
    const { g } = montar({ renovar }, logado); await g.restaurar();
    expect(await Promise.all([g.renovar(), g.renovar(), g.renovar(), g.renovar()])).toEqual([true, true, true, true]);
    expect(renovar).toHaveBeenCalledTimes(1);
    expect(await g.renovar()).toBe(true); // depois que acabou, uma nova renovação é permitida
    expect(renovar).toHaveBeenCalledTimes(2);
  });

  it('servidor recusou (401/403) = false; sem rede, 429 e 5xx = erro, e a sessão e os tokens continuam intactos', async () => {
    for (const status of [401, 403]) {
      const { g } = montar({ renovar: async () => { throw new ApiError(status, 'Sessão inválida. Entre novamente.'); } }, logado); await g.restaurar();
      expect(await g.renovar()).toBe(false);
    }
    for (const erro of [new NetworkError(), new ApiError(429, 'Muitas tentativas'), new ApiError(500, 'Erro interno')]) {
      const { g, armazenamento } = montar({ renovar: async () => { throw erro; } }, logado); await g.restaurar();
      await expect(g.renovar()).rejects.toBe(erro);
      expect(g.getEstado().status).toBe('logado');
      expect(armazenamento.dados.get('os.sessao.refresh')).toBe('refresh-0');
    }
  });

  it('sem refresh token não há o que renovar', async () => {
    const { g } = montar({}); await g.restaurar();
    expect(await g.renovar()).toBe(false);
  });

  it('sessaoPerdida volta ao login com motivo "expirada" e limpa o cofre; repetir não faz nada', async () => {
    const { g, armazenamento } = montar({}, logado); await g.restaurar();
    let avisos = 0; g.assinar(() => { avisos++; });
    g.sessaoPerdida();
    await new Promise((r) => setTimeout(r, 0));
    expect(g.getEstado()).toEqual({ status: 'deslogado', motivo: 'expirada' });
    expect(armazenamento.dados.size).toBe(0);
    g.sessaoPerdida();
    expect(avisos).toBe(1);
  });

  it('sair avisa o servidor, mas funciona mesmo sem internet', async () => {
    const sair = jest.fn(async () => ({ message: 'ok' }));
    const a = montar({ sair }, logado); await a.g.restaurar(); await a.g.sair();
    expect(sair).toHaveBeenCalledWith('refresh-0');
    expect(a.g.getEstado()).toEqual({ status: 'deslogado', motivo: 'saiu' });
    expect(a.armazenamento.dados.size).toBe(0);
    const b = montar({ sair: async () => { throw new NetworkError(); } }, logado); await b.g.restaurar(); await b.g.sair();
    expect(b.g.getEstado()).toEqual({ status: 'deslogado', motivo: 'saiu' });
    expect(b.armazenamento.dados.size).toBe(0);
  });
});

describe('cliente + sessão juntos', () => {
  it('cinco requisições com o token vencido geram UMA renovação e todas funcionam com o token novo', async () => {
    let renovacoes = 0;
    const { fetchImpl, chamadas } = criarFetchFalso((c) => {
      if (c.url.endsWith('/auth/refresh')) { renovacoes++; return { status: 200, body: sessao(1), atraso: 15 }; }
      return c.headers.Authorization === 'Bearer acesso-1'
        ? { status: 200, body: { ok: true } }
        : { status: 403, body: { error: 'Token inválido ou expirado', code: 'token_expirado' } };
    });
    const ref: { g?: GerenciadorSessao } = {};
    const cliente = new ApiClient({ baseUrl: () => 'http://srv/api', tokens: { tokenDeAcesso: () => ref.g!.tokenDeAcesso(), renovar: () => ref.g!.renovar(), sessaoPerdida: () => ref.g!.sessaoPerdida() }, fetchImpl });
    const api = criarApi(cliente);
    ref.g = new GerenciadorSessao({ armazenamento: armazenamentoEmMemoria(logado), api: () => api, dispositivo: () => 'Teste 1' });
    await ref.g.restaurar();

    const resultados = await Promise.all(Array.from({ length: 5 }, () => cliente.request('GET', '/os')));
    expect(resultados).toEqual(Array(5).fill({ ok: true }));
    expect(renovacoes).toBe(1);
    expect(chamadas.filter((c) => c.url.endsWith('/os'))).toHaveLength(10); // 5 recusadas + 5 repetidas
    expect(ref.g.getEstado().status).toBe('logado');
  });

  it('offline com o token vencido: a chamada falha com erro de rede e o técnico continua logado', async () => {
    const { fetchImpl } = criarFetchFalso((c) => (c.url.endsWith('/auth/refresh')
      ? { status: 0, erro: new TypeError('Network request failed') }
      : { status: 403, body: { error: 'Token inválido ou expirado', code: 'token_expirado' } }));
    const ref: { g?: GerenciadorSessao } = {};
    const cliente = new ApiClient({ baseUrl: () => 'http://srv/api', tokens: { tokenDeAcesso: () => ref.g!.tokenDeAcesso(), renovar: () => ref.g!.renovar(), sessaoPerdida: () => ref.g!.sessaoPerdida() }, fetchImpl });
    const api = criarApi(cliente);
    ref.g = new GerenciadorSessao({ armazenamento: armazenamentoEmMemoria(logado), api: () => api, dispositivo: () => 'Teste 1' });
    await ref.g.restaurar();
    await expect(cliente.request('GET', '/os')).rejects.toBeInstanceOf(NetworkError);
    expect(ref.g.getEstado().status).toBe('logado');
  });
});
