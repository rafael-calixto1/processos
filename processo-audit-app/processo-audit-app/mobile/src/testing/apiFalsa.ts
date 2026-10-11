import { NetworkError } from '@/api/erros';
import type { ApiMotor } from '@/sync/outbox';

type Metodo = keyof ApiMotor;
export type Comportamento = (args: unknown[], n: number) => unknown | Promise<unknown>;
export interface ChamadaApi { metodo: Metodo; args: unknown[] }

const PADRAO: Record<Metodo, Comportamento> = {
  iniciarOS: (a) => ({ status: 'em_andamento', iniciado_em: a[1] }),
  lancar: () => ({ id: 1, descricao: 'x', trecho: null, quantidade: 1, materiais: [] }),
  enviarFoto: (_a, n) => ({ id: 900 + n, client_uuid: 'x', mime: 'image/jpeg', tamanho: 1 }),
  removerFoto: () => ({ ok: true }),
  finalizar: () => ({ status: 'concluida', fechamento_id: 1, finalizado_em: '2026-10-11T18:00:00.000Z' }),
  salvarRascunho: () => ({ ok: true }),
  rotaPorVias: () => new NetworkError(), // por padrão o serviço de rotas não responde: o trecho segue em linha reta
  solicitarDevolucao: (_a, n) => ({ solicitacao_id: 500 + n, lote_codigo: 'LOTE-X', quantidade: 1, status: 'pendente' }),
};

/** API falsa para os testes do motor: registra cada chamada (na ordem) e responde com o comportamento de cada método. */
export const criarApiFalsa = (comportamentos: Partial<Record<Metodo, Comportamento>> = {}) => {
  const chamadas: ChamadaApi[] = [];
  const contagem: Partial<Record<Metodo, number>> = {};
  const mudar = { ...PADRAO, ...comportamentos };
  const chamar = (metodo: Metodo) => async (...args: unknown[]) => {
    chamadas.push({ metodo, args });
    const n = contagem[metodo] = (contagem[metodo] ?? 0) + 1;
    const r = await mudar[metodo](args, n);
    if (r instanceof Error) throw r;
    return r;
  };
  const api = {
    iniciarOS: chamar('iniciarOS'), lancar: chamar('lancar'), enviarFoto: chamar('enviarFoto'),
    removerFoto: chamar('removerFoto'), finalizar: chamar('finalizar'), salvarRascunho: chamar('salvarRascunho'),
    solicitarDevolucao: chamar('solicitarDevolucao'), rotaPorVias: chamar('rotaPorVias'),
  } as unknown as ApiMotor;
  return { api, chamadas, definir: (m: Metodo, c: Comportamento) => { mudar[m] = c; }, ordem: () => chamadas.map((c) => c.metodo) };
};
