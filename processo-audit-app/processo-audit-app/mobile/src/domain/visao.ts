import { emFila, contaComoPendencia, type ErroOp, type EstadoOp, type Operacao } from './operacoes';
import { r2 } from './quantidade';
import { montarRota, rotaValida, type RotaTrecho } from './trecho';
import type { CondicaoMaterial, Dados, DetalheOS, Devolucao, OS, Unidade } from './tipos';

/**
 * Visão local = último retrato do servidor + o que o técnico fez e o servidor ainda não confirmou.
 * O retrato nunca é alterado com dados "otimistas": a fila fica à parte e é somada na LEITURA. Por isso uma nova
 * sincronização pode substituir o retrato à vontade sem apagar nem duplicar trabalho pendente.
 */
export type EstadoSync = 'sincronizado' | 'pendente' | 'erro';
export type EstadoFinalizacao = 'nenhuma' | 'na_fila' | 'atencao' | 'enviada';

export interface OSVisao extends OS {
  sync: EstadoSync;
  pendencias: number;
  finalizacao: EstadoFinalizacao;
}
export interface DadosVisao extends Omit<Dados, 'os'> { os: OSVisao[] }

const agrupar = <T extends { os_id: number }>(lista: readonly T[]): Map<number, T[]> => {
  const m = new Map<number, T[]>();
  for (const x of lista) m.set(x.os_id, [...(m.get(x.os_id) ?? []), x]);
  return m;
};

const sincronia = (ops: readonly Operacao[]): { sync: EstadoSync; pendencias: number } => {
  const abertas = ops.filter(contaComoPendencia);
  if (abertas.some((o) => o.estado === 'atencao')) return { sync: 'erro', pendencias: abertas.length };
  return { sync: abertas.length ? 'pendente' : 'sincronizado', pendencias: abertas.length };
};

const visaoDaOS = (os: OS, ops: readonly Operacao[]): OSVisao => {
  const efetivas = ops.filter(emFila);
  let { status, iniciado_em, concluida_em } = os;
  const aberta = os.status === 'aberta' || os.status === 'em_andamento';

  const iniciar = efetivas.find((o): o is Extract<Operacao, { tipo: 'iniciar' }> => o.tipo === 'iniciar');
  const lancou = efetivas.some((o) => o.tipo === 'lancamento');
  const finalizar = efetivas.find((o): o is Extract<Operacao, { tipo: 'finalizar' }> => o.tipo === 'finalizar');

  if (aberta) {
    // o servidor também passa a OS para "em andamento" no primeiro lançamento; o app antecipa o que vai acontecer
    if (iniciar || lancou) status = 'em_andamento';
    if (iniciar && !iniciado_em) iniciado_em = iniciar.payload.corpo.iniciado_em;
    if (finalizar?.estado === 'ok') {
      status = 'concluida';
      concluida_em = concluida_em ?? finalizar.resposta?.finalizado_em ?? finalizar.payload.corpo.finalizado_em;
    }
  }
  const finalizacao: EstadoFinalizacao = !finalizar ? 'nenhuma' : finalizar.estado === 'ok' ? 'enviada' : finalizar.estado === 'atencao' ? 'atencao' : 'na_fila';
  return { ...os, status, iniciado_em, concluida_em, ...sincronia(ops), finalizacao };
};

/** Quanto de cada lote está reservado em lançamentos que o servidor ainda não refletiu (inclui os que pedem atenção: continuam valendo até serem corrigidos ou removidos). */
export const reservaPorLote = (ops: readonly Operacao[]): Map<number, number> => {
  const m = new Map<number, number>();
  for (const o of ops) {
    if (o.tipo !== 'lancamento' || !emFila(o)) continue;
    for (const x of o.payload.corpo.materiais) m.set(x.lote_id, r2((m.get(x.lote_id) ?? 0) + x.quantidade));
  }
  return m;
};

/**
 * Quanto de cada lote está separado para devolução: o que o técnico pediu e ainda está na fila, mais o que já está no servidor
 * aguardando o estoque aprovar. O saldo não muda até a aprovação, mas esse material não pode ser usado em outro lugar nem devolvido duas vezes.
 */
