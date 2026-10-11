import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { opDe, estadoDados, valorFinalizacao, dadosDe, type EstadoDados } from './ajudas';
import { criarBootstrap } from '@/testing/fixtures';

let mockDados: EstadoDados = estadoDados();
let mockFin: ReturnType<typeof valorFinalizacao> = valorFinalizacao();
let mockConfirmar = jest.fn(async (..._a: unknown[]) => true);
const mockArquivos = { apagar: jest.fn(async (..._a: unknown[]) => undefined) };
const mockPreparar = jest.fn();
const mockGaleria = jest.fn();
const mockPendente = jest.fn();
let mockFotoDaCamera = { uri: 'file:///tmp/c.jpg', width: 4000, height: 3000 };

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }), useLocalSearchParams: () => ({ id: '101' }) }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/estado/DadosProvider', () => ({ useDados: () => mockDados }));
jest.mock('@/estado/FinalizacaoProvider', () => ({ useFinalizacao: () => mockFin }));
jest.mock('@/estado/AppProvider', () => ({ useApp: () => ({ arquivos: mockArquivos }) }));
jest.mock('@/components/confirmar', () => ({ confirmar: (...a: unknown[]) => mockConfirmar(...a) }));
jest.mock('@/estado/fotos', () => ({ prepararFoto: (...a: unknown[]) => mockPreparar(...a), escolherDaGaleria: (...a: unknown[]) => mockGaleria(...a), recuperarGaleriaPendente: (...a: unknown[]) => mockPendente(...a) }));
jest.mock('@/components/CameraFoto', () => ({
  CameraFoto: ({ aoCapturar, aoConcluir, totalTiradas }: { aoCapturar: (f: unknown) => Promise<void>; aoConcluir: () => void; totalTiradas: number }) => {
    const { Pressable, Text } = require('react-native'); const React = require('react');
    return React.createElement(React.Fragment, null,
      React.createElement(Text, { testID: 'camera-total' }, String(totalTiradas)),
      React.createElement(Pressable, { testID: 'camera-disparar', onPress: () => aoCapturar(mockFotoDaCamera).catch(() => undefined) }, React.createElement(Text, null, 'disparar')),
      React.createElement(Pressable, { testID: 'camera-concluir', onPress: aoConcluir }, React.createElement(Text, null, 'concluir')));
  },
}));

import Fotos from '@/app/(app)/os/[id]/finalizar/fotos';

const foto = (n: number, extra: Record<string, unknown> = {}) => ({ client_uuid: `u${n}`, usuario_id: 7, os_id: 101, arquivo: `file:///fotos/${n}.jpg`, mime: 'image/jpeg', tamanho: 100, tirada_em: 'x', lat: null, lng: null, legenda: null, servidor_id: null, removida: false, criado_em: 'x', ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  mockDados = estadoDados();
  mockFin = valorFinalizacao(101);
  mockConfirmar = jest.fn(async () => true);
  mockPreparar.mockReset().mockResolvedValue({ uri: 'file:///fotos/nova.jpg', tamanho: 250_000 });
  mockGaleria.mockReset().mockResolvedValue([]);
  mockPendente.mockReset().mockResolvedValue([]);
  mockFotoDaCamera = { uri: 'file:///tmp/c.jpg', width: 4000, height: 3000 };
});

