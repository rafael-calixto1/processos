import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { ApiError } from '@/api/erros';
import { criarBootstrap, criarOS } from '@/testing/fixtures';
import { dadosDe, estadoDados, type EstadoDados } from './ajudas';

let mockDados: EstadoDados = estadoDados();
let mockOnline = true;
let mockParams: { id?: string } = { id: '101' };
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace, canGoBack: () => true }), useLocalSearchParams: () => mockParams }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/estado/DadosProvider', () => ({ useDados: () => mockDados }));
jest.mock('@/estado/rede', () => ({ useOnline: () => mockOnline }));

import MinhasOS from '@/app/(app)/(tabs)/index';
import MeuEstoque from '@/app/(app)/(tabs)/estoque';
import DetalheOS from '@/app/(app)/os/[id]/index';

let mockOpenURL: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  mockOpenURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  mockDados = estadoDados();
  mockOnline = true;
  mockParams = { id: '102' }; // a OS 102 está aberta (a 101 já vem em andamento na massa de teste)
});

describe('Minhas OS', () => {
  it('lista as pendentes, da mais urgente para a menos, com contagem nas abas e a hora da atualização', () => {
    mockDados = estadoDados({ dados: dadosDe({ os: [criarOS(1, { prazo: '2026-10-25' }), criarOS(2, { prazo: '2026-10-12', prioridade: 'alta' }), criarOS(3, { status: 'concluida', concluida_em: '2026-10-09T18:00:00.000Z' })] }) });
    render(<MinhasOS />);
    expect(screen.getByText('Pendentes (2)')).toBeTruthy();
    expect(screen.getByText('Encerradas (1)')).toBeTruthy();
    const cartoes = screen.getAllByRole('button').filter((b) => String(b.props.accessibilityLabel ?? '').startsWith('OS '));
    expect(cartoes.map((c) => c.props.accessibilityLabel.split(',')[0])).toEqual(['OS 2', 'OS 1']); // prazo mais próximo primeiro
    expect(screen.getByText('Alta')).toBeTruthy();
    expect(screen.getByText(/João Técnico · Atualizado/)).toBeTruthy();
  });

  it('as encerradas ficam na outra aba', () => {
    render(<MinhasOS />);
    fireEvent.press(screen.getByRole('tab', { name: /Encerradas/ }));
    expect(screen.getByText(/OS #3/)).toBeTruthy();
    expect(screen.queryByText(/OS #2/)).toBeNull();
  });

  it('tocar numa OS abre o detalhe dela', () => {
    render(<MinhasOS />);
    fireEvent.press(screen.getByLabelText(/^OS 2,/));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/os/[id]', params: { id: '102' } });
  });

  it('sem conexão mostra o aviso com a hora dos dados guardados, e as OS continuam na tela', () => {
    mockDados = estadoDados({ semConexao: true });
    render(<MinhasOS />);
    expect(screen.getByText(/Sem conexão\. Mostrando os dados de \d\d:\d\d\./)).toBeTruthy();
    expect(screen.getByLabelText(/^OS 2,/)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Tentar' }));
    expect(mockDados.atualizar).toHaveBeenCalled();
  });

  it('erro do servidor aparece com a opção de tentar de novo', () => {
    mockDados = estadoDados({ erro: 'Seu usuário não está vinculado a um técnico' });
    render(<MinhasOS />);
    expect(screen.getByText('Seu usuário não está vinculado a um técnico')).toBeTruthy();
  });

  it('primeiro uso sem internet: explica o que fazer em vez de uma tela em branco', () => {
    mockDados = estadoDados({ dados: null, semConexao: true, sincronizadoEm: null });
    render(<MinhasOS />);
    expect(screen.getByText('Sem conexão')).toBeTruthy();
    expect(screen.getByText(/Conecte-se à internet uma vez/)).toBeTruthy();
  });

  it('sem OS pendentes mostra um estado vazio claro', () => {
    mockDados = estadoDados({ dados: dadosDe({ os: [] }) });
    render(<MinhasOS />);
    expect(screen.getByText('Nenhuma OS pendente')).toBeTruthy();
  });

  it('enquanto lê o banco local não pisca "sem dados"', () => {
    mockDados = estadoDados({ dados: null, carregado: false });
    render(<MinhasOS />);
    expect(screen.queryByText(/Ainda não há dados/)).toBeNull();
  });
});

describe('Detalhe da OS', () => {
  it('mostra os dados da OS e o botão de iniciar quando está aberta', () => {
    render(<DetalheOS />);
    expect(screen.getByText('OS #2')).toBeTruthy();
    expect(screen.getByText('Estrada Takashi Kobata, 572, Suzano/SP')).toBeTruthy();
    expect(screen.getByText('-23.544500, -46.311800')).toBeTruthy();
    expect(screen.getByText('PL-0902')).toBeTruthy();
    expect(screen.getByTestId('botao-iniciar')).toBeTruthy();
  });

  it('iniciar chama o servidor uma vez e não mostra erro', async () => {
    render(<DetalheOS />);
    fireEvent.press(screen.getByTestId('botao-iniciar'));
    await waitFor(() => expect(mockDados.comandos.iniciarOS).toHaveBeenCalledWith(102));
    expect(mockDados.comandos.iniciarOS).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sem internet INICIA do mesmo jeito: vai para a fila e a tela não pede conexão', async () => {
    mockOnline = false;
    render(<DetalheOS />);
    fireEvent.press(screen.getByTestId('botao-iniciar'));
    await waitFor(() => expect(mockDados.comandos.iniciarOS).toHaveBeenCalledWith(102));
    expect(screen.queryByText(/precisa|Sem conexão/)).toBeNull();
  });

  it('o erro do "Iniciar execução" aparece JUNTO do botão (na barra fixa), não lá no alto da página onde passaria despercebido', async () => {
    mockDados.comandos.iniciarOS.mockRejectedValue(new Error('Falha qualquer ao iniciar'));
    render(<DetalheOS />);
    fireEvent.press(screen.getByTestId('botao-iniciar'));
    await screen.findByText('Falha qualquer ao iniciar');
    let el: any = screen.getByTestId('botao-iniciar');
    while (el && !within(el).queryByText('Falha qualquer ao iniciar')) el = el.parent;
    expect(el).toBeTruthy();
    expect(within(el).queryByText('Nome da OS')).toBeNull(); // o ancestral comum é a barra de ação, não a página inteira
  });

  it('mostra a recusa do servidor (OS encerrada, de outro técnico)', async () => {
    mockDados.comandos.iniciarOS.mockRejectedValue(new ApiError(409, 'OS encerrada: não pode ser iniciada'));
    render(<DetalheOS />);
    fireEvent.press(screen.getByTestId('botao-iniciar'));
    expect(await screen.findByText('OS encerrada: não pode ser iniciada')).toBeTruthy();
  });

  it('em andamento: sem botão de iniciar e com a hora em que a execução começou', () => {
    mockParams = { id: '101' };
    mockDados = estadoDados({ dados: dadosDe({ os: [criarOS(1, { status: 'em_andamento', iniciado_em: '2026-10-11T12:00:00.000Z' })] }) });
    render(<DetalheOS />);
    expect(screen.queryByTestId('botao-iniciar')).toBeNull();
    expect(screen.getByText(/Execução iniciada às \d\d:\d\d\./)).toBeTruthy();
  });

  it('encerrada é somente leitura', () => {
    mockParams = { id: '103' };
    mockDados = estadoDados({ dados: dadosDe({ os: [criarOS(3, { status: 'concluida', concluida_em: '2026-10-09T18:00:00.000Z' })] }) });
    render(<DetalheOS />);
    expect(screen.queryByTestId('botao-iniciar')).toBeNull();
    expect(screen.getByText(/está concluída e é somente leitura/)).toBeTruthy();
  });

  it('OS que não está mais na lista mostra uma explicação e volta', () => {
    mockParams = { id: '999' };
    render(<DetalheOS />);
    expect(screen.getByText('OS não encontrada')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Voltar para minhas OS' }));
    expect(mockBack).toHaveBeenCalled();
  });

  it('abre o endereço no app de mapas do celular', async () => {
    render(<DetalheOS />);
    fireEvent.press(screen.getByRole('button', { name: 'Abrir no mapa' }));
    await waitFor(() => expect(mockOpenURL).toHaveBeenCalledWith('https://www.google.com/maps/search/?api=1&query=-23.5445,-46.3118'));
  });
});

describe('Meu estoque', () => {
  it('agrupa os itens por unidade, soma os lotes e mostra a unidade', () => {
    render(<MeuEstoque />);
    expect(screen.getByText('Cabo óptico ASU 12F')).toBeTruthy();
    expect(screen.getByText('449,5 m')).toBeTruthy();
    expect(screen.getByText('Conector SC/APC')).toBeTruthy();
    expect(screen.getByText('50 un')).toBeTruthy(); // 30 + 20 de dois lotes
    expect(screen.getByText('2 lotes')).toBeTruthy();
    expect(screen.getByText(/Saldo do último download/)).toBeTruthy();
  });

  it('busca por nome ou lote, e avisa quando não acha nada', () => {
    render(<MeuEstoque />);
    fireEvent.changeText(screen.getByLabelText('Buscar item ou lote'), 'conector');
    expect(screen.queryByText('Cabo óptico ASU 12F')).toBeNull();
    expect(screen.getByText('50 un')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Buscar item ou lote'), 'zzz');
    expect(screen.getByText('Nada encontrado')).toBeTruthy();
  });

  it('sem material em posse explica', () => {
    mockDados = estadoDados({ dados: dadosDe({ posse: [] }) });
    render(<MeuEstoque />);
    expect(screen.getByText('Você não tem material em posse')).toBeTruthy();
  });
});
