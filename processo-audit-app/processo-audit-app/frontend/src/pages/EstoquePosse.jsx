import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { estoqueAPI } from '../api/estoque';
import { useAuth } from '../context/AuthContext';
import { AsyncState, useLoad, OsStatusBadge, fmtQtd, fmtNum, fmtData, fmtDataHora, styles as s } from '../components/estoque/ui';

const TIPOS = { entrada: 'Entrada', retirada: 'Retirada', devolucao: 'Devolução', baixa_os: 'Baixa em OS', estorno: 'Estorno', ajuste: 'Ajuste' };

const TabelaPosse = ({ itens }) => (
  <AsyncState empty={itens.length === 0} emptyTitle="Nenhum material em posse">
    <div className={s.tableWrap}><table className={s.table}>
      <thead><tr><th>Item</th><th>Lote</th><th>Quantidade</th></tr></thead>
      <tbody>{itens.map((p) => (
        <tr key={p.lote_id}><td data-label="Item">{p.item_nome}</td><td data-label="Lote" className={s.mono}>{p.lote_codigo}</td><td data-label="Quantidade" className={s.num}><b>{fmtQtd(p.quantidade, p.unidade)}</b></td></tr>))}</tbody></table></div>
  </AsyncState>
);

const Ficha = ({ id }) => {
  const { loading, error, data, reload } = useLoad(() => estoqueAPI.fichaTecnico(id), [id]);
  return (
    <div className={s.page}>
      <Link to="/estoque/posse" className={s.rowLink} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44 }}><ArrowLeft size={16} />Voltar</Link>
      <AsyncState loading={loading} error={error} onRetry={reload}>
        {data && (<>
          <div><h1 className={s.title}>{data.tecnico.nome}</h1><p className={s.sub}>{data.tecnico.tipo === 'interno' ? 'Técnico interno' : `Equipe terceirizada${data.tecnico.empresa ? ` — ${data.tecnico.empresa}` : ''}`}</p></div>
          <div className={s.card}><h2 className={s.cardTitle}>Em posse agora</h2><TabelaPosse itens={data.itens} /></div>
          <div className={s.card}><h2 className={s.cardTitle}>Ordens de serviço</h2>
            <AsyncState empty={data.os.length === 0} emptyTitle="Sem OS atribuídas">
              <div className={s.tableWrap}><table className={s.table}><thead><tr><th>Nº</th><th>Nome da OS</th><th>Prazo</th><th>Status</th></tr></thead>
                <tbody>{data.os.map((o) => (<tr key={o.id}><td data-label="Nº"><Link className={s.rowLink} to={`/os/${o.id}`}>#{o.numero}</Link></td><td data-label="Nome da OS">{o.cliente}</td><td data-label="Prazo">{fmtData(o.prazo)}</td><td data-label="Status"><OsStatusBadge status={o.status} /></td></tr>))}</tbody></table></div>
            </AsyncState></div>
          <div className={s.card}><h2 className={s.cardTitle}>Histórico</h2>
            <AsyncState empty={data.historico.length === 0} emptyTitle="Sem movimentações">
              <div className={s.tableWrap}><table className={s.table}><thead><tr><th>Quando</th><th>Tipo</th><th>Item</th><th>Lote</th><th>Qtd</th><th>OS</th></tr></thead>
                <tbody>{data.historico.map((m) => (<tr key={m.id}><td data-label="Quando">{fmtDataHora(m.criado_em)}</td><td data-label="Tipo">{TIPOS[m.tipo]}{m.condicao ? ` (${m.condicao})` : ''}</td><td data-label="Item">{m.item_nome}</td><td data-label="Lote" className={s.mono}>{m.lote_codigo}</td><td data-label="Qtd">{fmtQtd(m.quantidade, m.unidade)}</td><td data-label="OS">{m.os_numero ? `#${m.os_numero}` : '—'}</td></tr>))}</tbody></table></div>
            </AsyncState></div>
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
