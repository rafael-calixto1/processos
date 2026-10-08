import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, Network, User, ChevronRight, Inbox, RefreshCw, XCircle } from 'lucide-react';
import { usePendingOrders } from './state';
import { fw, ScreenHeader, slaInfo } from './ui';

const PRIORITY = { high: ['prio_high', 'Alta'], normal: ['prio_normal', 'Normal'] };

const FieldOrderList = () => {
  const nav = useNavigate();
  const { orders, loading, error, reload } = usePendingOrders();
  const [now] = useState(() => Date.now());
  const sorted = [...orders].sort((a, b) => (a.slaDeadline || '9').localeCompare(b.slaDeadline || '9'));

  return (
    <div className={fw.screen}>
      <ScreenHeader title="OS pendentes" subtitle={loading ? 'Carregando…' : `${sorted.length} ordem(ns) de infraestrutura`} backTo="/dashboard" />
      <div className={fw.body}>
        {error && (
          <div className={`${fw.card} ${fw.emptyState}`} role="alert"><XCircle size={36} /><b>{error}</b>
            <button className={fw.btnOutline} onClick={reload}><RefreshCw size={18} />Tentar de novo</button></div>
        )}
        {!loading && !error && sorted.length === 0 && <div className={`${fw.card} ${fw.emptyState}`}><Inbox size={36} /><b>Nenhuma OS pendente</b></div>}
        {sorted.map((o) => {
          const sla = slaInfo(o.slaDeadline, now);
          const [pCls, pLabel] = PRIORITY[o.priority] || PRIORITY.normal;
          return (
            <button key={o.id} className={`${fw.card} ${fw.orderCard}`} onClick={() => nav(`/os/${o.id}`)}>
              <div className={fw.orderTop}>
                <span className={fw.orderCode}>{o.code}</span>
                <span style={{ display: 'flex', gap: 6 }}>
                  <span className={`${fw.pill} ${fw[pCls]}`}>{pLabel}</span>
                  <span className={`${fw.pill} ${fw[`sla_${sla.state}`]}`}><Clock size={13} />{sla.label}</span>
                </span>
              </div>
              <div className={fw.orderKind}>{o.kind}</div>
              <div className={fw.metaRow}>
                {o.pop && <span><Network size={14} />{o.pop.name}</span>}
                {(o.route || o.pole) && <span><MapPin size={14} />{[o.route?.id, o.pole?.id].filter(Boolean).join(' · ')}</span>}
                {o.address && <span><MapPin size={14} />{o.address}</span>}
                <span><User size={14} />{o.openedBy.name}</span>
              </div>
              <span className={fw.muted} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}><ChevronRight size={18} /></span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
export default FieldOrderList;
