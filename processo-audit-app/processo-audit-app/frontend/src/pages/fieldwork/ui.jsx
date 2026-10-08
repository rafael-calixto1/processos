import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Minus, ExternalLink } from 'lucide-react';
import css from './fieldwork.module.css';

export const fw = css;

/* Botão fixo no rodapé: tone = confirm (verde) | start (azul) | alert (âmbar) */
export const StickyActionBar = ({ children }) => <div className={css.stickyBar}>{children}</div>;

export const StickyButton = ({ tone = 'confirm', icon: Icon, children, ...rest }) => (
  <button className={`${css.stickyBtn} ${css[`tone_${tone}`]}`} {...rest}>
    {Icon && <Icon size={20} aria-hidden="true" />}{children}
  </button>
);

/* X vermelho → check verde. Etapas opcionais pendentes mostram traço neutro. */
export const StepStatusIcon = ({ done, optional }) => {
  if (done) return <CheckCircle2 size={26} className={css.stepDone} aria-label="Concluída" />;
  if (optional) return <Minus size={26} className={css.stepOptional} aria-label="Opcional" />;
  return <XCircle size={26} className={css.stepPending} aria-label="Pendente" />;
};

export const Toggle = ({ checked, onChange, label, id }) => (
  <button type="button" role="switch" id={id} aria-checked={checked} aria-label={label}
    className={`${css.toggle} ${checked ? css.toggleOn : ''}`} onClick={() => onChange(!checked)}>
    <span className={css.toggleKnob} />
  </button>
);

/* Sim / Não grande, para respostas booleanas em campo (luvas, sol, pressa) */
export const YesNo = ({ value, onChange, label }) => (
  <div className={css.yesNo} role="group" aria-label={label}>
    <button type="button" aria-pressed={value === true} className={value === true ? css.yesOn : ''} onClick={() => onChange(true)}>Sim</button>
    <button type="button" aria-pressed={value === false} className={value === false ? css.noOn : ''} onClick={() => onChange(false)}>Não</button>
  </div>
);

export const ScreenHeader = ({ title, subtitle, backTo }) => {
  const nav = useNavigate();
  return (
    <header className={css.screenHeader}>
      <button className={css.backBtn} onClick={() => (backTo ? nav(backTo) : nav(-1))} aria-label="Voltar"><ArrowLeft size={22} /></button>
      <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
    </header>
  );
};

/* Mapa sem dependência extra: OpenStreetMap embutido + atalho para o app de mapas do aparelho */
export const NetworkMap = ({ lat, lng, label, height = 220 }) => {
  const d = 0.004;
  const bbox = [lng - d, lat - d, lng + d, lat + d].join('%2C');
  return (
    <div className={css.mapBox}>
      <iframe title={`Mapa: ${label}`} loading="lazy" style={{ height }}
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`} />
      <a className={css.mapLink} href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noreferrer">
        <ExternalLink size={16} />Abrir rota até o {label}
      </a>
    </div>
  );
};

export const fmtCoord = (n) => Number(n).toFixed(6);

/* Contagem regressiva do SLA: devolve { label, state } */
export const slaInfo = (deadlineIso, now = Date.now()) => {
  if (!deadlineIso) return { label: 'Sem prazo', state: 'on_time' };
  const ms = new Date(deadlineIso).getTime() - now;
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600000); const m = Math.floor((abs % 3600000) / 60000);
  const txt = h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${String(m).padStart(2, '0')}min`;
  if (ms < 0) return { label: `Estourado há ${txt}`, state: 'breached' };
  return { label: `Restam ${txt}`, state: ms < 4 * 3600000 ? 'at_risk' : 'on_time' };
};

/* Sem coordenadas cadastradas: só o atalho de busca pelo endereço */
export const AddressLink = ({ address }) => (
  <a className={`${css.mapBox} ${css.mapLink}`} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">
    <ExternalLink size={16} />Ver endereço no mapa
  </a>
);
