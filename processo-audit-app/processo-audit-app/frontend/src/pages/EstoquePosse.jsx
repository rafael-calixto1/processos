import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { estoqueAPI, osAPI } from '../api/estoque';
import { useAuth } from '../context/AuthContext';
import { AsyncState, Modal, useLoad, OsStatusBadge, fmtQtd, fmtNum, fmtData, fmtDataHora, styles as s } from '../components/estoque/ui';

export const TIPOS = { entrada: 'Entrada', retirada: 'Retirada', devolucao: 'Devolução', baixa_os: 'Baixa em OS', estorno: 'Estorno', ajuste: 'Ajuste' };

const TabelaPosse = ({ itens }) => (
  <AsyncState empty={itens.length === 0} emptyTitle="Nenhum material em posse">
    <div className={s.tableWrap}><table className={s.table}>
      <thead><tr><th>Item</th><th>Lote</th><th>Quantidade</th></tr></thead>
      <tbody>{itens.map((p) => (
        <tr key={p.lote_id}><td data-label="Item">{p.item_nome}</td><td data-label="Lote" className={s.mono}>{p.lote_codigo}</td><td data-label="Quantidade" className={s.num}><b>{fmtQtd(p.quantidade, p.unidade)}</b></td></tr>))}</tbody></table></div>
  </AsyncState>
);

const minuto = (v) => String(v).slice(0, 16);
const PAGINA = 12;

/* Agrupa movimentações em "ações": uma retirada/devolução = itens do mesmo minuto; baixas = por OS. Estornadas ficam de fora. */
export const agrupar = (historico) => {
  const estornadas = new Set(historico.filter((m) => m.estorno_de_id).map((m) => m.estorno_de_id));
  const validas = historico.filter((m) => m.tipo !== 'estorno' && !m.estorno_de_id && !estornadas.has(m.id));
  const grupos = new Map();
  for (const m of validas) {
    const k = `${m.tipo}|${m.os_id || ''}|${minuto(m.criado_em)}`;
    if (!grupos.has(k)) grupos.set(k, { key: k, tipo: m.tipo, quando: m.criado_em, os_id: m.os_id, os_numero: m.os_numero, os_cliente: m.os_cliente, itens: [] });
    grupos.get(k).itens.push(m);
  }
  return { validas, grupos: [...grupos.values()] };
};

export const resumo = (g) => {
  const nomes = [...new Set(g.itens.map((i) => i.item_nome))];
  return `${g.itens.length} ${g.itens.length === 1 ? 'lançamento' : 'lançamentos'} · ${nomes.slice(0, 2).join(', ')}${nomes.length > 2 ? ` +${nomes.length - 2}` : ''}`;
};

