import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { osAPI, cadastrosAPI, geoAPI, popsAPI } from '../api/estoque';
import { useAuth } from '../context/AuthContext';
import { AsyncState, useLoad, useToasts, Modal, Field, OsStatusBadge, PrioridadeBadge, fmtData, styles as s } from '../components/estoque/ui';
import { Select } from '../components/Select/Select';
import AddressSearch from '../components/AddressSearch';
import MapPreview from '../components/MapPreview';

import DateInput from '../components/DateInput';
const STATUS = [['', 'Todas'], ['aberta', 'Abertas'], ['em_andamento', 'Em andamento'], ['concluida', 'Concluídas'], ['cancelada', 'Canceladas']];
const VAZIA = {
  cliente: '', tipo_servico: '', endereco: '', cep: '', logradouro: '', numero_endereco: '', complemento: '', bairro: '', cidade: '', uf: '',
  latitude: '', longitude: '', pop_nome: '', rota_id: '', poste_id: '', tecnico_id: '', prazo: '', prioridade: 'normal', descricao: '',
};
const fmtCep = (v) => String(v || '').replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
/* Monta o texto único do endereço a partir dos campos estruturados */
const montarEndereco = (f) => [[f.logradouro, f.numero_endereco].filter(Boolean).join(', '), f.complemento, f.bairro, [f.cidade, f.uf].filter(Boolean).join(' - '), f.cep && fmtCep(f.cep)].filter(Boolean).join(' · ');

