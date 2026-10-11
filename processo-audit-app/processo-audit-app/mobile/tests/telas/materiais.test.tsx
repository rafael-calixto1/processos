import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '@/api/erros';
import type { LancamentoVisao } from '@/domain/visao';
import { dadosDe, estadoDados, opDe, valorFinalizacao, type EstadoDados } from './ajudas';

let mockDados: EstadoDados = estadoDados();
let mockFin: ReturnType<typeof valorFinalizacao> = valorFinalizacao();
let mockConfirmar = jest.fn(async (..._a: unknown[]) => true);
let mockOnline = true;
let mockParams: Record<string, string> = { id: '101' };
let mockTextoQR = 'LOTE-BOB-0001';
const mockApi = { lotePorCodigo: jest.fn() };
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace, canGoBack: () => true }), useLocalSearchParams: () => mockParams }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/estado/DadosProvider', () => ({ useDados: () => mockDados }));
jest.mock('@/estado/FinalizacaoProvider', () => ({ useFinalizacao: () => mockFin }));
jest.mock('@/estado/AppProvider', () => ({ useApp: () => ({ api: mockApi }) }));
jest.mock('@/estado/rede', () => ({ useOnline: () => mockOnline }));
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

import Materiais from '@/app/(app)/os/[id]/finalizar/materiais';
import Lancamento from '@/app/(app)/os/[id]/finalizar/lancamento';

const lanc = (extra: Partial<LancamentoVisao> = {}): LancamentoVisao => ({
  chave: 'o1', origem: 'local', descricao: 'Lançamento de cabo ASU 12F', trecho: 'PL-0932 → PL-0945',
  linhas: [{ item_nome: 'Cabo óptico ASU 12F', unidade: 'metros', lote_codigo: 'LOTE-BOB-0001', quantidade: 120 }], estado: 'pendente', operacaoId: 1, erro: null, ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockDados = estadoDados();
  mockFin = valorFinalizacao(101);
  mockConfirmar = jest.fn(async () => true);
  mockOnline = true;
  mockParams = { id: '101' };
  mockTextoQR = 'LOTE-BOB-0001';
  mockApi.lotePorCodigo.mockReset();
});

