import type { Unidade } from './tipos';

/**
 * Operações da fila de envio (outbox). Cada ação do técnico em campo vira uma operação congelada: o corpo, a chave de
 * idempotência e os identificadores nascem no momento da ação e NUNCA são refeitos num reenvio (o servidor confere
 * a chave contra o corpo; mudar o corpo com a mesma chave dá 422).
 */
export type TipoOp = 'iniciar' | 'lancamento' | 'foto' | 'remover_foto' | 'finalizar' | 'rascunho';
export type EstadoOp = 'pendente' | 'enviando' | 'ok' | 'atencao';

export const TIPOS_OP: readonly TipoOp[] = ['iniciar', 'lancamento', 'foto', 'remover_foto', 'finalizar', 'rascunho'];

export interface ErroOp {
  status: number | null; // código HTTP da recusa do servidor
  mensagem: string; // já em pt-BR, vinda do servidor ou escrita pelo app
  detalhes?: Array<{ campo: string; mensagem: string }>;
}

export interface PayloadIniciar { corpo: { iniciado_em: string } }

export interface LinhaLancamento { item_nome: string; unidade: Unidade; lote_id: number; lote_codigo: string; quantidade: number }
export interface PayloadLancamento {
  corpo: { descricao: string; trecho: string; materiais: Array<{ lote_id: number; quantidade: number }> };
  exibicao: { linhas: LinhaLancamento[] }; // só para mostrar na tela; não vai ao servidor
}

export interface PayloadFoto {
  arquivo: string; // caminho do JPEG já comprimido no aparelho (os mesmos bytes em todo reenvio)
  mime: 'image/jpeg';
  campos: { client_uuid: string; tirada_em: string; lat?: number | null; lng?: number | null; legenda?: string | null };
}

export interface PayloadRemoverFoto { foto_client_uuid: string }

export interface CorpoFinalizar {
  client_uuid: string;
  descricao: string;
  motivo_codigo: string;
  local: { lat: number; lng: number; precisao_m?: number | null; origem: 'gps' | 'address' | 'pole_reference'; endereco?: string | null; aproximado?: boolean; capturado_em?: string };
  checklist: Record<string, boolean | number | string>;
  materiais_usados: boolean;
  materiais_retirados: boolean;
  retirados: Array<{ item_id?: number; descricao?: string; quantidade: number; unidade?: Unidade; condicao: 'novo' | 'usado' }>;
  participantes: number[];
  fotos_esperadas: string[];
  iniciado_em: string | null;
  finalizado_em: string;
  dispositivo: string;
  versao_app: string;
}
export interface PayloadFinalizar { corpo: CorpoFinalizar }

/** Cópia de segurança do rascunho no servidor (melhor esforço; nunca exige atenção do técnico). */
export interface PayloadRascunho { corpo: { rascunho: Record<string, unknown> } }

interface Base {
  id: number;
  usuario_id: number;
  os_id: number;
  client_uuid: string;
  chave: string; // Idempotency-Key
  depende_de: number[]; // ids de outras operações que precisam estar "ok" antes (id inexistente = já resolvida)
  estado: EstadoOp;
  tentativas: number;
  proxima_tentativa: number; // epoch ms
  criado_em: string;
  atualizado_em: string;
  ok_em: number | null; // epoch ms em que o servidor confirmou
  no_retrato: boolean; // um retrato do servidor feito DEPOIS da confirmação já inclui o efeito desta operação
  forcada: boolean; // o técnico confirmou "enviar mesmo assim" para uma operação com mais de 14 dias
  resposta: any | null;
  erro: ErroOp | null;
  os_numero: number | null; // para mostrar na tela de atenção mesmo se a OS sumir da lista
  os_cliente: string | null;
}

export type Operacao =
  | (Base & { tipo: 'iniciar'; payload: PayloadIniciar })
  | (Base & { tipo: 'lancamento'; payload: PayloadLancamento })
  | (Base & { tipo: 'foto'; payload: PayloadFoto })
  | (Base & { tipo: 'remover_foto'; payload: PayloadRemoverFoto })
  | (Base & { tipo: 'finalizar'; payload: PayloadFinalizar })
  | (Base & { tipo: 'rascunho'; payload: PayloadRascunho });

type SemCamposDoBanco<T> = T extends unknown
  ? Omit<T, 'id' | 'estado' | 'tentativas' | 'proxima_tentativa' | 'criado_em' | 'atualizado_em' | 'ok_em' | 'no_retrato' | 'forcada' | 'resposta' | 'erro'>
  : never;
export type NovaOperacao = SemCamposDoBanco<Operacao>;

/** Ainda produz efeito na tela: não terminou, ou terminou mas o último retrato do servidor ainda não a inclui. */
export const emFila = (o: Pick<Operacao, 'estado' | 'no_retrato'>): boolean => o.estado !== 'ok' || !o.no_retrato;

/** Operações que o técnico enxerga como "pendências" (o backup do rascunho é invisível para ele). */
export const contaComoPendencia = (o: Pick<Operacao, 'tipo' | 'estado'>): boolean => o.tipo !== 'rascunho' && o.estado !== 'ok';

/** Prazo a partir do qual uma operação parada vira "requer atenção" em vez de ser enviada às cegas (o servidor guarda as chaves por 60 dias). */
export const DIAS_MAX_OPERACAO = 14;
/** Até aqui o técnico ainda pode escolher "enviar mesmo assim"; depois disso o risco de baixa duplicada é real. */
export const DIAS_MAX_REENVIO_FORCADO = 50;

export const idadeEmDias = (criadoEm: string, agora: number): number => (agora - new Date(criadoEm).getTime()) / 86_400_000;
