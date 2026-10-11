import { Directory, File, Paths } from 'expo-file-system';
import type { PortaArquivos } from '@/sync/outbox';

/** Arquivos de foto no diretório do app (não é apagado pelo sistema, ao contrário do cache). */
const pastaFotos = () => new Directory(Paths.document, 'fotos-os');

export const portaArquivos: PortaArquivos = {
  existe: async (uri) => new File(uri).exists,
  apagar: async (uri) => { const f = new File(uri); if (f.exists) f.delete(); },
};

/** Move para a pasta definitiva do app um arquivo temporário (câmera/manipulador), com nome único. Devolve a nova URI e o tamanho. */
export const guardarFotoNoApp = async (origemUri: string, nome: string): Promise<{ uri: string; tamanho: number }> => {
  const pasta = pastaFotos();
  if (!pasta.exists) pasta.create({ intermediates: true, idempotent: true });
  const destino = new File(pasta, `${nome}.jpg`);
  new File(origemUri).copy(destino);
  return { uri: destino.uri, tamanho: destino.size };
};