export const devolucaoPorLote = (ops: readonly Operacao[], devolucoes: readonly Devolucao[] = []): Map<number, number> => {
  const m = new Map<number, number>();
  const somar = (lote: number, q: number) => m.set(lote, r2((m.get(lote) ?? 0) + q));
  const noServidor = new Set(devolucoes.map((d) => d.id));
  for (const o of ops) {
    if (o.tipo !== 'devolucao' || !emFila(o)) continue;
    if (o.estado === 'ok' && noServidor.has(o.resposta?.solicitacao_id)) continue; // o retrato já a traz: não conta duas vezes
    somar(o.payload.corpo.lote_id, o.payload.corpo.quantidade);
  }
  for (const d of devolucoes) if (d.status === 'pendente') somar(d.lote_id, d.quantidade);
  return m;
};

export const aplicarPendencias = (dados: Dados, ops: readonly Operacao[]): DadosVisao => {
  const reservas = reservaPorLote(ops);
  const emDevolucao = devolucaoPorLote(ops, dados.devolucoes);
  const porOS = agrupar(ops.filter((o) => o.tipo !== 'devolucao'));
  return {
    ...dados,
    os: dados.os.map((o) => visaoDaOS(o, porOS.get(o.id) ?? [])),
    posse: dados.posse.map((p) => {
      const reservado = Math.min(reservas.get(p.lote_id) ?? 0, p.quantidade);
      const separado = Math.min(emDevolucao.get(p.lote_id) ?? 0, r2(p.quantidade - reservado));
      if (reservado <= 0 && separado <= 0) return p;
      return { ...p, quantidade: r2(p.quantidade - reservado - separado), ...(reservado > 0 && { reservado }), ...(separado > 0 && { emDevolucao: separado }) };
    }),
  };
};

/** Uma devolução como o técnico a vê: as do servidor (com a decisão do estoque) e as que ainda estão no aparelho. */
export type EstadoDevolucao = 'na_fila' | 'enviando' | 'atencao' | 'aguardando' | 'aprovada' | 'negada';
export interface DevolucaoVisao {
  chave: string; // estável: "s<id>" (servidor) ou "o<id da operação>" (fila)
  origem: 'servidor' | 'local';
  item_nome: string;
  unidade: Unidade;
  lote_codigo: string;
  quantidade: number;
  condicao: CondicaoMaterial;
  observacao: string | null;
  estado: EstadoDevolucao;
  quando: string; // ISO: quando foi pedida
  motivoNegacao?: string | null;
  operacaoId?: number;
  erro?: ErroOp | null;
}

const PESO: Record<EstadoDevolucao, number> = { atencao: 0, enviando: 1, na_fila: 2, aguardando: 3, aprovada: 4, negada: 4 };

/**
 * Lista única de devoluções: o que está no servidor mais o que só está na fila. Uma operação já confirmada cujo id aparece
 * no retrato não é contada duas vezes; confirmada mas ainda fora do retrato aparece como "aguardando" (o servidor já tem).
 */
export const devolucoesDoTecnico = (devolucoes: readonly Devolucao[], ops: readonly Operacao[]): DevolucaoVisao[] => {
  const ids = new Set(devolucoes.map((d) => d.id));
  const doServidor: DevolucaoVisao[] = devolucoes.map((d) => ({
    chave: `s${d.id}`, origem: 'servidor', item_nome: d.item_nome, unidade: d.unidade, lote_codigo: d.lote_codigo, quantidade: d.quantidade, condicao: d.condicao,
    observacao: d.observacao, estado: d.status === 'pendente' ? 'aguardando' : d.status, quando: d.solicitado_em, motivoNegacao: d.motivo_negacao,
  }));
  const locais: DevolucaoVisao[] = [];
  for (const o of ops) {
    if (o.tipo !== 'devolucao') continue;
    if (o.estado === 'ok' && typeof o.resposta?.solicitacao_id === 'number' && ids.has(o.resposta.solicitacao_id)) continue;
    if (o.estado === 'ok' && o.no_retrato) continue; // já decidida e fora da janela do retrato: nada a somar por cima
    locais.push({
      chave: `o${o.id}`, origem: 'local', item_nome: o.payload.exibicao.item_nome, unidade: o.payload.exibicao.unidade, lote_codigo: o.payload.exibicao.lote_codigo,
      quantidade: o.payload.corpo.quantidade, condicao: o.payload.corpo.condicao, observacao: o.payload.corpo.observacao ?? null,
      estado: o.estado === 'ok' ? 'aguardando' : o.estado === 'pendente' ? 'na_fila' : o.estado, quando: o.criado_em, operacaoId: o.id, erro: o.erro,
    });
  }
  return [...locais, ...doServidor].sort((a, b) => PESO[a.estado] - PESO[b.estado] || b.quando.localeCompare(a.quando));
};

