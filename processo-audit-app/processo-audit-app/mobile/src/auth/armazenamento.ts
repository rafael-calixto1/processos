/** Armazenamento de segredos (tokens). No celular fica no Keychain/Keystore (expo-secure-store). */
export interface Armazenamento {
  get(chave: string): Promise<string | null>;
  set(chave: string, valor: string): Promise<void>;
  remove(chave: string): Promise<void>;
}

export const armazenamentoEmMemoria = (inicial: Record<string, string> = {}): Armazenamento & { dados: Map<string, string> } => {
  const dados = new Map(Object.entries(inicial));
  return {
    dados,
    get: async (k) => dados.get(k) ?? null,
    set: async (k, v) => { dados.set(k, v); },
    remove: async (k) => { dados.delete(k); },
  };
};
