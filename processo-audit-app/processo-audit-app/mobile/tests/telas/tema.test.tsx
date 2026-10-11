import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Appearance, StyleSheet } from 'react-native';
import { armazenamentoEmMemoria } from '@/auth/armazenamento';
import { ConfigTema } from '@/config/tema';
import { paletaDoEsquema, aplicarPreferencia } from '@/estado/tema';
import { paletaClara, paletaEscura } from '@/theme';
import { estadoDados } from './ajudas';

let mockDados = estadoDados();
let mockEsquema: 'light' | 'dark' = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockEsquema }));
const mockTema = { atual: jest.fn(() => 'sistema' as string), definir: jest.fn(async (..._a: unknown[]) => undefined) };
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }) }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/estado/DadosProvider', () => ({ useDados: () => mockDados }));
jest.mock('@/estado/AppProvider', () => ({ useApp: () => ({ sessao: { sair: jest.fn() }, servidor: { url: () => 'http://srv/api' }, banco: {}, arquivos: { apagar: jest.fn() }, tema: mockTema }) }));
jest.mock('@/estado/useSessao', () => ({ useEstadoSessao: () => ({ status: 'logado', usuario: { id: 7, email: 'joao@exemplo.com', name: 'João', role: 'tecnico' } }) }));

import Conta from '@/app/(app)/(tabs)/conta';
import { Botao } from '@/components/Botao';
import { Cabecalho } from '@/components/Cabecalho';
import { Faixa } from '@/components/Faixa';

const fundoDe = (el: any): string => StyleSheet.flatten(el.props.style).backgroundColor;
const esquema = (v: 'light' | 'dark') => { mockEsquema = v; };
const comFundo = (inicio: any) => { let el: any = inicio; while (el && !StyleSheet.flatten(el.props.style)?.backgroundColor) el = el.parent; return el; };

afterEach(() => { jest.restoreAllMocks(); mockEsquema = 'light'; });

describe('ConfigTema (escolha do técnico guardada no aparelho)', () => {
  it('sem nada guardado, segue o aparelho', async () => {
    const t = new ConfigTema(armazenamentoEmMemoria());
    expect(await t.carregar()).toBe('sistema');
  });
  it('guarda e relê a escolha', async () => {
    const mem = armazenamentoEmMemoria();
    await new ConfigTema(mem).definir('escuro');
    const outro = new ConfigTema(mem);
    expect(await outro.carregar()).toBe('escuro');
    expect(outro.atual()).toBe('escuro');
  });
  it('valor estranho ou cofre com defeito voltam ao padrão, sem quebrar o app', async () => {
    expect(await new ConfigTema(armazenamentoEmMemoria({ 'os.config.tema': 'roxo' })).carregar()).toBe('sistema');
    const quebrado = { get: async () => { throw new Error('cofre indisponível'); }, set: async () => { throw new Error('cofre indisponível'); }, remove: async () => undefined };
    const t = new ConfigTema(quebrado);
    expect(await t.carregar()).toBe('sistema');
    await expect(t.definir('claro')).resolves.toBeUndefined(); // não guardar não impede de aplicar agora
    expect(t.atual()).toBe('claro');
  });
});

describe('paleta do esquema', () => {
  it('"dark" usa a escura; qualquer outra coisa (inclusive sem informação) a clara', () => {
    expect(paletaDoEsquema('dark')).toBe(paletaEscura);
    expect(paletaDoEsquema('light')).toBe(paletaClara);
    expect(paletaDoEsquema(null)).toBe(paletaClara);
    expect(paletaDoEsquema(undefined)).toBe(paletaClara);
  });
  it('aplicarPreferencia traduz Automático/Claro/Escuro para o aparelho e não quebra se a plataforma não suportar', () => {
    const set = jest.fn();
    (Appearance as any).setColorScheme = set;
    aplicarPreferencia('sistema'); aplicarPreferencia('claro'); aplicarPreferencia('escuro');
    expect(set.mock.calls.map((c) => c[0])).toEqual(['auto', 'light', 'dark']);
    (Appearance as any).setColorScheme = () => { throw new Error('não suportado'); };
    expect(() => aplicarPreferencia('escuro')).not.toThrow();
    (Appearance as any).setColorScheme = undefined;
    expect(() => aplicarPreferencia('escuro')).not.toThrow();
  });
});

describe('as telas realmente trocam de cor', () => {
  it('claro: botão principal e cabeçalho com as cores do tema claro', () => {
    esquema('light');
    render(<><Cabecalho titulo="Teste" /><Botao titulo="Salvar" onPress={() => undefined} testID="b" /></>);
    expect(fundoDe(screen.getByTestId('b'))).toBe(paletaClara.primariaBotao);
    expect(fundoDe(comFundo(screen.getByRole('header')))).toBe(paletaClara.destaqueFundo);
  });
  it('escuro: os mesmos componentes pegam as cores do tema escuro', () => {
    esquema('dark');
    render(<><Cabecalho titulo="Teste" /><Botao titulo="Salvar" onPress={() => undefined} testID="b" /></>);
    expect(fundoDe(screen.getByTestId('b'))).toBe(paletaEscura.primariaBotao);
    expect(fundoDe(comFundo(screen.getByRole('header')))).toBe(paletaEscura.destaqueFundo);
  });
  it('o aviso usa o tom certo em cada tema (fundo do erro muda)', () => {
    esquema('dark');
    const { unmount } = render(<Faixa tom="erro" texto="Falhou" />);
    expect(fundoDe(comFundo(screen.getByText('Falhou')))).toBe(paletaEscura.erroClaro);
    unmount();
    esquema('light');
    render(<Faixa tom="erro" texto="Falhou" />);
    expect(fundoDe(comFundo(screen.getByText('Falhou')))).toBe(paletaClara.erroClaro);
  });
});

describe('Conta: Aparência', () => {
  beforeEach(() => { mockTema.atual.mockReturnValue('sistema'); mockTema.definir.mockClear(); (Appearance as any).setColorScheme = jest.fn(); });
  it('mostra a escolha atual e, ao tocar em Escuro, aplica na hora e guarda', async () => {
    render(<Conta />);
    expect(screen.getByTestId('tema-sistema').props.accessibilityState.checked).toBe(true);
    await act(async () => { fireEvent.press(screen.getByTestId('tema-escuro')); });
    expect(screen.getByTestId('tema-escuro').props.accessibilityState.checked).toBe(true);
    expect((Appearance as any).setColorScheme).toHaveBeenCalledWith('dark');
    expect(mockTema.definir).toHaveBeenCalledWith('escuro');
  });
  it('voltar para Automático remove a escolha forçada', async () => {
    mockTema.atual.mockReturnValue('claro');
    render(<Conta />);
    expect(screen.getByTestId('tema-claro').props.accessibilityState.checked).toBe(true);
    await act(async () => { fireEvent.press(screen.getByTestId('tema-sistema')); });
    expect((Appearance as any).setColorScheme).toHaveBeenCalledWith('auto');
    expect(mockTema.definir).toHaveBeenCalledWith('sistema');
  });
});
