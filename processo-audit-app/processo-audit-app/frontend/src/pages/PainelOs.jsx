import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { painelAPI } from '../api/estoque';
import { AsyncState, useLoad, Bars, OsStatusBadge, PrioridadeBadge, fmtNum, fmtData, styles as s } from '../components/estoque/ui';
import { Kpi, Kpis, Delta, PeriodoFiltro, rangeDe, descPeriodo, LinhaTempo, Segmentos, TecnicoFiltro, fmtHoras, COR, TOM, painelCss as c } from '../components/painel/painel';

/* Painel de ORDENS DE SERVIÇO: fila, prazo, vazão (criadas × concluídas) e carga por técnico. */
const PainelOs = () => {
  const [dias, setDias] = useState(30);
  const [tec, setTec] = useState('');
  const r = { ...rangeDe(dias), ...(tec && { tecnico_id: tec }) };
  const { loading, error, data: d, reload } = useLoad(() => painelAPI.os(r), [dias, tec]);
  const k = d?.kpis;
  const saldoFila = d && d.atual.criadas - d.atual.concluidas;
  const pont = d?.atual.pontualidade;

  return (
    <div className={s.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div><h1 className={s.title}>Painel de ordens de serviço</h1><p className={s.sub}>Fila atual e desempenho — {descPeriodo(dias)}</p></div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <TecnicoFiltro value={tec} onChange={setTec} />
          <PeriodoFiltro dias={dias} onChange={setDias} />
        </div>
      </div>
      <AsyncState loading={loading} error={error} onRetry={reload}>
        {d && (<>
          <Kpis>
            <Kpi label="OS atrasadas" value={k.atrasadas} tom={k.atrasadas ? 'critico' : undefined} foot={k.atrasadas ? 'Prazo vencido e não concluídas' : 'Nenhuma fora do prazo'} />
            <Kpi label="Em aberto agora" value={k.abertas + k.em_andamento} foot={`${k.abertas} abertas · ${k.em_andamento} em andamento`} />
            <Kpi label="Alta prioridade em aberto" value={k.alta_prioridade} tom={k.alta_prioridade ? 'alerta' : undefined} />
            <Kpi label="Concluídas" value={d.atual.concluidas} foot={<Delta atual={d.atual.concluidas} anterior={d.anterior.concluidas} bom="subir" />} />
            <Kpi label="No prazo" value={pont === null ? '—' : `${Math.round(pont * 100)}%`}
              foot={pont === null ? 'Sem OS com prazo concluídas' : <Delta atual={Math.round(pont * 100)} anterior={d.anterior.pontualidade === null ? null : Math.round(d.anterior.pontualidade * 100)} bom="subir" suffix="%" />} />
            <Kpi label="Tempo médio até concluir" value={fmtHoras(d.atual.lead_horas)}
              foot={<Delta atual={d.atual.lead_horas} anterior={d.anterior.lead_horas} bom="descer" fmt={fmtHoras} />} />
          </Kpis>

          <div className={s.card}>
            <h2 className={s.cardTitle}>Vazão: criadas × concluídas por dia</h2>
            <p className={c.insight}>{saldoFila > 0 ? `A fila cresceu: ${saldoFila} OS a mais abertas do que concluídas no período.` : saldoFila < 0 ? `A fila diminuiu: ${-saldoFila} OS a mais concluídas do que abertas no período.` : 'Entrada e saída equilibradas no período.'}</p>
            <LinhaTempo serie={d.serie} unidade="OS" linhas={[{ campo: 'criadas', label: 'Criadas', cor: COR.b, tracejada: true }, { campo: 'concluidas', label: 'Concluídas', cor: COR.a }]} />
          </div>

          <div className={s.grid2}>
            <div className={s.card}><h2 className={s.cardTitle}>Idade das OS em aberto</h2>
              <p className={c.note}>Quanto tempo as OS abertas estão esperando desde a criação.</p>
              <AsyncState empty={d.aging.every(([, v]) => v === 0)} emptyTitle="Nenhuma OS em aberto">
                <Segmentos itens={d.aging.map(([label, valor], i) => ({ label, valor, cor: [TOM.ok, '#a3a3a3', TOM.alerta, TOM.critico][i] }))} /></AsyncState></div>
            <div className={s.card}><h2 className={s.cardTitle}>Tipos de serviço no período</h2>
              <AsyncState empty={d.por_tipo.length === 0} emptyTitle="Sem OS criadas no período">
                <Bars rows={d.por_tipo.map((t) => ({ key: t.nome, label: t.nome, value: t.total }))} /></AsyncState></div>
          </div>

          <div className={s.card}>
            <h2 className={s.cardTitle}>Atrasadas — ação necessária</h2>
            <AsyncState empty={d.atrasadas.length === 0} emptyTitle="Nenhuma OS atrasada">
              <div className={s.tableWrap}><table className={s.table}>
                <thead><tr><th>OS</th><th>Cliente</th><th>Técnico / equipe</th><th>Prazo</th><th>Atraso</th><th>Prioridade</th><th>Status</th></tr></thead>
                <tbody>{d.atrasadas.map((o) => (
                  <tr key={o.id}>
                    <td data-label="OS"><Link className={s.rowLink} to={`/os/${o.id}`}>#{o.numero}</Link></td>
                    <td data-label="Cliente">{o.cliente}</td><td data-label="Técnico / equipe">{o.tecnico}</td>
                    <td data-label="Prazo">{fmtData(o.prazo)}</td><td data-label="Atraso" className={c.tnum}>{o.dias_atraso} {o.dias_atraso === 1 ? 'dia' : 'dias'}</td>
                    <td data-label="Prioridade"><PrioridadeBadge p={o.prioridade} /></td><td data-label="Status"><OsStatusBadge status={o.status} /></td>
                  </tr>))}</tbody></table></div>
            </AsyncState>
          </div>

          {!tec && <div className={s.card}>
            <h2 className={s.cardTitle}>Carga e desempenho por técnico/equipe</h2>
            <AsyncState empty={d.por_tecnico.length === 0} emptyTitle="Sem OS para os técnicos neste período">
              <div className={s.tableWrap}><table className={s.table}>
                <thead><tr><th>Técnico / equipe</th><th>Em aberto</th><th>Atrasadas</th><th>Concluídas no período</th><th>Tempo médio</th></tr></thead>
                <tbody>{d.por_tecnico.map((t) => (
                  <tr key={t.id}>
                    <td data-label="Técnico / equipe">{t.nome}</td><td data-label="Em aberto" className={c.tnum}>{t.em_aberto}</td>
                    <td data-label="Atrasadas" className={c.tnum}>{t.atrasadas > 0 ? <b style={{ color: 'var(--error)' }}>{t.atrasadas}</b> : 0}</td>
                    <td data-label="Concluídas no período" className={c.tnum}>{t.concluidas}</td><td data-label="Tempo médio" className={c.tnum}>{fmtHoras(t.lead_horas)}</td>
                  </tr>))}</tbody></table></div>
            </AsyncState>
          </div>}
        </>)}
      </AsyncState>
    </div>
  );
};
export default PainelOs;
