import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Search, RefreshCw, ChevronDown, ChevronRight, User } from 'lucide-react';
import styles from './Fleet.module.css';
import a from './AuditoriaIndicacoes.module.css';
import f from './FleetAuditoria.module.css';
import { fleetFetch } from './fleetFetch';
import { TOM, fmtDataHora, TabelaDados, TabelaAlteracoes } from './fleetAuditoriaView';

// Códigos de ação e entidade vêm de src/services/fleet/auditoria.js
const GRUPOS = [
  { id: 'criado',     label: 'Cadastros' },
  { id: 'editado',    label: 'Edições' },
  { id: 'inativado',  label: 'Inativações' },
  { id: 'reativado',  label: 'Reativações' },
  { id: 'excluido',   label: 'Exclusões (antigas)' },
  { id: 'cupom_lido', label: 'Cupons lidos' },
];

const FILTRO_VAZIO = { acao: '', entidade: '', usuario_id: '', veiculo_id: '', ip: '', de: '', ate: '', q: '' };
const POR_PAGINA = 50;

function Detalhes({ item, dados, onFiltrarIp, onFiltrarVeiculo }) {
  const campos = item.campos_alterados ? item.campos_alterados.split(',') : [];
  return (
    <div className={a.detalhes}>
      <TabelaAlteracoes item={item} dados={dados} />
      {campos.length === 0 && item.acao !== 'cupom_lido' && (
        <TabelaDados titulo={item.acao === 'excluido' ? 'Dados apagados' : item.acao === 'editado' ? 'Registro (nada mudou)' : 'Dados cadastrados'}
          valores={item.dados_antes ?? item.dados_depois} dados={dados} />
      )}
      {item.acao === 'cupom_lido' && item.dados_depois && (
        <div className={a.bloco}>
          <span className={a.blocoTitulo}>O que foi lido do cupom</span>
          <pre className={a.json}>{JSON.stringify(item.dados_depois, null, 2)}</pre>
        </div>
      )}
      <dl className={a.meta}>
        <dt>Registro</dt><dd>#{item.id} · {fmtDataHora(item.created_at)}</dd>
        <dt>Usuário</dt><dd>{item.usuario_nome || item.usuario_email ? `${item.usuario_nome ?? ''} ${item.usuario_email ? `<${item.usuario_email}>` : ''}` : '—'}</dd>
        <dt>IP</dt>
        <dd>
          {item.ip ? <button type="button" className={a.link} onClick={() => onFiltrarIp(item.ip)}>{item.ip}</button> : '—'}
          {item.ip_cadeia && <span className={a.cadeia}> (cadeia: {item.ip_cadeia})</span>}
        </dd>
        <dt>Navegador</dt><dd className={a.ua}>{item.user_agent || '—'}</dd>
        {item.veiculo_id && (
          <>
            <dt>Veículo</dt>
            <dd><button type="button" className={a.link} onClick={() => onFiltrarVeiculo(item.veiculo_id)}>ver tudo deste veículo</button></dd>
          </>
        )}
      </dl>
    </div>
  );
}

