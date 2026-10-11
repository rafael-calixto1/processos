import { fireEvent, render, screen } from '@testing-library/react-native';

let mockPermissao: any = null;
const mockPedir = jest.fn(async () => undefined);
let mockPropsCamera: any = null;
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-camera', () => ({
  useCameraPermissions: () => [mockPermissao, mockPedir],
  CameraView: (props: any) => { mockPropsCamera = props; const React = require('react'); return React.createElement('CameraView', null); },
}));

import { LeitorQR } from '@/components/LeitorQR';

beforeEach(() => { jest.clearAllMocks(); mockPropsCamera = null; });

describe('LeitorQR (câmera)', () => {
  it('enquanto a permissão não foi consultada mostra "Abrindo a câmera…"', () => {
    mockPermissao = null;
    render(<LeitorQR aoLer={jest.fn()} aoFechar={jest.fn()} />);
    expect(screen.getByText('Abrindo a câmera…')).toBeTruthy();
  });
  it('permissão ainda não dada: explica e oferece permitir ou escolher na lista', () => {
    mockPermissao = { granted: false, canAskAgain: true };
    const fechar = jest.fn();
    render(<LeitorQR aoLer={jest.fn()} aoFechar={fechar} />);
    expect(screen.getByText(/Permita o uso da câmera para ler o QR code/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('leitor-permitir'));
    expect(mockPedir).toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('leitor-fechar'));
    expect(fechar).toHaveBeenCalled();
  });
  it('permissão bloqueada: manda abrir as Configurações e não oferece pedir de novo', () => {
    mockPermissao = { granted: false, canAskAgain: false };
    render(<LeitorQR aoLer={jest.fn()} aoFechar={jest.fn()} />);
    expect(screen.getByText(/Abra as Configurações do aparelho/)).toBeTruthy();
    expect(screen.queryByTestId('leitor-permitir')).toBeNull();
  });
  it('com permissão: câmera traseira lendo só QR code', () => {
    mockPermissao = { granted: true, canAskAgain: true };
    render(<LeitorQR aoLer={jest.fn()} aoFechar={jest.fn()} />);
    expect(mockPropsCamera.facing).toBe('back');
    expect(mockPropsCamera.barcodeScannerSettings).toEqual({ barcodeTypes: ['qr'] });
    expect(screen.getByText('Aponte para o QR code da etiqueta do lote')).toBeTruthy();
  });
  it('lê UMA vez só, mesmo que a câmera dispare várias leituras seguidas, e ignora leitura vazia', () => {
    mockPermissao = { granted: true, canAskAgain: true };
    const aoLer = jest.fn();
    render(<LeitorQR aoLer={aoLer} aoFechar={jest.fn()} />);
    mockPropsCamera.onBarcodeScanned({ data: '' });
    expect(aoLer).not.toHaveBeenCalled();
    mockPropsCamera.onBarcodeScanned({ data: 'LOTE-BOB-0001' });
    mockPropsCamera.onBarcodeScanned({ data: 'LOTE-BOB-0001' });
    mockPropsCamera.onBarcodeScanned({ data: 'LOTE-BOB-0002' });
    expect(aoLer).toHaveBeenCalledTimes(1);
    expect(aoLer).toHaveBeenCalledWith('LOTE-BOB-0001');
  });
});
