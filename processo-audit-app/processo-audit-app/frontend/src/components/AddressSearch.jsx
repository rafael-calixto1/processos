import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { geoAPI } from '../api/estoque';
import s from './AddressSearch.module.css';

/* Campo de endereço com busca: aceita CEP, coordenadas ("-23.55, -46.63") ou nome da rua (com número).
   Ao escolher uma sugestão, devolve os campos estruturados via onPick. */
const AddressSearch = ({ value, onChange, onPick, placeholder = 'CEP, coordenadas ou nome da rua' }) => {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);
  const picked = useRef(value); // evita nova busca logo depois de escolher uma sugestão
  const seq = useRef(0);

  useEffect(() => {
    const q = (value || '').trim();
    if (q.length < 3 || q === picked.current) { setItems([]); setMsg(''); return undefined; }
    const my = ++seq.current;
    const t = setTimeout(async () => {
      setBusy(true); setMsg('');
      try {
        const r = await geoAPI.search(q);
        if (my !== seq.current) return;
        setItems(r); setOpen(true);
        if (r.length === 0) setMsg('Nenhum endereço encontrado. Preencha os campos abaixo manualmente.');
      } catch (e) { if (my === seq.current) { setItems([]); setMsg(e.message); } }
      finally { if (my === seq.current) setBusy(false); }
    }, 600); // respeita o limite de ~1 consulta/s do serviço de mapas
    return () => clearTimeout(t);
  }, [value]);

  const choose = (it) => {
    picked.current = it.label; setItems([]); setOpen(false); setMsg('');
    onChange(it.label); onPick(it);
  };

  return (
    <div className={s.wrap}>
      <div className={s.inputWrap}>
        <input value={value} onChange={(e) => { onChange(e.target.value); setOpen(true); }} placeholder={placeholder} autoComplete="off" inputMode="search" aria-label="Buscar endereço" />
        {busy && <Loader2 size={18} className={s.spin} aria-label="Buscando" />}
      </div>
      {msg && <p className={s.msg} role="status">{msg}</p>}
      {open && items.length > 0 && (
        <ul className={s.list} role="listbox">
          {items.map((it, i) => (
            <li key={`${it.label}-${i}`}>
              <button type="button" role="option" className={s.item} onClick={() => choose(it)}>
                <MapPin size={16} aria-hidden="true" />
                <span><b>{[it.logradouro, it.numero].filter(Boolean).join(', ') || 'Ponto no mapa'}</b>
                  <small>{[it.bairro, [it.cidade, it.uf].filter(Boolean).join(' - '), it.cep && it.cep.replace(/(\d{5})(\d{3})/, '$1-$2')].filter(Boolean).join(' · ')}</small></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
export default AddressSearch;
