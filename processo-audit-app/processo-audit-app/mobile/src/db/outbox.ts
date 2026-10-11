import type { Banco } from './banco';
import { contaComoPendencia, type ErroOp, type NovaOperacao, type Operacao } from '@/domain/operacoes';

interface Linha {
  id: number; usuario_id: number; os_id: number; tipo: string; client_uuid: string; chave: string; payload: string; depende_de: string;
  estado: string; tentativas: number; proxima_tentativa: number; criado_em: string; atualizado_em: string; ok_em: number | null;
  no_retrato: number; forcada: number; resposta: string | null; erro_status: number | null; erro_mensagem: string | null; erro_detalhes: string | null;
  os_numero: number | null; os_cliente: string | null;
}

const paraOperacao = (r: Linha): Operacao => ({
  id: r.id, usuario_id: r.usuario_id, os_id: r.os_id, tipo: r.tipo, client_uuid: r.client_uuid, chave: r.chave,
  payload: JSON.parse(r.payload), depende_de: JSON.parse(r.depende_de), estado: r.estado, tentativas: r.tentativas,
  proxima_tentativa: r.proxima_tentativa, criado_em: r.criado_em, atualizado_em: r.atualizado_em, ok_em: r.ok_em, no_retrato: r.no_retrato === 1, forcada: r.forcada === 1,
  resposta: r.resposta === null ? null : JSON.parse(r.resposta),
  erro: r.erro_mensagem === null ? null : { status: r.erro_status, mensagem: r.erro_mensagem, ...(r.erro_detalhes && { detalhes: JSON.parse(r.erro_detalhes) }) },
  os_numero: r.os_numero, os_cliente: r.os_cliente,
}) as Operacao;

const iso = (ms: number) => new Date(ms).toISOString();

