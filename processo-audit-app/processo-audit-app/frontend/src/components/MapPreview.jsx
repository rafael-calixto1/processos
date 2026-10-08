import React from 'react';
import { ExternalLink } from 'lucide-react';

/* Mapa (OpenStreetMap embutido) com marcador nas coordenadas informadas. Não renderiza sem coordenadas válidas. */
const MapPreview = ({ lat, lng, height = 220 }) => {
  const la = Number(String(lat).replace(',', '.'));
  const ln = Number(String(lng).replace(',', '.'));
  if (lat === '' || lng === '' || lat == null || lng == null || !Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
  const d = 0.003;
  const bbox = [ln - d, la - d, ln + d, la + d].join('%2C');
  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', overflow: 'hidden', background: '#fff' }}>
      <iframe title="Mapa do local" loading="lazy" style={{ display: 'block', width: '100%', height, border: 0 }}
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${la}%2C${ln}`} />
      <a href={`https://www.google.com/maps/search/?api=1&query=${la},${ln}`} target="_blank" rel="noreferrer"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, fontWeight: 600, fontSize: '0.85rem', color: 'var(--info)', textDecoration: 'none', borderTop: '1px solid var(--border-color)' }}>
        <ExternalLink size={16} />Abrir no Google Maps
      </a>
    </div>
  );
};
export default MapPreview;
