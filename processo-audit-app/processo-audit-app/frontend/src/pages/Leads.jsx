import React, { useState, useEffect, useRef } from 'react';
import { referralAPI } from '../api';
import styles from './Leads.module.css';

/* ── Helpers ── */
const parseEndereco = (str) => {
  if (!str) return { logradouro: '', bairro: '', cidade: '', estado: '' };
  const [before, after] = str.split(' - ');
  const afterParts = (after || '').split(',');
  const bairro = afterParts[0]?.trim() || '';
  const cidadeEstado = afterParts[1]?.trim() || '';
  const [cidade, estado] = cidadeEstado.split('/');
  return { logradouro: before?.trim() || '', bairro, cidade: cidade?.trim() || '', estado: estado?.trim() || '' };
};

const fmt = (d) => {
  if (!d) return '—';
  return new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR');
};

const toTitleCase = (str) => {
  if (!str) return '';
  if (str === str.toUpperCase()) return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  return str;
};

/* ── Sub-components ── */
const STATUS_LABELS = {
  pendente: 'Pendente',
  ativo: 'Ativo',
  cancelado: 'Cancelado',
  encaminhado: 'Encaminhado',
  manual: 'Manual',
};

const StatusBadge = ({ status }) => (
  <span className={`${styles.badge} ${styles['status_' + status]}`}>
    {STATUS_LABELS[status] ?? status}
  </span>
);

const BoletoStatus = ({ lead }) => {
  const pago = lead.data_pagamento_primeiro_boleto;
  const venc = lead.data_vencimento_primeiro_boleto;

  if (pago) return <span className={styles.boletoPago}>Pago em {fmt(pago)}</span>;
  if (lead.pagou_primeiro_boleto) return <span className={styles.boletoPago}>Pago</span>;
  if (!venc) return <span className={styles.boletoNone}>—</span>;

  const toDate = d => new Date(String(d).slice(0, 10) + 'T12:00:00');
  return toDate(venc) < new Date()
    ? <span className={styles.boletoVencido}>Venceu {fmt(venc)}</span>
    : <span className={styles.boletoPendente}>Vence {fmt(venc)}</span>;
};

// Status da fatura vigente (a de vencimento mais recente no Hubsoft), diferente do 1º boleto:
// só aparece "Pago em" quando a fatura teve baixa de fato (data_pagamento preenchida).
const FaturaAtualStatus = ({ lead }) => {
  const { fatura_atual_status: status, fatura_atual_vencimento: venc, fatura_atual_baixa: baixa } = lead;

  if (!status) return <span className={styles.boletoNone}>—</span>;
  if (status === 'pago') return <span className={styles.boletoPago}>Pago em {fmt(baixa)}</span>;
  if (status === 'vencido') return <span className={styles.boletoVencido}>Venceu {fmt(venc)}</span>;
  return <span className={styles.boletoPendente}>Vence {fmt(venc)}</span>;
};

