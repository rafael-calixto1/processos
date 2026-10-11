import type { LocalIntervencao } from './etapas';
import type { OS } from './tipos';

/** Por que não foi possível obter a posição, em linguagem de quem está em campo (sempre com o caminho alternativo). */
export type CodigoErroGps = 'permissao_negada' | 'permissao_bloqueada' | 'gps_desligado' | 'tempo_esgotado' | 'indisponivel';

export const MENSAGEM_ERRO_GPS: Record<CodigoErroGps, string> = {
  permissao_negada: 'O aplicativo não tem permissão para usar a localização. Permita quando o aparelho perguntar, ou use as coordenadas do poste.',
  permissao_bloqueada: 'A localização está bloqueada para este aplicativo. Abra as Configurações do aparelho, permita a localização e tente de novo, ou use as coordenadas do poste.',
  gps_desligado: 'O GPS do aparelho está desligado. Ligue a localização e tente de novo, ou use as coordenadas do poste.',
  tempo_esgotado: 'Não foi possível obter a posição a tempo. Vá para um lugar aberto, sem prédios ou árvores por cima, e tente de novo, ou use as coordenadas do poste.',
  indisponivel: 'Não foi possível obter a posição agora. Tente de novo, ou use as coordenadas do poste.',
};

export class ErroLocalizacao extends Error {
  readonly codigo: CodigoErroGps;
  constructor(codigo: CodigoErroGps) { super(MENSAGEM_ERRO_GPS[codigo]); this.name = 'ErroLocalizacao'; this.codigo = codigo; }
}

export interface PosicaoGps { lat: number; lng: number; precisao_m: number | null; simulado?: boolean }

const coordenadaValida = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

export const localDoGps = (p: PosicaoGps, agora: Date = new Date()): LocalIntervencao => {
  if (!coordenadaValida(p.lat, p.lng)) throw new ErroLocalizacao('indisponivel');
  return { lat: p.lat, lng: p.lng, origem: 'gps', precisao_m: p.precisao_m == null ? null : Math.max(0, Math.round(p.precisao_m)), capturado_em: agora.toISOString() };
};

/** Coordenadas do poste/local informado na OS (funciona sem sinal). Null quando a OS não tem coordenadas. */
export const localDoPoste = (os: Pick<OS, 'latitude' | 'longitude'>, agora: Date = new Date()): LocalIntervencao | null =>
  os.latitude != null && os.longitude != null && coordenadaValida(os.latitude, os.longitude)
    ? { lat: os.latitude, lng: os.longitude, origem: 'pole_reference', capturado_em: agora.toISOString() }
    : null;

export const localDoEndereco = (e: { lat: number; lng: number; rotulo: string; aproximado?: boolean }, agora: Date = new Date()): LocalIntervencao => {
  if (!coordenadaValida(e.lat, e.lng)) throw new ErroLocalizacao('indisponivel');
  return { lat: e.lat, lng: e.lng, origem: 'address', endereco: e.rotulo, aproximado: Boolean(e.aproximado), capturado_em: agora.toISOString() };
};

export type QualidadePrecisao = 'boa' | 'media' | 'ruim';
/** Até 15 m é boa para achar o poste; acima de 50 m vale tentar de novo em lugar aberto. */
export const qualidadeDaPrecisao = (metros: number | null | undefined): QualidadePrecisao | null =>
  metros == null ? null : metros <= 15 ? 'boa' : metros <= 50 ? 'media' : 'ruim';

export const rotuloOrigem = (l: LocalIntervencao): string =>
  l.origem === 'gps' ? (l.precisao_m != null ? `GPS · precisão de ${l.precisao_m} m` : 'GPS') : l.origem === 'pole_reference' ? 'Coordenadas do poste' : `Endereço${l.aproximado ? ' (posição aproximada)' : ''}`;

/** Resposta de `GET /geo/search` (campos usados). Latitude/longitude podem vir vazias: aí é preciso geocodificar. */
export interface SugestaoEndereco {
  label: string; logradouro: string; numero: string; bairro: string; cidade: string; uf: string; cep: string;
  latitude: number | null; longitude: number | null;
}
