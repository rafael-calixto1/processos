const dois = (n: number) => String(n).padStart(2, '0');

/** "HH:MM" no horário do aparelho (ou "—" se a data for inválida). */
export const fmtHora = (iso: string | null | undefined): string => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? `${dois(d.getHours())}:${dois(d.getMinutes())}` : '—';
};

/** "dd/mm/aaaa HH:MM" no horário do aparelho. */
export const fmtDataHora = (iso: string | null | undefined): string => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${fmtHora(iso)}` : '—';
};

/** "dd/mm/aaaa" de uma data pura (YYYY-MM-DD), sem mudar de dia por causa do fuso. */
export const fmtData = (ymd: string | null | undefined): string => {
  const m = ymd ? /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
};

/** Rótulo do tipo "Atualizado às 10:30" (ou "Atualizado em 09/10 às 10:30" se não for de hoje). */
export const rotuloAtualizacao = (iso: string | null | undefined, agora: Date = new Date()): string => {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return 'Ainda não atualizado';
  const mesmoDia = d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth() && d.getDate() === agora.getDate();
  return mesmoDia ? `Atualizado às ${fmtHora(iso)}` : `Atualizado em ${dois(d.getDate())}/${dois(d.getMonth() + 1)} às ${fmtHora(iso)}`;
};
