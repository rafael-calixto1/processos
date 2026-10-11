import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError, NetworkError } from '@/api/erros';

const mockApi = { rotaPorVias: jest.fn() };
let mockMapa: any = null;
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/estado/AppProvider', () => ({ useApp: () => ({ api: mockApi }) }));
jest.mock('@/components/MapaTrecho', () => ({ MapaTrecho: (p: unknown) => { mockMapa = p; return require('react').createElement('MapaMock', { testID: 'mapa-mock' }); } }));

import { EditorTrecho } from '@/components/EditorTrecho';

const centro = { lat: -23.5429, lng: -46.3112 };
const toque = (lat: number, lng: number) => act(async () => { mockMapa.aoMensagem({ tipo: 'toque', lat, lng }); });
const montar = (extra: Partial<React.ComponentProps<typeof EditorTrecho>> = {}) => {
  const aoConfirmar = jest.fn(); const aoFechar = jest.fn();
  const tela = render(<EditorTrecho centro={centro} inicial={null} aoConfirmar={aoConfirmar} aoFechar={aoFechar} {...extra} />);
  return { aoConfirmar, aoFechar, ...tela };
};
const rotaDoServidor = (pontos: Array<{ lat: number; lng: number }>, metros = 350.4) => ({ pontos, metros, caminho: [[pontos[0].lat, pontos[0].lng], [pontos[pontos.length - 1].lat, pontos[pontos.length - 1].lng]] });
const usar = () => screen.getByTestId('trecho-usar');

beforeEach(() => { jest.clearAllMocks(); mockMapa = null; mockApi.rotaPorVias.mockReset(); });

