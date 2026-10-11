import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError, NetworkError } from '@/api/erros';

const mockSessao = { entrar: jest.fn() };
const mockServidor = { url: jest.fn(), definir: jest.fn() };
let mockEstadoSessao: any = { status: 'deslogado' };
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/estado/AppProvider', () => ({ useApp: () => ({ sessao: mockSessao, servidor: mockServidor }) }));
jest.mock('@/estado/useSessao', () => ({ useEstadoSessao: () => mockEstadoSessao }));

import Login from '@/app/login';

const preencher = (email: string, senha: string) => {
  fireEvent.changeText(screen.getByTestId('campo-email'), email);
  fireEvent.changeText(screen.getByTestId('campo-senha'), senha);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEstadoSessao = { status: 'deslogado' };
  mockServidor.url.mockReturnValue('http://10.0.0.5:5002/api');
  mockServidor.definir.mockImplementation(async (t: string) => (t.trim() ? { ok: true, url: `http://${t}/api` } : { ok: false, erro: 'Informe o endereço do servidor' }));
  mockSessao.entrar.mockResolvedValue({ id: 1 });
});

describe('Login', () => {
  it('não envia com e-mail ou senha vazios e diz o que falta', async () => {
    render(<Login />);
    fireEvent.press(screen.getByTestId('botao-entrar'));
    expect(await screen.findByText('Informe seu e-mail')).toBeTruthy();
    expect(screen.getByText('Informe sua senha')).toBeTruthy();
    expect(mockSessao.entrar).not.toHaveBeenCalled();
  });

  it('entra com as credenciais digitadas e vai para o app', async () => {
    render(<Login />);
    preencher('joao@exemplo.com', 'segredo');
    fireEvent.press(screen.getByTestId('botao-entrar'));
    await waitFor(() => expect(mockSessao.entrar).toHaveBeenCalledWith('joao@exemplo.com', 'segredo'));
    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(mockServidor.definir).not.toHaveBeenCalled(); // servidor já configurado e campo fechado
  });

  it('sem servidor configurado, o campo de endereço aparece e é obrigatório', async () => {
    mockServidor.url.mockReturnValue(null);
    render(<Login />);
    expect(screen.getByTestId('campo-servidor')).toBeTruthy();
    preencher('joao@exemplo.com', 'segredo');
    fireEvent.press(screen.getByTestId('botao-entrar'));
    expect(await screen.findByText('Informe o endereço do servidor')).toBeTruthy();
    expect(mockSessao.entrar).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByTestId('campo-servidor'), '10.0.0.9:5002');
    fireEvent.press(screen.getByTestId('botao-entrar'));
    await waitFor(() => expect(mockSessao.entrar).toHaveBeenCalled());
    expect(mockServidor.definir).toHaveBeenCalledWith('10.0.0.9:5002');
  });

  it('mostra a mensagem do servidor quando a senha está errada e não navega', async () => {
    mockSessao.entrar.mockRejectedValue(new ApiError(401, 'Email ou senha inválidos'));
    render(<Login />);
    preencher('joao@exemplo.com', 'errada');
    fireEvent.press(screen.getByTestId('botao-entrar'));
    expect(await screen.findByText('Email ou senha inválidos')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('bloqueio por tentativas mostra quanto esperar', async () => {
    mockSessao.entrar.mockRejectedValue(new ApiError(429, 'Muitas tentativas de login. Aguarde alguns minutos e tente de novo.', { retryAfter: 840 }));
    render(<Login />);
    preencher('joao@exemplo.com', 'x');
    fireEvent.press(screen.getByTestId('botao-entrar'));
    expect(await screen.findByText(/Tente de novo em 14 min/)).toBeTruthy();
  });

  it('sem rede ou servidor errado, sugere conferir o endereço', async () => {
    mockSessao.entrar.mockRejectedValue(new NetworkError());
    render(<Login />);
    preencher('joao@exemplo.com', 'x');
    fireEvent.press(screen.getByTestId('botao-entrar'));
    expect(await screen.findByText(/Sem conexão com o servidor.*endereço do servidor/)).toBeTruthy();
  });

  it('perfil que não é técnico recebe a mensagem do servidor', async () => {
    mockSessao.entrar.mockRejectedValue(new ApiError(403, 'Este aplicativo é exclusivo para técnicos'));
    render(<Login />);
    preencher('admin@exemplo.com', 'x');
    fireEvent.press(screen.getByTestId('botao-entrar'));
    expect(await screen.findByText('Este aplicativo é exclusivo para técnicos')).toBeTruthy();
  });

  it('avisa quando a sessão anterior expirou', () => {
    mockEstadoSessao = { status: 'deslogado', motivo: 'expirada' };
    render(<Login />);
    expect(screen.getByText('Sua sessão expirou. Entre novamente.')).toBeTruthy();
  });

  it('toques repetidos enquanto envia não geram um segundo login', async () => {
    let liberar!: () => void;
    mockSessao.entrar.mockImplementation(() => new Promise((r) => { liberar = () => r({ id: 1 }); }));
    render(<Login />);
    preencher('joao@exemplo.com', 'segredo');
    fireEvent.press(screen.getByTestId('botao-entrar'));
    await waitFor(() => expect(mockSessao.entrar).toHaveBeenCalledTimes(1));
    fireEvent.press(screen.getByTestId('botao-entrar'));
    fireEvent.press(screen.getByTestId('botao-entrar'));
    expect(mockSessao.entrar).toHaveBeenCalledTimes(1);
    liberar();
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
  });
});
