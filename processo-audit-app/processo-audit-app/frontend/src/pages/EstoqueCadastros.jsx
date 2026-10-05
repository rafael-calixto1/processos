import React, { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { cadastrosAPI } from '../api/estoque';
import { AsyncState, useLoad, useToasts, Modal, Field, styles as s } from '../components/estoque/ui';

const TecnicoForm = ({ inicial, onClose, onSaved, notify }) => {
  const usuarios = useLoad(() => cadastrosAPI.usuariosDisponiveis());
  const [f, setF] = useState(inicial);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const body = { ...f, usuario_id: f.tipo === 'interno' && f.usuario_id ? Number(f.usuario_id) : null };
      if (f.id) await cadastrosAPI.atualizarTecnico(f.id, body); else await cadastrosAPI.criarTecnico(body);
      notify('Cadastro salvo'); onSaved();
    } catch (err) { notify(err.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal title={f.id ? 'Editar técnico/equipe' : 'Novo técnico/equipe'} onClose={onClose}>
      <form className={s.form} onSubmit={submit}>
        <Field label="Nome"><input value={f.nome} onChange={set('nome')} required /></Field>
        <Field label="Tipo"><select value={f.tipo} onChange={set('tipo')}><option value="interno">Interno</option><option value="terceirizado">Equipe terceirizada</option></select></Field>
        {f.tipo === 'terceirizado' && <Field label="Empresa / equipe"><input value={f.empresa || ''} onChange={set('empresa')} /></Field>}
        <Field label="Telefone"><input value={f.telefone || ''} onChange={set('telefone')} /></Field>
        {f.tipo === 'interno' && (
          <Field label="Usuário de login (perfil Técnico)" hint="Crie o usuário em Usuários com o papel “Técnico de campo”. Equipes terceirizadas não têm login.">
            <select value={f.usuario_id || ''} onChange={set('usuario_id')}>
              <option value="">Sem vínculo</option>
              {f.usuario_id && !(usuarios.data || []).some((u) => u.id === f.usuario_id) && <option value={f.usuario_id}>{f.usuario_email || 'Usuário atual'}</option>}
              {(usuarios.data || []).map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select>
          </Field>
        )}
        {f.id && <Field label="Situação"><select value={f.ativo === 0 ? '0' : '1'} onChange={(e) => setF({ ...f, ativo: e.target.value === '1' })}><option value="1">Ativo</option><option value="0">Inativo</option></select></Field>}
        <button className={`${s.btn} ${s.btnPrimary}`} disabled={busy}>Salvar</button>
      </form>
    </Modal>
  );
};

const FornecedorForm = ({ inicial, onClose, onSaved, notify }) => {
  const [f, setF] = useState(inicial);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { if (f.id) await cadastrosAPI.atualizarFornecedor(f.id, f); else await cadastrosAPI.criarFornecedor(f); notify('Fornecedor salvo'); onSaved(); }
    catch (err) { notify(err.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal title={f.id ? 'Editar fornecedor' : 'Novo fornecedor'} onClose={onClose}>
      <form className={s.form} onSubmit={submit}>
        <Field label="Nome"><input value={f.nome} onChange={set('nome')} required /></Field>
        <Field label="CNPJ"><input value={f.cnpj || ''} onChange={set('cnpj')} /></Field>
        <Field label="Contato"><input value={f.contato || ''} onChange={set('contato')} /></Field>
        {f.id && <Field label="Situação"><select value={f.ativo === 0 ? '0' : '1'} onChange={(e) => setF({ ...f, ativo: e.target.value === '1' })}><option value="1">Ativo</option><option value="0">Inativo</option></select></Field>}
        <button className={`${s.btn} ${s.btnPrimary}`} disabled={busy}>Salvar</button>
      </form>
    </Modal>
  );
};

const EstoqueCadastros = () => {
  const [aba, setAba] = useState('tecnicos');
  const [form, setForm] = useState(null);
  const { notify, toasts } = useToasts();
  const tec = useLoad(() => cadastrosAPI.tecnicos());
  const forn = useLoad(() => cadastrosAPI.fornecedores());
  const fechar = () => { setForm(null); tec.reload(); forn.reload(); };
  const Situacao = ({ ativo }) => <span className={`${s.badge} ${ativo ? s.ok : s.neutro}`}>{ativo ? 'Ativo' : 'Inativo'}</span>;

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div><h1 className={s.title}>Cadastros</h1><p className={s.sub}>Técnicos, equipes terceirizadas e fornecedores</p></div>
        <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => setForm(aba === 'tecnicos' ? { nome: '', tipo: 'interno' } : { nome: '' })}><Plus size={18} />Novo</button>
      </div>
      <div className={s.chips} role="tablist">
        {[['tecnicos', 'Técnicos e equipes'], ['fornecedores', 'Fornecedores']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={aba === k} className={`${s.chip} ${aba === k ? s.chipActive : ''}`} onClick={() => setAba(k)}>{l}</button>))}
      </div>
      {aba === 'tecnicos' ? (
        <AsyncState loading={tec.loading} error={tec.error} onRetry={tec.reload} empty={(tec.data || []).length === 0} emptyTitle="Nenhum técnico cadastrado"
          emptyAction={<button className={`${s.btn} ${s.btnPrimary}`} onClick={() => setForm({ nome: '', tipo: 'interno' })}><Plus size={16} />Cadastrar técnico</button>}>
          <div className={s.tableWrap}><table className={s.table}>
            <thead><tr><th>Nome</th><th>Tipo</th><th>Telefone</th><th>Login vinculado</th><th>Situação</th><th /></tr></thead>
            <tbody>{(tec.data || []).map((t) => (
              <tr key={t.id}><td data-label="Nome"><b>{t.nome}</b></td><td data-label="Tipo">{t.tipo === 'interno' ? 'Interno' : `Terceirizada${t.empresa ? ` — ${t.empresa}` : ''}`}</td>
                <td data-label="Telefone">{t.telefone || '—'}</td><td data-label="Login">{t.usuario_email || '—'}</td><td data-label="Situação"><Situacao ativo={t.ativo} /></td>
                <td><button className={`${s.btn} ${s.btnSm}`} aria-label={`Editar ${t.nome}`} onClick={() => setForm(t)}><Pencil size={16} /></button></td></tr>))}</tbody></table></div>
        </AsyncState>
      ) : (
        <AsyncState loading={forn.loading} error={forn.error} onRetry={forn.reload} empty={(forn.data || []).length === 0} emptyTitle="Nenhum fornecedor cadastrado"
          emptyAction={<button className={`${s.btn} ${s.btnPrimary}`} onClick={() => setForm({ nome: '' })}><Plus size={16} />Cadastrar fornecedor</button>}>
          <div className={s.tableWrap}><table className={s.table}>
            <thead><tr><th>Nome</th><th>CNPJ</th><th>Contato</th><th>Situação</th><th /></tr></thead>
            <tbody>{(forn.data || []).map((x) => (
              <tr key={x.id}><td data-label="Nome"><b>{x.nome}</b></td><td data-label="CNPJ">{x.cnpj || '—'}</td><td data-label="Contato">{x.contato || '—'}</td><td data-label="Situação"><Situacao ativo={x.ativo} /></td>
                <td><button className={`${s.btn} ${s.btnSm}`} aria-label={`Editar ${x.nome}`} onClick={() => setForm(x)}><Pencil size={16} /></button></td></tr>))}</tbody></table></div>
        </AsyncState>
      )}
      {form && (aba === 'tecnicos' ? <TecnicoForm inicial={form} notify={notify} onClose={() => setForm(null)} onSaved={fechar} /> : <FornecedorForm inicial={form} notify={notify} onClose={() => setForm(null)} onSaved={fechar} />)}
      {toasts}
    </div>
  );
};
export default EstoqueCadastros;
