/*
 * Tema compartilhado dos gráficos da Frota (Chart.js).
 * Os valores espelham os tokens de styles/global.css — o verde da marca é
 * o acento das séries e a rampa neutra cobre comparações e categorias zeradas.
 */

export const BRAND      = '#0ba52b'; // --primary-color
export const TEXT_LIGHT = '#6b7280'; // --text-light
export const TEXT_DARK  = '#1a1a1a'; // --text-dark
export const NEUTRAL    = '#9ca3af'; // --text-muted
export const GRID_COLOR = 'rgba(0, 0, 0, 0.05)';

export const ZERO_FILL   = 'rgba(156, 163, 175, 0.18)'; // categorias sem valor
export const ZERO_BORDER = 'rgba(156, 163, 175, 0.55)';

/* Paleta categórica: marca primeiro, depois a rampa neutra dos tokens */
export const CATEGORICAL = [
  BRAND,
  '#9ca3af', // --text-muted
  '#6b7280', // --text-light
  '#e5e7eb', // --border-color
  '#374151', // --text-medium
  '#274518', // --accent-color
  '#bbf804', // --secondary-color
];

export const FONT_FAMILY =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export const brl = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* Gradiente vertical suave em vez de bloco chapado; cinza quando o valor é zero */
const barFill = (ctx) => {
  const value = Number(ctx.raw) || 0;
  const { ctx: canvas, chartArea } = ctx.chart;
  if (value === 0) return ZERO_FILL;
  if (!chartArea) return 'rgba(11, 165, 43, 0.3)'; // primeiro passe, sem área ainda
  const gradient = canvas.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
  gradient.addColorStop(0, 'rgba(11, 165, 43, 0.10)');
  gradient.addColorStop(1, 'rgba(11, 165, 43, 0.48)');
  return gradient;
};

const barBorder = (ctx) => ((Number(ctx.raw) || 0) === 0 ? ZERO_BORDER : BRAND);

/* Dataset padrão: topo arredondado, base reta */
export const barDataset = (label, data) => ({
  label,
  data,
  backgroundColor: barFill,
  borderColor: barBorder,
  borderWidth: 1.5,
  borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
  borderSkipped: 'bottom',
  maxBarThickness: 72,
});

export const tooltipStyle = {
  backgroundColor: TEXT_DARK,
  titleFont: { family: FONT_FAMILY, size: 12, weight: '600' },
  bodyFont: { family: FONT_FAMILY, size: 12 },
  padding: 10,
  cornerRadius: 8,
  displayColors: false,
  borderColor: 'rgba(255, 255, 255, 0.12)',
  borderWidth: 1,
};

export const axisTicks = {
  font: { family: FONT_FAMILY, size: 11 },
  color: TEXT_LIGHT,
  padding: 6,
};

/*
 * formatValue: formata o valor no tooltip.
 * integerOnly: contagens não têm meia unidade — evita eixo com 0,1 / 0,2 …
 * titleCallback: rótulo completo no tooltip quando o eixo X é abreviado.
 */
export const makeBarOptions = ({ formatValue, integerOnly = false, titleCallback, xTicks } = {}) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      ...tooltipStyle,
      callbacks: {
        ...(titleCallback ? { title: titleCallback } : {}),
        label: (ctx) => ` ${formatValue ? formatValue(ctx.parsed.y) : ctx.parsed.y.toLocaleString('pt-BR')}`,
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: GRID_COLOR },
      border: { display: false },
      ticks: {
        ...axisTicks,
        precision: integerOnly ? 0 : undefined,
        stepSize: integerOnly ? 1 : undefined,
      },
    },
    x: {
      grid: { display: false },
      border: { color: 'rgba(0, 0, 0, 0.08)' },
      ticks: { ...axisTicks, ...xTicks },
    },
  },
});
