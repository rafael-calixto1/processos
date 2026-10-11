import type { Api } from '@/api/endpoints';
import type { Banco } from '@/db/banco';
import { listarTodas, marcarNoRetrato, podarConfirmadas } from '@/db/outbox';
import { atualizarOS, definirMeta, lerMeta, limparDadosLocais, salvarBootstrap } from '@/db/repositorio';
import { podarDetalhes, salvarDetalhe } from '@/db/trabalho';
import { NetworkError } from '@/api/erros';
import { isPendente } from '@/domain/os';
import type { OS } from '@/domain/tipos';

/**
 * Os dados locais pertencem a um técnico. Se outro técnico entrar no mesmo aparelho, o espelho do anterior é apagado
 * antes de qualquer coisa ser mostrada (privacidade de endereços de clientes e de posse de material).
 */
export const garantirDono = async (banco: Banco, usuarioId: number): Promise<{ limpou: boolean }> => {
  const atual = await lerMeta(banco, 'usuario_id');
  const limpou = atual !== null && atual !== String(usuarioId);
  if (limpou) await limparDadosLocais(banco);
  await definirMeta(banco, 'usuario_id', String(usuarioId));
  return { limpou };
};

const SETE_DIAS_MS = 7 * 86_400_000;

export interface OpcoesSincronizar {
  usuarioId: number;
  agora?: () => number;
}

/**
 * Baixa o retrato do servidor (OS, posse, catálogos, regras) e troca o espelho local de uma vez; depois guarda o detalhe
 * de cada OS pendente (lançamentos já feitos), para a finalização funcionar sem sinal. O trabalho do técnico na fila
 * não é tocado. As operações confirmadas ANTES de este download começar passam a contar como "já no retrato".
 */
export const sincronizar = async (api: Pick<Api, 'bootstrap' | 'detalheOS'>, banco: Banco, { usuarioId, agora = Date.now }: OpcoesSincronizar): Promise<void> => {
  const inicio = agora();
  const retrato = await api.bootstrap();
  await salvarBootstrap(banco, retrato);
  await definirMeta(banco, 'sincronizado_em', new Date(agora()).toISOString());
  await marcarNoRetrato(banco, usuarioId, inicio);

  // detalhe das OS pendentes: melhor esforço, em série (a rede de campo é fraca); falta de rede para por aqui sem perder o que já veio
  for (const os of retrato.os.filter((o) => isPendente(o.status))) {
    try {
      const d = await api.detalheOS(os.id);
      await salvarDetalhe(banco, os.id, { baixado_em: new Date(agora()).toISOString(), servicos: d.servicos ?? [], materiais: d.materiais ?? [], fotos: d.fotos ?? [] });
    } catch (e) {
      if (e instanceof NetworkError) break;
    }
  }
  // o cache só interessa para as OS pendentes e para as que ainda têm trabalho local
  const comTrabalho = (await listarTodas(banco, usuarioId)).filter((o) => o.estado !== 'ok').map((o) => o.os_id);
  await podarDetalhes(banco, [...retrato.os.filter((o) => isPendente(o.status)).map((o) => o.id), ...comTrabalho]);
  await podarConfirmadas(banco, usuarioId, agora() - SETE_DIAS_MS);
};

/** "Iniciar execução" (online nesta fase): o servidor registra o início e o espelho local acompanha. */
export const iniciarExecucao = async (
  api: Pick<Api, 'iniciarOS'>, banco: Banco, osId: number,
  { novaChave, agora = () => new Date() }: { novaChave: () => string; agora?: () => Date },
): Promise<OS> => {
  const r = await api.iniciarOS(osId, agora().toISOString(), novaChave());
  const os = await atualizarOS(banco, osId, { status: r.status, iniciado_em: r.iniciado_em });
  if (!os) throw new Error('A OS não está mais na sua lista. Atualize e tente de novo.');
  return os;
};
