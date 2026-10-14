import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Search, RefreshCw, ChevronDown, ChevronRight, User, Smartphone, Monitor, ArrowLeft } from 'lucide-react';
import { osAPI } from '../api/estoque';
import styles from './Fleet.module.css';
import a from './AuditoriaIndicacoes.module.css';
import f from './FleetAuditoria.module.css';
import s from '../components/estoque/Estoque.module.css';
import DateInput from '../components/DateInput';

// Códigos de ação vêm de src/services/os/auditoria.js (o rótulo de cada um chega na resposta)
const GRUPOS = [
  { id: '', label: 'Todas' },
  { id: 'criada,editada,cancelada', label: 'Cadastro e edição' },
  { id: 'iniciada,lancamento,material_baixado,servico_adicionado,servico_removido,foto_enviada,foto_apagada,rascunho_salvo,finalizada,concluida', label: 'Execução em campo' },
  { id: 'estorno', label: 'Estornos' },
  { id: 'visualizada', label: 'Aberturas' },
  { id: 'app_sincronizado', label: 'Sincronizações do app' },
  { id: 'tipo_servico_criado,motivo_criado,motivo_editado,checklist_criado,checklist_editado', label: 'Catálogos' },
];

const TOM = {
  criada: 'novo', editada: 'edicao', cancelada: 'perigo', foto_apagada: 'perigo', servico_removido: 'perigo', estorno: 'perigo',
  iniciada: 'novo', finalizada: 'novo', concluida: 'novo', lancamento: 'edicao', material_baixado: 'edicao', servico_adicionado: 'edicao',
  foto_enviada: 'edicao', motivo_editado: 'edicao', checklist_editado: 'edicao',
};

const PAPEL = { admin: 'Administrador', estoque: 'Estoque', tecnico: 'Técnico' };
const STATUS = { aberta: 'Aberta', em_andamento: 'Em andamento', concluida: 'Concluída', cancelada: 'Cancelada' };
const PRIORIDADE = { baixa: 'Baixa', normal: 'Normal', alta: 'Alta' };

const FILTRO_VAZIO = { acao: '', origem: '', resultado: '', usuario_id: '', os: '', ip: '', de: '', ate: '', q: '' };
const POR_PAGINA = 50;

const fmtDataHora = (v) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }) : '—');

function fmtCampo(campo, v, dados) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : x)).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  const id = String(v);
  if (campo === 'tecnico_id') return dados?.nomes?.tecnicos?.[id] ?? `Técnico #${id}`;
  if (campo === 'status') return STATUS[v] ?? id;
  if (campo === 'prioridade') return PRIORIDADE[v] ?? id;
  if (campo === 'ativo' || campo === 'obrigatorio') return Number(v) ? 'Sim' : 'Não';
  const d = id.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (d) return `${d[3]}/${d[2]}/${d[1]}`;
  if (/^\d{4}-\d{2}-\d{2}T/.test(id)) return fmtDataHora(id);
  return id;
}

const nomeCampo = (c, dados) => dados?.campos?.[c] ?? c.replace(/_/g, ' ');

