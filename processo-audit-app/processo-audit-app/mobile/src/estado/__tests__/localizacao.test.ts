import { ErroLocalizacao } from '@/domain/localizacao';

const mockPermissao = jest.fn();
const mockServicos = jest.fn();
const mockPosicao = jest.fn();
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: (...a: unknown[]) => mockPermissao(...a),
  hasServicesEnabledAsync: (...a: unknown[]) => mockServicos(...a),
  getCurrentPositionAsync: (...a: unknown[]) => mockPosicao(...a),
  Accuracy: { High: 4 },
}));

import { capturarPosicao } from '../localizacao';

const codigo = async (p: Promise<unknown>) => p.then(() => null, (e: ErroLocalizacao) => e.codigo ?? e.message);

beforeEach(() => {
  jest.useRealTimers();
  mockPermissao.mockReset().mockResolvedValue({ granted: true, canAskAgain: true });
  mockServicos.mockReset().mockResolvedValue(true);
  mockPosicao.mockReset().mockResolvedValue({ coords: { latitude: -23.5445, longitude: -46.3118, accuracy: 6.2 } });
});

describe('capturarPosicao (GPS)', () => {
  it('pede alta precisão e devolve latitude, longitude e a precisão em metros', async () => {
    expect(await capturarPosicao()).toEqual({ lat: -23.5445, lng: -46.3118, precisao_m: 6.2 });
    expect(mockPosicao).toHaveBeenCalledWith({ accuracy: 4 });
  });
  it('permissão negada (ainda dá para perguntar de novo) → mensagem de permissão', async () => {
    mockPermissao.mockResolvedValue({ granted: false, canAskAgain: true });
    expect(await codigo(capturarPosicao())).toBe('permissao_negada');
    expect(mockPosicao).not.toHaveBeenCalled();
  });
  it('permissão bloqueada para sempre → manda abrir as Configurações', async () => {
    mockPermissao.mockResolvedValue({ granted: false, canAskAgain: false });
    expect(await codigo(capturarPosicao())).toBe('permissao_bloqueada');
  });
  it('GPS desligado no aparelho', async () => {
    mockServicos.mockResolvedValue(false);
    expect(await codigo(capturarPosicao())).toBe('gps_desligado');
    expect(mockPosicao).not.toHaveBeenCalled();
  });
  it('sem sinal de GPS: estoura o prazo em vez de esperar para sempre', async () => {
    mockPosicao.mockReturnValue(new Promise(() => undefined)); // nunca responde
    expect(await codigo(capturarPosicao(30))).toBe('tempo_esgotado');
  });
  it('qualquer outra falha do sistema vira "indisponível" (sem vazar mensagem técnica)', async () => {
    mockPosicao.mockRejectedValue(new Error('E_LOCATION_UNAVAILABLE: Location provider is unavailable'));
    expect(await codigo(capturarPosicao())).toBe('indisponivel');
  });
  it('precisão desconhecida não é inventada', async () => {
    mockPosicao.mockResolvedValue({ coords: { latitude: 1, longitude: 2, accuracy: null } });
    expect((await capturarPosicao()).precisao_m).toBeNull();
  });
  it('não deixa timer pendurado depois de responder', async () => {
    jest.useFakeTimers();
    await capturarPosicao(60_000);
    expect(jest.getTimerCount()).toBe(0);
  });
});
