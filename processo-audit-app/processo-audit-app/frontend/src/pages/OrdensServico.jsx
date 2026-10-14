import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, ArrowUp, ArrowDown, ArrowUpDown, ShieldCheck, X } from 'lucide-react';
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

// Filtros e ordenação ficam na URL: dá para voltar do detalhe, recarregar ou mandar o link sem perder a busca
const FILTROS = ['q', 'status', 'tecnico_id', 'prioridade', 'tipo_servico', 'pop', 'periodo', 'de', 'ate', 'atrasadas', 'ordenar', 'direcao'];
const PERIODOS = [['criado', 'Criação'], ['prazo', 'Prazo'], ['executada', 'Execução']];
const ORDENS = [['', 'Mais recentes'], ['numero', 'Nº'], ['cliente', 'Nome da OS'], ['tecnico_nome', 'Responsável'], ['prazo', 'Prazo'],
  ['concluida_em', 'Executada em'], ['prioridade', 'Prioridade'], ['status', 'Status'], ['criado_em', 'Criada em']];

/* Monta os parâmetros da API a partir da URL (o período escolhido vira criado_de/prazo_ate etc.) */
const paramsDaApi = (f) => {
  const p = {};
  for (const k of ['q', 'status', 'tecnico_id', 'prioridade', 'tipo_servico', 'pop', 'atrasadas', 'ordenar', 'direcao']) if (f[k]) p[k] = f[k];
  const periodo = f.periodo || 'criado';
  if (f.de) p[`${periodo}_de`] = f.de;
  if (f.ate) p[`${periodo}_ate`] = f.ate;
  return p;
};

const Ordenavel = ({ campo, label, f, onOrdenar }) => {
  const ativo = f.ordenar === campo;
  const Icone = !ativo ? ArrowUpDown : f.direcao === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th aria-sort={ativo ? (f.direcao === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onOrdenar(campo)} title={`Ordenar por ${label.toLowerCase()}`}
        style={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, color: 'inherit', textDecoration: ativo ? 'underline' : 'none', textUnderlineOffset: 3 }}>
        {label}<Icone size={13} aria-hidden="true" style={{ opacity: ativo ? 1 : 0.45 }} />
      </button>
    </th>
  );
};

