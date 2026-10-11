/**
 * Custo das transformações de dados sobre volumes bem maiores que os de campo (Node, não aparelho: serve para pegar um algoritmo
 * que degrada, não para prometer tempos no celular). Os limites são folgados de propósito para não oscilar entre máquinas.
 */
import { agruparFicha, normalizarFicha, posseDetalhada, type MovFicha } from '@/domain/ficha';
import { agrupar } from '@/domain/posse';
import { aplicarPendencias, devolucoesDoTecnico } from '@/domain/visao';
import { lerDados, salvarBootstrap } from '@/db/repositorio';
import { criarBancoDeTeste } from '@/testing/bancoNode';
import { criarBootstrap, criarOS } from '@/testing/fixtures';
import type { Dados, Devolucao, PosseItem } from '@/domain/tipos';
import type { Operacao } from '@/domain/operacoes';

const medir = <T,>(f: () => T): { ms: number; r: T } => { const t = performance.now(); const r = f(); return { ms: performance.now() - t, r }; };

describe('desempenho em volumes grandes', () => {
  it('ficha com 3000 movimentos e 200 lotes: normaliza, agrupa e detalha a posse em menos de 1 s', () => {
    const movs: MovFicha[] = Array.from({ length: 3000 }, (_, i) => ({
      id: 3000 - i, tipo: i % 7 === 0 ? 'retirada' : i % 11 === 0 ? 'devolucao' : 'baixa_os', quantidade: (i % 50) + 1, condicao: null, observacao: null,
      criado_em: new Date(Date.UTC(2026, 0, 1) + (3000 - i) * 3_600_000).toISOString(), lote_id: i % 200, os_id: i % 7 === 0 ? null : 100 + (i % 120),
      estorno_de_id: i % 97 === 0 ? 3000 - i - 5 : null, lote_codigo: `LOTE-${i % 200}`, item_nome: `Item ${i % 40}`, unidade: 'metros', os_numero: 100 + (i % 120), os_cliente: 'Rota',
    }));
    const bruta = { tecnico: { id: 1, nome: 'J' }, itens: Array.from({ length: 200 }, (_, l) => ({ lote_id: l, lote_codigo: `LOTE-${l}`, item_id: l % 40, item_nome: `Item ${l % 40}`, unidade: 'metros', quantidade: 10 })), historico: movs.map((m) => ({ ...m, quantidade: String(m.quantidade) })) };
    const { ms, r } = medir(() => { const f = normalizarFicha(bruta)!; const g = agruparFicha(f.historico); return { grupos: g.grupos.length, posse: posseDetalhada(f.itens, g.validas).length }; });
    expect(r.posse).toBe(200);
    expect(r.grupos).toBeGreaterThan(100);
    expect(ms).toBeLessThan(1000);
  });

  it('500 OS, 300 lotes em posse e 200 operações na fila: a visão local sai em menos de 500 ms', () => {
    const base = criarBootstrap();
    const os = Array.from({ length: 500 }, (_, i) => criarOS(i + 1, { status: i % 3 === 0 ? 'concluida' : 'aberta' }));
    const posse: PosseItem[] = Array.from({ length: 300 }, (_, i) => ({ lote_id: i + 1, lote_codigo: i % 3 ? `LOTE-BOB-${i}` : `LOTE-UNI-${i}`, item_id: (i % 30) + 1, item_nome: `Item ${i % 30}`, unidade: 'metros', quantidade: 100 }));
    const dados: Dados = { geradoEm: base.gerado_em, tecnico: base.tecnico, os, posse, devolucoes: [], motivos: [], checklist: [], sugestoesServicos: [], tiposServico: [], tecnicos: [], itens: [], regras: base.regras };
    const ops = Array.from({ length: 200 }, (_, i) => ({
      id: i + 1, usuario_id: 7, os_id: 100 + (i % 500) + 1, tipo: 'lancamento', client_uuid: `u${i}`, chave: `k${i}`, depende_de: [], estado: 'pendente', tentativas: 0, proxima_tentativa: 0,
      criado_em: '2026-10-11T14:00:00.000Z', atualizado_em: '', ok_em: null, no_retrato: false, forcada: false, resposta: null, erro: null, os_numero: i, os_cliente: 'c',
      payload: { corpo: { descricao: 'x', trecho: 'y', materiais: [{ lote_id: (i % 300) + 1, quantidade: 1 }] }, exibicao: { linhas: [] } },
    })) as unknown as Operacao[];
    const { ms, r } = medir(() => { const v = aplicarPendencias(dados, ops); return { os: v.os.length, grupos: agrupar(v.posse).length }; });
    expect(r.os).toBe(500);
    expect(r.grupos).toBeGreaterThan(100);
    expect(ms).toBeLessThan(500);
  });

  it('100 devoluções no servidor e 100 na fila: a lista unificada sai em menos de 200 ms', () => {
    const devs: Devolucao[] = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, lote_id: i, lote_codigo: `L${i}`, item_id: 1, item_nome: 'Cabo', unidade: 'metros', quantidade: 10, condicao: 'novo', observacao: null, status: (['pendente', 'aprovada', 'negada'] as const)[i % 3], solicitado_em: `2026-10-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`, revisado_em: null, motivo_negacao: null }));
    const ops = Array.from({ length: 100 }, (_, i) => ({ id: 1000 + i, tipo: 'devolucao', estado: i % 2 ? 'ok' : 'pendente', no_retrato: false, resposta: i % 2 ? { solicitacao_id: 500 + i } : null, criado_em: '2026-10-11T14:00:00.000Z', erro: null, payload: { corpo: { lote_id: i, quantidade: 5, condicao: 'usado' }, exibicao: { item_nome: 'Cabo', unidade: 'metros', lote_codigo: `L${i}` } } })) as unknown as Operacao[];
    const { ms, r } = medir(() => devolucoesDoTecnico(devs, ops));
    expect(r.length).toBe(200);
    expect(ms).toBeLessThan(200);
  });

  it('guardar e ler 500 OS no SQLite local leva menos de 3 s (Node; no aparelho é mais lento, mas é uma transação só)', async () => {
    const { banco } = await criarBancoDeTeste();
    const b = criarBootstrap({ os: Array.from({ length: 500 }, (_, i) => criarOS(i + 1)) });
    const t = performance.now();
    await salvarBootstrap(banco, b);
    const d = await lerDados(banco);
    const ms = performance.now() - t;
    expect(d?.os).toHaveLength(500);
    expect(ms).toBeLessThan(3000);
  });
});
