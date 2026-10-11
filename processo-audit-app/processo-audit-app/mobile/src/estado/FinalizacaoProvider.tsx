import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { mensagemDeErro } from '@/api/erros';
import { lerRascunho, listarFotos, type FotoLocal } from '@/db/trabalho';
import { etapasConcluidas, podeFinalizar, progresso as calcularProgresso, rascunhoVazio, type ChaveEtapa, type ContextoEtapas, type Rascunho } from '@/domain/etapas';
import { isPendente } from '@/domain/os';
import { fotosDaOS, lancamentosComMaterial, lancamentosDaOS, type DadosVisao, type LancamentoVisao, type OSVisao } from '@/domain/visao';
import { useApp } from './AppProvider';
import { useDados } from './DadosProvider';

const ATRASO_SALVAR_MS = 700;

export interface ValorFinalizacao {
  osId: number;
  os: OSVisao | undefined;
  dados: DadosVisao | null;
  carregado: boolean;
  /** Rascunho em edição. `fotos` já vem das fotos reais da OS, não do que o rascunho lembra. */
  rascunho: Rascunho;
  alterar: (fn: (r: Rascunho) => Rascunho) => void;
  salvarAgora: () => Promise<void>;
  erroSalvar: string | null;
  fotos: FotoLocal[]; // as do aparelho (não removidas)
  totalFotos: number; // aparelho + as que só o servidor conhece
  lancamentos: LancamentoVisao[];
  contexto: ContextoEtapas;
  concluidas: Record<ChaveEtapa, boolean>;
  progresso: { feitas: number; total: number };
  pode: boolean;
  /** Pode mexer: a OS está aberta e a finalização ainda não foi para a fila. */
  editavel: boolean;
}
const Contexto = createContext<ValorFinalizacao | null>(null);
export const useFinalizacao = (): ValorFinalizacao => {
  const v = useContext(Contexto);
  if (!v) throw new Error('useFinalizacao fora do FinalizacaoProvider');
  return v;
};

/**
 * Estado compartilhado por todas as telas da finalização de UMA OS: o rascunho (salvo no aparelho a cada alteração, com
 * ~700 ms de atraso, ao sair da tela e ao ir para segundo plano), as fotos, os lançamentos e o andamento das etapas.
 */
export function FinalizacaoProvider({ osId, children }: { osId: number; children: ReactNode }) {
  const { banco } = useApp();
  const { dados, detalhes, ops, comandos } = useDados();
  const os = dados?.os.find((o) => o.id === osId);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const atual = useRef<Rascunho | null>(null);
  const sujo = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    let ativo = true;
    lerRascunho(banco, osId).then((r) => { if (ativo) { atual.current = r ?? rascunhoVazio(); setRascunho(atual.current); } });
    return () => { ativo = false; vivo.current = false; };
  }, [banco, osId]);

  // as fotos acompanham a fila (tirar, enviar, remover)
  useEffect(() => {
    let ativo = true;
    listarFotos(banco, osId).then((f) => { if (ativo) setFotos(f); });
    return () => { ativo = false; };
  }, [banco, osId, ops]);

  const salvarAgora = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (!sujo.current || !atual.current) return;
    sujo.current = false;
    try {
      await comandos.salvarRascunho(osId, atual.current);
      if (vivo.current) setErroSalvar(null);
    } catch (e) {
      sujo.current = true;
      if (vivo.current) setErroSalvar(mensagemDeErro(e));
    }
  }, [comandos, osId]);

  const alterar = useCallback((fn: (r: Rascunho) => Rascunho) => {
    const base = atual.current ?? rascunhoVazio();
    atual.current = fn(base);
    sujo.current = true;
    setRascunho(atual.current);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void salvarAgora(); }, ATRASO_SALVAR_MS);
  }, [salvarAgora]);

  // ao ir para segundo plano (ou receber uma ligação) e ao sair das telas, grava na hora
  useEffect(() => {
    const inscricao = AppState.addEventListener('change', (s) => { if (s !== 'active') void salvarAgora(); });
    return () => { inscricao.remove(); void salvarAgora(); };
  }, [salvarAgora]);

  const detalhe = detalhes[osId] ?? null;
  const lancamentos = useMemo(() => lancamentosDaOS(osId, detalhe, ops), [osId, detalhe, ops]);
  const uuidsFotos = useMemo(() => fotosDaOS(fotos, detalhe), [fotos, detalhe]);

  const valor = useMemo<ValorFinalizacao>(() => {
    const r = { ...(rascunho ?? rascunhoVazio()), fotos: uuidsFotos };
    const contexto: ContextoEtapas = {
      checklist: dados?.checklist ?? [],
      lancamentosComMaterial: lancamentosComMaterial(osId, detalhe, ops),
      regras: { descricao_min_caracteres: dados?.regras.descricao_min_caracteres ?? 11, fotos_min: dados?.regras.fotos_min ?? 1 },
    };
    const naFila = os ? os.finalizacao !== 'nenhuma' : false;
    return {
      osId, os, dados, carregado: rascunho !== null && dados !== null, rascunho: r, alterar, salvarAgora, erroSalvar, fotos, totalFotos: uuidsFotos.length, lancamentos, contexto,
      concluidas: etapasConcluidas(r, contexto), progresso: calcularProgresso(r, contexto), pode: podeFinalizar(r, contexto),
      editavel: Boolean(os && isPendente(os.status) && !naFila),
    };
  }, [osId, os, dados, rascunho, alterar, salvarAgora, erroSalvar, fotos, uuidsFotos, lancamentos, detalhe, ops]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
