import { criarBootstrap, criarOS } from '@/testing/fixtures';
import type { Dados, DetalheOS } from '../tipos';
import type { Operacao } from '../operacoes';
import { agrupar, distribuirEntreLotes } from '../posse';
import { aplicarPendencias, lancamentosComMaterial, lancamentosDaOS, reservaPorLote } from '../visao';

const dadosDe = (b = criarBootstrap()): Dados => ({
  geradoEm: b.gerado_em, tecnico: b.tecnico, os: b.os, posse: b.posse, motivos: b.motivos, checklist: b.checklist,
  sugestoesServicos: b.sugestoes_servicos, tiposServico: b.tipos_servico, tecnicos: b.tecnicos, itens: b.itens, regras: b.regras,
});

let seq = 0;
const op = <T extends Operacao['tipo']>(tipo: T, osId: number, extra: Record<string, unknown> = {}): Operacao => {
  const id = ++seq;
  const payloads: Record<string, unknown> = {
    iniciar: { corpo: { iniciado_em: '2026-10-11T14:00:00.000Z' } },
    lancamento: { corpo: { descricao: 'Lançamento', trecho: 'A → B', materiais: [{ lote_id: 11, quantidade: 100 }] }, exibicao: { linhas: [{ item_nome: 'Cabo', unidade: 'metros', lote_id: 11, lote_codigo: 'LOTE-BOB-0001', quantidade: 100 }] } },
    foto: { arquivo: 'file:///a.jpg', mime: 'image/jpeg', campos: { client_uuid: 'x', tirada_em: '2026-10-11T14:00:00.000Z' } },
    remover_foto: { foto_client_uuid: 'x' },
    finalizar: { corpo: { finalizado_em: '2026-10-11T18:00:00.000Z' } },
    rascunho: { corpo: { rascunho: {} } },
  };
  return {
    id, usuario_id: 7, os_id: osId, tipo, client_uuid: `u${id}`, chave: `k${id}`, payload: payloads[tipo], depende_de: [], estado: 'pendente', tentativas: 0,
    proxima_tentativa: 0, criado_em: '2026-10-11T14:00:00.000Z', atualizado_em: '2026-10-11T14:00:00.000Z', ok_em: null, no_retrato: false, forcada: false, resposta: null,
    erro: null, os_numero: osId - 100, os_cliente: 'c', ...extra,
  } as Operacao;
};

describe('status da OS na visão', () => {
  it('iniciar pendente antecipa "em andamento" com o horário do aparelho, sem mexer no retrato', () => {
    const d = dadosDe();
    const v = aplicarPendencias(d, [op('iniciar', 102)]);
    expect(v.os.find((o) => o.id === 102)).toMatchObject({ status: 'em_andamento', iniciado_em: '2026-10-11T14:00:00.000Z' });
    expect(d.os.find((o) => o.id === 102)?.status).toBe('aberta'); // o retrato original continua intacto
  });
  it('um lançamento na fila também passa a OS aberta para em andamento (como o servidor fará)', () => {
    const v = aplicarPendencias(dadosDe(), [op('lancamento', 102)]);
    expect(v.os.find((o) => o.id === 102)?.status).toBe('em_andamento');
  });
  it('o horário de início que o servidor já tem prevalece', () => {
    const v = aplicarPendencias(dadosDe(), [op('iniciar', 101, { payload: { corpo: { iniciado_em: '2026-10-11T20:00:00.000Z' } } })]);
    expect(v.os.find((o) => o.id === 101)?.iniciado_em).toBe('2026-10-11T12:00:00.000Z');
  });
  it('OS encerrada ou cancelada no servidor nunca é "reaberta" por pendências', () => {
    const d = dadosDe(criarBootstrap({ os: [criarOS(1, { status: 'cancelada' }), criarOS(2, { status: 'concluida' })] }));
    const v = aplicarPendencias(d, [op('iniciar', 101), op('lancamento', 102)]);
    expect(v.os.map((o) => o.status)).toEqual(['cancelada', 'concluida']);
  });
  it('finalização confirmada antes do próximo retrato já mostra a OS como concluída', () => {
    const fin = op('finalizar', 102, { estado: 'ok', ok_em: 1, resposta: { finalizado_em: '2026-10-11T18:01:00.000Z' } });
    const o = aplicarPendencias(dadosDe(), [fin]).os.find((x) => x.id === 102)!;
    expect(o).toMatchObject({ status: 'concluida', concluida_em: '2026-10-11T18:01:00.000Z', finalizacao: 'enviada' });
  });
  it('finalização na fila ou em atenção mantém a OS em andamento e avisa', () => {
    expect(aplicarPendencias(dadosDe(), [op('finalizar', 101)]).os.find((x) => x.id === 101)).toMatchObject({ status: 'em_andamento', finalizacao: 'na_fila' });
    expect(aplicarPendencias(dadosDe(), [op('finalizar', 101, { estado: 'atencao' })]).os.find((x) => x.id === 101)).toMatchObject({ finalizacao: 'atencao', sync: 'erro' });
  });
  it('operação confirmada e já no retrato não altera mais nada', () => {
    const v = aplicarPendencias(dadosDe(), [op('iniciar', 102, { estado: 'ok', ok_em: 1, no_retrato: true })]);
    expect(v.os.find((o) => o.id === 102)?.status).toBe('aberta');
  });
});