describe('Materiais utilizados', () => {
  it('"Não" conclui a etapa: nenhum material da posse foi usado', () => {
    render(<Materiais />);
    fireEvent.press(screen.getByTestId('usados-pergunta-nao'));
    expect(mockFin.rascunho.materiais_usados).toBe(false);
    expect(mockFin.concluidas.usados).toBe(true);
    expect(screen.queryByTestId('botao-novo-lancamento')).toBeNull();
  });
  it('"Sim" sem lançamento ainda não conclui e oferece o botão fixo de adicionar lançamento', () => {
    mockFin = valorFinalizacao(101, { rascunho: { materiais_usados: true } });
    render(<Materiais />);
    expect(screen.getByText('Nenhum lançamento ainda')).toBeTruthy();
    expect(mockFin.concluidas.usados).toBe(false);
    fireEvent.press(screen.getByTestId('botao-novo-lancamento'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/os/[id]/finalizar/lancamento', params: { id: '101' } });
  });
  it('com lançamento, a resposta vira "Sim" e não pode voltar para "Não"', () => {
    mockFin = valorFinalizacao(101, { lancamentos: [lanc()] });
    render(<Materiais />);
    expect(screen.getByTestId('usados-pergunta-nao').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText(/a resposta não pode ser “Não”/)).toBeTruthy();
    expect(mockFin.concluidas.usados).toBe(true);
  });
  it('lançamento pendente: mostra material com unidade, lote e situação, e permite corrigir ou remover', async () => {
    mockFin = valorFinalizacao(101, { lancamentos: [lanc()] });
    render(<Materiais />);
    expect(screen.getByText('Aguardando envio')).toBeTruthy();
    expect(screen.getByText(/Cabo óptico ASU 12F —/)).toBeTruthy();
    expect(screen.getByText('120 m')).toBeTruthy();
    fireEvent.press(screen.getByTestId('corrigir-1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/os/[id]/finalizar/lancamento', params: { id: '101', corrigir: '1' } });
    mockConfirmar.mockResolvedValueOnce(false);
    fireEvent.press(screen.getByTestId('remover-lancamento-1'));
    await waitFor(() => expect(mockConfirmar).toHaveBeenCalled());
    expect(mockDados.comandos.removerLancamento).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('remover-lancamento-1'));
    await waitFor(() => expect(mockDados.comandos.removerLancamento).toHaveBeenCalledWith(1));
  });
  it('lançamento recusado pelo servidor mostra a mensagem e o botão de corrigir', () => {
    mockFin = valorFinalizacao(101, { lancamentos: [lanc({ estado: 'atencao', erro: { status: 400, mensagem: 'Quantidade maior que a posse do técnico neste lote (50)' } })] });
    render(<Materiais />);
    expect(screen.getByText('O servidor não aceitou')).toBeTruthy();
    expect(screen.getByText('Quantidade maior que a posse do técnico neste lote (50)')).toBeTruthy();
    expect(screen.getByTestId('corrigir-1')).toBeTruthy();
  });
  it('já enviado (servidor, ok ou em envio): somente leitura, com a orientação de falar com o estoque', () => {
    mockFin = valorFinalizacao(101, { lancamentos: [lanc({ chave: 's5', origem: 'servidor', estado: 'enviado', operacaoId: undefined }), lanc({ chave: 'o2', estado: 'enviando', operacaoId: 2 })] });
    render(<Materiais />);
    expect(screen.queryByTestId('corrigir-2')).toBeNull();
    expect(screen.queryByTestId('remover-lancamento-2')).toBeNull();
    expect(screen.getAllByText(/fale com o estoque/)).toHaveLength(2);
  });
  it('erro ao remover aparece na tela', async () => {
    mockFin = valorFinalizacao(101, { lancamentos: [lanc()] });
    mockDados.comandos.removerLancamento.mockRejectedValue(new ApiError(409, 'Este lançamento já foi enviado'));
    render(<Materiais />);
    fireEvent.press(screen.getByTestId('remover-lancamento-1'));
    expect(await screen.findByText('Este lançamento já foi enviado')).toBeTruthy();
  });
});

describe('Novo lançamento', () => {
  const preencher = () => {
    fireEvent.changeText(screen.getByTestId('campo-servico'), 'Lançamento de cabo ASU 12F');
    fireEvent.changeText(screen.getByTestId('campo-trecho'), 'PL-0932 → PL-0945');
  };
  const salvar = () => screen.getByTestId('botao-salvar-lancamento');

  it('só libera "Salvar" com serviço, trecho e ao menos um material com quantidade válida', () => {
    render(<Lancamento />);
    expect(salvar().props.accessibilityState.disabled).toBe(true);
    preencher();
    expect(salvar().props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('grupo-l11'));
    expect(salvar().props.accessibilityState.disabled).toBe(true); // sem quantidade
    fireEvent.changeText(screen.getByTestId('qtd-l11'), '350,5');
    expect(salvar().props.accessibilityState.disabled).toBe(false);
  });
  it('mostra na hora "Você tem X em posse" e a unidade ao lado da quantidade', () => {
    render(<Lancamento />);
    fireEvent.press(screen.getByTestId('grupo-l11'));
    expect(screen.getByTestId('limite-l11').props.children).toBe('Você tem 449,5 m em posse');
    expect(screen.getByText('m')).toBeTruthy();
    fireEvent.press(screen.getByTestId('grupo-i2'));
    expect(screen.getByTestId('limite-i2').props.children).toBe('Você tem 50 un em posse');
    expect(screen.getByTestId('qtd-i2').props.keyboardType).toBe('number-pad');
  });
  it('quantidade acima da posse, peça fracionada e metros com 3 casas travam o botão e dizem por quê', () => {
    render(<Lancamento />);
    preencher();
    fireEvent.press(screen.getByTestId('grupo-l11'));
    fireEvent.changeText(screen.getByTestId('qtd-l11'), '449,51');
    expect(screen.getByTestId('limite-l11').props.children).toBe('Você tem 449,5 m em posse');
    expect(salvar().props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByTestId('qtd-l11'), '1,234');
    expect(screen.getByTestId('limite-l11').props.children).toBe('Use no máximo 2 casas decimais');
    fireEvent.press(screen.getByTestId('grupo-i2'));
    fireEvent.changeText(screen.getByTestId('qtd-i2'), '2,5');
    expect(screen.getByTestId('limite-i2').props.children).toBe('Este item é contado em unidades: informe um número inteiro');
    fireEvent.changeText(screen.getByTestId('qtd-l11'), '10');
    expect(salvar().props.accessibilityState.disabled).toBe(true); // a peça continua inválida
  });
  it('salvar envia o que foi digitado (como digitado) para o comando e volta', async () => {
    render(<Lancamento />);
    preencher();
    fireEvent.press(screen.getByTestId('grupo-l11'));
    fireEvent.changeText(screen.getByTestId('qtd-l11'), '350,5');
    fireEvent.press(screen.getByTestId('grupo-i2'));
    fireEvent.changeText(screen.getByTestId('qtd-i2'), '35');
    fireEvent.press(salvar());
    await waitFor(() => expect(mockDados.comandos.registrarLancamento).toHaveBeenCalledWith({
      osId: 101, descricao: 'Lançamento de cabo ASU 12F', trecho: 'PL-0932 → PL-0945',
      itens: [{ chaveGrupo: 'l11', quantidade: '350,5' }, { chaveGrupo: 'i2', quantidade: '35' }],
    }));
    expect(mockBack).toHaveBeenCalled();
  });
  it('recusa do app (ex.: OS trancada) aparece na tela e não volta', async () => {
    mockDados.comandos.registrarLancamento.mockRejectedValue(new Error('A finalização desta OS já está na fila.'));
    render(<Lancamento />);
    preencher();
    fireEvent.press(screen.getByTestId('grupo-l11'));
    fireEvent.changeText(screen.getByTestId('qtd-l11'), '10');
    fireEvent.press(salvar());
    expect(await screen.findByText('A finalização desta OS já está na fila.')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });
  it('sugestões de serviço preenchem o campo com um toque', () => {
    mockFin = valorFinalizacao(101, { dados: dadosDe({ sugestoes_servicos: ['Lançamento de cabo ASU 12F', 'Fusão de fibras'] }) });
    render(<Lancamento />);
    fireEvent.changeText(screen.getByTestId('campo-servico'), 'fus');
    const chips = screen.getAllByTestId('sugestao-servico');
    expect(chips).toHaveLength(1);
    fireEvent.press(chips[0]);
    expect(screen.getByTestId('campo-servico').props.value).toBe('Fusão de fibras');
  });
  it('busca filtra o estoque; sem material em posse explica', () => {
    render(<Lancamento />);
    fireEvent.changeText(screen.getByTestId('busca-posse'), 'conector');
    expect(screen.queryByTestId('grupo-l11')).toBeNull();
    expect(screen.getByTestId('grupo-i2')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('busca-posse'), 'zzz');
    expect(screen.getByText(/Nada encontrado/)).toBeTruthy();
    mockFin = valorFinalizacao(101, { dados: dadosDe({ posse: [] }) });
    render(<Lancamento />);
    expect(screen.getByText('Você não tem material em posse.')).toBeTruthy();
  });
  it('material todo reservado em outros lançamentos aparece, mas não pode ser escolhido', () => {
    const op = opDe('lancamento', { id: 7, os_id: 101, payload: { corpo: { descricao: 'x', trecho: 'y', materiais: [{ lote_id: 11, quantidade: 449.5 }] }, exibicao: { linhas: [] } } });
    mockFin = valorFinalizacao(101, { dados: dadosDe({}, [op]) });
    render(<Lancamento />);
    expect(screen.getByText('Tudo reservado em lançamentos não enviados')).toBeTruthy();
    expect(screen.getByTestId('grupo-l11').props.accessibilityState.disabled).toBe(true);
  });

  describe('corrigir um lançamento recusado', () => {
    const antigo = () => opDe('lancamento', {
      id: 7, os_id: 101, estado: 'atencao', erro: { status: 400, mensagem: 'Quantidade maior que a posse do técnico neste lote (300)' },
      payload: { corpo: { descricao: 'Lançamento de cabo', trecho: 'A → B', materiais: [{ lote_id: 11, quantidade: 400 }] }, exibicao: { linhas: [] } },
    });
    beforeEach(() => {
      const op = antigo();
      mockParams = { id: '101', corrigir: '7' };
      mockDados = estadoDados({ ops: [op] });
      mockFin = valorFinalizacao(101, { dados: dadosDe({}, [op]) });
    });
    it('abre preenchido, mostra o erro do servidor e o que o antigo reservava volta a estar disponível', () => {
      render(<Lancamento />);
      expect(screen.getByText('O servidor não aceitou: Quantidade maior que a posse do técnico neste lote (300)')).toBeTruthy();
      expect(screen.getByTestId('campo-servico').props.value).toBe('Lançamento de cabo');
      expect(screen.getByTestId('campo-trecho').props.value).toBe('A → B');
      expect(screen.getByTestId('qtd-l11').props.value).toBe('400');
      expect(screen.getByTestId('limite-l11').props.children).toBe('Você tem 449,5 m em posse'); // 49,5 + 400 devolvidos
      expect(screen.getByText('Corrigir lançamento')).toBeTruthy();
    });
    it('salvar substitui o lançamento antigo em vez de criar outro', async () => {
      render(<Lancamento />);
      fireEvent.changeText(screen.getByTestId('qtd-l11'), '300');
      fireEvent.press(salvar());
      await waitFor(() => expect(mockDados.comandos.substituirLancamento).toHaveBeenCalledWith(7, { descricao: 'Lançamento de cabo', trecho: 'A → B', itens: [{ chaveGrupo: 'l11', quantidade: '300' }] }));
      expect(mockDados.comandos.registrarLancamento).not.toHaveBeenCalled();
    });
  });

  describe('leitor de QR do lote', () => {
    const abrir = () => { render(<Lancamento />); fireEvent.press(screen.getByTestId('botao-ler-qr')); };
    it('lote da posse: seleciona o item e pede a quantidade', async () => {
      abrir();
      fireEvent.press(screen.getByTestId('leitor-simular'));
      expect(await screen.findByText('Lote LOTE-BOB-0001 encontrado: Cabo óptico ASU 12F. Informe a quantidade usada.')).toBeTruthy();
      expect(screen.getByTestId('qtd-l11')).toBeTruthy();
    });
    it('lote de peças (LOTE-UNI) seleciona o grupo do item, que soma os lotes', async () => {
      mockTextoQR = 'lote-uni-0002';
      abrir();
      fireEvent.press(screen.getByTestId('leitor-simular'));
      expect(await screen.findByText('Lote LOTE-UNI-0002 encontrado: Conector SC/APC. Informe a quantidade usada.')).toBeTruthy();
      expect(screen.getByTestId('limite-i2').props.children).toBe('Você tem 50 un em posse');
    });
    it('offline, lote que não está na posse baixada: diz que não está na posse deste aparelho', async () => {
      mockOnline = false; mockTextoQR = 'LOTE-BOB-0099';
      abrir();
      fireEvent.press(screen.getByTestId('leitor-simular'));
      expect(await screen.findByText(/O lote LOTE-BOB-0099 não está na sua posse \(conforme os dados deste aparelho\)/)).toBeTruthy();
      expect(mockApi.lotePorCodigo).not.toHaveBeenCalled();
    });
    it('online, consulta o servidor para dar a mensagem certa (não é seu / não existe)', async () => {
      mockTextoQR = 'LOTE-BOB-0099';
      mockApi.lotePorCodigo.mockRejectedValueOnce(new ApiError(403, 'Este lote não está em sua posse'));
      abrir();
      fireEvent.press(screen.getByTestId('leitor-simular'));
      expect(await screen.findByText('O lote LOTE-BOB-0099 não está em sua posse. Fale com o estoque.')).toBeTruthy();
      mockApi.lotePorCodigo.mockRejectedValueOnce(new ApiError(404, 'Lote não encontrado'));
      fireEvent.press(screen.getByTestId('botao-ler-qr'));
      fireEvent.press(screen.getByTestId('leitor-simular'));
      expect(await screen.findByText('Lote LOTE-BOB-0099 não encontrado. Confira a etiqueta.')).toBeTruthy();
    });
    it('lote que é seu no servidor mas ainda não veio para o aparelho: manda sincronizar', async () => {
      mockTextoQR = 'LOTE-BOB-0050';
      mockApi.lotePorCodigo.mockResolvedValue({ id: 50, codigo: 'LOTE-BOB-0050', item_nome: 'Cabo', unidade: 'metros', minha_posse: 100 });
      abrir();
      fireEvent.press(screen.getByTestId('leitor-simular'));
      expect(await screen.findByText(/está com você, mas ainda não aparece no seu estoque deste aparelho/)).toBeTruthy();
    });
    it('fechar o leitor volta ao formulário sem mudar nada', () => {
      abrir();
      fireEvent.press(screen.getByTestId('leitor-fechar'));
      expect(screen.getByTestId('campo-servico')).toBeTruthy();
    });
  });
});

