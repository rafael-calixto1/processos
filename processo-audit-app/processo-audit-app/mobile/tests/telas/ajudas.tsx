import type { Dados } from '@/db/repositorio';
import { criarBootstrap } from '@/testing/fixtures';

/** Dados prontos para as telas, no formato que o DadosProvider entrega. */
export const dadosDe = (sobrescrever: Partial<ReturnType<typeof criarBootstrap>> = {}): Dados => {
  const b = criarBootstrap(sobrescrever);
  return {
    geradoEm: b.gerado_em, tecnico: b.tecnico, os: b.os, posse: b.posse, motivos: b.motivos, checklist: b.checklist,
    sugestoesServicos: b.sugestoes_servicos, tiposServico: b.tipos_servico, tecnicos: b.tecnicos, itens: b.itens, regras: b.regras,
  };
};

export interface EstadoDados {
  dados: Dados | null; carregado: boolean; sincronizando: boolean; semConexao: boolean; erro: string | null; sincronizadoEm: string | null;
  atualizar: jest.Mock; iniciarOS: jest.Mock;
}
export const estadoDados = (sobrescrever: Partial<EstadoDados> = {}): EstadoDados => ({
  dados: dadosDe(), carregado: true, sincronizando: false, semConexao: false, erro: null, sincronizadoEm: '2026-10-11T13:31:00.000Z',
  atualizar: jest.fn(async () => undefined), iniciarOS: jest.fn(async () => undefined), ...sobrescrever,
});
