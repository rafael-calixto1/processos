import { agruparFicha, filtrarGruposFicha, normalizarFicha, posseDetalhada, resumoGrupo, type MovFicha } from '../ficha';

/* Cópias LITERAIS das funções de frontend/src/pages/EstoquePosse.jsx: o app precisa agrupar exatamente como o escritório. */
const minutoWeb = (v: unknown) => String(v).slice(0, 16);
const agruparWeb = (historico: any[]) => {
  const estornadas = new Set(historico.filter((m) => m.estorno_de_id).map((m) => m.estorno_de_id));
  const validas = historico.filter((m) => m.tipo !== 'estorno' && !m.estorno_de_id && !estornadas.has(m.id));
  const grupos = new Map();
  for (const m of validas) {
    const k = `${m.tipo}|${m.os_id || ''}|${minutoWeb(m.criado_em)}`;
    if (!grupos.has(k)) grupos.set(k, { key: k, tipo: m.tipo, quando: m.criado_em, os_id: m.os_id, os_numero: m.os_numero, os_cliente: m.os_cliente, itens: [] });
    grupos.get(k).itens.push(m);
  }
  return { validas, grupos: [...grupos.values()] };
};
const resumoWeb = (g: any) => {
  const nomes = [...new Set(g.itens.map((i: any) => i.item_nome))] as string[];
  return `${g.itens.length} ${g.itens.length === 1 ? 'lançamento' : 'lançamentos'} · ${nomes.slice(0, 2).join(', ')}${nomes.length > 2 ? ` +${nomes.length - 2}` : ''}`;
};

let n = 0;
const mov = (extra: Partial<MovFicha>): MovFicha => ({
  id: ++n, tipo: 'retirada', quantidade: 100, condicao: null, observacao: null, criado_em: '2026-10-10T14:00:05.000Z', lote_id: 11, os_id: null, estorno_de_id: null,
  lote_codigo: 'LOTE-BOB-0001', item_nome: 'Cabo óptico ASU 12F', unidade: 'metros', os_numero: null, os_cliente: null, ...extra,
});

// mais novo primeiro, como o servidor entrega (ORDER BY m.id DESC)
const historico = (): MovFicha[] => {
  n = 0;
  const base = [
    mov({ tipo: 'retirada', criado_em: '2026-10-01T10:00:10.000Z', quantidade: 400 }),
    mov({ tipo: 'retirada', criado_em: '2026-10-01T10:00:40.000Z', quantidade: 30, lote_id: 21, lote_codigo: 'LOTE-UNI-0001', item_nome: 'Conector SC/APC', unidade: 'pecas' }), // mesmo minuto: mesmo grupo
    mov({ tipo: 'baixa_os', criado_em: '2026-10-02T09:00:00.000Z', quantidade: 120, os_id: 7, os_numero: 7, os_cliente: 'Rota PL-1' }),
    mov({ tipo: 'baixa_os', criado_em: '2026-10-02T09:00:30.000Z', quantidade: 5, os_id: 7, os_numero: 7, os_cliente: 'Rota PL-1', lote_id: 21, lote_codigo: 'LOTE-UNI-0001', item_nome: 'Conector SC/APC', unidade: 'pecas' }),
    mov({ tipo: 'baixa_os', criado_em: '2026-10-02T09:00:40.000Z', quantidade: 50, os_id: 8, os_numero: 8, os_cliente: 'Rota PL-2' }), // outra OS no mesmo minuto: outro grupo
    mov({ tipo: 'baixa_os', criado_em: '2026-10-03T09:00:00.000Z', quantidade: 999, os_id: 9, os_numero: 9, os_cliente: 'Rota PL-3' }), // será estornada
    mov({ tipo: 'devolucao', criado_em: '2026-10-04T16:00:00.000Z', quantidade: 20, condicao: 'usado', observacao: 'sobra' }),
    mov({ tipo: 'retirada', criado_em: '2026-10-05T08:00:00.000Z', quantidade: 10 }),
  ];
  const estornada = base[5];
  const completo = [...base, mov({ tipo: 'estorno', criado_em: '2026-10-03T09:05:00.000Z', quantidade: 999, estorno_de_id: estornada.id, os_id: 9, os_numero: 9 })];
  return completo.reverse();
};

