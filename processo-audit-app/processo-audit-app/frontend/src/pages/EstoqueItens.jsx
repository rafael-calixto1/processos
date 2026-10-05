import React, { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Package } from 'lucide-react';
import { estoqueAPI } from '../api/estoque';
import { useAuth } from '../context/AuthContext';
import { AsyncState, useLoad, useToasts, Modal, Field, StatusBadge, fmtQtd, fmtNum, fmtDataHora, styles as s } from '../components/estoque/ui';

const TIPOS = { entrada: 'Entrada', retirada: 'Retirada', devolucao: 'Devolução', baixa_os: 'Baixa em OS', estorno: 'Estorno', ajuste: 'Ajuste' };
const VAZIO = { nome: '', categoria: '', unidade: 'pecas', estoque_minimo: 0 };

const ItemForm = ({ inicial, onSaved, onClose, notify }) => {
  const [f, setF] = useState(inicial);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      if (f.id) await estoqueAPI.atualizarItem(f.id, f); else await estoqueAPI.criarItem(f);
      notify('Item salvo'); onSaved();
    } catch (err) { notify(err.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal title={f.id ? 'Editar item' : 'Novo item'} onClose={onClose}>
      <form className={s.form} onSubmit={submit}>
        <Field label="Nome"><input value={f.nome} onChange={set('nome')} required /></Field>
        <Field label="Categoria"><input value={f.categoria || ''} onChange={set('categoria')} placeholder="Cabos, Conectores…" /></Field>
        <Field label="Unidade de medida" hint="Metros (cabos) ou peças. Não pode ser trocada depois que o item tem lotes.">
          <select value={f.unidade} onChange={set('unidade')}><option value="pecas">Peças / unidades</option><option value="metros">Metros</option></select>
        </Field>
        <Field label={`Estoque mínimo (${f.unidade === 'metros' ? 'm' : 'un'})`}><input type="number" min="0" step="0.01" value={f.estoque_minimo} onChange={set('estoque_minimo')} /></Field>
        <button className={`${s.btn} ${s.btnPrimary}`} disabled={busy}>Salvar</button>
      </form>
    </Modal>
  );
};

const ItemDetalhe = ({ id, onClose }) => {
  const { loading, error, data, reload } = useLoad(() => estoqueAPI.item(id), [id]);
  return (
    <Modal title={data?.nome || 'Item'} onClose={onClose}>
      <AsyncState loading={loading} error={error} onRetry={reload}>
        {data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <dl className={s.detailGrid}>
              <div><dt>Saldo total</dt><dd><b>{fmtQtd(data.saldo, data.unidade)}</b></dd></div>
              <div><dt>Mínimo</dt><dd>{fmtQtd(data.estoque_minimo, data.unidade)}</dd></div>
              <div><dt>Status</dt><dd><StatusBadge status={data.status} /></dd></div>
            </dl>
            <h3 className={s.cardTitle}>Lotes</h3>
            <div className={s.tableWrap}><table className={s.table}>
              <thead><tr><th>Lote</th><th>Saldo</th><th>Com técnicos</th><th>Almoxarifado</th></tr></thead>
              <tbody>{data.lotes.map((l) => (
                <tr key={l.id}><td data-label="Lote" className={s.mono}>{l.codigo}</td><td data-label="Saldo">{fmtQtd(l.saldo_atual, data.unidade)}</td>
                  <td data-label="Com técnicos">{fmtQtd(l.em_posse, data.unidade)}</td><td data-label="Almoxarifado">{fmtQtd(l.no_almoxarifado, data.unidade)}</td></tr>
              ))}</tbody></table></div>
            <h3 className={s.cardTitle}>Histórico de movimentações</h3>
            <div className={s.tableWrap}><table className={s.table}>
              <thead><tr><th>Quando</th><th>Tipo</th><th>Lote</th><th>Qtd</th><th>Técnico / OS</th><th>Por</th></tr></thead>
              <tbody>{data.movimentacoes.map((m) => (
                <tr key={m.id}><td data-label="Quando">{fmtDataHora(m.criado_em)}</td><td data-label="Tipo">{TIPOS[m.tipo]}{m.condicao ? ` (${m.condicao})` : ''}</td>
                  <td data-label="Lote" className={s.mono}>{m.lote_codigo}</td><td data-label="Qtd">{fmtQtd(m.quantidade, data.unidade)}</td>
                  <td data-label="Técnico / OS">{[m.tecnico_nome, m.os_numero && `OS ${m.os_numero}`].filter(Boolean).join(' · ') || '—'}</td>
                  <td data-label="Por">{m.usuario_nome || '—'}</td></tr>
              ))}</tbody></table></div>
          </div>
        )}
      </AsyncState>
    </Modal>
  );
};