function Materiais({ lista }) {
  if (!lista?.length) return null;
  return (
    <div className={a.bloco}>
      <span className={a.blocoTitulo}>Materiais</span>
      <table className={a.diff}>
        <thead><tr><th>Item</th><th>Quantidade</th><th>Lote</th></tr></thead>
        <tbody>{lista.map((m) => (
          <tr key={m.id}><td>{m.item}</td><td>{Number(m.quantidade).toLocaleString('pt-BR')} {m.unidade === 'metros' ? 'm' : 'un'}</td><td>{m.lote}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function TabelaDados({ titulo, valores, dados }) {
  const linhas = Object.entries(valores ?? {}).filter(([k, v]) => k !== 'id' && v !== undefined);
  if (!linhas.length) return null;
  return (
    <div className={a.bloco}>
      <span className={a.blocoTitulo}>{titulo}</span>
      <table className={a.diff}>
        <tbody>{linhas.map(([k, v]) => <tr key={k}><td>{nomeCampo(k, dados)}</td><td>{fmtCampo(k, v, dados)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function Detalhes({ item, dados, onFiltrar }) {
  const campos = item.campos_alterados ? item.campos_alterados.split(',') : [];
  const depois = item.dados_depois ?? {};
  const outros = campos.length ? null : Object.fromEntries(Object.entries(depois).filter(([k]) => !['materiais', 'enviado'].includes(k)));
  return (
    <div className={a.detalhes}>
      {item.resultado === 'erro' && <div className={a.alerta}>Recusado pelo sistema (HTTP {item.http_status}): {item.erro}</div>}
      {campos.length > 0 && (
        <table className={a.diff}>
          <thead><tr><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead>
          <tbody>{campos.map((c) => (
            <tr key={c}>
              <td>{nomeCampo(c, dados)}</td>
              <td className={a.antes}>{fmtCampo(c, item.dados_antes?.[c], dados)}</td>
              <td className={a.depois}>{fmtCampo(c, item.dados_depois?.[c], dados)}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {campos.length === 0 && item.dados_antes && <TabelaDados titulo={item.acao.endsWith('removido') || item.acao.endsWith('apagada') ? 'O que foi apagado' : 'Antes'} valores={item.dados_antes} dados={dados} />}
      <Materiais lista={depois.materiais} />
      {outros && Object.keys(outros).length > 0 && (
        <div className={a.bloco}>
          <span className={a.blocoTitulo}>{item.acao === 'criada' ? 'OS como foi criada' : 'Resultado'}</span>
          <pre className={a.json}>{JSON.stringify(outros, null, 2)}</pre>
        </div>
      )}
      {depois.enviado && (
        <details className={a.bloco}>
          <summary className={a.blocoTitulo} style={{ cursor: 'pointer' }}>O que foi enviado</summary>
          <pre className={a.json}>{JSON.stringify(depois.enviado, null, 2)}</pre>
        </details>
      )}
      <dl className={a.meta}>
        <dt>Registro</dt><dd>#{item.id} · {fmtDataHora(item.created_at)}{item.repetida ? ' · reenvio (o app repetiu um envio que já tinha chegado; nada foi feito de novo)' : ''}</dd>
        <dt>Usuário</dt>
        <dd>
          {item.usuario_nome || item.usuario_email ? `${item.usuario_nome ?? ''} ${item.usuario_email ? `<${item.usuario_email}>` : ''}` : '—'}
          {item.usuario_papel && ` · ${PAPEL[item.usuario_papel] ?? item.usuario_papel}`}
          {item.usuario_id && <> · <button type="button" className={a.link} onClick={() => onFiltrar({ usuario_id: String(item.usuario_id) })}>ver tudo deste usuário</button></>}
        </dd>
        <dt>Origem</dt><dd>{dados.origens?.[item.origem] ?? item.origem}</dd>
        {item.os_id && (
          <>
            <dt>OS</dt>
            <dd>
              <Link className={a.link} to={`/os/${item.os_id}`}>abrir a OS #{item.os_numero ?? item.os_id}</Link>
              {item.os_numero && <> · <button type="button" className={a.link} onClick={() => onFiltrar({ os: String(item.os_numero) })}>ver tudo desta OS</button></>}
            </dd>
          </>
        )}
        <dt>IP</dt>
        <dd>
          {item.ip ? <button type="button" className={a.link} onClick={() => onFiltrar({ ip: item.ip })}>{item.ip}</button> : '—'}
          {item.ip_cadeia && <span className={a.cadeia}> (cadeia: {item.ip_cadeia})</span>}
        </dd>
        <dt>Requisição</dt><dd className={a.ua}>{item.metodo} {item.rota}</dd>
        <dt>Aparelho / navegador</dt><dd className={a.ua}>{item.user_agent || '—'}</dd>
      </dl>
    </div>
  );
}

export default function OsAuditoria() {
  const nav = useNavigate();
  const [filtro, setFiltro] = useState(FILTRO_VAZIO);
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aberto, setAberto] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDados(await osAPI.auditoria({ ...filtro, pagina, por_pagina: POR_PAGINA }));
    } catch (e) {
      if (e.status === 404 || e.status === 503) setError('A auditoria das OS ainda não está instalada no servidor (falta aplicar a migração e reiniciar o backend).');
      else setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filtro, pagina]);

  useEffect(() => { carregar(); }, [carregar]);

  // a busca em texto só dispara depois que a pessoa para de digitar
  useEffect(() => {
    const t = setTimeout(() => setFiltro((x) => (x.q === busca ? x : { ...x, q: busca })), 400);
    return () => clearTimeout(t);
  }, [busca]);
  useEffect(() => { setPagina(1); }, [filtro]);

  const muda = (campo) => (e) => setFiltro((x) => ({ ...x, [campo]: e.target.value }));
  const filtrar = (m) => setFiltro((x) => ({ ...x, ...m }));
  const temFiltro = Object.values(filtro).some((v) => v !== '');
  const total = dados?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>Auditoria das OS</h1>
          <p className={s.sub}>Tudo o que foi feito nas ordens de serviço, pelo web e pelo app dos técnicos: quem, quando, de onde e o que mudou</p>
        </div>
        <button className={s.btn} onClick={() => nav('/os')}><ArrowLeft size={18} />Ordens de Serviço</button>
      </div>

      <div className={f.card}>
        <div className={a.filtros}>
          <div className={f.grupos} role="group" aria-label="Tipo de ação">
            {GRUPOS.map((g) => (
              <button key={g.label} type="button" className={`${f.chip} ${filtro.acao === g.id ? f.chipAtivo : ''}`} aria-pressed={filtro.acao === g.id}
                onClick={() => setFiltro((x) => ({ ...x, acao: g.id }))}>{g.label}</button>
            ))}
          </div>

          <div className={a.linha}>
            <label className={a.campo}>
              <span>Ação</span>
              <select className={styles.select} value={GRUPOS.some((g) => g.id === filtro.acao) ? '' : filtro.acao} onChange={muda('acao')}>
                <option value="">{GRUPOS.find((g) => g.id === filtro.acao)?.label ?? 'Todas'}</option>
                {Object.entries(dados?.acoes ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className={a.campo}>
              <span>Origem</span>
              <select className={styles.select} value={filtro.origem} onChange={muda('origem')}>
                <option value="">Web e app</option>
                {Object.entries(dados?.origens ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className={a.campo}>
              <span>Quem fez</span>
              <select className={styles.select} value={filtro.usuario_id} onChange={muda('usuario_id')}>
                <option value="">Todos os usuários</option>
                {(dados?.usuarios ?? []).map((u) => <option key={u.id} value={u.id}>{u.nome || u.email}{u.papel ? ` (${PAPEL[u.papel] ?? u.papel})` : ''}</option>)}
              </select>
            </label>
            <label className={a.campo}>
              <span>Resultado</span>
              <select className={styles.select} value={filtro.resultado} onChange={muda('resultado')}>
                <option value="">Todos</option><option value="ok">Deu certo</option><option value="erro">Recusado</option>
              </select>
            </label>
            <label className={a.campo}>
              <span>Nº da OS</span>
              <input className={styles.input} value={filtro.os} onChange={muda('os')} inputMode="numeric" placeholder="ex.: 31" />
            </label>
            <label className={a.campo}>
              <span>De</span>
              <DateInput className={styles.input} value={filtro.de} onChange={muda('de')} max={filtro.ate || undefined} />
            </label>
            <label className={a.campo}>
              <span>Até</span>
              <DateInput className={styles.input} value={filtro.ate} onChange={muda('ate')} min={filtro.de || undefined} />
            </label>
            <label className={a.campo}>
              <span>IP</span>
              <input className={styles.input} value={filtro.ip} onChange={muda('ip')} placeholder="ex.: 10.100" />
            </label>
          </div>

          <div className={a.linha}>
            <div className={f.busca}>
              <Search size={15} />
              <input className={styles.input} placeholder="Buscar no resumo, usuário, erro ou dados (cliente, item, lote, motivo...)"
                value={busca} onChange={(e) => setBusca(e.target.value)} />
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
            <span>As ações nas OS passam a ser registradas a partir da instalação da auditoria</span>
          </div>
        ) : (
          <ul className={a.itens} style={{ opacity: loading ? 0.6 : 1 }}>
            {dados.itens.map((item) => {
              const expandido = aberto === item.id;
              const rotulo = dados.acoes[item.acao] ?? item.acao;
              const Origem = item.origem === 'app' ? Smartphone : Monitor;
              return (
                <li key={item.id} className={a.item}>
                  <button type="button" className={a.resumoLinha} onClick={() => setAberto(expandido ? null : item.id)} aria-expanded={expandido}>
                    {expandido ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    <span className={a.quando}>{fmtDataHora(item.created_at)}</span>
                    <span className={`${a.acao} ${a[item.resultado === 'erro' ? 'perigo' : TOM[item.acao] ?? 'neutro']}`} title={rotulo}>
                      {item.resultado === 'erro' ? `Recusado · ${rotulo}` : rotulo}
                    </span>
                    <span className={a.texto}>{item.resumo}</span>
                    <span className={a.quem}>
                      <Origem size={13} aria-label={dados.origens?.[item.origem] ?? item.origem} />
                      <User size={13} />
                      {item.usuario_nome || item.usuario_email || '—'}
                      {item.ip && <span className={a.ip}>{item.ip}</span>}
                    </span>
                  </button>
                  {expandido && <Detalhes item={item} dados={dados} onFiltrar={filtrar} />}
                </li>
              );
            })}
          </ul>
        )}

        {dados && total > 0 && (
          <div className={f.rodape}>
            <span>{(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, total)} de {total} registros</span>
            <div>
              <button className={styles.paginationBtn} disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
              <button className={styles.paginationBtn} disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>Próxima</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
