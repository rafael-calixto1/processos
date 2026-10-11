import type { Banco } from '@/db/banco';
import { cancelar, cancelarRascunhosPendentes, coalescerRascunho, enfileirar, listarDaOS, obter, reenviar } from '@/db/outbox';
import { apagarFoto, inserirFoto, lerRascunho, listarFotos, marcarFotoRemovida, obterFoto, salvarRascunho } from '@/db/trabalho';
import { etapasConcluidas, ETAPAS, podeFinalizar, type LocalIntervencao, type Rascunho } from '@/domain/etapas';
import { contaComoPendencia, DIAS_MAX_REENVIO_FORCADO, idadeEmDias, type CorpoFinalizar, type NovaOperacao, type Operacao } from '@/domain/operacoes';
import { isPendente } from '@/domain/os';
import { agrupar, distribuirEntreLotes, validarQuantidadeGrupo } from '@/domain/posse';
import { parseQuantidade } from '@/domain/quantidade';
import { MAX_PONTOS, reduzirCaminho, rotaValida, type RotaTrecho } from '@/domain/trecho';
import type { StatusOS } from '@/domain/tipos';
import { fotosDaOS, lancamentosComMaterial } from '@/domain/visao';
import { carregarEstadoLocal, type EstadoLocal } from './estadoLocal';
import type { PortaArquivos } from './outbox';

/** Recusa de uma ação do técnico, com a explicação em português para mostrar na tela. Nada é enfileirado. */
export class ErroOperacao extends Error {
  constructor(message: string) { super(message); this.name = 'ErroOperacao'; }
}

export interface ContextoComandos {
  banco: Banco;
  usuarioId: number;
  uuid: () => string;
  agora?: () => number;
  dispositivo?: string;
  versaoApp?: string;
  arquivos?: Pick<PortaArquivos, 'apagar'>;
}
const agoraDe = (c: ContextoComandos) => (c.agora ?? Date.now)();

type De<T extends Operacao['tipo']> = Extract<Operacao, { tipo: T }>;

/** Lê o estado e a OS dentro da transação do comando, para a checagem e a gravação serem um passo só (dois toques seguidos não furam a posse). */
const exigirOS = async (tx: Banco, c: ContextoComandos, osId: number) => {
  const estado = await carregarEstadoLocal(tx, c.usuarioId);
  const os = estado?.visao.os.find((o) => o.id === osId);
  if (!estado || !os) throw new ErroOperacao('Esta OS não está mais na sua lista. Atualize e tente de novo.');
  const doOS = estado.ops.filter((o) => o.os_id === osId);
  return { estado, os, doOS };
};

const finalizacaoNaFila = (ops: readonly Operacao[]) => ops.find((o) => o.tipo === 'finalizar' && o.estado !== 'ok');

const exigirEditavel = (os: { status: StatusOS }, ops: readonly Operacao[]) => {
  if (!isPendente(os.status)) throw new ErroOperacao('Esta OS já foi encerrada e não aceita mudanças.');
  if (finalizacaoNaFila(ops)) throw new ErroOperacao('A finalização desta OS já está na fila. Toque em "Voltar a editar" para mudar algo.');
};

const dependenciaDeInicio = (ops: readonly Operacao[]): number[] => {
  const ini = ops.find((o) => o.tipo === 'iniciar' && o.estado !== 'ok');
  return ini ? [ini.id] : [];
};

const base = (c: ContextoComandos, os: { id: number; numero: number; cliente: string }) =>
  ({ usuario_id: c.usuarioId, os_id: os.id, os_numero: os.numero, os_cliente: os.cliente, client_uuid: c.uuid(), chave: c.uuid() });

/* ── Iniciar execução (funciona sem sinal: grava a hora do aparelho e entra na fila) ── */
export const iniciarOS = (c: ContextoComandos, osId: number): Promise<Operacao | null> => c.banco.transacao(async (tx) => {
  const { os, doOS } = await exigirOS(tx, c, osId);
  if (!isPendente(os.status)) throw new ErroOperacao('Esta OS não está aberta.');
  const existente = doOS.find((o) => o.tipo === 'iniciar');
  if (existente) return existente;
  if (os.iniciado_em) return null; // já iniciada
  return enfileirar(tx, { ...base(c, os), depende_de: [], tipo: 'iniciar', payload: { corpo: { iniciado_em: new Date(agoraDe(c)).toISOString() } } }, agoraDe(c));
});

