import { Linking, Platform } from 'react-native';

/** Abre as configurações do aplicativo no aparelho (onde se libera câmera e localização bloqueadas). Nunca lança erro. */
export const abrirConfiguracoes = async (): Promise<void> => {
  try { await Linking.openSettings(); } catch { /* aparelho sem tela de configurações: o texto da tela já explica o caminho */ }
};

/** GPS desligado: no Android leva direto à tela de localização do aparelho; nos demais casos, às configurações do app. */
export const abrirConfiguracoesDeLocalizacao = async (): Promise<void> => {
  if (Platform.OS === 'android') {
    try { await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS'); return; } catch { /* cai nas configurações do app */ }
  }
  await abrirConfiguracoes();
};
