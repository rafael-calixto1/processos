/** Mapa do local (Leaflet + OpenStreetMap, os mesmos do sistema web; sem chave de API). Só funciona com internet. */
export interface PontoDoMapa { lat: number; lng: number; precisao_m?: number | null }

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet';
const RAIO_MAXIMO_M = 5000;

/** Link para abrir o ponto no app de mapas do celular (navegação). */
export const urlDoPonto = (lat: number, lng: number): string => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

/**
 * Página do mapa: um ponto verde e, quando o GPS informou a precisão, um círculo azul desse tamanho (a região onde o
 * aparelho acha que está). As coordenadas entram como números, nunca como texto livre.
 */
export const htmlDoMapa = ({ lat, lng, precisao_m }: PontoDoMapa): string => {
  const la = Number(lat); const ln = Number(lng); const p = Number(precisao_m);
  if (!Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) throw new RangeError('Coordenadas inválidas');
  const raio = Number.isFinite(p) && p > 0 ? Math.min(p, RAIO_MAXIMO_M) : 0;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="${LEAFLET}.css"><style>html,body,#m{height:100%;margin:0}.erro{font:16px sans-serif;padding:16px;color:#4a5d50}</style></head>
<body><div id="m"></div><script src="${LEAFLET}.js"></script><script>
(function(){
  var el=document.getElementById('m');
  if(!window.L){el.innerHTML='<p class="erro">Não foi possível carregar o mapa. Verifique a conexão.</p>';return;}
  var p=[${JSON.stringify(la)},${JSON.stringify(ln)}],r=${JSON.stringify(raio)};
  var map=L.map('m',{zoomControl:true,attributionControl:true});
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
  map.setView(p,17);
  if(r>0){var c=L.circle(p,{radius:r,color:'#175cd3',weight:2,fillOpacity:0.12}).addTo(map);map.fitBounds(c.getBounds(),{maxZoom:18,padding:[12,12]});}
  L.circleMarker(p,{radius:9,color:'#ffffff',weight:3,fillColor:'#0ba52b',fillOpacity:1}).addTo(map);
})();
</script></body></html>`;
};
