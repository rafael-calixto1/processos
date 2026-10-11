/**
 * Rota do trecho contra o backend REAL (banco de teste): marcada sem sinal, ela vai na fila só com os pontos e chega ao servidor
 * (com o caminho traçado se o serviço de rotas responder, ou em linha reta se não). Rode com `npm run test:integracao`.
 */
import { ApiError } from '@/api/erros';
import type { RotaTrecho } from '@/domain/trecho';
import { ErroOperacao, iniciarOS, registrarLancamento } from '@/sync/operacoes';
import { criarApp, criarCenario, escritorio, quando } from './apoio';

jest.setTimeout(90_000);

const pt = (i: number) => ({ lat: -23.5 - i * 0.001, lng: -46.3 - i * 0.001 });
const reta = (n: number): RotaTrecho => ({ pontos: Array.from({ length: n }, (_, i) => pt(i)), metros: 1234, caminho: [] });
const guardada = async (osId: number) => ((await escritorio('admin', 'GET', `/os/${osId}`)).corpo.servicos as Array<{ rota_trecho: RotaTrecho | null }>).at(-1)!.rota_trecho;

quando('rota do trecho × backend real', () => {
  it('marcada sem sinal (só os pontos), chega ao servidor ao reconectar com todos os pontos; tracejado só se o serviço de rotas responder', async () => {
    const c = await criarCenario({ metros: 400 });
    const app = await criarApp();
    await app.baixar();
    app.rede.estado.online = false;
    await iniciarOS(app.ctx, c.osId);
    await registrarLancamento(app.ctx, { osId: c.osId, descricao: 'Lançamento com trecho', trecho: 'PL-1 → PL-4', rota: reta(4), itens: [{ chaveGrupo: `l${c.cabo.loteId}`, quantidade: '50' }] });
    expect((await app.estado()).visao.posse.find((p) => p.lote_id === c.cabo.loteId)?.reservado).toBe(50);

    app.rede.estado.online = true;
    await app.drenar();
    const r = (await guardada(c.osId))!;
    expect(r.pontos).toHaveLength(4);
    expect(r.metros).toBeGreaterThan(0);
    // com internet de verdade o servidor traça pelas ruas (o app o consulta antes de enviar); sem ela fica em linha reta. Nos dois casos os pontos chegam.
    expect(Array.isArray(r.caminho)).toBe(true);
    const chamadaRota = app.rede.chamadas.find((x) => x.url.includes('/geo/rota'));
    expect(chamadaRota).toBeDefined(); // o app tentou traçar antes de enviar
  });

  it('25 pontos chegam inteiros; 26 nem entram na fila (o app explica)', async () => {
    const c = await criarCenario({ metros: 400 });
    const app = await criarApp();
    await app.baixar();
    await iniciarOS(app.ctx, c.osId);
    const e = await registrarLancamento(app.ctx, { osId: c.osId, descricao: 'Trecho longo', trecho: 'A → B', rota: reta(25), itens: [{ chaveGrupo: `l${c.cabo.loteId}`, quantidade: '10' }] });
    expect(e.tipo).toBe('lancamento');
    await app.drenar();
    expect((await guardada(c.osId))!.pontos).toHaveLength(25);
    await expect(registrarLancamento(app.ctx, { osId: c.osId, descricao: 'Trecho longo demais', trecho: 'A → B', rota: reta(26), itens: [{ chaveGrupo: `l${c.cabo.loteId}`, quantidade: '10' }] })).rejects.toBeInstanceOf(ErroOperacao);
  });

  it('o serviço /geo/rota recusa ponto fora da via ou pontos demais com mensagem em português', async () => {
    const app = await criarApp();
    await expect(app.api.rotaPorVias([pt(0)])).rejects.toMatchObject({ status: 400, message: 'Pontos inválidos' });
    await expect(app.api.rotaPorVias(Array.from({ length: 26 }, (_, i) => pt(i)))).rejects.toBeInstanceOf(ApiError);
  });
});
