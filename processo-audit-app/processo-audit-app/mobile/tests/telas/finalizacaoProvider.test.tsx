/** FinalizacaoProvider com SQLite de verdade: o rascunho é salvo com atraso (debounce), na saída da tela e ao ir para segundo plano. */
import { act, render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { inserirFoto, lerRascunho, salvarRascunho } from '@/db/trabalho';
import { rascunhoVazio, type Rascunho } from '@/domain/etapas';
import { criarBancoDeTeste } from '@/testing/bancoNode';
import { uuid } from '@/testing/operacoes';
import { dadosDe, estadoDados, opDe, type EstadoDados } from './ajudas';

let mockBanco: unknown;
let mockDados: EstadoDados = estadoDados();
jest.mock('@/estado/AppProvider', () => ({ useApp: () => ({ banco: mockBanco }) }));
jest.mock('@/estado/DadosProvider', () => ({ useDados: () => mockDados }));

import { FinalizacaoProvider, useFinalizacao, type ValorFinalizacao } from '@/estado/FinalizacaoProvider';

let valor: ValorFinalizacao;
const Capturar = () => { valor = useFinalizacao(); return null; };
let aoMudarEstadoDoApp: ((s: string) => void) | null = null;

const foto = (n: number) => ({ client_uuid: uuid(n), usuario_id: 7, os_id: 101, arquivo: `file:///f${n}.jpg`, mime: 'image/jpeg', tamanho: 10, tirada_em: 'x', lat: null, lng: null, legenda: null, criado_em: `2026-10-11T14:0${n}:00.000Z` });

const montar = async (semear?: (b: any) => Promise<void>, configurar?: (d: EstadoDados) => void) => {
  const { banco } = await criarBancoDeTeste();
  mockBanco = banco;
  if (semear) await semear(banco);
  const salvos: Rascunho[] = [];
  mockDados = estadoDados();
  configurar?.(mockDados);
  mockDados.comandos.salvarRascunho.mockImplementation(async (osId: number, r: Rascunho) => { salvos.push(JSON.parse(JSON.stringify(r))); await salvarRascunho(banco, 7, osId, r); });
  const tela = render(<FinalizacaoProvider osId={101}><Capturar /></FinalizacaoProvider>);
  await waitFor(() => { if (!valor?.carregado) throw new Error('carregando'); });
  return { banco, salvos, ...tela };
};

beforeEach(() => {
  jest.useFakeTimers();
  aoMudarEstadoDoApp = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_t: string, fn: (s: string) => void) => { aoMudarEstadoDoApp = fn; return { remove: jest.fn() }; }) as never);
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