describe('agruparFicha: paridade com a tela do escritório (EstoquePosse.jsx)', () => {
  it('dá exatamente os mesmos grupos, na mesma ordem e com os mesmos movimentos', () => {
    const h = historico();
    const app = agruparFicha(h);
    const web = agruparWeb(h);
    expect(app.grupos.map((g) => ({ ...g, itens: g.itens.map((i) => i.id) }))).toEqual(web.grupos.map((g: any) => ({ ...g, itens: g.itens.map((i: any) => i.id) })));
    expect(app.validas.map((m) => m.id)).toEqual(web.validas.map((m: any) => m.id));
    expect(app.grupos.map(resumoGrupo)).toEqual(web.grupos.map(resumoWeb));
  });

  it('estorno e o movimento estornado somem; o resto continua', () => {
    const { validas, grupos } = agruparFicha(historico());
    expect(validas.some((m) => m.tipo === 'estorno')).toBe(false);
    expect(validas.some((m) => m.quantidade === 999)).toBe(false);
    expect(grupos.map((g) => g.tipo)).toEqual(['retirada', 'devolucao', 'baixa_os', 'baixa_os', 'retirada']);
  });

  it('retirada e devolução juntam itens do mesmo minuto; baixa separa por OS', () => {
    const { grupos } = agruparFicha(historico());
    const retiradaInicial = grupos.find((g) => g.tipo === 'retirada' && g.itens.length === 2)!;
    expect(retiradaInicial.itens.map((i) => i.item_nome).sort()).toEqual(['Cabo óptico ASU 12F', 'Conector SC/APC']);
    const baixas = grupos.filter((g) => g.tipo === 'baixa_os');
    expect(baixas.map((g) => [g.os_numero, g.itens.length]).sort()).toEqual([[7, 2], [8, 1]]);
  });

  it('resumo: singular, plural e "+N" quando há mais de 2 itens', () => {
    n = 100;
    const g = (itens: string[]) => agruparFicha(itens.map((nome) => mov({ item_nome: nome, lote_id: n }))).grupos[0];
    expect(resumoGrupo(g(['A']))).toBe('1 lançamento · A');
    expect(resumoGrupo(g(['A', 'B']))).toBe('2 lançamentos · A, B');
    expect(resumoGrupo(g(['A', 'B', 'C', 'D']))).toBe('4 lançamentos · A, B +2');
  });

  it('filtros: só retiradas, só baixas, só devoluções', () => {
    const { grupos } = agruparFicha(historico());
    expect(filtrarGruposFicha(grupos, 'todos')).toHaveLength(5);
    expect(filtrarGruposFicha(grupos, 'retirada')).toHaveLength(2);
    expect(filtrarGruposFicha(grupos, 'baixa_os')).toHaveLength(2);
    expect(filtrarGruposFicha(grupos, 'devolucao')).toHaveLength(1);
  });
});

describe('posseDetalhada', () => {
  it('soma recebido e usado por lote (sem estornos) e mostra onde o material foi gasto', () => {
    const { validas } = agruparFicha(historico());
    const itens = [
      { lote_id: 11, lote_codigo: 'LOTE-BOB-0001', item_id: 1, item_nome: 'Cabo óptico ASU 12F', unidade: 'metros' as const, quantidade: 120 },
      { lote_id: 21, lote_codigo: 'LOTE-UNI-0001', item_id: 2, item_nome: 'Conector SC/APC', unidade: 'pecas' as const, quantidade: 25 },
    ];
    const [cabo, conector] = posseDetalhada(itens, validas);
    expect(cabo).toMatchObject({ recebido: 410, usado: 170 }); // 400 + 10 recebidos; 120 + 50 usados; a baixa de 999 foi estornada
    expect(cabo.porOS).toHaveLength(2);
    expect(cabo.porOS).toEqual(expect.arrayContaining([{ os_id: 7, os_numero: 7, quantidade: 120 }, { os_id: 8, os_numero: 8, quantidade: 50 }]));
    expect(cabo.entregas).toHaveLength(2);
    expect(conector).toMatchObject({ recebido: 30, usado: 5, porOS: [{ os_id: 7, os_numero: 7, quantidade: 5 }] });
  });
  it('lote sem movimentos fica zerado (não quebra)', () => {
    expect(posseDetalhada([{ lote_id: 99, lote_codigo: 'X', item_id: 1, item_nome: 'Y', unidade: 'metros', quantidade: 3 }], [])[0]).toMatchObject({ recebido: 0, usado: 0, entregas: [], porOS: [] });
  });
});

describe('normalizarFicha', () => {
  it('converte as quantidades em texto do servidor ("50.00") para número', () => {
    const f = normalizarFicha({
      tecnico: { id: 1, nome: 'João' },
      itens: [{ lote_id: '11', lote_codigo: 'L', item_id: 1, item_nome: 'Cabo', unidade: 'metros', quantidade: 449.5 }],
      historico: [{ id: 5, tipo: 'retirada', quantidade: '50.00', criado_em: '2026-10-10T14:00:00.000Z', lote_id: 11, os_id: null, estorno_de_id: null, lote_codigo: 'L', item_nome: 'Cabo', unidade: 'metros' }],
    })!;
    expect(f.historico[0].quantidade).toBe(50);
    expect(f.itens[0].lote_id).toBe(11);
    expect(f.historico[0].os_numero).toBeNull();
  });
  it('descarta lixo em vez de inventar números; resposta fora do formato vira null', () => {
    const f = normalizarFicha({ tecnico: { id: 1, nome: 'J' }, itens: [], historico: [{ id: 1, tipo: 'retirada', quantidade: 'abc', criado_em: 'x' }, { id: 2, tipo: 'retirada', quantidade: '3', criado_em: '2026-10-10T14:00:00.000Z', lote_id: 1, lote_codigo: 'L', item_nome: 'C', unidade: 'pecas' }] })!;
    expect(f.historico.map((m) => m.id)).toEqual([2]);
    expect(normalizarFicha(null)).toBeNull();
    expect(normalizarFicha({ historico: 'x' })).toBeNull();
    expect(normalizarFicha({ tecnico: {}, itens: [] })).toBeNull();
  });
});
