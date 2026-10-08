import express from 'express';
import pool from '../config/database.js';
import { verifyToken } from '../middlewares/auth.js';

/* Busca de endereço: CEP (ViaCEP), coordenadas "lat, lng" (geocodificação reversa) ou texto livre (OpenStreetMap/Nominatim). */
const router = express.Router();
router.use(verifyToken);

const UA = 'ConexaoWeb-OS/1.0 (suporte interno)';
const TTL = 10 * 60 * 1000;
const cache = new Map();
const cached = async (key, fn) => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  const v = await fn();
  cache.set(key, { t: Date.now(), v });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return v;
};

const getJson = async (url) => {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

const viaCep = (cep) => cached(`cep:${cep}`, async () => {
  const d = await getJson(`https://viacep.com.br/ws/${cep}/json/`);
  return d.erro ? null : d;
});

const nominatim = (path, params) => {
  const qs = new URLSearchParams({ format: 'jsonv2', addressdetails: '1', 'accept-language': 'pt-BR', ...params });
  return cached(`nom:${path}?${qs}`, () => getJson(`https://nominatim.openstreetmap.org/${path}?${qs}`));
};

const fromNominatim = (r, numero = '') => {
  const a = r.address || {};
  return {
    logradouro: a.road || a.pedestrian || a.footway || r.name || '',
    numero,
    bairro: a.suburb || a.quarter || a.neighbourhood || a.city_district || '',
    cidade: a.city || a.town || a.village || a.municipality || '',
    uf: String(a['ISO3166-2-lvl4'] || '').replace(/^BR-/, ''),
    cep: String(a.postcode || '').replace(/\D/g, ''),
    latitude: Number(r.lat), longitude: Number(r.lon),
  };
};

// CEP completo: o bairro/logradouro oficial vêm do ViaCEP
const enrich = async (item) => {
  if (item.cep.length !== 8) return item;
  try {
    const v = await viaCep(item.cep);
    if (v) return { ...item, bairro: v.bairro || item.bairro, cidade: v.localidade || item.cidade, uf: v.uf || item.uf };
  } catch { /* mantém o dado do OSM */ }
  return item;
};

/* Cidades onde buscar logradouros no ViaCEP (ele exige UF + cidade): GEO_DEFAULT_CITIES="Suzano/SP,Mogi das Cruzes/SP"
   somadas às cidades das OS já cadastradas. */
const knownCities = async () => {
  const set = new Map();
  const add = (city, uf) => { if (city && uf) set.set(`${city.toLowerCase()}/${uf.toUpperCase()}`, { city, uf: uf.toUpperCase() }); };
  (process.env.GEO_DEFAULT_CITIES || 'Suzano/SP').split(',').forEach((c) => { const [city, uf] = c.split('/').map((x) => x?.trim()); add(city, uf); });
  try {
    const [rows] = await pool.query('SELECT cidade, uf, COUNT(*) n FROM ordens_servico WHERE cidade IS NOT NULL AND uf IS NOT NULL GROUP BY cidade, uf ORDER BY n DESC LIMIT 8');
    rows.forEach((r) => add(r.cidade, r.uf));
  } catch { /* só as cidades padrão */ }
  return [...set.values()];
};

const TIPOS = /^(rua|r\.?|avenida|av\.?|estrada|estr\.?|travessa|tv\.?|alameda|al\.?|rodovia|rod\.?|praça|pça\.?|largo|viela|beco)\s+/i;

/* "estrada takashi kobata, 572, suzano/sp" -> { street, numero, city, uf } */
const parseText = (q) => {
  const parts = q.split(/\s*[,;]\s*/).filter(Boolean);
  let street = parts[0]; let numero = ''; let hint = '';
  for (const p of parts.slice(1)) { if (/^\d{1,5}[A-Za-z]?$/.test(p) && !numero) numero = p; else if (!hint) hint = p; }
  if (!numero) { // sem vírgulas: "rua x 572 cidade/uf"
    const m3 = street.match(/^(.*?)\s+(\d{1,5}[A-Za-z]?)\s+(.{3,})$/);
    if (m3 && m3[1].length >= 3) { street = m3[1]; numero = m3[2]; hint = hint || m3[3]; }
  }
  if (!numero) { const m = street.match(/^(.*?)\s+(\d{1,5}[A-Za-z]?)$/); if (m && m[1].length >= 3) { street = m[1]; numero = m[2]; } }
  let city = ''; let uf = '';
  if (hint) { const m = hint.match(/^(.*?)\s*(?:[-/]\s*|\s)([A-Za-z]{2})$/); if (m && m[1].length >= 3) { city = m[1]; uf = m[2].toUpperCase(); } else city = hint; }
  return { street, numero, city, uf };
};

const viaCepByStreet = async (street, cities) => {
  const name = street.replace(TIPOS, '').trim();
  if (name.length < 3) return [];
  const lists = await Promise.all(cities.map((c) => cached(`cepst:${c.uf}/${c.city}/${name}`, async () => {
    try {
      const r = await getJson(`https://viacep.com.br/ws/${c.uf}/${encodeURIComponent(c.city)}/${encodeURIComponent(name)}/json/`);
      return Array.isArray(r) ? r : [];
    } catch { return []; }
  })));
  return lists.flat().slice(0, 6);
};

const label = (i) => [[i.logradouro, i.numero].filter(Boolean).join(', '), i.bairro, [i.cidade, i.uf].filter(Boolean).join(' - ')].filter(Boolean).join(' · ');

router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 3) return res.json([]);
  try {
    let items = [];
    const cep = q.match(/^(\d{5})-?(\d{3})$/);
    const coords = q.match(/^(-?\d{1,3}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/);
    if (cep) {
      const v = await viaCep(cep[1] + cep[2]);
      if (v) {
        const base = { logradouro: v.logradouro, numero: '', bairro: v.bairro, cidade: v.localidade, uf: v.uf, cep: cep[1] + cep[2], latitude: null, longitude: null };
        try { // coordenadas aproximadas do CEP/rua
          const g = await nominatim('search', { street: v.logradouro, city: v.localidade, state: v.uf, country: 'Brasil', limit: '1' });
          if (g[0]) { base.latitude = Number(g[0].lat); base.longitude = Number(g[0].lon); }
        } catch { /* sem coordenadas */ }
        items = [base];
      }
    } else if (coords) {
      const lat = Number(coords[1].replace(',', '.')); const lng = Number(coords[2].replace(',', '.'));
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        const r = await nominatim('reverse', { lat: String(lat), lon: String(lng), zoom: '18' });
        items = r?.address ? [{ ...fromNominatim(r), latitude: lat, longitude: lng }] : [{ logradouro: '', numero: '', bairro: '', cidade: '', uf: '', cep: '', latitude: lat, longitude: lng }];
      }
    } else {
      const { street, numero, city, uf } = parseText(q);
      let cities = await knownCities();
      if (city) {
        const match = cities.filter((c) => c.city.toLowerCase() === city.toLowerCase());
        cities = uf ? [{ city, uf }] : match.length ? match : [{ city, uf: cities[0]?.uf || 'SP' }];
      }
      // ViaCEP (oficial, traz o bairro dos Correios) + OpenStreetMap (traz coordenadas)
      const [cepRows, osmRows] = await Promise.all([
        viaCepByStreet(street, cities),
        nominatim('search', { q: city ? `${street}, ${city}` : street, countrycodes: 'br', limit: '6' }).catch(() => []),
      ]);
      const fromCep = cepRows.map((v) => ({ logradouro: v.logradouro, numero, bairro: v.bairro, cidade: v.localidade, uf: v.uf, cep: v.cep.replace(/\D/g, ''), latitude: null, longitude: null }));
      const fromOsm = await Promise.all(osmRows.map((r) => enrich(fromNominatim(r, numero))));
      const seen = new Set(fromCep.map((i) => `${i.logradouro}|${i.cidade}`.toLowerCase()));
      items = [...fromCep, ...fromOsm.filter((i) => !seen.has(`${i.logradouro}|${i.cidade}`.toLowerCase()))].slice(0, 8);
    }
    res.json(items.map((i) => ({ ...i, label: label(i) || `${i.latitude}, ${i.longitude}` })));
  } catch (e) {
    res.status(502).json({ error: 'Serviço de endereços indisponível. Preencha manualmente.' });
  }
});