export const TabelaMovs = ({ itens, mostrarOs }) => (
  <div className={s.tableWrap}><table className={s.table}>
    <thead><tr><th>Item</th><th>Lote</th><th>Qtd</th>{mostrarOs && <th>OS</th>}</tr></thead>
    <tbody>{itens.map((m) => (<tr key={m.id}><td data-label="Item">{m.item_nome}</td><td data-label="Lote" className={s.mono}>{m.lote_codigo}</td><td data-label="Qtd">{fmtQtd(m.quantidade, m.unidade)}</td>
      {mostrarOs && <td data-label="OS">{m.os_id ? <Link className={s.rowLink} to={`/os/${m.os_id}`}>#{m.os_numero}</Link> : '—'}</td>}</tr>))}</tbody></table></div>
);

export const ModalGrupo = ({ g, onClose }) => (
  <Modal title={`${TIPOS[g.tipo]} — ${fmtDataHora(g.quando)}`} onClose={onClose}>
    <div style={{ padding: '0 4px 8px' }}>
      {g.os_id && <p className={s.sub}>OS <Link className={s.rowLink} to={`/os/${g.os_id}`}>#{g.os_numero}</Link>{g.os_cliente ? ` — ${g.os_cliente}` : ''}</p>}
      <TabelaMovs itens={g.itens} />
      {g.itens.some((i) => i.observacao) && <p className={s.sub}>Obs.: {[...new Set(g.itens.map((i) => i.observacao).filter(Boolean))].join(' · ')}</p>}
    </div>
  </Modal>
);

/* Em posse agora: por lote, com recebido / usado em OS / saldo, e detalhe expansível ligando as OS. */
export const PosseDetalhada = ({ itens, validas }) => {
  const [aberto, setAberto] = React.useState(null);
  return (
    <AsyncState empty={itens.length === 0} emptyTitle="Nenhum material em posse">
      <div className={s.tableWrap}><table className={s.table}>
        <thead><tr><th>Item</th><th>Lote</th><th>Recebido</th><th>Usado em OS</th><th>Em posse</th></tr></thead>
        <tbody>{itens.map((p) => {
          const movs = validas.filter((m) => m.lote_id === p.lote_id);
          const sum = (t) => movs.filter((m) => m.tipo === t).reduce((a, m) => a + Number(m.quantidade), 0);
          const recebido = sum('retirada'), usado = sum('baixa_os');
          const open = aberto === p.lote_id;
          const retiradas = movs.filter((m) => m.tipo === 'retirada');
          const porOs = new Map();
          movs.filter((m) => m.tipo === 'baixa_os').forEach((m) => porOs.set(m.os_id, { ...(porOs.get(m.os_id) || { os_id: m.os_id, os_numero: m.os_numero, q: 0 }), q: (porOs.get(m.os_id)?.q || 0) + Number(m.quantidade) }));
          return (<React.Fragment key={p.lote_id}>
            <tr className={s.clickRow} onClick={() => setAberto(open ? null : p.lote_id)}>
              <td data-label="Item"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{p.item_nome}</span></td>
              <td data-label="Lote" className={s.mono}>{p.lote_codigo}</td>
              <td data-label="Recebido">{fmtQtd(recebido, p.unidade)}</td><td data-label="Usado em OS">{fmtQtd(usado, p.unidade)}</td>
              <td data-label="Em posse" className={s.num}><b>{fmtQtd(p.quantidade, p.unidade)}</b></td></tr>
            {open && (<tr><td colSpan={5}><div style={{ display: 'grid', gap: 8, padding: '4px 8px 10px' }}>
              <div><b>Entregue em:</b> {retiradas.length ? retiradas.map((m) => `${fmtDataHora(m.criado_em)} (${fmtQtd(m.quantidade, m.unidade)})`).join(' · ') : '—'}</div>
              <div><b>Gasto nas OS:</b> {porOs.size ? [...porOs.values()].map((o) => (<span key={o.os_id} style={{ marginRight: 10 }}><Link className={s.rowLink} to={`/os/${o.os_id}`}>#{o.os_numero}</Link> ({fmtQtd(o.q, p.unidade)})</span>)) : 'Nada usado ainda'}</div>
            </div></td></tr>)}
          </React.Fragment>);
        })}</tbody></table></div>
    </AsyncState>
  );
};

/* Histórico de uma OS (status + material usado pelo técnico), carregado ao expandir a linha. */
const HistoricoOs = ({ osId, usos }) => {
  const { loading, error, data, reload } = useLoad(() => osAPI.get(osId), [osId]);
  const [aba, setAba] = React.useState('material');
  return (
    <AsyncState loading={loading} error={error} onRetry={reload}>
      {data && (<div style={{ display: 'grid', gap: 10, padding: '4px 8px 10px' }}>
        <div className={s.chips}>{[['material', 'Material usado'], ['historico', 'Histórico']].map(([k, l]) => (
          <button key={k} type="button" className={`${s.chip} ${aba === k ? s.chipActive : ''}`} onClick={() => setAba(k)}>{l}</button>))}</div>
        {aba === 'material' ? (usos.length > 0 ? <TabelaMovs itens={usos} /> : <p className={s.sub}>Nenhum material lançado por este técnico nesta OS.</p>) : (
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>{data.historico.length ? data.historico.map((h) => (
            <li key={h.id}>{fmtDataHora(h.criado_em)} — {h.de ? `${h.de} → ` : ''}<b>{h.para}</b>{h.usuario_nome ? ` (${h.usuario_nome})` : ''}</li>)) : <li>Sem alterações de status</li>}</ul>)}
        <Link className={s.rowLink} to={`/os/${osId}`}>Abrir OS completa</Link>
      </div>)}
    </AsyncState>
  );
};

const Ficha = ({ id }) => {
  const { loading, error, data, reload } = useLoad(() => estoqueAPI.fichaTecnico(id), [id]);
  const [modal, setModal] = React.useState(null);
  const [filtro, setFiltro] = React.useState('todos');
  const [limite, setLimite] = React.useState(PAGINA);
  const [osAberta, setOsAberta] = React.useState(null);
  const { validas, grupos } = React.useMemo(() => (data ? agrupar(data.historico) : { validas: [], grupos: [] }), [data]);
  const porOs = React.useMemo(() => {
    const m = new Map();
    grupos.filter((g) => g.tipo === 'baixa_os').forEach((g) => m.set(g.os_id, [...(m.get(g.os_id) || []), ...g.itens]));
    return m;
  }, [grupos]);
  const visiveis = grupos.filter((g) => filtro === 'todos' || g.tipo === filtro);
  return (
    <div className={s.page}>
      <Link to="/estoque/posse" className={s.rowLink} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44 }}><ArrowLeft size={16} />Voltar</Link>
      <AsyncState loading={loading} error={error} onRetry={reload}>
        {data && (<>
          <div><h1 className={s.title}>{data.tecnico.nome}</h1><p className={s.sub}>{data.tecnico.tipo === 'interno' ? 'Técnico interno' : `Equipe terceirizada${data.tecnico.empresa ? ` — ${data.tecnico.empresa}` : ''}`}</p></div>
          <div className={s.card}><h2 className={s.cardTitle}>Em posse agora</h2><p className={s.sub}>Clique em um item para ver quando foi entregue e em quais OS foi gasto.</p><PosseDetalhada itens={data.itens} validas={validas} /></div>
          <div className={s.card}><h2 className={s.cardTitle}>Ordens de serviço</h2>
            <AsyncState empty={data.os.length === 0} emptyTitle="Sem OS atribuídas">
              <div className={s.tableWrap}><table className={s.table}><thead><tr><th>Nº</th><th>Nome da OS</th><th>Material usado</th><th>Status</th></tr></thead>
                <tbody>{data.os.map((o) => { const usos = porOs.get(o.id) || []; return (
                  <tr key={o.id} className={s.clickRow} onClick={() => setOsAberta(o)}>
                    <td data-label="Nº"><Link className={s.rowLink} to={`/os/${o.id}`} onClick={(e) => e.stopPropagation()}>#{o.numero}</Link></td><td data-label="Nome da OS">{o.cliente}</td>
                    <td data-label="Material usado">{usos.length ? `${usos.length} ${usos.length === 1 ? 'lançamento' : 'lançamentos'}` : '—'}</td><td data-label="Status"><OsStatusBadge status={o.status} /></td></tr>); })}</tbody></table></div>
            </AsyncState></div>
          <div className={s.card}><h2 className={s.cardTitle}>Histórico</h2>
            <div className={s.chips} style={{ marginBottom: 10 }}>{[['todos', 'Todos'], ['retirada', 'Retiradas'], ['baixa_os', 'Baixas em OS'], ['devolucao', 'Devoluções']].map(([k, l]) => (
              <button key={k} className={`${s.chip} ${filtro === k ? s.chipActive : ''}`} onClick={() => { setFiltro(k); setLimite(PAGINA); }}>{l}</button>))}</div>
            <AsyncState empty={visiveis.length === 0} emptyTitle="Sem movimentações">
              <div className={s.tableWrap}><table className={s.table}><thead><tr><th>Quando</th><th>Tipo</th><th>Resumo</th><th>OS</th><th></th></tr></thead>
                <tbody>{visiveis.slice(0, limite).map((g) => (<tr key={g.key} className={s.clickRow} onClick={() => setModal(g)}>
                  <td data-label="Quando">{fmtDataHora(g.quando)}</td><td data-label="Tipo">{TIPOS[g.tipo]}</td><td data-label="Resumo">{resumo(g)}</td>
                  <td data-label="OS">{g.os_numero ? <Link className={s.rowLink} to={`/os/${g.os_id}`} onClick={(e) => e.stopPropagation()}>#{g.os_numero}</Link> : '—'}</td>
                  <td><button className={s.chip} onClick={(e) => { e.stopPropagation(); setModal(g); }}>Detalhes</button></td></tr>))}</tbody></table></div>
              {visiveis.length > limite && <button className={s.chip} style={{ marginTop: 10 }} onClick={() => setLimite(limite + PAGINA)}>Ver mais ({visiveis.length - limite})</button>}
            </AsyncState></div>
          {modal && <ModalGrupo g={modal} onClose={() => setModal(null)} />}
          {osAberta && <Modal title={`OS #${osAberta.numero} — ${osAberta.cliente}`} onClose={() => setOsAberta(null)}><HistoricoOs osId={osAberta.id} usos={porOs.get(osAberta.id) || []} /></Modal>}
        </>)}
      </AsyncState>
    </div>
  );
};

const Lista = () => {
  const nav = useNavigate();
  const { loading, error, data, reload } = useLoad(() => estoqueAPI.posse());
  const lista = data || [];
  return (
    <div className={s.page}>
      <div><h1 className={s.title}>Estoque por técnico</h1><p className={s.sub}>Quanto cada técnico/equipe tem em posse agora</p></div>
      <AsyncState loading={loading} error={error} onRetry={reload} empty={lista.length === 0} emptyTitle="Nenhum técnico cadastrado">
        <div className={s.tableWrap}><table className={s.table}>
          <thead><tr><th>Técnico / equipe</th><th>Tipo</th><th>Lotes</th><th>Cabo (m)</th><th>Peças</th></tr></thead>
          <tbody>{lista.map((t) => (
            <tr key={t.id} className={s.clickRow} onClick={() => nav(`/estoque/posse/${t.id}`)}>
              <td data-label="Técnico"><b>{t.nome}</b></td><td data-label="Tipo">{t.tipo === 'interno' ? 'Interno' : 'Terceirizada'}</td>
              <td data-label="Lotes">{t.lotes}</td><td data-label="Cabo (m)" className={s.num}>{fmtNum(t.metros)}</td><td data-label="Peças" className={s.num}>{fmtNum(t.pecas)}</td></tr>))}</tbody></table></div>
      </AsyncState>
    </div>
  );
};

const Minha = () => {
  const { loading, error, data, reload } = useLoad(() => estoqueAPI.minhaPosse());
  // Usuário sem cadastro de técnico vinculado não tem estoque: mostra o estado vazio em vez de erro.
  const semVinculo = /vinculado/i.test(error || '');
  return (
    <div className={s.page}>
      <div><h1 className={s.title}>Minha posse</h1><p className={s.sub}>Materiais que estão com você agora</p></div>
      <div className={s.card}>
        <AsyncState loading={loading} error={semVinculo ? null : error} onRetry={reload} empty={semVinculo || (data || []).length === 0} emptyTitle="Você não está com nenhum material no momento">
          <TabelaPosse itens={data || []} />
        </AsyncState>
      </div>
    </div>
  );
};

const EstoquePosse = () => {
  const { user } = useAuth();
  const { id } = useParams();
  if (user?.role === 'tecnico') return <Minha />;
  return id ? <Ficha id={id} /> : <Lista />;
};
export default EstoquePosse;
