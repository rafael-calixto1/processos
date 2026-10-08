import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { painelAPI } from '../api/estoque';
import { AsyncState, useLoad, StatusBadge, Bars, fmtNum, fmtQtd, styles as s } from '../components/estoque/ui';
import { Kpi, Kpis, Delta, PeriodoFiltro, rangeDe, descPeriodo, LinhaTempo, Segmentos, TecnicoFiltro, COR, TOM, painelCss as c } from '../components/painel/painel';

/* Painel de ESTOQUE: saúde do saldo, reposição, ritmo de consumo e material em campo. */
const PainelEstoque = () => {
  const [dias, setDias] = useState(30);
  const [tec, setTec] = useState('');
  const r = { ...rangeDe(dias), ...(tec && { tecnico_id: tec }) };
  const { loading, error, data, reload } = useLoad(async () => {
    const [resumo, uso] = await Promise.all([painelAPI.estoque(r), tec ? null : painelAPI.uso(r)]);
    return { resumo, uso };
  }, [dias, tec]);
  const d = data?.resumo, uso = data?.uso, k = d?.kpis;
  const semAlerta = k && k.baixo + k.zerado === 0;

  return (
    <div className={s.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div><h1 className={s.title}>{d?.tecnico ? `Estoque de ${d.tecnico.nome}` : 'Painel de estoque'}</h1><p className={s.sub}>{tec ? 'Material em posse, retiradas e consumo' : 'Saldo, reposição e consumo'} — {descPeriodo(dias)}</p></div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <TecnicoFiltro value={tec} onChange={setTec} />
          <PeriodoFiltro dias={dias} onChange={setDias} />
        </div>
      </div>
      <AsyncState loading={loading} error={error} onRetry={reload}>
        {d && d.tecnico && (<>
          <Kpis>
            <Kpi label="Cabo em posse" value={fmtNum(k.posse_metros)} unit="m" />
            <Kpi label="Peças em posse" value={fmtNum(k.posse_pecas)} unit="un" />
            <Kpi label="Cabo consumido" value={fmtNum(d.consumo.atual.metros)} unit="m" foot={<Delta atual={d.consumo.atual.metros} anterior={d.consumo.anterior.metros} />} />
            <Kpi label="Peças consumidas" value={fmtNum(d.consumo.atual.pecas)} unit="un" foot={<Delta atual={d.consumo.atual.pecas} anterior={d.consumo.anterior.pecas} />} />
            <Kpi label="OS em aberto" value={k.os_abertas} />
            <Kpi label="Devoluções pendentes" value={k.devolucoes_pendentes} tom={k.devolucao_mais_antiga_dias >= 3 ? 'alerta' : undefined}
              foot={k.devolucoes_pendentes ? <Link className={s.rowLink} to="/estoque/devolucoes">Mais antiga: {k.devolucao_mais_antiga_dias} d — revisar</Link> : 'Nenhuma pendente'} />
          </Kpis>
          <div className={s.grid2}>
            <div className={s.card}><h2 className={s.cardTitle}>Cabo (m): retiradas × consumo por dia</h2>
              <LinhaTempo serie={d.serie} unidade="m" linhas={[{ campo: 'consumo_metros', label: 'Consumo', cor: COR.a }, { campo: 'entrada_metros', label: 'Retirada', cor: COR.b, tracejada: true }]} /></div>
            <div className={s.card}><h2 className={s.cardTitle}>Peças (un): retiradas × consumo por dia</h2>
              <LinhaTempo serie={d.serie} unidade="un" linhas={[{ campo: 'consumo_pecas', label: 'Consumo', cor: COR.a }, { campo: 'entrada_pecas', label: 'Retirada', cor: COR.b, tracejada: true }]} /></div>
          </div>
          <div className={s.grid2}>
            <div className={s.card}><h2 className={s.cardTitle}>Em posse agora</h2>
              <AsyncState empty={d.posse.length === 0} emptyTitle="Nenhum material em posse">
                <div className={s.tableWrap}><table className={s.table}><thead><tr><th>Item</th><th>Lotes</th><th>Quantidade</th></tr></thead>
                  <tbody>{d.posse.map((i) => (<tr key={i.id}><td data-label="Item">{i.nome}</td><td data-label="Lotes" className={c.tnum}>{i.lotes}</td><td data-label="Quantidade" className={c.tnum}><b>{fmtQtd(i.quantidade, i.unidade)}</b></td></tr>))}</tbody></table></div></AsyncState></div>
            <div className={s.card}><h2 className={s.cardTitle}>Itens consumidos no período</h2>
              <AsyncState empty={d.por_item.length === 0} emptyTitle="Sem consumo no período">
                <Bars rows={d.por_item.map((i) => ({ key: i.id, label: `${i.nome} (${i.unidade === 'metros' ? 'm' : 'un'})`, value: i.total }))} /></AsyncState></div>
          </div>
          <div className={s.card}><h2 className={s.cardTitle}>Consumo por OS</h2>
            <AsyncState empty={d.por_os.length === 0} emptyTitle="Sem consumo no período">
              <div className={s.tableWrap}><table className={s.table}><thead><tr><th>OS</th><th>Cliente</th><th>Cabo (m)</th><th>Peças</th></tr></thead>
                <tbody>{d.por_os.map((o) => (<tr key={o.id}><td data-label="OS"><Link className={s.rowLink} to={`/os/${o.id}`}>#{o.numero}</Link></td><td data-label="Cliente">{o.cliente}</td><td data-label="Cabo (m)" className={c.tnum}>{fmtNum(o.metros)}</td><td data-label="Peças" className={c.tnum}>{fmtNum(o.pecas)}</td></tr>))}</tbody></table></div></AsyncState></div>
          <Link className={s.rowLink} to={`/estoque/posse/${tec}`}>Ver ficha completa e histórico do técnico →</Link>
        </>)}
        {d && !d.tecnico && (<>
          <Kpis>
            <Kpi label="Itens zerados" value={k.zerado} tom={k.zerado ? 'critico' : undefined} foot={k.zerado ? 'Reposição imediata' : 'Nenhum item zerado'} />
            <Kpi label="Itens abaixo do mínimo" value={k.baixo} tom={k.baixo ? 'alerta' : undefined} foot={`de ${k.itens - k.sem_uso} itens em uso`} />
            <Kpi label="Cabo consumido" value={fmtNum(d.consumo.atual.metros)} unit="m" foot={<Delta atual={d.consumo.atual.metros} anterior={d.consumo.anterior.metros} />} />
            <Kpi label="Peças consumidas" value={fmtNum(d.consumo.atual.pecas)} unit="un" foot={<Delta atual={d.consumo.atual.pecas} anterior={d.consumo.anterior.pecas} />} />
            <Kpi label="Material com técnicos" value={fmtNum(k.em_posse)} foot={`${k.lotes_ativos} lotes ativos no estoque`} />
            <Kpi label="Devoluções a aprovar" value={k.devolucoes_pendentes} tom={k.devolucao_mais_antiga_dias >= 3 ? 'alerta' : undefined}
              foot={k.devolucoes_pendentes ? <Link className={s.rowLink} to="/estoque/devolucoes">Mais antiga: {k.devolucao_mais_antiga_dias} d — revisar</Link> : 'Fila vazia'} />
          </Kpis>

          <div className={s.card}>
            <h2 className={s.cardTitle}>Saúde do estoque</h2>
            <p className={c.insight}>{semAlerta ? 'Todos os itens estão acima do mínimo.' : `${k.baixo + k.zerado} de ${k.itens - k.sem_uso} itens em uso precisam de reposição.`}</p>
            <Segmentos itens={[{ label: 'OK', valor: k.ok, cor: TOM.ok }, { label: 'Abaixo do mínimo', valor: k.baixo, cor: TOM.alerta }, { label: 'Zerado', valor: k.zerado, cor: TOM.critico }, { label: 'Sem uso (catálogo)', valor: k.sem_uso, cor: TOM.neutro }]} />
          </div>

          <div className={s.grid2}>
            <div className={s.card}><h2 className={s.cardTitle}>Cabo (m): entradas × consumo por dia</h2>
              <LinhaTempo serie={d.serie} unidade="m" linhas={[{ campo: 'consumo_metros', label: 'Consumo', cor: COR.a }, { campo: 'entrada_metros', label: 'Entrada', cor: COR.b, tracejada: true }]} /></div>
            <div className={s.card}><h2 className={s.cardTitle}>Peças (un): entradas × consumo por dia</h2>
              <LinhaTempo serie={d.serie} unidade="un" linhas={[{ campo: 'consumo_pecas', label: 'Consumo', cor: COR.a }, { campo: 'entrada_pecas', label: 'Entrada', cor: COR.b, tracejada: true }]} /></div>
          </div>

          <div className={s.card}>
            <h2 className={s.cardTitle}>Prioridade de reposição</h2>
            <p className={c.note}>Itens abaixo do mínimo ou com menos de 15 dias de cobertura no ritmo de consumo do período.</p>
            <AsyncState empty={d.reposicao.length === 0} emptyTitle="Nenhum item pede reposição">
              <div className={s.tableWrap}><table className={s.table}>
                <thead><tr><th>Item</th><th>Saldo</th><th>Mínimo</th><th>Consumo no período</th><th>Cobertura</th><th>Status</th></tr></thead>
                <tbody>{d.reposicao.map((i) => (
                  <tr key={i.id}>
                    <td data-label="Item"><Link className={s.rowLink} to="/estoque/itens">{i.nome}</Link></td>
                    <td data-label="Saldo" className={c.tnum}>{fmtQtd(i.saldo, i.unidade)}</td>
                    <td data-label="Mínimo" className={c.tnum}>{fmtQtd(i.minimo, i.unidade)}</td>
                    <td data-label="Consumo no período" className={c.tnum}>{fmtQtd(i.consumo, i.unidade)}</td>
                    <td data-label="Cobertura" className={c.tnum}>{i.cobertura_dias === null ? 'sem consumo' : `${fmtNum(i.cobertura_dias)} dias`}</td>
                    <td data-label="Status"><StatusBadge status={i.status} /></td>
                  </tr>))}</tbody></table></div>
            </AsyncState>
          </div>

          <div className={s.grid2}>
            <div className={s.card}><h2 className={s.cardTitle}>Cabo com cada técnico/equipe (m)</h2>
              <AsyncState empty={!d.posse.some((t) => t.metros > 0)} emptyTitle="Nenhum cabo em posse">
                <Bars rows={d.posse.filter((t) => t.metros > 0).map((t) => ({ key: t.id, label: t.nome, value: t.metros }))} fmt={(v) => `${fmtNum(v)} m`} /></AsyncState></div>
            <div className={s.card}><h2 className={s.cardTitle}>Peças com cada técnico/equipe</h2>
              <AsyncState empty={!d.posse.some((t) => t.pecas > 0)} emptyTitle="Nenhuma peça em posse">
                <Bars rows={d.posse.filter((t) => t.pecas > 0).map((t) => ({ key: t.id, label: t.nome, value: t.pecas }))} /></AsyncState></div>
          </div>

          <h2 className={s.cardTitle} style={{ marginTop: 8 }}>Consumo no período</h2>
          <div className={s.grid2}>
            <div className={s.card}><h2 className={s.cardTitle}>Itens mais consumidos</h2>
              <AsyncState empty={uso.por_item.length === 0} emptyTitle="Sem consumo no período">
                <Bars rows={uso.por_item.map((i) => ({ key: i.id, label: `${i.nome} (${i.unidade === 'metros' ? 'm' : 'un'})`, value: i.total }))} /></AsyncState></div>
            <div className={s.card}><h2 className={s.cardTitle}>Consumo por técnico/equipe</h2>
              <AsyncState empty={uso.por_tecnico.length === 0} emptyTitle="Sem consumo no período">
                <div className={s.tableWrap}><table className={s.table}><thead><tr><th>Técnico / equipe</th><th>Cabo (m)</th><th>Peças</th></tr></thead>
                  <tbody>{uso.por_tecnico.map((t) => (<tr key={t.id}><td data-label="Técnico / equipe">{t.nome}</td><td data-label="Cabo (m)" className={c.tnum}>{fmtNum(t.metros)}</td><td data-label="Peças" className={c.tnum}>{fmtNum(t.pecas)}</td></tr>))}</tbody></table></div></AsyncState></div>
          </div>
          <div className={s.card}><h2 className={s.cardTitle}>Consumo por OS</h2>
            <AsyncState empty={uso.por_os.length === 0} emptyTitle="Sem consumo no período">
              <div className={s.tableWrap}><table className={s.table}><thead><tr><th>OS</th><th>Cliente</th><th>Cabo (m)</th><th>Peças</th></tr></thead>
                <tbody>{uso.por_os.map((o) => (<tr key={o.id}><td data-label="OS"><Link className={s.rowLink} to={`/os/${o.id}`}>#{o.numero}</Link></td><td data-label="Cliente">{o.cliente}</td><td data-label="Cabo (m)" className={c.tnum}>{fmtNum(o.metros)}</td><td data-label="Peças" className={c.tnum}>{fmtNum(o.pecas)}</td></tr>))}</tbody></table></div></AsyncState></div>
        </>)}
      </AsyncState>
    </div>
  );
};
export default PainelEstoque;
