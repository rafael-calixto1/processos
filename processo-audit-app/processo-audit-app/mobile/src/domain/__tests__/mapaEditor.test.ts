import { htmlDoEditorTrecho } from '../mapa';

describe('htmlDoEditorTrecho', () => {
  const base = { centro: { lat: -23.5429, lng: -46.3112 } };
  it('abre centrado no ponto dado, com OpenStreetMap e Leaflet fixado', () => {
    const h = htmlDoEditorTrecho(base);
    expect(h).toContain('setView([-23.5429,-46.3112],17)');
    expect(h).toContain('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(h).toContain('leaflet@1.9.4');
  });
  it('avisa o aplicativo de cada toque e de cada ponto arrastado (a página não guarda os pontos)', () => {
    const h = htmlDoEditorTrecho(base);
    expect(h).toContain("enviar({tipo:'toque'");
    expect(h).toContain("enviar({tipo:'mover'");
    expect(h).toContain("enviar({tipo:'pronto'})");
  });
  it('fala com o React Native (WebView) ou com o navegador (iframe) pelo mesmo código', () => {
    const h = htmlDoEditorTrecho(base);
    expect(h).toContain('window.ReactNativeWebView.postMessage');
    expect(h).toContain('window.parent.postMessage');
    expect(h).toContain("m.cmd==='pontos'");
  });
  it('início verde, fim vermelho e intermediários azuis e numerados; pontos arrastáveis', () => {
    const h = htmlDoEditorTrecho(base);
    expect(h).toContain('#15803d');
    expect(h).toContain('#dc2626');
    expect(h).toContain('#2563eb');
    expect(h).toContain('draggable:true');
  });
  it('linha cheia quando há caminho pelas vias, tracejada (linha reta) quando não há', () => {
    const h = htmlDoEditorTrecho(base);
    expect(h).toContain("dashArray:'8 10'");
    expect(h).toContain('L.polyline(caminho');
  });
  it('desenha os pontos e o caminho iniciais', () => {
    const h = htmlDoEditorTrecho({ ...base, pontos: [{ lat: -23.5, lng: -46.3 }, { lat: -23.51, lng: -46.31 }], caminho: [[-23.5, -46.3], [-23.505, -46.305], [-23.51, -46.31]] });
    expect(h).toContain('window.definirPontos([{"lat":-23.5,"lng":-46.3},{"lat":-23.51,"lng":-46.31}],[[-23.5,-46.3],[-23.505,-46.305],[-23.51,-46.31]],true)');
  });
  it('se o Leaflet não carregar (sem internet) mostra mensagem e avisa o aplicativo', () => {
    const h = htmlDoEditorTrecho(base);
    expect(h).toContain('Não foi possível carregar o mapa. Verifique a conexão.');
    expect(h).toContain("enviar({tipo:'erro-mapa'})");
  });
  it('descarta pontos inválidos e recusa centro impossível; só números entram na página', () => {
    expect(htmlDoEditorTrecho({ ...base, pontos: [{ lat: 99, lng: 0 }, { lat: 1, lng: 2 }] })).toContain('window.definirPontos([{"lat":1,"lng":2}]');
    expect(() => htmlDoEditorTrecho({ centro: { lat: 95, lng: 0 } })).toThrow(RangeError);
    expect(() => htmlDoEditorTrecho({ centro: { lat: '1;alert(1)' as unknown as number, lng: 0 } })).toThrow(RangeError);
    expect(htmlDoEditorTrecho({ ...base, pontos: [{ lat: '1</script>' as unknown as number, lng: 2 }] })).not.toContain('</script>"');
  });
});
