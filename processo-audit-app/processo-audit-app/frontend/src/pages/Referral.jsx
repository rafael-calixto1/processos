import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Gift, Plus, X, Search, CheckCircle2, Clock, XCircle, AlertCircle, RefreshCw, Settings, FlaskConical, Pencil, Trash2 } from 'lucide-react';
import { referralAPI } from '../api';
import styles from './Referral.module.css';

const STATUS_LABELS = {
  pendente:             'Pendente',
  aguardando_pagamento: 'Ag. Pagamento',
  ativo:                'Ativo',
  cancelado:            'Cancelado',
  manual:               'Manual',
};
const STATUS_ICONS  = {
  pendente:             Clock,
  aguardando_pagamento: Clock,
  ativo:                CheckCircle2,
  cancelado:            XCircle,
  manual:               FlaskConical,
};
const STATUS_CLASS = {
  pendente:             'badgePendente',
  aguardando_pagamento: 'badgeAguardando',
  ativo:                'badgeAtivo',
  cancelado:            'badgeCancelado',
  manual:               'badgeManual',
};

const PAGE_SIZE = 10;

const fmtDate = (v) => {
  if (!v) return '—';
  if (typeof v === 'string' && v.includes('-') && v.length <= 10) {
    const [y, m, d] = v.split('-');
    if (y && m && d) return `${d}/${m}/${y}`;
  }
  return new Date(v).toLocaleDateString('pt-BR');
};

const fmtMoney = (v) =>
  v != null ? `R$ ${parseFloat(v).toFixed(2).replace('.', ',')}` : '—';

