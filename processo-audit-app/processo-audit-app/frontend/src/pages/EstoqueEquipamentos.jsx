import React, { useState } from 'react';
import { Plus, ArrowRightFromLine, ArrowLeftToLine, CheckCircle2 } from 'lucide-react';
import { cadastrosAPI } from '../api/estoque';
import { AsyncState, useLoad, useToasts, Modal, Field, fmtDataHora, styles as s } from '../components/estoque/ui';

const COND = { novo: 'Novo', bom: 'Bom', usado: 'Usado', defeito: 'Com defeito' };
const CondSelect = ({ value, onChange }) => <select value={value} onChange={onChange}>{Object.entries(COND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>;

const EstoqueEquipamentos = () => {
  const eq = useLoad(() => cadastrosAPI.equipamentos());
  const tecs = useLoad(() => cadastrosAPI.tecnicos());
  const [modal, setModal] = useState(null); // {tipo:'novo'|'saida'|'devolucao', eq}
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const { notify, toasts } = useToasts();

  const abrir = (tipo, item) => { setModal({ tipo, item }); setF({ nome: '', patrimonio: '', estado: 'bom', tecnico_id: '', condicao_saida: item?.estado || 'bom', condicao_devolucao: 'bom' }); };
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      if (modal.tipo === 'novo') await cadastrosAPI.criarEquipamento(f);
      if (modal.tipo === 'saida') await cadastrosAPI.saidaEquipamento(modal.item.id, f);
      if (modal.tipo === 'devolucao') await cadastrosAPI.devolucaoEquipamento(modal.item.id, f);
      notify('Registrado'); setModal(null); eq.reload();
    } catch (err) { notify(err.message, 'err'); } finally { setBusy(false); }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div><h1 className={s.title}>Equipamentos</h1><p className={s.sub}>Empréstimo de equipamentos (separado do estoque de consumo)</p></div>
        <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => abrir('novo')}><Plus size={18} />Novo equipamento</button>
      </div>
      <AsyncState loading={eq.loading} error={eq.error} onRetry={eq.reload} empty={(eq.data || []).length === 0} emptyTitle="Nenhum equipamento cadastrado"
        emptyAction={<button className={`${s.btn} ${s.btnPrimary}`} onClick={() => abrir('novo')}><Plus size={16} />Cadastrar equipamento</button>}>
        <div className={s.tableWrap}><table className={s.table}>
          <thead><tr><th>Equipamento</th><th>Patrimônio / serial</th><th>Estado</th><th>Situação</th><th /></tr></thead>
          <tbody>{(eq.data || []).map((e) => (
            <tr key={e.id}><td data-label="Equipamento"><b>{e.nome}</b></td><td data-label="Patrimônio">{e.patrimonio || '—'}</td><td data-label="Estado">{COND[e.estado]}</td>
              <td data-label="Situação">{e.emprestimo_id
                ? <span className={`${s.badge} ${s.baixo}`}><ArrowRightFromLine size={14} />Com {e.tecnico_nome} desde {fmtDataHora(e.saida_em)}</span>
                : <span className={`${s.badge} ${s.ok}`}><CheckCircle2 size={14} />Disponível</span>}</td>
              <td>{e.emprestimo_id
                ? <button className={`${s.btn} ${s.btnSm}`} onClick={() => abrir('devolucao', e)}><ArrowLeftToLine size={16} />Devolução</button>
                : <button className={`${s.btn} ${s.btnSm}`} onClick={() => abrir('saida', e)}><ArrowRightFromLine size={16} />Saída</button>}</td></tr>))}</tbody></table></div>
      </AsyncState>
      {modal && (
        <Modal title={modal.tipo === 'novo' ? 'Novo equipamento' : modal.tipo === 'saida' ? `Saída — ${modal.item.nome}` : `Devolução — ${modal.item.nome}`} onClose={() => setModal(null)}>
          <form className={s.form} onSubmit={submit}>
            {modal.tipo === 'novo' && (<>
              <Field label="Nome"><input value={f.nome} onChange={set('nome')} required /></Field>
              <Field label="Patrimônio / serial"><input value={f.patrimonio} onChange={set('patrimonio')} /></Field>
              <Field label="Estado"><CondSelect value={f.estado} onChange={set('estado')} /></Field></>)}
            {modal.tipo === 'saida' && (<>
              <Field label="Técnico / equipe"><select value={f.tecnico_id} onChange={set('tecnico_id')} required><option value="">Selecione…</option>{(tecs.data || []).filter((t) => t.ativo).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></Field>
              <Field label="Condição na saída"><CondSelect value={f.condicao_saida} onChange={set('condicao_saida')} /></Field></>)}
            {modal.tipo === 'devolucao' && <Field label="Condição na devolução"><CondSelect value={f.condicao_devolucao} onChange={set('condicao_devolucao')} /></Field>}
            <button className={`${s.btn} ${s.btnPrimary}`} disabled={busy}>Confirmar</button>
          </form>
        </Modal>
      )}
      {toasts}
    </div>
  );
};
export default EstoqueEquipamentos;
