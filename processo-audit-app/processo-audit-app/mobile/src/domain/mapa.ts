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

export interface EntradaEditor { centro: { lat: number; lng: number }; pontos?: ReadonlyArray<{ lat: number; lng: number }>; caminho?: ReadonlyArray<readonly [number, number]> }

const numeros = (v: ReadonlyArray<{ lat: number; lng: number }>) => v.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) })).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180);

/**
 * Página do mapa em que o técnico TOCA para marcar o trecho: o 1º toque é o início (verde), o último é o fim (vermelho) e os do meio
 * são azuis e numerados; cada ponto pode ser arrastado. A página só avisa o que foi tocado/arrastado (`toque`, `mover`); quem guarda
 * os pontos e traça o caminho é o aplicativo, que reenvia tudo por `definirPontos`. Linha cheia = caminho pelas vias; tracejada = linha reta.
 */
export const htmlDoEditorTrecho = ({ centro, pontos = [], caminho = [] }: EntradaEditor): string => {
  const c = { lat: Number(centro.lat), lng: Number(centro.lng) };
  if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng) || Math.abs(c.lat) > 90 || Math.abs(c.lng) > 180) throw new RangeError('Centro inválido');
  const pts = numeros(pontos);
  const cam = caminho.map(([la, ln]) => [Number(la), Number(ln)]).filter(([la, ln]) => Number.isFinite(la) && Number.isFinite(ln));
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="${LEAFLET}.css"><style>html,body,#m{height:100%;margin:0}.erro{font:16px sans-serif;padding:16px;color:#4a5d50}
.pino{width:40px;height:40px;border-radius:20px;border:3px solid #fff;color:#fff;font:bold 18px sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.45)}</style></head>
<body><div id="m"></div><script src="${LEAFLET}.js"></script><script>
(function(){
  var el=document.getElementById('m');
  function enviar(o){var s=JSON.stringify(o);if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(s);}else{window.parent.postMessage(s,'*');}}
  if(!window.L){el.innerHTML='<p class="erro">Não foi possível carregar o mapa. Verifique a conexão.</p>';enviar({tipo:'erro-mapa'});return;}
  var map=L.map('m',{zoomControl:true}).setView([${JSON.stringify(c.lat)},${JSON.stringify(c.lng)}],17);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
  var marcadores=[],linha=null;
  function pino(i,n){var cor=i===0?'#15803d':(i===n-1&&n>1?'#dc2626':'#2563eb');var nome=i===0?'I':(i===n-1&&n>1?'F':String(i+1));
    return L.divIcon({className:'',html:'<div class="pino" style="background:'+cor+'">'+nome+'</div>',iconSize:[40,40],iconAnchor:[20,20]});}
  window.definirPontos=function(pts,caminho,ajustar){
    marcadores.forEach(function(m){map.removeLayer(m);}); marcadores=[]; if(linha){map.removeLayer(linha);linha=null;}
    pts.forEach(function(p,i){var m=L.marker([p.lat,p.lng],{draggable:true,icon:pino(i,pts.length)}).addTo(map);
      m.on('dragend',function(){var ll=m.getLatLng();enviar({tipo:'mover',i:i,lat:ll.lat,lng:ll.lng});}); marcadores.push(m);});
    if(caminho&&caminho.length>1){linha=L.polyline(caminho,{color:'#2563eb',weight:5,opacity:.85}).addTo(map);}
    else if(pts.length>1){linha=L.polyline(pts.map(function(p){return [p.lat,p.lng];}),{color:'#2563eb',weight:4,opacity:.8,dashArray:'8 10'}).addTo(map);}
    if(ajustar&&pts.length>1){map.fitBounds(L.latLngBounds(pts.map(function(p){return [p.lat,p.lng];})),{maxZoom:18,padding:[40,40]});}
    else if(ajustar&&pts.length===1){map.setView([pts[0].lat,pts[0].lng],17);}
  };
  map.on('click',function(e){enviar({tipo:'toque',lat:e.latlng.lat,lng:e.latlng.lng});});
  window.addEventListener('message',function(ev){try{var m=JSON.parse(ev.data);if(m&&m.cmd==='pontos'){window.definirPontos(m.pontos||[],m.caminho||[],!!m.ajustar);}}catch(e){}});
  window.definirPontos(${JSON.stringify(pts)},${JSON.stringify(cam)},true);
  enviar({tipo:'pronto'});
})();
</script></body></html>`;
};

/** Página só de leitura com o trecho já marcado: início (verde), fim (vermelho), pontos do meio (azul) e o caminho; ajusta o zoom para mostrar tudo. */
export const htmlDoTrecho = ({ pontos, caminho = [] }: { pontos: ReadonlyArray<{ lat: number; lng: number }>; caminho?: ReadonlyArray<readonly [number, number]> }): string => {
  const pts = numeros(pontos);
  if (pts.length < 2) throw new RangeError('O trecho precisa de ao menos 2 pontos');
  const cam = caminho.map(([la, ln]) => [Number(la), Number(ln)]).filter(([la, ln]) => Number.isFinite(la) && Number.isFinite(ln));
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="${LEAFLET}.css"><style>html,body,#m{height:100%;margin:0}.erro{font:16px sans-serif;padding:16px;color:#4a5d50}
.pino{width:30px;height:30px;border-radius:15px;border:3px solid #fff;color:#fff;font:bold 14px sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,.4)}</style></head>
<body><div id="m"></div><script src="${LEAFLET}.js"></script><script>
(function(){
  var el=document.getElementById('m');
  if(!window.L){el.innerHTML='<p class="erro">Não foi possível carregar o mapa. Verifique a conexão.</p>';return;}
  var pts=${JSON.stringify(pts)},cam=${JSON.stringify(cam)};
  var map=L.map('m',{zoomControl:true});
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
  var ll=pts.map(function(p){return [p.lat,p.lng];});
  if(cam.length>1){L.polyline(cam,{color:'#2563eb',weight:5,opacity:.85}).addTo(map);}
  else{L.polyline(ll,{color:'#2563eb',weight:4,opacity:.8,dashArray:'8 10'}).addTo(map);}
  pts.forEach(function(p,i){var n=pts.length,cor=i===0?'#15803d':(i===n-1?'#dc2626':'#2563eb'),nome=i===0?'I':(i===n-1?'F':String(i+1));
    L.marker([p.lat,p.lng],{icon:L.divIcon({className:'',html:'<div class="pino" style="background:'+cor+'">'+nome+'</div>',iconSize:[30,30],iconAnchor:[15,15]})}).addTo(map);});
  map.fitBounds(L.latLngBounds(cam.length>1?cam:ll),{maxZoom:18,padding:[24,24]});
})();
</script></body></html>`;
};