const ActionsMenu = ({ lead, onView, onSendCRM }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className={styles.menuWrap} ref={ref}>
      <button
        className={styles.menuTrigger}
        onClick={() => setOpen(v => !v)}
        aria-label="Abrir menu de ações"
      >
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {open && (
        <div className={styles.menuDropdown}>
          <button className={styles.menuItem} onClick={() => { setOpen(false); onView(); }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Ver detalhes
          </button>
          {lead.status === 'pendente' && (
            <button className={`${styles.menuItem} ${styles.menuItemCRM}`} onClick={() => { setOpen(false); onSendCRM(); }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Enviar para CRM
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Main Component ── */
const Leads = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [crms, setCrms] = useState([]);
  const [showCrmModal, setShowCrmModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [crmForm, setCrmForm] = useState({ id_crm: '', observacao: '' });
  const [submitting, setSubmitting] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detailLead, setDetailLead] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null);
  const [searchIndicadorId, setSearchIndicadorId] = useState('');

  useEffect(() => { fetchLeads(); fetchCRMs(); }, []);

  const fetchLeads = async () => {
    try { setLeads(await referralAPI.getLeads()); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchCRMs = async () => {
    try {
      const data = await referralAPI.getHubsoftCRMs();
      setCrms(Array.isArray(data) ? data : []);
    } catch { setCrms([]); }
  };

  const handleOpenCRM = (lead) => { setSelectedLead(lead); setCrmForm({ id_crm: '', observacao: '' }); setShowCrmModal(true); };
  const handleOpenDetail = (lead) => { setDetailLead(lead); setShowDetail(true); };

  const handleSendToCRM = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await referralAPI.sendLeadToCRM({ id_indicacao: selectedLead.id, id_crm: crmForm.id_crm, observacao: crmForm.observacao });
      setShowCrmModal(false);
      fetchLeads();
    } catch (err) { alert('Erro: ' + err.message); }
    finally { setSubmitting(false); }
  };

  /* Stats */
  const stats = {
    total: leads.length,
    pendente:    leads.filter(l => l.status === 'pendente').length,
    encaminhado: leads.filter(l => l.status === 'encaminhado').length,
    ativo:       leads.filter(l => l.status === 'ativo').length,
    cancelado:   leads.filter(l => l.status === 'cancelado').length,
    manual:      leads.filter(l => l.status === 'manual').length,
  };

  const searchId = searchIndicadorId.trim();
  const filteredLeads = leads
    .filter(l => activeFilter ? l.status === activeFilter : true)
    .filter(l => searchId ? String(l.cod_cliente_indicador ?? '') === searchId : true);

  const indicadorEncontrado = searchId
    ? leads.find(l => String(l.cod_cliente_indicador ?? '') === searchId)?.nome_indicador
    : null;

  const handleFilterClick = (filter) =>
    setActiveFilter(prev => (prev === filter ? null : filter));

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className="spinner" />
        <span>Carregando leads…</span>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Gestão de Leads</h1>
          <p className={styles.subtitle}>Indicações recebidas pelo portal público</p>
        </div>
        <div className={styles.stats}>
          <button
            className={`${styles.statItem} ${activeFilter === null ? styles.statActive : ''}`}
            onClick={() => setActiveFilter(null)}
          >
            <span className={styles.statValue}>{stats.total}</span>
            <span className={styles.statLabel}>Total</span>
          </button>
          <button
            className={`${styles.statItem} ${styles.statPendente} ${activeFilter === 'pendente' ? styles.statActive : ''}`}
            onClick={() => handleFilterClick('pendente')}
          >
            <span className={styles.statValue}>{stats.pendente}</span>
            <span className={styles.statLabel}>Pendentes</span>
          </button>
          <button
            className={`${styles.statItem} ${styles.statEncaminhado} ${activeFilter === 'encaminhado' ? styles.statActive : ''}`}
            onClick={() => handleFilterClick('encaminhado')}
          >
            <span className={styles.statValue}>{stats.encaminhado}</span>
            <span className={styles.statLabel}>Encaminhados</span>
          </button>
          <button
            className={`${styles.statItem} ${styles.statAtivo} ${activeFilter === 'ativo' ? styles.statActive : ''}`}
            onClick={() => handleFilterClick('ativo')}
          >
            <span className={styles.statValue}>{stats.ativo}</span>
            <span className={styles.statLabel}>Ativos</span>
          </button>
          {stats.cancelado > 0 && (
            <button
              className={`${styles.statItem} ${styles.statCancelado} ${activeFilter === 'cancelado' ? styles.statActive : ''}`}
              onClick={() => handleFilterClick('cancelado')}
            >
              <span className={styles.statValue}>{stats.cancelado}</span>
              <span className={styles.statLabel}>Cancelados</span>
            </button>
          )}
          {stats.manual > 0 && (
            <button
              className={`${styles.statItem} ${styles.statManual} ${activeFilter === 'manual' ? styles.statActive : ''}`}
              onClick={() => handleFilterClick('manual')}
            >
              <span className={styles.statValue}>{stats.manual}</span>
              <span className={styles.statLabel}>Manuais</span>
            </button>
          )}
        </div>
      </div>

      {/* Search by indicador ID */}
      <div className={styles.searchBar}>
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M18 11a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Buscar por ID do indicador (ex: 6989)"
          value={searchIndicadorId}
          onChange={(e) => setSearchIndicadorId(e.target.value)}
          className={styles.searchInput}
        />
        {searchId && (
          indicadorEncontrado
            ? <span className={styles.searchResult}>Indicador: {toTitleCase(indicadorEncontrado)}</span>
            : <span className={styles.searchResultEmpty}>Nenhum indicador com esse ID</span>
        )}
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
        {filteredLeads.length === 0 ? (
          <div className={styles.emptyRow}>
            <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{opacity:0.3}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            {activeFilter ? `Nenhum lead com status "${STATUS_LABELS[activeFilter]}"` : 'Nenhum lead encontrado'}
          </div>
        ) : (
          <>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.colName}>Indicado</th>
                    <th className={styles.colCpf}>CPF</th>
                    <th className={styles.colPhone}>Telefone</th>
                    <th className={styles.colBairro}>Bairro</th>
                    <th className={styles.colIndicador}>Indicador</th>
                    <th className={styles.colDate}>Data</th>
                    <th className={styles.colStatus}>Status</th>
                    <th className={styles.colBoleto}>1º Boleto</th>
                    <th className={styles.colBoleto}>Fatura Atual</th>
                    <th className={styles.colActions}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map(lead => {
                    const { bairro } = parseEndereco(lead.endereco_indicado);
                    return (
                      <tr key={lead.id}>
                        <td className={styles.colName}>
                          <button className={styles.nameLink} onClick={() => handleOpenDetail(lead)}>
                            {toTitleCase(lead.nome_indicado)}
                          </button>
                        </td>
                        <td className={styles.colCpf}>
                          <span className={styles.mono}>{lead.cpf_indicado || '—'}</span>
                        </td>
                        <td className={styles.colPhone}>
                          <span className={styles.mono}>{lead.telefone_indicado || '—'}</span>
                        </td>
                        <td className={styles.colBairro}>
                          <span className={styles.muted}>{toTitleCase(bairro) || '—'}</span>
                        </td>
                        <td className={styles.colIndicador}>
                          {toTitleCase(lead.nome_indicador)}
                        </td>
                        <td className={styles.colDate}>
                          <span className={styles.muted}>{new Date(lead.created_at).toLocaleDateString('pt-BR')}</span>
                        </td>
                        <td className={styles.colStatus}>
                          <StatusBadge status={lead.status} />
                        </td>
                        <td className={styles.colBoleto}>
                          <BoletoStatus lead={lead} />
                        </td>
                        <td className={styles.colBoleto}>
                          <FaturaAtualStatus lead={lead} />
                        </td>
                        <td className={styles.colActions}>
                          <ActionsMenu
                            lead={lead}
                            onView={() => handleOpenDetail(lead)}
                            onSendCRM={() => handleOpenCRM(lead)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className={styles.cardList}>
              {filteredLeads.map(lead => {
                const { bairro } = parseEndereco(lead.endereco_indicado);
                return (
                  <div key={lead.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <button className={styles.nameLink} onClick={() => handleOpenDetail(lead)}>
                        {toTitleCase(lead.nome_indicado)}
                      </button>
                      <div className={styles.cardTopRight}>
                        <StatusBadge status={lead.status} />
                        <ActionsMenu
                          lead={lead}
                          onView={() => handleOpenDetail(lead)}
                          onSendCRM={() => handleOpenCRM(lead)}
                        />
                      </div>
                    </div>

                    <div className={styles.cardMeta}>
                      <div className={styles.cardMetaItem}>
                        <span className={styles.cardLabel}>CPF</span>
                        <span className={styles.mono}>{lead.cpf_indicado || '—'}</span>
                      </div>
                      <div className={styles.cardMetaItem}>
                        <span className={styles.cardLabel}>Telefone</span>
                        <span className={styles.mono}>{lead.telefone_indicado || '—'}</span>
                      </div>
                      <div className={styles.cardMetaItem}>
                        <span className={styles.cardLabel}>Bairro</span>
                        <span className={styles.muted}>{toTitleCase(bairro) || '—'}</span>
                      </div>
                      <div className={styles.cardMetaItem}>
                        <span className={styles.cardLabel}>Indicador</span>
                        <span>{toTitleCase(lead.nome_indicador)}</span>
                      </div>
                      <div className={styles.cardMetaItem}>
                        <span className={styles.cardLabel}>Data</span>
                        <span className={styles.muted}>{new Date(lead.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div className={styles.cardMetaItem}>
                        <span className={styles.cardLabel}>1º Boleto</span>
                        <BoletoStatus lead={lead} />
                      </div>
                      <div className={styles.cardMetaItem}>
                        <span className={styles.cardLabel}>Fatura Atual</span>
                        <FaturaAtualStatus lead={lead} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Detail Drawer ── */}
      {showDetail && detailLead && (() => {
        const addr = parseEndereco(detailLead.endereco_indicado);
        return (
          <div className={styles.overlay} onClick={() => setShowDetail(false)}>
            <div className={styles.detailModal} onClick={e => e.stopPropagation()}>
              <div className={styles.detailHeader}>
                <div className={styles.detailHeaderLeft}>
                  <div className={styles.detailAvatar}>
                    {toTitleCase(detailLead.nome_indicado).charAt(0)}
                  </div>
                  <div>
                    <h2 className={styles.detailName}>{toTitleCase(detailLead.nome_indicado)}</h2>
                    <div className={styles.detailMeta}>
                      <span className={styles.mono}>{detailLead.cpf_indicado}</span>
                      <StatusBadge status={detailLead.status} />
                    </div>
                  </div>
                </div>
                <button className={styles.btnClose} onClick={() => setShowDetail(false)}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className={styles.detailBody}>
                <Section title="Contato">
                  <Row label="Telefone" value={detailLead.telefone_indicado} mono />
                  <Row label="CPF" value={detailLead.cpf_indicado} mono />
                </Section>

                <Section title="Endereço">
                  <Row label="Logradouro" value={addr.logradouro} />
                  <Row label="Bairro" value={toTitleCase(addr.bairro)} />
                  <Row label="Cidade" value={`${toTitleCase(addr.cidade)}${addr.estado ? ' / ' + addr.estado : ''}`} />
                </Section>

                <Section title="Indicação">
                  <Row label="Indicado por" value={toTitleCase(detailLead.nome_indicador)} />
                  <Row label="Cód. Indicador" value={detailLead.cod_cliente_indicador} mono />
                  <Row label="Cadastro" value={fmt(detailLead.created_at)} />
                  <Row label="Atualização" value={fmt(detailLead.updated_at)} />
                  {detailLead.id_crm_destino && <Row label="CRM Destino" value={`#${detailLead.id_crm_destino}`} mono />}
                </Section>

                <Section title="Pagamento">
                  <Row label="1º Boleto Pago" value={detailLead.pagou_primeiro_boleto ? 'Sim' : 'Não'} />
                  {detailLead.data_vencimento_primeiro_boleto && <Row label="Vencimento" value={fmt(detailLead.data_vencimento_primeiro_boleto)} />}
                  {detailLead.data_pagamento_primeiro_boleto && <Row label="Data Pagamento" value={fmt(detailLead.data_pagamento_primeiro_boleto)} />}
                  {detailLead.valor_desconto != null && (
                    <Row label="Desconto" value={`R$ ${parseFloat(detailLead.valor_desconto).toFixed(2).replace('.', ',')}`} />
                  )}
                  {detailLead.fatura_referencia && <Row label="Fatura Referência" value={detailLead.fatura_referencia} mono />}
                  {detailLead.id_evento_faturamento && <Row label="Evento Faturamento" value={`#${detailLead.id_evento_faturamento}`} mono />}
                </Section>

                <Section title="Fatura Atual">
                  {detailLead.fatura_atual_status ? (
                    <>
                      <Row label="Vencimento" value={fmt(detailLead.fatura_atual_vencimento)} />
                      <Row
                        label="Status"
                        value={{ pago: 'Pago', vencido: 'Vencido', aguardando: 'Aguardando' }[detailLead.fatura_atual_status]}
                      />
                      {detailLead.fatura_atual_baixa && <Row label="Baixa" value={fmt(detailLead.fatura_atual_baixa)} />}
                    </>
                  ) : (
                    <Row label="Status" value="Sem dado disponível no Hubsoft" />
                  )}
                </Section>
              </div>

              {detailLead.status === 'pendente' && (
                <div className={styles.detailFooter}>
                  <button className={styles.btnCRMPrimary} onClick={() => { setShowDetail(false); handleOpenCRM(detailLead); }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Enviar para CRM
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── CRM Modal ── */}
      {showCrmModal && (
        <div className={styles.overlay} onClick={() => setShowCrmModal(false)}>
          <div className={styles.crmModal} onClick={e => e.stopPropagation()}>
            <div className={styles.crmModalHeader}>
              <h2 className={styles.crmModalTitle}>Enviar para CRM</h2>
              <button className={styles.btnClose} onClick={() => setShowCrmModal(false)}>
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className={styles.crmLeadTag}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {toTitleCase(selectedLead?.nome_indicado)}
            </div>

            <form onSubmit={handleSendToCRM} className={styles.crmForm}>
              <div className={styles.formGroup}>
                <label>Quadro CRM</label>
                <select value={crmForm.id_crm} onChange={(e) => setCrmForm({...crmForm, id_crm: e.target.value})} required>
                  <option value="">Selecione um quadro…</option>
                  {crms.map(crm => <option key={crm.id_crm} value={crm.id_crm}>{crm.nome}</option>)}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Observação <span className={styles.optLabel}>(opcional)</span></label>
                <textarea
                  value={crmForm.observacao}
                  onChange={(e) => setCrmForm({...crmForm, observacao: e.target.value})}
                  placeholder="Instruções para o vendedor…"
                  rows="3"
                />
              </div>

              <div className={styles.crmModalFooter}>
                <button type="button" onClick={() => setShowCrmModal(false)} className={styles.btnCancel}>
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className={styles.btnCRMPrimary}>
                  {submitting ? 'Enviando…' : 'Confirmar Envio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Detail helpers ── */
const Section = ({ title, children }) => (
  <section className={styles.detailSection}>
    <h3 className={styles.detailSectionTitle}>{title}</h3>
    <dl className={styles.detailList}>{children}</dl>
  </section>
);

const Row = ({ label, value, mono }) => (
  <div className={styles.detailRow}>
    <dt>{label}</dt>
    <dd className={mono ? styles.mono : ''}>{value || '—'}</dd>
  </div>
);

export default Leads;
