import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { painelAPI } from '../api/estoque';
import { AsyncState, useLoad, StatusBadge, Bars, fmtNum, fmtQtd, styles as s } from '../components/estoque/ui';
import { Select } from '../components/Select/Select';

import DateInput from '../components/DateInput';
const PainelEstoque = () => {
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [tipo, setTipo] = useState('');
  const { loading, error, data, reload } = useLoad(() => painelAPI.uso({ de, ate, tipo }), [de, ate, tipo]);
  const k = data?.kpis;
  const kpis = k && [
    ['Itens no catálogo', k.total_itens], ['Itens em estoque baixo', k.itens_baixos, true], ['Lotes ativos', k.lotes_ativos],
    ['Material em posse de técnicos', fmtNum(k.em_posse)], ['OS abertas / em andamento', `${k.os_abertas} / ${k.os_andamento}`],
  ];

  return (
    <div className={s.page}>
      <div><h1 className={s.title}>Painel de uso</h1><p className={s.sub}>Consumo por técnico, equipe, período e OS</p></div>
      <div className={s.filters}>
        <div className={s.field}><label htmlFor="de">De</label><DateInput id="de" value={de} onChange={(e) => setDe(e.target.value)} /></div>
        <div className={s.field}><label htmlFor="ate">Até</label><DateInput id="ate" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
        <div className={s.field}><label htmlFor="tp">Executor</label><Select id="tp" value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Técnicos e equipes</option><option value="interno">Técnicos internos</option><option value="terceirizado">Equipes terceirizadas</option></Select></div>
      </div>
      <AsyncState loading={loading} error={error} onRetry={reload}>
        {data && (<>
          <div className={s.kpis}>{kpis.map(([l, v, warn]) => <div key={l} className={`${s.kpi} ${warn ? s.kpiWarn : ''}`}><b>{v}</b><span>{l}</span></div>)}</div>
          <div className={s.grid2}>
            <div className={s.card}><h2 className={s.cardTitle}>Cabo consumido por técnico/equipe (m)</h2>
              <AsyncState empty={data.por_tecnico.length === 0} emptyTitle="Sem consumo no período">
                <Bars rows={data.por_tecnico.filter((t) => t.metros > 0).map((t) => ({ key: t.id, label: t.nome, value: t.metros }))} fmt={(v) => `${fmtNum(v)} m`} /></AsyncState></div>
            <div className={s.card}><h2 className={s.cardTitle}>Peças consumidas por técnico/equipe</h2>
              <AsyncState empty={data.por_tecnico.length === 0} emptyTitle="Sem consumo no período">
                <Bars rows={data.por_tecnico.filter((t) => t.pecas > 0).map((t) => ({ key: t.id, label: t.nome, value: t.pecas }))} /></AsyncState></div>
          </div>
          <div className={s.grid2}>
            <div className={s.card}><h2 className={s.cardTitle}>Consumo por OS</h2>
              <AsyncState empty={data.por_os.length === 0} emptyTitle="Sem consumo no período">
                <div className={s.tableWrap}><table className={s.table}><thead><tr><th>OS</th><th>Nome da OS</th><th>Cabo (m)</th><th>Peças</th></tr></thead>
                  <tbody>{data.por_os.map((o) => (<tr key={o.id}><td data-label="OS"><Link className={s.rowLink} to={`/os/${o.id}`}>#{o.numero}</Link></td><td data-label="Nome da OS">{o.cliente}</td><td data-label="Cabo (m)">{fmtNum(o.metros)}</td><td data-label="Peças">{fmtNum(o.pecas)}</td></tr>))}</tbody></table></div></AsyncState></div>
            <div className={s.card}><h2 className={s.cardTitle}>Itens mais consumidos</h2>
              <AsyncState empty={data.por_item.length === 0} emptyTitle="Sem consumo no período">
                <Bars rows={data.por_item.map((i) => ({ key: i.id, label: i.nome, value: i.total }))} /></AsyncState></div>
          </div>
          <div className={s.card}>
            <h2 className={s.cardTitle}>Alertas de estoque</h2>
            <AsyncState empty={data.alertas.length === 0} emptyTitle="Nenhum item abaixo do mínimo">
              <div className={s.tableWrap}><table className={s.table}><thead><tr><th>Item</th><th>Saldo</th><th>Mínimo</th><th>Status</th></tr></thead>
                <tbody>{data.alertas.map((i) => (<tr key={i.id}><td data-label="Item"><Link className={s.rowLink} to="/estoque/itens">{i.nome}</Link></td><td data-label="Saldo">{fmtQtd(i.saldo, i.unidade)}</td><td data-label="Mínimo">{fmtQtd(i.estoque_minimo, i.unidade)}</td><td data-label="Status"><StatusBadge status={i.status} /></td></tr>))}</tbody></table></div>
            </AsyncState>
          </div>
        </>)}
      </AsyncState>
    </div>
  );
};
export default PainelEstoque;
