import React, { useState } from 'react';
import { Plus, Pencil, EyeOff, Eye } from 'lucide-react';
import { catalogosOsAPI } from '../api/estoque';
import { AsyncState, useLoad, useToasts, Modal, Field, ConfirmDialog, styles as s } from '../components/estoque/ui';
import { Select } from '../components/Select/Select';

const TIPOS = { boolean: 'Sim / Não', number: 'Número', text: 'Texto' };

const Formulario = ({ aba, inicial, onClose, onSaved, notify }) => {
  const [f, setF] = useState(inicial);
  const [busy, setBusy] = useState(false);
  const novo = !f.id;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const corpo = { rotulo: f.rotulo, ordem: f.ordem === '' || f.ordem === undefined ? undefined : Number(f.ordem) };
      if (aba === 'checklist') { corpo.obrigatorio = Boolean(f.obrigatorio); corpo.unidade = f.tipo === 'number' ? (f.unidade || '') : undefined; if (novo) corpo.tipo = f.tipo; }
      if (aba === 'motivos') { if (novo) await catalogosOsAPI.criarMotivo(corpo); else await catalogosOsAPI.atualizarMotivo(f.id, corpo); }
      else if (novo) await catalogosOsAPI.criarItemChecklist(corpo); else await catalogosOsAPI.atualizarItemChecklist(f.id, corpo);
      notify('Salvo. O app recebe a mudança na próxima sincronização.'); onSaved();
    } catch (err) { notify(err.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal title={`${novo ? 'Novo' : 'Editar'} ${aba === 'motivos' ? 'motivo de fechamento' : 'item do checklist'}`} onClose={onClose}>
      <form className={s.form} onSubmit={submit}>
        <Field label={aba === 'motivos' ? 'Nome do motivo' : 'Pergunta'}><input value={f.rotulo || ''} onChange={set('rotulo')} required minLength={3} maxLength={aba === 'motivos' ? 160 : 255} /></Field>
        {aba === 'checklist' && (
          <>
            <Field label="Tipo de resposta" hint={novo ? 'Depois de criado o tipo não muda: se errar, desative este item e crie outro.' : undefined}>
              <Select value={f.tipo || 'boolean'} onChange={set('tipo')} disabled={!novo}>{Object.entries(TIPOS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
            </Field>
            {(f.tipo || 'boolean') === 'number' && <Field label="Unidade" hint="Ex.: m, un"><input value={f.unidade || ''} onChange={set('unidade')} maxLength={10} /></Field>}
            <Field label="Obrigatório"><Select value={f.obrigatorio ? '1' : '0'} onChange={(e) => setF({ ...f, obrigatorio: e.target.value === '1' })}><option value="1">Sim: o técnico precisa responder para finalizar</option><option value="0">Não, é opcional</option></Select></Field>
          </>
        )}
        <Field label="Ordem na lista" hint="Menor aparece primeiro. Vazio = no fim."><input type="number" min="0" value={f.ordem ?? ''} onChange={set('ordem')} /></Field>
        {!novo && <p className={s.sub} style={{ margin: 0 }}>Código: <b>{f.codigo}</b> (não muda). O histórico das OS já finalizadas guarda uma cópia do texto: editar o nome não reescreve o passado.</p>}
        <button className={`${s.btn} ${s.btnPrimary}`} disabled={busy}>Salvar</button>
      </form>
    </Modal>
  );
};

/* Catálogos da finalização de OS (motivos e checklist), usados no app do celular e no web. Só admin. Nada é apagado: desativa. */
const OsCatalogos = () => {
  const [aba, setAba] = useState('motivos');
  const [form, setForm] = useState(null);
  const [alternar, setAlternar] = useState(null); // item que está sendo ativado/desativado
  const [busy, setBusy] = useState(false);
  const { notify, toasts } = useToasts();
  const motivos = useLoad(() => catalogosOsAPI.motivos());
  const checklist = useLoad(() => catalogosOsAPI.checklist());
  const atual = aba === 'motivos' ? motivos : checklist;
  const lista = atual.data || [];

  const salvar = () => { setForm(null); atual.reload(); };
  const confirmarAlternar = async () => {
    setBusy(true);
    try {
      const corpo = { ativo: !alternar.ativo };
      if (aba === 'motivos') await catalogosOsAPI.atualizarMotivo(alternar.id, corpo); else await catalogosOsAPI.atualizarItemChecklist(alternar.id, corpo);
      notify(alternar.ativo ? 'Desativado: some do app na próxima sincronização.' : 'Ativado.'); setAlternar(null); atual.reload();
    } catch (err) { notify(err.message, 'err'); setAlternar(null); } finally { setBusy(false); }
  };
  const Situacao = ({ ativo }) => <span className={`${s.badge} ${ativo ? s.ok : s.neutro}`}>{ativo ? 'Ativo' : 'Desativado'}</span>;

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div><h1 className={s.title}>Catálogos da finalização</h1><p className={s.sub}>Motivos de fechamento e perguntas do checklist que os técnicos veem ao finalizar uma OS (no app e no web)</p></div>
        <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => setForm(aba === 'motivos' ? { rotulo: '' } : { rotulo: '', tipo: 'boolean', obrigatorio: false })}><Plus size={18} />Novo</button>
      </div>
      <div className={s.chips} role="tablist">
        {[['motivos', 'Motivos de fechamento'], ['checklist', 'Checklist']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={aba === k} className={`${s.chip} ${aba === k ? s.chipActive : ''}`} onClick={() => setAba(k)}>{l}</button>))}
      </div>
      <AsyncState loading={atual.loading} error={atual.error} onRetry={atual.reload} empty={lista.length === 0} emptyTitle="Nada cadastrado">
        <div className={s.tableWrap}><table className={s.table}>
          <thead><tr><th>Ordem</th><th>{aba === 'motivos' ? 'Motivo' : 'Pergunta'}</th>{aba === 'checklist' && <th>Resposta</th>}{aba === 'checklist' && <th>Obrigatório</th>}{aba === 'motivos' && <th>Usos</th>}<th>Situação</th><th /></tr></thead>
          <tbody>{lista.map((x) => (
            <tr key={x.id} style={x.ativo ? undefined : { opacity: 0.6 }}>
              <td data-label="Ordem">{x.ordem}</td>
              <td data-label={aba === 'motivos' ? 'Motivo' : 'Pergunta'}><b>{x.rotulo}</b><br /><small className={s.sub}>{x.codigo}</small></td>
              {aba === 'checklist' && <td data-label="Resposta">{TIPOS[x.tipo]}{x.unidade ? ` (${x.unidade})` : ''}</td>}
              {aba === 'checklist' && <td data-label="Obrigatório">{x.obrigatorio ? 'Sim' : 'Não'}</td>}
              {aba === 'motivos' && <td data-label="Usos">{x.usos}</td>}
              <td data-label="Situação"><Situacao ativo={x.ativo} /></td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className={`${s.btn} ${s.btnSm}`} aria-label={`Editar ${x.rotulo}`} onClick={() => setForm(x)}><Pencil size={16} /></button>{' '}
                <button className={`${s.btn} ${s.btnSm}`} aria-label={`${x.ativo ? 'Desativar' : 'Ativar'} ${x.rotulo}`} onClick={() => setAlternar(x)}>{x.ativo ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </td>
            </tr>))}</tbody></table></div>
      </AsyncState>
      {form && <Formulario aba={aba} inicial={form} notify={notify} onClose={() => setForm(null)} onSaved={salvar} />}
      {alternar && (
        <ConfirmDialog title={alternar.ativo ? 'Desativar este item?' : 'Ativar este item?'} confirmLabel={alternar.ativo ? 'Desativar' : 'Ativar'} danger={alternar.ativo} busy={busy} onConfirm={confirmarAlternar} onCancel={() => setAlternar(null)}>
          {alternar.ativo
            ? <>“{alternar.rotulo}” deixa de aparecer para os técnicos na próxima sincronização do app. As OS já finalizadas continuam com o histórico. Dá para ativar de novo depois.</>
            : <>“{alternar.rotulo}” volta a aparecer para os técnicos na próxima sincronização do app.</>}
        </ConfirmDialog>
      )}
      {toasts}
    </div>
  );
};
export default OsCatalogos;