const OrdensServico = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const isTecnico = user?.role === 'tecnico';
  const [sp, setSp] = useSearchParams();
  const f = Object.fromEntries(FILTROS.map((k) => [k, sp.get(k) || '']));
  const setF = (mudancas) => setSp((atual) => {
    const n = new URLSearchParams(atual);
    for (const [k, v] of Object.entries(mudancas)) { if (v) n.set(k, v); else n.delete(k); }
    return n;
  }, { replace: true });
  const [busca, setBusca] = useState(f.q);
  // a busca em texto só vai para a URL (e para a API) depois que a pessoa para de digitar
  useEffect(() => {
    const t = setTimeout(() => { if (busca.trim() !== f.q) setF({ q: busca.trim() }); }, 400);
    return () => clearTimeout(t);
  }, [busca]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setBusca((b) => (b.trim() === f.q ? b : f.q)); }, [f.q]); // "Limpar filtros" e voltar no navegador

  const [nova, setNova] = useState(false);
  const { notify, toasts } = useToasts();
  const chave = JSON.stringify(paramsDaApi(f));
  const { loading, error, data, reload } = useLoad(() => osAPI.list(paramsDaApi(f)), [chave]);
  const tecs = useLoad(() => (isTecnico ? Promise.resolve([]) : cadastrosAPI.tecnicos()), [isTecnico]);
  const tipos = useLoad(() => osAPI.tiposServico());
  const pops = useLoad(() => (isTecnico ? Promise.resolve([]) : popsAPI.list()), [isTecnico]);
  const lista = data || [];
  // Técnico sem cadastro vinculado não tem OS: mostra o estado vazio em vez de erro.
  const semVinculo = isTecnico && /vinculado/i.test(error || '');
  const atrasada = (o) => o.prazo && !['concluida', 'cancelada'].includes(o.status) && String(o.prazo).slice(0, 10) < new Date().toISOString().slice(0, 10);
  const temFiltro = FILTROS.some((k) => !['ordenar', 'direcao', 'periodo'].includes(k) && f[k]);
  // 1º clique: crescente (texto) ou decrescente (datas e nº); 2º inverte; 3º volta ao padrão
  const ordenar = (campo) => {
    const desc1 = ['numero', 'prazo', 'concluida_em', 'criado_em', 'prioridade'].includes(campo);
    const primeira = desc1 ? 'desc' : 'asc';
    if (f.ordenar !== campo) return setF({ ordenar: campo, direcao: primeira });
    if (f.direcao === primeira) return setF({ direcao: primeira === 'asc' ? 'desc' : 'asc' });
    return setF({ ordenar: '', direcao: '' });
  };
  const sel = (k) => (e) => setF({ [k]: e.target.value });

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div><h1 className={s.title}>{isTecnico ? 'Minhas OS' : 'Ordens de Serviço'}</h1>
          <p className={s.sub}>{isTecnico ? 'Ordens atribuídas a você' : 'Crie, atribua e acompanhe as ordens'}</p></div>
        {!isTecnico && (
          <div className={s.inline}>
            <button className={s.btn} onClick={() => nav('/os/auditoria')}><ShieldCheck size={18} />Auditoria</button>
            <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => setNova(true)}><Plus size={18} />Nova OS</button>
          </div>
        )}
      </div>
      <div className={s.chips} role="group" aria-label="Filtrar por status">
        {STATUS.map(([v, l]) => <button key={v} className={`${s.chip} ${f.status === v ? s.chipActive : ''}`} aria-pressed={f.status === v} onClick={() => setF({ status: v })}>{l}</button>)}
        <button className={`${s.chip} ${f.atrasadas ? s.chipActive : ''}`} aria-pressed={Boolean(f.atrasadas)} onClick={() => setF({ atrasadas: f.atrasadas ? '' : '1' })}>Atrasadas</button>
      </div>
      <div className={s.filters} style={{ marginTop: 10 }}>
        <div className={s.field} style={{ flexBasis: 260 }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} aria-hidden="true" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
            <input aria-label="Buscar OS" placeholder="Buscar por nº, nome, endereço, bairro, rota, poste…" value={busca}
              onChange={(e) => setBusca(e.target.value)} style={{ paddingLeft: 32 }} />
          </div>
        </div>
        {!isTecnico && (
          <div className={s.field}><Select aria-label="Responsável" value={f.tecnico_id} onChange={sel('tecnico_id')}>
            <option value="">Todos os responsáveis</option>
            {(tecs.data || []).map((t) => <option key={t.id} value={t.id}>{t.nome}{t.ativo ? '' : ' (inativo)'}</option>)}
          </Select></div>
        )}
        <div className={s.field}><Select aria-label="Prioridade" value={f.prioridade} onChange={sel('prioridade')}>
          <option value="">Todas as prioridades</option><option value="alta">Alta</option><option value="normal">Normal</option><option value="baixa">Baixa</option>
        </Select></div>
        <div className={s.field}><Select aria-label="Tipo de serviço" value={f.tipo_servico} onChange={sel('tipo_servico')}>
          <option value="">Todos os tipos</option>
          {(tipos.data || []).map((t) => <option key={t.id} value={t.nome}>{t.nome}</option>)}
        </Select></div>
        {!isTecnico && (
          <div className={s.field}><Select aria-label="POP" value={f.pop} onChange={sel('pop')}>
            <option value="">Todos os POPs</option>
            {(pops.data || []).map((p) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
          </Select></div>
        )}
      </div>
      <div className={s.filters} style={{ marginTop: 8, alignItems: 'center' }}>
        <div className={s.field}><Select aria-label="Período por" value={f.periodo || 'criado'} onChange={(e) => setF({ periodo: e.target.value === 'criado' ? '' : e.target.value })}>
          {PERIODOS.map(([v, l]) => <option key={v} value={v}>Período: {l}</option>)}
        </Select></div>
        <div className={s.field}><DateInput aria-label="De" placeholder="De" value={f.de} onChange={sel('de')} max={f.ate || undefined} /></div>
        <div className={s.field}><DateInput aria-label="Até" placeholder="Até" value={f.ate} onChange={sel('ate')} min={f.de || undefined} /></div>
        <div className={s.field}><Select aria-label="Ordenar por" value={f.ordenar} onChange={(e) => setF({ ordenar: e.target.value, direcao: e.target.value ? (f.direcao || 'asc') : '' })}>
          {ORDENS.map(([v, l]) => <option key={v} value={v}>Ordenar: {l}</option>)}
        </Select></div>
        {f.ordenar && (
          <button type="button" className={s.btn} style={{ flex: '0 0 auto' }} onClick={() => setF({ direcao: f.direcao === 'asc' ? 'desc' : 'asc' })}
            aria-label={f.direcao === 'asc' ? 'Ordem crescente (inverter)' : 'Ordem decrescente (inverter)'}>
            {f.direcao === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}{f.direcao === 'asc' ? 'Crescente' : 'Decrescente'}
          </button>
        )}
        {temFiltro && (
          <button type="button" className={s.btn} style={{ flex: '0 0 auto' }} onClick={() => { setBusca(''); setSp(f.ordenar ? { ordenar: f.ordenar, direcao: f.direcao } : {}, { replace: true }); }}>
            <X size={16} />Limpar filtros
          </button>
        )}
      </div>
      {!loading && !error && lista.length > 0 && (
        <p className={s.sub} style={{ margin: '10px 0 4px' }}>{lista.length === 300 ? 'Mostrando as 300 primeiras — refine os filtros' : `${lista.length} OS`}</p>
      )}
      <AsyncState loading={loading} error={semVinculo ? null : error} onRetry={reload} empty={semVinculo || lista.length === 0}
        emptyTitle={isTecnico ? 'Você não tem nenhuma OS atribuída no momento' : temFiltro ? 'Nenhuma OS com esses filtros' : 'Nenhuma OS encontrada'}
        emptyAction={!isTecnico && !temFiltro && <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => setNova(true)}><Plus size={16} />Criar OS</button>}>
        <div className={s.tableWrap}><table className={s.table}>
          <thead><tr>
            <Ordenavel campo="numero" label="Nº" f={f} onOrdenar={ordenar} />
            <Ordenavel campo="cliente" label="Nome da OS" f={f} onOrdenar={ordenar} />
            {!isTecnico && <Ordenavel campo="tecnico_nome" label="Responsável" f={f} onOrdenar={ordenar} />}
            <Ordenavel campo="prazo" label="Prazo" f={f} onOrdenar={ordenar} />
            <Ordenavel campo="concluida_em" label="Executada em" f={f} onOrdenar={ordenar} />
            <Ordenavel campo="prioridade" label="Prioridade" f={f} onOrdenar={ordenar} />
            <Ordenavel campo="status" label="Status" f={f} onOrdenar={ordenar} />
          </tr></thead>
          <tbody>{lista.map((o) => (
            <tr key={o.id} className={s.clickRow} onClick={() => nav(`/os/${o.id}`)}>
              <td data-label="Nº"><b>#{o.numero}</b></td><td data-label="Nome da OS">{o.cliente}</td>
              {!isTecnico && <td data-label="Responsável">{o.tecnico_nome}</td>}
              <td data-label="Prazo">{fmtData(o.prazo)}{atrasada(o) && <b style={{ color: '#991b1b' }}> · atrasada</b>}</td>
              <td data-label="Executada em">{o.status === 'concluida' ? fmtData(o.concluida_em) : '—'}</td>
              <td data-label="Prioridade"><PrioridadeBadge p={o.prioridade} /></td><td data-label="Status"><OsStatusBadge status={o.status} /></td>
            </tr>))}</tbody></table></div>
      </AsyncState>
      {nova && <NovaOS notify={notify} onClose={() => setNova(false)} onSaved={(id) => nav(`/os/${id}`)} />}
      {toasts}
    </div>
  );
};
export default OrdensServico;