export default function FleetAuditoria() {
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
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries({ ...filtro, pagina, por_pagina: POR_PAGINA })) if (v !== '') qs.set(k, String(v));
      const res = await fleetFetch(`/api/fleet/auditoria?${qs}`);
      const json = await res.json().catch(() => ({}));
      if (res.status === 404) throw new Error('A auditoria ainda não está ativa no servidor (falta reiniciar o backend).');
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar a auditoria');
      setDados(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filtro, pagina]);

  useEffect(() => { carregar(); }, [carregar]);

  // a busca em texto só dispara depois que a pessoa para de digitar
  useEffect(() => {
    const t = setTimeout(() => setFiltro(x => (x.q === busca ? x : { ...x, q: busca })), 400);
    return () => clearTimeout(t);
  }, [busca]);
  useEffect(() => { setPagina(1); }, [filtro]);

  const muda = (campo) => (e) => setFiltro(x => ({ ...x, [campo]: e.target.value }));
  const temFiltro = Object.values(filtro).some(v => v !== '');
  const total = dados?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div className={f.card}>
      <div className={a.filtros}>
        <div className={f.grupos} role="group" aria-label="Tipo de ação">
          <button type="button" className={`${f.chip} ${filtro.acao === '' ? f.chipAtivo : ''}`}
            onClick={() => setFiltro(x => ({ ...x, acao: '' }))}>Todas</button>
          {GRUPOS.map(g => (
            <button key={g.id} type="button" className={`${f.chip} ${filtro.acao === g.id ? f.chipAtivo : ''}`}
              onClick={() => setFiltro(x => ({ ...x, acao: g.id }))}>{g.label}</button>
          ))}
        </div>

        <div className={a.linha}>
          <label className={a.campo}>
            <span>O quê</span>
            <select className={styles.select} value={filtro.entidade} onChange={muda('entidade')}>
              <option value="">Tudo</option>
              {Object.entries(dados?.entidades ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className={a.campo}>
            <span>Veículo</span>
            <select className={styles.select} value={filtro.veiculo_id} onChange={muda('veiculo_id')}>
              <option value="">Todos os veículos</option>
              {(dados?.veiculos ?? []).map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
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
            <input type="date" className={styles.input} value={filtro.de} onChange={muda('de')} />
          </label>
          <label className={a.campo}>
            <span>Até</span>
            <input type="date" className={styles.input} value={filtro.ate} onChange={muda('ate')} />
          </label>
          <label className={a.campo}>
            <span>IP</span>
            <input className={styles.input} value={filtro.ip} onChange={muda('ip')} placeholder="ex.: 10.100" />
          </label>
        </div>

        <div className={a.linha}>
          <div className={f.busca}>
            <Search size={15} />
            <input className={styles.input} placeholder="Buscar no resumo, usuário ou dados (placa, nome, observação...)"
              value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          {temFiltro && (
            <button type="button" className={styles.btnSecondary} onClick={() => { setFiltro(FILTRO_VAZIO); setBusca(''); }}>Limpar filtros</button>
          )}
          <button type="button" className={styles.btnSecondary} onClick={carregar} title="Atualizar" aria-label="Atualizar">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {loading && !dados ? (
        <div className={styles.loadingState}><div className="spinner" /><span>Carregando...</span></div>
      ) : error ? (
        <div className={`${styles.errorState} ${f.erro}`}>{error}</div>
      ) : dados.itens.length === 0 ? (
        <div className={f.vazio}>
          <ShieldCheck size={36} strokeWidth={1.2} />
          <p>Nenhum registro {temFiltro ? 'com esses filtros' : 'ainda'}</p>
          <span>As ações na Frota passam a ser registradas a partir da instalação da auditoria</span>
        </div>
      ) : (
        <ul className={a.itens} style={{ opacity: loading ? 0.6 : 1 }}>
          {dados.itens.map(item => {
            const expandido = aberto === item.id;
            return (
              <li key={item.id} className={a.item}>
                <button type="button" className={a.resumoLinha} onClick={() => setAberto(expandido ? null : item.id)} aria-expanded={expandido}>
                  {expandido ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  <span className={a.quando}>{fmtDataHora(item.created_at)}</span>
                  {(() => {
                    const rotulo = `${dados.acoes[item.acao] ?? item.acao}${item.entidade !== 'cupom' ? ` · ${dados.entidades[item.entidade] ?? item.entidade}` : ''}`;
                    return <span className={`${a.acao} ${a[TOM[item.acao] ?? 'neutro']}`} title={rotulo}>{rotulo}</span>;
                  })()}
                  <span className={a.texto}>{item.resumo}</span>
                  <span className={a.quem}>
                    <User size={13} />
                    {item.usuario_nome || item.usuario_email || '—'}
                    {item.ip && <span className={a.ip}>{item.ip}</span>}
                  </span>
                </button>
                {expandido && (
                  <Detalhes
                    item={item}
                    dados={dados}
                    onFiltrarIp={(ip) => setFiltro(x => ({ ...x, ip }))}
                    onFiltrarVeiculo={(id) => setFiltro(x => ({ ...x, veiculo_id: String(id) }))}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {dados && total > 0 && (
        <div className={f.rodape}>
          <span>{(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, total)} de {total} registros</span>
          <div>
            <button className={styles.paginationBtn} disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>Anterior</button>
            <button className={styles.paginationBtn} disabled={pagina >= totalPaginas} onClick={() => setPagina(p => p + 1)}>Próxima</button>
          </div>
        </div>
      )}
    </div>
  );
}
