import React, { useState, useRef } from 'react';
import { Printer, PackagePlus, CheckCircle2 } from 'lucide-react';
import { estoqueAPI, cadastrosAPI } from '../api/estoque';
import { AsyncState, useLoad, useToasts, Field, LabelSheet, fmtNum, fmtQtd, fmtDataHora, styles as s } from '../components/estoque/ui';

const VOLUMES = { bobina: 'Bobina', caixa: 'Caixa', rolo: 'Rolo', unidade: 'Unidade' };

const EstoqueEntrada = () => {
  const itens = useLoad(() => estoqueAPI.itens());
  const forn = useLoad(() => cadastrosAPI.fornecedores());
  const hist = useLoad(() => estoqueAPI.compras());
  const [f, setF] = useState({ item_id: '', fornecedor_id: '', tipo_volume: 'bobina', qtd_volumes: 1, medida_por_volume: '', nf: '' });
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState(null);
  const chave = useRef(crypto.randomUUID()); // idempotência: duplo clique não gera lotes em dobro
  const { notify, toasts } = useToasts();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const item = (itens.data || []).find((i) => String(i.id) === String(f.item_id));
  const total = (Number(f.qtd_volumes) || 0) * (Number(f.medida_por_volume) || 0);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const out = await estoqueAPI.criarCompra({ ...f, chave_idempotencia: chave.current });
      setResultado({ ...out, item });
      chave.current = crypto.randomUUID();
      notify(`${out.lotes.length} lote(s) gerado(s)`); hist.reload(); itens.reload();
    } catch (err) { notify(err.message, 'err'); } finally { setBusy(false); }
  };

  const lotes = resultado ? resultado.lotes.map((l) => ({ ...l, unidade: resultado.item?.unidade })) : [];

  return (
    <div className={s.page}>
      <div><h1 className={s.title}>Entrada / Compra</h1><p className={s.sub}>Cada volume vira um lote com código único e etiqueta QR</p></div>
      {!resultado ? (
        <form className={`${s.card} ${s.form} ${s.cols2}`} onSubmit={submit}>
          <Field label="Item" className={s.span2}>
            <select value={f.item_id} onChange={set('item_id')} required>
              <option value="">Selecione…</option>{(itens.data || []).map((i) => <option key={i.id} value={i.id}>{i.nome} ({i.unidade === 'metros' ? 'm' : 'un'})</option>)}
            </select>
          </Field>
          <Field label="Fornecedor"><select value={f.fornecedor_id} onChange={set('fornecedor_id')}><option value="">—</option>{(forn.data || []).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></Field>
          <Field label="Nota fiscal (opcional)"><input value={f.nf} onChange={set('nf')} /></Field>
          <Field label="Tipo de volume"><select value={f.tipo_volume} onChange={set('tipo_volume')}>{Object.entries(VOLUMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Nº de volumes"><input type="number" min="1" max="500" step="1" value={f.qtd_volumes} onChange={set('qtd_volumes')} required /></Field>
          <Field label={`Medida por volume (${item?.unidade === 'metros' ? 'metros' : 'peças'})`}><input type="number" min="0.01" step="0.01" value={f.medida_por_volume} onChange={set('medida_por_volume')} required /></Field>
          <div className={`${s.callout} ${s.calloutKeep} ${s.span2}`}>
            <PackagePlus size={20} aria-hidden="true" />
            <span>Serão gerados <b>{Number(f.qtd_volumes) || 0} lote(s)</b>{total > 0 && item && <> totalizando <b>{fmtQtd(total, item.unidade)}</b></>}.</span>
          </div>
          <button className={`${s.btn} ${s.btnPrimary} ${s.span2}`} disabled={busy}>{busy ? 'Registrando…' : 'Registrar entrada e gerar lotes'}</button>
        </form>
      ) : (
        <div className={s.card}>
          <div className={s.head}>
            <h2 className={s.cardTitle}><CheckCircle2 size={18} style={{ verticalAlign: -3, color: '#166534' }} /> {lotes.length} lote(s) gerado(s)</h2>
            <div className={`${s.actions} ${s.noPrint}`}>
              <button className={s.btn} onClick={() => window.print()}><Printer size={18} />Imprimir etiquetas</button>
              <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => setResultado(null)}>Nova entrada</button>
            </div>
          </div>
          <LabelSheet lotes={lotes} itemNome={resultado.item?.nome} />
        </div>
      )}
      <div className={`${s.card} ${s.noPrint}`}>
        <h2 className={s.cardTitle}>Entradas recentes</h2>
        <AsyncState loading={hist.loading} error={hist.error} onRetry={hist.reload} empty={(hist.data || []).length === 0} emptyTitle="Nenhuma entrada registrada">
          <div className={s.tableWrap}><table className={s.table}>
            <thead><tr><th>Data</th><th>Item</th><th>Volumes</th><th>Fornecedor</th><th>NF</th><th>Por</th></tr></thead>
            <tbody>{(hist.data || []).map((c) => (
              <tr key={c.id}><td data-label="Data">{fmtDataHora(c.criado_em)}</td><td data-label="Item">{c.item_nome}</td>
                <td data-label="Volumes">{c.qtd_volumes} × {fmtNum(c.medida_por_volume)} ({VOLUMES[c.tipo_volume]})</td>
                <td data-label="Fornecedor">{c.fornecedor_nome || '—'}</td><td data-label="NF">{c.nf || '—'}</td><td data-label="Por">{c.usuario_nome}</td></tr>))}</tbody></table></div>
        </AsyncState>
      </div>
      {toasts}
    </div>
  );
};
export default EstoqueEntrada;