/* ── Lançamentos (serviço + trecho + material da posse) ── */
export interface EntradaLancamento {
  osId: number;
  descricao: string;
  trecho: string;
  itens: Array<{ chaveGrupo: string; quantidade: string }>; // chave do grupo de posse (agrupar) e a quantidade como digitada
  rota?: RotaTrecho | null; // trecho marcado no mapa (opcional): 2 a 25 pontos
}

const montarLancamento = async (tx: Banco, c: ContextoComandos, e: EntradaLancamento): Promise<Extract<NovaOperacao, { tipo: 'lancamento' }>> => {
  const { estado, os, doOS } = await exigirOS(tx, c, e.osId);
  exigirEditavel(os, doOS);
  if (os.status === 'aberta') throw new ErroOperacao('Inicie a execução da OS antes de registrar material.');
  const descricao = e.descricao.trim(); const trecho = e.trecho.trim();
  if (descricao.length < 2) throw new ErroOperacao('Informe o serviço realizado.');
  if (descricao.length > 255) throw new ErroOperacao('O nome do serviço pode ter no máximo 255 caracteres.');
  if (!trecho) throw new ErroOperacao('Informe o trecho (ex.: PL-0932 → PL-0945).');
  if (trecho.length > 255) throw new ErroOperacao('O trecho pode ter no máximo 255 caracteres.');
  if (!e.itens.length) throw new ErroOperacao('Escolha ao menos um material da sua posse.');
  if (e.rota && !rotaValida(e.rota)) throw new ErroOperacao(`O trecho marcado no mapa precisa de 2 a ${MAX_PONTOS} pontos válidos.`);

  const grupos = agrupar(estado.visao.posse);
  const vistos = new Set<string>();
  const materiais: Array<{ lote_id: number; quantidade: number }> = [];
  const linhas: Extract<NovaOperacao, { tipo: 'lancamento' }>['payload']['exibicao']['linhas'] = [];
  for (const item of e.itens) {
    const g = grupos.find((x) => x.key === item.chaveGrupo);
    if (!g) throw new ErroOperacao('Um dos materiais não está mais na sua posse. Atualize e tente de novo.');
    if (vistos.has(g.key)) throw new ErroOperacao(`${g.item_nome} aparece duas vezes. Junte as quantidades em uma linha só.`);
    vistos.add(g.key);
    const q = validarQuantidadeGrupo(g, item.quantidade);
    if (!q.ok) throw new ErroOperacao(`${g.item_nome}: ${q.erro}`);
    for (const baixa of distribuirEntreLotes(g, q.valor)) {
      const lote = g.lotes.find((l) => l.lote_id === baixa.lote_id)!;
      materiais.push(baixa);
      linhas.push({ item_nome: g.item_nome, unidade: g.unidade, lote_id: baixa.lote_id, lote_codigo: lote.lote_codigo, quantidade: baixa.quantidade });
    }
  }
  return { ...base(c, os), depende_de: dependenciaDeInicio(doOS), tipo: 'lancamento', payload: { corpo: { descricao, trecho, materiais, ...(e.rota && { rota: { pontos: e.rota.pontos, metros: e.rota.metros, caminho: reduzirCaminho(e.rota.caminho) } }) }, exibicao: { linhas } } };
};

export const registrarLancamento = (c: ContextoComandos, e: EntradaLancamento): Promise<Operacao> => c.banco.transacao(async (tx) =>
  enfileirar(tx, await montarLancamento(tx, c, e), agoraDe(c)));

/** Corrigir um lançamento que o servidor recusou (ou que ainda não saiu): sai o antigo, entra um novo com identificadores novos. */
export const substituirLancamento = (c: ContextoComandos, operacaoId: number, e: Omit<EntradaLancamento, 'osId'>): Promise<Operacao> => c.banco.transacao(async (tx) => {
  const antigo = (await carregarEstadoLocal(tx, c.usuarioId))?.ops.find((o) => o.id === operacaoId);
  if (!antigo || antigo.tipo !== 'lancamento') throw new ErroOperacao('Este lançamento não foi encontrado.');
  if (!(await cancelar(tx, operacaoId))) throw new ErroOperacao('Este lançamento já foi enviado (ou está sendo enviado agora) e não pode mais ser alterado. Para corrigir, fale com o estoque.');
  return enfileirar(tx, await montarLancamento(tx, c, { ...e, osId: antigo.os_id }), agoraDe(c));
});

