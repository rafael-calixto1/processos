import { File } from 'expo-file-system';
import { ArquivoAusenteError } from './erros';
import type { CriarFormulario } from './endpoints';

/**
 * Corpo multipart da foto no celular. O `fetch` global do Android/iOS é o do Expo, que só aceita `FormData` com `Blob`
 * ou com um `File` do expo-file-system (o formato antigo `{ uri, name, type }` é recusado). Montado a cada tentativa.
 */
export const criarFormularioFoto: CriarFormulario = async (campos, arquivo) => {
  const f = new File(arquivo.uri);
  if (!f.exists) throw new ArquivoAusenteError();
  const form = new FormData();
  for (const [k, v] of Object.entries(campos)) form.append(k, v);
  form.append('foto', f as unknown as Blob);
  return form;
};
