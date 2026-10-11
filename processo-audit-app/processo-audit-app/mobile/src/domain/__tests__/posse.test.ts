import { agrupar, distribuirEntreLotes, validarQuantidadeGrupo } from '../posse';
import { r2 } from '../quantidade';
import type { PosseItem } from '../tipos';

const p = (lote_id: number, lote_codigo: string, item_id: number, quantidade: number, unidade: 'metros' | 'pecas' = 'pecas', item_nome = `Item ${item_id}`): PosseItem =>
  ({ lote_id, lote_codigo, item_id, item_nome, unidade, quantidade });

describe('agrupar', () => {
  it('soma entre lotes os itens por unidade (LOTE-UNI*) e mantém os demais um grupo por lote', () => {
    const g = agrupar([
      p(1, 'LOTE-UNI-0001', 10, 30), p(2, 'LOTE-UNI-0002', 10, 20),
      p(3, 'LOTE-BOB-0001', 20, 800, 'metros'), p(4, 'LOTE-BOB-0002', 20, 500, 'metros'),
    ]);
    expect(g.map((x) => x.key)).toEqual(['i10', 'l3', 'l4']);
    expect(g[0]).toMatchObject({ quantidade: 50, lote_codigo: null, unidade: 'pecas' });
    expect(g[0].lotes.map((l) => l.lote_id)).toEqual([1, 2]);
    expect(g[1]).toMatchObject({ quantidade: 800, lote_codigo: 'LOTE-BOB-0001' });
  });
  it('ordena os lotes de um grupo do mais antigo para o mais novo, mesmo que cheguem fora de ordem', () => {
    const [g] = agrupar([p(9, 'LOTE-UNI-0009', 10, 5), p(2, 'LOTE-UNI-0002', 10, 7), p(5, 'LOTE-UNI-0005', 10, 1)]);
    expect(g.lotes.map((l) => l.lote_id)).toEqual([2, 5, 9]);
    expect(g.quantidade).toBe(13);
  });
  it('ignora posse zerada e lista vazia', () => {
    expect(agrupar([])).toEqual([]);
    expect(agrupar([p(1, 'LOTE-UNI-0001', 10, 0)])).toEqual([]);
  });
  it('não perde centésimos na soma', () => {
    const [g] = agrupar([p(1, 'LOTE-UNI-0001', 1, 0.1, 'metros'), p(2, 'LOTE-UNI-0002', 1, 0.2, 'metros')]);
    expect(g.quantidade).toBe(0.3);
  });
});

describe('distribuirEntreLotes (FIFO por lote_id)', () => {
  const grupo = () => agrupar([p(7, 'LOTE-UNI-0007', 10, 5), p(3, 'LOTE-UNI-0003', 10, 10), p(5, 'LOTE-UNI-0005', 10, 20)])[0];

  it('consome o lote mais antigo primeiro e passa ao próximo só quando acaba', () => {
    expect(distribuirEntreLotes(grupo(), 4)).toEqual([{ lote_id: 3, quantidade: 4 }]);
    expect(distribuirEntreLotes(grupo(), 10)).toEqual([{ lote_id: 3, quantidade: 10 }]);
    expect(distribuirEntreLotes(grupo(), 12)).toEqual([{ lote_id: 3, quantidade: 10 }, { lote_id: 5, quantidade: 2 }]);
    expect(distribuirEntreLotes(grupo(), 35)).toEqual([{ lote_id: 3, quantidade: 10 }, { lote_id: 5, quantidade: 20 }, { lote_id: 7, quantidade: 5 }]);
  });
  it('a soma das baixas é exatamente a quantidade pedida', () => {
    const g = agrupar([p(1, 'LOTE-UNI-0001', 1, 10.1, 'metros'), p(2, 'LOTE-UNI-0002', 1, 10.2, 'metros'), p(3, 'LOTE-UNI-0003', 1, 0.7, 'metros')])[0];
    const baixas = distribuirEntreLotes(g, 20.35);
    expect(r2(baixas.reduce((a, b) => a + b.quantidade, 0))).toBe(20.35);
    expect(baixas.every((b) => b.quantidade > 0)).toBe(true);
  });
  it('recusa quantidade acima da posse ou inválida', () => {
    expect(() => distribuirEntreLotes(grupo(), 35.01)).toThrow(/maior que a posse \(35 un\)/);
    expect(() => distribuirEntreLotes(grupo(), 0)).toThrow(/maior que zero/);
    expect(() => distribuirEntreLotes(grupo(), -1)).toThrow(RangeError);
  });
});

