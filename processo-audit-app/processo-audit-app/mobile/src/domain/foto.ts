import type { Operacao } from './operacoes';

/** Foto do serviço: no máximo 1280 px no lado maior e JPEG com qualidade 0,7 (cabe com folga nos 8 MB do servidor mesmo em rede ruim). */
export const LADO_MAXIMO_PX = 1280;
export const QUALIDADE_JPEG = 0.7;

/** Tamanho final mantendo a proporção; null quando a foto já cabe e não precisa ser reduzida. */
export const dimensoesAlvo = (largura: number, altura: number, maximo: number = LADO_MAXIMO_PX): { width: number; height: number } | null => {
  const maior = Math.max(largura, altura);
  if (!(maior > maximo) || !(largura > 0) || !(altura > 0)) return null;
  const k = maximo / maior;
  return { width: Math.max(1, Math.round(largura * k)), height: Math.max(1, Math.round(altura * k)) };
};

/** Nome único e legível para o arquivo local da foto. */
export const nomeDeFoto = (agora: number, aleatorio: number): string => `foto-${agora.toString(36)}-${Math.floor(aleatorio * 1e6).toString(36)}`;

export type SituacaoFoto = 'aguardando' | 'enviando' | 'enviada' | 'erro';
export const ROTULO_SITUACAO: Record<SituacaoFoto, string> = { aguardando: 'Aguardando envio', enviando: 'Enviando…', enviada: 'Enviada', erro: 'Requer atenção' };

/** Onde a foto está no caminho até o servidor (o id do servidor só existe depois da confirmação). */
export const situacaoDaFoto = (foto: { client_uuid: string; servidor_id: number | null }, ops: readonly Operacao[]): SituacaoFoto => {
  const op = ops.find((o) => o.tipo === 'foto' && o.payload.campos.client_uuid === foto.client_uuid);
  if (foto.servidor_id !== null || op?.estado === 'ok') return 'enviada';
  if (op?.estado === 'enviando') return 'enviando';
  if (op?.estado === 'atencao') return 'erro';
  return 'aguardando';
};