/** Grava uma operação nova (pendente). O `client_uuid` é único: enfileirar a mesma ação duas vezes falha em vez de duplicar. */
export const enfileirar = (b: Banco, n: NovaOperacao, agora: number = Date.now()): Promise<Operacao> => b.transacao(async (tx) => {
  await tx.run(
    `INSERT INTO outbox (usuario_id, os_id, tipo, client_uuid, chave, payload, depende_de, criado_em, atualizado_em, os_numero, os_cliente)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [n.usuario_id, n.os_id, n.tipo, n.client_uuid, n.chave, JSON.stringify(n.payload), JSON.stringify(n.depende_de), iso(agora), iso(agora), n.os_numero, n.os_cliente]);
  return paraOperacao((await tx.first<Linha>('SELECT * FROM outbox WHERE client_uuid = ?', [n.client_uuid]))!);
});

export const obter = async (b: Banco, id: number): Promise<Operacao | null> => {
  const r = await b.first<Linha>('SELECT * FROM outbox WHERE id = ?', [id]);
  return r ? paraOperacao(r) : null;
};

/** Tudo o que ainda produz efeito na tela: não terminou, ou terminou e o retrato do servidor ainda não a inclui. */
export const listarEmFila = async (b: Banco, usuarioId: number): Promise<Operacao[]> =>
  (await b.all<Linha>("SELECT * FROM outbox WHERE usuario_id = ? AND (estado <> 'ok' OR no_retrato = 0) ORDER BY id", [usuarioId])).map(paraOperacao);

/** Todas as operações do técnico ainda guardadas (inclusive as confirmadas recentes): a visão filtra o que importa para cada conta. */
export const listarTodas = async (b: Banco, usuarioId: number): Promise<Operacao[]> =>
  (await b.all<Linha>('SELECT * FROM outbox WHERE usuario_id = ? ORDER BY id', [usuarioId])).map(paraOperacao);

export const listarDaOS = async (b: Banco, usuarioId: number, osId: number): Promise<Operacao[]> =>
  (await b.all<Linha>('SELECT * FROM outbox WHERE usuario_id = ? AND os_id = ? ORDER BY id', [usuarioId, osId])).map(paraOperacao);

export const listarPorEstado = async (b: Banco, usuarioId: number, estado: Operacao['estado']): Promise<Operacao[]> =>
  (await b.all<Linha>('SELECT * FROM outbox WHERE usuario_id = ? AND estado = ? ORDER BY id', [usuarioId, estado])).map(paraOperacao);

/**
 * A próxima operação que pode ser enviada agora: pendente, com a hora de tentar já chegada e com todas as dependências
 * resolvidas (uma dependência que não existe mais — cancelada pelo técnico — conta como resolvida).
 * Só devolve operações do técnico logado: o token de um técnico nunca envia o trabalho de outro.
 */
export const proximaPronta = async (b: Banco, usuarioId: number, agora: number): Promise<Operacao | null> => {
  const naoResolvidas = new Set((await b.all<{ id: number }>("SELECT id FROM outbox WHERE usuario_id = ? AND estado <> 'ok'", [usuarioId])).map((r) => r.id));
  const candidatas = await b.all<Linha>("SELECT * FROM outbox WHERE usuario_id = ? AND estado = 'pendente' AND proxima_tentativa <= ? ORDER BY id", [usuarioId, agora]);
  for (const c of candidatas) {
    const op = paraOperacao(c);
    if (op.depende_de.every((d) => !naoResolvidas.has(d))) return op;
  }
  return null;
};

/** Uma ação explícita (reconexão, "Sincronizar agora", voltar ao app) cancela a espera do backoff: tenta tudo o que está pendente agora. */
export const liberarEspera = async (b: Banco, usuarioId: number): Promise<number> =>
  (await b.run("UPDATE outbox SET proxima_tentativa = 0 WHERE usuario_id = ? AND estado = 'pendente' AND proxima_tentativa > 0", [usuarioId])).alteradas;

/** Quando uma operação em espera (backoff) poderá ser tentada de novo, para o motor acordar na hora certa. Só conta horas futuras. */
export const proximaHora = async (b: Banco, usuarioId: number, agora: number): Promise<number | null> =>
  (await b.first<{ t: number | null }>("SELECT MIN(proxima_tentativa) AS t FROM outbox WHERE usuario_id = ? AND estado = 'pendente' AND proxima_tentativa > ?", [usuarioId, agora]))?.t ?? null;

/** Reserva a operação para envio (pendente → enviando) de forma atômica; devolve false se outra tarefa chegou antes. */
export const reservar = async (b: Banco, id: number, agora: number): Promise<boolean> =>
  (await b.run("UPDATE outbox SET estado = 'enviando', tentativas = tentativas + 1, atualizado_em = ? WHERE id = ? AND estado = 'pendente'", [iso(agora), id])).alteradas === 1;

export const concluirOk = (b: Banco, id: number, resposta: unknown, agora: number) =>
  b.run("UPDATE outbox SET estado = 'ok', ok_em = ?, resposta = ?, erro_status = NULL, erro_mensagem = NULL, erro_detalhes = NULL, atualizado_em = ? WHERE id = ?",
    [agora, JSON.stringify(resposta ?? null), iso(agora), id]);

/** Falha passageira (sem rede, 5xx, 429...): volta para pendente e só será tentada de novo na hora marcada. */
export const reagendar = (b: Banco, id: number, proximaTentativa: number, agora: number) =>
  b.run("UPDATE outbox SET estado = 'pendente', proxima_tentativa = ?, atualizado_em = ? WHERE id = ?", [proximaTentativa, iso(agora), id]);

/** O servidor recusou por regra de negócio: fica parada, com a mensagem, até o técnico decidir. */
export const marcarAtencao = (b: Banco, id: number, erro: ErroOp, agora: number) =>
  b.run("UPDATE outbox SET estado = 'atencao', erro_status = ?, erro_mensagem = ?, erro_detalhes = ?, atualizado_em = ? WHERE id = ?",
    [erro.status, erro.mensagem, erro.detalhes ? JSON.stringify(erro.detalhes) : null, iso(agora), id]);

/** O app foi encerrado no meio de um envio: o resultado é desconhecido, então reenvia (a chave de idempotência torna isso seguro). */
export const recuperarEnviando = async (b: Banco): Promise<number> =>
  (await b.run("UPDATE outbox SET estado = 'pendente', proxima_tentativa = 0 WHERE estado = 'enviando'")).alteradas;

/** "Tentar de novo" depois de o técnico resolver o problema (ou de confirmar o envio de uma operação velha). */
export const reenviar = async (b: Banco, id: number, agora: number, opcoes: { forcar?: boolean } = {}): Promise<boolean> =>
  (await b.run("UPDATE outbox SET estado = 'pendente', tentativas = 0, proxima_tentativa = 0, forcada = CASE WHEN ? THEN 1 ELSE forcada END, erro_status = NULL, erro_mensagem = NULL, erro_detalhes = NULL, atualizado_em = ? WHERE id = ? AND estado = 'atencao'",
    [opcoes.forcar ? 1 : 0, iso(agora), id])).alteradas === 1;

/** Remove uma operação que o servidor não confirmou. Nunca apaga uma em envio (resultado incerto) nem uma já confirmada. */
export const cancelar = async (b: Banco, id: number): Promise<boolean> =>
  (await b.run("DELETE FROM outbox WHERE id = ? AND estado IN ('pendente','atencao')", [id])).alteradas === 1;

/** Um retrato do servidor feito depois destas confirmações já traz o efeito delas: a tela pode parar de somá-las por cima. */
export const marcarNoRetrato = (b: Banco, usuarioId: number, retratoIniciadoEm: number) =>
  b.run("UPDATE outbox SET no_retrato = 1 WHERE usuario_id = ? AND estado = 'ok' AND no_retrato = 0 AND ok_em < ?", [usuarioId, retratoIniciadoEm]);

/** Histórico de confirmadas e já refletidas no retrato some depois de um tempo. */
export const podarConfirmadas = async (b: Banco, usuarioId: number, antesDe: number): Promise<number> =>
  (await b.run("DELETE FROM outbox WHERE usuario_id = ? AND estado = 'ok' AND no_retrato = 1 AND ok_em < ?", [usuarioId, antesDe])).alteradas;

export interface Contagens { pendentes: number; enviando: number; atencao: number }

/** Números do contador global. O backup do rascunho não conta: para o técnico ele não é uma pendência. */
export const contagens = async (b: Banco, usuarioId: number): Promise<Contagens> => {
  const linhas = await b.all<{ tipo: Operacao['tipo']; estado: Operacao['estado']; n: number }>(
    "SELECT tipo, estado, COUNT(*) AS n FROM outbox WHERE usuario_id = ? AND estado <> 'ok' GROUP BY tipo, estado", [usuarioId]);
  const c: Contagens = { pendentes: 0, enviando: 0, atencao: 0 };
  for (const l of linhas) {
    if (!contaComoPendencia(l)) continue;
    if (l.estado === 'pendente') c.pendentes += l.n; else if (l.estado === 'enviando') c.enviando += l.n; else c.atencao += l.n;
  }
  return c;
};

/** Trabalho não sincronizado de OUTROS técnicos neste aparelho (para bloquear a troca de técnico sem perder dados). */
export const pendenciasDeOutros = async (b: Banco, usuarioId: number): Promise<number> => {
  const ops = (await b.first<{ n: number }>("SELECT COUNT(*) AS n FROM outbox WHERE usuario_id <> ? AND estado <> 'ok' AND tipo <> 'rascunho'", [usuarioId]))?.n ?? 0;
  const rascunhos = (await b.first<{ n: number }>('SELECT COUNT(*) AS n FROM rascunhos WHERE usuario_id <> ?', [usuarioId]))?.n ?? 0;
  return ops + rascunhos;
};

/**
 * O backup do rascunho no servidor é "só o mais novo": se já há um esperando para sair, ele é substituído em vez de
 * empilhar versões. Um que já está sendo enviado não é tocado (entra o seguinte na fila).
 */
export const coalescerRascunho = (b: Banco, n: Extract<NovaOperacao, { tipo: 'rascunho' }>, agora: number = Date.now()): Promise<Operacao> => b.transacao(async (tx) => {
  const existente = await tx.first<{ id: number }>(
    "SELECT id FROM outbox WHERE usuario_id = ? AND os_id = ? AND tipo = 'rascunho' AND estado = 'pendente' ORDER BY id DESC LIMIT 1", [n.usuario_id, n.os_id]);
  if (!existente) return enfileirar(tx, n, agora);
  await tx.run('UPDATE outbox SET payload = ?, atualizado_em = ?, proxima_tentativa = 0 WHERE id = ?', [JSON.stringify(n.payload), iso(agora), existente.id]);
  return (await obter(tx, existente.id))!;
});

/** O servidor apaga o rascunho ao finalizar; um backup pendente depois disso só daria 409. */
export const cancelarRascunhosPendentes = async (b: Banco, usuarioId: number, osId: number): Promise<number> =>
  (await b.run("DELETE FROM outbox WHERE usuario_id = ? AND os_id = ? AND tipo = 'rascunho' AND estado IN ('pendente','atencao')", [usuarioId, osId])).alteradas;
