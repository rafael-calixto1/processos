import { useMemo } from 'react';
import { htmlDoTrecho } from '@/domain/mapa';
import type { RotaTrecho } from '@/domain/trecho';
import { PaginaMapa } from './PaginaMapa';

interface Props { rota: RotaTrecho; online: boolean; origem?: string }

/** O trecho já marcado, desenhado no mapa (somente leitura): I verde, pontos do meio azuis, F vermelho e o caminho. */
export function MapaDoTrecho({ rota, online, origem }: Props) {
  const html = useMemo(() => htmlDoTrecho({ pontos: rota.pontos, caminho: rota.caminho }), [rota]);
  return <PaginaMapa html={html} online={online} origem={origem} altura={200} testID="mapa-do-trecho" rotulo={`Mapa do trecho com ${rota.pontos.length} pontos`} />;
}