const EstoqueItens = () => {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [categoria, setCategoria] = useState('');
  const [form, setForm] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const { notify, toasts } = useToasts();
  const { loading, error, data, reload } = useLoad(() => estoqueAPI.itens({ q, categoria }), [q, categoria]);
  const categorias = useMemo(() => [...new Set((data || []).map((i) => i.categoria).filter(Boolean))], [data]);
  const itens = (data || []).filter((i) => !status || i.status === status);
  void user;

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div><h1 className={s.title}>Itens do estoque</h1><p className={s.sub}>Catálogo de materiais, saldos e status</p></div>
        <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => setForm(VAZIO)}><Plus size={18} />Novo item</button>
      </div>
      <div className={s.filters}>
        <div className={s.field}><input aria-label="Buscar item" placeholder="Buscar por nome…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className={s.field}><select aria-label="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}><option value="">Todas as categorias</option>{categorias.map((c) => <option key={c}>{c}</option>)}</select></div>
      </div>
      <div className={s.chips} role="group" aria-label="Filtrar por status">
        {[['', 'Todos'], ['OK', 'OK'], ['BAIXO', 'Baixo'], ['ZERADO', 'Zerado']].map(([v, l]) => (
          <button key={v} className={`${s.chip} ${status === v ? s.chipActive : ''}`} aria-pressed={status === v} onClick={() => setStatus(v)}>{l}</button>
        ))}
      </div>
      <AsyncState loading={loading} error={error} onRetry={reload} empty={itens.length === 0} emptyTitle="Nenhum item encontrado"
        emptyAction={<button className={`${s.btn} ${s.btnPrimary}`} onClick={() => setForm(VAZIO)}><Plus size={16} />Cadastrar item</button>}>
        <div className={s.tableWrap}><table className={s.table}>
          <thead><tr><th>Item</th><th>Categoria</th><th>Saldo</th><th>Com técnicos</th><th>Mínimo</th><th>Status</th><th /></tr></thead>
          <tbody>{itens.map((i) => (
            <tr key={i.id} className={s.clickRow} onClick={() => setDetalhe(i.id)}>
              <td data-label="Item"><b><Package size={14} style={{ verticalAlign: -2 }} /> {i.nome}</b></td>
              <td data-label="Categoria">{i.categoria || '—'}</td>
              <td data-label="Saldo" className={s.num}>{fmtQtd(i.saldo, i.unidade)}</td>
              <td data-label="Com técnicos" className={s.num}>{fmtQtd(i.em_posse, i.unidade)}</td>
              <td data-label="Mínimo" className={s.num}>{fmtNum(i.estoque_minimo)}</td>
              <td data-label="Status"><StatusBadge status={i.status} /></td>
              <td><button className={`${s.btn} ${s.btnSm}`} aria-label={`Editar ${i.nome}`} onClick={(e) => { e.stopPropagation(); setForm(i); }}><Pencil size={16} /></button></td>
            </tr>))}</tbody></table></div>
      </AsyncState>
      {form && <ItemForm inicial={form} notify={notify} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload(); }} />}
      {detalhe && <ItemDetalhe id={detalhe} onClose={() => setDetalhe(null)} />}
      {toasts}
    </div>
  );
};
export default EstoqueItens;