export const removerLancamento = (c: ContextoComandos, operacaoId: number): Promise<void> => c.banco.transacao(async (tx) => {
  const op = (await carregarEstadoLocal(tx, c.usuarioId))?.ops.find((o) => o.id === operacaoId);
  if (!op || op.tipo !== 'lancamento') throw new ErroOperacao('Este lançamento não foi encontrado.');
  const doOS = (await listarDaOS(tx, c.usuarioId, op.os_id));
  if (finalizacaoNaFila(doOS)) throw new ErroOperacao('A finalização desta OS já está na fila. Toque em "Voltar a editar" antes de remover um lançamento.');
  if (!(await cancelar(tx, operacaoId))) throw new ErroOperacao('Este lançamento já foi enviado (ou está sendo enviado agora). Para corrigir, fale com o estoque.');
});

/* ── Fotos ── */
export interface EntradaFoto {
  osId: number;
  arquivo: string; // JPEG já comprimido e gravado no diretório do app
  tamanho: number;
  tiradaEm?: string;
  lat?: number | null;
  lng?: number | null;
  legenda?: string | null;
}

export const adicionarFoto = (c: ContextoComandos, e: EntradaFoto): Promise<{ clientUuid: string }> => c.banco.transacao(async (tx) => {
  const { estado, os, doOS } = await exigirOS(tx, c, e.osId);
  exigirEditavel(os, doOS);
  const locais = await listarFotos(tx, os.id);
  const doServidor = (estado.detalhes[os.id]?.fotos ?? []).filter((f) => !locais.some((l) => l.client_uuid === f.client_uuid));
  if (locais.length + doServidor.length >= estado.dados.regras.fotos_max) throw new ErroOperacao(`Cada OS aceita no máximo ${estado.dados.regras.fotos_max} fotos.`);
  const agora = new Date(agoraDe(c)).toISOString();
  const clientUuid = c.uuid();
  const tiradaEm = e.tiradaEm ?? agora;
  await inserirFoto(tx, { client_uuid: clientUuid, usuario_id: c.usuarioId, os_id: os.id, arquivo: e.arquivo, mime: 'image/jpeg', tamanho: e.tamanho, tirada_em: tiradaEm, lat: e.lat ?? null, lng: e.lng ?? null, legenda: e.legenda ?? null, criado_em: agora });
  await enfileirar(tx, {
    usuario_id: c.usuarioId, os_id: os.id, os_numero: os.numero, os_cliente: os.cliente, client_uuid: clientUuid, chave: c.uuid(),
    depende_de: dependenciaDeInicio(doOS), tipo: 'foto',
    payload: { arquivo: e.arquivo, mime: 'image/jpeg', campos: { client_uuid: clientUuid, tirada_em: tiradaEm, lat: e.lat ?? null, lng: e.lng ?? null, legenda: e.legenda ?? null } },
  }, agoraDe(c));
  return { clientUuid };
});

export const removerFotoDaOS = (c: ContextoComandos, osId: number, clientUuid: string): Promise<void> => c.banco.transacao(async (tx) => {
  const { estado, os, doOS } = await exigirOS(tx, c, osId);
  exigirEditavel(os, doOS);
  const opFoto = doOS.find((o): o is De<'foto'> => o.tipo === 'foto' && o.payload.campos.client_uuid === clientUuid);
  const local = await obterFoto(tx, clientUuid);

  if (local && opFoto && (opFoto.estado === 'pendente' || opFoto.estado === 'atencao')) {
    // nunca saiu do aparelho: some sem deixar rastro no servidor
    await cancelar(tx, opFoto.id);
    await apagarFoto(tx, clientUuid);
    if (local.arquivo) await c.arquivos?.apagar(local.arquivo).catch(() => undefined);
    return;
  }
  if (!local) {
    // foto que só o servidor conhece (enviada por este técnico em outro aparelho): guarda o id para poder removê-la
    const doServidor = estado.detalhes[osId]?.fotos.find((f) => f.client_uuid === clientUuid);
    if (!doServidor) throw new ErroOperacao('Esta foto não foi encontrada.');
    await inserirFoto(tx, { client_uuid: clientUuid, usuario_id: c.usuarioId, os_id: osId, arquivo: null, mime: 'image/jpeg', tamanho: null, tirada_em: new Date(agoraDe(c)).toISOString(), lat: null, lng: null, legenda: null, criado_em: new Date(agoraDe(c)).toISOString() });
    await tx.run('UPDATE fotos_locais SET servidor_id = ? WHERE client_uuid = ?', [doServidor.id, clientUuid]);
  }
  // em envio ou já no servidor: marca como removida e manda o pedido de remoção atrás do envio
  await marcarFotoRemovida(tx, clientUuid);
  await enfileirar(tx, {
    ...base(c, os), depende_de: opFoto && opFoto.estado !== 'ok' ? [opFoto.id] : [], tipo: 'remover_foto', payload: { foto_client_uuid: clientUuid },
  }, agoraDe(c));
});