describe('FinalizacaoProvider', () => {
  it('carrega o rascunho que já estava guardado no aparelho', async () => {
    await montar(async (b) => { await salvarRascunho(b, 7, 101, { ...rascunhoVazio(), descricao: 'Já escrevi isto antes de fechar o app' }); });
    expect(valor.rascunho.descricao).toBe('Já escrevi isto antes de fechar o app');
  });

  it('sem rascunho guardado começa vazio', async () => {
    await montar();
    expect(valor.rascunho.descricao).toBe('');
    expect(valor.concluidas.descricao).toBe(false);
  });

  it('mostra a alteração na hora, mas só grava ~700 ms depois da ÚLTIMA tecla (uma gravação para várias teclas)', async () => {
    const { salvos, banco } = await montar();
    act(() => { valor.alterar((r) => ({ ...r, descricao: 'R' })); });
    act(() => { valor.alterar((r) => ({ ...r, descricao: 'Rota' })); });
    act(() => { valor.alterar((r) => ({ ...r, descricao: 'Rota lançada' })); });
    expect(valor.rascunho.descricao).toBe('Rota lançada'); // tela atualiza sem esperar
    expect(valor.concluidas.descricao).toBe(true);
    await act(async () => { jest.advanceTimersByTime(699); });
    expect(salvos).toHaveLength(0);
    await act(async () => { jest.advanceTimersByTime(1); await Promise.resolve(); });
    await waitFor(() => expect(salvos).toHaveLength(1));
    expect(salvos[0].descricao).toBe('Rota lançada');
    expect((await lerRascunho(banco, 101))?.descricao).toBe('Rota lançada');
  });

  it('salvarAgora grava na hora (usado ao sair da etapa e antes de finalizar) e não deixa gravação duplicada para depois', async () => {
    const { salvos } = await montar();
    act(() => { valor.alterar((r) => ({ ...r, motivo_codigo: 'route_launched' })); });
    await act(async () => { await valor.salvarAgora(); });
    expect(salvos).toHaveLength(1);
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(salvos).toHaveLength(1);
  });

  it('ao ir para segundo plano (ou receber uma ligação) grava o que ainda estava esperando', async () => {
    const { salvos } = await montar();
    act(() => { valor.alterar((r) => ({ ...r, descricao: 'Texto importante' })); });
    await act(async () => { aoMudarEstadoDoApp?.('background'); await Promise.resolve(); });
    expect(salvos).toHaveLength(1); // na hora, sem esperar os 700 ms do atraso (o app pode ser encerrado a qualquer instante)
    expect(salvos[0].descricao).toBe('Texto importante');
  });

  it('ao sair das telas (desmontar) grava o que ainda estava esperando', async () => {
    const { salvos, unmount } = await montar();
    act(() => { valor.alterar((r) => ({ ...r, descricao: 'Sai da tela' })); });
    unmount();
    expect(salvos).toHaveLength(1); // na hora, sem esperar os 700 ms do atraso
    expect(salvos[0].descricao).toBe('Sai da tela');
  });

  it('se gravar falha, mostra o erro e tenta de novo na próxima alteração (nada se perde em silêncio)', async () => {
    const { salvos } = await montar();
    mockDados.comandos.salvarRascunho.mockRejectedValueOnce(new Error('Esta OS não está mais na sua lista.'));
    act(() => { valor.alterar((r) => ({ ...r, descricao: 'v1' })); });
    await act(async () => { await valor.salvarAgora(); });
    expect(valor.erroSalvar).toBe('Esta OS não está mais na sua lista.');
    await act(async () => { await valor.salvarAgora(); }); // o que ficou sujo é gravado de novo
    expect(valor.erroSalvar).toBeNull();
    expect(salvos.at(-1)?.descricao).toBe('v1');
  });

  it('as fotos valem pelas fotos reais da OS (aparelho + servidor), não pelo que o rascunho lembra', async () => {
    mockDados = estadoDados();
    await montar(async (b) => {
      await inserirFoto(b, foto(1)); await inserirFoto(b, foto(2));
      await salvarRascunho(b, 7, 101, { ...rascunhoVazio(), fotos: ['lixo-antigo'] });
    });
    expect(valor.totalFotos).toBe(2);
    expect(valor.rascunho.fotos).toEqual([uuid(1), uuid(2)]);
    expect(valor.concluidas.fotos).toBe(true);
  });

  it('a lista de lançamentos e a etapa de materiais vêm da fila (e do cache do servidor)', async () => {
    await montar(undefined, (d) => { d.ops = [opDe('lancamento', { id: 3, os_id: 101 })]; d.dados = dadosDe({}, d.ops); });
    expect(valor.lancamentos).toMatchObject([{ origem: 'local', estado: 'pendente', descricao: 'Lançamento de cabo ASU 12F' }]);
    expect(valor.contexto.lancamentosComMaterial).toBe(1);
    expect(valor.concluidas.usados).toBe(true);
  });

  it('sem lançamento, a etapa de materiais só conclui se o técnico disser que não usou', async () => {
    await montar();
    expect(valor.concluidas.usados).toBe(false);
    act(() => { valor.alterar((r) => ({ ...r, materiais_usados: false })); });
    expect(valor.concluidas.usados).toBe(true);
  });

  it('só é editável enquanto a OS está aberta e a finalização não foi para a fila', async () => {
    await montar();
    expect(valor.editavel).toBe(true);
  });

  it('com a finalização na fila (ou a OS encerrada) deixa de ser editável', async () => {
    await montar(undefined, (d) => { const op = opDe('finalizar', { id: 9, os_id: 101 }); d.ops = [op]; d.dados = dadosDe({}, [op]); });
    expect(valor.editavel).toBe(false);
  });
});