describe('indicador de sincronização por OS', () => {
  const sync = (ops: Operacao[], id = 102) => aplicarPendencias(dadosDe(), ops).os.find((o) => o.id === id)!;
  it('sem pendências: sincronizado', () => expect(sync([])).toMatchObject({ sync: 'sincronizado', pendencias: 0 }));
  it('pendente ou enviando: pendente', () => {
    expect(sync([op('lancamento', 102), op('foto', 102, { estado: 'enviando' })])).toMatchObject({ sync: 'pendente', pendencias: 2 });
  });
  it('qualquer uma em atenção: erro', () => {
    expect(sync([op('lancamento', 102), op('lancamento', 102, { estado: 'atencao' })])).toMatchObject({ sync: 'erro', pendencias: 2 });
  });
  it('o backup do rascunho e as confirmadas não contam como pendência', () => {
    expect(sync([op('rascunho', 102), op('lancamento', 102, { estado: 'ok', ok_em: 1 })])).toMatchObject({ sync: 'sincronizado', pendencias: 0 });
  });
  it('só considera as operações da própria OS', () => {
    expect(sync([op('lancamento', 103)])).toMatchObject({ sync: 'sincronizado' });
  });
});

describe('posse reservada', () => {
  const posseDe = (v: ReturnType<typeof aplicarPendencias>, lote: number) => v.posse.find((p) => p.lote_id === lote)!;
  it('lançamento na fila desconta do saldo exibido e mostra quanto está reservado', () => {
    const v = aplicarPendencias(dadosDe(), [op('lancamento', 101)]);
    expect(posseDe(v, 11)).toMatchObject({ quantidade: 349.5, reservado: 100 });
    expect(posseDe(v, 21)).toMatchObject({ quantidade: 30 }); // lote sem reserva não muda
    expect(posseDe(v, 21).reservado).toBeUndefined();
  });
  it('vários lançamentos somam a reserva (não dá para usar o mesmo material duas vezes sem sinal)', () => {
    const v = aplicarPendencias(dadosDe(), [op('lancamento', 101), op('lancamento', 102, { estado: 'enviando' })]);
    expect(posseDe(v, 11)).toMatchObject({ quantidade: 249.5, reservado: 200 });
  });
  it('lançamento em ATENÇÃO continua reservando até ser corrigido ou removido', () => {
    const v = aplicarPendencias(dadosDe(), [op('lancamento', 101, { estado: 'atencao' })]);
    expect(posseDe(v, 11)).toMatchObject({ quantidade: 349.5, reservado: 100 });
  });
  it('confirmado mas ainda fora do retrato continua reservando; depois que o retrato o inclui, para', () => {
    const confirmada = { estado: 'ok' as const, ok_em: 5 };
    expect(posseDe(aplicarPendencias(dadosDe(), [op('lancamento', 101, confirmada)]), 11).quantidade).toBe(349.5);
    expect(posseDe(aplicarPendencias(dadosDe(), [op('lancamento', 101, { ...confirmada, no_retrato: true })]), 11).quantidade).toBe(449.5);
  });
  it('nunca fica negativa nem reserva mais do que o retrato tem', () => {
    const grande = op('lancamento', 101, { payload: { corpo: { descricao: 'x', trecho: '', materiais: [{ lote_id: 11, quantidade: 9999 }] }, exibicao: { linhas: [] } } });
    expect(posseDe(aplicarPendencias(dadosDe(), [grande]), 11)).toMatchObject({ quantidade: 0, reservado: 449.5 });
  });
  it('reservaPorLote soma por lote e ignora outros tipos de operação', () => {
    const r = reservaPorLote([op('lancamento', 101), op('lancamento', 101), op('foto', 101), op('iniciar', 101)]);
    expect([...r.entries()]).toEqual([[11, 200]]);
  });
  it('lote todo reservado continua na lista (saldo 0, reservado N) e não gera baixa de zero', () => {
    const tudo = op('lancamento', 101, { payload: { corpo: { descricao: 'x', trecho: '', materiais: [{ lote_id: 21, quantidade: 30 }] }, exibicao: { linhas: [] } } });
    const v = aplicarPendencias(dadosDe(), [tudo]);
    const g = agrupar(v.posse).find((x) => x.key === 'i2')!; // LOTE-UNI-0001 (30) e LOTE-UNI-0002 (20) do mesmo item
    expect(g).toMatchObject({ quantidade: 20, reservado: 30 });
    expect(distribuirEntreLotes(g, 20)).toEqual([{ lote_id: 22, quantidade: 20 }]);
    const soUm = aplicarPendencias(dadosDe(criarBootstrap({ posse: [criarBootstrap().posse[0]] })), [op('lancamento', 101, { payload: { corpo: { descricao: 'x', trecho: '', materiais: [{ lote_id: 11, quantidade: 449.5 }] }, exibicao: { linhas: [] } } })]);
    expect(agrupar(soUm.posse)).toHaveLength(1);
    expect(agrupar(soUm.posse)[0]).toMatchObject({ quantidade: 0, reservado: 449.5 });
  });
});