describe('validarQuantidadeGrupo', () => {
  const metros = agrupar([p(1, 'LOTE-BOB-0001', 5, 449.5, 'metros')])[0];
  const pecas = agrupar([p(2, 'LOTE-UNI-0001', 6, 4)])[0];

  it('mostra na hora quanto o técnico tem em posse quando passa do limite', () => {
    const r = validarQuantidadeGrupo(metros, '449,51');
    expect(r).toEqual({ ok: false, erro: 'Você tem 449,5 m em posse' });
    expect(validarQuantidadeGrupo(pecas, '5')).toEqual({ ok: false, erro: 'Você tem 4 un em posse' });
  });
  it('aceita exatamente a posse e valores menores', () => {
    expect(validarQuantidadeGrupo(metros, '449,5')).toEqual({ ok: true, valor: 449.5 });
    expect(validarQuantidadeGrupo(pecas, '4')).toEqual({ ok: true, valor: 4 });
  });
  it('aplica antes as regras de unidade', () => {
    expect(validarQuantidadeGrupo(pecas, '1,5')).toMatchObject({ ok: false, erro: expect.stringMatching(/inteiro/) });
    expect(validarQuantidadeGrupo(metros, '')).toMatchObject({ ok: false });
  });
});

/* ── Paridade com o web: cópias LITERAIS de frontend/src/components/estoque/OsFechamento.jsx (agrupar) e de
      frontend/src/pages/fieldwork/steps/LaunchesStep.jsx (distribuição). Se o web mudar, este teste acusa. ── */
type Web = { key: string; item_nome: string; unidade: string; lote_codigo: string | null; quantidade: number; lotes: PosseItem[] };
const agruparWeb = (posse: PosseItem[]): Web[] => {
  const m = new Map<string, Web>();
  for (const x of posse || []) {
    const uni = String(x.lote_codigo).startsWith('LOTE-UNI');
    const key = uni ? `i${x.item_id}` : `l${x.lote_id}`;
    const g = m.get(key) || { key, item_nome: x.item_nome, unidade: x.unidade, lote_codigo: uni ? null : x.lote_codigo, quantidade: 0, lotes: [] };
    g.quantidade += x.quantidade; g.lotes.push(x); m.set(key, g);
  }
  return [...m.values()];
};
const distribuirWeb = (g: Web, qtd: number) => {
  const materiais: Array<{ lote_id: number; quantidade: number }> = [];
  let resta = Number(qtd);
  for (const l of g.lotes) {
    if (resta <= 0) break;
    const q = Math.min(resta, l.quantidade);
    materiais.push({ lote_id: l.lote_id, quantidade: q });
    resta = Math.round((resta - q) * 100) / 100;
  }
  return materiais;
};
const prng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('paridade com o web (entradas aleatórias)', () => {
  it('agrupa igual ao web e distribui igual quando o web recebe os lotes em ordem de lote_id', () => {
    const rnd = prng(20261011);
    let distribuicoes = 0;
    for (let rodada = 0; rodada < 400; rodada++) {
      const n = 1 + Math.floor(rnd() * 8);
      const posse: PosseItem[] = [];
      for (let i = 0; i < n; i++) {
        const item = 1 + Math.floor(rnd() * 3);
        const unidade = item === 1 ? 'metros' : 'pecas';
        const uni = rnd() < 0.5;
        const id = 100 + rodada * 20 + i;
        const q = unidade === 'metros' ? Math.round(rnd() * 100000) / 100 + 0.01 : 1 + Math.floor(rnd() * 200);
        posse.push(p(id, `${uni ? 'LOTE-UNI' : 'LOTE-BOB'}-${String(id).padStart(4, '0')}`, item, q, unidade as 'metros' | 'pecas'));
      }
      const web = agruparWeb([...posse].sort((a, b) => a.lote_id - b.lote_id)); // o web recebe o que o servidor ordena; aqui, por lote_id
      const nosso = agrupar(posse);
      expect(nosso.map((g) => g.key)).toEqual(web.map((g) => g.key));
      for (const [i, g] of nosso.entries()) {
        expect(g.quantidade).toBe(r2(web[i].quantidade));
        expect(g.lote_codigo).toBe(web[i].lote_codigo);
        expect(g.lotes.map((l) => l.lote_id)).toEqual(web[i].lotes.map((l) => l.lote_id));
        const pedido = g.unidade === 'metros' ? Math.round(rnd() * g.quantidade * 100) / 100 : Math.floor(rnd() * g.quantidade);
        if (pedido > 0) {
          distribuicoes++;
          const a = distribuirEntreLotes(g, pedido);
          const b = distribuirWeb(web[i], pedido).map((x) => ({ lote_id: x.lote_id, quantidade: r2(x.quantidade) }));
          expect(a).toEqual(b);
        }
      }
    }
    expect(distribuicoes).toBeGreaterThan(500); // garante que o teste exercitou de verdade
  });
});
