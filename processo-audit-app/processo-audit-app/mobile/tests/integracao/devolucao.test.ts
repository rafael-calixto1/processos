/**
 * Devolução de material contra o backend REAL (banco de teste): o técnico pede sem sinal, o pedido sai com a rede instável sem
 * duplicar, o estoque aprova/nega e o app mostra a decisão. Rode com `npm run test:integracao`.
 */
import { listarTodas } from '@/db/outbox';
import { devolucoesDoTecnico } from '@/domain/visao';
import { descartarOperacao, solicitarDevolucao } from '@/sync/operacoes';
import { criarApp, criarCenario, escritorio, quando, SEMENTE } from './apoio';

jest.setTimeout(60_000);

type Pedido = { id: number; lote_id: number; quantidade: number; condicao: string; status: string; motivo_negacao: string | null; tecnico_id: number };
const pedidosDoJoao = async (loteIds: number[]): Promise<Pedido[]> =>
  ((await escritorio('estoque', 'GET', '/estoque/devolucoes')).corpo as Pedido[]).filter((p) => p.tecnico_id === SEMENTE.ids.joao && loteIds.includes(p.lote_id));
const posseServidor = async (loteId: number): Promise<number> => {
  const ficha = (await escritorio('estoque', 'GET', `/estoque/posse/${SEMENTE.ids.joao}`)).corpo;
  return ficha.itens.find((i: { lote_id: number }) => i.lote_id === loteId)?.quantidade ?? 0;
};

quando('devolução × backend real', () => {
  it('pede SEM sinal, envia com a resposta perdida sem duplicar, e mostra a aprovação e a negação do estoque', async () => {
    const c1 = await criarCenario({ metros: 400 });
    const c2 = await criarCenario({ metros: 250 });
    const lotes = [c1.cabo.loteId, c2.cabo.loteId];
    const app = await criarApp();
    await app.baixar();

    // ── sem rede: o pedido vira fila e o material fica separado na hora ──
    app.rede.estado.online = false;
    const ops = await solicitarDevolucao(app.ctx, { itens: [
      { chaveGrupo: `l${c1.cabo.loteId}`, quantidade: '100', condicao: 'usado' },
      { chaveGrupo: `l${c2.cabo.loteId}`, quantidade: '60,5', condicao: 'novo' },
    ], observacao: 'sobra da obra' });
    expect(ops).toHaveLength(2);
    const v = (await app.estado()).visao;
    expect(v.posse.find((p) => p.lote_id === c1.cabo.loteId)).toMatchObject({ quantidade: 300, emDevolucao: 100 });
    expect(v.posse.find((p) => p.lote_id === c2.cabo.loteId)).toMatchObject({ quantidade: 189.5, emDevolucao: 60.5 });
    expect(await app.motor.executar()).toMatchObject({ enviadas: 0, semConexao: true });
    expect(await pedidosDoJoao(lotes)).toEqual([]); // nada chegou ao servidor
    app.relogio.avancar(60_000);

    // ── a rede volta mas a resposta do 1º pedido se perde: o servidor já abriu a solicitação ──
    app.rede.estado.online = true;
    app.rede.estado.perderRespostaDe = /\/estoque\/devolucoes$/;
    expect((await app.motor.executar()).semConexao).toBe(true);
    expect(await pedidosDoJoao(lotes)).toHaveLength(1);

    // ── o app reenvia com a mesma chave: sem segunda solicitação ──
    await app.drenar();
    const pedidos = (await pedidosDoJoao(lotes)).sort((a, b) => a.id - b.id);
    expect(pedidos.map((p) => [p.lote_id, p.quantidade, p.condicao, p.status])).toEqual([[c1.cabo.loteId, 100, 'usado', 'pendente'], [c2.cabo.loteId, 60.5, 'novo', 'pendente']]);
    const doApp = (await listarTodas(app.banco, app.usuario.id)).filter((o) => o.tipo === 'devolucao');
    expect(doApp.map((o) => o.estado)).toEqual(['ok', 'ok']);
    expect(doApp[0].resposta).toMatchObject({ repetida: true });
    expect(await posseServidor(c1.cabo.loteId)).toBe(400); // até o estoque aprovar, o saldo não muda

    // ── o estoque nega o 1º (com motivo) e aprova o 2º ──
    expect((await escritorio('estoque', 'POST', `/estoque/devolucoes/${pedidos[0].id}/negar`, { motivo: 'Cabo com a capa danificada' })).status).toBe(200);
    expect((await escritorio('estoque', 'POST', `/estoque/devolucoes/${pedidos[1].id}/aprovar`, { condicao: 'usado' })).status).toBe(200);

    await app.baixar();
    const e = await app.estado();
    const lista = devolucoesDoTecnico(e.dados.devolucoes.filter((d) => lotes.includes(d.lote_id)), e.ops);
    expect(lista.map((d) => [d.lote_codigo, d.quantidade, d.estado]).sort()).toEqual([[c1.cabo.codigo, 100, 'negada'], [c2.cabo.codigo, 60.5, 'aprovada']].sort());
    expect(lista.find((d) => d.estado === 'negada')?.motivoNegacao).toBe('Cabo com a capa danificada');
    // negada: o cabo volta a estar todo disponível; aprovada: saiu da posse
    expect(e.visao.posse.find((p) => p.lote_id === c1.cabo.loteId)).toMatchObject({ quantidade: 400 });
    expect(e.visao.posse.find((p) => p.lote_id === c1.cabo.loteId)?.emDevolucao).toBeUndefined();
    expect(e.visao.posse.find((p) => p.lote_id === c2.cabo.loteId)).toMatchObject({ quantidade: 189.5 });
    expect(await posseServidor(c2.cabo.loteId)).toBe(189.5);
  });

  it('o servidor recusa por posse (o estoque mexeu enquanto o técnico estava sem sinal): vira "requer atenção" com a mensagem e, descartada, o material volta', async () => {
    const c = await criarCenario({ metros: 400 });
    const app = await criarApp();
    await app.baixar();

    app.rede.estado.online = false;
    const [op] = await solicitarDevolucao(app.ctx, { itens: [{ chaveGrupo: `l${c.cabo.loteId}`, quantidade: '300', condicao: 'novo' }] });
    // enquanto isso o estoque registra uma devolução direta de 250 m do João (a posse cai para 150)
    expect((await escritorio('estoque', 'POST', '/estoque/devolucoes', { lote_id: c.cabo.loteId, tecnico_id: SEMENTE.ids.joao, quantidade: 250, condicao: 'usado' })).status).toBe(201);

    app.rede.estado.online = true;
    app.relogio.avancar(60_000);
    expect((await app.motor.executar()).atencao).toBe(1);
    const parada = (await listarTodas(app.banco, app.usuario.id)).find((o) => o.id === op.id)!;
    expect(parada).toMatchObject({ estado: 'atencao', erro: { status: 400, mensagem: expect.stringMatching(/apenas 150/) } });
    expect((await pedidosDoJoao([c.cabo.loteId])).filter((p) => p.status === 'pendente')).toEqual([]); // nada foi aberto
    expect((await app.estado()).visao.posse.find((p) => p.lote_id === c.cabo.loteId)?.emDevolucao).toBe(300); // continua separado até o técnico decidir

    await descartarOperacao(app.ctx, op.id);
    await app.baixar();
    expect((await app.estado()).visao.posse.find((p) => p.lote_id === c.cabo.loteId)).toMatchObject({ quantidade: 150 });
  });
});
