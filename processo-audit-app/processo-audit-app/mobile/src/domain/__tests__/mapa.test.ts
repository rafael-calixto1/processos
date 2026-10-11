import { htmlDoMapa, urlDoPonto } from '../mapa';

describe('htmlDoMapa', () => {
  it('centra no ponto, com mapas do OpenStreetMap e Leaflet fixado numa versão', () => {
    const h = htmlDoMapa({ lat: -23.50416, lng: -46.28119, precisao_m: 38 });
    expect(h).toContain('var p=[-23.50416,-46.28119]');
    expect(h).toContain('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(h).toContain('leaflet@1.9.4');
    expect(h).toContain('© OpenStreetMap');
  });
  it('desenha o círculo da precisão do GPS (e só com precisão)', () => {
    expect(htmlDoMapa({ lat: -23.5, lng: -46.3, precisao_m: 38 })).toContain('r=38;');
    expect(htmlDoMapa({ lat: -23.5, lng: -46.3, precisao_m: 38 })).toContain('L.circle(');
    expect(htmlDoMapa({ lat: -23.5, lng: -46.3 })).toContain('r=0;');
    expect(htmlDoMapa({ lat: -23.5, lng: -46.3, precisao_m: null })).toContain('r=0;');
    expect(htmlDoMapa({ lat: -23.5, lng: -46.3, precisao_m: -5 })).toContain('r=0;');
  });
  it('limita o círculo a 5 km (precisão absurda não cobre o mapa todo)', () => {
    expect(htmlDoMapa({ lat: 1, lng: 2, precisao_m: 90000 })).toContain('r=5000;');
  });
  it('se o Leaflet não carregar (sem internet) mostra uma mensagem em vez de tela em branco', () => {
    expect(htmlDoMapa({ lat: 1, lng: 2 })).toContain('Não foi possível carregar o mapa. Verifique a conexão.');
  });
  it.each([[91, 0], [0, 181], [NaN, 0], [0, Infinity]])('coordenada impossível (%p, %p) é recusada', (lat, lng) => {
    expect(() => htmlDoMapa({ lat, lng })).toThrow(RangeError);
  });
  it('as coordenadas entram como números: texto malicioso não vira código', () => {
    expect(() => htmlDoMapa({ lat: '1;alert(1)' as unknown as number, lng: 2 })).toThrow(RangeError);
  });
});

it('urlDoPonto abre as coordenadas no app de mapas', () => {
  expect(urlDoPonto(-23.5, -46.3)).toBe('https://www.google.com/maps/search/?api=1&query=-23.5,-46.3');
});
