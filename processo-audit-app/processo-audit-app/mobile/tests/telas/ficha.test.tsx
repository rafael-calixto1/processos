import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError, NetworkError } from '@/api/erros';
import { lerFicha, salvarFicha } from '@/db/repositorio';
import { normalizarFicha } from '@/domain/ficha';
import { criarBancoDeTeste } from '@/testing/bancoNode';

let mockBanco: Awaited<ReturnType<typeof criarBancoDeTeste>>['banco'];
let mockOnline = true;
const mockApi = { minhaFicha: jest.fn() };
const mockBack = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn(), canGoBack: () => true }) }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/estado/AppProvider', () => ({ useApp: () => ({ api: mockApi, banco: mockBanco }) }));
jest.mock('@/estado/rede', () => ({ useOnline: () => mockOnline }));

import Ficha from '@/app/(app)/ficha';

const mov = (id: number, extra: Record<string, unknown> = {}) => ({
  id, tipo: 'retirada', quantidade: '100.00', condicao: null, observacao: null, criado_em: `2026-10-0${(id % 8) + 1}T14:00:00.000Z`, lote_id: 11, os_id: null, estorno_de_id: null,
  lote_codigo: 'LOTE-BOB-0001', item_nome: 'Cabo óptico ASU 12F', unidade: 'metros', os_numero: null, os_cliente: null, ...extra,
});
const fichaDoServidor = (extra: Record<string, unknown> = {}) => ({
  tecnico: { id: 1, nome: 'João Técnico' },
  itens: [{ lote_id: 11, lote_codigo: 'LOTE-BOB-0001', item_id: 1, item_nome: 'Cabo óptico ASU 12F', unidade: 'metros', quantidade: 280 }],
  os: [],
  historico: [
    mov(6, { tipo: 'devolucao', quantidade: '20.00', condicao: 'usado', observacao: 'sobra da obra' }),
    mov(5, { tipo: 'estorno', quantidade: '999.00', estorno_de_id: 4, os_id: 9, os_numero: 9 }),
    mov(4, { tipo: 'baixa_os', quantidade: '999.00', os_id: 9, os_numero: 9, os_cliente: 'Rota PL-3' }),
    mov(3, { tipo: 'baixa_os', quantidade: '100.00', os_id: 7, os_numero: 7, os_cliente: 'Rota PL-1' }),
    mov(2, { tipo: 'retirada', quantidade: '400.00' }),
  ],
  ...extra,
});

beforeEach(async () => {
  jest.clearAllMocks();
  mockOnline = true;
  mockBanco = (await criarBancoDeTeste()).banco;
  mockApi.minhaFicha.mockReset();
  mockApi.minhaFicha.mockResolvedValue(fichaDoServidor());
});

