import { parseQuantidade } from './quantidade';
import type { ChecklistItem, RegrasFechamento, Unidade } from './tipos';

/* Etapas da finalização em campo (ordem e textos do FINALIZATION_STEPS do web). O servidor revalida tudo no /finalizar. */
export type ChaveEtapa = 'descricao' | 'motivo' | 'local' | 'checklist' | 'usados' | 'retirados' | 'fotos' | 'participantes';

export const ETAPAS: ReadonlyArray<{ chave: ChaveEtapa; rotulo: string; obrigatoria: boolean }> = [
  { chave: 'descricao', rotulo: 'Descrição', obrigatoria: true },
  { chave: 'motivo', rotulo: 'Motivo de Fechamento', obrigatoria: true },
  { chave: 'local', rotulo: 'Local do Endereço', obrigatoria: true },
  { chave: 'checklist', rotulo: 'Checklists', obrigatoria: true },
  { chave: 'usados', rotulo: 'Materiais Utilizados', obrigatoria: true },
  { chave: 'retirados', rotulo: 'Materiais Retirados', obrigatoria: true },
  { chave: 'fotos', rotulo: 'Fotos do Serviço', obrigatoria: true },
  { chave: 'participantes', rotulo: 'Participantes', obrigatoria: false },
];

export interface LocalIntervencao {
  lat: number;
  lng: number;
  origem: 'gps' | 'address' | 'pole_reference';
  precisao_m?: number | null;
  endereco?: string | null;
  aproximado?: boolean;
  capturado_em?: string;
}

export interface Retirado {
  chave: string; // identificador local da linha
  item_id: number | null;
  descricao: string;
  quantidade: string; // como foi digitado
  unidade: Unidade;
  condicao: 'novo' | 'usado' | null;
}

export interface Rascunho {
  descricao: string;
  motivo_codigo: string | null;
  local: LocalIntervencao | null;
  checklist: Record<string, boolean | number | string>;
  materiais_usados: boolean | null; // null = ainda não respondeu
  materiais_retirados: boolean | null;
  retirados: Retirado[];
  fotos: string[]; // client_uuid das fotos já tiradas
  participantes: number[];
}

export const rascunhoVazio = (): Rascunho => ({
  descricao: '', motivo_codigo: null, local: null, checklist: {}, materiais_usados: null,
  materiais_retirados: null, retirados: [], fotos: [], participantes: [],
});

export interface ContextoEtapas {
  checklist: readonly ChecklistItem[]; // itens ativos vindos do servidor
  lancamentosComMaterial: number; // lançamentos da OS que baixaram material
  regras: Pick<RegrasFechamento, 'descricao_min_caracteres' | 'fotos_min'>;
}

const checklistRespondido = (item: ChecklistItem, v: unknown): boolean => {
  if (item.tipo === 'boolean') return typeof v === 'boolean';
  if (item.tipo === 'number') {
    if (v === undefined || v === null || v === '' || typeof v === 'boolean') return false;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) && n >= 0;
  }
  return typeof v === 'string' && v.trim() !== ''; // texto obrigatório precisa de conteúdo
};

export const retiradosCompletos = (r: Rascunho): boolean =>
  r.materiais_retirados === false
  || (r.materiais_retirados === true && r.retirados.length > 0
    && r.retirados.every((l) => l.condicao !== null && parseQuantidade(l.quantidade, l.unidade).ok));

export const etapasConcluidas = (r: Rascunho, ctx: ContextoEtapas): Record<ChaveEtapa, boolean> => ({
  descricao: r.descricao.trim().length >= ctx.regras.descricao_min_caracteres,
  motivo: Boolean(r.motivo_codigo),
  local: r.local !== null,
  checklist: ctx.checklist.filter((i) => i.obrigatorio).every((i) => checklistRespondido(i, r.checklist[i.codigo])),
  // "Usei material" vale quando há lançamento; "não usei" só enquanto não houver nenhum (o servidor confere)
  usados: ctx.lancamentosComMaterial > 0 || r.materiais_usados === false,
  retirados: retiradosCompletos(r),
  fotos: r.fotos.length >= ctx.regras.fotos_min,
  participantes: r.participantes.length > 0,
});

export const podeFinalizar = (r: Rascunho, ctx: ContextoEtapas): boolean => {
  const feitas = etapasConcluidas(r, ctx);
  return ETAPAS.filter((e) => e.obrigatoria).every((e) => feitas[e.chave]);
};

export const progresso = (r: Rascunho, ctx: ContextoEtapas): { feitas: number; total: number } => {
  const feitas = etapasConcluidas(r, ctx);
  const obrigatorias = ETAPAS.filter((e) => e.obrigatoria);
  return { feitas: obrigatorias.filter((e) => feitas[e.chave]).length, total: obrigatorias.length };
};