// Coordenadas de um endereço já escolhido (segunda etapa, para não atrasar a lista de sugestões)
router.get('/geocode', async (req, res) => {
  const { street = '', numero = '', city = '', uf = '', cep = '', bairro = '' } = req.query;
  try {
    const tries = [];
    // O Nominatim não entende a sigla da UF no parâmetro "state": ela só entra na busca livre
    if (street && city) {
      if (numero) tries.push({ street: `${numero} ${street}`, city, country: 'Brasil' });
      tries.push({ street, city, country: 'Brasil' }, { q: `${street}, ${city}${uf ? `, ${uf}` : ''}, Brasil`, countrycodes: 'br' });
    }
    if (cep) tries.push({ postalcode: String(cep).replace(/\D/g, ''), country: 'Brasil' });
    // Rua nova/ausente no OSM: cai para o bairro e, por fim, o centro da cidade (aproximado)
    const exatas = tries.length;
    if (bairro && city) tries.push({ q: `${bairro}, ${city}${uf ? `, ${uf}` : ''}, Brasil`, countrycodes: 'br' });
    if (city) tries.push({ q: `${city}${uf ? `, ${uf}` : ''}, Brasil`, countrycodes: 'br' });
    for (const [i, t] of tries.entries()) {
      const r = await nominatim('search', { ...t, limit: '1' });
      if (r[0]) return res.json({ latitude: Number(r[0].lat), longitude: Number(r[0].lon), aproximado: i >= exatas });
    }
    res.json({ latitude: null, longitude: null });
  } catch { res.json({ latitude: null, longitude: null }); }
});

export default router;