describe('Ficha de movimentações', () => {
  it('baixa a ficha, mostra a posse com recebido/usado e o histórico agrupado SEM os estornos', async () => {
    render(<Ficha />);
    expect(await screen.findByText('Em posse agora')).toBeTruthy();
    expect(screen.getByText('280 m')).toBeTruthy();
    expect(screen.getByText(/recebido 400 m · usado 100 m/)).toBeTruthy(); // a baixa de 999 m foi estornada: não conta
    expect(screen.getAllByText('Baixa em OS')).toHaveLength(1); // só o selo do único grupo de baixa (o filtro se chama "Baixas em OS"; a baixa estornada não aparece)
    expect(screen.queryByText('Estorno')).toBeNull();
    expect(screen.queryByText(/999/)).toBeNull();
    expect(screen.getByText('OS #7')).toBeTruthy();
    expect(screen.queryByText('OS #9')).toBeNull();
  });

  it('guarda a ficha no aparelho', async () => {
    render(<Ficha />);
    await screen.findByText('Em posse agora');
    await waitFor(async () => expect((await lerFicha(mockBanco))?.ficha.historico).toHaveLength(5));
    expect((await lerFicha(mockBanco))?.ficha.historico[0].quantidade).toBe(20); // número, não texto
  });

  it('toque no grupo mostra os itens, a condição e a observação', async () => {
    render(<Ficha />);
    await screen.findByText('Em posse agora');
    fireEvent.press(screen.getByLabelText(/^Devolução, .*1 lançamento/));
    expect(screen.getByText('20 m')).toBeTruthy();
    expect(screen.getByText(/LOTE-BOB-0001 · usado/)).toBeTruthy();
    expect(screen.getByText('Obs.: sobra da obra')).toBeTruthy();
  });

  it('toque na posse mostra quando foi entregue e onde foi gasto', async () => {
    render(<Ficha />);
    await screen.findByText('Em posse agora');
    fireEvent.press(screen.getByTestId('posse-11'));
    expect(screen.getByText(/#7 \(100 m\)/)).toBeTruthy();
    expect(screen.getByText(/Entregue em:/)).toBeTruthy();
  });

  it('filtros mostram só devoluções ou só retiradas, e voltam a Todos', async () => {
    render(<Ficha />);
    await screen.findByText('Em posse agora');
    fireEvent.press(screen.getByTestId('filtro-devolucao'));
    expect(screen.queryByText('OS #7')).toBeNull();
    expect(screen.getByText(/1 lançamento · Cabo óptico ASU 12F/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('filtro-baixa_os'));
    expect(screen.getByText('OS #7')).toBeTruthy();
    fireEvent.press(screen.getByTestId('filtro-retirada'));
    expect(screen.queryByText('OS #7')).toBeNull();
    fireEvent.press(screen.getByTestId('filtro-todos'));
    expect(screen.getByText('OS #7')).toBeTruthy();
  });

  it('histórico longo vem em páginas de 12 com "Ver mais"', async () => {
    const muitas = Array.from({ length: 30 }, (_, i) => mov(100 + i, { tipo: 'retirada', criado_em: `2026-08-${String(i + 1).padStart(2, '0')}T10:00:00.000Z` })).reverse();
    mockApi.minhaFicha.mockResolvedValue(fichaDoServidor({ historico: muitas }));
    render(<Ficha />);
    await screen.findByText('Em posse agora');
    // a lista é virtualizada (só desenha o que aparece na tela): a página se prova pelo que falta ver
    expect(screen.getByText('Ver mais (18)')).toBeTruthy(); // 30 - 12
    fireEvent.press(screen.getByTestId('ver-mais'));
    expect(screen.getByText('Ver mais (6)')).toBeTruthy(); // 30 - 24
    fireEvent.press(screen.getByTestId('ver-mais'));
    expect(screen.queryByTestId('ver-mais')).toBeNull();
    fireEvent.press(screen.getByTestId('filtro-devolucao')); // trocar de filtro volta à primeira página
    expect(screen.queryByTestId('ver-mais')).toBeNull();
    fireEvent.press(screen.getByTestId('filtro-todos'));
    expect(screen.getByText('Ver mais (18)')).toBeTruthy();
  });

  it('sem sinal e com ficha guardada: mostra a guardada, avisa e NÃO chama o servidor', async () => {
    await salvarFicha(mockBanco, normalizarFicha(fichaDoServidor())!, '2026-10-10T12:00:00.000Z');
    mockOnline = false;
    render(<Ficha />);
    expect(await screen.findByText('Em posse agora')).toBeTruthy();
    expect(screen.getByText(/Sem conexão: mostrando a ficha guardada/)).toBeTruthy();
    expect(mockApi.minhaFicha).not.toHaveBeenCalled();
  });

  it('sem sinal e sem nada guardado: explica o que fazer', async () => {
    mockOnline = false;
    render(<Ficha />);
    expect(await screen.findByText('Sem conexão e nada guardado ainda')).toBeTruthy();
    expect(screen.getByText(/Abra a ficha uma vez com internet/)).toBeTruthy();
  });

  it('a rede cai no meio: mantém a ficha antiga, avisa e não apaga o que estava guardado', async () => {
    await salvarFicha(mockBanco, normalizarFicha(fichaDoServidor())!, '2026-10-10T12:00:00.000Z');
    mockApi.minhaFicha.mockRejectedValue(new NetworkError());
    render(<Ficha />);
    expect(await screen.findByText(/Sem conexão: mostrando a ficha guardada/)).toBeTruthy();
    expect(screen.getByText('280 m')).toBeTruthy();
    expect((await lerFicha(mockBanco))?.baixadaEm).toBe('2026-10-10T12:00:00.000Z');
  });

  it('erro do servidor com ficha guardada: mostra a mensagem dele e mantém a ficha; "Tentar" busca de novo', async () => {
    await salvarFicha(mockBanco, normalizarFicha(fichaDoServidor())!, '2026-10-10T12:00:00.000Z');
    mockApi.minhaFicha.mockRejectedValueOnce(new ApiError(500, 'Erro interno do servidor'));
    render(<Ficha />);
    expect(await screen.findByText('Erro interno do servidor')).toBeTruthy();
    expect(screen.getByText('280 m')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByLabelText('Tentar')); });
    await waitFor(() => expect(screen.queryByText('Erro interno do servidor')).toBeNull());
    expect(mockApi.minhaFicha).toHaveBeenCalledTimes(2);
  });

  it('resposta fora do formato não vira tela quebrada: mostra erro em português', async () => {
    mockApi.minhaFicha.mockResolvedValue({ qualquer: 'coisa' });
    render(<Ficha />);
    expect(await screen.findByText('Não foi possível carregar a ficha')).toBeTruthy();
    expect(screen.getByText(/formato que o aplicativo não entende/)).toBeTruthy();
  });

  it('sem nenhuma movimentação: explica', async () => {
    mockApi.minhaFicha.mockResolvedValue(fichaDoServidor({ historico: [], itens: [] }));
    render(<Ficha />);
    expect(await screen.findByText('Sem movimentações')).toBeTruthy();
    expect(screen.getByText('Você não tem material em posse.')).toBeTruthy();
  });
});
