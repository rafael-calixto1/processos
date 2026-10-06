import React, { useMemo, useState } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import { estoqueAPI, osAPI } from '../../api/estoque';
import { AsyncState, useLoad, Modal, Field, ConfirmDialog, fmtQtd, styles as s } from './ui';

/* Agrupa a posse do técnico: itens por unidade (LOTE-UNI) somam entre lotes; demais ficam por lote. */
const agrupar = (posse) => {
  const m = new Map();
  for (const p of posse || []) {
    const uni = String(p.lote_codigo).startsWith('LOTE-UNI');
    const key = uni ? `i${p.item_id}` : `l${p.lote_id}`;
    const g = m.get(key) || { key, item_nome: p.item_nome, unidade: p.unidade, lote_codigo: uni ? null : p.lote_codigo, quantidade: 0, lotes: [] };
    g.quantidade += p.quantidade; g.lotes.push(p); m.set(key, g);
  }
  return [...m.values()];
};

/* Fechar OS (ou apenas lançar materiais): o técnico marca o que usou da própria posse e informa os serviços realizados. */
export const OsFechamentoModal = ({ os, isTecnico, fechar, onClose, onDone, notify }) => {
  const posse = useLoad(() => (isTecnico ? estoqueAPI.minhaPosse() : estoqueAPI.fichaTecnico(os.tecnico_id).then((r) => r.itens)), [os.id, isTecnico]);
  const sugestoes = useLoad(() => osAPI.sugestoesServicos().catch(() => []), []);
  const grupos = useMemo(() => agrupar(posse.data), [posse.data]);
  const [qtds, setQtds] = useState({}); // key -> quantidade (presença = selecionado)
  const [novos, setNovos] = useState([]); // serviços a lançar { descricao, quantidade }
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  const linhas = grupos.filter((g) => qtds[g.key] !== undefined);
  const valida = (g) => { const q = Number(qtds[g.key]); return q > 0 && q <= Number(g.quantidade) + 1e-9; };
  const materiaisOk = linhas.every(valida);
  const jaTemServico = (os.servicos || []).length > 0;
  const alternar = (g) => setQtds((m) => { const n = { ...m }; if (n[g.key] !== undefined) delete n[g.key]; else n[g.key] = ''; return n; });

  const addServico = () => {
    const d = desc.trim();
    if (!d) return;
    setNovos((l) => [...l, { descricao: d }]);
    setDesc('');
  };

  const semNada = fechar && linhas.length === 0 && novos.length === 0 && !jaTemServico && (os.materiais || []).length === 0;

  const enviar = async () => {
    setBusy(true);
    let feitos = 0;
    try {
      for (const g of linhas) {
        let resta = Number(qtds[g.key]);
        for (const l of g.lotes) {
          if (resta <= 0) break;
          const q = Math.min(resta, l.quantidade);
          await osAPI.adicionarMaterial(os.id, { lote_id: l.lote_id, quantidade: q });
          resta = Math.round((resta - q) * 100) / 100;
        }
        feitos++;
      }
      for (const sv of novos) { await osAPI.adicionarServico(os.id, sv); feitos++; }
      if (fechar) await osAPI.fechar(os.id);
      notify(fechar ? 'OS concluída' : 'Materiais lançados na OS');
      onDone();
    } catch (e) {
      notify(`${e.message}${feitos ? ` (${feitos} lançamento(s) já registrado(s))` : ''}`, 'err');
      if (feitos) onDone(); // recarrega a OS para refletir o que já foi lançado
    } finally { setBusy(false); setConfirmar(false); }
  };

  const submit = (e) => {
    e.preventDefault();
    if (fechar) setConfirmar(true); else enviar();
  };

  return (
    <Modal title={fechar ? `Fechar OS #${os.numero}` : 'Lançar materiais usados'} onClose={onClose}>
      <form className={s.form} onSubmit={submit}>
        <Field label="Materiais usados" hint="Marque o que saiu do seu estoque nesta OS e informe a quantidade. O material é baixado e não volta ao estoque.">
          <AsyncState loading={posse.loading} error={posse.error} onRetry={posse.reload} empty={grupos.length === 0} emptyTitle="Você não tem material em posse">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
              {grupos.map((g) => {
                const ativo = qtds[g.key] !== undefined;
                return (
                  <div key={g.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 12, flexWrap: 'wrap',
                    border: ativo ? '2px solid var(--primary-color)' : '1px solid #d5ddd6', background: ativo ? 'var(--primary-light)' : '#fff' }}>
                    <input type="checkbox" checked={ativo} onChange={() => alternar(g)} style={{ width: 20, height: 20, cursor: 'pointer', flexShrink: 0 }} aria-label={`Usar ${g.item_nome}`} />
                    <span style={{ flex: 1, minWidth: 140, cursor: 'pointer' }} onClick={() => alternar(g)}>
                      <b>{g.item_nome}</b>{g.lote_codigo && <> <span className={s.mono}>{g.lote_codigo}</span></>}
                      <br /><small>em posse: {fmtQtd(g.quantidade, g.unidade)}</small>
                    </span>
                    {ativo && (
                      <input type="number" min={g.unidade === 'metros' ? '0.01' : '1'} step={g.unidade === 'metros' ? '0.01' : '1'} max={g.quantidade} autoFocus
                        value={qtds[g.key]} placeholder={g.unidade === 'metros' ? 'metros' : 'peças'} style={{ width: 110 }}
                        onChange={(e) => setQtds((m) => ({ ...m, [g.key]: e.target.value }))} />
                    )}
                  </div>
                );
              })}
            </div>
          </AsyncState>
        </Field>

        <Field label="Serviços realizados" hint="Descreva o que foi feito (ex.: instalação, troca de equipamento). Não é obrigatório lançar material.">
          {(os.servicos || []).length > 0 && (
            <ul style={{ margin: '0 0 8px', paddingLeft: 18 }}>
              {os.servicos.map((sv) => <li key={sv.id}>{sv.descricao}</li>)}
            </ul>
          )}
          {novos.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {novos.map((sv, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 6px 6px 12px', borderRadius: 999, background: 'var(--primary-light)', border: '1px solid #bfe3c8', fontWeight: 600, fontSize: '0.85rem' }}>
                  {sv.descricao}
                  <button type="button" aria-label="Remover serviço" onClick={() => setNovos((l) => l.filter((_, j) => j !== i))}
                    style={{ border: 'none', background: 'transparent', padding: 2, cursor: 'pointer', display: 'flex' }}><X size={14} /></button>
                </span>
              ))}
            </div>
          )}
          <div className={s.inline}>
            <input list="os-servicos-sugestoes" value={desc} placeholder="Ex.: Instalação de CEO" onChange={(e) => setDesc(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addServico(); } }} />
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={addServico} disabled={!desc.trim()} aria-label="Adicionar serviço"><Plus size={18} /></button>
          </div>
          <datalist id="os-servicos-sugestoes">{(sugestoes.data || []).map((d) => <option key={d} value={d} />)}</datalist>
        </Field>

        <button className={`${s.btn} ${s.btnPrimary}`} disabled={busy || !materiaisOk || (!fechar && linhas.length === 0 && novos.length === 0)}>
          {busy ? 'Salvando…' : fechar ? 'Fechar OS' : 'Lançar'}
        </button>
      </form>
      {confirmar && (
        <ConfirmDialog title="Encerrar OS" confirmLabel="Sim, encerrar OS" busy={busy} onConfirm={enviar} onCancel={() => setConfirmar(false)}>
          <p style={{ margin: 0 }}>Você tem certeza que deseja encerrar essa OS?</p>
          <p style={{ margin: '8px 0 0' }}>
            Depois de encerrada, a OS fica <b>somente leitura</b>.
            {semNada && <> Você <b>não informou materiais nem serviços</b>.</>}
          </p>
        </ConfirmDialog>
      )}
    </Modal>
  );
};

