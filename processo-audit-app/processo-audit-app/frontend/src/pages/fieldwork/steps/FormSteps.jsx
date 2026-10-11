import React, { useState } from 'react';
import { Crosshair, Check, MapPin } from 'lucide-react';
import AddressSearch from '../../../components/AddressSearch';
import { geoAPI } from '../../../api/estoque';
import { fw, YesNo, NetworkMap, fmtCoord, StickyButton } from '../ui';
import StepScreen, { CatalogGate } from './StepScreen';

export const DescriptionStep = () => (
  <StepScreen stepKey="description">
    {({ draft, act, catalogs }) => { const minimo = catalogs?.regras?.descricao_min_caracteres ?? 11; return (
      <div className={`${fw.card} ${fw.field}`}>
        <label htmlFor="desc">O que foi executado em campo?</label>
        <textarea id="desc" value={draft.description} placeholder="Ex.: Lançados 1.850 m de ASU 12F entre PL-0932 e CEO-03; fusões 1 a 8 e CEO vedada." onChange={(e) => act('DESCRIPTION_CHANGED', { value: e.target.value })} />
        <span className={fw.muted}>Mínimo de {minimo} caracteres · {draft.description.trim().length} digitados</span>
        {draft.description.trim().length < minimo && <p className={fw.callout} role="alert" style={{ margin: 0 }}>Descrição com menos de {minimo} caracteres não conclui a etapa. Escreva mais detalhes.</p>}
      </div>
    ); }}
  </StepScreen>
);

export const ClosingReasonStep = () => (
  <StepScreen stepKey="closing-reason">
    {({ draft, act }) => (
      <CatalogGate>
        {(catalogs) => (
          <div className={fw.optionList} role="radiogroup" aria-label="Motivo de fechamento">
            {catalogs.motivos.map((r) => {
              const on = draft.closingReasonId === r.codigo;
              return (
                <button key={r.codigo} role="radio" aria-checked={on} className={`${fw.optionRow} ${on ? fw.optionOn : ''}`} onClick={() => act('CLOSING_REASON_SELECTED', { reasonId: r.codigo })}>
                  <span className={`${fw.mark} ${fw.radioMark}`} />{r.rotulo}
                </button>
              );
            })}
          </div>
        )}
      </CatalogGate>
    )}
  </StepScreen>
);

export const InterventionLocationStep = () => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [addr, setAddr] = useState('');
  const pickAddress = async (act, it) => {
    setError('');
    let { latitude: lat, longitude: lng } = it; let approx = false;
    if (lat == null) {
      setBusy(true);
      try { ({ latitude: lat, longitude: lng, aproximado: approx } = await geoAPI.geocode({ street: it.logradouro, numero: it.numero, city: it.cidade, uf: it.uf, cep: it.cep, bairro: it.bairro })); } catch { /* cai na mensagem abaixo */ }
      setBusy(false);
    }
    if (lat == null) { setError('Não foi possível localizar esse endereço no mapa. Escolha outro ou use o GPS.'); return; }
    act('INTERVENTION_LOCATION_SET', { location: { lat: Number(lat), lng: Number(lng), source: 'address', address: it.label, approximate: Boolean(approx) } });
  };
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
                  <span className={fw.muted}>{loc.source === 'gps' ? `GPS · precisão ±${loc.accuracyMeters} m` : loc.source === 'address' ? `Endereço · ${loc.address}${loc.approximate ? ' (posição aproximada: a rua não está no mapa, confirme pelo GPS no local)' : ''}` : `Referência do ${order.pole?.id}`}</span>
                </>
              ) : <span className={fw.muted}>Nenhuma posição registrada ainda.</span>}
              {error && <p className={fw.callout} role="alert" style={{ marginTop: 10 }}>{error}</p>}
            </div>
            {loc && <NetworkMap lat={loc.lat} lng={loc.lng} label="local da intervenção" />}
            <div className={`${fw.card} ${fw.field}`}>
              <label>Escolher o local pelo endereço</label>
              <AddressSearch value={addr} onChange={setAddr} onPick={(it) => pickAddress(act, it)} />
              <span className={fw.muted}>Digite o CEP, as coordenadas (lat, lng) ou a rua com número e escolha a sugestão.</span>
            </div>
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
      <CatalogGate>
        {(catalogs) => (
          <div className={fw.card}>
            {catalogs.checklist.length === 0 && <p className={fw.muted} style={{ margin: 0 }}>Nenhum item de checklist. Pode seguir.</p>}
            {catalogs.checklist.map((item) => {
              const v = draft.checklistAnswers[item.codigo];
              const set = (value) => act('CHECKLIST_ANSWERED', { itemId: item.codigo, value });
              const inputId = `chk-${item.codigo}`;
              return (
                <div key={item.codigo} className={fw.checkRow}>
                  <label htmlFor={inputId} className={fw.fieldLabel}>{item.rotulo}{item.obrigatorio && <span aria-hidden="true" style={{ color: 'var(--error)' }}> *</span>}</label>
                  {item.tipo === 'boolean' && <YesNo label={item.rotulo} value={v} onChange={set} />}
                  {item.tipo === 'number' && (
                    <div className={`${fw.field} ${fw.inputUnit}`}>
                      <input id={inputId} type="number" inputMode="decimal" min="0" step={item.unidade === 'm' ? '0.1' : '1'} value={v ?? ''} onChange={(e) => set(e.target.value)} />
                      <span>{item.unidade}</span>
                    </div>
                  )}
                  {item.tipo === 'text' && <div className={fw.field}><textarea id={inputId} style={{ minHeight: 88 }} value={v ?? ''} onChange={(e) => set(e.target.value)} /></div>}
                </div>
              );
            })}
          </div>
        )}
      </CatalogGate>
    )}
  </StepScreen>
);

export const CrewStep = () => (
  <StepScreen stepKey="crew">
    {({ draft, act }) => (
      <CatalogGate>
        {(catalogs) => (
          <>
            <p className={fw.muted} style={{ margin: 0 }}>Marque quem ajudou no lançamento e no trabalho em altura. Opcional.</p>
            {catalogs.tecnicos.length === 0 && <p className={fw.muted} style={{ margin: 0 }}>Nenhum outro técnico ou equipe cadastrado.</p>}
            <div className={fw.optionList}>
              {catalogs.tecnicos.map((m) => {
                const on = draft.crewMemberIds.includes(m.id);
                return (
                  <button key={m.id} role="checkbox" aria-checked={on} className={`${fw.optionRow} ${on ? fw.optionOn : ''}`} onClick={() => act('CREW_MEMBER_TOGGLED', { memberId: m.id })}>
                    <span className={`${fw.mark} ${fw.checkMark}`}>{on && <Check size={16} />}</span>
                    <span>{m.nome}<small className={fw.optionSub}>{m.tipo === 'interno' ? 'Técnico interno' : `Equipe terceirizada${m.empresa ? ` · ${m.empresa}` : ''}`}</small></span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </CatalogGate>
    )}
  </StepScreen>
);
