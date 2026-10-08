import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import {
  Chart as ChartJS, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { fmtNum } from '../estoque/ui';
import css from './painel.module.css';

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler);

/* Duas cores categóricas com contraste entre si e com o fundo claro; a identidade nunca é só cor (legenda + tooltip) */
export const COR = { a: '#0a8a24', b: '#2563eb' };
export const TOM = { ok: '#16a34a', alerta: '#d97706', critico: '#dc2626', neutro: '#9ca3af' };

/* Variação vs período anterior. `bom`: 'subir' | 'descer' | null (neutro) define se a mudança é boa ou ruim. */
export const Delta = ({ atual, anterior, bom = null, fmt = fmtNum, suffix = '' }) => {
  if (anterior === null || anterior === undefined || atual === null || atual === undefined) return <span className={css.flat}>sem base de comparação</span>;
  if (anterior === 0 && atual === 0) return <span className={css.flat}>igual ao período anterior</span>;
  const diff = atual - anterior;
  const pct = anterior === 0 ? null : (diff / anterior) * 100;
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
  const tom = diff === 0 || !bom ? css.flat : ((diff > 0) === (bom === 'subir') ? css.good : css.bad);
  return (
    <span>
      <span className={`${css.delta} ${tom}`}>
        <Icon size={14} aria-hidden="true" />{pct === null ? `+${fmt(diff)}${suffix}` : `${diff > 0 ? '+' : ''}${fmtNum(pct)}%`}
      </span>{' '}
      <span className={css.flat}>vs {fmt(anterior)}{suffix} antes</span>
    </span>
  );
};

export const Kpi = ({ label, value, unit, foot, tom }) => (
  <div className={`${css.kpi} ${tom === 'alerta' ? css.kpiWarn : ''} ${tom === 'critico' ? css.kpiCrit : ''}`}>
    <span className={css.kpiLabel}>{label}</span>
    <span className={css.kpiValue}>{value}{unit && <span className={css.kpiUnit}>{unit}</span>}</span>
    {foot && <span className={css.kpiFoot}>{foot}</span>}
  </div>
);
export const Kpis = ({ children }) => <div className={css.kpis}>{children}</div>;

const PRESETS = [[7, '7 dias'], [30, '30 dias'], [90, '90 dias']];
const isoDia = (d) => d.toISOString().slice(0, 10);
const dmy = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
/* valor do período: número (últimos N dias) ou { de, ate } (datas personalizadas) */
export const PeriodoFiltro = ({ dias, onChange }) => {
  const custom = typeof dias === 'object';
  const [aberto, setAberto] = React.useState(custom);
  const [de, setDe] = React.useState(custom ? dias.de : '');
  const [ate, setAte] = React.useState(custom ? dias.ate : '');
  const valido = de && ate && de <= ate;
  return (
    <div className={css.periodo}>
      <div className={css.presets} role="group" aria-label="Período">
        {PRESETS.map(([n, l]) => <button key={n} type="button" aria-pressed={dias === n} onClick={() => { setAberto(false); onChange(n); }}>{l}</button>)}
        <button type="button" aria-pressed={custom || aberto} onClick={() => setAberto(true)}>Personalizado</button>
      </div>
      {aberto && (
        <div className={css.datas}>
          <input type="date" aria-label="Data inicial" value={de} max={ate || undefined} onChange={(e) => setDe(e.target.value)} />
          <span>até</span>
          <input type="date" aria-label="Data final" value={ate} min={de || undefined} onChange={(e) => setAte(e.target.value)} />
          <button type="button" disabled={!valido} onClick={() => onChange({ de, ate })}>Aplicar</button>
        </div>
      )}
    </div>
  );
};
export const rangeDe = (v) => {
  if (typeof v === 'object') return { de: v.de, ate: v.ate };
  const ate = new Date(); const de = new Date(); de.setDate(de.getDate() - (v - 1));
  return { de: isoDia(de), ate: isoDia(ate) };
};
export const descPeriodo = (v) => {
  if (typeof v !== 'object') return `últimos ${v} dias, comparados aos ${v} anteriores`;
  const n = Math.round((new Date(v.ate) - new Date(v.de)) / 86400000) + 1;
  return `${dmy(v.de)} a ${dmy(v.ate)}, comparados aos ${n} ${n === 1 ? 'dia' : 'dias'} anteriores`;
};

const fmtDia = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/* Linhas finas, grade discreta, tooltip com todas as séries do dia (crosshair por índice). */
export const LinhaTempo = ({ serie, linhas, unidade = '', altura }) => {
  const data = {
    labels: serie.map((d) => fmtDia(d.dia)),
    datasets: linhas.map((l) => ({
      label: l.label, data: serie.map((d) => d[l.campo]), borderColor: l.cor, backgroundColor: l.cor,
      borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBorderWidth: 2, pointHoverBorderColor: '#fff', tension: 0.25,
      borderDash: l.tracejada ? [5, 4] : undefined,
    })),
  };
  const options = {
    responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmtNum(c.parsed.y)}${unidade ? ` ${unidade}` : ''}` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { maxTicksLimit: 8, color: '#6b7280' }, border: { color: '#d1d5db' } },
      y: { beginAtZero: true, grid: { color: '#eef0f3' }, border: { display: false }, ticks: { maxTicksLimit: 5, color: '#6b7280', callback: (v) => fmtNum(v) } },
    },
  };
  return (
    <>
      <div className={css.legend}>
        {linhas.map((l) => (
          <span key={l.campo}><i className={css.swatch} style={{ background: l.cor, ...(l.tracejada && { background: `repeating-linear-gradient(90deg, ${l.cor} 0 5px, transparent 5px 8px)` }) }} />{l.label}</span>
        ))}
      </div>
      <div className={css.chartBox} style={altura ? { height: altura } : undefined}>
        <Line data={data} options={options} aria-label={linhas.map((l) => l.label).join(' e ')} role="img" />
      </div>
    </>
  );
};

/* Barra segmentada (parte de um todo) com valores em texto — usada em saúde do estoque e aging */
export const Segmentos = ({ itens }) => {
  const total = itens.reduce((s, i) => s + i.valor, 0);
  return (
    <>
      <div className={css.seg} role="img" aria-label={itens.map((i) => `${i.label}: ${i.valor}`).join(', ')}>
        {itens.filter((i) => i.valor > 0).map((i) => <div key={i.label} style={{ flex: i.valor, background: i.cor }} title={`${i.label}: ${i.valor}`} />)}
      </div>
      <div className={css.segLegend}>
        {itens.map((i) => (
          <span key={i.label}><i className={css.dot} style={{ background: i.cor }} />{i.label} <b>{i.valor}</b>{total > 0 && <span className={css.flat}> ({Math.round((i.valor / total) * 100)}%)</span>}</span>
        ))}
      </div>
    </>
  );
};

export const fmtHoras = (h) => {
  if (h === null || h === undefined) return '—';
  return h < 48 ? `${fmtNum(h)} h` : `${fmtNum(h / 24)} d`;
};
export { css as painelCss };
