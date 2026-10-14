import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, X, Search, RefreshCw, AlertCircle, ChevronDown, ChevronRight, Globe, User, Webhook, RotateCw } from 'lucide-react';
import { referralAPI } from '../api';
import DateInput from '../components/DateInput';
import styles from './Referral.module.css';
import a from './AuditoriaIndicacoes.module.css';

// Atalhos de filtro por tipo de ação (os códigos vêm de src/services/referral/auditoria.js)
const GRUPOS = [
  { id: 'novas',      label: 'Novas',          acoes: ['recebida', 'criada'] },
  { id: 'edicoes',    label: 'Edições',        acoes: ['editada', 'encaminhada_crm'] },
  { id: 'cancel',     label: 'Cancelamentos',  acoes: ['cancelada'] },
  { id: 'exclusoes',  label: 'Exclusões',      acoes: ['excluida', 'etapa_crm_removida'] },
  { id: 'descontos',  label: 'Descontos e pagamentos', acoes: ['desconto_aplicado', 'desconto_manual', 'aguardando_pagamento', 'pagamento_registrado', 'fatura_atualizada'] },
  { id: 'config',     label: 'Configuração',   acoes: ['config_alterada', 'etapa_crm_adicionada', 'etapa_crm_removida'] },
  { id: 'aberturas',  label: 'Leads abertos',  acoes: ['visualizada'] },
  { id: 'recusadas',  label: 'Recusadas',      acoes: ['recusada_portal', 'acao_recusada', 'webhook_rejeitado'] },
  { id: 'webhooks',   label: 'Webhooks recusados/erro', acoes: ['webhook_rejeitado', 'webhook_erro'] },
];

const TOM = {
  recebida: 'novo', criada: 'novo',
  editada: 'edicao', encaminhada_crm: 'edicao', config_alterada: 'edicao', etapa_crm_adicionada: 'edicao', fatura_atualizada: 'edicao',
  cancelada: 'alerta', webhook_rejeitado: 'alerta', webhook_erro: 'alerta', recusada_portal: 'alerta', acao_recusada: 'alerta',
  excluida: 'perigo', etapa_crm_removida: 'perigo',
  desconto_aplicado: 'dinheiro', desconto_manual: 'dinheiro', pagamento_registrado: 'dinheiro', aguardando_pagamento: 'dinheiro',
};

const ORIGEM_ICONE = { painel: User, portal_publico: Globe, webhook_hubsoft: Webhook, sincronizacao_hubsoft: RotateCw };
const ORIGEM_CURTA = { painel: 'Painel', portal_publico: 'Portal público', webhook_hubsoft: 'Webhook Hubsoft', sincronizacao_hubsoft: 'Sincronização Hubsoft' };

const CAMPOS = {
  cod_cliente_indicador: 'Cód. indicador', nome_indicador: 'Indicador', id_prospecto_indicado: 'Prospecto',
  cod_cliente_indicado: 'Cód. indicado', nome_indicado: 'Indicado', valor_desconto: 'Valor do desconto',
  status: 'Status', regra_ativacao: 'Regra de ativação', tipo_recompensa: 'Recompensa',
  pagou_primeiro_boleto: '1º boleto pago', data_pagamento_primeiro_boleto: 'Data do 1º pagamento',
  id_crm_destino: 'CRM de destino', desconto_valor: 'Desconto padrão (R$)',
  fatura_atual_status: 'Situação da fatura atual', fatura_atual_vencimento: 'Vencimento da fatura atual', fatura_atual_baixa: 'Baixa da fatura atual',
};

const FILTRO_VAZIO = { acao: '', origem: '', usuario_id: '', id_indicacao: '', ip: '', de: '', ate: '', q: '' };
const POR_PAGINA = 50;

const fmtDataHora = (v) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }) : '—');
const fmtValor = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return fmtDataHora(v);
  return String(v);
};