describe('Fotos do serviço', () => {
  it('sem fotos: explica o mínimo e o máximo do servidor e a etapa continua pendente', () => {
    render(<Fotos />);
    expect(screen.getByText('Nenhuma foto ainda')).toBeTruthy();
    expect(screen.getByText(/Mínimo 1 foto, máximo 30/)).toBeTruthy();
    expect(screen.getByTestId('contador-fotos').props.children.join('')).toBe('0 de 30 fotos');
    expect(mockFin.concluidas.fotos).toBe(false);
  });
  it('mostra cada foto com a situação do envio', () => {
    const ops = [opDe('foto', { id: 1, estado: 'enviando', payload: { arquivo: 'a', mime: 'image/jpeg', campos: { client_uuid: 'u1', tirada_em: 'x' } } }), opDe('foto', { id: 2, estado: 'atencao', payload: { arquivo: 'b', mime: 'image/jpeg', campos: { client_uuid: 'u2', tirada_em: 'x' } } })];
    mockFin = valorFinalizacao(101, { fotos: [foto(1), foto(2), foto(3, { servidor_id: 9, arquivo: null }), foto(4)] });
    mockDados = estadoDados({ ops });
    render(<Fotos />);
    expect(screen.getByTestId('situacao-u1').props.children).toBe('Enviando…');
    expect(screen.getByTestId('situacao-u2').props.children).toBe('Requer atenção');
    expect(screen.getByTestId('situacao-u3').props.children).toBe('Enviada');
    expect(screen.getByTestId('situacao-u4').props.children).toBe('Aguardando envio');
  });
  it('câmera: cada disparo comprime, guarda e enfileira; a câmera continua aberta para a próxima', async () => {
    render(<Fotos />);
    fireEvent.press(screen.getByTestId('botao-tirar-foto'));
    fireEvent.press(screen.getByTestId('camera-disparar'));
    await waitFor(() => expect(mockDados.comandos.adicionarFoto).toHaveBeenCalledWith({ osId: 101, arquivo: 'file:///fotos/nova.jpg', tamanho: 250_000 }));
    expect(mockPreparar).toHaveBeenCalledWith(mockFotoDaCamera, expect.stringMatching(/^foto-/));
    expect(screen.getByTestId('camera-disparar')).toBeTruthy();
    fireEvent.press(screen.getByTestId('camera-concluir'));
    expect(screen.getByTestId('botao-tirar-foto')).toBeTruthy();
  });
  it('se a fila recusar a foto (ex.: limite), o arquivo recém-criado é apagado — nada fica órfão no aparelho', async () => {
    mockDados.comandos.adicionarFoto.mockRejectedValue(new Error('Cada OS aceita no máximo 30 fotos.'));
    render(<Fotos />);
    fireEvent.press(screen.getByTestId('botao-tirar-foto'));
    fireEvent.press(screen.getByTestId('camera-disparar'));
    await waitFor(() => expect(mockArquivos.apagar).toHaveBeenCalledWith('file:///fotos/nova.jpg'));
  });
  it('galeria: várias fotos de uma vez, limitadas ao que ainda cabe', async () => {
    mockFin = valorFinalizacao(101, { totalFotos: 28, fotos: [foto(1)] });
    mockGaleria.mockResolvedValue([{ uri: 'file:///g/1.heic', width: 3000, height: 4000 }, { uri: 'file:///g/2.jpg', width: 1000, height: 800 }]);
    render(<Fotos />);
    fireEvent.press(screen.getByTestId('botao-galeria'));
    await waitFor(() => expect(mockDados.comandos.adicionarFoto).toHaveBeenCalledTimes(2));
    expect(mockGaleria).toHaveBeenCalledWith(2);
    expect(mockPreparar).toHaveBeenCalledTimes(2);
  });
  it('galeria: se uma das fotos falha, as outras entram e o erro aparece', async () => {
    mockGaleria.mockResolvedValue([{ uri: 'a', width: 1, height: 1 }, { uri: 'b', width: 1, height: 1 }]);
    mockPreparar.mockRejectedValueOnce(new Error('Imagem inválida')).mockResolvedValueOnce({ uri: 'file:///fotos/ok.jpg', tamanho: 10 });
    render(<Fotos />);
    fireEvent.press(screen.getByTestId('botao-galeria'));
    expect(await screen.findByText('1 foto(s) não puderam ser adicionadas: Imagem inválida')).toBeTruthy();
    expect(mockDados.comandos.adicionarFoto).toHaveBeenCalledTimes(1);
  });
  it('limite atingido: botões travados e o contador avisa', () => {
    mockFin = valorFinalizacao(101, { totalFotos: 30, fotos: [foto(1)] });
    render(<Fotos />);
    expect(screen.getByTestId('botao-tirar-foto').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('botao-galeria').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('contador-fotos').props.children.join('')).toBe('30 de 30 fotos (limite atingido)');
  });
  it('remover: só depois de confirmar', async () => {
    mockFin = valorFinalizacao(101, { fotos: [foto(1)] });
    render(<Fotos />);
    mockConfirmar.mockResolvedValueOnce(false);
    fireEvent.press(screen.getByTestId('remover-u1'));
    await waitFor(() => expect(mockConfirmar).toHaveBeenCalledTimes(1));
    expect(mockDados.comandos.removerFoto).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('remover-u1'));
    await waitFor(() => expect(mockDados.comandos.removerFoto).toHaveBeenCalledWith(101, 'u1'));
  });
  it('com a finalização na fila não dá para remover nem adicionar', () => {
    mockFin = valorFinalizacao(101, { fotos: [foto(1)], editavel: false });
    render(<Fotos />);
    expect(screen.queryByTestId('remover-u1')).toBeNull();
    expect(screen.getByTestId('botao-tirar-foto').props.accessibilityState.disabled).toBe(true);
  });
  it('avisa das fotos que já estão só no servidor', () => {
    mockFin = valorFinalizacao(101, { totalFotos: 3, fotos: [foto(1)] });
    render(<Fotos />);
    expect(screen.getByText('+ 2 fotos desta OS já no servidor.')).toBeTruthy();
  });
  it('recupera a escolha da galeria que ficou pendente se o Android encerrou o app', async () => {
    mockPendente.mockResolvedValue([{ uri: 'file:///g/p.jpg', width: 2000, height: 1500 }]);
    render(<Fotos />);
    await waitFor(() => expect(mockDados.comandos.adicionarFoto).toHaveBeenCalledTimes(1));
  });
  it('respeita limites vindos do servidor', () => {
    mockFin = valorFinalizacao(101, { dados: dadosDe({ regras: { ...criarBootstrap().regras, fotos_min: 3, fotos_max: 5 } }) });
    render(<Fotos />);
    expect(screen.getByText(/Mínimo 3 fotos, máximo 5/)).toBeTruthy();
  });
});
