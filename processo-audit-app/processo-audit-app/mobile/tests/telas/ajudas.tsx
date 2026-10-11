import type { Contagens } from '@/db/outbox';
import type { Operacao } from '@/domain/operacoes';
import type { DetalheOS } from '@/domain/tipos';
import { etapasConcluidas, podeFinalizar, progresso, rascunhoVazio, type Rascunho } from '@/domain/etapas';
import type { ValorFinalizacao } from '@/estado/FinalizacaoProvider';
import { aplicarPendencias, type DadosVisao } from '@/domain/visao';
import { criarBootstrap } from '@/testing/fixtures';

/** Dados prontos para as telas, no formato que o DadosProvider entrega (retrato + pendências). */
export const dadosDe = (sobrescrever: Partial<ReturnType<typeof criarBootstrap>> = {}, ops: Operacao[] = []): DadosVisao => {
  const b = criarBootstrap(sobrescrever);
  return aplicarPendencias({
    geradoEm: b.gerado_em, tecnico: b.tecnico, os: b.os, posse: b.posse, motivos: b.motivos, checklist: b.checklist,
    sugestoesServicos: b.sugestoes_servicos, tiposServico: b.tipos_servico, tecnicos: b.tecnicos, itens: b.itens, regras: b.regras,
  }, ops);
};

const comando = () => jest.fn(async (..._a: unknown[]) => undefined);

export interface EstadoDados {
  dados: DadosVisao | null; detalhes: Record<number, DetalheOS>; ops: Operacao[]; carregado: boolean; sincronizando: boolean; semConexao: boolean;
  erro: string | null; sincronizadoEm: string | null; contagens: Contagens; pausadoPorSessao: boolean; bloqueio: { pendencias: number; donoNome: string | null } | null;
  atualizar: jest.Mock; descartarTudo: jest.Mock;
  comandos: Record<'iniciarOS' | 'registrarLancamento' | 'substituirLancamento' | 'removerLancamento' | 'removerFoto' | 'salvarRascunho' | 'finalizar' | 'voltarAEditar' | 'reenviar' | 'descartar', jest.Mock> & { adicionarFoto: jest.Mock };
}
export const estadoDados = (sobrescrever: Partial<EstadoDados> = {}): EstadoDados => ({
  dados: dadosDe(), detalhes: {}, ops: [], carregado: true, sincronizando: false, semConexao: false, erro: null, sincronizadoEm: '2026-10-11T13:31:00.000Z',
  contagens: { pendentes: 0, enviando: 0, atencao: 0 }, pausadoPorSessao: false, bloqueio: null,
  atualizar: jest.fn(async () => undefined), descartarTudo: comando(),
  comandos: {
    iniciarOS: comando(), registrarLancamento: comando(), substituirLancamento: comando(), removerLancamento: comando(), removerFoto: comando(), salvarRascunho: comando(),
    finalizar: comando(), voltarAEditar: comando(), reenviar: comando(), descartar: comando(), adicionarFoto: jest.fn(async () => ({ clientUuid: 'u' })),
  },
  ...sobrescrever,
});

/** Operação da fila para montar telas: sobrescreva só o que importa para o caso. */
const PAYLOADS: Record<Operacao['tipo'], unknown> = {
  iniciar: { corpo: { iniciado_em: '2026-10-11T14:00:00.000Z' } },
  lancamento: { corpo: { descricao: 'Lançamento de cabo ASU 12F', trecho: 'PL-0932 → PL-0945', materiais: [{ lote_id: 11, quantidade: 100 }] }, exibicao: { linhas: [{ item_nome: 'Cabo óptico ASU 12F', unidade: 'metros', lote_id: 11, lote_codigo: 'LOTE-BOB-0001', quantidade: 100 }] } },
  foto: { arquivo: 'file:///fotos/a.jpg', mime: 'image/jpeg', campos: { client_uuid: 'u1', tirada_em: '2026-10-11T14:00:00.000Z' } },
  remover_foto: { foto_client_uuid: 'u1' },
  finalizar: { corpo: { finalizado_em: '2026-10-11T18:00:00.000Z' } },
  rascunho: { corpo: { rascunho: {} } },
};
export const opDe = (tipo: Operacao['tipo'], extra: Record<string, unknown> = {}): Operacao => ({
  id: 1, usuario_id: 7, os_id: 102, tipo, client_uuid: 'u1', chave: 'k1', payload: PAYLOADS[tipo], depende_de: [], estado: 'pendente', tentativas: 0, proxima_tentativa: 0,
  criado_em: new Date().toISOString(), atualizado_em: '', ok_em: null, no_retrato: false, forcada: false, resposta: null, erro: null, os_numero: 2, os_cliente: 'Rota PL-902 → CEO-02',
  ...extra,
} as unknown as Operacao);

/** Valor do FinalizacaoProvider para testar as telas das etapas: `alterar` aplica a mudança no rascunho, como o provedor de verdade faz. */
export const valorFinalizacao = (osId = 101, sobrescrever: { dados?: DadosVisao; rascunho?: Partial<Rascunho>; editavel?: boolean; totalFotos?: number } = {}): ValorFinalizacao & { alterar: jest.Mock; salvarAgora: jest.Mock } => {
  const dados = sobrescrever.dados ?? dadosDe();
  const v = {
    osId, os: dados.os.find((o) => o.id === osId), dados, carregado: true, rascunho: { ...rascunhoVazio(), ...sobrescrever.rascunho },
    alterar: jest.fn(), salvarAgora: jest.fn(async () => undefined), erroSalvar: null, fotos: [], totalFotos: sobrescrever.totalFotos ?? 0, lancamentos: [],
    contexto: { checklist: dados.checklist, lancamentosComMaterial: 0, regras: { descricao_min_caracteres: dados.regras.descricao_min_caracteres, fotos_min: dados.regras.fotos_min } },
    concluidas: {} as ValorFinalizacao['concluidas'], progresso: { feitas: 0, total: 7 }, pode: false, editavel: sobrescrever.editavel ?? true,
  } as ValorFinalizacao & { alterar: jest.Mock; salvarAgora: jest.Mock };
  const recalcular = () => { v.concluidas = etapasConcluidas(v.rascunho, v.contexto); v.progresso = progresso(v.rascunho, v.contexto); v.pode = podeFinalizar(v.rascunho, v.contexto); };
  v.alterar.mockImplementation((fn: (r: Rascunho) => Rascunho) => { v.rascunho = fn(v.rascunho); recalcular(); });
  recalcular();
  return v;
};
