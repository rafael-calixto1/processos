import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

let mockPermissao: any = { granted: true, canAskAgain: true };
const mockPedir = jest.fn(async () => undefined);
let mockPropsCamera: any = null;
const mockTirar = jest.fn();
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-camera', () => {
  const React = require('react');
  return {
    useCameraPermissions: () => [mockPermissao, mockPedir],
    CameraView: React.forwardRef((props: any, ref: any) => { mockPropsCamera = props; React.useImperativeHandle(ref, () => ({ takePictureAsync: mockTirar })); return React.createElement('CameraView', null); }),
  };
});

import { CameraFoto } from '@/components/CameraFoto';

beforeEach(() => {
  jest.clearAllMocks(); mockPropsCamera = null;
  mockPermissao = { granted: true, canAskAgain: true };
  mockTirar.mockReset().mockResolvedValue({ uri: 'file:///cache/c.jpg', width: 4000, height: 3000 });
});
const pronta = () => act(() => { mockPropsCamera.onCameraReady(); });

describe('CameraFoto (câmera do próprio app)', () => {
  it('sem permissão: explica, oferece permitir e voltar (a galeria continua disponível)', () => {
    mockPermissao = { granted: false, canAskAgain: true };
    const concluir = jest.fn();
    render(<CameraFoto aoCapturar={jest.fn()} aoConcluir={concluir} totalTiradas={0} />);
    expect(screen.getByText(/Permita o uso da câmera para fotografar o serviço\. Você também pode escolher fotos da galeria/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('camera-permitir'));
    expect(mockPedir).toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('camera-concluir'));
    expect(concluir).toHaveBeenCalled();
  });
  it('permissão bloqueada: manda abrir as Configurações', () => {
    mockPermissao = { granted: false, canAskAgain: false };
    render(<CameraFoto aoCapturar={jest.fn()} aoConcluir={jest.fn()} totalTiradas={0} />);
    expect(screen.getByText(/Abra as Configurações do aparelho/)).toBeTruthy();
    expect(screen.queryByTestId('camera-permitir')).toBeNull();
  });
  it('o botão do disparo só vale depois de a câmera estar pronta', async () => {
    render(<CameraFoto aoCapturar={jest.fn()} aoConcluir={jest.fn()} totalTiradas={0} />);
    expect(screen.getByTestId('camera-disparar').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('camera-disparar'));
    expect(mockTirar).not.toHaveBeenCalled();
    pronta();
    fireEvent.press(screen.getByTestId('camera-disparar'));
    await waitFor(() => expect(mockTirar).toHaveBeenCalledTimes(1));
  });
  it('entrega a foto (uri e tamanho) e continua aberta para a próxima, com o contador', async () => {
    const aoCapturar = jest.fn(async () => undefined);
    render(<CameraFoto aoCapturar={aoCapturar} aoConcluir={jest.fn()} totalTiradas={2} />);
    pronta();
    expect(screen.getByText('2 fotos nesta OS')).toBeTruthy();
    fireEvent.press(screen.getByTestId('camera-disparar'));
    await waitFor(() => expect(aoCapturar).toHaveBeenCalledWith({ uri: 'file:///cache/c.jpg', width: 4000, height: 3000 }));
    expect(mockPropsCamera.facing).toBe('back');
  });
  it('toque duplo enquanto prepara a foto não tira duas', async () => {
    let liberar!: () => void;
    const aoCapturar = jest.fn(() => new Promise<void>((r) => { liberar = r; }));
    render(<CameraFoto aoCapturar={aoCapturar} aoConcluir={jest.fn()} totalTiradas={0} />);
    pronta();
    fireEvent.press(screen.getByTestId('camera-disparar'));
    await waitFor(() => expect(aoCapturar).toHaveBeenCalledTimes(1));
    fireEvent.press(screen.getByTestId('camera-disparar'));
    fireEvent.press(screen.getByTestId('camera-disparar'));
    expect(mockTirar).toHaveBeenCalledTimes(1);
    await act(async () => { liberar(); });
    fireEvent.press(screen.getByTestId('camera-disparar'));
    await waitFor(() => expect(mockTirar).toHaveBeenCalledTimes(2));
  });
  it('falha ao tirar ou ao guardar a foto aparece na tela e a câmera continua utilizável', async () => {
    const aoCapturar = jest.fn().mockRejectedValueOnce(new Error('Cada OS aceita no máximo 30 fotos.')).mockResolvedValue(undefined);
    render(<CameraFoto aoCapturar={aoCapturar} aoConcluir={jest.fn()} totalTiradas={30} />);
    pronta();
    fireEvent.press(screen.getByTestId('camera-disparar'));
    expect(await screen.findByText('Cada OS aceita no máximo 30 fotos.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('camera-disparar'));
    await waitFor(() => expect(aoCapturar).toHaveBeenCalledTimes(2));
  });
});
