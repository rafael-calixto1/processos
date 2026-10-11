import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Texto enviado ao servidor para identificar o aparelho nas sessões, ex.: "android 14 · app 0.1.0". */
export const versaoApp = (): string => Constants.expoConfig?.version ?? '0.0.0';
export const descricaoDispositivo = (): string => `${Platform.OS} ${String(Platform.Version)} · app ${versaoApp()}`.slice(0, 160);
