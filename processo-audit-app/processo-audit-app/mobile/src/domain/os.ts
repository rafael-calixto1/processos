import type { OS, Prioridade, StatusOS } from './tipos';

export const isPendente = (status: StatusOS): boolean => status === 'aberta' || status === 'em_andamento';

export const STATUS_LABEL: Record<StatusOS, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export const PRIORIDADE_LABEL: Record<Prioridade, string> = { alta: 'Alta', normal: 'Normal', baixa: 'Baixa' };

export type EstadoSla = 'estourado' | 'em_risco' | 'no_prazo' | 'sem_prazo';
export interface SlaInfo { label: string; estado: EstadoSla }

/** O prazo da OS é uma data; vale até o fim desse dia no horário do aparelho (como no web). */
export const fimDoPrazo = (prazo: string | null): Date | null => (prazo ? new Date(`${prazo.slice(0, 10)}T23:59:59`) : null);

/** Contagem regressiva do prazo, com os mesmos textos e a mesma regra de "em risco" (menos de 4 h) do web. */
export const slaInfo = (prazo: string | null, agora: number = Date.now()): SlaInfo => {
  const fim = fimDoPrazo(prazo);
  if (!fim || Number.isNaN(fim.getTime())) return { label: 'Sem prazo', estado: 'sem_prazo' };
  const ms = fim.getTime() - agora;
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const txt = h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${String(m).padStart(2, '0')}min`;
  if (ms < 0) return { label: `Estourado há ${txt}`, estado: 'estourado' };
  return { label: `Restam ${txt}`, estado: ms < 4 * 3600000 ? 'em_risco' : 'no_prazo' };
};

/** Mais urgentes primeiro (prazo mais próximo); sem prazo por último; empate pelo número da OS. */
export const ordenarPorPrazo = <T extends Pick<OS, 'prazo' | 'numero'>>(lista: readonly T[]): T[] =>
  [...lista].sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999') || a.numero - b.numero);

/** Endereço em uma linha, usando o campo livre ou, na falta dele, os campos estruturados. */
export const enderecoLinha = (os: Pick<OS, 'endereco' | 'logradouro' | 'numero_endereco' | 'bairro' | 'cidade' | 'uf'>): string => {
  if (os.endereco?.trim()) return os.endereco.trim();
  const rua = [os.logradouro, os.numero_endereco].filter(Boolean).join(', ');
  const cidade = [os.cidade, os.uf].filter(Boolean).join('/');
  return [rua, os.bairro, cidade].filter(Boolean).join(' · ');
};

/** Link para abrir no app de mapas do celular: coordenadas quando há, senão a busca pelo endereço. */
export const urlMapa = (os: Pick<OS, 'latitude' | 'longitude'> & Parameters<typeof enderecoLinha>[0]): string | null => {
  if (os.latitude != null && os.longitude != null) return `https://www.google.com/maps/search/?api=1&query=${os.latitude},${os.longitude}`;
  const end = enderecoLinha(os);
  return end ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(end)}` : null;
};

/** "Rede": POP, rota e poste informados na OS, em uma linha. */
export const redeLinha = (os: Pick<OS, 'pop_nome' | 'rota_id' | 'poste_id'>): string => [os.pop_nome, os.rota_id, os.poste_id].filter(Boolean).join(' · ');
