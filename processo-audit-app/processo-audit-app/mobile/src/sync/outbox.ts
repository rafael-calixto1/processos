import { ApiError, ArquivoAusenteError, NetworkError } from '@/api/erros';
import type { Api } from '@/api/endpoints';
import type { Banco } from '@/db/banco';
import {
  atualizarPayload, cancelarRascunhosPendentes, concluirOk, liberarEspera, marcarAtencao, proximaHora, proximaPronta, reagendar, recuperarEnviando, reservar,
} from '@/db/outbox';
import { apagarFoto, apagarRascunho, definirServidorId, limparArquivoDaFoto, listarFotos, obterFoto } from '@/db/trabalho';
import { montarRota, reduzirCaminho } from '@/domain/trecho';
import { DIAS_MAX_OPERACAO, DIAS_MAX_REENVIO_FORCADO, idadeEmDias, type ErroOp, type Operacao } from '@/domain/operacoes';

/** O que o motor usa da API (as funções do `criarApi`). */
export type ApiMotor = Pick<Api, 'iniciarOS' | 'lancar' | 'enviarFoto' | 'removerFoto' | 'finalizar' | 'salvarRascunho' | 'solicitarDevolucao' | 'rotaPorVias'>;

export interface PortaArquivos {
  existe(uri: string): Promise<boolean>;
  apagar(uri: string): Promise<void>;
}

export interface PortasMotor {
  banco: Banco;
  api: ApiMotor;
  usuarioId: number;
  arquivos?: PortaArquivos;
  agora?: () => number;
  aleatorio?: () => number; // 0..1, para o jitter do backoff
  backoffBaseMs?: number;
  backoffTetoMs?: number;
}

export interface ResultadoRodada {
  enviadas: number; // confirmadas pelo servidor nesta rodada
  atencao: number; // viraram "requer atenção" nesta rodada
  semConexao: boolean; // a rodada parou porque não deu para falar com o servidor
  sessaoPerdida: boolean; // a renovação do login foi recusada: nada mais é enviado até entrar de novo
  proximaTentativaEm: number | null; // quando a próxima operação pendente poderá ser tentada
}

const ERRO_EM_ANDAMENTO = /ainda est[áa] em andamento/i;

type Veredito =
  | { tipo: 'passageiro'; esperaMs?: number; semConexao?: boolean }
  | { tipo: 'ignorada' } // cópia de segurança recusada: nada a pedir ao técnico
  | { tipo: 'atencao'; erro: ErroOp }
  | { tipo: 'sessao' };

/**
 * Decide o destino de um erro. Falta de rede, 5xx, 429 e "operação ainda em andamento" (um reenvio que chegou enquanto o
 * primeiro envio ainda terminava) são passageiros: tenta de novo mais tarde. Recusa por regra (400/403/404/409/422)
 * nunca é reenviada às cegas: vira "requer atenção" com a mensagem do servidor. Login recusado pausa tudo.
 */
export const classificarErro = (e: unknown): Veredito => {
  if (e instanceof NetworkError) return { tipo: 'passageiro', semConexao: true };
  if (e instanceof ArquivoAusenteError) return { tipo: 'atencao', erro: { status: null, mensagem: `${e.message} Remova a foto e tire outra.` } };
  if (e instanceof ApiError) {
    if (e.code === 'sessao_expirada' || e.status === 401) return { tipo: 'sessao' };
    if (e.status >= 500 || e.status === 408) return { tipo: 'passageiro' };
    if (e.status === 429) return { tipo: 'passageiro', esperaMs: (e.retryAfter ?? 0) * 1000 };
    if (e.status === 409 && ERRO_EM_ANDAMENTO.test(e.message)) return { tipo: 'passageiro' };
    return { tipo: 'atencao', erro: { status: e.status, mensagem: e.message, ...(e.detalhes && { detalhes: e.detalhes }) } };
  }
  return { tipo: 'passageiro' }; // erro inesperado do próprio app: não descarta nada; o limite de tentativas abaixo evita laço eterno
};

