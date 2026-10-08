import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { NETWORK_INVENTORY, INVENTORY_CATEGORIES } from '../mockData';
import { fw, Toggle } from '../ui';
import StepScreen from './StepScreen';

const InventoryPicker = ({ takenIds, onPick, onClose }) => {
  const [q, setQ] = useState('');
  const items = NETWORK_INVENTORY.filter((i) => !takenIds.includes(i.id) && i.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className={fw.sheetOverlay} onClick={onClose}>
      <div className={fw.sheet} role="dialog" aria-modal="true" aria-label="Estoque da rede" onClick={(e) => e.stopPropagation()}>
        <div className={fw.sheetHead}><h2>Estoque da rede</h2><button className={fw.iconBtn} onClick={onClose} aria-label="Fechar"><X size={20} /></button></div>
        <input className={fw.search} type="search" placeholder="Buscar cabo, splitter, caixa…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className={fw.sheetList}>
          {items.length === 0 && <p className={fw.muted}>Nenhum item encontrado.</p>}
          {Object.entries(INVENTORY_CATEGORIES).map(([cat, label]) => {
            const group = items.filter((i) => i.category === cat);
            return group.length > 0 && (
              <React.Fragment key={cat}>
                <div className={fw.catLabel}>{label}</div>
                {group.map((i) => <button key={i.id} className={fw.optionRow} onClick={() => onPick(i)}>{i.name}<small className={fw.optionSub} style={{ marginLeft: 'auto' }}>{i.unit}</small></button>)}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* Mesmo componente para "usados" e "retirados": muda só o bucket do estado */
const MaterialsStep = ({ stepKey, bucket, flag, question }) => {
  const [picking, setPicking] = useState(false);
  return (
    <StepScreen stepKey={stepKey}>
      {({ draft, act }) => {
        const b = draft[bucket];
        const enabled = b[flag];
        return (
          <>
            <div className={fw.card}>
              <div className={fw.checkRowHead}>
                <label htmlFor={`${bucket}-flag`} className={fw.fieldLabel}>{question}</label>
                <Toggle id={`${bucket}-flag`} label={question} checked={enabled === true} onChange={(v) => act('MATERIALS_FLAG_SET', { bucket, value: v })} />
              </div>
              {enabled === null && <p className={fw.muted} style={{ margin: '8px 0 0' }}>Responda para concluir a etapa (desligado = nenhum material).</p>}
              {enabled === false && <p className={fw.muted} style={{ margin: '8px 0 0' }}>Nenhum material informado. Etapa concluída.</p>}
            </div>
            {enabled === null && <button className={fw.btnOutline} style={{ borderStyle: 'solid', borderColor: 'var(--border-color)', color: 'var(--text-medium)' }} onClick={() => act('MATERIALS_FLAG_SET', { bucket, value: false })}>Nenhum material</button>}
            {enabled && (
              <>
                <div className={fw.card}>
                  {b.lines.length === 0 && <p className={fw.muted} style={{ margin: 0 }}>Adicione ao menos um item.</p>}
                  {b.lines.map((l) => (
                    <div key={l.inventoryId} className={fw.lineItem}>
                      <div className={fw.lineHead}>{l.name}
                        <button className={fw.iconBtn} aria-label={`Remover ${l.name}`} onClick={() => act('MATERIAL_LINE_REMOVED', { bucket, inventoryId: l.inventoryId })}><Trash2 size={18} /></button>
                      </div>
                      <div className={`${fw.field} ${fw.inputUnit}`}>
                        <input type="number" inputMode="decimal" min="0" aria-label={`Quantidade de ${l.name}`} value={l.quantity} step={l.unit === 'm' ? '0.1' : '1'}
                          onChange={(e) => act('MATERIAL_LINE_CHANGED', { bucket, inventoryId: l.inventoryId, quantity: e.target.value })} />
                        <span>{l.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <button className={fw.btnOutline} onClick={() => setPicking(true)}><Plus size={20} />Adicionar produto</button>
              </>
            )}
            {picking && (
              <InventoryPicker takenIds={b.lines.map((l) => l.inventoryId)} onClose={() => setPicking(false)}
                onPick={(i) => { act('MATERIAL_LINE_ADDED', { bucket, line: { inventoryId: i.id, name: i.name, unit: i.unit, quantity: '' } }); setPicking(false); }} />
            )}
          </>
        );
      }}
    </StepScreen>
  );
};

export const RemovedMaterialsStep = () => <MaterialsStep stepKey="removed-materials" bucket="removedMaterials" flag="wereRemoved" question="Materiais foram retirados da rede?" />;
