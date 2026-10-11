import { render, screen } from '@testing-library/react-native';

let mockProps: any = null;
jest.mock('react-native-webview', () => ({ WebView: (p: unknown) => { mockProps = p; return require('react').createElement('WebViewMock'); } }));

import { MapaDoTrecho } from '@/components/MapaDoTrecho';
import { MapaLocal } from '@/components/MapaLocal';

const rota = { pontos: [{ lat: -23.5, lng: -46.3 }, { lat: -23.51, lng: -46.31 }], metros: 1850, caminho: [[-23.5, -46.3], [-23.51, -46.31]] as Array<[number, number]> };
beforeEach(() => { mockProps = null; });

describe('mapas (WebView)', () => {
  it('trecho: página com os pontos, base no endereço do servidor e JavaScript ligado', () => {
    render(<MapaDoTrecho rota={rota} online origem="http://10.100.100.130:5998" />);
    expect(screen.getByTestId('mapa-do-trecho')).toBeTruthy();
    expect(mockProps.source.html).toContain('"lat":-23.51');
    expect(mockProps.source.baseUrl).toBe('http://10.100.100.130:5998');
    expect(mockProps.javaScriptEnabled).toBe(true);
  });
  it('local: página centrada no ponto, com o círculo da precisão', () => {
    render(<MapaLocal lat={-23.50416} lng={-46.28119} precisaoM={38} online />);
    expect(mockProps.source.html).toContain('var p=[-23.50416,-46.28119]');
    expect(mockProps.source.html).toContain('r=38;');
  });
  it('sem internet não carrega o WebView: mostra o aviso', () => {
    render(<MapaDoTrecho rota={rota} online={false} />);
    expect(screen.getByTestId('mapa-sem-conexao')).toBeTruthy();
    expect(screen.getByText(/O mapa aparece quando houver internet/)).toBeTruthy();
    expect(mockProps).toBeNull();
  });
});