/* Lista de serviços da OS (detalhe) */
export const ServicosCard = ({ os, podeEditar, onChanged, notify }) => {
  const [busy, setBusy] = useState(null);
  const remover = async (sv) => {
    setBusy(sv.id);
    try { await osAPI.removerServico(os.id, sv.id); onChanged(); }
    catch (e) { notify(e.message, 'err'); } finally { setBusy(null); }
  };
  return (
    <div className={s.card}>
      <h2 className={s.cardTitle}>Serviços realizados</h2>
      <AsyncState empty={(os.servicos || []).length === 0} emptyTitle="Nenhum serviço lançado ainda">
        <div className={s.tableWrap}><table className={s.table}>
          <thead><tr><th>Serviço</th><th>Lançado por</th><th>Quando</th>{podeEditar && <th />}</tr></thead>
          <tbody>{os.servicos.map((sv) => (
            <tr key={sv.id}>
              <td data-label="Serviço">{sv.descricao}</td>
              <td data-label="Por">{sv.usuario_nome || '—'}</td><td data-label="Quando">{new Date(sv.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
              {podeEditar && <td><button className={`${s.btn} ${s.btnSm}`} disabled={busy === sv.id} onClick={() => remover(sv)} aria-label="Remover serviço"><Trash2 size={16} /></button></td>}
            </tr>))}</tbody></table></div>
      </AsyncState>
    </div>
  );
};
