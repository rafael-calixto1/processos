import type { PortaArquivos } from '@/sync/outbox';

/** Pré-visualização no navegador: não há sistema de arquivos; a URI é um blob da própria página. */
export const portaArquivos: PortaArquivos = {
  existe: async (uri) => { try { return (await fetch(uri)).ok; } catch { return false; } },
  apagar: async (uri) => { if (uri.startsWith('blob:')) URL.revokeObjectURL(uri); },
};

export const guardarFotoNoApp = async (origemUri: string): Promise<{ uri: string; tamanho: number }> => {
  const blob = await (await fetch(origemUri)).blob();
  return { uri: URL.createObjectURL(blob), tamanho: blob.size };
};
