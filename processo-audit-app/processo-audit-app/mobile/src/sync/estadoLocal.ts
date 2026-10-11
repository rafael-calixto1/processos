import type { Banco } from '@/db/banco';
import { listarTodas } from '@/db/outbox';
import { lerDados } from '@/db/repositorio';
import { lerDetalhes } from '@/db/trabalho';
import type { Operacao } from '@/domain/operacoes';
import type { Dados, DetalheOS } from '@/domain/tipos';
import { aplicarPendencias, type DadosVisao } from '@/domain/visao';

/** Tudo o que as telas e os comandos precisam saber, lido de uma vez: o retrato do servidor e o que está na fila por cima dele. */
export interface EstadoLocal {
  dados: Dados; // retrato do servidor, sem alterações
  visao: DadosVisao; // retrato + pendências (é o que o técnico enxerga)
  ops: Operacao[];
  detalhes: Record<number, DetalheOS>;
}

/** `null` enquanto o aparelho nunca baixou os dados. */
export const carregarEstadoLocal = async (banco: Banco, usuarioId: number): Promise<EstadoLocal | null> => {
  const dados = await lerDados(banco);
  if (!dados) return null;
  const [ops, detalhes] = await Promise.all([listarTodas(banco, usuarioId), lerDetalhes(banco)]);
  return { dados, visao: aplicarPendencias(dados, ops), ops, detalhes };
};
