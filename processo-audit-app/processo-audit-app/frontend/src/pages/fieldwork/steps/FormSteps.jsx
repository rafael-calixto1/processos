import React, { useState } from 'react';
import { Crosshair, Check, MapPin } from 'lucide-react';
import { CLOSING_REASONS, OUTSIDE_PLANT_CHECKLIST, CREW_DIRECTORY } from '../mockData';
import { fw, YesNo, NetworkMap, fmtCoord, StickyButton } from '../ui';
import StepScreen from './StepScreen';

export const DescriptionStep = () => (
  <StepScreen stepKey="description">
    {({ draft, act }) => (
      <div className={`${fw.card} ${fw.field}`}>
        <label htmlFor="desc">O que foi executado em campo?</label>
        <textarea id="desc" value={draft.description} placeholder="Ex.: Lançados 1.850 m de ASU 12F entre PL-0932 e CEO-03; fusões 1 a 8 e CEO vedada." onChange={(e) => act('DESCRIPTION_CHANGED', { value: e.target.value })} />
        <span className={fw.muted}>Mínimo de 10 caracteres · {draft.description.trim().length} digitados</span>
      </div>
    )}
  </StepScreen>
);

export const ClosingReasonStep = () => (
  <StepScreen stepKey="closing-reason">
    {({ draft, act }) => (
      <div className={fw.optionList} role="radiogroup" aria-label="Motivo de fechamento">
        {CLOSING_REASONS.map((r) => {
          const on = draft.closingReasonId === r.id;
          return (
            <button key={r.id} role="radio" aria-checked={on} className={`${fw.optionRow} ${on ? fw.optionOn : ''}`} onClick={() => act('CLOSING_REASON_SELECTED', { reasonId: r.id })}>
              <span className={`${fw.mark} ${fw.radioMark}`} />{r.label}
            </button>
          );
        })}
      </div>
    )}
  </StepScreen>
);

export const InterventionLocationStep = () => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const capture = (act) => {
    setError('');
    if (!navigator.geolocation) { setError('Este navegador não oferece GPS.'); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { act('INTERVENTION_LOCATION_SET', { location: { lat: p.coords.latitude, lng: p.coords.longitude, accuracyMeters: Math.round(p.coords.accuracy), source: 'gps' } }); setBusy(false); },
      () => { setError('Não foi possível obter o GPS. Verifique a permissão de localização ou use as coordenadas do poste.'); setBusy(false); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };
  return (
    <StepScreen stepKey="intervention-location">
      {({ order, draft, act }) => {
        const loc = draft.interventionLocation;
        return (
          <>
            <div className={fw.card}>
              <p className={fw.cardTitle}>Local da intervenção</p>
              {loc ? (
                <>
                  <div className={`${fw.locationValue} ${fw.mono}`}>{fmtCoord(loc.lat)}, {fmtCoord(loc.lng)}</div>
                  <span className={fw.muted}>{loc.source === 'gps' ? `GPS · precisão ±${loc.accuracyMeters} m` : `Referência do ${order.pole?.id}`}</span>
                </>
              ) : <span className={fw.muted}>Nenhuma posição registrada ainda.</span>}
              {error && <p className={fw.callout} role="alert" style={{ marginTop: 10 }}>{error}</p>}
            </div>
            {loc && <NetworkMap lat={loc.lat} lng={loc.lng} label="local da intervenção" />}
            <button className={fw.btnOutline} disabled={busy} onClick={() => capture(act)}><Crosshair size={20} />{busy ? 'Obtendo GPS…' : 'Capturar posição por GPS'}</button>
            {order.pole?.lat != null && (
              <button className={fw.btnOutline} style={{ borderStyle: 'solid', borderColor: 'var(--border-color)', color: 'var(--text-medium)' }}
                onClick={() => act('INTERVENTION_LOCATION_SET', { location: { lat: order.pole.lat, lng: order.pole.lng, source: 'pole_reference' } })}>
                <MapPin size={20} />Usar coordenadas do {order.pole.id}
              </button>
            )}
          </>
        );
      }}
    </StepScreen>
  );
};

export const ChecklistStep = () => (
  <StepScreen stepKey="checklists">
    {({ draft, act }) => (
      <div className={fw.card}>
        {OUTSIDE_PLANT_CHECKLIST.map((item) => {
          const v = draft.checklistAnswers[item.id];
          const set = (value) => act('CHECKLIST_ANSWERED', { itemId: item.id, value });
          const inputId = `chk-${item.id}`;
          return (
            <div key={item.id} className={fw.checkRow}>
              <label htmlFor={inputId} className={fw.fieldLabel}>{item.label}{item.required && <span aria-hidden="true" style={{ color: 'var(--error)' }}> *</span>}</label>
              {item.type === 'boolean' && <YesNo label={item.label} value={v} onChange={set} />}
              {item.type === 'number' && (
                <div className={`${fw.field} ${fw.inputUnit}`}>
                  <input id={inputId} type="number" inputMode="decimal" min="0" step={item.unit === 'm' ? '0.1' : '1'} value={v ?? ''} onChange={(e) => set(e.target.value)} />
                  <span>{item.unit}</span>
                </div>
              )}
              {item.type === 'text' && <div className={fw.field}><textarea id={inputId} style={{ minHeight: 88 }} value={v ?? ''} onChange={(e) => set(e.target.value)} /></div>}
            </div>
          );
        })}
      </div>
    )}
  </StepScreen>
);

export const CrewStep = () => (
  <StepScreen stepKey="crew">
    {({ draft, act }) => (
      <>
        <p className={fw.muted} style={{ margin: 0 }}>Marque quem ajudou no lançamento e no trabalho em altura. Opcional.</p>
        <div className={fw.optionList}>
          {CREW_DIRECTORY.map((m) => {
            const on = draft.crewMemberIds.includes(m.id);
            return (
              <button key={m.id} role="checkbox" aria-checked={on} className={`${fw.optionRow} ${on ? fw.optionOn : ''}`} onClick={() => act('CREW_MEMBER_TOGGLED', { memberId: m.id })}>
                <span className={`${fw.mark} ${fw.checkMark}`}>{on && <Check size={16} />}</span>
                <span>{m.name}<small className={fw.optionSub}>{m.role}</small></span>
              </button>
            );
          })}
        </div>
      </>
    )}
  </StepScreen>
);
