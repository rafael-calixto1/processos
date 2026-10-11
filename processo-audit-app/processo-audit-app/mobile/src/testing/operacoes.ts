import { SEM_OS, type NovaOperacao } from '@/domain/operacoes';

/** UUID de teste previsível: uuid(1) → 00000000-0000-4000-8000-000000000001. */
export const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

let contador = 100;
const proximo = () => ++contador;

type Comum = { usuario_id: number; os_id: number; os_numero: number | null; os_cliente: string | null; depende_de: number[]; client_uuid: string; chave: string };
const comum = (osId: number, extra: Partial<Comum> = {}): Comum => {
  const n = proximo();
  return { usuario_id: 7, os_id: osId, os_numero: osId - 100, os_cliente: `Cliente da OS ${osId}`, depende_de: [], client_uuid: uuid(n), chave: `chave-${n}-0000`, ...extra };
};

export const novaIniciar = (osId: number, extra: Partial<Comum> = {}, iniciadoEm = '2026-10-11T14:00:00.000Z'): NovaOperacao =>
  ({ ...comum(osId, extra), tipo: 'iniciar', payload: { corpo: { iniciado_em: iniciadoEm } } });

export const novoLancamento = (osId: number, materiais: Array<{ lote_id: number; quantidade: number }> = [{ lote_id: 11, quantidade: 100 }], extra: Partial<Comum> = {}): NovaOperacao =>
  ({
    ...comum(osId, extra), tipo: 'lancamento',
    payload: {
      corpo: { descricao: 'Lançamento de cabo ASU 12F', trecho: 'PL-0932 → PL-0945', materiais },
      exibicao: { linhas: materiais.map((m) => ({ item_nome: 'Cabo óptico ASU 12F', unidade: 'metros' as const, lote_id: m.lote_id, lote_codigo: `LOTE-${m.lote_id}`, quantidade: m.quantidade })) },
    },
  });

export const novaFoto = (osId: number, extra: Partial<Comum> = {}): NovaOperacao => {
  const c = comum(osId, extra);
  return { ...c, tipo: 'foto', payload: { arquivo: `file:///fotos/${c.client_uuid}.jpg`, mime: 'image/jpeg', campos: { client_uuid: c.client_uuid, tirada_em: '2026-10-11T14:05:00.000Z' } } };
};

export const novoRascunhoOp = (osId: number, rascunho: Record<string, unknown> = { descricao: 'rascunho' }, extra: Partial<Comum> = {}): Extract<NovaOperacao, { tipo: 'rascunho' }> =>
  ({ ...comum(osId, extra), tipo: 'rascunho', payload: { corpo: { rascunho } } });

export const novaFinalizar = (osId: number, extra: Partial<Comum> = {}): NovaOperacao => {
  const c = comum(osId, extra);
  return {
    ...c, tipo: 'finalizar',
    payload: {
      corpo: {
        client_uuid: uuid(proximo()), descricao: 'Rota lançada e CEO fechada no poste', motivo_codigo: 'route_launched',
        local: { lat: -23.5445, lng: -46.3118, precisao_m: 6, origem: 'gps' }, checklist: { fiberLaunchedMeters: 350.5 },
        materiais_usados: true, materiais_retirados: false, retirados: [], participantes: [], fotos_esperadas: [],
        iniciado_em: '2026-10-11T14:00:00.000Z', finalizado_em: '2026-10-11T16:00:00.000Z', dispositivo: 'android 14', versao_app: '1.0.0',
      },
    },
  };
};

export const novaDevolucao = (loteId = 11, quantidade = 20, condicao: 'novo' | 'usado' = 'usado', extra: Partial<Comum> = {}): NovaOperacao =>
  ({
    ...comum(SEM_OS, { os_numero: null, os_cliente: null, ...extra }), tipo: 'devolucao',
    payload: { corpo: { lote_id: loteId, quantidade, condicao }, exibicao: { item_nome: 'Cabo óptico ASU 12F', unidade: 'metros' as const, lote_codigo: `LOTE-${loteId}` } },
  });
