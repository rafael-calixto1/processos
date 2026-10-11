import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { criarApi, type Api } from '@/api/endpoints';
import { criarFormularioFoto } from '@/api/formulario';
import { ApiClient } from '@/api/client';
import { NetworkError, mensagemDeErro } from '@/api/erros';
import { armazenamentoSeguro } from '@/auth/armazenamentoNativo';
import { GerenciadorSessao } from '@/auth/gerenciadorSessao';
import { Carregando } from '@/components/Carregando';
import { EstadoVazio } from '@/components/EstadoVazio';
import { ConfigServidor } from '@/config/servidor';
import { ConfigTema } from '@/config/tema';
import { aplicarPreferencia } from './tema';
import type { Banco } from '@/db/banco';
import { abrirBanco } from '@/db/expoBanco';
import type { PortaArquivos } from '@/sync/outbox';
import { portaArquivos } from './arquivos';
import { descricaoDispositivo } from './dispositivo';

export interface Servicos { sessao: GerenciadorSessao; api: Api; banco: Banco; servidor: ConfigServidor; tema: ConfigTema; arquivos: PortaArquivos }
const Contexto = createContext<Servicos | null>(null);

export const useApp = (): Servicos => {
  const s = useContext(Contexto);
  if (!s) throw new Error('useApp fora do AppProvider');
  return s;
};

const montar = async (): Promise<Servicos> => {
  const servidor = new ConfigServidor(armazenamentoSeguro, process.env.EXPO_PUBLIC_API_URL);
  await servidor.carregar();
  const tema = new ConfigTema(armazenamentoSeguro);
  aplicarPreferencia(await tema.carregar()); // antes da primeira tela: sem piscar do claro para o escuro
  const ref: { sessao?: GerenciadorSessao } = {};
  const cliente = new ApiClient({
    baseUrl: () => {
      const url = servidor.url();
      if (!url) throw new NetworkError('Informe o endereço do servidor na tela de login.');
      return url;
    },
    tokens: { tokenDeAcesso: () => ref.sessao!.tokenDeAcesso(), renovar: () => ref.sessao!.renovar(), sessaoPerdida: () => ref.sessao!.sessaoPerdida() },
  });
  const api = criarApi(cliente, { criarFormulario: criarFormularioFoto });
  const sessao = new GerenciadorSessao({ armazenamento: armazenamentoSeguro, api: () => api, dispositivo: descricaoDispositivo });
  ref.sessao = sessao;
  const [banco] = await Promise.all([abrirBanco(), sessao.restaurar()]);
  return { sessao, api, banco, servidor, tema, arquivos: portaArquivos };
};

/** Monta uma vez o servidor configurado, a sessão (restaurada do cofre) e o banco local; até lá mostra "Carregando". */
export function AppProvider({ children }: { children: ReactNode }) {
  const [servicos, setServicos] = useState<Servicos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    setErro(null);
    montar().then((s) => { if (vivo) setServicos(s); }).catch((e) => { if (vivo) setErro(mensagemDeErro(e)); });
    return () => { vivo = false; };
  }, [tentativa]);

  if (erro) return <EstadoVazio icone="alert-circle-outline" titulo="Não foi possível iniciar o app" texto={erro} acao={{ rotulo: 'Tentar de novo', onPress: () => setTentativa((t) => t + 1) }} />;
  if (!servicos) return <Carregando texto="Iniciando…" />;
  return <Contexto.Provider value={servicos}>{children}</Contexto.Provider>;
}
