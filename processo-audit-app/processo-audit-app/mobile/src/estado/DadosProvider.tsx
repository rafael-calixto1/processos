import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import * as Crypto from 'expo-crypto';
import { NetworkError, mensagemDeErro } from '@/api/erros';
import { contagens as lerContagens, type Contagens } from '@/db/outbox';
import { lerMeta } from '@/db/repositorio';
import type { Operacao } from '@/domain/operacoes';
import type { DetalheOS } from '@/domain/tipos';
import type { DadosVisao } from '@/domain/visao';
import { carregarEstadoLocal } from '@/sync/estadoLocal';
import * as cmd from '@/sync/operacoes';
import { MotorOutbox } from '@/sync/outbox';
import { descartarTudoLocal, garantirDono, sincronizar } from '@/sync/sincronizar';
import { useApp } from './AppProvider';
import { descricaoDispositivo, versaoApp } from './dispositivo';
import { useOnline } from './rede';
import { useEstadoSessao } from './useSessao';

/** Os comandos de campo, já ligados ao técnico logado: gravam na fila, atualizam a tela e disparam o envio se houver rede. */
export interface Comandos {
  iniciarOS: (osId: number) => Promise<void>;
  registrarLancamento: (e: cmd.EntradaLancamento) => Promise<void>;
  substituirLancamento: (operacaoId: number, e: Omit<cmd.EntradaLancamento, 'osId'>) => Promise<void>;
  removerLancamento: (operacaoId: number) => Promise<void>;
  adicionarFoto: (e: cmd.EntradaFoto) => Promise<{ clientUuid: string }>;
  removerFoto: (osId: number, clientUuid: string) => Promise<void>;
  salvarRascunho: (osId: number, r: Parameters<typeof cmd.salvarRascunhoLocal>[2]) => Promise<void>;
  finalizar: (osId: number) => Promise<void>;
  voltarAEditar: (osId: number) => Promise<void>;
  solicitarDevolucao: (e: cmd.EntradaDevolucao) => Promise<void>;
  reenviar: (operacaoId: number, opcoes?: { forcar?: boolean }) => Promise<void>;
  descartar: (operacaoId: number) => Promise<void>;
}

export interface Bloqueio { pendencias: number; donoNome: string | null }

interface Valor {
  dados: DadosVisao | null; // o que o técnico vê: retrato do servidor + o que ainda não foi enviado
  detalhes: Record<number, DetalheOS>;
  ops: Operacao[]; // todas as operações do técnico (lançamentos, fotos, atenção...)
  carregado: boolean; // já leu o que estava guardado no aparelho
  sincronizando: boolean; // enviando ou baixando agora
  semConexao: boolean; // a última tentativa falhou por falta de rede: mostrando dados guardados
  erro: string | null; // erro do servidor ao baixar (diferente de falta de rede)
  sincronizadoEm: string | null; // quando ESTE aparelho baixou os dados pela última vez
  contagens: Contagens;
  pausadoPorSessao: boolean; // o login foi recusado: nada é enviado até entrar de novo (os dados ficam guardados)
  bloqueio: Bloqueio | null; // outro técnico deixou trabalho não enviado neste aparelho
  atualizar: () => Promise<void>; // "Sincronizar agora": envia o que está na fila e baixa o retrato novo
  comandos: Comandos;
  descartarTudo: () => Promise<void>; // descarte CONFIRMADO de todo o trabalho local (tela de bloqueio)
}
const Contexto = createContext<Valor | null>(null);
export const useDados = (): Valor => {
  const v = useContext(Contexto);
  if (!v) throw new Error('useDados fora do DadosProvider');
  return v;
};

const INTERVALO_MINIMO_MS = 60_000;
const SEM_CONTAGEM: Contagens = { pendentes: 0, enviando: 0, atencao: 0 };

/**
 * Fonte de verdade da tela: o espelho local (SQLite) com o trabalho da fila por cima. Mostra o que está guardado na hora e,
 * em segundo plano, ENVIA o que o técnico fez e BAIXA o retrato novo: ao entrar, ao voltar para o app, ao recuperar a conexão,
 * depois de cada ação e na hora marcada para o reenvio. Falta de rede nunca apaga nem esconde nada.
 */
