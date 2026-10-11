import { r2 } from './quantidade';
import type { Unidade } from './tipos';

/**
 * Ficha de movimentações do técnico (`GET /estoque/posse/minha/ficha`), agrupada como a tela "Estoque por técnico" do web:
 * uma retirada/devolução = os itens do mesmo minuto; baixas = por OS; movimentos estornados (e os próprios estornos) ficam de fora.
 */
export type TipoMov = 'entrada' | 'retirada' | 'devolucao' | 'baixa_os' | 'estorno' | 'ajuste';

export const ROTULO_TIPO: Record<TipoMov, string> = { entrada: 'Entrada', retirada: 'Retirada', devolucao: 'Devolução', baixa_os: 'Baixa em OS', estorno: 'Estorno', ajuste: 'Ajuste' };

export interface MovFicha {
  id: number;
  tipo: TipoMov;
  quantidade: number;
  condicao: string | null;
  observacao: string | null;
  criado_em: string;
  lote_id: number;
  os_id: number | null;
  estorno_de_id: number | null;
  lote_codigo: string;
  item_nome: string;
  unidade: Unidade;
  os_numero: number | null;
  os_cliente: string | null;
}

export interface PosseFicha { lote_id: number; lote_codigo: string; item_id: number; item_nome: string; unidade: Unidade; quantidade: number }

/** O que o app guarda da ficha: a posse de agora e o histórico (a lista de OS já está em "Minhas OS"). */
export interface Ficha {
  tecnico: { id: number; nome: string };
  itens: PosseFicha[];
  historico: MovFicha[];
}

const num = (v: unknown): number => Number(v);

/** O servidor devolve as quantidades do histórico como texto ("50.00"); aqui viram número. Entradas inválidas são descartadas, nunca inventadas. */
export const normalizarFicha = (bruta: any): Ficha | null => {
  if (!bruta || typeof bruta !== 'object' || !Array.isArray(bruta.historico) || !Array.isArray(bruta.itens)) return null;
  const historico: MovFicha[] = [];
  for (const m of bruta.historico) {
    const quantidade = num(m?.quantidade);
    if (!m || !Number.isFinite(quantidade) || typeof m.criado_em !== 'string' || !m.tipo) continue;
    historico.push({
      id: num(m.id), tipo: m.tipo, quantidade, condicao: m.condicao ?? null, observacao: m.observacao ?? null, criado_em: m.criado_em, lote_id: num(m.lote_id),
      os_id: m.os_id == null ? null : num(m.os_id), estorno_de_id: m.estorno_de_id == null ? null : num(m.estorno_de_id), lote_codigo: String(m.lote_codigo ?? ''),
      item_nome: String(m.item_nome ?? ''), unidade: m.unidade === 'pecas' ? 'pecas' : 'metros', os_numero: m.os_numero == null ? null : num(m.os_numero), os_cliente: m.os_cliente ?? null,
    });
  }
  const itens: PosseFicha[] = bruta.itens.map((p: any) => ({ lote_id: num(p.lote_id), lote_codigo: String(p.lote_codigo), item_id: num(p.item_id), item_nome: String(p.item_nome), unidade: p.unidade === 'pecas' ? 'pecas' : 'metros', quantidade: num(p.quantidade) }));
  return { tecnico: { id: num(bruta.tecnico?.id), nome: String(bruta.tecnico?.nome ?? '') }, itens, historico };
};

export interface GrupoFicha {
  key: string;
  tipo: TipoMov;
  quando: string;
  os_id: number | null;
  os_numero: number | null;
  os_cliente: string | null;
  itens: MovFicha[];
}

const minuto = (v: string) => String(v).slice(0, 16);

export const agruparFicha = (historico: readonly MovFicha[]): { validas: MovFicha[]; grupos: GrupoFicha[] } => {
  const estornadas = new Set(historico.filter((m) => m.estorno_de_id).map((m) => m.estorno_de_id));
  const validas = historico.filter((m) => m.tipo !== 'estorno' && !m.estorno_de_id && !estornadas.has(m.id));
  const grupos = new Map<string, GrupoFicha>();
  for (const m of validas) {
    const k = `${m.tipo}|${m.os_id || ''}|${minuto(m.criado_em)}`;
    if (!grupos.has(k)) grupos.set(k, { key: k, tipo: m.tipo, quando: m.criado_em, os_id: m.os_id, os_numero: m.os_numero, os_cliente: m.os_cliente, itens: [] });
    grupos.get(k)!.itens.push(m);
  }
  return { validas, grupos: [...grupos.values()] };
};

/** "3 lançamentos · Cabo óptico, Conector +1" (mesmo texto do web). */
export const resumoGrupo = (g: GrupoFicha): string => {
  const nomes = [...new Set(g.itens.map((i) => i.item_nome))];
  return `${g.itens.length} ${g.itens.length === 1 ? 'lançamento' : 'lançamentos'} · ${nomes.slice(0, 2).join(', ')}${nomes.length > 2 ? ` +${nomes.length - 2}` : ''}`;
};

export interface PosseDetalhada extends PosseFicha {
  recebido: number;
  usado: number;
  entregas: Array<{ quando: string; quantidade: number }>;
  porOS: Array<{ os_id: number; os_numero: number | null; quantidade: number }>;
}

/** "Em posse agora": por lote, com o que foi recebido, o que foi usado em OS e onde. */
export const posseDetalhada = (itens: readonly PosseFicha[], validas: readonly MovFicha[]): PosseDetalhada[] =>
  itens.map((p) => {
    const movs = validas.filter((m) => m.lote_id === p.lote_id);
    const soma = (t: TipoMov) => r2(movs.filter((m) => m.tipo === t).reduce((a, m) => a + m.quantidade, 0));
    const porOS = new Map<number, { os_id: number; os_numero: number | null; quantidade: number }>();
    for (const m of movs.filter((x) => x.tipo === 'baixa_os' && x.os_id != null)) {
      const atual = porOS.get(m.os_id!) ?? { os_id: m.os_id!, os_numero: m.os_numero, quantidade: 0 };
      porOS.set(m.os_id!, { ...atual, quantidade: r2(atual.quantidade + m.quantidade) });
    }
    return { ...p, recebido: soma('retirada'), usado: soma('baixa_os'), entregas: movs.filter((m) => m.tipo === 'retirada').map((m) => ({ quando: m.criado_em, quantidade: m.quantidade })), porOS: [...porOS.values()] };
  });

export type FiltroFicha = 'todos' | 'retirada' | 'baixa_os' | 'devolucao';
export const FILTROS_FICHA: ReadonlyArray<{ valor: FiltroFicha; rotulo: string }> = [
  { valor: 'todos', rotulo: 'Todos' }, { valor: 'retirada', rotulo: 'Retiradas' }, { valor: 'baixa_os', rotulo: 'Baixas em OS' }, { valor: 'devolucao', rotulo: 'Devoluções' },
];
export const filtrarGruposFicha = (grupos: readonly GrupoFicha[], filtro: FiltroFicha): GrupoFicha[] => (filtro === 'todos' ? [...grupos] : grupos.filter((g) => g.tipo === filtro));
