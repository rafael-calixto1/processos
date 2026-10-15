import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Search, RefreshCw, Monitor, Smartphone, LogOut } from 'lucide-react';
import { authAPI } from '../api/index';
import s from './AcessosAuditoria.module.css';

// Códigos de motivo e evento vêm de src/services/acessos.js (a API devolve os rótulos)
const TOM_EVENTO = {
  login: 'ok', logout: 'neutro', login_falhou: 'perigo', login_bloqueado: 'perigo', login_negado: 'alerta',
  sessao_encerrada: 'alerta', renovacao_negada: 'alerta',
};
const TOM_MOTIVO = {
  logout: 'neutro', expirada: 'neutro', senha_alterada: 'info', usuario_inativado: 'alerta',
  encerrada_pelo_admin: 'alerta', token_reutilizado: 'perigo', acesso_removido: 'alerta',
};

const VAZIO_SESSOES = { usuario_id: '', origem: '', situacao: '', motivo: '', de: '', ate: '', ip: '' };
const VAZIO_EVENTOS = { usuario_id: '', evento: '', origem: '', de: '', ate: '', ip: '', sid: '' };
const POR_PAGINA = 50;

const fmtDataHora = (v) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }) : '—');

export const fmtDuracao = (seg) => {
  if (seg == null || Number.isNaN(Number(seg))) return '—';
  const t = Math.max(0, Math.round(Number(seg)));
  if (t < 60) return `${t} s`;
  if (t < 3600) return `${Math.floor(t / 60)} min`;
  if (t < 86400) return `${Math.floor(t / 3600)} h ${String(Math.floor((t % 3600) / 60)).padStart(2, '0')} min`;
  return `${Math.floor(t / 86400)} d ${Math.floor((t % 86400) / 3600)} h`;
};

// sid da sessão de quem está vendo (para não oferecer "Encerrar" na própria)
const meuSid = () => {
  try {
    const p = (localStorage.getItem('token') || '').split('.')[1];
    return p ? JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/'))).sid ?? null : null;
  } catch { return null; }
};

const Origem = ({ origem, dispositivo, userAgent }) => (
  <span className={s.origem} title={userAgent || ''}>
    {origem === 'app' ? <Smartphone size={14} /> : <Monitor size={14} />}
    {origem === 'app' ? `App${dispositivo ? ` · ${dispositivo}` : ''}` : 'Web'}
  </span>
);

const Ip = ({ ip, onClick }) => (ip
  ? <button type="button" className={s.ip} onClick={() => onClick(ip)} title="Filtrar por este IP">{ip}</button>
  : <span className={s.mudo}>—</span>);

function Situacao({ item, dados }) {
  if (item.encerrada_em) {
    const rotulo = dados.motivos?.[item.motivo_encerramento] ?? item.motivo_encerramento ?? 'Encerrada';
    return (
      <span className={`${s.selo} ${s[TOM_MOTIVO[item.motivo_encerramento] ?? 'neutro']}`}
        title={item.encerrada_por_nome ? `Por ${item.encerrada_por_nome}` : undefined}>
        {item.motivo_encerramento === 'encerrada_pelo_admin' && item.encerrada_por_nome
          ? `Encerrada por ${item.encerrada_por_nome}`
          : `${rotulo}${item.encerrada_por_nome && item.motivo_encerramento === 'usuario_inativado' ? ` · por ${item.encerrada_por_nome}` : ''}`}
      </span>
    );
  }
  const ociosa = item.ociosa_s ?? 0;
  return (
    <span className={`${s.selo} ${ociosa < 15 * 60 ? s.ok : s.ocioso}`}>
      Ativa · {ociosa < (dados.em_uso_s ?? 120) ? 'em uso agora' : `sem atividade há ${fmtDuracao(ociosa)}`}
    </span>
  );
}

function Campo({ rotulo, children }) {
  return <label className={s.campo}><span>{rotulo}</span>{children}</label>;
}

