import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { Devolucao } from '@/domain/tipos';
import { dadosDe, estadoDados, opDe, type EstadoDados } from './ajudas';

let mockDados: EstadoDados = estadoDados();
let mockConfirmar = jest.fn(async (..._a: unknown[]) => true);
let mockTextoQR = 'LOTE-BOB-0001';
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace, canGoBack: () => true }) }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/estado/DadosProvider', () => ({ useDados: () => mockDados }));
jest.mock('@/components/confirmar', () => ({ confirmar: (...a: unknown[]) => mockConfirmar(...a) }));
jest.mock('@/components/LeitorQR', () => ({
  LeitorQR: ({ aoLer, aoFechar }: { aoLer: (t: string) => void; aoFechar: () => void }) => {
    const { Pressable, Text } = require('react-native');
    const React = require('react');
    return React.createElement(React.Fragment, null,
      React.createElement(Pressable, { testID: 'leitor-simular', onPress: () => aoLer(mockTextoQR) }, React.createElement(Text, null, 'ler')),
      React.createElement(Pressable, { testID: 'leitor-fechar', onPress: aoFechar }, React.createElement(Text, null, 'fechar')));
  },
}));

import Devolver from '@/app/(app)/devolver';
import Devolucoes from '@/app/(app)/devolucoes';
import MeuEstoque from '@/app/(app)/(tabs)/estoque';

const dev = (id: number, extra: Partial<Devolucao> = {}): Devolucao => ({
  id, lote_id: 11, lote_codigo: 'LOTE-BOB-0001', item_id: 1, item_nome: 'Cabo óptico ASU 12F', unidade: 'metros', quantidade: 50, condicao: 'usado', observacao: null,
  status: 'pendente', solicitado_em: '2026-10-11T10:00:00.000Z', revisado_em: null, motivo_negacao: null, ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockDados = estadoDados();
  mockConfirmar = jest.fn(async () => true);
  mockTextoQR = 'LOTE-BOB-0001';
});

