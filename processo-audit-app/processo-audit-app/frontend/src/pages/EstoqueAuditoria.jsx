import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RefreshCw, Smartphone, Monitor, ArrowLeft, SlidersHorizontal, User, Globe, Repeat } from 'lucide-react';
import { estoqueAPI } from '../api/estoque';
import s from '../components/estoque/Estoque.module.css';
import c from './OsAuditoria.module.css'; // mesma "rota" visual da auditoria das OS
import DateInput from '../components/DateInput';

// Códigos de ação e de aba vêm de src/services/estoque/auditoria.js (os rótulos chegam na resposta)
const ABAS = [['', 'Tudo'], ['itens', 'Itens'], ['entrada', 'Entrada / Compra'], ['lotes', 'Lotes'], ['retirada', 'Retirada'],
  ['devolucao', 'Devoluções'], ['equipamentos', 'Equipamentos'], ['cadastros', 'Cadastros']];
const PERIGO = new Set(['lote_excluido', 'lote_descartado', 'devolucao_negada']);

const PAPEL = { admin: 'administrador', estoque: 'estoque', tecnico: 'técnico' };
const ORIGEM_CURTA = { web: 'Web', app: 'App', outro: 'Outro' };
const UNIDADE = { metros: 'Metros', pecas: 'Unidades' };

const FILTRO_VAZIO = { aba: '', acao: '', origem: '', resultado: '', usuario_id: '', item_id: '', tecnico_id: '', lote: '', ip: '', de: '', ate: '', q: '' };
const POR_PAGINA = 50;

const fmtDataHora = (v) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }) : '—');
const fmtHora = (v) => new Date(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const chaveDia = (v) => { const d = new Date(v); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
const tituloDia = (v) => {
  const d = new Date(v);
  const hoje = new Date();
  const ontem = new Date(); ontem.setDate(hoje.getDate() - 1);
  const data = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', ...(d.getFullYear() !== hoje.getFullYear() && { year: 'numeric' }) });
  if (chaveDia(d) === chaveDia(hoje)) return ['Hoje', data];
  if (chaveDia(d) === chaveDia(ontem)) return ['Ontem', data];
  const semana = d.toLocaleDateString('pt-BR', { weekday: 'long' });
  return [semana.charAt(0).toUpperCase() + semana.slice(1), data];
};

function fmtCampo(campo, v, dados) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : x)).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  const id = String(v);
  if (campo === 'ativo') return Number(v) ? 'Sim' : 'Não';
  if (campo === 'unidade') return UNIDADE[v] ?? id;
  if (campo === 'tecnico_id') return dados?.catalogo?.tecnicos?.find((t) => String(t.id) === id)?.nome ?? `Técnico #${id}`;
  if (campo === 'item_id') return dados?.catalogo?.itens?.find((t) => String(t.id) === id)?.nome ?? `Item #${id}`;
  const d = id.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (d) return `${d[3]}/${d[2]}/${d[1]}`;
  if (/^\d{4}-\d{2}-\d{2}T/.test(id)) return fmtDataHora(id);
  return id;
}

const nomeCampo = (k, dados) => {
  const n = dados?.campos?.[k] ?? k.replace(/_/g, ' ');
  return n.charAt(0).toUpperCase() + n.slice(1);
};