export interface LinhaLancamentoVisao { item_nome: string; unidade: Unidade; lote_codigo: string; quantidade: number }
export interface LancamentoVisao {
  chave: string; // estável entre servidor e fila: "s<id>" ou "o<id da operação>"
  origem: 'servidor' | 'local';
  descricao: string;
  trecho: string | null;
  linhas: LinhaLancamentoVisao[];
  estado: 'enviado' | EstadoOp;
  operacaoId?: number;
  erro?: ErroOp | null;
  rota?: RotaTrecho; // trecho marcado no mapa, quando o técnico marcou (do servidor ou da fila)
}

/**
 * Lançamentos da OS: os que o servidor já tem (cache de GET /os/:id, só baixas não estornadas) mais os da fila.
 * Um da fila já confirmado cujo id aparece no cache não é contado duas vezes.
 */
export const lancamentosDaOS = (osId: number, detalhe: DetalheOS | null, ops: readonly Operacao[]): LancamentoVisao[] => {
  const doServidor: LancamentoVisao[] = [];
  const idsNoServidor = new Set<number>();
  for (const s of detalhe?.servicos ?? []) {
    idsNoServidor.add(s.id);
    const linhas = (detalhe?.materiais ?? [])
      .filter((m) => m.servico_id === s.id && !m.estorno_id)
      .map((m) => ({ item_nome: m.item_nome, unidade: m.unidade, lote_codigo: m.lote_codigo, quantidade: m.quantidade }));
    const rota = s.rota_trecho ? montarRota(s.rota_trecho.pontos ?? [], { metros: s.rota_trecho.metros ?? 0, caminho: s.rota_trecho.caminho ?? [] }) : null;
    if (linhas.length) doServidor.push({ chave: `s${s.id}`, origem: 'servidor', descricao: s.descricao, trecho: s.trecho, linhas, estado: 'enviado', ...(rota && rotaValida(rota) && { rota }) });
  }
  const locais: LancamentoVisao[] = [];
  for (const o of ops) {
    if (o.os_id !== osId || o.tipo !== 'lancamento') continue;
    if (o.estado === 'ok' && typeof o.resposta?.id === 'number' && idsNoServidor.has(o.resposta.id)) continue;
    locais.push({
      chave: `o${o.id}`, origem: 'local', descricao: o.payload.corpo.descricao, trecho: o.payload.corpo.trecho || null,
      linhas: o.payload.exibicao.linhas.map((l) => ({ item_nome: l.item_nome, unidade: l.unidade, lote_codigo: l.lote_codigo, quantidade: l.quantidade })),
      estado: o.estado, operacaoId: o.id, erro: o.erro,
      ...(o.payload.corpo.rota && { rota: o.payload.corpo.rota }),
    });
  }
  return [...doServidor, ...locais];
};

/** Entrada de `etapasConcluidas`: quantos lançamentos com material a OS tem (servidor + fila). */
export const lancamentosComMaterial = (osId: number, detalhe: DetalheOS | null, ops: readonly Operacao[]): number =>
  lancamentosDaOS(osId, detalhe, ops).filter((l) => l.linhas.length > 0).length;

/** Fotos que a OS tem: as do aparelho (menos as removidas) mais as que só o servidor conhece. É daqui que a etapa "Fotos" se conclui, nunca de uma lista guardada no rascunho. */
export const fotosDaOS = (locais: ReadonlyArray<{ client_uuid: string }>, detalhe: DetalheOS | null): string[] => {
  const uuids = locais.map((f) => f.client_uuid);
  for (const f of detalhe?.fotos ?? []) if (f.client_uuid && !uuids.includes(f.client_uuid)) uuids.push(f.client_uuid);
  return uuids;
};
