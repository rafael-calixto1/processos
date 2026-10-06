import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './DateInput.module.css';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const pad = (n) => String(n).padStart(2, '0');
const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseIso = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const fmt = (v) => { const d = parseIso(v); return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : ''; };

/* Substituto de <input type="date">: mesmo contrato (value "AAAA-MM-DD", onChange com e.target.value). */
const DateInput = ({ value, onChange, className, min, max, required, disabled, id, name, placeholder = 'dd/mm/aaaa', ...rest }) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => parseIso(value) || new Date());
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const wrapRef = useRef(null);
  const popRef = useRef(null);

  const selected = parseIso(value);
  const minD = parseIso(min);
  const maxD = parseIso(max);
  const todayIso = toIso(new Date());

  const emit = (v) => onChange?.({ target: { value: v, name, id } });

  const toggle = () => {
    if (disabled) return;
    if (!open) setView(parseIso(value) || new Date());
    setOpen((o) => !o);
  };

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    const h = popRef.current?.offsetHeight || 330;
    const below = window.innerHeight - r.bottom;
    const top = below < h + 12 && r.top > h ? r.top - h - 6 : r.bottom + 6;
    const left = Math.min(r.left, window.innerWidth - 300);
    setPos({ top, left: Math.max(8, left) });
  }, [open, view]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (wrapRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onScroll = (e) => { if (!popRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', () => setOpen(false));
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const y = view.getFullYear();
  const m = view.getMonth();
  const first = new Date(y, m, 1);
  const start = new Date(y, m, 1 - first.getDay());
  const dias = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));

  const bloqueado = (d) => (minD && d < minD) || (maxD && d > maxD);
  const escolher = (d) => { if (bloqueado(d)) return; emit(toIso(d)); setOpen(false); };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); if (!open) toggle(); }
    else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); emit(''); }
    else if (e.key !== 'Tab' && e.key !== 'Escape') e.preventDefault();
  };

  return (
    <div className={styles.wrap} ref={wrapRef} style={/dateInput/.test(className || '') ? { width: 'auto', display: 'inline-block' } : undefined}>
      <input
        {...rest}
        id={id}
        name={name}
        type="text"
        className={`${className || ''} ${styles.field}`}
        value={fmt(value)}
        placeholder={placeholder}
        onChange={() => {}}
        onKeyDown={onKeyDown}
        onClick={toggle}
        required={required}
        disabled={disabled}
        autoComplete="off"
        aria-haspopup="dialog"
        aria-expanded={open}
      />
      <button type="button" className={styles.icon} onClick={toggle} tabIndex={-1} aria-label="Abrir calendário" disabled={disabled}>
        <Calendar size={16} />
      </button>

      {open && createPortal(
        <div className={styles.popover} ref={popRef} style={{ top: pos.top, left: pos.left }} role="dialog" aria-label="Calendário">
          <div className={styles.head}>
            <button type="button" className={styles.nav} onClick={() => setView(new Date(y, m - 1, 1))} aria-label="Mês anterior"><ChevronLeft size={18} /></button>
            <div className={styles.title}>{MESES[m]} <span>{y}</span></div>
            <button type="button" className={styles.nav} onClick={() => setView(new Date(y, m + 1, 1))} aria-label="Próximo mês"><ChevronRight size={18} /></button>
          </div>
          <div className={styles.grid}>
            {SEMANA.map((d, i) => <div key={i} className={styles.dow}>{d}</div>)}
            {dias.map((d) => {
              const iso = toIso(d);
              const cls = [
                styles.day,
                d.getMonth() !== m ? styles.out : '',
                iso === todayIso ? styles.today : '',
                selected && iso === toIso(selected) ? styles.sel : '',
              ].join(' ');
              return (
                <button type="button" key={iso} className={cls} disabled={bloqueado(d)} onClick={() => escolher(d)}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <div className={styles.foot}>
            <button type="button" className={styles.link} onClick={() => { emit(''); setOpen(false); }}>Limpar</button>
            <button type="button" className={styles.link} onClick={() => { escolher(new Date()); }}>Hoje</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default DateInput;
