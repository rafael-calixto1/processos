import type { Api } from '@/api/endpoints';
import type { Banco } from '@/db/banco';
import { atualizarOS, definirMeta, lerMeta, limparDadosLocais, salvarBootstrap } from '@/db/repositorio';
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

/** Baixa o retrato do servidor (OS, posse, catálogos, regras) e troca o espelho local de uma vez. */
export const sincronizar = async (api: Pick<Api, 'bootstrap'>, banco: Banco, agora: () => Date = () => new Date()): Promise<void> => {
  const retrato = await api.bootstrap();
  await salvarBootstrap(banco, retrato);
  await definirMeta(banco, 'sincronizado_em', agora().toISOString());
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