const MAX_TENTATIVAS_INESPERADAS = 8;

export class MotorOutbox {
  private readonly p: PortasMotor & Required<Pick<PortasMotor, 'agora' | 'aleatorio' | 'backoffBaseMs' | 'backoffTetoMs'>>;
  private emExecucao: Promise<ResultadoRodada> | null = null;
  private pedirOutraRodada = false;
  private readonly ouvintes = new Set<() => void>();

  constructor(portas: PortasMotor) {
    this.p = { agora: Date.now, aleatorio: Math.random, backoffBaseMs: 5_000, backoffTetoMs: 15 * 60_000, ...portas };
  }

  assinar(ouvinte: () => void): () => void { this.ouvintes.add(ouvinte); return () => { this.ouvintes.delete(ouvinte); }; }
  private avisar() { this.ouvintes.forEach((o) => o()); }

  /** Ao abrir o app: o que ficou "enviando" quando ele foi encerrado volta para a fila (a chave de idempotência torna o reenvio seguro). */
  async recuperar(): Promise<number> {
    const n = await recuperarEnviando(this.p.banco);
    if (n) this.avisar();
    return n;
  }

  /** Quando a próxima operação pendente poderá ser tentada (para acordar o motor na hora certa). */
  proximaTentativaEm(): Promise<number | null> { return proximaHora(this.p.banco, this.p.usuarioId, this.p.agora()); }

  /**
   * Envia tudo o que está pronto, uma operação por vez. Chamadas durante uma rodada em andamento não abrem outra em paralelo:
   * pedem mais uma volta no fim (algo pode ter entrado na fila no meio). `ignorarEspera` é para ações explícitas do técnico
   * ou da rede (a conexão voltou): o backoff existe para não martelar o servidor, não para atrasar quem acabou de reconectar.
   */
  executar(opcoes: { ignorarEspera?: boolean } = {}): Promise<ResultadoRodada> {
    if (this.emExecucao) { this.pedirOutraRodada = true; return this.emExecucao; }
    const rodada = (async () => {
      if (opcoes.ignorarEspera) await liberarEspera(this.p.banco, this.p.usuarioId);
      const total: ResultadoRodada = { enviadas: 0, atencao: 0, semConexao: false, sessaoPerdida: false, proximaTentativaEm: null };
      try {
        do {
          this.pedirOutraRodada = false;
          const r = await this.rodada();
          total.enviadas += r.enviadas; total.atencao += r.atencao;
          total.semConexao = r.semConexao; total.sessaoPerdida = r.sessaoPerdida;
          if (r.semConexao || r.sessaoPerdida) break;
        } while (this.pedirOutraRodada);
      } finally {
        this.emExecucao = null;
      }
      total.proximaTentativaEm = await proximaHora(this.p.banco, this.p.usuarioId, this.p.agora());
      return total;
    })();
    this.emExecucao = rodada;
    return rodada;
  }

  private async rodada(): Promise<{ enviadas: number; atencao: number; semConexao: boolean; sessaoPerdida: boolean }> {
    const r = { enviadas: 0, atencao: 0, semConexao: false, sessaoPerdida: false };
    for (;;) {
      const op = await proximaPronta(this.p.banco, this.p.usuarioId, this.p.agora());
      if (!op) return r;
      if (!(await reservar(this.p.banco, op.id, this.p.agora()))) continue;
      this.avisar();

      const velha = this.recusarSeVelha(op);
      if (velha) {
        await marcarAtencao(this.p.banco, op.id, velha, this.p.agora());
        r.atencao++; this.avisar();
        continue;
      }
      try {
        const resposta = await this.enviar(op);
        await concluirOk(this.p.banco, op.id, resposta, this.p.agora());
        await this.aoConfirmar(op, resposta).catch(() => undefined); // limpeza local nunca desfaz uma confirmação do servidor
        r.enviadas++; this.avisar();
      } catch (e) {
        const v = await this.tratarErro(op, e);
        this.avisar();
        if (v.tipo === 'atencao') r.atencao++;
        if (v.tipo === 'sessao') { r.sessaoPerdida = true; return r; }
        if (v.tipo === 'passageiro' && v.semConexao) { r.semConexao = true; return r; } // sem rede: não adianta tentar as outras agora
      }
    }
  }