export default function Referral() {
  const [indicacoes, setIndicacoes]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchTerm, setSearchTerm]   = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState(null);
  const [form, setForm]                 = useState({
    cod_cliente_indicador: '',
    nome_indicador: '',
    id_cliente_servico: '',
    id_prospecto_indicado: '',
    nome_indicado: '',
    valor_desconto: '',
    regra_ativacao: 'ativacao',
    tipo_recompensa: 'desconto_valor',
  });

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId]         = useState(null);
  const [editForm, setEditForm]           = useState(null);
  const [editSaving, setEditSaving]       = useState(false);
  const [editError, setEditError]         = useState(null);

  const [lookupIndicador, setLookupIndicador] = useState({ loading: false, error: null, servicos: [] });
  const [lookupIndicado, setLookupIndicado]   = useState({ loading: false, error: null, jaECliente: null });
  const timerIndicador = useRef(null);
  const timerIndicado  = useRef(null);

  const [editLookupIndicador, setEditLookupIndicador] = useState({ loading: false, error: null });
  const [editLookupIndicado, setEditLookupIndicado]   = useState({ loading: false, error: null });
  const editTimerIndicador = useRef(null);
  const editTimerIndicado  = useRef(null);

  const fetchCliente = (id, timerRef) => {
    clearTimeout(timerRef.current);
    setForm(f => ({ ...f, nome_indicador: '', id_cliente_servico: '' }));
    setLookupIndicador({ loading: false, error: null, servicos: [] });
    if (!id || id.length < 1) return;
    setLookupIndicador({ loading: true, error: null, servicos: [] });
    timerRef.current = setTimeout(async () => {
      try {
        const data = await referralAPI.getCliente(id);
        const servicos = data.servicos ?? [];
        const defaultServico = servicos.find(s => s.status_prefixo === 'servico_habilitado') ?? servicos[0];
        setForm(f => ({ ...f, nome_indicador: data.nome, id_cliente_servico: defaultServico?.id_cliente_servico ?? '' }));
        setLookupIndicador({ loading: false, error: null, servicos });
      } catch {
        setLookupIndicador({ loading: false, error: 'Não encontrado', servicos: [] });
      }
    }, 600);
  };

  const fetchProspecto = (id, timerRef) => {
    clearTimeout(timerRef.current);
    setForm(f => ({ ...f, nome_indicado: '' }));
    setLookupIndicado({ loading: false, error: null, jaECliente: null });
    if (!id || id.length < 1) return;
    setLookupIndicado({ loading: true, error: null, jaECliente: null });
    timerRef.current = setTimeout(async () => {
      try {
        const data = await referralAPI.getProspecto(id);
        setForm(f => ({ ...f, nome_indicado: data.nome }));
        setLookupIndicado({ loading: false, error: null, jaECliente: data.ja_e_cliente });
      } catch {
        setLookupIndicado({ loading: false, error: 'Prospecto não encontrado', jaECliente: null });
      }
    }, 600);
  };

  const fetchClienteEdit = (id) => {
    clearTimeout(editTimerIndicador.current);
    setEditLookupIndicador({ loading: false, error: null });
    if (!id) return;
    setEditLookupIndicador({ loading: true, error: null });
    editTimerIndicador.current = setTimeout(async () => {
      try {
        const data = await referralAPI.getCliente(id);
        setEditForm(f => (f ? { ...f, nome_indicador: data.nome } : f));
        setEditLookupIndicador({ loading: false, error: null });
      } catch {
        setEditLookupIndicador({ loading: false, error: 'Não encontrado' });
      }
    }, 600);
  };

  const fetchProspectoEdit = (id) => {
    clearTimeout(editTimerIndicado.current);
    setEditLookupIndicado({ loading: false, error: null });
    if (!id) return;
    setEditLookupIndicado({ loading: true, error: null });
    editTimerIndicado.current = setTimeout(async () => {
      try {
        const data = await referralAPI.getProspecto(id);
        setEditForm(f => (f ? { ...f, nome_indicado: data.nome } : f));
        setEditLookupIndicado({ loading: false, error: null });
      } catch {
        setEditLookupIndicado({ loading: false, error: 'Prospecto não encontrado' });
      }
    }, 600);
  };

  const [showTeste, setShowTeste]         = useState(false);
  const [testeForm, setTesteForm]         = useState({ cod_cliente: '', id_cliente_servico: '', tipo_recompensa: 'desconto_valor', valor: '', descricao: '', alvo: '' });
  const [testeLookup, setTesteLookup]     = useState({ loading: false, nome: '', servicos: [], error: null });
  const [testeFaturasDisponiveis, setTesteFaturasDisponiveis] = useState([]);
  const [testeResult, setTesteResult]     = useState(null);
  const [savingTeste, setSavingTeste]     = useState(false);
  const [testeError, setTesteError]       = useState(null);
  const [simulando, setSimulando]         = useState(false);
  const [simulacao, setSimulacao]         = useState(null);
  const [simulacaoError, setSimulacaoError] = useState(null);
  const timerTeste = useRef(null);

  // Qualquer mudança no formulário invalida a simulação e o resultado anteriores — evita
  // aplicar de verdade um valor que não corresponde mais ao que foi simulado. Não mexe na
  // lista de faturas disponíveis nem no alvo escolhido: esses só mudam quando o cliente/
  // serviço muda (ver handleTesteIdChange e o onChange do <select> de Serviço).
  const resetSimulacao = () => {
    setSimulacao(null);
    setSimulacaoError(null);
    setTesteResult(null);
    setTesteError(null);
  };

  const [showConfig, setShowConfig]         = useState(false);
  const [configValor, setConfigValor]       = useState('');
  const [configRegra, setConfigRegra]       = useState('ativacao');
  const [configTipo, setConfigTipo]         = useState('desconto_valor');
  const [savingConfig, setSavingConfig]     = useState(false);
  const [configError, setConfigError]       = useState(null);
  const [configSaved, setConfigSaved]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await referralAPI.list(filterStatus || undefined);
      setIndicacoes(data.indicacoes || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  // Volta para a primeira página sempre que a busca ou o filtro mudam
  useEffect(() => { setCurrentPage(1); }, [filterStatus, searchTerm]);

  const handleTesteIdChange = (val) => {
    setTesteForm(f => ({ ...f, cod_cliente: val, id_cliente_servico: '', alvo: '' }));
    setTesteLookup({ loading: false, nome: '', servicos: [], error: null });
    setTesteFaturasDisponiveis([]);
    resetSimulacao();
    clearTimeout(timerTeste.current);
    if (!val) return;
    setTesteLookup({ loading: true, nome: '', servicos: [], error: null });
    timerTeste.current = setTimeout(async () => {
      try {
        const data = await referralAPI.getCliente(val);
        const servicos = data.servicos ?? [];
        const defaultServico = servicos.find(s => s.status_prefixo === 'servico_habilitado') ?? servicos[0];
        setTesteLookup({ loading: false, nome: data.nome, servicos, error: null });
        setTesteForm(f => ({ ...f, id_cliente_servico: defaultServico?.id_cliente_servico ?? '' }));
      } catch {
        setTesteLookup({ loading: false, nome: '', servicos: [], error: 'Não encontrado' });
      }
    }, 600);
  };

  // Serviço diferente = lista de faturas diferente, então zera o alvo escolhido junto.
  const handleTesteServicoChange = (val) => {
    setTesteForm(f => ({ ...f, id_cliente_servico: val, alvo: '' }));
    setTesteFaturasDisponiveis([]);
    resetSimulacao();
  };

  // Passo 1: simula (não escreve nada no Hubsoft) — mostra qual fatura seria afetada, se
  // alguma já está aberta e vai ficar de fora, e o valor real que seria lançado. Aceita
  // overrides pontuais (ex: o <select> de "Fatura alvo" dispara isso direto no onChange, sem
  // esperar o próximo render do estado do formulário).
  const runSimular = async (overrides = {}) => {
    const f = { ...testeForm, ...overrides };
    setSimulando(true);
    setSimulacaoError(null);
    setSimulacao(null);
    setTesteResult(null);
    setTesteError(null);
    try {
      let mes_processar, ano_processar;
      if (f.alvo) {
        const [mes, ano] = f.alvo.split('-');
        mes_processar = Number(mes);
        ano_processar = Number(ano);
      }
      const res = await referralAPI.simularDesconto({
        cod_cliente: Number(f.cod_cliente),
        id_cliente_servico: Number(f.id_cliente_servico),
        tipo_recompensa: f.tipo_recompensa,
        valor: f.tipo_recompensa === 'desconto_valor' && f.valor ? parseFloat(f.valor) : undefined,
        mes_processar,
        ano_processar,
      });
      setSimulacao(res);
      setTesteFaturasDisponiveis(res.faturas_disponiveis || []);
    } catch (err) {
      setSimulacaoError(err.message);
    } finally {
      setSimulando(false);
    }
  };

  const handleSimularSubmit = (e) => { e.preventDefault(); runSimular(); };

  // Trocar a fatura alvo já dispara a simulação de novo — não precisa clicar em "Simular"
  // de novo só porque escolheu outra fatura na lista.
  const handleAlvoChange = (val) => {
    setTesteForm(f => ({ ...f, alvo: val }));
    runSimular({ alvo: val });
  };

  // Passo 2: só depois de ver a simulação — aplica de verdade, usando o valor e o alvo exatos
  // que foram simulados (não o que está no formulário, que pode ter mudado desde então).
  const handleAplicarReal = async () => {
    if (!simulacao) return;
    setSavingTeste(true);
    setTesteError(null);
    setTesteResult(null);
    try {
      const res = await referralAPI.descontoManual({
        cod_cliente: Number(testeForm.cod_cliente),
        id_cliente_servico: Number(testeForm.id_cliente_servico),
        valor: simulacao.valor_a_aplicar,
        descricao: testeForm.descricao || undefined,
        tipo_recompensa: simulacao.tipo_recompensa,
        mes_processar: simulacao.alvo.mes_processar ?? undefined,
        ano_processar: simulacao.alvo.ano_processar ?? undefined,
        id_fatura_alvo: simulacao.mecanismo === 'renegociacao' ? simulacao.alvo_fatura_existente?.id_fatura : undefined,
      });
      setTesteResult(res);
    } catch (err) {
      setTesteError(err.message);
    } finally {
      setSavingTeste(false);
    }
  };

  const openConfig = async () => {
    try {
      const data = await referralAPI.getConfig();
      setConfigValor(String(data.desconto_valor));
      setConfigRegra(data.regra_ativacao || 'ativacao');
      setConfigTipo(data.tipo_recompensa || 'desconto_valor');
    } catch {
      setConfigValor('10');
      setConfigRegra('ativacao');
      setConfigTipo('desconto_valor');
    }
    setConfigError(null);
    setConfigSaved(false);
    setShowConfig(true);
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    setConfigError(null);
    setConfigSaved(false);
    try {
      await referralAPI.saveConfig({
        desconto_valor: configTipo === 'desconto_valor' ? parseFloat(configValor) : undefined,
        regra_ativacao: configRegra,
        tipo_recompensa: configTipo,
      });
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
    } catch (err) {
      setConfigError(err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const openModal = async () => {
    let regra_ativacao = 'ativacao';
    let tipo_recompensa = 'desconto_valor';
    try {
      const data = await referralAPI.getConfig();
      regra_ativacao = data.regra_ativacao || 'ativacao';
      tipo_recompensa = data.tipo_recompensa || 'desconto_valor';
    } catch { /* usa padrão */ }
    setForm(f => ({ ...f, regra_ativacao, tipo_recompensa }));
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await referralAPI.create({
        cod_cliente_indicador: Number(form.cod_cliente_indicador),
        nome_indicador: form.nome_indicador || undefined,
        id_cliente_servico: form.id_cliente_servico ? Number(form.id_cliente_servico) : undefined,
        id_prospecto_indicado: Number(form.id_prospecto_indicado),
        nome_indicado: form.nome_indicado || undefined,
        valor_desconto: form.valor_desconto ? parseFloat(form.valor_desconto) : undefined,
        regra_ativacao: form.regra_ativacao,
        tipo_recompensa: form.tipo_recompensa,
      });
      setShowModal(false);
      setForm({ cod_cliente_indicador: '', nome_indicador: '', id_cliente_servico: '', id_prospecto_indicado: '', nome_indicado: '', valor_desconto: '', regra_ativacao: 'ativacao', tipo_recompensa: 'desconto_valor' });
      setLookupIndicador({ loading: false, error: null, servicos: [] });
      setLookupIndicado({ loading: false, error: null, jaECliente: null });
      load();
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id) => {
    if (!confirm('Cancelar esta indicação?')) return;
    try {
      await referralAPI.cancel(id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const openEditModal = (i) => {
    setEditingId(i.id);
    setEditForm({
      cod_cliente_indicador: i.cod_cliente_indicador ?? '',
      nome_indicador: i.nome_indicador ?? '',
      id_prospecto_indicado: i.id_prospecto_indicado ?? '',
      nome_indicado: i.nome_indicado ?? '',
      valor_desconto: i.valor_desconto ?? '',
      status: i.status,
      regra_ativacao: i.regra_ativacao ?? 'ativacao',
      tipo_recompensa: i.tipo_recompensa ?? 'desconto_valor',
    });
    setEditError(null);
    setEditLookupIndicador({ loading: false, error: null });
    setEditLookupIndicado({ loading: false, error: null });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditSaving(true);
    setEditError(null);
    try {
      await referralAPI.update(editingId, {
        cod_cliente_indicador: editForm.cod_cliente_indicador ? Number(editForm.cod_cliente_indicador) : undefined,
        nome_indicador: editForm.nome_indicador,
        id_prospecto_indicado: editForm.id_prospecto_indicado ? Number(editForm.id_prospecto_indicado) : null,
        nome_indicado: editForm.nome_indicado,
        valor_desconto: editForm.valor_desconto ? parseFloat(editForm.valor_desconto) : null,
        status: editForm.status,
        regra_ativacao: editForm.regra_ativacao,
        tipo_recompensa: editForm.tipo_recompensa,
      });
      setShowEditModal(false);
      setEditingId(null);
      setEditForm(null);
      load();
    } catch (e) {
      setEditError(e.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir permanentemente esta indicação? Esta ação não pode ser desfeita.')) return;
    try {
      await referralAPI.remove(id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const filtered = indicacoes.filter((i) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      String(i.cod_cliente_indicador).includes(term) ||
      String(i.cod_cliente_indicado ?? '').includes(term) ||
      String(i.id_prospecto_indicado ?? '').includes(term) ||
      (i.nome_indicador || '').toLowerCase().includes(term) ||
      (i.nome_indicado || '').toLowerCase().includes(term)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page       = Math.min(currentPage, totalPages);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd   = Math.min(page * PAGE_SIZE, filtered.length);

  const stats = {
    total:                indicacoes.length,
    pendente:             indicacoes.filter(i => i.status === 'pendente').length,
    aguardando_pagamento: indicacoes.filter(i => i.status === 'aguardando_pagamento').length,
    ativo:                indicacoes.filter(i => i.status === 'ativo').length,
    cancelado:            indicacoes.filter(i => i.status === 'cancelado').length,
    manual:               indicacoes.filter(i => i.status === 'manual').length,
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <Gift size={22} />
          </div>
          <div>
            <h1 className={styles.title}>Indique e Ganhe</h1>
            <p className={styles.subtitle}>Gerencie indicações e descontos automáticos de mensalidade</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={openConfig}>
            <Settings size={15} />
            <span>Configurações</span>
          </button>
          <button className={styles.btnTeste} onClick={() => { setShowTeste(true); resetSimulacao(); setTesteForm({ cod_cliente: '', id_cliente_servico: '', tipo_recompensa: 'desconto_valor', valor: '', descricao: '', alvo: '' }); setTesteLookup({ loading: false, nome: '', servicos: [], error: null }); setTesteFaturasDisponiveis([]); }}>
            <FlaskConical size={15} />
            <span>Teste</span>
          </button>
          <button className={styles.btnPrimary} onClick={openModal}>
            <Plus size={16} />
            <span>Nova Indicação</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        {[
          { label: 'Total',          value: stats.total,                color: 'var(--text-dark)'     },
          { label: 'Pendentes',      value: stats.pendente,             color: 'var(--warning)'       },
          { label: 'Ag. Pagamento',  value: stats.aguardando_pagamento, color: 'var(--info)'          },
          { label: 'Ativados',       value: stats.ativo,                color: 'var(--success)'       },
          { label: 'Cancelados',     value: stats.cancelado,            color: 'var(--text-light)'    },
          { label: 'Manuais',        value: stats.manual,               color: 'var(--accent-color)'  },
        ].map(({ label, value, color }) => (
          <div key={label} className={styles.statCard}>
            <span className={styles.statValue} style={{ color }}>{value}</span>
            <span className={styles.statLabel}>{label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Buscar por nome ou ID do cliente..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className={styles.filterTabs}>
          {[
            { value: '',                     label: 'Todos'         },
            { value: 'pendente',             label: 'Pendentes'     },
            { value: 'aguardando_pagamento', label: 'Ag. Pagamento' },
            { value: 'ativo',                label: 'Ativados'      },
            { value: 'cancelado',            label: 'Cancelados'    },
            { value: 'manual',               label: 'Manuais'       },
          ].map(({ value, label }) => (
            <button
              key={value}
              className={`${styles.filterTab} ${filterStatus === value ? styles.filterTabActive : ''}`}
              onClick={() => setFilterStatus(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <button className={styles.btnRefresh} onClick={load} title="Atualizar">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
        {loading ? (
          <div className={styles.center}><div className="spinner" /></div>
        ) : error ? (
          <div className={styles.errorBox}>
            <AlertCircle size={16} />
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <Gift size={40} strokeWidth={1.2} />
            <p>Nenhuma indicação encontrada</p>
            <span>Clique em "Nova Indicação" para registrar</span>
          </div>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Indicador</th>
                  <th>Indicado</th>
                  <th>Status</th>
                  <th>Desconto</th>
                  <th>Evento Hubsoft</th>
                  <th>Fatura</th>
                  <th>Data</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((i) => {
                  const badgeClass = styles[STATUS_CLASS[i.status] || STATUS_CLASS.pendente];
                  const Icon = STATUS_ICONS[i.status] || Clock;
                  return (
                    <tr key={i.id}>
                      <td className={styles.tdId}>{i.id}</td>
                      <td>
                        <div className={styles.clientCell}>
                          <span className={styles.clientName}>{i.nome_indicador || '—'}</span>
                          <span className={styles.clientId}>Cód. {i.cod_cliente_indicador}</span>
                        </div>
                      </td>
                      <td>
                        {i.status === 'manual' ? (
                          <span className={styles.clientId} style={{ fontStyle: 'italic' }}>Desconto direto</span>
                        ) : (
                          <div className={styles.clientCell}>
                            <span className={styles.clientName}>{i.nome_indicado || '—'}</span>
                            {i.id_prospecto_indicado
                              ? <span className={styles.clientId}>Prosp. #{i.id_prospecto_indicado}</span>
                              : i.cod_cliente_indicado
                                ? <span className={styles.clientId}>Cód. {i.cod_cliente_indicado}</span>
                                : null}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`${styles.badge} ${badgeClass}`}>
                          <Icon size={12} />
                          {STATUS_LABELS[i.status]}
                        </span>
                      </td>
                      <td className={styles.tdMoney}>
                        {i.valor_desconto ? fmtMoney(i.valor_desconto) : '—'}
                      </td>
                      <td className={styles.tdId}>
                        {i.id_evento_faturamento ? `#${i.id_evento_faturamento}` : '—'}
                      </td>
                      <td style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-medium)', lineHeight: 1.3 }}>
                        <div>{i.fatura_referencia || '—'}</div>
                        {i.data_vencimento && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginTop: 2 }}>
                            Venc: {fmtDate(i.data_vencimento)}
                          </div>
                        )}
                        {i.data_faturamento && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>
                            Fat: {fmtDate(i.data_faturamento)}
                          </div>
                        )}
                        {!!i.desconto_adiado && (
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.7rem', color: '#b45309', marginTop: 2 }}
                            title="A fatura em aberto no momento do lançamento já havia sido gerada e não foi afetada — o desconto vale a partir da próxima."
                          >
                            <AlertCircle size={11} />
                            Adiado p/ próxima
                          </div>
                        )}
                      </td>
                      <td className={styles.tdDate}>{fmtDate(i.created_at)}</td>
                      <td>
                        <div className={styles.rowActions}>
                          {i.status === 'pendente' && (
                            <button
                              className={styles.btnCancel}
                              onClick={() => handleCancel(i.id)}
                              title="Cancelar indicação"
                            >
                              <X size={14} />
                            </button>
                          )}
                          <button
                            className={styles.btnEdit}
                            onClick={() => openEditModal(i)}
                            title="Editar indicação"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className={styles.btnCancel}
                            onClick={() => handleDelete(i.id)}
                            title="Excluir indicação"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile card list */}
            <div className={styles.cardList}>
              {paginated.map((i) => {
                const badgeClass = styles[STATUS_CLASS[i.status] || STATUS_CLASS.pendente];
                const Icon = STATUS_ICONS[i.status] || Clock;
                return (
                  <div key={i.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <span className={styles.tdId}>#{i.id}</span>
                      <span className={`${styles.badge} ${badgeClass}`}>
                        <Icon size={12} />
                        {STATUS_LABELS[i.status]}
                      </span>
                    </div>

                    <div className={styles.cardRow}>
                      <span className={styles.cardLabel}>Indicador</span>
                      <div className={styles.clientCell}>
                        <span className={styles.clientName}>{i.nome_indicador || '—'}</span>
                        <span className={styles.clientId}>Cód. {i.cod_cliente_indicador}</span>
                      </div>
                    </div>

                    <div className={styles.cardRow}>
                      <span className={styles.cardLabel}>Indicado</span>
                      {i.status === 'manual' ? (
                        <span className={styles.clientId} style={{ fontStyle: 'italic' }}>Desconto direto</span>
                      ) : (
                        <div className={styles.clientCell}>
                          <span className={styles.clientName}>{i.nome_indicado || '—'}</span>
                          {i.id_prospecto_indicado
                            ? <span className={styles.clientId}>Prosp. #{i.id_prospecto_indicado}</span>
                            : i.cod_cliente_indicado
                              ? <span className={styles.clientId}>Cód. {i.cod_cliente_indicado}</span>
                              : null}
                        </div>
                      )}
                    </div>

                    <div className={styles.cardMeta}>
                      <div className={styles.cardMetaItem}>
                        <span className={styles.cardLabel}>Desconto</span>
                        <span className={styles.tdMoney}>{i.valor_desconto ? fmtMoney(i.valor_desconto) : '—'}</span>
                      </div>
                      <div className={styles.cardMetaItem}>
                        <span className={styles.cardLabel}>Evento Hubsoft</span>
                        <span className={styles.tdId}>{i.id_evento_faturamento ? `#${i.id_evento_faturamento}` : '—'}</span>
                      </div>
                      <div className={styles.cardMetaItem}>
                        <span className={styles.cardLabel}>Fatura</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-medium)' }}>
                          {i.fatura_referencia || '—'}
                          {i.data_vencimento && ` · Venc: ${fmtDate(i.data_vencimento)}`}
                          {i.data_faturamento && ` · Fat: ${fmtDate(i.data_faturamento)}`}
                        </span>
                        {!!i.desconto_adiado && (
                          <span
                            style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', color: '#b45309', marginTop: 2 }}
                            title="A fatura em aberto no momento do lançamento já havia sido gerada e não foi afetada — o desconto vale a partir da próxima."
                          >
                            <AlertCircle size={11} />
                            Adiado p/ próxima fatura
                          </span>
                        )}
                      </div>
                      <div className={styles.cardMetaItem}>
                        <span className={styles.cardLabel}>Data</span>
                        <span className={styles.tdDate}>{fmtDate(i.created_at)}</span>
                      </div>
                    </div>

                    <div className={styles.cardActions}>
                      {i.status === 'pendente' && (
                        <button className={styles.btnCancel} onClick={() => handleCancel(i.id)} title="Cancelar indicação">
                          <X size={14} />
                        </button>
                      )}
                      <button className={styles.btnEdit} onClick={() => openEditModal(i)} title="Editar indicação">
                        <Pencil size={14} />
                      </button>
                      <button className={styles.btnCancel} onClick={() => handleDelete(i.id)} title="Excluir indicação">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Paginação */}
            <div className={styles.pagination}>
              <span className={styles.pageInfo}>
                Mostrando <strong>{rangeStart}–{rangeEnd}</strong> de {filtered.length} indicações
              </span>
              {totalPages > 1 && (
              <div className={styles.pageControls}>
                <button
                  className={styles.pageBtn}
                  disabled={page === 1}
                  onClick={() => setCurrentPage(page - 1)}
                >
                  Anterior
                </button>
                <span className={styles.pageInfo}>
                  Página <strong>{page}</strong> de {totalPages}
                </span>
                <button
                  className={styles.pageBtn}
                  disabled={page === totalPages}
                  onClick={() => setCurrentPage(page + 1)}
                >
                  Próxima
                </button>
              </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal Teste */}
      {showTeste && (
        <div className={styles.overlay} onClick={() => setShowTeste(false)}>
          <div className={styles.modal} style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FlaskConical size={16} style={{ color: '#7c3aed' }} />
                <h2>Testar / Aplicar Desconto</h2>
              </div>
              <button className={styles.modalClose} onClick={() => setShowTeste(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleSimularSubmit} className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>
                  Cód. do Cliente (Hubsoft) *
                  {testeLookup.loading && <span className={styles.lookupHint}> buscando...</span>}
                  {testeLookup.error   && <span className={styles.lookupError}> {testeLookup.error}</span>}
                </label>
                <input
                  type="number"
                  required
                  placeholder="Ex: 6993"
                  value={testeForm.cod_cliente}
                  onChange={e => handleTesteIdChange(e.target.value)}
                />
                {testeLookup.nome && (
                  <span style={{ fontSize: '0.82rem', color: 'var(--success)', fontWeight: 600, marginTop: 2 }}>
                    ✓ {testeLookup.nome}
                  </span>
                )}
              </div>

              {testeLookup.servicos.length > 0 && (
                <div className={styles.formGroup}>
                  <label>Serviço *</label>
                  <select
                    required
                    value={testeForm.id_cliente_servico}
                    onChange={e => handleTesteServicoChange(e.target.value)}
                    className={styles.select}
                  >
                    {testeLookup.servicos.map(s => (
                      <option key={s.id_cliente_servico} value={s.id_cliente_servico}>
                        {s.nome} — R$ {parseFloat(s.valor).toFixed(2).replace('.', ',')} ({s.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={styles.formGroup}>
                <label>Tipo de recompensa</label>
                <select
                  className={styles.select}
                  value={testeForm.tipo_recompensa}
                  onChange={e => { setTesteForm(f => ({ ...f, tipo_recompensa: e.target.value })); resetSimulacao(); }}
                >
                  <option value="desconto_valor">Desconto em valor (R$)</option>
                  <option value="remover_fatura">Remover uma fatura (valor cheio do plano)</option>
                </select>
              </div>

              {testeForm.id_cliente_servico && (
                <div className={styles.formGroup}>
                  <label>
                    Fatura alvo
                    {simulando && <span className={styles.lookupHint}> simulando...</span>}
                  </label>
                  <select
                    className={styles.select}
                    value={testeForm.alvo}
                    onChange={e => handleAlvoChange(e.target.value)}
                  >
                    <option value="">Automático — deixa o Hubsoft escolher (padrão)</option>
                    {testeFaturasDisponiveis.map(f => (
                      <option key={`${f.mes_processar}-${f.ano_processar}`} value={`${f.mes_processar}-${f.ano_processar}`}>
                        {String(f.mes_processar).padStart(2, '0')}/{f.ano_processar} — {fmtMoney(f.valor)} — vence {fmtDate(f.data_vencimento)} (fatura #{f.id_fatura})
                      </option>
                    ))}
                  </select>
                  {simulacao && testeFaturasDisponiveis.length === 0 && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginTop: 2 }}>
                      Nenhuma fatura em aberto encontrada para esse serviço — só a opção automática está disponível.
                    </span>
                  )}
                </div>
              )}

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Valor (R$)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder={testeForm.tipo_recompensa === 'remover_fatura' ? 'Ignorado — usa o valor do plano' : 'Usa padrão se vazio'}
                    value={testeForm.valor}
                    disabled={testeForm.tipo_recompensa === 'remover_fatura'}
                    onChange={e => { setTesteForm(f => ({ ...f, valor: e.target.value })); resetSimulacao(); }}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Descrição</label>
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={testeForm.descricao}
                    onChange={e => setTesteForm(f => ({ ...f, descricao: e.target.value }))}
                  />
                </div>
              </div>

              {!simulacao && !testeResult && (
                <div className={styles.infoBox} style={{ background: '#f5f3ff', color: '#7c3aed', borderColor: '#ddd6fe' }}>
                  <AlertCircle size={14} />
                  <span>Simule primeiro — nada é gravado no Hubsoft nesta etapa. Você só aplica de verdade depois de ver o resultado.</span>
                </div>
              )}

              {simulacaoError && (
                <div className={styles.errorBox}>
                  <AlertCircle size={14} />
                  {simulacaoError}
                </div>
              )}

              {simulacao && !testeResult && (
                <div className={styles.infoBox} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, background: '#eff6ff', color: '#1e3a8a', borderColor: '#bfdbfe' }}>
                  <strong style={{ fontSize: '0.82rem' }}>Simulação — nada foi gravado ainda</strong>
                  <div style={{ fontSize: '0.82rem', lineHeight: 1.6 }}>
                    Cliente: <strong>{simulacao.cliente.nome}</strong> · Plano: {simulacao.servico.nome} (R$ {fmtMoney(simulacao.servico.valor)})
                    <br />
                    Fatura em aberto agora:{' '}
                    {simulacao.fatura_em_aberto
                      ? <strong>#{simulacao.fatura_em_aberto.id_fatura} · {fmtMoney(simulacao.fatura_em_aberto.valor)} · vence {fmtDate(simulacao.fatura_em_aberto.data_vencimento)}</strong>
                      : <strong>nenhuma</strong>}
                    <br />
                    Alvo: <strong>{simulacao.alvo.referencia}</strong>
                    {simulacao.alvo.mes_processar && ` (${String(simulacao.alvo.mes_processar).padStart(2, '0')}/${simulacao.alvo.ano_processar})`}
                    {simulacao.alvo.escolhido_manualmente && <span style={{ color: '#7c3aed' }}> · escolhida manualmente</span>}
                    <br />
                    Mecanismo:{' '}
                    <strong>
                      {simulacao.mecanismo === 'evento_faturamento' && 'Evento de faturamento (fatura ainda não existe)'}
                      {simulacao.mecanismo === 'renegociacao' && 'Renegociação (fatura já existe — cancela e reemite)'}
                      {simulacao.mecanismo === 'bloqueado_ja_paga' && 'Bloqueado — fatura já paga'}
                      {simulacao.mecanismo === 'bloqueado_valor_muito_baixo' && 'Bloqueado — valor da fatura muito baixo'}
                      {simulacao.mecanismo === 'bloqueado_desconto_maior_que_fatura' && 'Bloqueado — desconto maior que a fatura'}
                    </strong>
                    <br />
                    Valor que será lançado: <strong>{fmtMoney(simulacao.valor_a_aplicar)}</strong>
                  </div>

                  {simulacao.mecanismo === 'renegociacao' && simulacao.renegociacao_preview && (
                    <div style={{ fontSize: '0.78rem', lineHeight: 1.6, background: '#fff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '6px 8px' }}>
                      Renegociação da fatura #{simulacao.alvo_fatura_existente.id_fatura}: desconto de{' '}
                      <strong>{fmtMoney(simulacao.renegociacao_preview.desconto)}</strong>, cancela o boleto atual e emite um novo de{' '}
                      <strong>{fmtMoney(simulacao.renegociacao_preview.valor_final)}</strong>.
                      {simulacao.renegociacao_preview.sera_liquidado_automaticamente && (
                        <> Esse centavo restante é <strong>liquidado automaticamente</strong> logo em seguida (sem custo pro cliente) — fica um registro de "pago R$0,01" na fatura nova.</>
                      )}
                    </div>
                  )}

                  {simulacao.desconto_adiado && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: '0.78rem', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 8px' }}>
                      <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>A fatura em aberto acima já foi gerada e <strong>não</strong> vai ser afetada por um evento de faturamento — escolha-a na lista "Fatura alvo" acima para renegociá-la diretamente.</span>
                    </div>
                  )}
                  {simulacao.mecanismo === 'bloqueado_ja_paga' && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: '0.78rem', color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '6px 8px' }}>
                      <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>A fatura de {simulacao.alvo.referencia} já foi <strong>paga</strong> — esse desconto não vai ter efeito nenhum.</span>
                    </div>
                  )}
                  {simulacao.mecanismo === 'bloqueado_desconto_maior_que_fatura' && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: '0.78rem', color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '6px 8px' }}>
                      <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>O valor do desconto (R$ {fmtMoney(simulacao.valor_a_aplicar)}) precisa ser menor que o da fatura (R$ {fmtMoney(simulacao.alvo_fatura_existente.valor)}) — para zerar use "Remover uma fatura".</span>
                    </div>
                  )}
                </div>
              )}

              {testeError && (
                <div className={styles.errorBox}>
                  <AlertCircle size={14} />
                  {testeError}
                </div>
              )}

              {testeResult && testeResult.mecanismo === 'renegociacao' && (
                <div className={styles.successBox}>
                  <CheckCircle2 size={14} />
                  <span>
                    Fatura #{testeResult.fatura_original?.id_fatura} renegociada para <strong>{testeResult.cliente?.nome}</strong> — nova fatura <strong>#{testeResult.nova_fatura?.id_fatura}</strong> de {fmtMoney(testeResult.nova_fatura?.valor)}
                    {testeResult.liquidado && <> · centavo restante liquidado automaticamente</>}
                    {testeResult.aviso && <><br /><strong style={{ color: '#b45309' }}>{testeResult.aviso}</strong></>}
                  </span>
                </div>
              )}

              {testeResult && testeResult.mecanismo !== 'renegociacao' && (
                <div className={styles.successBox}>
                  <CheckCircle2 size={14} />
                  <span>
                    Desconto de <strong>{fmtMoney(testeResult.valor)}</strong> aplicado para <strong>{testeResult.cliente?.nome}</strong> — Evento Hubsoft <strong>#{testeResult.id_evento_faturamento}</strong> ({testeResult.fatura_referencia})
                  </span>
                </div>
              )}

              {testeResult?.desconto_adiado && (
                <div className={styles.infoBox} style={{ background: '#fffbeb', color: '#b45309', borderColor: '#fde68a' }}>
                  <AlertCircle size={14} />
                  <span>
                    O cliente já tinha uma fatura em aberto no momento do lançamento — o Hubsoft não altera faturas já geradas, então esse desconto só vai valer a partir da <strong>próxima</strong> fatura, não da atual.
                  </span>
                </div>
              )}

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowTeste(false)}>Fechar</button>
                {!testeResult && simulacao && (
                  <button
                    type="button"
                    className={styles.btnTeste}
                    disabled={savingTeste || simulacao.mecanismo?.startsWith('bloqueado')}
                    title={simulacao.mecanismo?.startsWith('bloqueado') ? 'Esse alvo está bloqueado — veja o aviso acima' : undefined}
                    onClick={handleAplicarReal}
                  >
                    {savingTeste ? 'Aplicando...' : simulacao.mecanismo === 'renegociacao' ? 'Renegociar de verdade' : 'Aplicar de verdade'}
                  </button>
                )}
                {!testeResult && (
                  <button type="submit" className={simulacao ? styles.btnSecondary : styles.btnTeste} disabled={simulando}>
                    {simulando ? 'Simulando...' : simulacao ? 'Simular de novo' : 'Simular'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Config */}
      {showConfig && (
        <div className={styles.overlay} onClick={() => setShowConfig(false)}>
          <div className={styles.modal} style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Configurações — Indique e Ganhe</h2>
              <button className={styles.modalClose} onClick={() => setShowConfig(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveConfig} className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Tipo de recompensa por indicação *</label>
                <div className={styles.ruleOptions}>
                  <label className={`${styles.ruleOption} ${configTipo === 'desconto_valor' ? styles.ruleOptionActive : ''}`}>
                    <input
                      type="radio"
                      name="tipo_recompensa"
                      value="desconto_valor"
                      checked={configTipo === 'desconto_valor'}
                      onChange={() => setConfigTipo('desconto_valor')}
                    />
                    <div className={styles.ruleOptionBody}>
                      <span className={styles.ruleOptionTitle}>Desconto em valor (R$)</span>
                      <span className={styles.ruleOptionDesc}>
                        Aplica um desconto fixo em reais na próxima fatura do cliente indicador.
                      </span>
                    </div>
                  </label>
                  <label className={`${styles.ruleOption} ${configTipo === 'remover_fatura' ? styles.ruleOptionActive : ''}`}>
                    <input
                      type="radio"
                      name="tipo_recompensa"
                      value="remover_fatura"
                      checked={configTipo === 'remover_fatura'}
                      onChange={() => setConfigTipo('remover_fatura')}
                    />
                    <div className={styles.ruleOptionBody}>
                      <span className={styles.ruleOptionTitle}>Remover uma fatura</span>
                      <span className={styles.ruleOptionDesc}>
                        Zera a próxima fatura pendente do cliente indicador, removendo o valor total a pagar.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {configTipo === 'desconto_valor' && (
                <div className={styles.formGroup}>
                  <label>Valor do desconto (R$) *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    placeholder="Ex: 10.00"
                    value={configValor}
                    onChange={e => setConfigValor(e.target.value)}
                  />
                </div>
              )}

              {configTipo === 'remover_fatura' && (
                <div className={styles.infoBox} style={{ background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }}>
                  <AlertCircle size={14} />
                  <span>
                    O sistema buscará automaticamente a próxima fatura não paga do indicador e criará um desconto igual ao valor total da fatura, zerando-a.
                  </span>
                </div>
              )}

              <div className={styles.formGroup}>
                <label>Regra para liberar a recompensa *</label>
                <div className={styles.ruleOptions}>
                  <label className={`${styles.ruleOption} ${configRegra === 'ativacao' ? styles.ruleOptionActive : ''}`}>
                    <input
                      type="radio"
                      name="regra_ativacao"
                      value="ativacao"
                      checked={configRegra === 'ativacao'}
                      onChange={() => setConfigRegra('ativacao')}
                    />
                    <div className={styles.ruleOptionBody}>
                      <span className={styles.ruleOptionTitle}>Quando ativar o serviço</span>
                      <span className={styles.ruleOptionDesc}>
                        O desconto é aplicado na fatura do indicador assim que o indicado ativar o serviço.
                      </span>
                    </div>
                  </label>

                  <label className={`${styles.ruleOption} ${configRegra === 'primeira_fatura_paga' ? styles.ruleOptionActive : ''}`}>
                    <input
                      type="radio"
                      name="regra_ativacao"
                      value="primeira_fatura_paga"
                      checked={configRegra === 'primeira_fatura_paga'}
                      onChange={() => setConfigRegra('primeira_fatura_paga')}
                    />
                    <div className={styles.ruleOptionBody}>
                      <span className={styles.ruleOptionTitle}>Quando pagar a primeira fatura</span>
                      <span className={styles.ruleOptionDesc}>
                        O desconto só é aplicado quando o indicado pagar sua primeira fatura. Enquanto isso, a indicação fica com status <strong>Ag. Pagamento</strong>.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {configRegra === 'primeira_fatura_paga' && (
                <div className={styles.infoBox} style={{ background: '#eff6ff', color: '#2563eb', borderColor: '#bfdbfe' }}>
                  <AlertCircle size={14} />
                  <span>
                    Configure o webhook <strong>POST /api/referral/webhook/pagamento</strong> no seu sistema de cobrança para disparar quando o indicado efetuar o primeiro pagamento.
                  </span>
                </div>
              )}

              {configRegra === 'ativacao' && (
                <div className={styles.infoBox}>
                  <AlertCircle size={14} />
                  <span>
                    O desconto será aplicado automaticamente na próxima fatura do indicador quando o indicado for ativado (via webhook <strong>POST /api/referral/webhook/ativacao</strong>).
                  </span>
                </div>
              )}

              {configError && (
                <div className={styles.errorBox}>
                  <AlertCircle size={14} />
                  {configError}
                </div>
              )}
              {configSaved && (
                <div className={styles.successBox}>
                  <CheckCircle2 size={14} />
                  Configuração salva com sucesso!
                </div>
              )}
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowConfig(false)}>
                  Fechar
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={savingConfig}>
                  {savingConfig ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Nova Indicação</h2>
              <button className={styles.modalClose} onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.modalBody}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Cód. do Indicador (Hubsoft) *</label>
                  <input
                    type="number"
                    required
                    placeholder="Ex: 1001"
                    value={form.cod_cliente_indicador}
                    onChange={e => {
                      const val = e.target.value;
                      setForm(f => ({ ...f, cod_cliente_indicador: val }));
                      fetchCliente(val, timerIndicador);
                    }}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>
                    Nome do Indicador
                    {lookupIndicador.loading && <span className={styles.lookupHint}> buscando...</span>}
                    {lookupIndicador.error   && <span className={styles.lookupError}> {lookupIndicador.error}</span>}
                  </label>
                  <input
                    type="text"
                    placeholder="Preenchido automaticamente"
                    value={form.nome_indicador}
                    onChange={e => setForm(f => ({ ...f, nome_indicador: e.target.value }))}
                  />
                </div>
              </div>

              {lookupIndicador.servicos.length > 0 && (
                <div className={styles.formGroup}>
                  <label>Plano / Serviço do Indicador *</label>
                  <select
                    required
                    className={styles.select}
                    value={form.id_cliente_servico}
                    onChange={e => setForm(f => ({ ...f, id_cliente_servico: e.target.value }))}
                  >
                    {lookupIndicador.servicos.map(s => (
                      <option key={s.id_cliente_servico} value={s.id_cliente_servico}>
                        {s.nome} — R$ {parseFloat(s.valor).toFixed(2).replace('.', ',')} ({s.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>ID do Prospecto (Hubsoft) *</label>
                  <input
                    type="number"
                    required
                    placeholder="Ex: 8498"
                    value={form.id_prospecto_indicado}
                    onChange={e => {
                      const val = e.target.value;
                      setForm(f => ({ ...f, id_prospecto_indicado: val, nome_indicado: '' }));
                      fetchProspecto(val, timerIndicado);
                    }}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>
                    Nome do Indicado
                    {lookupIndicado.loading && <span className={styles.lookupHint}> buscando...</span>}
                    {lookupIndicado.error   && <span className={styles.lookupError}> {lookupIndicado.error}</span>}
                    {lookupIndicado.jaECliente === true && <span className={styles.lookupHint}> (já é cliente)</span>}
                    {lookupIndicado.jaECliente === false && <span className={styles.lookupHint}> (ainda prospecto)</span>}
                  </label>
                  <input
                    type="text"
                    placeholder="Preenchido automaticamente"
                    value={form.nome_indicado}
                    onChange={e => setForm(f => ({ ...f, nome_indicado: e.target.value }))}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Tipo de recompensa por indicação *</label>
                <div className={styles.ruleOptions}>
                  <label className={`${styles.ruleOption} ${form.tipo_recompensa === 'desconto_valor' ? styles.ruleOptionActive : ''}`}>
                    <input
                      type="radio"
                      name="form_tipo_recompensa"
                      value="desconto_valor"
                      checked={form.tipo_recompensa === 'desconto_valor'}
                      onChange={() => setForm(f => ({ ...f, tipo_recompensa: 'desconto_valor' }))}
                    />
                    <div className={styles.ruleOptionBody}>
                      <span className={styles.ruleOptionTitle}>Desconto em valor (R$)</span>
                      <span className={styles.ruleOptionDesc}>
                        Aplica um desconto fixo em reais na próxima fatura do cliente indicador.
                      </span>
                    </div>
                  </label>
                  <label className={`${styles.ruleOption} ${form.tipo_recompensa === 'remover_fatura' ? styles.ruleOptionActive : ''}`}>
                    <input
                      type="radio"
                      name="form_tipo_recompensa"
                      value="remover_fatura"
                      checked={form.tipo_recompensa === 'remover_fatura'}
                      onChange={() => setForm(f => ({ ...f, tipo_recompensa: 'remover_fatura' }))}
                    />
                    <div className={styles.ruleOptionBody}>
                      <span className={styles.ruleOptionTitle}>Remover uma fatura</span>
                      <span className={styles.ruleOptionDesc}>
                        Zera a próxima fatura pendente do cliente indicador.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {form.tipo_recompensa === 'desconto_valor' && (
                <div className={styles.formGroup}>
                  <label>Valor do Desconto (R$)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Usa o valor padrão das configurações se vazio"
                    value={form.valor_desconto}
                    onChange={e => setForm(f => ({ ...f, valor_desconto: e.target.value }))}
                  />
                </div>
              )}

              <div className={styles.formGroup}>
                <label>Regra para liberar a recompensa *</label>
                <div className={styles.ruleOptions}>
                  <label className={`${styles.ruleOption} ${form.regra_ativacao === 'ativacao' ? styles.ruleOptionActive : ''}`}>
                    <input
                      type="radio"
                      name="form_regra_ativacao"
                      value="ativacao"
                      checked={form.regra_ativacao === 'ativacao'}
                      onChange={() => setForm(f => ({ ...f, regra_ativacao: 'ativacao' }))}
                    />
                    <div className={styles.ruleOptionBody}>
                      <span className={styles.ruleOptionTitle}>Quando ativar o serviço</span>
                      <span className={styles.ruleOptionDesc}>
                        O desconto é aplicado assim que o indicado ativar o serviço.
                      </span>
                    </div>
                  </label>
                  <label className={`${styles.ruleOption} ${form.regra_ativacao === 'primeira_fatura_paga' ? styles.ruleOptionActive : ''}`}>
                    <input
                      type="radio"
                      name="form_regra_ativacao"
                      value="primeira_fatura_paga"
                      checked={form.regra_ativacao === 'primeira_fatura_paga'}
                      onChange={() => setForm(f => ({ ...f, regra_ativacao: 'primeira_fatura_paga' }))}
                    />
                    <div className={styles.ruleOptionBody}>
                      <span className={styles.ruleOptionTitle}>Quando pagar a primeira fatura</span>
                      <span className={styles.ruleOptionDesc}>
                        O desconto só é aplicado quando o indicado pagar sua primeira fatura.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className={styles.infoBox}>
                <AlertCircle size={14} />
                <span>
                  Use o <strong>ID do Prospecto</strong> no Hubsoft para o indicado. Por padrão, esses campos vêm
                  preenchidos com as <strong>Configurações</strong> globais, mas podem ser alterados só para esta indicação.
                </span>
              </div>

              {saveError && (
                <div className={styles.errorBox}>
                  <AlertCircle size={14} />
                  {saveError}
                </div>
              )}

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={saving}>
                  {saving ? 'Salvando...' : 'Registrar Indicação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edição */}
      {showEditModal && editForm && (
        <div className={styles.overlay} onClick={() => setShowEditModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Editar Indicação #{editingId}</h2>
              <button className={styles.modalClose} onClick={() => setShowEditModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className={styles.modalBody}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Cód. do Indicador (Hubsoft) *</label>
                  <input
                    type="number"
                    required
                    value={editForm.cod_cliente_indicador}
                    onChange={e => {
                      const val = e.target.value;
                      setEditForm(f => ({ ...f, cod_cliente_indicador: val }));
                      fetchClienteEdit(val);
                    }}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>
                    Nome do Indicador
                    {editLookupIndicador.loading && <span className={styles.lookupHint}> buscando...</span>}
                    {editLookupIndicador.error   && <span className={styles.lookupError}> {editLookupIndicador.error}</span>}
                  </label>
                  <input
                    type="text"
                    value={editForm.nome_indicador}
                    onChange={e => setEditForm(f => ({ ...f, nome_indicador: e.target.value }))}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>ID do Prospecto (Hubsoft)</label>
                  <input
                    type="number"
                    value={editForm.id_prospecto_indicado}
                    onChange={e => {
                      const val = e.target.value;
                      setEditForm(f => ({ ...f, id_prospecto_indicado: val }));
                      fetchProspectoEdit(val);
                    }}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>
                    Nome do Indicado
                    {editLookupIndicado.loading && <span className={styles.lookupHint}> buscando...</span>}
                    {editLookupIndicado.error   && <span className={styles.lookupError}> {editLookupIndicado.error}</span>}
                  </label>
                  <input
                    type="text"
                    value={editForm.nome_indicado}
                    onChange={e => setEditForm(f => ({ ...f, nome_indicado: e.target.value }))}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Status *</label>
                  <select
                    required
                    className={styles.select}
                    value={editForm.status}
                    onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Valor do Desconto (R$)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={editForm.valor_desconto}
                    onChange={e => setEditForm(f => ({ ...f, valor_desconto: e.target.value }))}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Tipo de recompensa</label>
                  <select
                    className={styles.select}
                    value={editForm.tipo_recompensa}
                    onChange={e => setEditForm(f => ({ ...f, tipo_recompensa: e.target.value }))}
                  >
                    <option value="desconto_valor">Desconto em valor (R$)</option>
                    <option value="remover_fatura">Remover uma fatura</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Regra de liberação</label>
                  <select
                    className={styles.select}
                    value={editForm.regra_ativacao}
                    onChange={e => setEditForm(f => ({ ...f, regra_ativacao: e.target.value }))}
                  >
                    <option value="ativacao">Quando ativar o serviço</option>
                    <option value="primeira_fatura_paga">Quando pagar a primeira fatura</option>
                  </select>
                </div>
              </div>

              {editError && (
                <div className={styles.errorBox}>
                  <AlertCircle size={14} />
                  {editError}
                </div>
              )}

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowEditModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={editSaving}>
                  {editSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
