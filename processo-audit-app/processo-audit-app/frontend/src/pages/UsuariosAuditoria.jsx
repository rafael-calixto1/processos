import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Search, RefreshCw } from 'lucide-react';
import { authAPI } from '../api/index';
import s from './AcessosAuditoria.module.css';

// Códigos de ação e nomes de campo vêm de src/services/usuariosAuditoria.js (a API devolve os rótulos)
const TOM_ACAO = { criado: 'ok', editado: 'info', inativado: 'alerta', senha_propria: 'neutro' };
const VAZIO = { acao: '', alvo_id: '', usuario_id: '', de: '', ate: '', ip: '' };
const POR_PAGINA = 50;

const fmtDataHora = (v) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }) : '—');

const valor = (campo, v, dados) => {
  if (v === null || v === undefined || v === '') return '—';
  if (campo === 'role') return dados.papeis?.[v] ?? v;
  if (campo === 'status') return v === 'inactive' ? 'Inativo' : v === 'active' ? 'Ativo' : v;
  if (Array.isArray(v)) return v.length ? v.join(', ') : 'nenhum';
  if (campo === 'departamentos') return String(v).split(',').join(', ');
  return String(v);
};

function Mudancas({ item, dados }) {
  const antes = item.dados_antes ?? {};
  const depois = item.dados_depois ?? {};
  if (item.acao === 'criado') {
    return (
      <ul className={s.mudancas}>
        <li><span>Papel</span> {valor('role', depois.role, dados)}</li>
        <li><span>Departamentos</span> {valor('departamentos', depois.departamentos, dados)}</li>
      </ul>
    );
  }
  const campos = item.campos_alterados ? item.campos_alterados.split(',') : [];
  if (!campos.length) return <span className={s.mudo}>nada mudou</span>;
  return (
    <ul className={s.mudancas}>
      {campos.map((c) => (
        <li key={c}>
          <span>{dados.campos?.[c] ?? c}</span>{' '}
          {c === 'senha' ? 'nova senha definida' : <>{valor(c, antes[c], dados)} → <b>{valor(c, depois[c], dados)}</b></>}
        </li>
      ))}
    </ul>
  );
}

function Campo({ rotulo, children }) {
  return <label className={s.campo}><span>{rotulo}</span>{children}</label>;
}

export default function UsuariosAuditoria() {
  const [filtro, setFiltro] = useState(VAZIO);
  const [busca, setBusca] = useState('');
  const [q, setQ] = useState('');
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const muda = (k) => (e) => setFiltro((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => { const t = setTimeout(() => setQ(busca.trim()), 400); return () => clearTimeout(t); }, [busca]);
  useEffect(() => { setPagina(1); }, [filtro, q]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setDados(await authAPI.usuariosAuditoria({ ...filtro, q, pagina, por_pagina: POR_PAGINA }));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filtro, q, pagina]);

  useEffect(() => { carregar(); }, [carregar]);

  const filtrar = (k, v) => setFiltro((x) => ({ ...x, [k]: String(v) }));
  const temFiltro = q || Object.keys(VAZIO).some((k) => filtro[k] !== VAZIO[k]);
  const total = dados?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <section className={s.painel} aria-label="Auditoria do cadastro de usuários">
      <div className={s.filtros}>
        <div className={s.linha}>
          <Campo rotulo="Ação">
            <select value={filtro.acao} onChange={muda('acao')}>
              <option value="">Todas</option>
              {Object.entries(dados?.acoes ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Usuário afetado">
            <select value={filtro.alvo_id} onChange={muda('alvo_id')}>
              <option value="">Todos</option>
              {(dados?.alvos ?? []).map((u) => <option key={u.id} value={u.id}>{u.nome || u.email}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Feito por">
            <select value={filtro.usuario_id} onChange={muda('usuario_id')}>
              <option value="">Qualquer pessoa</option>
              {(dados?.autores ?? []).map((u) => <option key={u.id} value={u.id}>{u.nome || u.email}</option>)}
            </select>
          </Campo>
          <Campo rotulo="De"><input type="date" value={filtro.de} onChange={muda('de')} /></Campo>
          <Campo rotulo="Até"><input type="date" value={filtro.ate} onChange={muda('ate')} /></Campo>
          <Campo rotulo="IP"><input value={filtro.ip} onChange={muda('ip')} placeholder="ex.: 10.100" /></Campo>
        </div>
        <div className={s.linha}>
          <div className={s.busca}>
            <Search size={15} />
            <input placeholder="Buscar por nome ou e-mail de quem foi alterado ou de quem alterou"
              value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          {temFiltro && (
            <button type="button" className={s.btn} onClick={() => { setFiltro(VAZIO); setBusca(''); }}>Limpar filtros</button>
          )}
          <button type="button" className={s.btn} onClick={carregar} title="Atualizar" aria-label="Atualizar"><RefreshCw size={15} /></button>
        </div>
      </div>

      {!dados ? (
        error && !loading ? <div className={s.erro}>{error}</div> : <div className={s.vazio}><div className="spinner" /></div>
      ) : dados.itens.length === 0 ? (
        <div className={s.vazio}>
          <ShieldCheck size={36} strokeWidth={1.2} />
          <p>Nenhum registro {temFiltro ? 'com esses filtros' : 'ainda'}</p>
          <span>As alterações passam a ser registradas a partir da instalação desta auditoria</span>
        </div>
      ) : (
        <div className={s.tabelaWrap} style={{ opacity: loading ? 0.6 : 1 }}>
          {error && <div className={s.erro}>{error}</div>}
          <table className={s.tabela}>
            <thead>
              <tr><th>Quando</th><th>Ação</th><th>Usuário afetado</th><th>O que mudou</th><th>Feito por</th><th>IP</th></tr>
            </thead>
            <tbody>
              {dados.itens.map((i) => (
                <tr key={i.id}>
                  <td data-label="Quando" className={s.num}>{fmtDataHora(i.created_at)}</td>
                  <td data-label="Ação">
                    <span className={`${s.selo} ${s[TOM_ACAO[i.acao] ?? 'neutro']}`}>{dados.acoes?.[i.acao] ?? i.acao}</span>
                  </td>
                  <td data-label="Usuário afetado">
                    {i.alvo_id
                      ? <button type="button" className={s.nomeLink} onClick={() => filtrar('alvo_id', i.alvo_id)} title="Ver só as alterações deste usuário">{i.alvo_nome || `#${i.alvo_id}`}</button>
                      : <b>{i.alvo_nome || '—'}</b>}
                    <small>{i.alvo_email}</small>
                  </td>
                  <td data-label="O que mudou" className={s.detalhe}><Mudancas item={i} dados={dados} /></td>
                  <td data-label="Feito por"><b>{i.usuario_nome || (i.usuario_id ? `#${i.usuario_id}` : 'cadastro público')}</b><small>{i.usuario_email}</small></td>
                  <td data-label="IP">
                    {i.ip
                      ? <button type="button" className={s.ip} onClick={() => filtrar('ip', i.ip)} title={i.ip_cadeia || 'Filtrar por este IP'}>{i.ip}</button>
                      : <span className={s.mudo}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
