import * as Location from 'expo-location';
import { ErroLocalizacao, type PosicaoGps } from '@/domain/localizacao';

const TEMPO_MAXIMO_MS = 20_000;

/**
 * Uma posição de alta precisão. O expo-location não tem prazo máximo próprio, então o prazo é nosso: sem sinal de GPS
 * (dentro de prédio, por exemplo) a chamada poderia ficar esperando para sempre.
 */
export const capturarPosicao = async (tempoMaximoMs: number = TEMPO_MAXIMO_MS): Promise<PosicaoGps> => {
  const permissao = await Location.requestForegroundPermissionsAsync();
  if (!permissao.granted) throw new ErroLocalizacao(permissao.canAskAgain === false ? 'permissao_bloqueada' : 'permissao_negada');
  if (!(await Location.hasServicesEnabledAsync().catch(() => true))) throw new ErroLocalizacao('gps_desligado');
  let prazo: ReturnType<typeof setTimeout> | undefined;
  try {
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<never>((_, rejeitar) => { prazo = setTimeout(() => rejeitar(new ErroLocalizacao('tempo_esgotado')), tempoMaximoMs); }),
    ]);
    return { lat: pos.coords.latitude, lng: pos.coords.longitude, precisao_m: pos.coords.accuracy ?? null };
  } catch (e) {
    if (e instanceof ErroLocalizacao) throw e;
    throw new ErroLocalizacao('indisponivel');
  } finally {
    if (prazo) clearTimeout(prazo);
  }
};
