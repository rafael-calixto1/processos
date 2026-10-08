import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Trash2, Undo2 } from 'lucide-react';
import { geoAPI } from '../api/estoque';
import AddressSearch from './AddressSearch';

export const fmtMeters = (m) => (m >= 1000 ? `${(m / 1000).toFixed(2).replace('.', ',')} km` : `${m} m`);

const DEFAULT_CENTER = { lat: -23.5429, lng: -46.3112 }; // Suzano/SP
const MAX_POINTS = 25;

/* Rotas gravadas antes do suporte a vários pontos tinham só início e fim */
const pointsOf = (v) => v?.pontos || [v?.inicio, v?.fim].filter(Boolean);
const colorOf = (i, n) => (i === 0 ? '#15803d' : i === n - 1 && n > 1 ? '#dc2626' : '#2563eb');
const nameOf = (i, n) => (i === 0 ? 'Início' : i === n - 1 ? 'Fim' : String(i + 1));

/* Mapa (Leaflet + OpenStreetMap). Editável: toque em ruas para adicionar pontos; o trajeto é traçado pelas vias.
   Somente leitura: mostra a rota salva. value = { pontos: [{lat,lng}], metros, caminho: [[lat,lng]] } */
const RouteMap = ({ value, onChange, center, height = 320, readOnly = false }) => {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const valueRef = useRef(value); valueRef.current = value;
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
  const pts = pointsOf(value);
  const livresOf = () => valueRef.current?.livres || [];

  const apply = async (points, livres = []) => {
    setError('');
    if (points.length < 2) { onChangeRef.current?.(points.length ? { pontos: points, livres } : null); return; }
    setBusy(true);
    try {
      const r = await geoAPI.rota({ pontos: points.map((p, i) => `${p.lat},${p.lng}${livres[i] ? '!' : ''}`).join(';') });
      onChangeRef.current?.({ pontos: r.pontos, livres, metros: r.metros, caminho: r.caminho });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const addPoint = (p, livre = false) => {
    const cur = pointsOf(valueRef.current);
    if (cur.length >= MAX_POINTS) { setError(`No máximo ${MAX_POINTS} pontos por rota.`); return; }
    apply([...cur, { lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) }], [...livresOf().slice(0, cur.length), livre]);
  };
  const addRef = useRef(addPoint); addRef.current = addPoint;

  // Ponto arrastado: troca só a posição dele e refaz o trajeto pelas vias
  const movePoint = (i, ll) => {
    const cur = pointsOf(valueRef.current);
    if (!cur[i]) return;
    const livres = [...livresOf()]; livres[i] = false;
    apply(cur.map((q, j) => (j === i ? { lat: Number(ll.lat.toFixed(6)), lng: Number(ll.lng.toFixed(6)) } : q)), livres);
  };
  const moveRef = useRef(movePoint); moveRef.current = movePoint;

  // Endereço digitado: vira ponto da rota (se achar a rua) ou só leva o mapa até a região
  const [addr, setAddr] = useState('');
  const pickAddress = async (it) => {
    setError('');
    let { latitude: lat, longitude: lng } = it; let approx = false; let origem = '';
    if (lat == null) {
      setBusy(true);
      try { ({ latitude: lat, longitude: lng, aproximado: approx, origem } = await geoAPI.geocode({ street: it.logradouro, numero: it.numero, city: it.cidade, uf: it.uf, cep: it.cep, bairro: it.bairro })); } catch { /* trata abaixo */ }
      setBusy(false);
    }
    if (lat == null) { setError('Não foi possível localizar esse endereço no mapa.'); return; }
    map.current?.setView([lat, lng], 18);
    // Rua real (pelo CEP) que o OpenStreetMap ainda não desenhou: entra como ponto e o trajeto usa a via mapeada mais próxima
    if (approx && origem !== 'cep') { setError('Rua não encontrada no mapa: o mapa foi levado até a região. Toque sobre a rua para marcar o ponto.'); return; }
    addPoint({ lat: Number(lat), lng: Number(lng) }, origem === 'cep');
  };

  useEffect(() => {
    const c = center || DEFAULT_CENTER;
    map.current = L.map(el.current, { scrollWheelZoom: !readOnly }).setView([c.lat, c.lng], 17);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    if (!readOnly) map.current.on('click', (e) => addRef.current(e.latlng));
    setTimeout(() => map.current?.invalidateSize(), 0);
    return () => { map.current.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map.current) return;
    layer.current.clearLayers();
    let line = null;
    if (value?.caminho?.length > 1) line = L.polyline(value.caminho, { color: '#2563eb', weight: 5 }).addTo(layer.current);
    pts.forEach((p, i) => {
      // Área de toque de 40px (dedo) com o ponto de 22px no centro; arrastável no modo de edição
      const icon = L.divIcon({ className: '', iconSize: [40, 40], iconAnchor: [20, 20],
        html: `<div style="width:40px;height:40px;display:grid;place-items:center;cursor:${readOnly ? 'default' : 'grab'}"><div style="width:22px;height:22px;border-radius:50%;background:${colorOf(i, pts.length)};border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45)"></div></div>` });
      const marker = L.marker([p.lat, p.lng], { icon, draggable: !readOnly, autoPan: true, keyboard: false })
        .bindTooltip(nameOf(i, pts.length), { permanent: true, direction: 'top', offset: [0, -14] }).addTo(layer.current);
      if (!readOnly) marker.on('dragend', (e) => moveRef.current(i, e.target.getLatLng()));
    });
    if (line) map.current.fitBounds(line.getBounds(), { padding: [40, 40], maxZoom: 18 });
    else if (pts.length === 1) map.current.setView([pts[0].lat, pts[0].lng], Math.max(map.current.getZoom(), 17));
  }, [value]);

  const useGps = () => {
    setError('');
    if (!navigator.geolocation) { setError('Este navegador não oferece GPS.'); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setBusy(false); addPoint({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      () => { setError('Não foi possível obter o GPS. Marque o ponto tocando no mapa.'); setBusy(false); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const btn = { minHeight: 44, borderRadius: 12, border: '1px solid var(--border-color)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {!readOnly && (
        <span style={{ fontSize: '0.85rem', opacity: 0.75 }}>
          Toque sobre uma rua, estrada ou rodovia para adicionar pontos. O primeiro é o <b>início</b>, o último é o <b>fim</b>, e o trajeto passa por todos, pelas vias. <b>Arraste um ponto</b> para ajustá-lo.
        </span>
      )}
      {!readOnly && <AddressSearch value={addr} onChange={setAddr} onPick={pickAddress} placeholder="Buscar rua, CEP ou coordenadas" />}
      <div ref={el} style={{ height, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-color)', zIndex: 0 }} />
      {busy && <span>Traçando trajeto pelas ruas…</span>}
      {value?.caminho?.length > 1 && <b>{pts.length} pontos · {fmtMeters(value.metros)} pelas vias</b>}
      {!readOnly && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" disabled={busy} onClick={useGps} style={{ ...btn, flex: 1 }}><Crosshair size={18} />Minha posição</button>
          <button type="button" disabled={busy || pts.length === 0} onClick={() => apply(pts.slice(0, -1), livresOf().slice(0, -1))} aria-label="Desfazer último ponto" style={{ ...btn, minWidth: 44 }}><Undo2 size={18} /></button>
          <button type="button" disabled={busy || pts.length === 0} onClick={() => { setError(''); onChange?.(null); }} aria-label="Limpar rota" style={{ ...btn, minWidth: 44 }}><Trash2 size={18} /></button>
        </div>
      )}
      {error && <p role="alert" style={{ margin: 0, color: 'var(--error)' }}>{error}</p>}
    </div>
  );
};
export default RouteMap;
