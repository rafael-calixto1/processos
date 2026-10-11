/**
 * Complementa o app.json. O que muda conforme o tipo de build fica aqui:
 *  - build de desenvolvimento (perfil "development" do EAS): sem bloqueios, para o cliente de desenvolvimento funcionar como vem;
 *  - qualquer outro (preview, production, `expo prebuild` local): bloqueia permissões que o app NÃO usa e que só vêm do modelo do Expo.
 *    SYSTEM_ALERT_WINDOW (desenhar sobre outros apps) e VIBRATE. A Play Store estranha a primeira e o técnico não tem por que concedê-la.
 * Câmera, localização e internet continuam: são as únicas que o app usa (ver tests/configuracao.test.ts).
 */
const PERMISSOES_QUE_O_APP_NAO_USA = ['android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.VIBRATE'];

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    blockedPermissions: process.env.EAS_BUILD_PROFILE === 'development' ? [] : PERMISSOES_QUE_O_APP_NAO_USA,
  },
});
module.exports.PERMISSOES_QUE_O_APP_NAO_USA = PERMISSOES_QUE_O_APP_NAO_USA;