function Lotes({ lista }) {
  if (!lista?.length) return null;
  return (
    <div className={c.bloco}>
      <h4>Lotes que entraram</h4>
      <table className={c.tabela}>
        <thead><tr><th>Lote</th><th>Item</th><th>Quantidade</th></tr></thead>
        <tbody>{lista.map((l) => (
          <tr key={l.codigo}><td>{l.codigo}</td><td>{l.item}</td><td>{Number(l.quantidade).toLocaleString('pt-BR')} {l.unidade === 'metros' ? 'm' : 'un'}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function TabelaDados({ titulo, valores, dados }) {
  const linhas = Object.entries(valores ?? {}).filter(([k, v]) => k !== 'id' && k !== 'lotes' && v !== undefined && typeof v !== 'object');
  if (!linhas.length) return null;
  return (
    <div className={c.bloco}>
      <h4>{titulo}</h4>
      <table className={c.tabela}>
        <tbody>{linhas.map(([k, v]) => <tr key={k}><td>{nomeCampo(k, dados)}</td><td>{fmtCampo(k, v, dados)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function Detalhe({ item, dados, onFiltrar }) {
  const campos = item.campos_alterados ? item.campos_alterados.split(',') : [];
  const depois = item.dados_depois ?? {};
  return (
    <div className={c.detalhe}>
      {item.resultado === 'erro' && <div className={c.alerta}>O sistema recusou (HTTP {item.http_status}): {item.erro}</div>}
      {campos.length > 0 && (
        <div className={c.bloco}>
          <h4>O que mudou</h4>
          <table className={c.tabela}>
            <thead><tr><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead>
            <tbody>{campos.map((k) => (
              <tr key={k}>
                <td>{nomeCampo(k, dados)}</td>
                <td className={c.antes}>{fmtCampo(k, item.dados_antes?.[k], dados)}</td>
                <td className={c.depois}>{fmtCampo(k, item.dados_depois?.[k], dados)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {campos.length === 0 && item.dados_antes && (
        <TabelaDados titulo={PERIGO.has(item.acao) ? 'O que foi apagado ou desfeito' : 'Como estava antes'} valores={item.dados_antes} dados={dados} />
      )}
      <Lotes lista={depois.lotes} />
      {campos.length === 0 && !depois.enviado && <TabelaDados titulo={item.resultado === 'erro' ? 'Enviado' : 'Como ficou'} valores={depois} dados={dados} />}
      {depois.enviado && (
        <details className={c.bloco}>
          <summary>O que foi enviado</summary>
          <pre className={c.json}>{JSON.stringify(depois.enviado, null, 2)}</pre>
        </details>
      )}
      <dl className={c.ficha}>
        <dt>Quando</dt><dd>{fmtDataHora(item.created_at)} <span className={c.fraco}>(registro #{item.id})</span></dd>
        <dt>Quem</dt>
        <dd>
          {item.usuario_nome || item.usuario_email || '—'}
          {item.usuario_email && item.usuario_nome && <span className={c.fraco}> {item.usuario_email}</span>}
          {item.usuario_papel && <span className={c.fraco}>, {PAPEL[item.usuario_papel] ?? item.usuario_papel}</span>}
        </dd>
        <dt>De onde</dt>
        <dd>
          {dados.origens?.[item.origem] ?? item.origem}{item.ip && <>, IP {item.ip}</>}
          {item.ip_cadeia && <span className={c.fraco}> (cadeia: {item.ip_cadeia})</span>}
        </dd>
        <dt>Aparelho</dt><dd className={c.fraco}>{item.user_agent || '—'}</dd>
        <dt>Requisição</dt><dd className={c.fraco}>{item.metodo} {item.rota}</dd>
        <dt>Ver também</dt>
        <dd className={c.links}>
          {item.item_id && <button type="button" className={c.link} onClick={() => onFiltrar({ item_id: String(item.item_id) })}>Tudo deste item</button>}
          {item.lote_codigo && <button type="button" className={c.link} onClick={() => onFiltrar({ lote: item.lote_codigo })}>Tudo deste lote</button>}
          {item.tecnico_id && <button type="button" className={c.link} onClick={() => onFiltrar({ tecnico_id: String(item.tecnico_id) })}>Tudo deste técnico</button>}
          {item.usuario_id && <button type="button" className={c.link} onClick={() => onFiltrar({ usuario_id: String(item.usuario_id) })}>Tudo desta pessoa</button>}
          {item.ip && <button type="button" className={c.link} onClick={() => onFiltrar({ ip: item.ip })}>Tudo deste IP</button>}
        </dd>
      </dl>
    </div>
  );
}

function Evento({ item, dados, aberto, onAbrir, onFiltrar }) {
  const recusado = item.resultado === 'erro';
  const rotulo = dados.acoes[item.acao] ?? item.acao;
  const Origem = item.origem === 'app' ? Smartphone : item.origem === 'web' ? Monitor : Globe;
  const no = [c.no, c[item.origem] ?? c.outro, recusado && c.recusa].filter(Boolean).join(' ');
  const tom = recusado ? c.recusada : PERIGO.has(item.acao) ? c.perigo : '';
  // recusado: a ação vai no rótulo, a mensagem do sistema em vermelho
  const resumo = recusado ? item.resumo.replace(/^Recusado \([^)]*\)( — )?/, '').replace(`: ${item.erro}`, '').replace(/^: /, '') || 'Sem registro envolvido' : item.resumo;
  return (
    <li className={c.item}>
      <button type="button" className={c.evento} onClick={onAbrir} aria-expanded={aberto}>
        <span className={c.hora}>{fmtHora(item.created_at)}</span>
        <span className={no} aria-hidden="true" />
        <span className={c.corpo}>
          <span className={c.cabeca}>
            <span className={`${c.acao} ${tom}`}>{recusado ? `${rotulo}: recusado` : rotulo}</span>
            <span className={c.horaInline}>{fmtHora(item.created_at)}</span>
          </span>
          <span className={c.resumo}>{resumo}</span>
          {recusado && item.erro && <span className={c.erro}>{item.erro}</span>}
          <span className={c.meta}>
            <span><User size={13} aria-hidden="true" />{item.usuario_nome || item.usuario_email || 'Sem usuário'}{item.usuario_papel ? `, ${PAPEL[item.usuario_papel] ?? item.usuario_papel}` : ''}</span>
            <span><Origem size={13} aria-hidden="true" />{ORIGEM_CURTA[item.origem] ?? item.origem}</span>
            {item.ip && <span className={c.num}>IP {item.ip}</span>}
            {item.repetida && <span className={c.reenvio}><Repeat size={13} aria-hidden="true" />Reenvio do app, nada foi feito de novo</span>}
          </span>
        </span>
      </button>
      {aberto && <Detalhe item={item} dados={dados} onFiltrar={onFiltrar} />}
    </li>
  );
}

export default function EstoqueAuditoria() {
  const nav = useNavigate();
  const [filtro, setFiltro] = useState(FILTRO_VAZIO);
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aberto, setAberto] = useState(null);
  const [mais, setMais] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDados(await estoqueAPI.auditoria({ ...filtro, pagina, por_pagina: POR_PAGINA }));
    } catch (e) {
      if (e.status === 404 || e.status === 503) setError('A auditoria do estoque ainda não está instalada no servidor. Aplique a migração e reinicie o backend.');
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
  const filtrar = (m) => { setFiltro((x) => ({ ...x, ...m })); if (m.lote || m.ip) setMais(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const limpar = () => { setFiltro(FILTRO_VAZIO); setBusca(''); };
  const temFiltro = Object.values(filtro).some((v) => v !== '');
  const total = dados?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  // a rota é cortada por dia (na ordem em que chega: mais recente primeiro)
  const dias = useMemo(() => {
    const r = [];
    for (const item of dados?.itens ?? []) {
      const k = chaveDia(item.created_at);
      if (r.at(-1)?.chave !== k) r.push({ chave: k, titulo: tituloDia(item.created_at), itens: [] });
      r.at(-1).itens.push(item);
    }
    return r;
  }, [dados]);

  const Segmento = ({ campo, valor, children }) => (
    <button type="button" className={`${c.segmento} ${filtro[campo] === valor ? c.segmentoAtivo : ''}`} aria-pressed={filtro[campo] === valor}
      onClick={() => setFiltro((x) => ({ ...x, [campo]: valor }))}>{children}</button>
  );

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>Auditoria do estoque</h1>
          <p className={s.sub}>Quem mexeu em itens, entradas, lotes, retiradas, devoluções, equipamentos e cadastros, pelo web ou pelo app</p>
        </div>
        <button className={s.btn} onClick={() => nav('/estoque')}><ArrowLeft size={18} />Estoque</button>
      </div>

      <section className={c.painel} aria-label="Registro de ações no estoque">
        <div className={c.filtros}>
          <div className={c.tipos} role="group" aria-label="Aba do estoque">
            {ABAS.map(([id, label]) => (
              <button key={label} type="button" className={`${c.tipo} ${filtro.aba === id && !filtro.acao ? c.tipoAtivo : ''}`} aria-pressed={filtro.aba === id && !filtro.acao}
                onClick={() => setFiltro((x) => ({ ...x, aba: id, acao: '' }))}>{label}</button>
            ))}
          </div>

          <div className={c.linhaFiltros}>
            <label className={`${c.campo} ${c.busca}`}>
              <span>Buscar</span>
              <Search size={15} aria-hidden="true" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Item, lote, NF, motivo, erro…" />
            </label>
            <label className={c.campo}>
              <span>Quem fez</span>
              <select value={filtro.usuario_id} onChange={muda('usuario_id')}>
                <option value="">Todas as pessoas</option>
                {(dados?.usuarios ?? []).map((u) => <option key={u.id} value={u.id}>{u.nome || u.email}{u.papel ? ` (${PAPEL[u.papel] ?? u.papel})` : ''}</option>)}
              </select>
            </label>
            <label className={c.campo}>
              <span>Item</span>
              <select value={filtro.item_id} onChange={muda('item_id')}>
                <option value="">Todos os itens</option>
                {(dados?.catalogo?.itens ?? []).map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
              </select>
            </label>
            <label className={c.campo}>
              <span>Técnico</span>
              <select value={filtro.tecnico_id} onChange={muda('tecnico_id')}>
                <option value="">Todos os técnicos</option>
                {(dados?.catalogo?.tecnicos ?? []).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </label>
            <label className={c.campo}>
              <span>De</span>
              <DateInput value={filtro.de} onChange={muda('de')} max={filtro.ate || undefined} />
            </label>
          </div>

          {mais && (
            <div className={c.maisFiltros}>
              <label className={c.campo}>
                <span>Até</span>
                <DateInput value={filtro.ate} onChange={muda('ate')} min={filtro.de || undefined} />
              </label>
              <label className={c.campo}>
                <span>Lote</span>
                <input value={filtro.lote} onChange={muda('lote')} placeholder="Ex.: LOTE-BOB-0004" />
              </label>
              <label className={c.campo}>
                <span>Ação específica</span>
                <select value={filtro.acao} onChange={(e) => setFiltro((x) => ({ ...x, acao: e.target.value, aba: '' }))}>
                  <option value="">Qualquer ação</option>
                  {Object.entries(dados?.acoes ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className={c.campo}>
                <span>IP</span>
                <input value={filtro.ip} onChange={muda('ip')} placeholder="Ex.: 10.100" />
              </label>
            </div>
          )}

          <div className={c.barra}>
            <div className={c.segmentos} role="group" aria-label="Origem">
              <Segmento campo="origem" valor="">Web e app</Segmento>
              <Segmento campo="origem" valor="web"><span className={`${c.noLegenda} ${c.noWeb}`} aria-hidden="true" />Web</Segmento>
              <Segmento campo="origem" valor="app"><span className={`${c.noLegenda} ${c.noApp}`} aria-hidden="true" />App</Segmento>
            </div>
            <div className={c.segmentos} role="group" aria-label="Resultado">
              <Segmento campo="resultado" valor="">Todas</Segmento>
              <Segmento campo="resultado" valor="erro"><span className={`${c.noLegenda} ${c.noRecusa}`} aria-hidden="true" />Só recusadas</Segmento>
            </div>
            <div className={c.acoesBarra}>
              <button type="button" className={c.botao} onClick={() => setMais((m) => !m)} aria-expanded={mais}>
                <SlidersHorizontal size={15} aria-hidden="true" />{mais ? 'Menos filtros' : 'Mais filtros'}
              </button>
              {temFiltro && <button type="button" className={c.botao} onClick={limpar}>Limpar filtros</button>}
              <button type="button" className={c.botao} onClick={carregar} aria-label="Atualizar"><RefreshCw size={15} aria-hidden="true" /></button>
            </div>
          </div>
        </div>

        {loading && !dados ? (
          <div className={c.estado}><div className="spinner" /><p>Carregando o registro…</p></div>
        ) : error ? (
          <div className={`${c.estado} ${c.estadoErro}`}>
            <strong>Não deu para carregar a auditoria</strong>
            <p>{error}</p>
            <button type="button" className={c.botao} onClick={carregar}><RefreshCw size={15} aria-hidden="true" />Tentar de novo</button>
          </div>
        ) : dados.itens.length === 0 ? (
          <div className={c.estado}>
            <strong>{temFiltro ? 'Nada com esses filtros' : 'Nenhuma ação registrada ainda'}</strong>
            <p>{temFiltro
              ? 'Tente outro período ou limpe os filtros.'
              : 'Cada ação feita nas abas do estoque, no web ou no app, aparece aqui a partir de agora.'}</p>
            {temFiltro && <button type="button" className={c.botao} onClick={limpar}>Limpar filtros</button>}
          </div>
        ) : (
          <>
            <div className={c.contagem}>
              <span><b>{total.toLocaleString('pt-BR')}</b> {total === 1 ? 'registro' : 'registros'}{temFiltro ? ' com esses filtros' : ''}</span>
              <span className={c.dica}>Clique numa ação para ver os detalhes</span>
            </div>
            <div className={c.dias} style={{ opacity: loading ? 0.6 : 1 }}>
              {dias.map((d) => (
                <section key={d.chave} className={c.dia} aria-label={`${d.titulo[0]}, ${d.titulo[1]}`}>
                  <h3 className={c.diaTitulo}>{d.titulo[0]}<small>{d.titulo[1]}</small></h3>
                  <ul className={c.trecho}>
                    {d.itens.map((item) => (
                      <Evento key={item.id} item={item} dados={dados} aberto={aberto === item.id}
                        onAbrir={() => setAberto(aberto === item.id ? null : item.id)} onFiltrar={filtrar} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}

        {dados && total > POR_PAGINA && (
          <div className={c.rodape}>
            <span>{(pagina - 1) * POR_PAGINA + 1} a {Math.min(pagina * POR_PAGINA, total)} de {total.toLocaleString('pt-BR')}</span>
            <div>
              <button className={c.botao} disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Mais recentes</button>
              <button className={c.botao} disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>Mais antigos</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
