import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import * as Crypto from 'expo-crypto';
import { NetworkError, mensagemDeErro } from '@/api/erros';
import { lerDados, lerMeta, type Dados } from '@/db/repositorio';
import { garantirDono, iniciarExecucao, sincronizar } from '@/sync/sincronizar';
import { useApp } from './AppProvider';
import { useOnline } from './rede';
import { useEstadoSessao } from './useSessao';

interface Valor {
  dados: Dados | null;
  carregado: boolean; // já leu o que estava guardado no aparelho
  sincronizando: boolean;
  semConexao: boolean; // a última tentativa falhou por falta de rede: mostrando dados guardados
  erro: string | null; // erro do servidor (diferente de falta de rede)
  sincronizadoEm: string | null; // quando ESTE aparelho baixou os dados pela última vez
  atualizar: () => Promise<void>;
  iniciarOS: (id: number) => Promise<void>;
}
const Contexto = createContext<Valor | null>(null);
export const useDados = (): Valor => {
  const v = useContext(Contexto);
  if (!v) throw new Error('useDados fora do DadosProvider');
  return v;
};

const INTERVALO_MINIMO_MS = 60_000;

/**
 * Fonte de verdade da tela: o espelho local (SQLite). Mostra o que está guardado na hora e atualiza em segundo plano
 * ao entrar, ao voltar para o app e ao recuperar a conexão. Falta de rede nunca apaga nem esconde os dados.
 */
export function DadosProvider({ children }: { children: ReactNode }) {
  const { banco, api } = useApp();
  const sessao = useEstadoSessao();
  const online = useOnline();
  const usuarioId = sessao.status === 'logado' ? sessao.usuario.id : null;

  const [estado, setEstado] = useState<Omit<Valor, 'atualizar' | 'iniciarOS'>>({ dados: null, carregado: false, sincronizando: false, semConexao: false, erro: null, sincronizadoEm: null });
  const emAndamento = useRef<Promise<void> | null>(null);
  const ultimaTentativa = useRef(0);

  const recarregar = useCallback(async () => {
    const [dados, sincronizadoEm] = await Promise.all([lerDados(banco), lerMeta(banco, 'sincronizado_em')]);
    setEstado((e) => ({ ...e, dados, sincronizadoEm, carregado: true }));
  }, [banco]);

  const atualizar = useCallback((): Promise<void> => {
    if (emAndamento.current) return emAndamento.current;
    ultimaTentativa.current = Date.now();
    setEstado((e) => ({ ...e, sincronizando: true, erro: null }));
    const trabalho = (async () => {
      try {
        await sincronizar(api, banco);
        await recarregar();
        setEstado((e) => ({ ...e, semConexao: false, erro: null }));
      } catch (e) {
        setEstado((s) => (e instanceof NetworkError ? { ...s, semConexao: true } : { ...s, erro: mensagemDeErro(e) }));
      } finally {
        setEstado((s) => ({ ...s, sincronizando: false }));
        emAndamento.current = null;
      }
    })();
    emAndamento.current = trabalho;
    return trabalho;
  }, [api, banco, recarregar]);

  // Entrou (ou trocou de técnico): confere o dono dos dados, mostra o que há guardado e atualiza.
  useEffect(() => {
    if (usuarioId === null) { setEstado({ dados: null, carregado: false, sincronizando: false, semConexao: false, erro: null, sincronizadoEm: null }); return; }
    let vivo = true;
    (async () => {
      await garantirDono(banco, usuarioId);
      if (!vivo) return;
      await recarregar();
      if (vivo) void atualizar();
    })().catch((e) => { if (vivo) setEstado((s) => ({ ...s, carregado: true, erro: mensagemDeErro(e) })); });
    return () => { vivo = false; };
  }, [usuarioId, banco, recarregar, atualizar]);

  // Voltou para o app depois de um tempo: atualiza.
  useEffect(() => {
    if (usuarioId === null) return;
    const inscricao = AppState.addEventListener('change', (s) => {
      if (s === 'active' && Date.now() - ultimaTentativa.current > INTERVALO_MINIMO_MS) void atualizar();
    });
    return () => inscricao.remove();
  }, [usuarioId, atualizar]);

  // A conexão voltou: atualiza (e some o aviso de "sem conexão" assim que der certo).
  const eraOnline = useRef(online);
  useEffect(() => {
    if (usuarioId !== null && online && !eraOnline.current) void atualizar();
    eraOnline.current = online;
  }, [online, usuarioId, atualizar]);

  const iniciarOS = useCallback(async (id: number) => {
    await iniciarExecucao(api, banco, id, { novaChave: () => Crypto.randomUUID() });
    await recarregar();
  }, [api, banco, recarregar]);

  const valor = useMemo<Valor>(() => ({ ...estado, atualizar, iniciarOS }), [estado, atualizar, iniciarOS]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
