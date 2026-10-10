import React, { useState } from 'react';
import { estoqueAPI, cadastrosAPI } from '../api/estoque';
import { useAuth } from '../context/AuthContext';
import { Combobox, AsyncState, useLoad, useToasts, Field, ConfirmDialog, fmtQtd, fmtDataHora, styles as s } from '../components/estoque/ui';
import { Select } from '../components/Select/Select';
import { agrupar, resumo, ModalGrupo, PosseDetalhada } from './EstoquePosse';

const EstoqueDevolucao = () => {
  const { user } = useAuth();
  const isTecnico = user?.role === 'tecnico';
  const tecs = useLoad(() => (isTecnico ? Promise.resolve([]) : cadastrosAPI.tecnicos()), [isTecnico]);
  const [tecnicoId, setTecnicoId] = useState('');
  const ficha = useLoad(() => (isTecnico ? estoqueAPI.minhaFicha() : tecnicoId ? estoqueAPI.fichaTecnico(tecnicoId) : Promise.resolve(null)), [isTecnico, tecnicoId]);
  const posse = { loading: ficha.loading, error: ficha.error, reload: ficha.reload, data: ficha.data ? ficha.data.itens : [] };
  const { validas, grupos: movs } = React.useMemo(() => (ficha.data ? agrupar(ficha.data.historico) : { validas: [], grupos: [] }), [ficha.data]);
  const devolvidas = movs.filter((g) => g.tipo === 'devolucao');
  const [modal, setModal] = useState(null);
  const [limite, setLimite] = useState(12);
  const solic = useLoad(() => (isTecnico ? estoqueAPI.devolucoes() : Promise.resolve([])), [isTecnico]);
  const [qtds, setQtds] = useState({}); // lote_id -> quantidade digitada (presença = selecionado)
  const [condicao, setCondicao] = useState('novo');
  const [confirmar, setConfirmar] = useState(false);
  const [busy, setBusy] = useState(false);
  const { notify, toasts } = useToasts();
  // Itens por unidade (LOTE-UNI) não mostram lote: agrupa por item e a devolução é distribuída entre os lotes.
  const grupos = React.useMemo(() => {
    const m = new Map();
    const pend = {};
    for (const d of solic.data || []) if (d.status === 'pendente') pend[d.lote_id] = (pend[d.lote_id] || 0) + d.quantidade;
    for (const raw of posse.data || []) {
      const livre = Math.round((raw.quantidade - (pend[raw.lote_id] || 0)) * 100) / 100;
      if (livre <= 0) continue;
      const p = { ...raw, quantidade: livre };
      const uni = String(p.lote_codigo).startsWith('LOTE-UNI');
      const key = uni ? `i${p.item_id}` : `l${p.lote_id}`;
      const g = m.get(key) || { key, item_nome: p.item_nome, unidade: p.unidade, lote_codigo: uni ? null : p.lote_codigo, quantidade: 0, lotes: [] };
      g.quantidade += p.quantidade; g.lotes.push(p); m.set(key, g);
    }
    return [...m.values()];
  }, [posse.data, solic.data]);
  const linhas = grupos.filter((p) => qtds[p.key] !== undefined);
  const valida = (p) => { const q = Number(qtds[p.key]); return q > 0 && q <= Number(p.quantidade); };
  const podeRevisar = linhas.length > 0 && linhas.every(valida);
  const alternar = (p) => setQtds((m) => { const n = { ...m }; if (n[p.key] !== undefined) delete n[p.key]; else n[p.key] = ''; return n; });

  const enviar = async () => {
    setBusy(true);
    let ok = 0;
    try {
      for (const p of linhas) {
        let resta = Number(qtds[p.key]);
        for (const l of p.lotes) {
          if (resta <= 0) break;
          const q = Math.min(resta, l.quantidade);
          await estoqueAPI.devolver({ lote_id: l.lote_id, tecnico_id: isTecnico ? undefined : Number(tecnicoId), quantidade: q, condicao });
          resta = Math.round((resta - q) * 100) / 100;
        }
        ok++;
        setQtds((m) => { const n = { ...m }; delete n[p.key]; return n; });
      }
      notify(isTecnico
        ? `Devolução enviada para aprovação (${ok} ${ok === 1 ? 'item' : 'itens'})`
        : `Devolução registrada (${ok} ${ok === 1 ? 'item' : 'itens'}): material voltou ao almoxarifado`);
    } catch (e) { notify(`${e.message}${ok ? ` (${ok} já devolvido(s))` : ''}`, 'err'); } finally { setConfirmar(false); setBusy(false); ficha.reload(); solic.reload(); }
  };

  return (
    <div className={s.page}>
      <div><h1 className={s.title}>Devolução</h1><p className={s.sub}>{isTecnico ? 'Sua devolução é enviada para aprovação do almoxarifado' : 'O material sai da posse do técnico e volta ao almoxarifado'}</p></div>
      <form className={`${s.card} ${s.form}`} onSubmit={(e) => { e.preventDefault(); setConfirmar(true); }}>
        {!isTecnico && (
          <Field label="Técnico / equipe">
            <Combobox avatar value={tecnicoId} onChange={(v) => { setTecnicoId(v); setQtds({}); }} required placeholder="Selecione o técnico ou equipe…"
              options={(tecs.data || []).filter((t) => t.ativo).map((t) => ({ value: t.id, label: t.nome, sub: t.empresa || (t.tipo === 'terceirizado' ? 'Equipe terceirizada' : 'Técnico interno'), tag: t.tipo === 'terceirizado' ? 'Terceirizada' : undefined }))} />
          </Field>
        )}
        <AsyncState loading={posse.loading && (isTecnico || !!tecnicoId)} error={posse.error} onRetry={posse.reload}
          empty={(isTecnico || tecnicoId) && (posse.data || []).length === 0} emptyTitle="Nada em posse para devolver">
          {(isTecnico || tecnicoId) && (
            <Field label="Itens em posse">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto' }}>
                {grupos.map((p) => {
                  const ativo = qtds[p.key] !== undefined;
                  return (
                    <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 10,
                      border: ativo ? '2px solid #1f7a3a' : '1px solid #d5ddd6', background: ativo ? '#e6f4ea' : '#fff' }}>
                      <input type="checkbox" checked={ativo} onChange={() => alternar(p)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                      <span style={{ flex: 1, cursor: 'pointer' }} onClick={() => alternar(p)}><b>{p.item_nome}</b>{p.lote_codigo && <> <span className={s.mono}>{p.lote_codigo}</span></>}</span>
                      <span>em posse: <b>{fmtQtd(p.quantidade, p.unidade)}</b></span>
                      {ativo && (
                        <input type="number" min={p.unidade === 'metros' ? '0.01' : '1'} step={p.unidade === 'metros' ? '0.01' : '1'} max={p.quantidade} autoFocus value={qtds[p.key]}
                          placeholder={p.unidade === 'metros' ? 'metros' : 'peças'} style={{ width: 110 }}
                          onChange={(e) => setQtds((m) => ({ ...m, [p.key]: e.target.value }))} />
                      )}
                    </div>
                  );
                })}
              </div>
            </Field>
          )}
        </AsyncState>
        <Field label="Condição do material devolvido">
          <Select value={condicao} onChange={(e) => setCondicao(e.target.value)}><option value="novo">Novo</option><option value="usado">Usado</option></Select>
        </Field>
        <button className={`${s.btn} ${s.btnPrimary}`} disabled={!podeRevisar}>{isTecnico ? 'Enviar para aprovação' : 'Revisar devolução'}</button>
      </form>
      {(isTecnico || tecnicoId) && ficha.data && (<>
        <div className={s.card}><h2 className={s.cardTitle}>Detalhe da posse</h2>
          <p className={s.sub}>Clique em um item para ver quando foi entregue e em quais OS foi gasto.</p>
          <PosseDetalhada itens={ficha.data.itens} validas={validas} /></div>
        <div className={s.card}><h2 className={s.cardTitle}>Devoluções realizadas</h2>
          <AsyncState empty={devolvidas.length === 0} emptyTitle="Nenhuma devolução registrada">
            <div className={s.tableWrap}><table className={s.table}><thead><tr><th>Quando</th><th>Resumo</th><th>Condição</th><th></th></tr></thead>
              <tbody>{devolvidas.slice(0, limite).map((g) => (<tr key={g.key} className={s.clickRow} onClick={() => setModal(g)}>
                <td data-label="Quando">{fmtDataHora(g.quando)}</td><td data-label="Resumo">{resumo(g)}</td>
                <td data-label="Condição">{[...new Set(g.itens.map((i) => i.condicao).filter(Boolean))].join(', ') || '—'}</td>
                <td><button type="button" className={s.chip} onClick={(e) => { e.stopPropagation(); setModal(g); }}>Detalhes</button></td></tr>))}</tbody></table></div>
            {devolvidas.length > limite && <button type="button" className={s.chip} style={{ marginTop: 10 }} onClick={() => setLimite(limite + 12)}>Ver mais ({devolvidas.length - limite})</button>}
          </AsyncState></div>
        {modal && <ModalGrupo g={modal} onClose={() => setModal(null)} />}
      </>)}
      {isTecnico && (solic.data || []).length > 0 && (
        <div className={s.card}>
          <h2 className={s.cardTitle}>Minhas solicitações</h2>
          <div className={s.tableWrap}><table className={s.table}>
            <thead><tr><th>Quando</th><th>Item</th><th>Lote</th><th>Qtd</th><th>Situação</th></tr></thead>
            <tbody>{solic.data.map((d) => (
              <tr key={d.id}>
                <td data-label="Quando">{fmtDataHora(d.solicitado_em)}</td>
                <td data-label="Item">{d.item_nome}</td>
                <td data-label="Lote" className={s.mono}>{d.lote_codigo}</td>
                <td data-label="Qtd">{fmtQtd(d.quantidade, d.unidade)}</td>
                <td data-label="Situação">
                  {d.status === 'pendente' && <span style={{ color: '#b45309', fontWeight: 700 }}>Aguardando aprovação</span>}
                  {d.status === 'aprovada' && <span style={{ color: '#166534', fontWeight: 700 }}>Aprovada</span>}
                  {d.status === 'negada' && <span style={{ color: '#991b1b', fontWeight: 700 }}>Negada{d.motivo_negacao ? ` — ${d.motivo_negacao}` : ''}</span>}
                </td>
              </tr>))}</tbody></table></div>
        </div>
      )}
      {confirmar && linhas.length > 0 && (
        <ConfirmDialog title="Confirmar devolução" busy={busy} onConfirm={enviar} onCancel={() => setConfirmar(false)}>
          <p style={{ margin: '0 0 8px' }}>{isTecnico ? 'Solicitar devolução' : 'Devolver'} como <b>{condicao}</b>:</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {linhas.map((p) => <li key={p.key}><b>{fmtQtd(qtds[p.key], p.unidade)}</b> — {p.item_nome}{p.lote_codigo && <> <b className={s.mono}>{p.lote_codigo}</b></>}</li>)}
          </ul>
        </ConfirmDialog>
      )}
      {toasts}
    </div>
  );
};
export default EstoqueDevolucao;