  /** Operação parada há muito tempo: as chaves de idempotência do servidor expiram em 60 dias, então não vai às cegas. */
  private recusarSeVelha(op: Operacao): ErroOp | null {
    if (op.tipo === 'rascunho') return null; // é só uma cópia de segurança
    const dias = idadeEmDias(op.criado_em, this.p.agora());
    if (dias > DIAS_MAX_REENVIO_FORCADO) {
      return { status: null, mensagem: `Este envio foi feito há mais de ${DIAS_MAX_REENVIO_FORCADO} dias e não pode mais ser feito com segurança. Fale com o escritório para conferir o que já foi registrado.` };
    }
    if (dias > DIAS_MAX_OPERACAO && !op.forcada) {
      return { status: null, mensagem: `Este envio foi feito há mais de ${DIAS_MAX_OPERACAO} dias e ainda não chegou ao servidor. Confira com o escritório se ele já foi registrado antes de enviar.` };
    }
    return null;
  }

  private async enviar(op: Operacao): Promise<unknown> {
    const { api, banco, arquivos } = this.p;
    switch (op.tipo) {
      case 'iniciar':
        return api.iniciarOS(op.os_id, op.payload.corpo.iniciado_em, op.chave);
      case 'lancamento':
        return api.lancar(op.os_id, await this.tracarSePreciso(op), op.chave);
      case 'finalizar':
        return api.finalizar(op.os_id, op.payload.corpo, op.chave);
      case 'foto': {
        const { arquivo, mime, campos } = op.payload;
        if (arquivos && !(await arquivos.existe(arquivo))) throw new ArquivoAusenteError();
        const texto: Record<string, string> = { client_uuid: campos.client_uuid, tirada_em: campos.tirada_em };
        if (campos.lat != null) texto.lat = String(campos.lat);
        if (campos.lng != null) texto.lng = String(campos.lng);
        if (campos.legenda) texto.legenda = campos.legenda;
        return api.enviarFoto(op.os_id, { uri: arquivo, nome: `${campos.client_uuid}.jpg`, mime }, texto, op.chave);
      }
      case 'remover_foto': {
        const foto = await obterFoto(banco, op.payload.foto_client_uuid);
        if (!foto?.servidor_id) throw new ApiError(404, 'Não foi possível identificar esta foto no servidor para removê-la. Fale com o escritório.');
        try {
          return await api.removerFoto(op.os_id, foto.servidor_id);
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) return { ok: true, ja_removida: true }; // já não existe no servidor: objetivo cumprido
          throw e;
        }
      }
      case 'devolucao':
        return api.solicitarDevolucao(op.payload.corpo, op.chave);
      case 'rascunho':
        return api.salvarRascunho(op.os_id, { versao: 2, origem: 'mobile', ...op.payload.corpo.rascunho });
    }
  }

  /**
   * O técnico pode marcar o trecho sem conseguir traçá-lo pelas ruas (sem internet no momento, serviço de rotas fora do ar):
   * a rota vai na fila só com os pontos, em linha reta. Na PRIMEIRA vez que a operação é enviada, com internet, o app tenta
   * traçar o caminho pelas vias e põe o resultado no corpo ANTES de enviar. Depois de qualquer tentativa o corpo não muda mais
   * (ele pode já ter chegado ao servidor, e a mesma chave com outro corpo é recusada). Qualquer falha aqui só mantém a linha reta.
   */
  private async tracarSePreciso(op: Extract<Operacao, { tipo: 'lancamento' }>): Promise<Extract<Operacao, { tipo: 'lancamento' }>['payload']['corpo']> {
    const corpo = op.payload.corpo;
    const rota = corpo.rota;
    if (!rota || rota.caminho.length > 0 || op.tentativas !== 0) return corpo;
    try {
      const doServidor = await this.p.api.rotaPorVias(rota.pontos, { timeoutMs: 10_000 });
      const tracada = montarRota(rota.pontos, { pontos: doServidor.pontos, metros: doServidor.metros, caminho: reduzirCaminho(doServidor.caminho) });
      if (!tracada || tracada.caminho.length < 2) return corpo;
      const novo = { ...corpo, rota: tracada };
      return (await atualizarPayload(this.p.banco, op.id, { ...op.payload, corpo: novo })) ? novo : corpo;
    } catch {
      return corpo;
    }
  }

  private async tratarErro(op: Operacao, e: unknown): Promise<Veredito> {
    const { banco } = this.p;
    const agora = this.p.agora();
    const v = classificarErro(e);
    if (op.tipo === 'rascunho' && v.tipo === 'atencao') {
      // cópia de segurança: se o servidor a recusa (OS encerrada...), não há nada a pedir ao técnico; o rascunho continua no aparelho
      await concluirOk(banco, op.id, { ignorada: true, status: v.erro.status, mensagem: v.erro.mensagem }, agora);
      return { tipo: 'ignorada' };
    }
    if (v.tipo === 'atencao') { await marcarAtencao(banco, op.id, v.erro, agora); return v; }
    if (v.tipo === 'sessao') { await reagendar(banco, op.id, 0, agora); return v; } // nada se perde: espera o novo login
    const tentativa = op.tentativas + 1; // `op` foi lido antes de a reserva contar esta tentativa
    if (!(e instanceof NetworkError) && !(e instanceof ApiError) && tentativa >= MAX_TENTATIVAS_INESPERADAS) {
      const msg = e instanceof Error ? e.message : 'erro desconhecido';
      await marcarAtencao(banco, op.id, { status: null, mensagem: `O aplicativo não conseguiu fazer este envio (${msg}). Tente de novo ou fale com o suporte.` }, agora);
      return { tipo: 'atencao', erro: { status: null, mensagem: msg } };
    }
    await reagendar(banco, op.id, agora + Math.max(this.backoff(tentativa), (v as { esperaMs?: number }).esperaMs ?? 0), agora);
    return v;
  }

  /** Espera exponencial (5 s, 10 s, 20 s... até 15 min) com jitter de 50% a 100% para vários aparelhos não baterem juntos no servidor. */
  backoff(tentativas: number): number {
    const bruto = Math.min(this.p.backoffTetoMs, this.p.backoffBaseMs * 2 ** Math.max(0, tentativas - 1));
    return Math.round(bruto * (0.5 + this.p.aleatorio() * 0.5));
  }

  /** Efeitos locais depois que o servidor confirma. Arquivo de foto só é apagado depois de confirmado. */
  private async aoConfirmar(op: Operacao, resposta: unknown): Promise<void> {
    const { banco, arquivos, usuarioId } = this.p;
    if (op.tipo === 'foto' && typeof (resposta as { id?: unknown })?.id === 'number') {
      await definirServidorId(banco, op.payload.campos.client_uuid, (resposta as { id: number }).id);
    } else if (op.tipo === 'remover_foto') {
      const foto = await obterFoto(banco, op.payload.foto_client_uuid);
      if (foto?.arquivo) await arquivos?.apagar(foto.arquivo).catch(() => undefined);
      await apagarFoto(banco, op.payload.foto_client_uuid);
    } else if (op.tipo === 'rascunho') {
      await banco.run('DELETE FROM outbox WHERE id = ?', [op.id]); // cópia de segurança entregue: não precisa de histórico
    } else if (op.tipo === 'finalizar') {
      await apagarRascunho(banco, op.os_id);
      await cancelarRascunhosPendentes(banco, usuarioId, op.os_id);
      for (const f of await listarFotos(banco, op.os_id)) {
        if (f.servidor_id && f.arquivo) { await arquivos?.apagar(f.arquivo).catch(() => undefined); await limparArquivoDaFoto(banco, f.client_uuid); }
      }
    }
  }
}
