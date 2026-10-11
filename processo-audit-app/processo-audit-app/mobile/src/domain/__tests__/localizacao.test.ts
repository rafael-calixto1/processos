import { ErroLocalizacao, localDoEndereco, localDoGps, localDoPoste, MENSAGEM_ERRO_GPS, qualidadeDaPrecisao, rotuloOrigem } from '../localizacao';

const AGORA = new Date('2026-10-11T14:00:00Z');

describe('localDoGps', () => {
  it('guarda coordenadas, precisão arredondada em metros e o instante da captura', () => {
    expect(localDoGps({ lat: -23.5445, lng: -46.3118, precisao_m: 6.4 }, AGORA)).toEqual({ lat: -23.5445, lng: -46.3118, origem: 'gps', precisao_m: 6, capturado_em: '2026-10-11T14:00:00.000Z' });
  });
  it('sem precisão informada não inventa uma', () => {
    expect(localDoGps({ lat: -23.5, lng: -46.3, precisao_m: null }, AGORA).precisao_m).toBeNull();
  });
  it.each([[91, 0], [-91, 0], [0, 181], [0, -181], [NaN, 0], [0, Infinity]])('coordenada impossível (%p, %p) é recusada', (lat, lng) => {
    expect(() => localDoGps({ lat, lng, precisao_m: 5 }, AGORA)).toThrow(ErroLocalizacao);
  });
});

describe('localDoPoste', () => {
  it('usa as coordenadas da OS como "poste" (funciona sem sinal)', () => {
    expect(localDoPoste({ latitude: -23.5445, longitude: -46.3118 }, AGORA)).toEqual({ lat: -23.5445, lng: -46.3118, origem: 'pole_reference', capturado_em: '2026-10-11T14:00:00.000Z' });
  });
  it('OS sem coordenadas não oferece essa opção', () => {
    expect(localDoPoste({ latitude: null, longitude: null }, AGORA)).toBeNull();
    expect(localDoPoste({ latitude: -23.5, longitude: null }, AGORA)).toBeNull();
  });
});

describe('localDoEndereco', () => {
  it('guarda o texto do endereço e se a posição é só aproximada (rua fora do mapa)', () => {
    expect(localDoEndereco({ lat: -23.54, lng: -46.31, rotulo: 'Estrada Takashi Kobata, 572 · Suzano', aproximado: true }, AGORA)).toMatchObject({ origem: 'address', endereco: 'Estrada Takashi Kobata, 572 · Suzano', aproximado: true });
    expect(localDoEndereco({ lat: -23.54, lng: -46.31, rotulo: 'x' }, AGORA).aproximado).toBe(false);
  });
});

describe('qualidade da precisão', () => {
  it.each([[0, 'boa'], [15, 'boa'], [16, 'media'], [50, 'media'], [51, 'ruim'], [300, 'ruim']] as const)('%p m é %p', (m, q) => expect(qualidadeDaPrecisao(m)).toBe(q));
  it('desconhecida não classifica', () => { expect(qualidadeDaPrecisao(null)).toBeNull(); expect(qualidadeDaPrecisao(undefined)).toBeNull(); });
});

describe('textos', () => {
  it('toda falha de GPS tem uma mensagem em português que aponta o caminho alternativo', () => {
    for (const [codigo, msg] of Object.entries(MENSAGEM_ERRO_GPS)) {
      expect(msg).toMatch(/poste/);
      expect(new ErroLocalizacao(codigo as never).message).toBe(msg);
    }
    expect(MENSAGEM_ERRO_GPS.permissao_bloqueada).toMatch(/Configurações/);
    expect(MENSAGEM_ERRO_GPS.gps_desligado).toMatch(/desligado/);
    expect(MENSAGEM_ERRO_GPS.tempo_esgotado).toMatch(/a tempo/);
  });
  it('rotulo da origem mostra a precisão do GPS e avisa quando o endereço é aproximado', () => {
    expect(rotuloOrigem({ lat: 0, lng: 0, origem: 'gps', precisao_m: 8 })).toBe('GPS · precisão de 8 m');
    expect(rotuloOrigem({ lat: 0, lng: 0, origem: 'pole_reference' })).toBe('Coordenadas do poste');
    expect(rotuloOrigem({ lat: 0, lng: 0, origem: 'address', aproximado: true })).toBe('Endereço (posição aproximada)');
  });
});
