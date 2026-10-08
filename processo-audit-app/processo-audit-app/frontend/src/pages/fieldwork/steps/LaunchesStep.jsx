import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, X, Layers, Map as MapIcon } from 'lucide-react';
import RouteMap, { fmtMeters } from '../../../components/RouteMap';
import { estoqueAPI, osAPI } from '../../../api/estoque';
import { agrupar } from '../../../components/estoque/OsFechamento';
import { fmtQtd, useLoad } from '../../../components/estoque/ui';
import { useServiceOrder, useOrderDetail } from '../state';
import { fw, Toggle, StickyButton } from '../ui';
import StepScreen from './StepScreen';

/* Sheet: uma linha de serviço no trecho + os materiais (da posse do técnico) usados nela */
const LaunchSheet = ({ orderId, center, onClose, onSaved }) => {
  const posse = useLoad(() => estoqueAPI.minhaPosse(), []);
  const suggestions = useLoad(() => osAPI.sugestoesServicos().catch(() => []), []);
  const groups = useMemo(() => agrupar(posse.data), [posse.data]);
  const [service, setService] = useState('');
  const [segment, setSegment] = useState('');
  const [route, setRoute] = useState(null); // { pontos, metros, caminho } marcado no mapa
  const [mapOpen, setMapOpen] = useState(false);
  const [qtds, setQtds] = useState({}); // groupKey -> quantidade (presença = selecionado)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const selected = groups.filter((g) => qtds[g.key] !== undefined);
  const validQty = (g) => { const q = Number(qtds[g.key]); return q > 0 && q <= Number(g.quantidade) + 1e-9; };
  const canSave = service.trim() && segment.trim() && selected.length > 0 && selected.every(validQty);
  const toggle = (g) => setQtds((m) => { const n = { ...m }; if (n[g.key] !== undefined) delete n[g.key]; else n[g.key] = ''; return n; });

  const save = async () => {
    setBusy(true); setError('');
    // Distribui a quantidade entre os lotes que o técnico tem do mesmo item
    const materiais = [];
    for (const g of selected) {
      let resta = Number(qtds[g.key]);
      for (const l of g.lotes) {
        if (resta <= 0) break;
        const q = Math.min(resta, l.quantidade);
        materiais.push({ lote_id: l.lote_id, quantidade: q });
        resta = Math.round((resta - q) * 100) / 100;
      }
    }
    try { await osAPI.lancar(orderId, { descricao: service.trim(), trecho: segment.trim(), rota: route?.caminho ? route : undefined, materiais }); onSaved(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className={fw.sheetOverlay} onClick={onClose}>
      <div className={fw.sheet} role="dialog" aria-modal="true" aria-label="Novo lançamento" style={{ maxHeight: '92vh' }} onClick={(e) => e.stopPropagation()}>
        <div className={fw.sheetHead}><h2>Novo lançamento</h2><button className={fw.iconBtn} onClick={onClose} aria-label="Fechar"><X size={20} /></button></div>
        <div className={fw.sheetList} style={{ gap: 14 }}>
          <div className={fw.field}>
            <label htmlFor="lc-service">Serviço realizado</label>
            <input id="lc-service" type="text" list="lc-suggestions" value={service} placeholder="Ex.: Lançamento de cabo ASU" onChange={(e) => setService(e.target.value)} />
            <datalist id="lc-suggestions">{(suggestions.data || []).map((d) => <option key={d} value={d} />)}</datalist>
          </div>
          <div className={fw.field}>
            <label htmlFor="lc-segment">Trecho</label>
            <input id="lc-segment" type="text" value={segment} placeholder="Ex.: PL-0932 → PL-0945" onChange={(e) => setSegment(e.target.value)} />
            <button type="button" className={fw.btnOutline} style={{ marginTop: 8 }} onClick={() => setMapOpen(true)}>
              <MapIcon size={20} />{route?.caminho ? `Rota no mapa · ≈ ${fmtMeters(route.metros)}` : 'Marcar rota no mapa'}
            </button>
          </div>
          <div>
            <span className={fw.fieldLabel}>Materiais usados neste trecho</span>
            <p className={fw.muted} style={{ margin: '2px 0 8px' }}>Do seu estoque. O material é baixado e não volta ao estoque.</p>
            {posse.loading && <p className={fw.muted}>Carregando seu estoque…</p>}
            {posse.error && <p className={fw.callout} role="alert">{posse.error}</p>}
            {!posse.loading && !posse.error && groups.length === 0 && <p className={fw.muted}>Você não tem material em posse.</p>}
            <div className={fw.optionList}>
              {groups.map((g) => {
                const on = qtds[g.key] !== undefined;
                return (
                  <div key={g.key}>
                    <button type="button" role="checkbox" aria-checked={on} className={`${fw.optionRow} ${on ? fw.optionOn : ''}`} onClick={() => toggle(g)}>
                      <span className={`${fw.mark} ${fw.checkMark}`}>{on && '✓'}</span>
                      <span>{g.item_nome}{g.lote_codigo && ` · ${g.lote_codigo}`}<small className={fw.optionSub}>em posse: {fmtQtd(g.quantidade, g.unidade)}</small></span>
                    </button>
                    {on && (
                      <div className={`${fw.field} ${fw.inputUnit}`} style={{ marginTop: 6 }}>
                        <input type="number" inputMode="decimal" min="0" max={g.quantidade} step={g.unidade === 'metros' ? '0.01' : '1'} autoFocus aria-label={`Quantidade de ${g.item_nome}`}
                          value={qtds[g.key]} placeholder="Quantidade" onChange={(e) => setQtds((m) => ({ ...m, [g.key]: e.target.value }))} />
                        <span>{g.unidade === 'metros' ? 'm' : 'un'}</span>
                      </div>
                    )}
                    {on && qtds[g.key] !== '' && !validQty(g) && (
                      <p className={fw.callout} role="alert" style={{ margin: '6px 0 0' }}>Informe uma quantidade entre 0 e {fmtQtd(g.quantidade, g.unidade)} (o que você tem em posse).</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {error && <p className={fw.callout} role="alert" style={{ margin: 0 }}>{error}</p>}
        </div>
        <StickyButton tone="confirm" disabled={!canSave || busy} onClick={save}>{busy ? 'Salvando…' : 'Salvar lançamento'}</StickyButton>
      </div>
      {mapOpen && (
        <div className={fw.sheetOverlay} onClick={(e) => e.stopPropagation()}>
          <div className={fw.sheet} role="dialog" aria-modal="true" aria-label="Rota no mapa" style={{ maxHeight: '96vh' }} onClick={(e) => e.stopPropagation()}>
            <div className={fw.sheetHead}><h2>Rota no mapa</h2><button className={fw.iconBtn} onClick={() => setMapOpen(false)} aria-label="Fechar"><X size={20} /></button></div>
            <div className={fw.sheetList}><RouteMap value={route} onChange={setRoute} center={center} /></div>
            <StickyButton tone="confirm" disabled={!route?.caminho} onClick={() => {
              if (!segment.trim()) setSegment(`${route.pontos[0].lat}, ${route.pontos[0].lng} → ${route.pontos[route.pontos.length - 1].lat}, ${route.pontos[route.pontos.length - 1].lng}`);
              setMapOpen(false);
            }}>Usar esta rota</StickyButton>
          </div>
        </div>
      )}
    </div>
  );
};

const LaunchesStep = () => {
  const { orderId } = useParams();
  const reloadDetail = useOrderDetail(orderId);
  const { order, draft, act } = useServiceOrder(orderId);
  const [adding, setAdding] = useState(false);
  const launches = order?.launches || [];
  const wereUsed = launches.length > 0 ? true : draft?.usedMaterials.wereUsed;
  return (
    <StepScreen stepKey="used-materials"
      action={wereUsed ? <StickyButton tone="start" icon={Plus} onClick={() => setAdding(true)}>Adicionar lançamento</StickyButton> : null}>
      <div className={fw.card}>
        <div className={fw.checkRowHead}>
          <label htmlFor="used-flag" className={fw.fieldLabel}>Materiais foram utilizados?</label>
          <Toggle id="used-flag" label="Materiais foram utilizados" checked={wereUsed === true} onChange={(v) => !launches.length && act('MATERIALS_FLAG_SET', { bucket: 'usedMaterials', value: v })} />
        </div>
        {wereUsed === null && <p className={fw.muted} style={{ margin: '8px 0 0' }}>Ligue para lançar o serviço e os materiais de cada trecho. Desligado = nenhum material.</p>}
        {wereUsed === false && <p className={fw.muted} style={{ margin: '8px 0 0' }}>Nenhum material usado. Etapa concluída.</p>}
        {launches.length > 0 && <p className={fw.muted} style={{ margin: '8px 0 0' }}>Lançamentos já gravados não podem ser desligados.</p>}
      </div>
      {wereUsed === true && launches.length === 0 && <div className={`${fw.card} ${fw.emptyState}`}><Layers size={36} /><b>Nenhum lançamento ainda</b><span>Cada lançamento é um serviço em um trecho, com os materiais usados nele.</span></div>}
      {launches.map((l) => (
        <div key={l.id} className={fw.card}>
          <div className={fw.lineHead}>{l.description}</div>
          {l.segment && <span className={fw.muted}>Trecho: <b>{l.segment}</b></span>}
          {l.route && <div style={{ marginTop: 8 }}><RouteMap value={l.route} readOnly height={180} /></div>}
          <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>
            {l.materials.map((m) => <li key={m.id}>{m.name} — <b>{fmtQtd(m.quantity, m.unit)}</b> <span className={`${fw.mono} ${fw.muted}`}>{m.lot}</span></li>)}
          </ul>
        </div>
      ))}
      {adding && <LaunchSheet orderId={orderId} center={draft?.interventionLocation || (order?.pole?.lat != null ? order.pole : null)} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reloadDetail(); }} />}
    </StepScreen>
  );
};
export default LaunchesStep;
