/**
 * Ficha de movimentações contra o backend REAL (banco de teste): o que o servidor entrega é lido, normalizado e agrupado pelo app
 * com retirada, baixas por OS, devolução aprovada e SEM o estorno. Rode com `npm run test:integracao`.
 */
import { agruparFicha, normalizarFicha, posseDetalhada } from '@/domain/ficha';
import { registrarLancamento, iniciarOS, solicitarDevolucao } from '@/sync/operacoes';
import { criarApp, criarCenario, escritorio, movimentacoes, quando } from './apoio';

jest.setTimeout(60_000);

quando('ficha × backend real', () => {
  it('retirada, baixas por OS e devolução aprovada aparecem agrupadas; a baixa estornada e o estorno não', async () => {
    const c = await criarCenario({ metros: 400 });
    const app = await criarApp();
    await app.baixar();
    await iniciarOS(app.ctx, c.osId);
    await registrarLancamento(app.ctx, { osId: c.osId, descricao: 'Lançamento A', trecho: 'PL-1 → PL-2', itens: [{ chaveGrupo: `l${c.cabo.loteId}`, quantidade: '120' }] });
    await registrarLancamento(app.ctx, { osId: c.osId, descricao: 'Lançamento B', trecho: 'PL-2 → PL-3', itens: [{ chaveGrupo: `l${c.cabo.loteId}`, quantidade: '80' }] });
    await app.drenar();
    const baixas = (await movimentacoes(c.osId)).filter((m) => m.tipo === 'baixa_os');
    expect(baixas.map((b) => b.quantidade)).toEqual([120, 80]);

    // o estoque estorna a baixa de 80 m
    expect((await escritorio('estoque', 'POST', `/os/${c.osId}/estornos`, { movimentacao_id: baixas[1].id, motivo: 'Lançado por engano' })).status).toBe(201);
    // e o técnico devolve 50 m, aprovados pelo estoque
    await app.baixar();
    const [dev] = await solicitarDevolucao(app.ctx, { itens: [{ chaveGrupo: `l${c.cabo.loteId}`, quantidade: '50', condicao: 'usado' }], observacao: 'sobra' });
    await app.drenar();
    const pedidos = (await escritorio('estoque', 'GET', '/estoque/devolucoes?status=pendente')).corpo as Array<{ id: number; lote_id: number }>;
    const meu = pedidos.find((p) => p.lote_id === c.cabo.loteId)!;
    expect((await escritorio('estoque', 'POST', `/estoque/devolucoes/${meu.id}/aprovar`, {})).status).toBe(200);
    expect(dev.tipo).toBe('devolucao');

    // o que o app lê do servidor
    const ficha = normalizarFicha(await app.api.minhaFicha())!;
    expect(ficha).not.toBeNull();
    expect(ficha.tecnico.nome).toBe('João Técnico');
    const { validas, grupos } = agruparFicha(ficha.historico.filter((m) => m.lote_id === c.cabo.loteId));
    expect(ficha.historico.some((m) => m.tipo === 'estorno' && m.lote_id === c.cabo.loteId)).toBe(true); // o servidor entrega o estorno bruto…
    expect(validas.some((m) => m.tipo === 'estorno')).toBe(false); // …e o app o esconde, junto com a baixa estornada
    expect(validas.map((m) => [m.tipo, m.quantidade]).sort()).toEqual([['baixa_os', 120], ['devolucao', 50], ['retirada', 400]].sort());
    expect(grupos).toHaveLength(3);
    expect(typeof validas[0].quantidade).toBe('number');

    const [posse] = posseDetalhada(ficha.itens.filter((i) => i.lote_id === c.cabo.loteId), validas);
    // recebido 400; usado 120 (a baixa de 80 foi estornada e some); em posse 230 = 400 - 120 - 80 + 80 (estorno devolve ao técnico) - 50 (devolução aprovada)
    expect(posse).toMatchObject({ recebido: 400, usado: 120, quantidade: 230 });
    expect(posse.porOS).toEqual([{ os_id: c.osId, os_numero: c.osNumero, quantidade: 120 }]);
  });
});