/* ── Rascunho da finalização (salvo no aparelho a cada mudança; cópia no servidor em segundo plano) ── */
export const salvarRascunhoLocal = (c: ContextoComandos, osId: number, rascunho: Rascunho): Promise<void> => c.banco.transacao(async (tx) => {
  const { os, doOS } = await exigirOS(tx, c, osId);
  if (!isPendente(os.status)) return; // OS encerrada: nada a guardar
  await salvarRascunho(tx, c.usuarioId, osId, rascunho, agoraDe(c));
  if (finalizacaoNaFila(doOS)) return; // o servidor apaga o rascunho ao finalizar; uma cópia agora só daria conflito
  await coalescerRascunho(tx, { ...base(c, os), depende_de: [], tipo: 'rascunho', payload: { corpo: { rascunho: { ...rascunho } } } }, agoraDe(c));
});

/* ── Finalizar ── */
const montarCorpoFinalizar = (c: ContextoComandos, estado: EstadoLocal, osId: number, r: Rascunho): CorpoFinalizar => {
  const dados = estado.dados;
  const os = estado.visao.os.find((o) => o.id === osId)!;
  const checklist: CorpoFinalizar['checklist'] = {};
  for (const item of dados.checklist) {
    const v = r.checklist[item.codigo];
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) continue; // não respondido (opcional)
    checklist[item.codigo] = item.tipo === 'number' ? Number(String(v).replace(',', '.')) : item.tipo === 'text' ? String(v).trim() : v;
  }
  const retirados: CorpoFinalizar['retirados'] = r.materiais_retirados ? r.retirados.map((l) => {
    const q = parseQuantidade(l.quantidade, l.unidade);
    if (!q.ok || !l.condicao) throw new ErroOperacao('Há material retirado sem quantidade ou condição válida.');
    return l.item_id != null ? { item_id: l.item_id, quantidade: q.valor, condicao: l.condicao } : { descricao: l.descricao.trim(), quantidade: q.valor, unidade: l.unidade, condicao: l.condicao };
  }) : [];
  const local = r.local as LocalIntervencao;
  return {
    client_uuid: c.uuid(), descricao: r.descricao.trim(), motivo_codigo: r.motivo_codigo as string,
    local: { lat: local.lat, lng: local.lng, precisao_m: local.precisao_m ?? null, origem: local.origem, endereco: local.endereco ?? null, aproximado: Boolean(local.aproximado), ...(local.capturado_em && { capturado_em: local.capturado_em }) },
    checklist, materiais_usados: lancamentosComMaterial(osId, estado.detalhes[osId] ?? null, estado.ops) > 0, materiais_retirados: Boolean(r.materiais_retirados), retirados,
    participantes: r.participantes, fotos_esperadas: [], iniciado_em: os.iniciado_em, finalizado_em: new Date(agoraDe(c)).toISOString(),
    dispositivo: c.dispositivo ?? '', versao_app: c.versaoApp ?? '',
  };
};

