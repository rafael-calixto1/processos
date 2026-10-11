/**
 * Integração com o backend REAL (banco de teste): cliente HTTP + sessão + sincronização + SQLite, sem celular.
 * Só roda com a variável API_URL definida; sem ela os testes são ignorados.
 *
 *   API_URL=http://localhost:5998/api API_EMAIL=joao@exemplo.com API_SENHA=senha123 API_ADMIN_EMAIL=admin@exemplo.com npx jest tests/integracao
 */
import { ApiClient } from '@/api/client';
import { criarApi } from '@/api/endpoints';
import { ApiError, NetworkError } from '@/api/erros';
import { armazenamentoEmMemoria } from '@/auth/armazenamento';
import { GerenciadorSessao } from '@/auth/gerenciadorSessao';
import { lerDados } from '@/db/repositorio';
import { agrupar } from '@/domain/posse';
import { criarBancoDeTeste } from '@/testing/bancoNode';
import { fetchNode } from '@/testing/fetchNode';
import { garantirDono, iniciarExecucao, sincronizar } from '@/sync/sincronizar';
import { criarCenario } from './apoio';

const { API_URL, API_EMAIL = 'joao@exemplo.com', API_SENHA = 'senha123', API_ADMIN_EMAIL = 'admin@exemplo.com' } = process.env;
const quando = API_URL ? describe : describe.skip;

const montar = (baseUrl = API_URL!) => {
  const armazenamento = armazenamentoEmMemoria();
  const ref: { g?: GerenciadorSessao } = {};
  const cliente = new ApiClient({ baseUrl: () => baseUrl, tokens: { tokenDeAcesso: () => ref.g!.tokenDeAcesso(), renovar: () => ref.g!.renovar(), sessaoPerdida: () => ref.g!.sessaoPerdida() }, fetchImpl: fetchNode, timeoutMs: 8000 });
  const api = criarApi(cliente);
  const g = new GerenciadorSessao({ armazenamento, api: () => api, dispositivo: () => 'jest · integração' });
  ref.g = g;
  return { g, api, cliente, armazenamento };
};

quando('app × backend real', () => {
  it('perfil que não é técnico não entra no app (e nada fica guardado)', async () => {
    const { g, armazenamento } = montar();
    await expect(g.entrar(API_ADMIN_EMAIL, API_SENHA)).rejects.toMatchObject({ status: 403, message: 'Este aplicativo é exclusivo para técnicos' });
    expect(armazenamento.dados.size).toBe(0);
  });

  it('senha errada: mensagem do servidor, sem sessão', async () => {
    const { g } = montar();
    await expect(g.entrar(API_EMAIL, 'senha-errada')).rejects.toMatchObject({ status: 401, message: 'Email ou senha inválidos' });
    expect(g.getEstado().status).not.toBe('logado');
  });

  it('login → bootstrap → espelho SQLite → posse agrupada → iniciar → refresh automático → sair', async () => {
    const cenario = await criarCenario({ metros: 800 }); // OS e estoque próprios: os outros testes mexem na mesma base ao mesmo tempo
    const { g, api, cliente } = montar();
    const { banco } = await criarBancoDeTeste();

    const usuario = await g.entrar(API_EMAIL, API_SENHA);
    expect(usuario.role).toBe('tecnico');
    await garantirDono(banco, usuario.id);

    // sincroniza e lê do SQLite: o que o app mostraria offline
    await sincronizar(api, banco, { usuarioId: usuario.id });
    const dados = (await lerDados(banco))!;
    expect(dados.tecnico.nome).toBe('João Técnico');
    expect(dados.os.length).toBeGreaterThan(0);
    const aberta = dados.os.find((o) => o.id === cenario.osId)!;
    expect(aberta).toMatchObject({ status: 'aberta', poste_id: 'PL-0932' });
    expect(typeof aberta.latitude).toBe('number');
    expect(aberta.prazo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dados.motivos.map((m) => m.codigo)).toContain('route_launched');
    expect(dados.checklist.filter((c) => c.obrigatorio).length).toBe(6);
    expect(dados.regras.fotos_min).toBe(1);
    const grupo = agrupar(dados.posse).find((x) => x.key === `l${cenario.cabo.loteId}`);
    expect(grupo).toMatchObject({ item_nome: 'Cabo óptico ASU 12F', unidade: 'metros', quantidade: 800, lote_codigo: cenario.cabo.codigo });

    // token de acesso inválido (como se tivesse vencido): o cliente renova sozinho e a chamada funciona
    const refreshAntes = (g as unknown as { refresh: string }).refresh;
    (g as unknown as { access: string }).access = 'token.invalido.x';
    const os = await iniciarExecucao(api, banco, aberta.id, { novaChave: () => `jest-${Date.now()}-a` });
    expect(os.status).toBe('em_andamento');
    expect(g.tokenDeAcesso()).not.toBe('token.invalido.x');
    expect((g as unknown as { refresh: string }).refresh).not.toBe(refreshAntes); // o refresh token foi trocado (rotação)
    expect(g.getEstado().status).toBe('logado');
    expect((await lerDados(banco))!.os.find((o) => o.id === aberta.id)?.status).toBe('em_andamento');

    // iniciar de novo é idempotente: mesmo horário de início, marcado como repetido
    const de_novo = await api.iniciarOS(aberta.id, new Date().toISOString(), `jest-${Date.now()}-b`);
    expect(de_novo.iniciado_em).toBe(os.iniciado_em);
    expect(de_novo.repetida).toBe(true);

    // sair revoga a sessão no servidor: o refresh token antigo deixa de valer
    const refreshAntigo = (g as unknown as { refresh: string }).refresh;
    await g.sair();
    expect(g.getEstado()).toEqual({ status: 'deslogado', motivo: 'saiu' });
    await expect(api.renovar(refreshAntigo, 'jest')).rejects.toMatchObject({ status: 401 });
    expect(cliente).toBeTruthy();
  });

  it('um técnico não consegue iniciar OS de outro (403 de regra, sem derrubar a sessão)', async () => {
    const { g, api } = montar();
    await g.entrar(API_EMAIL, API_SENHA);
    await expect(api.iniciarOS(999999, new Date().toISOString(), `jest-${Date.now()}-c`)).rejects.toMatchObject({ status: 404 });
    expect(g.getEstado().status).toBe('logado');
  });

  it('servidor inalcançável: erro de rede, e a sessão guardada continua válida', async () => {
    const { g } = montar();
    await g.entrar(API_EMAIL, API_SENHA);
    const fora = montar('http://127.0.0.1:9/api'); // porta fechada
    await expect(fora.api.bootstrap()).rejects.toBeInstanceOf(NetworkError);
    expect(g.getEstado().status).toBe('logado');
    expect(ApiError).toBeTruthy();
  });
});
