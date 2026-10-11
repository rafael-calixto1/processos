import { fmtQtd, parseQuantidade, r2, type ResultadoQtd } from './quantidade';
import type { PosseItem, Unidade } from './tipos';

export interface GrupoPosse {
  key: string;
  item_nome: string;
  unidade: Unidade;
  lote_codigo: string | null; // null quando o item soma vários lotes (itens por unidade)
  quantidade: number;
  reservado: number; // reservado em lançamentos ainda não confirmados pelo servidor (a quantidade já vem descontada)
  emDevolucao: number; // separado para devolução, na fila ou aguardando aprovação do estoque (também já descontado)
  lotes: PosseItem[]; // do mais antigo para o mais novo (lote_id crescente)
}

/** Itens contados por unidade (lotes LOTE-UNI*) somam entre lotes; os demais ficam um grupo por lote. Igual ao `agrupar` do web. */
export const agrupar = (posse: readonly PosseItem[]): GrupoPosse[] => {
  const grupos = new Map<string, GrupoPosse>();
  for (const p of posse) {
    if (!(p.quantidade > 0) && !((p.reservado ?? 0) > 0) && !((p.emDevolucao ?? 0) > 0)) continue; // lote todo reservado continua aparecendo, com saldo zero
    const porUnidade = String(p.lote_codigo).startsWith('LOTE-UNI');
    const key = porUnidade ? `i${p.item_id}` : `l${p.lote_id}`;
    const g = grupos.get(key) ?? { key, item_nome: p.item_nome, unidade: p.unidade, lote_codigo: porUnidade ? null : p.lote_codigo, quantidade: 0, reservado: 0, emDevolucao: 0, lotes: [] };
    g.quantidade = r2(g.quantidade + p.quantidade);
    g.reservado = r2(g.reservado + (p.reservado ?? 0));
    g.emDevolucao = r2(g.emDevolucao + (p.emDevolucao ?? 0));
    g.lotes.push(p);
    grupos.set(key, g);
  }
  for (const g of grupos.values()) g.lotes.sort((a, b) => a.lote_id - b.lote_id);
  return [...grupos.values()];
};

export interface BaixaLote { lote_id: number; quantidade: number }

/**
 * Reparte a quantidade entre os lotes do grupo, do mais antigo (menor lote_id) para o mais novo, nunca passando
 * da posse de cada lote. É o que o app envia ao servidor, que valida de novo lote a lote.
 */
export const distribuirEntreLotes = (grupo: GrupoPosse, quantidade: number): BaixaLote[] => {
  let resta = r2(quantidade);
  if (!(resta > 0)) throw new RangeError('A quantidade deve ser maior que zero');
  if (resta > grupo.quantidade + 1e-9) throw new RangeError(`Quantidade maior que a posse (${fmtQtd(grupo.quantidade, grupo.unidade)})`);
  const baixas: BaixaLote[] = [];
  for (const lote of [...grupo.lotes].sort((a, b) => a.lote_id - b.lote_id)) {
    if (resta <= 0) break;
    const q = Math.min(resta, lote.quantidade);
    if (!(q > 0)) continue; // lote todo reservado: não gera baixa de zero
    baixas.push({ lote_id: lote.lote_id, quantidade: r2(q) });
    resta = r2(resta - q);
  }
  return baixas;
};

/** Valida o que o técnico digitou para um item da posse: formato, unidade e limite ("Você tem X em posse"). */
export const validarQuantidadeGrupo = (grupo: GrupoPosse, texto: string): ResultadoQtd => {
  const r = parseQuantidade(texto, grupo.unidade);
  if (!r.ok) return r;
  if (r.valor > grupo.quantidade + 1e-9) return { ok: false, erro: `Você tem ${fmtQtd(grupo.quantidade, grupo.unidade)} em posse` };
  return r;
};

/** O código do lote dentro do texto lido do QR. A etiqueta traz só o código; "LOTE-..." dentro de uma frase ou endereço também serve. */
export const extrairCodigoLote = (texto: string): string => {
  const t = String(texto ?? '').trim().toUpperCase();
  return /LOTE-[A-Z0-9-]+/.exec(t)?.[0] ?? t;
};

/** O grupo de posse do lote lido (offline: casa com a posse baixada). Primeiro o texto inteiro (lotes podem ter nome livre), depois o código extraído. */
export const acharGrupoPorCodigo = (grupos: readonly GrupoPosse[], texto: string): GrupoPosse | null => {
  const inteiro = String(texto ?? '').trim().toUpperCase();
  if (!inteiro) return null;
  const casa = (codigo: string) => grupos.find((g) => g.lotes.some((l) => l.lote_codigo.toUpperCase() === codigo)) ?? null;
  return casa(inteiro) ?? casa(extrairCodigoLote(inteiro));
};

/** Ao CORRIGIR um lançamento ainda não enviado, o que ele reservava volta a estar disponível para o novo valor. */
export const devolverReserva = (posse: readonly PosseItem[], materiais: ReadonlyArray<{ lote_id: number; quantidade: number }>): PosseItem[] => {
  const volta = new Map<number, number>();
  for (const m of materiais) volta.set(m.lote_id, r2((volta.get(m.lote_id) ?? 0) + m.quantidade));
  return posse.map((p) => {
    const v = Math.min(volta.get(p.lote_id) ?? 0, p.reservado ?? 0);
    if (!v) return p;
    const reservado = r2((p.reservado ?? 0) - v);
    return { ...p, quantidade: r2(p.quantidade + v), ...(reservado > 0 ? { reservado } : { reservado: undefined }) };
  });
};
