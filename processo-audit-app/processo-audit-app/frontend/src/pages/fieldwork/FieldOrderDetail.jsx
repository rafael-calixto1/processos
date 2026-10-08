import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { PlayCircle, ClipboardCheck } from 'lucide-react';
import { osAPI } from '../../api/estoque';
import { useServiceOrder, useFieldWork, toFieldOrder } from './state';
import { fw, ScreenHeader, StickyActionBar, StickyButton, NetworkMap, AddressLink, slaInfo, fmtCoord } from './ui';

const FieldOrderDetail = () => {
  const { orderId } = useParams();
  const nav = useNavigate();
  const { dispatch, state } = useFieldWork();
  const { order, draft, act } = useServiceOrder(orderId);
  const [target, setTarget] = useState('pole'); // pole | pop | route
  const [now] = useState(() => Date.now());

  // A lista não traz descrição nem quem abriu: busca o detalhe da OS
  useEffect(() => {
    if (!order) return;
    osAPI.get(orderId).then((os) => dispatch({ type: 'ORDER_DETAIL_LOADED', order: toFieldOrder(os) })).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, Boolean(order)]);

  if (state.loading) return <div className="spinner" />;
  if (!order) return <Navigate to="/os" replace />;

  const sla = slaInfo(order.slaDeadline, now);
  const started = draft.status === 'in_execution';
  const start = () => { act('EXECUTION_STARTED'); nav(`/os/${orderId}/finalizar`); };
  const points = {
    pole: order.pole?.lat != null && { lat: order.pole.lat, lng: order.pole.lng, label: 'poste' },
    pop: order.pop?.lat != null && { lat: order.pop.lat, lng: order.pop.lng, label: 'POP' },
    route: order.route?.startLat != null && { lat: order.route.startLat, lng: order.route.startLng, label: 'início da rota' },
  };
  const tabs = [['pole', order.pole?.id], ['pop', order.pop?.name], ['route', order.route?.id]].filter(([k, l]) => l && points[k]);
  const point = points[target] || points[tabs[0]?.[0]];

  return (
    <div className={fw.screen}>
      <ScreenHeader title={order.code} subtitle={order.kind} backTo="/os" />
      <div className={fw.body}>
        <div className={fw.card}>
          <p className={fw.cardTitle}>Elementos de rede</p>
          <dl className={fw.dl}>
            <div><dt>Intervenção</dt><dd>{order.serviceType ? `${order.serviceType} · ` : ''}{order.kind}</dd></div>
            {order.address && <div><dt>Endereço</dt><dd>{order.address}</dd></div>}
            {order.pop && <div><dt>POP</dt><dd>{order.pop.name} <span className={`${fw.mono} ${fw.muted}`}>{order.pop.id}</span></dd></div>}
            {order.route && <div><dt>Rota</dt><dd>{order.route.id}{order.route.label && ` — ${order.route.label}`}</dd></div>}
            {order.pole && <div><dt>Poste</dt><dd>{order.pole.id}</dd></div>}
            {order.pole?.lat != null && <div><dt>Coordenadas</dt><dd className={fw.mono}>{fmtCoord(order.pole.lat)}, {fmtCoord(order.pole.lng)}</dd></div>}
          </dl>
        </div>
        <div className={fw.card}>
          <p className={fw.cardTitle}>SLA e abertura</p>
          <dl className={fw.dl}>
            <div><dt>Prazo</dt><dd><span className={`${fw.pill} ${fw[`sla_${sla.state}`]}`}>{sla.label}</span></dd></div>
            <div><dt>Aberta por</dt><dd>{order.openedBy.name}</dd></div>
            <div><dt>Aberta em</dt><dd>{order.openedAt ? new Date(order.openedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</dd></div>
          </dl>
          {order.summary && <p style={{ margin: '12px 0 0' }}>{order.summary}</p>}
        </div>
        {point ? (
          <div>
            {tabs.length > 1 && (
              <div className={fw.mapTabs} role="tablist" aria-label="Alvo no mapa">
                {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={target === k} className={`${fw.mapTab} ${target === k ? fw.mapTabOn : ''}`} onClick={() => setTarget(k)}>{l}</button>)}
              </div>
            )}
            <NetworkMap lat={point.lat} lng={point.lng} label={point.label} />
          </div>
        ) : order.address && <AddressLink address={order.address} />}
      </div>
      <StickyActionBar>
        {started
          ? <StickyButton tone="confirm" icon={ClipboardCheck} onClick={() => nav(`/os/${orderId}/finalizar`)}>Continuar finalização</StickyButton>
          : <StickyButton tone="start" icon={PlayCircle} onClick={start}>Iniciar Execução</StickyButton>}
      </StickyActionBar>
    </div>
  );
};
export default FieldOrderDetail;
