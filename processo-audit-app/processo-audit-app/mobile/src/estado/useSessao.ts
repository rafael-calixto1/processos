import { useSyncExternalStore } from 'react';
import type { EstadoSessao } from '@/auth/gerenciadorSessao';
import { useApp } from './AppProvider';

export const useEstadoSessao = (): EstadoSessao => {
  const { sessao } = useApp();
  return useSyncExternalStore(sessao.assinar, sessao.getEstado, sessao.getEstado);
};
