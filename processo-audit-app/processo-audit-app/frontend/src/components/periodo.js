// Filtro por período (datas "AAAA-MM-DD" no fuso de quem usa). Puro, testado em tests/web_periodo.test.js.

const pad = (n) => String(n).padStart(2, '0');
export const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Data do registro no fuso local: o banco devolve TIMESTAMP em UTC ("...T02:30:00.000Z" pode ser o dia anterior aqui)
export const diaLocal = (valor) => {
  if (!valor) return null;
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : isoLocal(d);
};

/** true quando `valor` cai entre `de` e `ate` (inclusive); limite vazio não restringe. */
export const noPeriodo = (valor, de, ate) => {
  if (!de && !ate) return true;
  const dia = diaLocal(valor);
  if (!dia) return false;
  if (de && dia < de) return false;
  if (ate && dia > ate) return false;
  return true;
};

export const ATALHOS = [
  { id: 'hoje',       label: 'Hoje' },
  { id: '7d',         label: '7 dias' },
  { id: '30d',        label: '30 dias' },
  { id: 'mes',        label: 'Este mês' },
  { id: 'mesPassado', label: 'Mês passado' },
];

export const periodoDoAtalho = (id, hoje = new Date()) => {
  const y = hoje.getFullYear();
  const m = hoje.getMonth();
  const d = hoje.getDate();
  const ate = isoLocal(hoje);
  switch (id) {
    case 'hoje':       return { de: ate, ate };
    case '7d':         return { de: isoLocal(new Date(y, m, d - 6)), ate };
    case '30d':        return { de: isoLocal(new Date(y, m, d - 29)), ate };
    case 'mes':        return { de: isoLocal(new Date(y, m, 1)), ate };
    case 'mesPassado': return { de: isoLocal(new Date(y, m - 1, 1)), ate: isoLocal(new Date(y, m, 0)) };
    default:           return { de: '', ate: '' };
  }
};