export function DadosProvider({ children }: { children: ReactNode }) {
  const { banco, api, arquivos } = useApp();
  const sessao = useEstadoSessao();
  const online = useOnline();
  const usuario = sessao.status === 'logado' ? sessao.usuario : null;
  const usuarioId = usuario?.id ?? null;
  const usuarioNome = usuario?.name ?? '';

  const [estado, setEstado] = useState<Awaited<ReturnType<typeof carregarEstadoLocal>>>(null);
  const [carregado, setCarregado] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [semConexao, setSemConexao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sincronizadoEm, setSincronizadoEm] = useState<string | null>(null);
  const [contagens, setContagens] = useState<Contagens>(SEM_CONTAGEM);
  const [pausadoPorSessao, setPausadoPorSessao] = useState(false);
  const [bloqueio, setBloqueio] = useState<Bloqueio | null>(null);

  const motor = useRef<MotorOutbox | null>(null);
  const emAndamento = useRef<Promise<void> | null>(null);
  const ultimoDownload = useRef(0);
  const ultimoBackup = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; if (timer.current) clearTimeout(timer.current); }; }, []);

  const recarregar = useCallback(async () => {
    if (usuarioId === null) return;
    const [e, c, quando] = await Promise.all([carregarEstadoLocal(banco, usuarioId), lerContagens(banco, usuarioId), lerMeta(banco, 'sincronizado_em')]);
    if (!vivo.current) return;
    setEstado(e); setContagens(c); setSincronizadoEm(quando); setCarregado(true);
  }, [banco, usuarioId]);

  /** Deixa um envio agendado para a hora em que a próxima operação em espera poderá ser tentada. */
  const agendar = useCallback((quando: number | null, enviar: () => Promise<unknown>) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (quando === null) return;
    timer.current = setTimeout(() => { timer.current = null; void enviar(); }, Math.max(quando - Date.now(), 1000));
  }, []);

  /** Só envia a fila (barato; usado depois de cada ação e no reenvio agendado). */
  const enviar = useCallback(async (opcoes: { ignorarEspera?: boolean } = {}): Promise<{ semConexao: boolean; sessaoPerdida: boolean }> => {
    const m = motor.current;
    if (!m) return { semConexao: false, sessaoPerdida: false };
    const r = await m.executar(opcoes);
    if (!vivo.current) return r;
    setSemConexao(r.semConexao);
    if (r.sessaoPerdida) setPausadoPorSessao(true);
    agendar(r.proximaTentativaEm, () => enviar());
    await recarregar();
    return r;
  }, [agendar, recarregar]);

  /** "Sincronizar agora": envia o que está na fila e depois baixa o retrato novo do servidor. Uma de cada vez. */
  const atualizar = useCallback((): Promise<void> => {
    if (emAndamento.current) return emAndamento.current;
    if (usuarioId === null) return Promise.resolve();
    ultimoDownload.current = Date.now();
    setSincronizando(true); setErro(null);
    const trabalho = (async () => {
      try {
        const r = await enviar({ ignorarEspera: true }); // ação explícita ou rede de volta: tenta já
        if (r.sessaoPerdida) return; // sem login válido não adianta baixar
        if (r.semConexao) return; // sem rede: fica com o que há
        await sincronizar(api, banco, { usuarioId });
        await recarregar();
        if (vivo.current) setSemConexao(false);
      } catch (e) {
        if (!vivo.current) return;
        if (e instanceof NetworkError) setSemConexao(true); else setErro(mensagemDeErro(e));
      } finally {
        if (vivo.current) setSincronizando(false);
        emAndamento.current = null;
      }
    })();
    emAndamento.current = trabalho;
    return trabalho;
  }, [api, banco, enviar, recarregar, usuarioId]);

  // Entrou (ou trocou de técnico): confere o dono dos dados; se estiver tudo certo, retoma o que ficou na fila e atualiza.
  useEffect(() => {
    setEstado(null); setCarregado(false); setContagens(SEM_CONTAGEM); setBloqueio(null); setPausadoPorSessao(false); setErro(null); setSemConexao(false);
    motor.current = null;
    if (usuarioId === null) return;
    let ativo = true;
    (async () => {
      const dono = await garantirDono(banco, { id: usuarioId, nome: usuarioNome }, arquivos.apagar);
      if (!ativo) return;
      if (dono.bloqueado) { setBloqueio({ pendencias: dono.pendencias, donoNome: dono.donoNome }); setCarregado(true); return; }
      const m = new MotorOutbox({ banco, api, usuarioId, arquivos });
      motor.current = m;
      const parar = m.assinar(() => { void recarregar(); });
      await m.recuperar();
      await recarregar();
      if (!ativo) { parar(); return; }
      void atualizar();
    })().catch((e) => { if (ativo) { setErro(mensagemDeErro(e)); setCarregado(true); } });
    return () => { ativo = false; motor.current = null; if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId, banco, api, arquivos]);

  // Voltou para o app: envia a fila e, se faz um tempo que não baixa, atualiza.
  useEffect(() => {
    if (usuarioId === null) return;
    const inscricao = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      if (Date.now() - ultimoDownload.current > INTERVALO_MINIMO_MS) void atualizar(); else void enviar({ ignorarEspera: true });
    });
    return () => inscricao.remove();
  }, [usuarioId, atualizar, enviar]);

  // A conexão voltou: manda o que ficou na fila e atualiza.
  const eraOnline = useRef(online);
  useEffect(() => {
    if (usuarioId !== null && online && !eraOnline.current) void atualizar();
    eraOnline.current = online;
  }, [online, usuarioId, atualizar]);

  const ctx = useMemo<cmd.ContextoComandos | null>(() => (usuarioId === null ? null : {
    banco, usuarioId, uuid: () => Crypto.randomUUID(), dispositivo: descricaoDispositivo(), versaoApp: versaoApp(), arquivos,
  }), [banco, usuarioId, arquivos]);

  /** Executa um comando, mostra o resultado na tela e, havendo rede, já manda para o servidor. */
  const comando = useCallback(async <T,>(f: (c: cmd.ContextoComandos) => Promise<T>): Promise<T> => {
    if (!ctx) throw new cmd.ErroOperacao('Entre no aplicativo para continuar.');
    const r = await f(ctx);
    await recarregar();
    if (online) void enviar();
    return r;
  }, [ctx, online, enviar, recarregar]);

  const comandos = useMemo<Comandos>(() => ({
    iniciarOS: async (osId) => { await comando((c) => cmd.iniciarOS(c, osId)); },
    registrarLancamento: async (e) => { await comando((c) => cmd.registrarLancamento(c, e)); },
    substituirLancamento: async (id, e) => { await comando((c) => cmd.substituirLancamento(c, id, e)); },
    removerLancamento: (id) => comando((c) => cmd.removerLancamento(c, id)),
    adicionarFoto: (e) => comando((c) => cmd.adicionarFoto(c, e)),
    removerFoto: (osId, uuid) => comando((c) => cmd.removerFotoDaOS(c, osId, uuid)),
    // o rascunho não muda nada que as listas mostrem: não recarrega a tela a cada tecla, e a cópia no servidor sai no máximo a cada 20 s
    salvarRascunho: async (osId, r) => {
      if (!ctx) throw new cmd.ErroOperacao('Entre no aplicativo para continuar.');
      await cmd.salvarRascunhoLocal(ctx, osId, r);
      if (online && Date.now() - ultimoBackup.current > 20_000) { ultimoBackup.current = Date.now(); void enviar(); }
    },
    finalizar: async (osId) => { await comando((c) => cmd.finalizarOS(c, osId)); },
    voltarAEditar: (osId) => comando((c) => cmd.voltarAEditar(c, osId)),
    solicitarDevolucao: async (e) => { await comando((c) => cmd.solicitarDevolucao(c, e)); },
    reenviar: (id, opcoes) => comando((c) => cmd.reenviarOperacao(c, id, opcoes)),
    descartar: (id) => comando((c) => cmd.descartarOperacao(c, id)),
  }), [comando, ctx, online, enviar]);

  const descartarTudo = useCallback(async () => {
    await descartarTudoLocal(banco, arquivos.apagar);
    setBloqueio(null);
    setEstado(null);
    if (usuarioId !== null) {
      const dono = await garantirDono(banco, { id: usuarioId, nome: usuarioNome }, arquivos.apagar);
      if (!dono.bloqueado) {
        const m = new MotorOutbox({ banco, api, usuarioId, arquivos });
        motor.current = m;
        m.assinar(() => { void recarregar(); });
        await recarregar();
        void atualizar();
      }
    }
  }, [banco, arquivos, usuarioId, usuarioNome, api, recarregar, atualizar]);

  const valor = useMemo<Valor>(() => ({
    dados: estado?.visao ?? null, detalhes: estado?.detalhes ?? {}, ops: estado?.ops ?? [], carregado, sincronizando, semConexao, erro, sincronizadoEm,
    contagens, pausadoPorSessao, bloqueio, atualizar, comandos, descartarTudo,
  }), [estado, carregado, sincronizando, semConexao, erro, sincronizadoEm, contagens, pausadoPorSessao, bloqueio, atualizar, comandos, descartarTudo]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
