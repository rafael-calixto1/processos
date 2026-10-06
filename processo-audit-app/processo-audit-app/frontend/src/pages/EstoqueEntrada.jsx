import React, { useState, useRef } from 'react';
import { Printer, PackagePlus, CheckCircle2, Plus } from 'lucide-react';
import { estoqueAPI, cadastrosAPI } from '../api/estoque';
import { FornecedorForm } from './EstoqueCadastros';
import { Combobox, AsyncState, useLoad, useToasts, Field, LabelSheet, fmtNum, fmtQtd, fmtDataHora, styles as s } from '../components/estoque/ui';
import { Select } from '../components/Select/Select';

const VOLUMES = { bobina: 'Bobina', caixa: 'Caixa', rolo: 'Rolo', unidade: 'Unidade' };

const EstoqueEntrada = () => {
  const itens = useLoad(() => estoqueAPI.itens());
  const forn = useLoad(() => cadastrosAPI.fornecedores());
  const hist = useLoad(() => estoqueAPI.compras());
  const [f, setF] = useState({ item_id: '', fornecedor_id: '', tipo_volume: 'bobina', qtd_volumes: 1, medida_por_volume: '', nf: '' });
  const [usaLote, setUsaLote] = useState(true); // false = só unidade/quantidade, sem etiquetas por volume
  const [novoForn, setNovoForn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState(null);
  const chave = useRef(crypto.randomUUID()); // idempotência: duplo clique não gera lotes em dobro
  const { notify, toasts } = useToasts();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const item = (itens.data || []).find((i) => String(i.id) === String(f.item_id));
  const total = (usaLote ? Number(f.qtd_volumes) || 0 : 1) * (Number(f.medida_por_volume) || 0);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const dados = usaLote ? f : { ...f, tipo_volume: 'unidade', qtd_volumes: 1 };
      const out = await estoqueAPI.criarCompra({ ...dados, chave_idempotencia: chave.current });
      setResultado({ ...out, item, semLote: !usaLote, qtd: Number(f.medida_por_volume) });
      chave.current = crypto.randomUUID();
      notify(usaLote ? `${out.lotes.length} lote(s) gerado(s)` : 'Entrada registrada'); hist.reload(); itens.reload();
    } catch (err) { notify(err.message, 'err'); } finally { setBusy(false); }
  };

  const lotes = resultado ? resultado.lotes.map((l) => ({ ...l, unidade: resultado.item?.unidade })) : [];

  return (
    <div className={s.page}>
      <div><h1 className={s.title}>Entrada / Compra</h1><p className={s.sub}>Com lotes, cada volume ganha código único e etiqueta QR; sem lotes, só a quantidade entra no estoque</p></div>
      {!resultado ? (
        <form className={`${s.card} ${s.form} ${s.cols2}`} onSubmit={submit}>
          <Field label="Item" className={s.span2}>
            <Combobox value={f.item_id} onChange={(v) => setF({ ...f, item_id: v })} required placeholder="Selecione o item…"
              options={(itens.data || []).map((i) => ({ value: i.id, label: i.nome, sub: `${i.categoria ? i.categoria + ' · ' : ''}saldo ${fmtQtd(i.saldo, i.unidade)}`, tag: i.unidade === 'metros' ? 'metros' : 'unidades' }))} />
          </Field>
          <Field label="Como registrar esta entrada?" className={s.span2}>
            <Select value={usaLote ? 'sim' : 'nao'} onChange={(e) => setUsaLote(e.target.value === 'sim')}>
              <option value="sim">Gerar lotes (bobinas, rolos, caixas — com etiqueta QR)</option>
              <option value="nao">Apenas unidades (sem lote nem etiqueta)</option>
            </Select>
          </Field>
          <Field label="Fornecedor">
            <div className={s.inline}>
              <Select style={{ flex: 1, minWidth: 0 }} value={f.fornecedor_id} onChange={set('fornecedor_id')}><option value="">—</option>{(forn.data || []).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</Select>
              <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => setNovoForn(true)} title="Cadastrar novo fornecedor" aria-label="Cadastrar novo fornecedor"><Plus size={18} /></button>
            </div>
          </Field>
          <Field label="Nota fiscal (opcional)"><input value={f.nf} onChange={set('nf')} /></Field>
          {usaLote && (<>
          <Field label="Tipo de volume"><Select value={f.tipo_volume} onChange={set('tipo_volume')}>{Object.entries(VOLUMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Nº de volumes"><input type="number" min="1" max="500" step="1" value={f.qtd_volumes} onChange={set('qtd_volumes')} required /></Field>
          </>)}
          <Field label={usaLote ? `Medida por volume (${item?.unidade === 'metros' ? 'metros' : 'peças'})` : `Quantidade (${item?.unidade === 'metros' ? 'metros' : 'peças'})`}><input type="number" min="0.01" step="0.01" value={f.medida_por_volume} onChange={set('medida_por_volume')} required /></Field>
          <div className={`${s.callout} ${s.calloutKeep} ${s.span2}`}>
            <PackagePlus size={20} aria-hidden="true" />
            {usaLote
              ? <span>Serão gerados <b>{Number(f.qtd_volumes) || 0} lote(s)</b>{total > 0 && item && <> totalizando <b>{fmtQtd(total, item.unidade)}</b></>}.</span>
              : <span>Entrarão <b>{fmtQtd(Number(f.medida_por_volume) || 0, item?.unidade || 'pecas')}</b> no estoque, sem etiqueta por volume.</span>}
          </div>
          <button className={`${s.btn} ${s.btnPrimary} ${s.span2}`} disabled={busy}>{busy ? 'Registrando…' : usaLote ? 'Registrar entrada e gerar lotes' : 'Registrar entrada'}</button>
        </form>
      ) : (
        <div className={s.card}>
          <div className={s.head}>
            <h2 className={s.cardTitle}><CheckCircle2 size={18} style={{ verticalAlign: -3, color: '#166534' }} /> {resultado.semLote ? `Entrada registrada: ${fmtQtd(resultado.qtd, resultado.item?.unidade)} de ${resultado.item?.nome}` : `${lotes.length} lote(s) gerado(s)`}</h2>
            <div className={`${s.actions} ${s.noPrint}`}>
              {!resultado.semLote && <button className={s.btn} onClick={() => window.print()}><Printer size={18} />Imprimir etiquetas</button>}
              <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => setResultado(null)}>Nova entrada</button>
            </div>
          </div>
          {!resultado.semLote && <LabelSheet lotes={lotes} itemNome={resultado.item?.nome} />}
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
      {novoForn && (
        <FornecedorForm
          inicial={{ nome: '' }}
          notify={notify}
          onClose={() => setNovoForn(false)}
          onSaved={async (r) => { setNovoForn(false); await forn.reload(); if (r?.id) setF((p) => ({ ...p, fornecedor_id: String(r.id) })); }}
        />
      )}
      {toasts}
    </div>
  );
};
export default EstoqueEntrada;
