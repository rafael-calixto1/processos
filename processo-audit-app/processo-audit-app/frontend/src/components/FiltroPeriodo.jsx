import React from 'react';
import { CalendarRange, X } from 'lucide-react';
import DateInput from './DateInput';
import { ATALHOS, periodoDoAtalho } from './periodo';
import styles from './FiltroPeriodo.module.css';

/* Período De/Até com atalhos. value = { de, ate } em "AAAA-MM-DD" ('' = sem limite). */
export default function FiltroPeriodo({ value, onChange, label = 'Cadastro' }) {
  const { de, ate } = value;
  const atalhoAtivo = ATALHOS.find(a => {
    const p = periodoDoAtalho(a.id);
    return p.de === de && p.ate === ate;
  })?.id;

  return (
    <div className={styles.wrap} role="group" aria-label={`Filtrar por data de ${label.toLowerCase()}`}>
      <span className={styles.rotulo}><CalendarRange size={15} />{label}</span>
      <div className={styles.datas}>
        <DateInput className={styles.data} value={de} max={ate || undefined} placeholder="de" aria-label="Data inicial"
          onChange={e => onChange({ de: e.target.value, ate })} />
        <span className={styles.ate}>até</span>
        <DateInput className={styles.data} value={ate} min={de || undefined} placeholder="até" aria-label="Data final"
          onChange={e => onChange({ de, ate: e.target.value })} />
      </div>
      <div className={styles.atalhos}>
        {ATALHOS.map(a => (
          <button key={a.id} type="button" className={`${styles.atalho} ${atalhoAtivo === a.id ? styles.ativo : ''}`}
            onClick={() => onChange(periodoDoAtalho(a.id))}>{a.label}</button>
        ))}
        {(de || ate) && (
          <button type="button" className={styles.limpar} onClick={() => onChange({ de: '', ate: '' })} title="Limpar período">
            <X size={14} /> Limpar
          </button>
        )}
      </div>
    </div>
  );
}
