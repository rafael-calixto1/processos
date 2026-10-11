/** Trecho do lançamento marcado no mapa: pontos tocados pelo técnico (início, intermediários, fim) e, quando há internet, o caminho pelas vias. */
export interface PontoGeo { lat: number; lng: number }
export interface RotaTrecho { pontos: PontoGeo[]; metros: number; caminho: Array<[number, number]> }

export const MAX_PONTOS = 25; // o servidor aceita até 25 pontos por rota
export const MAX_CAMINHO = 600; // o servidor corta em 700 pontos: reduzimos antes, para o fim do trecho nunca ser cortado
export const CENTRO_PADRAO: PontoGeo = { lat: -23.5429, lng: -46.3112 }; // Suzano/SP, como no sistema web

const arredondar = (n: number) => Math.round(n * 1e6) / 1e6;
export const novoPonto = (lat: number, lng: number): PontoGeo => ({ lat: arredondar(lat), lng: arredondar(lng) });
export const pontoValido = (p: PontoGeo): boolean => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

/** Distância em metros entre dois pontos (haversine). */
export const distanciaM = (a: PontoGeo, b: PontoGeo): number => {
  const rad = (g: number) => (g * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
};
export const metrosEmLinhaReta = (pontos: readonly PontoGeo[]): number => Math.round(pontos.slice(1).reduce((t, p, i) => t + distanciaM(pontos[i], p), 0));

export const adicionarPonto = (pontos: readonly PontoGeo[], p: PontoGeo): PontoGeo[] => {
  if (pontos.length >= MAX_PONTOS) throw new RangeError(`No máximo ${MAX_PONTOS} pontos por trecho.`);
  if (!pontoValido(p)) throw new RangeError('Ponto inválido.');
  return [...pontos, novoPonto(p.lat, p.lng)];
};
export const moverPonto = (pontos: readonly PontoGeo[], i: number, p: PontoGeo): PontoGeo[] => {
  if (!pontoValido(p)) throw new RangeError('Ponto inválido.');
  return pontos.map((q, j) => (j === i ? novoPonto(p.lat, p.lng) : q));
};
export const removerUltimo = (pontos: readonly PontoGeo[]): PontoGeo[] => pontos.slice(0, -1);

export const rotuloDoPonto = (i: number, total: number): string => (i === 0 ? 'Início' : i === total - 1 && total > 1 ? 'Fim' : `Ponto ${i + 1}`);

/** Mantém no máximo `max` pontos do caminho, espalhados por igual, sempre com o primeiro e o último. */
export const reduzirCaminho = (caminho: ReadonlyArray<readonly [number, number]>, max: number = MAX_CAMINHO): Array<[number, number]> => {
  const limpo = caminho.filter(([la, ln]) => Number.isFinite(la) && Number.isFinite(ln)).map(([la, ln]) => [la, ln] as [number, number]);
  if (limpo.length <= max) return limpo;
  const passo = (limpo.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => limpo[Math.round(i * passo)]);
};

export interface RotaDoServidor { pontos?: PontoGeo[]; metros: number; caminho: Array<[number, number]> }

/** A rota que vai no lançamento. Com a resposta do servidor: pontos ajustados à rua, distância por vias e caminho. Sem ela (offline): linha reta. */
export const montarRota = (pontos: readonly PontoGeo[], doServidor?: RotaDoServidor | null): RotaTrecho | null => {
  if (pontos.length < 2) return null;
  const ajustados = doServidor?.pontos?.length === pontos.length ? doServidor.pontos.map((p) => novoPonto(p.lat, p.lng)) : pontos.map((p) => novoPonto(p.lat, p.lng));
  return { pontos: ajustados, metros: doServidor ? Math.round(doServidor.metros) : metrosEmLinhaReta(pontos), caminho: doServidor ? reduzirCaminho(doServidor.caminho) : [] };
};

export const rotaValida = (r: RotaTrecho): boolean => r.pontos.length >= 2 && r.pontos.length <= MAX_PONTOS && r.pontos.every(pontoValido) && Number.isFinite(r.metros) && r.metros >= 0;

export const fmtMetros = (m: number): string => (m >= 1000 ? `${(m / 1000).toFixed(2).replace('.', ',')} km` : `${Math.round(m)} m`);

const coord = (p: PontoGeo) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
/** Texto sugerido para o campo "Trecho" quando o técnico marcou o mapa e ainda não escreveu nada. */
export const textoDoTrecho = (pontos: readonly PontoGeo[]): string => (pontos.length < 2 ? '' : `${coord(pontos[0])} → ${coord(pontos[pontos.length - 1])}`);
