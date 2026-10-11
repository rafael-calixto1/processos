/**
 * Complementa o app.json. O que muda conforme o tipo de build fica aqui:
 *  - build de desenvolvimento (perfil "development" do EAS): sem bloqueios, para o cliente de desenvolvimento funcionar como vem;
 *  - qualquer outro (preview, production, `expo prebuild` local): bloqueia permissões que o app NÃO usa e que só vêm do modelo do Expo.
 *    SYSTEM_ALERT_WINDOW (desenhar sobre outros apps) e VIBRATE. A Play Store estranha a primeira e o técnico não tem por que concedê-la.
 * Câmera, localização e internet continuam: são as únicas que o app usa (ver tests/configuracao.test.ts).
 *
 * HTTP sem certificado ("cleartext"): o Android 9+ bloqueia por padrão em qualquer build instalado. Só os perfis "development" e
 * "preview" (teste interno, rede da empresa) o liberam. "production" e `expo prebuild` local NUNCA liberam: lá só vale https.
 */
const PERFIS_QUE_ACEITAM_HTTP = ['development', 'preview'];
const PERMISSOES_QUE_O_APP_NAO_USA = ['android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.VIBRATE'];

module.exports = ({ config }) => {
  const perfil = process.env.EAS_BUILD_PROFILE;
  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      ...(PERFIS_QUE_ACEITAM_HTTP.includes(perfil) ? [['expo-build-properties', { android: { usesCleartextTraffic: true } }]] : []),
    ],
    android: {
      ...config.android,
      blockedPermissions: perfil === 'development' ? [] : PERMISSOES_QUE_O_APP_NAO_USA,
    },
  };
};
module.exports.PERMISSOES_QUE_O_APP_NAO_USA = PERMISSOES_QUE_O_APP_NAO_USA;
module.exports.PERFIS_QUE_ACEITAM_HTTP = PERFIS_QUE_ACEITAM_HTTP;
