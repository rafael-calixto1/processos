import type { Api } from '@/api/endpoints';
import type { Banco } from '@/db/banco';
import { contagens, listarTodas, marcarNoRetrato, pendenciasDeOutros, podarConfirmadas } from '@/db/outbox';
import { definirMeta, lerMeta, limparDadosLocais, salvarBootstrap } from '@/db/repositorio';
import { descartarTrabalhoLocal, podarDetalhes, salvarDetalhe } from '@/db/trabalho';
import { NetworkError } from '@/api/erros';
import { isPendente } from '@/domain/os';

export type ResultadoDono =
  | { bloqueado: false; limpou: boolean }
  | { bloqueado: true; limpou: false; pendencias: number; donoNome: string | null };

/**
 * Os dados locais pertencem a um técnico. Se OUTRO técnico entrar no mesmo aparelho:
 *  - sem trabalho pendente do anterior: o espelho dele é apagado antes de qualquer coisa ser mostrada (privacidade de endereços e posse);
 *  - com trabalho não enviado (lançamentos, fotos, finalização, rascunho): fica BLOQUEADO e nada é apagado. Quem decide é o técnico,
 *    por uma confirmação explícita (`descartarTudoLocal`) ou entrando de volta com a conta dona dos dados.
 */
export const garantirDono = async (banco: Banco, usuario: { id: number; nome: string }, apagarArquivo: (uri: string) => Promise<void> = async () => undefined): Promise<ResultadoDono> => {
  const atual = await lerMeta(banco, 'usuario_id');
  if (atual === null || atual === String(usuario.id)) {
    await definirMeta(banco, 'usuario_id', String(usuario.id));
    await definirMeta(banco, 'usuario_nome', usuario.nome);
    return { bloqueado: false, limpou: false };
  }
  const pendencias = await pendenciasDeOutros(banco, usuario.id);
  if (pendencias > 0) return { bloqueado: true, limpou: false, pendencias, donoNome: await lerMeta(banco, 'usuario_nome') };
  await limparDadosLocais(banco);
  for (const uri of await descartarTrabalhoLocal(banco)) await apagarArquivo(uri).catch(() => undefined); // só sobra histórico já confirmado
  await definirMeta(banco, 'usuario_id', String(usuario.id));
  await definirMeta(banco, 'usuario_nome', usuario.nome);
  return { bloqueado: false, limpou: true };
};

/** O que o técnico perderia se descartasse o trabalho local (para mostrar na confirmação). */
export const resumoDoTrabalho = async (banco: Banco, usuarioId: number): Promise<{ operacoes: number; rascunhos: number; fotos: number; total: number }> => {
  const c = await contagens(banco, usuarioId);
  const operacoes = c.pendentes + c.enviando + c.atencao;
  const rascunhos = (await banco.first<{ n: number }>('SELECT COUNT(*) AS n FROM rascunhos WHERE usuario_id = ?', [usuarioId]))?.n ?? 0;
  const fotos = (await banco.first<{ n: number }>("SELECT COUNT(*) AS n FROM outbox WHERE usuario_id = ? AND tipo = 'foto' AND estado <> 'ok'", [usuarioId]))?.n ?? 0;
  return { operacoes, rascunhos, fotos, total: operacoes + rascunhos };
};

/** Descarte CONFIRMADO pelo técnico: apaga fila, rascunhos, fotos (inclusive os arquivos) e o espelho. Nunca chamar sem confirmação explícita. */
export const descartarTudoLocal = async (banco: Banco, apagarArquivo: (uri: string) => Promise<void> = async () => undefined): Promise<void> => {
  const arquivos = await descartarTrabalhoLocal(banco);
  await limparDadosLocais(banco);
  for (const uri of arquivos) await apagarArquivo(uri).catch(() => undefined);
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
