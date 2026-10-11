import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { fw, Toggle } from '../ui';
import { ehLinhaLivre, unidadeCurta } from '../finalizacao';
import StepScreen, { CatalogGate } from './StepScreen';

const CONDICOES = [['novo', 'Novo'], ['usado', 'Usado']];

/* Itens reais do estoque (catálogo do servidor), agrupados pela categoria; ou "outro material" digitado à mão */
const InventoryPicker = ({ itens, takenIds, onPick, onPickFree, onClose }) => {
  const [q, setQ] = useState('');
  const visiveis = itens.filter((i) => !takenIds.includes(i.id) && i.nome.toLowerCase().includes(q.toLowerCase()));
  const categorias = [...new Set(visiveis.map((i) => i.categoria || 'Outros'))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return (
    <div className={fw.sheetOverlay} onClick={onClose}>
      <div className={fw.sheet} role="dialog" aria-modal="true" aria-label="Estoque da rede" onClick={(e) => e.stopPropagation()}>
        <div className={fw.sheetHead}><h2>Estoque da rede</h2><button className={fw.iconBtn} onClick={onClose} aria-label="Fechar"><X size={20} /></button></div>
        <input className={fw.search} type="search" placeholder="Buscar cabo, splitter, caixa…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className={fw.sheetList}>
          {visiveis.length === 0 && <p className={fw.muted}>Nenhum item encontrado. Use "Outro material" abaixo.</p>}
          {categorias.map((cat) => (
            <React.Fragment key={cat}>
              <div className={fw.catLabel}>{cat}</div>
              {visiveis.filter((i) => (i.categoria || 'Outros') === cat).map((i) => (
                <button key={i.id} className={fw.optionRow} onClick={() => onPick(i)}>{i.nome}<small className={fw.optionSub} style={{ marginLeft: 'auto' }}>{unidadeCurta(i.unidade)}</small></button>
              ))}
            </React.Fragment>
          ))}
          <button className={fw.btnOutline} onClick={onPickFree}><Plus size={20} />Outro material (descrever)</button>
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
        const change = (inventoryId, patch) => act('MATERIAL_LINE_CHANGED', { bucket, inventoryId, patch });
        return (
          <CatalogGate>
            {(catalogs) => (
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
                      {b.lines.map((l) => {
                        const livre = ehLinhaLivre(l);
                        return (
                          <div key={l.inventoryId} className={fw.lineItem}>
                            <div className={fw.lineHead}>{livre ? 'Outro material' : l.name}
                              <button className={fw.iconBtn} aria-label={`Remover ${l.name || 'material'}`} onClick={() => act('MATERIAL_LINE_REMOVED', { bucket, inventoryId: l.inventoryId })}><Trash2 size={18} /></button>
                            </div>
                            {livre && (
                              <div className={fw.field}>
                                <input type="text" aria-label="Descrição do outro material" placeholder="Ex.: Splitter 1:8 antigo" value={l.name} maxLength={255} onChange={(e) => change(l.inventoryId, { name: e.target.value })} />
                              </div>
                            )}
                            <div className={`${fw.field} ${fw.inputUnit}`}>
                              <input type="number" inputMode="decimal" min="0" aria-label={`Quantidade de ${l.name || 'outro material'}`} value={l.quantity} step={l.unit === 'metros' ? '0.1' : '1'}
                                onChange={(e) => change(l.inventoryId, { quantity: e.target.value })} />
                              {livre
                                ? <select aria-label="Unidade do outro material" value={l.unit} onChange={(e) => change(l.inventoryId, { unit: e.target.value })}><option value="pecas">un</option><option value="metros">m</option></select>
                                : <span>{unidadeCurta(l.unit)}</span>}
                            </div>
                            {bucket === 'removedMaterials' && (
                              <div role="radiogroup" aria-label={`Condição de ${l.name || 'outro material'}`} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                {CONDICOES.map(([valor, rotulo]) => (
                                  <button key={valor} role="radio" aria-checked={l.condition === valor} className={`${fw.optionRow} ${l.condition === valor ? fw.optionOn : ''}`} style={{ flex: 1, justifyContent: 'center' }}
                                    onClick={() => change(l.inventoryId, { condition: valor })}>{rotulo}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {bucket === 'removedMaterials' && b.lines.some((l) => !l.condition) && <p className={fw.muted} style={{ margin: '8px 0 0' }}>Informe se cada material está novo ou usado.</p>}
                    </div>
                    <button className={fw.btnOutline} onClick={() => setPicking(true)}><Plus size={20} />Adicionar produto</button>
                  </>
                )}
                {picking && (
                  <InventoryPicker itens={catalogs.itens} takenIds={b.lines.map((l) => l.inventoryId)} onClose={() => setPicking(false)}
                    onPick={(i) => { act('MATERIAL_LINE_ADDED', { bucket, line: { inventoryId: i.id, name: i.nome, unit: i.unidade, quantity: '', condition: null } }); setPicking(false); }}
                    onPickFree={() => { act('MATERIAL_LINE_ADDED', { bucket, line: { inventoryId: `livre-${crypto.randomUUID()}`, name: '', unit: 'pecas', quantity: '', condition: null } }); setPicking(false); }} />
                )}
              </>
            )}
          </CatalogGate>
        );
      }}
    </StepScreen>
  );
};

export const RemovedMaterialsStep = () => <MaterialsStep stepKey="removed-materials" bucket="removedMaterials" flag="wereRemoved" question="Materiais foram retirados da rede?" />;
