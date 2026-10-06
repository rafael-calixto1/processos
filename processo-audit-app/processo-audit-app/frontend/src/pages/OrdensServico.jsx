import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { osAPI, cadastrosAPI } from '../api/estoque';
import { useAuth } from '../context/AuthContext';
import { AsyncState, useLoad, useToasts, Modal, Field, OsStatusBadge, PrioridadeBadge, fmtData, styles as s } from '../components/estoque/ui';
import { Select } from '../components/Select/Select';

const STATUS = [['', 'Todas'], ['aberta', 'Abertas'], ['em_andamento', 'Em andamento'], ['concluida', 'Concluídas'], ['cancelada', 'Canceladas']];
const VAZIA = { cliente: '', endereco: '', tecnico_id: '', prazo: '', prioridade: 'normal', descricao: '' };

const NovaOS = ({ onClose, onSaved, notify }) => {
  const tecs = useLoad(() => cadastrosAPI.tecnicos());
  const [f, setF] = useState(VAZIA);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const r = await osAPI.criar(f); notify(`OS ${r.numero} criada`); onSaved(r.id); }
    catch (err) { notify(err.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal title="Nova ordem de serviço" onClose={onClose}>
      <form className={s.form} onSubmit={submit}>
        <Field label="Nome da OS"><input value={f.cliente} onChange={set('cliente')} required /></Field>
        <Field label="Endereço"><input value={f.endereco} onChange={set('endereco')} /></Field>
        <Field label="Atribuir a (técnico ou equipe terceirizada)">
          <Select value={f.tecnico_id} onChange={set('tecnico_id')} required>
            <option value="">Selecione…</option>
            {(tecs.data || []).filter((t) => t.ativo).map((t) => <option key={t.id} value={t.id}>{t.nome} — {t.tipo === 'interno' ? 'interno' : 'terceirizada'}</option>)}
          </Select>
        </Field>
        <Field label="Prazo"><input type="date" value={f.prazo} onChange={set('prazo')} /></Field>
        <Field label="Prioridade"><Select value={f.prioridade} onChange={set('prioridade')}><option value="baixa">Baixa</option><option value="normal">Normal</option><option value="alta">Alta</option></Select></Field>
        <Field label="Descrição"><textarea value={f.descricao} onChange={set('descricao')} /></Field>
        <button className={`${s.btn} ${s.btnPrimary}`} disabled={busy}>Criar OS</button>
      </form>
    </Modal>
  );
};

const OrdensServico = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const isTecnico = user?.role === 'tecnico';
  const [status, setStatus] = useState('');
  const [nova, setNova] = useState(false);
  const { notify, toasts } = useToasts();
  const { loading, error, data, reload } = useLoad(() => osAPI.list({ status }), [status]);
  const lista = data || [];
  const atrasada = (o) => o.prazo && !['concluida', 'cancelada'].includes(o.status) && String(o.prazo).slice(0, 10) < new Date().toISOString().slice(0, 10);

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div><h1 className={s.title}>{isTecnico ? 'Minhas OS' : 'Ordens de Serviço'}</h1>
          <p className={s.sub}>{isTecnico ? 'Ordens atribuídas a você' : 'Crie, atribua e acompanhe as ordens'}</p></div>
        {!isTecnico && <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => setNova(true)}><Plus size={18} />Nova OS</button>}
      </div>
      <div className={s.chips} role="group" aria-label="Filtrar por status">
        {STATUS.map(([v, l]) => <button key={v} className={`${s.chip} ${status === v ? s.chipActive : ''}`} aria-pressed={status === v} onClick={() => setStatus(v)}>{l}</button>)}
      </div>
      <AsyncState loading={loading} error={error} onRetry={reload} empty={lista.length === 0} emptyTitle="Nenhuma OS encontrada"
        emptyAction={!isTecnico && <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => setNova(true)}><Plus size={16} />Criar OS</button>}>
        <div className={s.tableWrap}><table className={s.table}>
          <thead><tr><th>Nº</th><th>Nome da OS</th>{!isTecnico && <th>Responsável</th>}<th>Prazo</th><th>Prioridade</th><th>Status</th></tr></thead>
          <tbody>{lista.map((o) => (
            <tr key={o.id} className={s.clickRow} onClick={() => nav(`/os/${o.id}`)}>
              <td data-label="Nº"><b>#{o.numero}</b></td><td data-label="Nome da OS">{o.cliente}</td>
              {!isTecnico && <td data-label="Responsável">{o.tecnico_nome}</td>}
              <td data-label="Prazo">{fmtData(o.prazo)}{atrasada(o) && <b style={{ color: '#991b1b' }}> · atrasada</b>}</td>
              <td data-label="Prioridade"><PrioridadeBadge p={o.prioridade} /></td><td data-label="Status"><OsStatusBadge status={o.status} /></td>
            </tr>))}</tbody></table></div>
      </AsyncState>
      {nova && <NovaOS notify={notify} onClose={() => setNova(false)} onSaved={(id) => nav(`/os/${id}`)} />}
      {toasts}
    </div>
  );
};
export default OrdensServico;
