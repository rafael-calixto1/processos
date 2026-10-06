import React, { useState, useEffect, useRef, useLayoutEffect, useId, Children, isValidElement } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search } from 'lucide-react';
import s from './Select.module.css';

const MIN_BUSCA = 3;
const semAcento = (x) => String(x ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const iniciais = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const textoDe = (node) => Children.toArray(node).map((c) => (isValidElement(c) ? textoDe(c.props.children) : String(c))).join('');
const ehPlaceholder = (o) => o.value === '' && /^(selecione|escolha|—|-|\.\.\.)|…$/i.test(String(o.label).trim());

const Destaque = ({ texto, q }) => {
  const termo = (q || '').trim();
  if (!termo) return texto;
  const i = semAcento(texto).indexOf(semAcento(termo));
  if (i < 0) return texto;
  return <>{texto.slice(0, i)}<mark>{texto.slice(i, i + termo.length)}</mark>{texto.slice(i + termo.length)}</>;
};

/* Converte <option>/<optgroup>/fragmentos/arrays em [{ value, label, disabled }] */
const lerOpcoes = (children, grupo) => {
  const out = [];
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return;
    if (c.type === 'option') {
      const label = textoDe(c.props.children);
      out.push({ value: String(c.props.value ?? label), label, disabled: !!c.props.disabled, grupo });
    } else if (c.type === 'optgroup') out.push(...lerOpcoes(c.props.children, c.props.label));
    else if (c.props?.children) out.push(...lerOpcoes(c.props.children, grupo));
  });
  return out;
};

/* Núcleo: seleção pesquisável na identidade Conexão Web.
   options: [{ value, label, sub?, tag?, disabled?, grupo? }] */
