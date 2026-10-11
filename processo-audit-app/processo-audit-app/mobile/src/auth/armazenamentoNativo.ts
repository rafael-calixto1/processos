import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { Armazenamento } from './armazenamento';

/**
 * Chaves só podem ter letras, números, ponto, hífen e sublinhado. No celular usa o cofre do sistema.
 * O expo-secure-store não existe no web; lá cai em localStorage, SOMENTE para a pré-visualização de desenvolvimento
 * (o app não é distribuído para web).
 */
const nativo: Armazenamento = {
  get: (k) => SecureStore.getItemAsync(k),
  set: (k, v) => SecureStore.setItemAsync(k, v),
  remove: (k) => SecureStore.deleteItemAsync(k),
};

const web: Armazenamento = {
  get: async (k) => { try { return globalThis.localStorage?.getItem(k) ?? null; } catch { return null; } },
  set: async (k, v) => { try { globalThis.localStorage?.setItem(k, v); } catch { /* sem armazenamento */ } },
  remove: async (k) => { try { globalThis.localStorage?.removeItem(k); } catch { /* sem armazenamento */ } },
};

export const armazenamentoSeguro: Armazenamento = Platform.OS === 'web' ? web : nativo;
