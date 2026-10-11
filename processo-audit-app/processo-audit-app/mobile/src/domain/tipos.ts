/** Tipos compartilhados pelo domínio, pela API e pelo banco local. Espelham o `GET /mobile/bootstrap` do backend. */
export type Unidade = 'metros' | 'pecas';
export type StatusOS = 'aberta' | 'em_andamento' | 'concluida' | 'cancelada';
export type Prioridade = 'baixa' | 'normal' | 'alta';

export interface OS {
  id: number;
  numero: number;
  cliente: string;
  endereco: string | null;
  prazo: string | null; // YYYY-MM-DD
  prioridade: Prioridade;
  status: StatusOS;
  descricao: string | null;
  criado_em: string;
  atualizado_em: string;
  iniciado_em: string | null;
  concluida_em: string | null;
  tipo_servico: string | null;
  cep: string | null;
  logradouro: string | null;
  numero_endereco: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  latitude: number | null;
  longitude: number | null;
  pop_nome: string | null;
  rota_id: string | null;
  poste_id: string | null;
  criado_por_nome: string | null;
  tem_rascunho: boolean;
}

export interface PosseItem {
  lote_id: number;
  lote_codigo: string;
  item_id: number;
  item_nome: string;
  unidade: Unidade;
  /** Na visão local já vem descontado do que está reservado em lançamentos ainda não confirmados pelo servidor. */
  quantidade: number;
  /** Só na visão local: quanto desta posse está reservado em lançamentos na fila. */
  reservado?: number;
}

export interface Motivo { id: number; codigo: string; rotulo: string; tipo_servico_id: number | null }

export interface ChecklistItem {
  id: number;
  codigo: string;
  rotulo: string;
  tipo: 'boolean' | 'number' | 'text';
  unidade: string | null;
  obrigatorio: boolean;
  tipo_servico_id: number | null;
}

export interface TecnicoResumo { id: number; nome: string; tipo: 'interno' | 'terceirizado'; empresa: string | null }
export interface ItemEstoque { id: number; nome: string; categoria: string | null; unidade: Unidade }
export interface TipoServico { id: number; nome: string }

export interface RegrasFechamento {
  descricao_min_caracteres: number;
  descricao_max_caracteres: number;
  fotos_min: number;
  fotos_max: number;
  foto_max_bytes: number;
  participantes_max: number;
  retirados_max: number;
}

export interface Bootstrap {
  gerado_em: string;
  tecnico: TecnicoResumo;
  os: OS[];
  posse: PosseItem[];
  motivos: Motivo[];
  checklist: ChecklistItem[];
  sugestoes_servicos: string[];
  tipos_servico: TipoServico[];
  tecnicos: TecnicoResumo[];
  itens: ItemEstoque[];
  regras: RegrasFechamento;
}

/** Tudo o que o app mostra offline: o último retrato recebido do servidor. */
export interface Dados {
  geradoEm: string; // quando o SERVIDOR montou o retrato (é o "atualizado às HH:MM" mostrado ao técnico)
  tecnico: TecnicoResumo;
  os: OS[];
  posse: PosseItem[];
  motivos: Motivo[];
  checklist: ChecklistItem[];
  sugestoesServicos: string[];
  tiposServico: TipoServico[];
  tecnicos: TecnicoResumo[];
  itens: ItemEstoque[];
  regras: RegrasFechamento;
}

/** O que `GET /os/:id` devolve e o app guarda para trabalhar sem sinal (só os campos que a tela usa). */
export interface DetalheOS {
  baixado_em: string;
  servicos: Array<{ id: number; descricao: string; trecho: string | null; quantidade: number; criado_em: string }>;
  materiais: Array<{ id: number; servico_id: number | null; item_nome: string; lote_codigo: string; unidade: Unidade; quantidade: number; estorno_id: number | null }>;
  fotos: Array<{ id: number; client_uuid: string | null }>;
}