export const Combobox = ({ value, onChange, options, placeholder = 'Selecione…', required, disabled, emptyText = 'Nada encontrado',
  avatar, searchable, name, id, style, ariaLabel, className = '' }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const [pos, setPos] = useState(null);
  const btn = useRef(null);
  const pop = useRef(null);
  const inp = useRef(null);
  const uid = useId().replace(/:/g, '');
  const busca = searchable ?? true; // pesquisa em todos os campos
  const termo = q.trim();
  const filtra = termo.length >= MIN_BUSCA; // LIKE '%termo%' a partir de 3 caracteres
  const atual = options.find((o) => String(o.value) === String(value));
  const lista = options.filter((o) => !filtra || semAcento(`${o.label} ${o.sub || ''} ${o.tag || ''} ${o.grupo || ''}`).includes(semAcento(termo)));
  const mostraPh = !atual || ehPlaceholder(atual);

  const medir = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const abaixo = window.innerHeight - r.bottom, acima = r.top;
    const cima = abaixo < 300 && acima > abaixo;
    setPos({ left: r.left, width: Math.max(r.width, 220), top: cima ? undefined : r.bottom + 6, bottom: cima ? window.innerHeight - r.top + 6 : undefined,
      max: Math.max(200, (cima ? acima : abaixo) - 20) });
  };
  useLayoutEffect(() => { if (open) medir(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    const fora = (e) => { if (!btn.current?.contains(e.target) && !pop.current?.contains(e.target)) setOpen(false); };
    const rolagem = (e) => { if (!pop.current?.contains(e.target)) medir(); };
    document.addEventListener('mousedown', fora);
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', rolagem, true);
    return () => { document.removeEventListener('mousedown', fora); window.removeEventListener('resize', medir); window.removeEventListener('scroll', rolagem, true); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (open) document.getElementById(`cb-${uid}-${hi}`)?.scrollIntoView({ block: 'nearest' }); }, [hi, open, uid]);

  const abrir = () => {
    if (disabled) return;
    setOpen(true); setQ('');
    setHi(Math.max(0, options.findIndex((o) => String(o.value) === String(value))));
    setTimeout(() => inp.current?.focus({ preventScroll: true }), 0);
  };
  const fechar = () => { setOpen(false); btn.current?.focus({ preventScroll: true }); };
  const escolher = (o) => { if (o.disabled) return; onChange(String(o.value)); fechar(); };
  const prox = (d) => setHi((h) => { let n = h; for (let k = 0; k < lista.length; k++) { n = (n + d + lista.length) % lista.length; if (!lista[n]?.disabled) return n; } return h; });
  const tecla = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); prox(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); prox(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (lista[hi]) escolher(lista[hi]); }
    else if (e.key === 'Escape') { e.preventDefault(); fechar(); }
    else if (e.key === 'Tab') setOpen(false);
  };
  const teclaBtn = (e) => { if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); abrir(); } };

  let ultimoGrupo;
  return (
    <div className={`${s.combo} ${className}`} style={style}>
      <button type="button" id={id} ref={btn} className={`${s.btn} ${open ? s.open : ''}`} disabled={disabled} aria-haspopup="listbox" aria-expanded={open}
        aria-label={ariaLabel} onClick={() => (open ? setOpen(false) : abrir())} onKeyDown={teclaBtn}>
        {avatar && atual && !mostraPh && <span className={s.av}>{iniciais(atual.label)}</span>}
        <span className={mostraPh ? s.ph : s.val}>{atual && !ehPlaceholder(atual) ? atual.label : atual?.label || placeholder}</span>
        {atual?.tag && !mostraPh && <span className={s.tag}>{atual.tag}</span>}
        <ChevronDown size={18} className={s.chev} aria-hidden="true" />
      </button>
      {(required || name) && <input className={s.req} tabIndex={-1} name={name} value={value ?? ''} onChange={() => {}} required={required} aria-hidden="true" />}
      {open && pos && createPortal(
        <div ref={pop} className={s.pop} style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }}>
          <div className={`${s.search} ${busca ? '' : s.searchOff}`}><Search size={16} aria-hidden="true" />
            <input ref={inp} role="combobox" aria-expanded="true" aria-controls={`cbl-${uid}`} aria-activedescendant={`cb-${uid}-${hi}`} readOnly={!busca}
              value={busca ? q : ''} onChange={(e) => { setQ(e.target.value); setHi(0); }} onKeyDown={tecla} placeholder="Pesquisar (mín. 3 letras)…" />
          </div>
          <ul role="listbox" id={`cbl-${uid}`} className={s.list} style={{ maxHeight: Math.min(280, pos.max) }}>
            {lista.length === 0 && <li className={s.empty}>{emptyText}</li>}
            {lista.map((o, i) => {
              const sel = String(o.value) === String(value);
              const cab = o.grupo && o.grupo !== ultimoGrupo ? <li className={s.grp} role="presentation" key={`g-${o.grupo}`}>{o.grupo}</li> : null;
              ultimoGrupo = o.grupo;
              return (
                <React.Fragment key={o.value}>
                  {cab}
                  <li id={`cb-${uid}-${i}`} role="option" aria-selected={sel} aria-disabled={o.disabled || undefined}
                    className={`${s.opt} ${i === hi ? s.hi : ''} ${sel ? s.sel : ''} ${o.disabled ? s.dis : ''}`}
                    onMouseEnter={() => !o.disabled && setHi(i)} onMouseDown={(e) => { e.preventDefault(); escolher(o); }}>
                    {avatar && <span className={s.av}>{iniciais(o.label)}</span>}
                    <span className={s.txt}><span><Destaque texto={String(o.label)} q={filtra ? termo : ''} /></span>{o.sub && <small>{o.sub}</small>}</span>
                    {o.tag && <span className={s.tag}>{o.tag}</span>}
                    {sel && <Check size={16} aria-hidden="true" />}
                  </li>
                </React.Fragment>
              );
            })}
          </ul>
          <div className={s.foot}><span>{filtra ? `${lista.length} de ${options.length}` : `${options.length} opç${options.length === 1 ? 'ão' : 'ões'}`}</span><span><kbd>↑↓</kbd> navegar · <kbd>Enter</kbd> escolher</span></div>
        </div>, document.body)}
    </div>
  );
};

/* Substituto direto de <select>: mesmas props e <option> como filhos; onChange recebe { target: { value, name } }. */
export const Select = ({ children, value, defaultValue, onChange, disabled, required, name, id, style, className, placeholder, searchable, avatar, ...rest }) => {
  const [interno, setInterno] = useState(defaultValue ?? '');
  const controlado = value !== undefined;
  const atual = controlado ? value : interno;
  const options = lerOpcoes(children);
  const mudar = (v) => {
    if (!controlado) setInterno(v);
    onChange?.({ target: { value: v, name, id }, currentTarget: { value: v, name, id } });
  };
  const st = style?.width === 'auto' ? { ...style, display: 'inline-block', minWidth: 160 } : style;
  return <Combobox value={atual == null ? '' : String(atual)} onChange={mudar} options={options} disabled={disabled} required={required} name={name} id={id}
    style={st} ariaLabel={rest['aria-label']} placeholder={placeholder} searchable={searchable} avatar={avatar} />;
};

export default Select;