export const finalizarOS = (c: ContextoComandos, osId: number): Promise<Operacao> => c.banco.transacao(async (tx) => {
  const { estado, os, doOS } = await exigirOS(tx, c, osId);
  if (!isPendente(os.status)) throw new ErroOperacao('Esta OS já foi encerrada.');
  const jaNaFila = finalizacaoNaFila(doOS);
  if (jaNaFila) return jaNaFila;
  if (os.status === 'aberta') throw new ErroOperacao('Inicie a execução da OS antes de finalizar.');
  const rascunhoSalvo = await lerRascunho(tx, osId);
  if (!rascunhoSalvo) throw new ErroOperacao('Preencha as etapas da finalização antes de finalizar.');
  const fotosLocais = await listarFotos(tx, osId);
  const fotos = fotosDaOS(fotosLocais, estado.detalhes[osId] ?? null);
  const rascunho = { ...rascunhoSalvo, fotos }; // as fotos valem pelo que realmente existe, não pelo que o rascunho lembra

  const emAtencao = doOS.filter((o) => o.estado === 'atencao' && contaComoPendencia(o));
  if (emAtencao.length) throw new ErroOperacao('Há envios desta OS que o servidor recusou. Resolva-os em "Requer atenção" antes de finalizar.');

  const ctx = { checklist: estado.dados.checklist, lancamentosComMaterial: lancamentosComMaterial(osId, estado.detalhes[osId] ?? null, estado.ops), regras: estado.dados.regras };
  if (!podeFinalizar(rascunho, ctx)) {
    const feitas = etapasConcluidas(rascunho, ctx);
    const faltam = ETAPAS.filter((e) => e.obrigatoria && !feitas[e.chave]).map((e) => e.rotulo);
    throw new ErroOperacao(`Ainda falta concluir: ${faltam.join(', ')}.`);
  }

  const corpo = montarCorpoFinalizar(c, estado, osId, rascunho);
  corpo.fotos_esperadas = fotos;

  await cancelarRascunhosPendentes(tx, c.usuarioId, osId);
  const pendentes = doOS.filter((o) => o.estado !== 'ok' && o.tipo !== 'rascunho').map((o) => o.id);
  return enfileirar(tx, { ...base(c, os), depende_de: pendentes, tipo: 'finalizar', payload: { corpo } }, agoraDe(c));
});

/** Desiste de uma finalização que ainda não foi enviada (ou que o servidor recusou) para voltar a mexer na OS. */
export const voltarAEditar = (c: ContextoComandos, osId: number): Promise<void> => c.banco.transacao(async (tx) => {
  const fin = finalizacaoNaFila(await listarDaOS(tx, c.usuarioId, osId));
  if (!fin) return;
  if (!(await cancelar(tx, fin.id))) throw new ErroOperacao('A finalização está sendo enviada agora. Aguarde alguns instantes.');
});

/* ── Tela "Requer atenção" ── */

/** "Tentar de novo" (ou "Enviar mesmo assim", para a que passou de 14 dias) numa operação que o servidor recusou. */
export const reenviarOperacao = (c: ContextoComandos, operacaoId: number, opcoes: { forcar?: boolean } = {}): Promise<void> => c.banco.transacao(async (tx) => {
  const op = await obter(tx, operacaoId);
  if (!op || op.usuario_id !== c.usuarioId || op.estado !== 'atencao') throw new ErroOperacao('Este item não está mais aguardando atenção.');
  if (idadeEmDias(op.criado_em, agoraDe(c)) > DIAS_MAX_REENVIO_FORCADO) {
    throw new ErroOperacao(`Esta operação tem mais de ${DIAS_MAX_REENVIO_FORCADO} dias e não pode mais ser enviada com segurança. Descarte-a e fale com o escritório.`);
  }
  await reenviar(tx, operacaoId, agoraDe(c), opcoes);
});

/** Descartar de vez o que o servidor recusou (ou que o técnico não quer mais enviar). Nunca apaga o que já foi enviado nem o que está em envio. */
export const descartarOperacao = (c: ContextoComandos, operacaoId: number): Promise<void> => c.banco.transacao(async (tx) => {
  const op = await obter(tx, operacaoId);
  if (!op || op.usuario_id !== c.usuarioId) throw new ErroOperacao('Este item não foi encontrado.');
  if (op.estado === 'ok' || op.estado === 'enviando') throw new ErroOperacao('Este item já foi enviado (ou está sendo enviado agora) e não pode ser descartado.');
  if (!(await cancelar(tx, operacaoId))) throw new ErroOperacao('Não foi possível descartar este item. Tente de novo.');
  if (op.tipo === 'foto') {
    const local = await obterFoto(tx, op.payload.campos.client_uuid);
    await apagarFoto(tx, op.payload.campos.client_uuid);
    if (local?.arquivo) await c.arquivos?.apagar(local.arquivo).catch(() => undefined);
  } else if (op.tipo === 'remover_foto') {
    await tx.run('UPDATE fotos_locais SET removida = 0 WHERE client_uuid = ?', [op.payload.foto_client_uuid]); // desistiu de remover: a foto volta para a lista
  }
});
