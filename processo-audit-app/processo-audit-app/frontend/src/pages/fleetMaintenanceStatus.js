/* ════════════════════════════════════════════════════════
   Preventive-maintenance status helpers (shared)

   A single source of truth for evaluating whether a vehicle's
   maintenance is em dia (green), próxima/em breve (yellow) or
   vencida (red), based on the maintenance type recurrence rules
   (by Km, by date, or both) compared against the vehicle's
   current Km and the last performed maintenance.
   ════════════════════════════════════════════════════════ */
import { AlertCircle, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

/* Warning thresholds — how close to the limit triggers "em breve" */
export const KM_WARN_THRESHOLD   = 1000; // km remaining
export const DAYS_WARN_THRESHOLD = 30;   // days remaining

export const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

const RANK = { red: 3, yellow: 2, green: 1, none: 0 };
const worse = (a, b) => (RANK[a] >= RANK[b] ? a : b);

/**
 * Evaluate a single maintenance type against the vehicle.
 * @returns 'red' | 'yellow' | 'green' | 'none'
 */
export const calcStatus = (item, currentKm) => {
  if (!item.recurrence_mode) return 'none';
  const now = today();
  let worst = 'green';

  if (item.recurrence_mode === 'km' || item.recurrence_mode === 'both') {
    if (item.recurrency) {
      if (item.last_km == null) {
        worst = worse(worst, 'yellow');
      } else {
        const rem = (Number(item.last_km) + Number(item.recurrency)) - Number(currentKm || 0);
        if (rem <= 0)                       worst = worse(worst, 'red');
        else if (rem <= KM_WARN_THRESHOLD)  worst = worse(worst, 'yellow');
      }
    }
  }

  if (item.recurrence_mode === 'date' || item.recurrence_mode === 'both') {
    if (item.recurrency_date) {
      if (!item.last_date) {
        worst = worse(worst, 'yellow');
      } else {
        const next = new Date(item.last_date);
        next.setDate(next.getDate() + Number(item.recurrency_date));
        const days = Math.floor((next - now) / 86400000);
        if (days <= 0)                        worst = worse(worst, 'red');
        else if (days <= DAYS_WARN_THRESHOLD) worst = worse(worst, 'yellow');
      }
    }
  }

  return worst;
};

/**
 * Worst status across every maintenance type for one vehicle.
 * @param {Array} items  maintenance-status rows for the car
 * @returns 'red' | 'yellow' | 'green' | 'none'
 */
export const worstStatus = (items, currentKm) => {
  if (!items || items.length === 0) return 'none';
  return items.reduce((acc, it) => worse(acc, calcStatus(it, currentKm)), 'none');
};

export const STATUS_STYLE = {
  red:    { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.35)', color: '#b91c1c',            icon: AlertCircle,   label: 'Vencida'   },
  yellow: { bg: 'rgba(234,179,8,0.10)', border: 'rgba(234,179,8,0.40)', color: '#92400e',            icon: AlertTriangle, label: 'Em breve'  },
  green:  { bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.30)', color: '#15803d',            icon: CheckCircle2,  label: 'Em dia'    },
  none:   { bg: 'var(--bg-card)',       border: 'var(--border-color)',  color: 'var(--text-medium)', icon: Clock,         label: '—'         },
};

export const fmtDays = days => {
  if (!days) return null;
  if (days % 30 === 0) { const n = days / 30; return `${n} ${n === 1 ? 'mês' : 'meses'}`; }
  if (days % 7  === 0) { const n = days / 7;  return `${n} ${n === 1 ? 'semana' : 'semanas'}`; }
  return `${days} ${days === 1 ? 'dia' : 'dias'}`;
};

/** Human-readable "próxima manutenção" lines for a maintenance type. */
export const nextDueText = (item, currentKm) => {
  const lines = [];
  if ((item.recurrence_mode === 'km' || item.recurrence_mode === 'both') && item.recurrency) {
    const base = item.last_km != null ? Number(item.last_km) : 0;
    const next = base + Number(item.recurrency);
    const rem  = next - Number(currentKm || 0);
    lines.push(rem > 0
      ? `Km: faltam ${Number(rem).toLocaleString('pt-BR')} km (próx. aos ${Number(next).toLocaleString('pt-BR')} km)`
      : `Km: vencido há ${Math.abs(rem).toLocaleString('pt-BR')} km`);
  }
  if ((item.recurrence_mode === 'date' || item.recurrence_mode === 'both') && item.recurrency_date) {
    if (!item.last_date) {
      lines.push(`Data: nunca realizado (a cada ${fmtDays(item.recurrency_date)})`);
    } else {
      const next = new Date(item.last_date);
      next.setDate(next.getDate() + Number(item.recurrency_date));
      const days = Math.floor((next - today()) / 86400000);
      lines.push(days > 0
        ? `Data: faltam ${days} dias (${next.toLocaleDateString('pt-BR')})`
        : `Data: vencido há ${Math.abs(days)} dias`);
    }
  }
  return lines;
};
