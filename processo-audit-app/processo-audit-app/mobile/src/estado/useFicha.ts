import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, NetworkError, mensagemDeErro } from '@/api/erros';
import { lerFicha, salvarFicha } from '@/db/repositorio';
import { normalizarFicha, type Ficha } from '@/domain/ficha';
import { useApp } from './AppProvider';
import { useOnline } from './rede';

export interface EstadoFicha {
  ficha: Ficha | null; // a última baixada (do aparelho enquanto a nova não chega)
  baixadaEm: string | null;
  carregando: boolean; // ainda lendo o aparelho ou baixando e nada para mostrar
  atualizando: boolean;
  semConexao: boolean;
  erro: string | null;
  atualizar: () => Promise<void>;
}

/**
 * A ficha vem do servidor ao abrir a tela (e em "Atualizar"); a última versão fica guardada no aparelho para consultar sem sinal.
 * Falta de rede ou erro do servidor NUNCA apagam o que já está guardado: avisam e mantêm a ficha antiga, com a hora em que foi baixada.
 */
export const useFicha = (): EstadoFicha => {
  const { api, banco } = useApp();
  const online = useOnline();
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [baixadaEm, setBaixadaEm] = useState<string | null>(null);
  const [lido, setLido] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [semConexao, setSemConexao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const vivo = useRef(true);
  const emAndamento = useRef<Promise<void> | null>(null);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);

  const atualizar = useCallback((): Promise<void> => {
    if (emAndamento.current) return emAndamento.current;
    const trabalho = (async () => {
      setAtualizando(true); setErro(null);
      try {
        const nova = normalizarFicha(await api.minhaFicha());
        if (!nova) throw new ApiError(502, 'O servidor devolveu a ficha num formato que o aplicativo não entende. Tente de novo mais tarde.');
        const quando = new Date().toISOString();
        await salvarFicha(banco, nova, quando).catch(() => undefined); // não guardar no aparelho não impede de mostrar
        if (!vivo.current) return;
        setFicha(nova); setBaixadaEm(quando); setSemConexao(false);
      } catch (e) {
        if (!vivo.current) return;
        if (e instanceof NetworkError) setSemConexao(true); else setErro(mensagemDeErro(e));
      } finally {
        if (vivo.current) setAtualizando(false);
        emAndamento.current = null;
      }
    })();
    emAndamento.current = trabalho;
    return trabalho;
  }, [api, banco]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const guardada = await lerFicha(banco).catch(() => null);
      if (!ativo) return;
      if (guardada) { setFicha(guardada.ficha); setBaixadaEm(guardada.baixadaEm); }
      setLido(true);
      if (online) void atualizar(); else setSemConexao(true);
    })();
    return () => { ativo = false; };
    // abre a tela: lê o aparelho e tenta baixar uma vez; mudanças de rede depois disso não refazem o pedido sozinhas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banco]);

  return { ficha, baixadaEm, carregando: !lido || (atualizando && !ficha), atualizando, semConexao, erro, atualizar };
};
