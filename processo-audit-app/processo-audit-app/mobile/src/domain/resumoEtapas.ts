import type { ChaveEtapa, ContextoEtapas, Rascunho } from './etapas';
import { fmtNum } from './quantidade';
import type { ChecklistItem, Motivo } from './tipos';

/** Mensagem de erro de um campo do checklist (null = ok ou ainda vazio). Números aceitam vírgula ou ponto. */
export const erroChecklist = (item: Pick<ChecklistItem, 'tipo'>, valor: unknown): string | null => {
  if (item.tipo !== 'number' || valor === undefined || valor === null || valor === '') return null;
  const n = Number(String(valor).replace(',', '.'));
  if (typeof valor === 'boolean' || !Number.isFinite(n)) return 'Digite um número (use vírgula ou ponto).';
  if (n < 0) return 'O valor não pode ser negativo.';
  return null;
};

export interface InfoResumo { motivos: readonly Motivo[]; lancamentos: number; fotos: number }

const ORIGEM_LOCAL: Record<string, string> = { gps: 'GPS', address: 'Endereço', pole_reference: 'Poste' };

/** A linha de resumo de cada etapa no hub da finalização ("3 fotos", "Rota lançada com sucesso"...). */
export const resumoDaEtapa = (chave: ChaveEtapa, r: Rascunho, ctx: ContextoEtapas, info: InfoResumo): string | null => {
  switch (chave) {
    case 'descricao': {
      const t = r.descricao.trim();
      if (!t) return null;
      return t.length < ctx.regras.descricao_min_caracteres ? `Muito curta: mínimo de ${ctx.regras.descricao_min_caracteres} caracteres` : t.length > 40 ? `${t.slice(0, 40)}…` : t;
    }
    case 'motivo': return info.motivos.find((m) => m.codigo === r.motivo_codigo)?.rotulo ?? null;
    case 'local': {
      if (!r.local) return null;
      const precisao = r.local.origem === 'gps' && r.local.precisao_m != null ? ` ±${fmtNum(r.local.precisao_m)} m` : '';
      return `${ORIGEM_LOCAL[r.local.origem] ?? ''}${precisao} · ${r.local.lat.toFixed(5)}, ${r.local.lng.toFixed(5)}`;
    }
    case 'checklist': {
      const obrigatorios = ctx.checklist.filter((i) => i.obrigatorio);
      const respondidos = obrigatorios.filter((i) => { const v = r.checklist[i.codigo]; return v !== undefined && v !== '' && v !== null; }).length;
      return obrigatorios.length ? `${respondidos} de ${obrigatorios.length} obrigatórios respondidos` : null;
    }
    case 'usados': return info.lancamentos > 0 ? `${info.lancamentos} lançamento${info.lancamentos > 1 ? 's' : ''}` : r.materiais_usados === false ? 'Nenhum material usado' : null;
    case 'retirados': return r.materiais_retirados === null ? null : r.materiais_retirados ? `${r.retirados.length} ite${r.retirados.length === 1 ? 'm' : 'ns'}` : 'Nenhum material retirado';
    case 'fotos': return info.fotos > 0 ? `${info.fotos} foto${info.fotos > 1 ? 's' : ''}` : null;
    case 'participantes': return r.participantes.length ? `${r.participantes.length} participante${r.participantes.length > 1 ? 's' : ''}` : null;
  }
};
