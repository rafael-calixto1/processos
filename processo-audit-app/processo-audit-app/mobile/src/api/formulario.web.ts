import { ArquivoAusenteError } from './erros';
import type { CriarFormulario } from './endpoints';

/** Só para a pré-visualização no navegador: a foto é um blob guardado na memória da página. */
export const criarFormularioFoto: CriarFormulario = async (campos, arquivo) => {
  const resposta = await fetch(arquivo.uri).catch(() => null);
  if (!resposta?.ok) throw new ArquivoAusenteError();
  const form = new FormData();
  for (const [k, v] of Object.entries(campos)) form.append(k, v);
  form.append('foto', await resposta.blob(), arquivo.nome);
  return form;
};