function Detalhes({ item, onFiltrarIndicacao, onFiltrarIp }) {
  const campos = item.campos_alterados ? item.campos_alterados.split(',') : [];
  return (
    <div className={a.detalhes}>
      {campos.length > 0 && (
        <table className={a.diff}>
          <thead><tr><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead>
          <tbody>
            {campos.map(c => (
              <tr key={c}>
                <td>{CAMPOS[c] ?? c}</td>
                <td className={a.antes}>{fmtValor(item.dados_antes?.[c])}</td>
                <td className={a.depois}>{fmtValor(item.dados_depois?.[c])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {campos.length === 0 && item.dados_antes && (
        <div className={a.bloco}>
          <span className={a.blocoTitulo}>{item.acao === 'excluida' ? 'Dados apagados' : 'Antes'}</span>
          <pre className={a.json}>{JSON.stringify(item.dados_antes, null, 2)}</pre>
        </div>
      )}
      {campos.length === 0 && item.dados_depois && (
        <div className={a.bloco}>
          <span className={a.blocoTitulo}>{item.origem === 'webhook_hubsoft' ? 'O que chegou do Hubsoft' : 'Dados registrados'}</span>
          <pre className={a.json}>{JSON.stringify(item.dados_depois, null, 2)}</pre>
        </div>
      )}
      <dl className={a.meta}>
        <dt>Registro</dt><dd>#{item.id} · {fmtDataHora(item.created_at)}</dd>
        <dt>Origem</dt><dd>{ORIGEM_CURTA[item.origem] ?? item.origem}</dd>
        <dt>Usuário</dt><dd>{item.usuario_nome || item.usuario_email ? `${item.usuario_nome ?? ''} ${item.usuario_email ? `<${item.usuario_email}>` : ''}` : 'Sistema (sem usuário logado)'}</dd>
        <dt>IP</dt>
        <dd>
          {item.ip ? <button type="button" className={a.link} onClick={() => onFiltrarIp(item.ip)}>{item.ip}</button> : '—'}
          {item.ip_cadeia && <span className={a.cadeia}> (cadeia: {item.ip_cadeia})</span>}
        </dd>
        <dt>Navegador</dt><dd className={a.ua}>{item.user_agent || '—'}</dd>
        {item.id_indicacao && (
          <>
            <dt>Indicação</dt>
            <dd><button type="button" className={a.link} onClick={() => onFiltrarIndicacao(item.id_indicacao)}>ver tudo da indicação #{item.id_indicacao}</button></dd>
          </>
        )}
      </dl>
    </div>
  );
}

export default function AuditoriaIndicacoes({ onClose }) {
  const [filtro, setFiltro]   = useState(FILTRO_VAZIO);
  const [busca, setBusca]     = useState('');
  const [pagina, setPagina]   = useState(1);
  const [dados, setDados]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [aberto, setAberto]   = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDados(await referralAPI.getAuditoria({ ...filtro, pagina, por_pagina: POR_PAGINA }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filtro, pagina]);

  useEffect(() => { carregar(); }, [carregar]);

  // a busca em texto só dispara depois que a pessoa para de digitar
  useEffect(() => {
    const t = setTimeout(() => setFiltro(f => (f.q === busca ? f : { ...f, q: busca })), 400);
    return () => clearTimeout(t);
  }, [busca]);
  useEffect(() => { setPagina(1); }, [filtro]);

  const muda = (campo) => (e) => setFiltro(f => ({ ...f, [campo]: e.target.value }));
  const grupoAtivo = GRUPOS.find(g => g.acoes.join(',') === filtro.acao)?.id ?? (filtro.acao ? 'especifica' : '');
  const temFiltro = Object.entries(filtro).some(([, v]) => v !== '');
  const total = dados?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${a.painel}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2><ShieldCheck size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} />Auditoria — Indique e Ganhe</h2>
          <button className={styles.modalClose} onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>

        <div className={a.filtros}>
          <div className={a.grupos} role="group" aria-label="Tipo de ação">
            <button type="button" className={`${styles.filterTab} ${grupoAtivo === '' ? styles.filterTabActive : ''}`}
              onClick={() => setFiltro(f => ({ ...f, acao: '' }))}>Todas</button>
            {GRUPOS.map(g => (
              <button key={g.id} type="button" className={`${styles.filterTab} ${grupoAtivo === g.id ? styles.filterTabActive : ''}`}
                onClick={() => setFiltro(f => ({ ...f, acao: g.acoes.join(',') }))}>{g.label}</button>
            ))}
          </div>

          <div className={a.linha}>
            <label className={a.campo}>
              <span>Ação específica</span>
              <select className={styles.select} value={grupoAtivo === 'especifica' ? filtro.acao : ''} onChange={muda('acao')}>
                <option value="">—</option>
                {Object.entries(dados?.acoes ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className={a.campo}>
              <span>De onde veio</span>
              <select className={styles.select} value={filtro.origem} onChange={muda('origem')}>
                <option value="">Todas as origens</option>
                {Object.entries(dados?.origens ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className={a.campo}>
              <span>Quem fez</span>
              <select className={styles.select} value={filtro.usuario_id} onChange={muda('usuario_id')}>
                <option value="">Todos os usuários</option>
                {(dados?.usuarios ?? []).map(u => <option key={u.id} value={u.id}>{u.nome || u.email}</option>)}
              </select>
            </label>
            <label className={a.campo}>
              <span>De</span>
              <DateInput className={styles.select} value={filtro.de} max={filtro.ate || undefined} onChange={muda('de')} />
            </label>
            <label className={a.campo}>
              <span>Até</span>
              <DateInput className={styles.select} value={filtro.ate} min={filtro.de || undefined} onChange={muda('ate')} />
            </label>
            <label className={a.campo}>
              <span>IP</span>
              <input className={styles.select} value={filtro.ip} onChange={muda('ip')} placeholder="ex.: 177.10" />
            </label>
            <label className={a.campo}>
              <span>Nº indicação</span>
              <input className={styles.select} inputMode="numeric" value={filtro.id_indicacao} onChange={e => setFiltro(f => ({ ...f, id_indicacao: e.target.value.replace(/\D/g, '') }))} placeholder="#" />
            </label>
          </div>

          <div className={a.linha}>
            <div className={styles.searchWrap} style={{ flex: 1 }}>
              <Search size={15} className={styles.searchIcon} />
              <input className={styles.searchInput} placeholder="Buscar no resumo, usuário ou dados (nome, CPF, código...)"
                value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            {temFiltro && (
              <button type="button" className={styles.btnSecondary} onClick={() => { setFiltro(FILTRO_VAZIO); setBusca(''); }}>Limpar filtros</button>
            )}
            <button type="button" className={styles.btnRefresh} onClick={carregar} title="Atualizar"><RefreshCw size={15} /></button>
          </div>
        </div>

        <div className={a.lista}>
          {loading && !dados ? (
            <div className={styles.center}><div className="spinner" /></div>
          ) : error ? (
            <div className={styles.errorBox}><AlertCircle size={16} />{error}</div>
          ) : dados.itens.length === 0 ? (
            <div className={styles.empty}>
              <ShieldCheck size={36} strokeWidth={1.2} />
              <p>Nenhum registro {temFiltro ? 'com esses filtros' : 'ainda'}</p>
              <span>As ações passam a ser registradas a partir da instalação da auditoria</span>
            </div>
          ) : (
            <ul className={a.itens} style={{ opacity: loading ? 0.6 : 1 }}>
              {dados.itens.map(item => {
                const Icone = ORIGEM_ICONE[item.origem] ?? User;
                const expandido = aberto === item.id;
                return (
                  <li key={item.id} className={a.item}>
                    <button type="button" className={a.resumoLinha} onClick={() => setAberto(expandido ? null : item.id)} aria-expanded={expandido}>
                      {expandido ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      <span className={a.quando}>{fmtDataHora(item.created_at)}</span>
                      <span className={`${a.acao} ${a[TOM[item.acao] ?? 'neutro']}`}>{dados.acoes[item.acao] ?? item.acao}</span>
                      <span className={a.texto}>{item.resumo}</span>
                      <span className={a.quem}>
                        <Icone size={13} />
                        {item.usuario_nome || item.usuario_email || ORIGEM_CURTA[item.origem]}
                        {item.ip && <span className={a.ip}>{item.ip}</span>}
                      </span>
                    </button>
                    {expandido && (
                      <Detalhes
                        item={item}
                        onFiltrarIndicacao={(id) => setFiltro(f => ({ ...f, id_indicacao: String(id) }))}
                        onFiltrarIp={(ip) => setFiltro(f => ({ ...f, ip }))}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {dados && total > 0 && (
          <div className={styles.pagination}>
            <span className={styles.pageInfo}>
              {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, total)} de {total} registros
            </span>
            <div className={styles.pageControls}>
              <button className={styles.pageBtn} disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>Anterior</button>
              <button className={styles.pageBtn} disabled={pagina >= totalPaginas} onClick={() => setPagina(p => p + 1)}>Próxima</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