const NovaOS = ({ onClose, onSaved, notify }) => {
  const tecs = useLoad(() => cadastrosAPI.tecnicos());
  const tipos = useLoad(() => osAPI.tiposServico());
  const pops = useLoad(() => popsAPI.list());
  const [novoTipo, setNovoTipo] = useState(null); // null = campo fechado
  const addTipo = async () => {
    const nome = (novoTipo || '').trim();
    if (!nome) return;
    try { const t = await osAPI.criarTipoServico(nome); await tipos.reload(); setF((p) => ({ ...p, tipo_servico: t.nome })); setNovoTipo(null); }
    catch (err) { notify(err.message, 'err'); }
  };
  const [f, setF] = useState(VAZIA);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const r = await osAPI.criar({ ...f, endereco: f.logradouro ? montarEndereco(f) : f.endereco }); notify(`OS ${r.numero} criada`); onSaved(r.id); }
    catch (err) { notify(err.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal title="Nova ordem de serviço" onClose={onClose}>
      <form className={s.form} onSubmit={submit}>
        <Field label="Nome da OS"><input value={f.cliente} onChange={set('cliente')} required /></Field>
        <Field label="Tipo de serviço">
          <Select value={f.tipo_servico} onChange={set('tipo_servico')}><option value="">Selecione…</option>{(tipos.data || []).map((t) => <option key={t.id} value={t.nome}>{t.nome}</option>)}</Select>
          {novoTipo === null
            ? <button type="button" className={s.btn} onClick={() => setNovoTipo('')}><Plus size={16} />Adicionar tipo</button>
            : (
              <div className={s.inline}>
                <input value={novoTipo} autoFocus maxLength={60} placeholder="Nome do novo tipo" onChange={(e) => setNovoTipo(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTipo(); } }} />
                <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={addTipo} disabled={!novoTipo.trim()}>Salvar</button>
                <button type="button" className={s.btn} onClick={() => setNovoTipo(null)} aria-label="Cancelar">✕</button>
              </div>
            )}
        </Field>
        <Field label="Endereço" hint="Digite o CEP, as coordenadas (lat, lng) ou o nome da rua com número, e escolha a sugestão.">
          <AddressSearch value={f.endereco} onChange={(v) => setF((p) => ({ ...p, endereco: v }))}
            onPick={(it) => {
              setF((p) => ({ ...p, logradouro: it.logradouro || '', numero_endereco: it.numero || p.numero_endereco, bairro: it.bairro || '', cidade: it.cidade || '', uf: it.uf || '',
                cep: it.cep || '', latitude: it.latitude ?? '', longitude: it.longitude ?? '' }));
              // Sugestões do ViaCEP não trazem coordenadas: busca em segundo plano, sem sobrescrever o que o usuário digitar
              if (it.latitude == null) {
                geoAPI.geocode({ street: it.logradouro, numero: it.numero, city: it.cidade, uf: it.uf, cep: it.cep })
                  .then((g) => g.latitude != null && setF((p) => (p.latitude === '' ? { ...p, latitude: g.latitude, longitude: g.longitude } : p)))
                  .catch(() => {});
              }
            }} />
        </Field>
        <div className={s.inline}>
          <Field label="Rua"><input value={f.logradouro} onChange={set('logradouro')} /></Field>
          <Field label="Número"><input value={f.numero_endereco} onChange={set('numero_endereco')} inputMode="numeric" style={{ maxWidth: 110 }} /></Field>
        </div>
        <Field label="Complemento"><input value={f.complemento} onChange={set('complemento')} /></Field>
        <div className={s.inline}>
          <Field label="Bairro"><input value={f.bairro} onChange={set('bairro')} /></Field>
          <Field label="CEP"><input value={fmtCep(f.cep)} onChange={(e) => setF({ ...f, cep: e.target.value.replace(/\D/g, '').slice(0, 8) })} inputMode="numeric" style={{ maxWidth: 130 }} /></Field>
        </div>
        <div className={s.inline}>
          <Field label="Cidade"><input value={f.cidade} onChange={set('cidade')} /></Field>
          <Field label="UF"><input value={f.uf} onChange={(e) => setF({ ...f, uf: e.target.value.toUpperCase().slice(0, 2) })} style={{ maxWidth: 70 }} /></Field>
        </div>
        <div className={s.inline}>
          <Field label="Latitude"><input value={f.latitude} onChange={set('latitude')} inputMode="decimal" placeholder="-23.5505" /></Field>
          <Field label="Longitude"><input value={f.longitude} onChange={set('longitude')} inputMode="decimal" placeholder="-46.6333" /></Field>
        </div>
        <MapPreview lat={f.latitude} lng={f.longitude} />
        <Field label="POP">
          <Select value={f.pop_nome} onChange={set('pop_nome')}>
            <option value="">Selecione…</option>
            {f.pop_nome && !(pops.data || []).some((p) => p.nome === f.pop_nome) && <option value={f.pop_nome}>{f.pop_nome}</option>}
            {(pops.data || []).map((p) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
          </Select>
        </Field>
        <div className={s.inline}>
          <Field label="Rota"><input value={f.rota_id} onChange={set('rota_id')} placeholder="Ex.: RT-014" /></Field>
          <Field label="Poste"><input value={f.poste_id} onChange={set('poste_id')} placeholder="Ex.: PL-0932" /></Field>
        </div>
        <Field label="Atribuir a (técnico ou equipe terceirizada)">
          <Select value={f.tecnico_id} onChange={set('tecnico_id')} required>
            <option value="">Selecione…</option>
            {(tecs.data || []).filter((t) => t.ativo).map((t) => <option key={t.id} value={t.id}>{t.nome} — {t.tipo === 'interno' ? 'interno' : 'terceirizada'}</option>)}
          </Select>
        </Field>
        <Field label="Prazo"><DateInput value={f.prazo} onChange={set('prazo')} /></Field>
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
  // Técnico sem cadastro vinculado não tem OS: mostra o estado vazio em vez de erro.
  const semVinculo = isTecnico && /vinculado/i.test(error || '');
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
      <AsyncState loading={loading} error={semVinculo ? null : error} onRetry={reload} empty={semVinculo || lista.length === 0} emptyTitle={isTecnico ? 'Você não tem nenhuma OS atribuída no momento' : 'Nenhuma OS encontrada'}
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
