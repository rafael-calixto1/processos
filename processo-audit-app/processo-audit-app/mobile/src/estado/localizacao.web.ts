import type { PosicaoGps } from '@/domain/localizacao';

/**
 * SIMULAÇÃO, só para a pré-visualização no navegador (o aparelho de verdade usa o GPS). Devolve um ponto fixo de Suzano/SP
 * com precisão de 8 m e `simulado: true`, para a tela avisar. Para outro ponto: `localStorage.setItem('gpsSimulado', '-23.5,-46.3,12')`.
 */
export const capturarPosicao = async (): Promise<PosicaoGps> => {
  const [lat, lng, precisao] = (globalThis.localStorage?.getItem('gpsSimulado') ?? '-23.5445,-46.3118,8').split(',').map(Number);
  return { lat, lng, precisao_m: precisao, simulado: true };
};
