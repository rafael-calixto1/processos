import React, { useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { ChevronRight, CheckCircle2, Flag } from 'lucide-react';
import { osAPI } from '../../api/estoque';
import { useServiceOrder, useFieldWork, useOrderDetail, FINALIZATION_STEPS } from './state';
import { fw, ScreenHeader, StepStatusIcon, StickyActionBar, StickyButton } from './ui';

const hintFor = (key, d, order) => ({
  'description': d.description.trim() && (d.description.trim().length > 10 ? `${d.description.trim().slice(0, 40)}…` : 'Muito curta: mínimo de 11 caracteres'),
  'closing-reason': d.closingReasonId && 'Selecionado',
  'intervention-location': d.interventionLocation && `${d.interventionLocation.lat.toFixed(5)}, ${d.interventionLocation.lng.toFixed(5)}`,
  'checklists': `${Object.keys(d.checklistAnswers).length} respostas`,
  'used-materials': order.launches.length > 0 ? `${order.launches.length} lançamento(s)` : d.usedMaterials.wereUsed === false ? 'Nenhum material usado' : null,
  'removed-materials': d.removedMaterials.wereRemoved === null ? null : d.removedMaterials.wereRemoved ? `${d.removedMaterials.lines.length} item(ns)` : 'Nenhum material retirado',
  'service-photos': d.servicePhotos.length && `${d.servicePhotos.length} foto(s)`,
  'crew': d.crewMemberIds.length && `${d.crewMemberIds.length} participante(s)`,
}[key] || null);

const FinalizationHub = () => {
  const { orderId } = useParams();
  const nav = useNavigate();
  const { order, draft, completion, canFinalize, act, loading } = useServiceOrder(orderId);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { reload } = useFieldWork();
  useOrderDetail(orderId);

  // Registra a descrição como serviço realizado e encerra a OS no backend
  const finalize = async () => {
    setBusy(true); setError('');
    try {
      await osAPI.adicionarServico(order.id, { descricao: draft.description.trim() });
      await osAPI.fechar(order.id);
      act('ORDER_CLOSED'); setConfirming(false); reload();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  if (loading && !order) return null;
  if (!order) return <Navigate to="/os" replace />;
  if (draft.status === 'pending') return <Navigate to={`/os/${orderId}`} replace />;

  if (draft.status === 'closed') {
    return (
      <div className={`${fw.screen} ${fw.successScreen}`}>
        <CheckCircle2 size={72} />
        <h1>{order.code} finalizada</h1>
        <p className={fw.muted}>{order.kind}</p>
        <StickyActionBar><StickyButton onClick={() => nav('/os')}>Ok</StickyButton></StickyActionBar>
      </div>
    );
  }

  const required = FINALIZATION_STEPS.filter((s) => s.required);
  const doneCount = required.filter((s) => completion[s.key]).length;

  return (
    <div className={fw.screen}>
      <ScreenHeader title="Finalização" subtitle={`${order.code} · ${order.kind}`} backTo={`/os/${orderId}`} />
      <div className={fw.body}>
        <div>
          <div className={fw.progress} role="progressbar" aria-valuemin={0} aria-valuemax={required.length} aria-valuenow={doneCount}><div style={{ width: `${(doneCount / required.length) * 100}%` }} /></div>
          <p className={fw.muted} style={{ margin: '6px 0 0' }}>{doneCount} de {required.length} etapas obrigatórias concluídas</p>
        </div>
        <ul className={fw.stepList}>
          {FINALIZATION_STEPS.map((s) => {
            const hint = hintFor(s.key, draft, order);
            return (
              <li key={s.key}>
                <button className={`${fw.stepRow} ${completion[s.key] ? fw.stepRowDone : ''}`} onClick={() => nav(`/os/${orderId}/finalizar/${s.key}`)}>
                  <StepStatusIcon done={completion[s.key]} optional={!s.required} />
                  <span className={fw.stepLabel}>{s.label}{!s.required && ' (opcional)'}{hint && <small className={fw.stepHint}>{hint}</small>}</span>
                  <ChevronRight size={20} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <StickyActionBar>
        {!canFinalize && <p className={fw.muted} style={{ margin: 0, textAlign: 'center' }}>Conclua todas as etapas obrigatórias para finalizar.</p>}
        <StickyButton tone="confirm" icon={Flag} disabled={!canFinalize} onClick={() => setConfirming(true)}>Finalizar</StickyButton>
      </StickyActionBar>
      {confirming && (
        <div className={fw.sheetOverlay} onClick={() => setConfirming(false)}>
          <div className={fw.sheet} role="dialog" aria-modal="true" aria-label="Confirmar finalização" onClick={(e) => e.stopPropagation()}>
            <div className={fw.sheetHead}><h2>Finalizar {order.code}?</h2></div>
            <p style={{ margin: 0 }}>Após finalizar, a OS fica somente leitura.</p>
            {error && <p className={fw.callout} role="alert" style={{ margin: 0 }}>{error}</p>}
            <StickyButton tone="confirm" disabled={busy} onClick={finalize}>{busy ? 'Finalizando…' : 'Sim, finalizar'}</StickyButton>
            <button className={fw.btnOutline} style={{ borderStyle: 'solid' }} onClick={() => setConfirming(false)}>Voltar</button>
          </div>
        </div>
      )}
    </div>
  );
};
export default FinalizationHub;
