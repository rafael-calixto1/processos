import { useMemo } from 'react';
import { htmlDoMapa } from '@/domain/mapa';
import { PaginaMapa } from './PaginaMapa';

interface Props { lat: number; lng: number; precisaoM?: number | null; online: boolean; origem?: string }

/** Mapa do ponto registrado, com o círculo da precisão do GPS. */
export function MapaLocal({ lat, lng, precisaoM, online, origem }: Props) {
  const html = useMemo(() => htmlDoMapa({ lat, lng, precisao_m: precisaoM }), [lat, lng, precisaoM]);
  return <PaginaMapa html={html} online={online} origem={origem} rotulo={`Mapa do local ${lat.toFixed(5)}, ${lng.toFixed(5)}`} />;
}