describe('EditorTrecho (marcar o trecho no mapa)', () => {
  it('guia o técnico: primeiro o início, depois os seguintes (o último é o fim)', async () => {
    montar();
    expect(screen.getByText('Toque no mapa no ponto de INÍCIO do trecho.')).toBeTruthy();
    await toque(-23.5, -46.3);
    expect(screen.getByText('Agora toque nos pontos seguintes. O último toque é o FIM do trecho.')).toBeTruthy();
    expect(mockMapa.pontos).toEqual([{ lat: -23.5, lng: -46.3 }]);
    expect(mockApi.rotaPorVias).not.toHaveBeenCalled(); // com um ponto só não há trajeto
    expect(usar().props.accessibilityState.disabled).toBe(true);
  });

  it('com 2 pontos traça pelas ruas, os pontos grudam na via e libera "Usar este trecho"', async () => {
    mockApi.rotaPorVias.mockResolvedValue(rotaDoServidor([{ lat: -23.50001, lng: -46.30002 }, { lat: -23.50999, lng: -46.30998 }]));
    const { aoConfirmar } = montar();
    await toque(-23.5, -46.3); await toque(-23.51, -46.31);
    await waitFor(() => expect(mockMapa.pontos).toEqual([{ lat: -23.50001, lng: -46.30002 }, { lat: -23.50999, lng: -46.30998 }]));
    expect(mockApi.rotaPorVias).toHaveBeenCalledWith([{ lat: -23.5, lng: -46.3 }, { lat: -23.51, lng: -46.31 }]);
    expect(mockMapa.caminho.length).toBe(2);
    expect(screen.getByText(/2 pontos · ≈ 350 m pelas ruas/)).toBeTruthy();
    fireEvent.press(usar());
    expect(aoConfirmar).toHaveBeenCalledWith({ pontos: [{ lat: -23.50001, lng: -46.30002 }, { lat: -23.50999, lng: -46.30998 }], metros: 350, caminho: [[-23.50001, -46.30002], [-23.50999, -46.30998]] });
  });

  it('vários pontos: início, intermediário e fim, na ordem dos toques', async () => {
    mockApi.rotaPorVias.mockImplementation(async (pts: any[]) => rotaDoServidor(pts, 900));
    montar();
    await toque(-23.5, -46.3); await toque(-23.51, -46.3); await toque(-23.52, -46.31);
    await waitFor(() => expect(mockMapa.pontos).toHaveLength(3));
    expect(mockMapa.pontos.map((p: any) => p.lat)).toEqual([-23.5, -23.51, -23.52]);
    expect(screen.getByText(/3 pontos · ≈ 900 m pelas ruas/)).toBeTruthy();
  });

  it('ponto fora de qualquer rua: recusa com a mensagem do servidor e o ponto NÃO entra (o mapa volta ao estado anterior)', async () => {
    mockApi.rotaPorVias.mockImplementationOnce(async (pts: any[]) => rotaDoServidor(pts)).mockRejectedValueOnce(new ApiError(422, 'Marque os pontos sobre uma rua, estrada ou rodovia.'));
    montar();
    await toque(-23.5, -46.3); await toque(-23.51, -46.3);
    await waitFor(() => expect(mockMapa.pontos).toHaveLength(2));
    const versaoAntes = mockMapa.versao;
    await toque(-23.9, -46.9);
    expect(await screen.findByText('Marque os pontos sobre uma rua, estrada ou rodovia.')).toBeTruthy();
    expect(mockMapa.pontos).toHaveLength(2);
    await waitFor(() => expect(mockMapa.versao).toBeGreaterThan(versaoAntes)); // força a página a redesenhar sem o ponto recusado
  });

  it('sem conexão com o servidor de rotas: aceita o ponto em linha reta e avisa', async () => {
    mockApi.rotaPorVias.mockRejectedValue(new NetworkError());
    const { aoConfirmar } = montar();
    await toque(-23.5, -46.3); await toque(-23.5, -46.29);
    expect(await screen.findByText(/o trecho ficou em linha reta entre os pontos, sem seguir as ruas/)).toBeTruthy();
    expect(mockMapa.pontos).toHaveLength(2);
    expect(mockMapa.caminho).toEqual([]);
    expect(screen.getByText(/2 pontos · ≈ [\d,]+ (m|km) em linha reta/)).toBeTruthy();
    fireEvent.press(usar());
    expect(aoConfirmar.mock.calls[0][0]).toMatchObject({ caminho: [] });
    expect(aoConfirmar.mock.calls[0][0].metros).toBeGreaterThan(900);
  });

  it('arrastar um ponto refaz o trajeto com a nova posição', async () => {
    mockApi.rotaPorVias.mockImplementation(async (pts: any[]) => rotaDoServidor(pts));
    montar();
    await toque(-23.5, -46.3); await toque(-23.51, -46.3);
    await waitFor(() => expect(mockMapa.pontos).toHaveLength(2));
    await act(async () => { mockMapa.aoMensagem({ tipo: 'mover', i: 1, lat: -23.515, lng: -46.301 }); });
    await waitFor(() => expect(mockApi.rotaPorVias).toHaveBeenLastCalledWith([{ lat: -23.5, lng: -46.3 }, { lat: -23.515, lng: -46.301 }]));
  });

  it('limite de 25 pontos: o 26º é recusado com mensagem clara', async () => {
    mockApi.rotaPorVias.mockImplementation(async (pts: any[]) => rotaDoServidor(pts));
    montar();
    for (let i = 0; i < 25; i++) { await toque(-23.5 - i / 1000, -46.3); await waitFor(() => expect(mockMapa.pontos).toHaveLength(i + 1)); }
    await toque(-24, -46.3);
    expect(await screen.findByText('No máximo 25 pontos por trecho.')).toBeTruthy();
    expect(mockMapa.pontos).toHaveLength(25);
  });

  it('desfazer tira o último ponto; limpar zera e trava "Usar"', async () => {
    mockApi.rotaPorVias.mockImplementation(async (pts: any[]) => rotaDoServidor(pts));
    montar();
    await toque(-23.5, -46.3); await toque(-23.51, -46.3); await toque(-23.52, -46.3);
    await waitFor(() => expect(mockMapa.pontos).toHaveLength(3));
    fireEvent.press(screen.getByTestId('trecho-desfazer'));
    await waitFor(() => expect(mockMapa.pontos).toHaveLength(2));
    fireEvent.press(screen.getByTestId('trecho-limpar'));
    await waitFor(() => expect(mockMapa.pontos).toHaveLength(0));
    expect(usar().props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('trecho-desfazer').props.accessibilityState.disabled).toBe(true);
  });

  it('desfazer até sobrar 1 ponto não consulta o servidor (não há trajeto)', async () => {
    mockApi.rotaPorVias.mockImplementation(async (pts: any[]) => rotaDoServidor(pts));
    montar();
    await toque(-23.5, -46.3); await toque(-23.51, -46.3);
    await waitFor(() => expect(mockMapa.pontos).toHaveLength(2));
    mockApi.rotaPorVias.mockClear();
    fireEvent.press(screen.getByTestId('trecho-desfazer'));
    await waitFor(() => expect(mockMapa.pontos).toHaveLength(1));
    expect(mockApi.rotaPorVias).not.toHaveBeenCalled();
    expect(mockMapa.caminho).toEqual([]);
  });

  it('enquanto traça, toques novos esperam (um ponto nunca se perde) e os botões travam', async () => {
    let liberar!: (v: unknown) => void;
    mockApi.rotaPorVias.mockReturnValueOnce(new Promise((r) => { liberar = r; })).mockImplementation(async (pts: any[]) => rotaDoServidor(pts));
    montar();
    await toque(-23.5, -46.3); await toque(-23.51, -46.3);
    expect(screen.getByText('Traçando o trecho pelas ruas…')).toBeTruthy();
    expect(usar().props.accessibilityState.disabled).toBe(true);
    await toque(-23.9, -46.9); // chegou durante o cálculo: ignorado
    await act(async () => { liberar(rotaDoServidor([{ lat: -23.5, lng: -46.3 }, { lat: -23.51, lng: -46.3 }])); });
    await waitFor(() => expect(mockMapa.pontos).toHaveLength(2));
    expect(mockApi.rotaPorVias).toHaveBeenCalledTimes(1);
  });

  it('reabre com o trecho já marcado (editar) e confirma sem refazer o trajeto', async () => {
    const inicial = { pontos: [{ lat: -23.5, lng: -46.3 }, { lat: -23.51, lng: -46.31 }], metros: 1850, caminho: [[-23.5, -46.3], [-23.51, -46.31]] as Array<[number, number]> };
    const { aoConfirmar } = montar({ inicial });
    expect(mockMapa.pontosIniciais).toEqual(inicial.pontos);
    expect(screen.getByText(/2 pontos · ≈ 1,85 km pelas ruas/)).toBeTruthy();
    expect(mockApi.rotaPorVias).not.toHaveBeenCalled();
    fireEvent.press(usar());
    expect(aoConfirmar).toHaveBeenCalledWith(inicial);
  });

  it('se o mapa não carregar (sem internet), avisa; voltar fecha o editor', async () => {
    const { aoFechar } = montar();
    await act(async () => { mockMapa.aoMensagem({ tipo: 'erro-mapa' }); });
    expect(await screen.findByText('Não foi possível carregar o mapa. Verifique a conexão.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(aoFechar).toHaveBeenCalled();
  });
});