export default function AcessosAuditoria() {
  const [aba, setAba] = useState('sessoes');
  const [filtroS, setFiltroS] = useState(VAZIO_SESSOES);
  const [filtroE, setFiltroE] = useState(VAZIO_EVENTOS);
  const [busca, setBusca] = useState('');
  const [q, setQ] = useState('');
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const eu = meuSid();

  const filtro = aba === 'sessoes' ? filtroS : filtroE;
  const setFiltro = aba === 'sessoes' ? setFiltroS : setFiltroE;
  const muda = (k) => (e) => setFiltro((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => { const t = setTimeout(() => setQ(busca.trim()), 400); return () => clearTimeout(t); }, [busca]);
  useEffect(() => { setPagina(1); }, [aba, filtroS, filtroE, q]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setDados(await authAPI.acessos(aba, { ...filtro, q, pagina, por_pagina: POR_PAGINA }));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [aba, filtro, q, pagina]);

  useEffect(() => { carregar(); }, [carregar]);

  const trocarAba = (nova) => { setDados(null); setAba(nova); };
  const filtrarIp = (ip) => setFiltro((x) => ({ ...x, ip }));
  const verEventos = (sid) => { setFiltroE({ ...VAZIO_EVENTOS, sid }); setBusca(''); trocarAba('eventos'); };

  const encerrar = async (item) => {
    const quem = item.usuario_nome || item.usuario_email;
    if (!window.confirm(`Encerrar a sessão de ${quem}? A pessoa precisará entrar de novo.`)) return;
    try {
      await authAPI.encerrarSessao(item.sid);
      setAviso(`Sessão de ${quem} encerrada`);
      setTimeout(() => setAviso(''), 4000);
      carregar();
    } catch (err) {
      setError(err.message);
    }
  };

  const vazioFiltro = aba === 'sessoes' ? VAZIO_SESSOES : VAZIO_EVENTOS;
  const temFiltro = q || Object.keys(vazioFiltro).some((k) => filtro[k] !== vazioFiltro[k]);
  const total = dados?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <section className={s.painel} aria-label="Auditoria de acessos">
      <div className={s.topo}>
        <div className={s.abas} role="tablist">
          <button type="button" role="tab" aria-selected={aba === 'sessoes'} className={`${s.chip} ${aba === 'sessoes' ? s.chipAtivo : ''}`} onClick={() => trocarAba('sessoes')}>Sessões</button>
          <button type="button" role="tab" aria-selected={aba === 'eventos'} className={`${s.chip} ${aba === 'eventos' ? s.chipAtivo : ''}`} onClick={() => trocarAba('eventos')}>Logins, logouts e tentativas</button>
        </div>
        {aba === 'sessoes' && dados?.ativas != null && (
          <span className={s.resumo}><b>{dados.ativas}</b> {dados.ativas === 1 ? 'sessão ativa' : 'sessões ativas'} agora</span>
        )}
      </div>

      <div className={s.filtros}>
        <div className={s.linha}>
          <Campo rotulo="Usuário">
            <select value={filtro.usuario_id} onChange={muda('usuario_id')}>
              <option value="">Todos</option>
              {(dados?.usuarios ?? []).map((u) => <option key={u.id} value={u.id}>{u.nome || u.email}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Onde">
            <select value={filtro.origem} onChange={muda('origem')}>
              <option value="">Web e app</option>
              <option value="web">Web</option>
              <option value="app">App</option>
            </select>
          </Campo>
          {aba === 'sessoes' ? (
            <>
              <Campo rotulo="Situação">
                <select value={filtroS.situacao} onChange={muda('situacao')}>
                  <option value="">Todas</option>
                  <option value="ativa">Ativas</option>
                  <option value="em_uso">Em uso agora</option>
                  <option value="sem_atividade">Sem atividade</option>
                  <option value="encerrada">Encerradas</option>
                </select>
              </Campo>
              <Campo rotulo="Por que encerrou">
                <select value={filtroS.motivo} onChange={muda('motivo')}>
                  <option value="">Qualquer motivo</option>
                  {Object.entries(dados?.motivos ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Campo>
            </>
          ) : (
            <Campo rotulo="Evento">
              <select value={filtroE.evento} onChange={muda('evento')}>
                <option value="">Todos</option>
                {Object.entries(dados?.eventos ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
          )}
          <Campo rotulo="De"><input type="date" value={filtro.de} onChange={muda('de')} /></Campo>
          <Campo rotulo="Até"><input type="date" value={filtro.ate} onChange={muda('ate')} /></Campo>
          <Campo rotulo="IP"><input value={filtro.ip} onChange={muda('ip')} placeholder="ex.: 10.100" /></Campo>
        </div>
        <div className={s.linha}>
          <div className={s.busca}>
            <Search size={15} />
            <input placeholder={aba === 'sessoes' ? 'Buscar por nome, e-mail, aparelho ou navegador' : 'Buscar por nome, e-mail digitado, detalhe ou navegador'}
              value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          {aba === 'eventos' && filtroE.sid && (
            <span className={s.filtroSessao}>Só os eventos de uma sessão
              <button type="button" onClick={() => setFiltroE((x) => ({ ...x, sid: '' }))} aria-label="Ver todos os eventos">✕</button>
            </span>
          )}
          {temFiltro && (
            <button type="button" className={s.btn} onClick={() => { setFiltro(vazioFiltro); setBusca(''); }}>Limpar filtros</button>
          )}
          <button type="button" className={s.btn} onClick={carregar} title="Atualizar" aria-label="Atualizar"><RefreshCw size={15} /></button>
        </div>
      </div>

      {aviso && <div className={s.aviso} role="status">{aviso}</div>}

      {!dados ? (
        error && !loading ? <div className={s.erro}>{error}</div> : <div className={s.vazio}><div className="spinner" /></div>
      ) : dados.itens.length === 0 ? (
        <div className={s.vazio}>
          <ShieldCheck size={36} strokeWidth={1.2} />
          <p>Nenhum registro {temFiltro ? 'com esses filtros' : 'ainda'}</p>
          <span>Os acessos passam a ser registrados a partir da instalação da auditoria</span>
        </div>
      ) : (
        <div className={s.tabelaWrap} style={{ opacity: loading ? 0.6 : 1 }}>
          {error && <div className={s.erro}>{error}</div>}
          {aba === 'sessoes' ? (
            <table className={s.tabela}>
              <thead>
                <tr><th>Usuário</th><th>Onde e IP</th><th>Entrou</th><th>Saiu</th><th>Tempo</th><th>Situação</th><th><span className={s.oculto}>Ações</span></th></tr>
              </thead>
              <tbody>
                {dados.itens.map((i) => (
                  <tr key={i.id}>
                    <td data-label="Usuário"><b>{i.usuario_nome || '—'}</b><small>{i.usuario_email}</small></td>
                    <td data-label="Onde e IP">
                      <Origem origem={i.origem} dispositivo={i.dispositivo} userAgent={i.user_agent} />
                      <small><Ip ip={i.ip} onClick={filtrarIp} />
                        {i.ultimo_ip && i.ultimo_ip !== i.ip && <> → <Ip ip={i.ultimo_ip} onClick={filtrarIp} /></>}</small>
                    </td>
                    <td data-label="Entrou" className={s.num}>{fmtDataHora(i.iniciada_em)}</td>
                    <td data-label="Saiu" className={s.num}>{i.encerrada_em ? fmtDataHora(i.encerrada_em) : <span className={s.mudo}>ainda aberta</span>}</td>
                    <td data-label="Tempo" className={s.num}>
                      <span title="Do login até o fim da sessão (ou até agora, se ainda aberta)">{fmtDuracao(i.duracao_s)}</span>
                      <small title={`Do login até a última atividade (${fmtDataHora(i.ultima_atividade)})`}>em uso: {fmtDuracao(i.em_uso_s)}</small>
                    </td>
                    <td data-label="Situação"><Situacao item={i} dados={dados} /></td>
                    <td className={s.acoes}>
                      <button type="button" className={s.link} onClick={() => verEventos(i.sid)}>Eventos</button>
                      {!i.encerrada_em && i.sid !== eu && (
                        <button type="button" className={`${s.link} ${s.perigoTxt}`} onClick={() => encerrar(i)}><LogOut size={13} />Encerrar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className={s.tabela}>
              <thead>
                <tr><th>Quando</th><th>Evento</th><th>Usuário</th><th>Onde</th><th>IP</th><th>Detalhe</th></tr>
              </thead>
              <tbody>
                {dados.itens.map((e) => (
                  <tr key={e.id}>
                    <td data-label="Quando" className={s.num}>{fmtDataHora(e.created_at)}</td>
                    <td data-label="Evento">
                      <span className={`${s.selo} ${s[TOM_EVENTO[e.evento] ?? 'neutro']}`}>{dados.eventos?.[e.evento] ?? e.evento}</span>
                      {e.motivo && <small>{dados.motivos?.[e.motivo] ?? dados.motivos_recusa?.[e.motivo] ?? e.motivo}</small>}
                    </td>
                    <td data-label="Usuário"><b>{e.usuario_nome || (e.usuario_id ? `#${e.usuario_id}` : '—')}</b><small>{e.usuario_email}</small></td>
                    <td data-label="Onde">{e.origem ? <Origem origem={e.origem} userAgent={e.user_agent} /> : <span className={s.mudo}>—</span>}</td>
                    <td data-label="IP"><Ip ip={e.ip} onClick={filtrarIp} /></td>
                    <td data-label="Detalhe" className={s.detalhe}>{e.detalhe || <span className={s.mudo}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {dados && total > 0 && (
        <div className={s.rodape}>
          <span>{(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, total)} de {total} registros</span>
          <div>
            <button type="button" className={s.btn} disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
            <button type="button" className={s.btn} disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>Próxima</button>
          </div>
        </div>
      )}
    </section>
  );
}
