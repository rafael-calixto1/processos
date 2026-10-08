import React from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { useServiceOrder, FINALIZATION_STEPS } from '../state';
import { fw, ScreenHeader, StickyActionBar, StickyButton } from '../ui';

/* Moldura comum das etapas: cabeçalho + conteúdo + botão fixo "Ok" que volta ao checklist */
const StepScreen = ({ stepKey, children, action, okDisabled }) => {
  const { orderId } = useParams();
  const nav = useNavigate();
  const so = useServiceOrder(orderId);
  if (so.loading && !so.order) return null;
  if (!so.order || so.draft.status !== 'in_execution') return <Navigate to={`/os/${orderId}`} replace />;
  const back = `/os/${orderId}/finalizar`;
  const label = FINALIZATION_STEPS.find((s) => s.key === stepKey)?.label;
  return (
    <div className={fw.screen}>
      <ScreenHeader title={label} subtitle={`${so.order.code} · ${so.order.kind}`} backTo={back} />
      <div className={fw.body}>{typeof children === 'function' ? children(so) : children}</div>
      <StickyActionBar>
        {action}
        <StickyButton tone="confirm" disabled={okDisabled} onClick={() => nav(back)}>Ok</StickyButton>
      </StickyActionBar>
    </div>
  );
};
export default StepScreen;
