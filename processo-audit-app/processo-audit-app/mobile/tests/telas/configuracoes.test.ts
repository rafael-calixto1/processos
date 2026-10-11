import { Linking, Platform } from 'react-native';
import { abrirConfiguracoes, abrirConfiguracoesDeLocalizacao } from '@/estado/configuracoes';

beforeEach(() => { jest.clearAllMocks(); });
afterEach(() => { jest.restoreAllMocks(); });

describe('abrirConfiguracoes', () => {
  it('abre as configurações do app e nunca lança erro, mesmo se o aparelho não souber abrir', async () => {
    const abrir = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await abrirConfiguracoes();
    expect(abrir).toHaveBeenCalledTimes(1);
    abrir.mockRejectedValue(new Error('sem configurações'));
    await expect(abrirConfiguracoes()).resolves.toBeUndefined();
  });
  it('GPS desligado no Android: vai direto à tela de localização; se não der, cai nas configurações do app', async () => {
    Platform.OS = 'android';
    const intent = jest.spyOn(Linking, 'sendIntent').mockResolvedValue(undefined);
    const abrir = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await abrirConfiguracoesDeLocalizacao();
    expect(intent).toHaveBeenCalledWith('android.settings.LOCATION_SOURCE_SETTINGS');
    expect(abrir).not.toHaveBeenCalled();
    intent.mockRejectedValue(new Error('sem intent'));
    await abrirConfiguracoesDeLocalizacao();
    expect(abrir).toHaveBeenCalledTimes(1);
  });
  it('no iOS usa as configurações do app', async () => {
    Platform.OS = 'ios';
    const abrir = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await abrirConfiguracoesDeLocalizacao();
    expect(abrir).toHaveBeenCalledTimes(1);
    Platform.OS = 'android';
  });
});
