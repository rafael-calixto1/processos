import { emFila, contaComoPendencia, type ErroOp, type EstadoOp, type Operacao } from './operacoes';
import { r2 } from './quantidade';
import type { Dados, DetalheOS, OS, Unidade } from './tipos';

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

export const aplicarPendencias = (dados: Dados, ops: readonly Operacao[]): DadosVisao => {
  const reservas = reservaPorLote(ops);
  const porOS = agrupar(ops);
  return {
    ...dados,
    os: dados.os.map((o) => visaoDaOS(o, porOS.get(o.id) ?? [])),
    posse: dados.posse.map((p) => {
      const reservado = Math.min(reservas.get(p.lote_id) ?? 0, p.quantidade);
      return reservado > 0 ? { ...p, quantidade: r2(p.quantidade - reservado), reservado } : p;
    }),
  };
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
  rota?: { pontos: number; metros: number }; // trecho marcado no mapa (só nos da fila)
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
    if (linhas.length) doServidor.push({ chave: `s${s.id}`, origem: 'servidor', descricao: s.descricao, trecho: s.trecho, linhas, estado: 'enviado' });
  }
  const locais: LancamentoVisao[] = [];
  for (const o of ops) {
    if (o.os_id !== osId || o.tipo !== 'lancamento') continue;
    if (o.estado === 'ok' && typeof o.resposta?.id === 'number' && idsNoServidor.has(o.resposta.id)) continue;
    locais.push({
      chave: `o${o.id}`, origem: 'local', descricao: o.payload.corpo.descricao, trecho: o.payload.corpo.trecho || null,
      linhas: o.payload.exibicao.linhas.map((l) => ({ item_nome: l.item_nome, unidade: l.unidade, lote_codigo: l.lote_codigo, quantidade: l.quantidade })),
      estado: o.estado, operacaoId: o.id, erro: o.erro,
      ...(o.payload.corpo.rota && { rota: { pontos: o.payload.corpo.rota.pontos.length, metros: o.payload.corpo.rota.metros } }),
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