describe('Devolver material', () => {
  it('o botão só habilita com quantidade válida E condição escolhida (nunca assume novo/usado)', () => {
    render(<Devolver />);
    const botao = () => screen.getByTestId('botao-pedir-devolucao');
    expect(botao().props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('grupo-l11'));
    fireEvent.changeText(screen.getByTestId('qtd-l11'), '100');
    expect(botao().props.accessibilityState.disabled).toBe(true); // falta a condição
    fireEvent.press(screen.getByTestId('condicao-l11-usado'));
    expect(botao().props.accessibilityState.disabled).toBe(false);
  });

  it('mostra o limite e bloqueia quantidade acima do disponível', () => {
    render(<Devolver />);
    fireEvent.press(screen.getByTestId('grupo-l11'));
    expect(screen.getByTestId('limite-l11').props.children).toMatch(/até 449,5 m/);
    fireEvent.changeText(screen.getByTestId('qtd-l11'), '500');
    fireEvent.press(screen.getByTestId('condicao-l11-novo'));
    expect(screen.getByTestId('limite-l11').props.children).toMatch(/Você tem 449,5 m em posse/);
    expect(screen.getByTestId('botao-pedir-devolucao').props.accessibilityState.disabled).toBe(true);
  });

  it('envia o pedido com quantidade, condição e observação e vai para "Minhas devoluções"', async () => {
    render(<Devolver />);
    fireEvent.press(screen.getByTestId('grupo-l11'));
    fireEvent.changeText(screen.getByTestId('qtd-l11'), '120,5');
    fireEvent.press(screen.getByTestId('condicao-l11-usado'));
    fireEvent.press(screen.getByTestId('grupo-i2'));
    fireEvent.changeText(screen.getByTestId('qtd-i2'), '4');
    fireEvent.press(screen.getByTestId('condicao-i2-novo'));
    fireEvent.changeText(screen.getByTestId('campo-observacao'), 'sobra da OS 12');
    fireEvent.press(screen.getByTestId('botao-pedir-devolucao'));
    await waitFor(() => expect(mockDados.comandos.solicitarDevolucao).toHaveBeenCalledTimes(1));
    expect(mockDados.comandos.solicitarDevolucao).toHaveBeenCalledWith({
      itens: [{ chaveGrupo: 'l11', quantidade: '120,5', condicao: 'usado' }, { chaveGrupo: 'i2', quantidade: '4', condicao: 'novo' }], observacao: 'sobra da OS 12',
    });
    expect(mockReplace).toHaveBeenCalledWith('/devolucoes');
  });

  it('recusa do comando aparece em português e nada navega', async () => {
    mockDados.comandos.solicitarDevolucao.mockRejectedValueOnce(new Error('Cabo óptico: Você tem 10 m em posse'));
    render(<Devolver />);
    fireEvent.press(screen.getByTestId('grupo-l11'));
    fireEvent.changeText(screen.getByTestId('qtd-l11'), '5');
    fireEvent.press(screen.getByTestId('condicao-l11-novo'));
    fireEvent.press(screen.getByTestId('botao-pedir-devolucao'));
    expect(await screen.findByText(/Você tem 10 m em posse/)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('lote lido pelo QR é marcado; lote que não é seu é explicado', () => {
    render(<Devolver />);
    fireEvent.press(screen.getByTestId('botao-ler-qr'));
    fireEvent.press(screen.getByTestId('leitor-simular'));
    expect(screen.getByTestId('qtd-l11')).toBeTruthy();
    expect(screen.getByText(/Lote LOTE-BOB-0001 encontrado/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('botao-ler-qr'));
    mockTextoQR = 'LOTE-DE-OUTRO-9999';
    fireEvent.press(screen.getByTestId('leitor-simular'));
    expect(screen.getByText(/LOTE-DE-OUTRO-9999 não está na sua posse/)).toBeTruthy();
  });

  it('o que já está separado para devolução aparece e não pode ser devolvido de novo', () => {
    mockDados = estadoDados({ dados: dadosDe({ devolucoes: [dev(1, { quantidade: 449.5 })] }) });
    render(<Devolver />);
    expect(screen.getByText(/Já separado para devolução: 449,5 m/)).toBeTruthy();
    expect(screen.getByTestId('grupo-l11').props.accessibilityState.disabled).toBe(true);
  });

  it('sem material na posse: explica em vez de mostrar tela vazia', () => {
    mockDados = estadoDados({ dados: dadosDe({ posse: [] }) });
    render(<Devolver />);
    expect(screen.getByText('Você não tem material para devolver')).toBeTruthy();
    expect(screen.getByTestId('botao-pedir-devolucao').props.accessibilityState.disabled).toBe(true);
  });
});

describe('Minhas devoluções', () => {
  it('mostra o estado de cada pedido e o MOTIVO quando o estoque nega', () => {
    mockDados = estadoDados({
      dados: dadosDe({ devolucoes: [dev(1, { status: 'negada', motivo_negacao: 'Peça danificada', solicitado_em: '2026-10-09T10:00:00.000Z' }), dev(2), dev(3, { status: 'aprovada', solicitado_em: '2026-10-08T10:00:00.000Z' })] }),
      ops: [opDe('devolucao', { id: 9 })],
    });
    render(<Devolucoes />);
    expect(screen.getByText('Na fila para enviar')).toBeTruthy();
    expect(screen.getByText('Aguardando o estoque')).toBeTruthy();
    expect(screen.getByText('Aprovada')).toBeTruthy();
    expect(screen.getByText('Negada')).toBeTruthy();
    expect(screen.getByText('Peça danificada')).toBeTruthy();
    expect(screen.getByText('O material continua com você.')).toBeTruthy();
  });

  it('negada sem motivo registrado ainda orienta o técnico', () => {
    mockDados = estadoDados({ dados: dadosDe({ devolucoes: [dev(1, { status: 'negada', motivo_negacao: null })] }) });
    render(<Devolucoes />);
    expect(screen.getByText(/não informou o motivo/)).toBeTruthy();
  });

  it('pedido ainda na fila pode ser cancelado, com confirmação; recusar a confirmação não cancela', async () => {
    mockDados = estadoDados({ ops: [opDe('devolucao', { id: 9 })] });
    render(<Devolucoes />);
    mockConfirmar.mockResolvedValueOnce(false);
    fireEvent.press(screen.getByTestId('cancelar-o9'));
    await waitFor(() => expect(mockConfirmar).toHaveBeenCalledTimes(1));
    expect(mockDados.comandos.descartar).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('cancelar-o9'));
    await waitFor(() => expect(mockDados.comandos.descartar).toHaveBeenCalledWith(9));
  });

  it('pedido já enviado não oferece cancelar (só o estoque decide)', () => {
    mockDados = estadoDados({ dados: dadosDe({ devolucoes: [dev(2)] }) });
    render(<Devolucoes />);
    expect(screen.queryByText('Cancelar pedido')).toBeNull();
  });

  it('pedido que o servidor recusou mostra a mensagem e leva a "Requer atenção"', () => {
    mockDados = estadoDados({ ops: [opDe('devolucao', { id: 9, estado: 'atencao', erro: { status: 400, mensagem: 'Você possui apenas 10 deste lote' } })] });
    render(<Devolucoes />);
    expect(screen.getByText('Você possui apenas 10 deste lote')).toBeTruthy();
    fireEvent.press(screen.getByTestId('resolver-o9'));
    expect(mockPush).toHaveBeenCalledWith('/atencao');
  });

  it('lista vazia explica e oferece devolver', () => {
    render(<Devolucoes />);
    expect(screen.getByText('Nenhum pedido de devolução')).toBeTruthy();
    fireEvent.press(screen.getByTestId('botao-nova-devolucao'));
    expect(mockPush).toHaveBeenCalledWith('/devolver');
  });
});

describe('Meu estoque → devolução', () => {
  it('abre Devolver e Minhas devoluções, com a contagem do que está em andamento', () => {
    mockDados = estadoDados({ dados: dadosDe({ devolucoes: [dev(2), dev(3, { status: 'aprovada' })] }), ops: [opDe('devolucao', { id: 9 })] });
    render(<MeuEstoque />);
    fireEvent.press(screen.getByTestId('botao-devolver'));
    expect(mockPush).toHaveBeenCalledWith('/devolver');
    fireEvent.press(screen.getByText('Minhas devoluções (2 em andamento)'));
    expect(mockPush).toHaveBeenCalledWith('/devolucoes');
  });
  it('abre a Ficha de movimentações', () => {
    render(<MeuEstoque />);
    fireEvent.press(screen.getByTestId('botao-ficha'));
    expect(mockPush).toHaveBeenCalledWith('/ficha');
  });
  it('mostra o saldo já descontado e o quanto está separado para devolução', () => {
    mockDados = estadoDados({ dados: dadosDe({ devolucoes: [dev(2, { quantidade: 49.5 })] }) });
    render(<MeuEstoque />);
    expect(screen.getByText('Separado para devolução: 49,5 m')).toBeTruthy();
    expect(screen.getByText('400 m')).toBeTruthy();
  });
});