describe('lançamentos da OS (servidor + fila)', () => {
  const detalhe: DetalheOS = {
    baixado_em: '2026-10-11T13:00:00.000Z',
    servicos: [
      { id: 5, descricao: 'Lançamento de cabo', trecho: 'A → B', quantidade: 1, criado_em: '2026-10-11T12:30:00.000Z' },
      { id: 6, descricao: 'Serviço sem material', trecho: null, quantidade: 1, criado_em: '2026-10-11T12:40:00.000Z' },
      { id: 7, descricao: 'Estornado', trecho: null, quantidade: 1, criado_em: '2026-10-11T12:50:00.000Z' },
    ],
    materiais: [
      { id: 1, servico_id: 5, item_nome: 'Cabo', lote_codigo: 'LOTE-1', unidade: 'metros', quantidade: 200, estorno_id: null },
      { id: 2, servico_id: 7, item_nome: 'Cabo', lote_codigo: 'LOTE-1', unidade: 'metros', quantidade: 50, estorno_id: 9 },
    ],
    fotos: [],
  };
  it('lista os do servidor com material ativo (sem os estornados nem os sem material) e os da fila', () => {
    const l = lancamentosDaOS(101, detalhe, [op('lancamento', 101), op('lancamento', 999)]);
    expect(l.map((x) => [x.chave, x.origem, x.estado])).toEqual([['s5', 'servidor', 'enviado'], [expect.stringMatching(/^o/), 'local', 'pendente']]);
    expect(l[0].linhas).toEqual([{ item_nome: 'Cabo', unidade: 'metros', lote_codigo: 'LOTE-1', quantidade: 200 }]);
  });
  it('o trecho marcado no mapa aparece nos lançamentos do servidor (rota_trecho) e nos da fila', () => {
    const rota = { pontos: [{ lat: -23.5, lng: -46.3 }, { lat: -23.51, lng: -46.31 }], metros: 1850, caminho: [[-23.5, -46.3], [-23.51, -46.31]] as Array<[number, number]> };
    const comRota: DetalheOS = { ...detalhe, servicos: detalhe.servicos.map((s) => (s.id === 5 ? { ...s, rota_trecho: rota } : s)) };
    const doServidor = lancamentosDaOS(101, comRota, [])[0];
    expect(doServidor.rota).toEqual(rota);
    const daFila = op('lancamento', 101, { payload: { corpo: { descricao: 'x', trecho: 'y', materiais: [{ lote_id: 11, quantidade: 1 }], rota }, exibicao: { linhas: [] } } });
    expect(lancamentosDaOS(101, null, [daFila])[0].rota).toEqual(rota);
  });
  it('rota_trecho vazia ou inválida no servidor é ignorada (sem quebrar a lista)', () => {
    const ruim: DetalheOS = { ...detalhe, servicos: detalhe.servicos.map((s) => (s.id === 5 ? { ...s, rota_trecho: { pontos: [{ lat: 1, lng: 1 }], metros: 5, caminho: [] } } : s)) };
    expect(lancamentosDaOS(101, ruim, [])[0].rota).toBeUndefined();
    const impossivel: DetalheOS = { ...detalhe, servicos: detalhe.servicos.map((s) => (s.id === 5 ? { ...s, rota_trecho: { pontos: [{ lat: 1, lng: 1 }, { lat: 99, lng: 1 }], metros: 5, caminho: [] } } : s)) };
    expect(lancamentosDaOS(101, impossivel, [])[0].rota).toBeUndefined(); // coordenada fora do planeta não vira mapa
    expect(lancamentosDaOS(101, { ...detalhe, servicos: detalhe.servicos.map((s) => (s.id === 5 ? { ...s, rota_trecho: null } : s)) }, [])[0].rota).toBeUndefined();
  });
  it('uma da fila já confirmada e já presente no cache não é contada duas vezes', () => {
    const confirmada = op('lancamento', 101, { estado: 'ok', ok_em: 1, resposta: { id: 5 } });
    expect(lancamentosDaOS(101, detalhe, [confirmada])).toHaveLength(1);
    const semCache = op('lancamento', 101, { estado: 'ok', ok_em: 1, resposta: { id: 77 } });
    expect(lancamentosDaOS(101, detalhe, [semCache])).toHaveLength(2);
  });
  it('sem cache ainda (nunca abriu a OS online) só há os da fila', () => {
    expect(lancamentosDaOS(101, null, [op('lancamento', 101)])).toHaveLength(1);
    expect(lancamentosComMaterial(101, null, [])).toBe(0);
  });
  it('lancamentosComMaterial alimenta a etapa "Materiais utilizados"', () => {
    expect(lancamentosComMaterial(101, detalhe, [])).toBe(1);
    expect(lancamentosComMaterial(101, detalhe, [op('lancamento', 101)])).toBe(2);
  });
  it('o erro do servidor acompanha o lançamento em atenção', () => {
    const erro = { status: 400, mensagem: 'Quantidade maior que a posse do técnico neste lote (50)' };
    const l = lancamentosDaOS(101, null, [op('lancamento', 101, { estado: 'atencao', erro })]);
    expect(l[0]).toMatchObject({ estado: 'atencao', erro });
  });
});
