import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '@/api/erros';
import { dadosDe, estadoDados, opDe, type EstadoDados } from './ajudas';

let mockDados: EstadoDados = estadoDados();
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockSessao = { sair: jest.fn(async () => undefined) };
const mockBanco = {};
const mockArquivos = { apagar: jest.fn(async () => undefined) };
let mockEstadoSessao: any = { status: 'logado', usuario: { id: 7, email: 'joao@exemplo.com', name: 'João Técnico', role: 'tecnico' } };
let mockConfirmar = jest.fn(async (..._a: unknown[]) => true);
let mockEscolher = jest.fn(async (..._a: unknown[]) => 'manter' as unknown);
let mockResumo = { operacoes: 0, rascunhos: 0, fotos: 0, total: 0 };
const mockDescartarTudoLocal = jest.fn(async (..._a: unknown[]) => undefined);

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn(), canGoBack: () => true }), useLocalSearchParams: () => ({ id: '102' }) }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/estado/DadosProvider', () => ({ useDados: () => mockDados }));
jest.mock('@/estado/AppProvider', () => ({ useApp: () => ({ sessao: mockSessao, servidor: { url: () => 'http://srv/api' }, banco: mockBanco, arquivos: mockArquivos }) }));
jest.mock('@/estado/useSessao', () => ({ useEstadoSessao: () => mockEstadoSessao }));
jest.mock('@/components/confirmar', () => ({ confirmar: (...a: unknown[]) => mockConfirmar(...a) }));
jest.mock('@/components/escolher', () => ({ escolher: (...a: unknown[]) => mockEscolher(...a) }));
jest.mock('@/sync/sincronizar', () => ({ resumoDoTrabalho: async () => mockResumo, descartarTudoLocal: (...a: unknown[]) => mockDescartarTudoLocal(...a) }));

import MinhasOS from '@/app/(app)/(tabs)/index';
import MeuEstoque from '@/app/(app)/(tabs)/estoque';
import Conta from '@/app/(app)/(tabs)/conta';
import Atencao from '@/app/(app)/atencao';
import { TelaBloqueio } from '@/components/TelaBloqueio';

beforeEach(() => {
  jest.clearAllMocks();
  mockDados = estadoDados();
  mockConfirmar = jest.fn(async () => true);
  mockEscolher = jest.fn(async () => 'manter');
  mockResumo = { operacoes: 0, rascunhos: 0, fotos: 0, total: 0 };
  mockEstadoSessao = { status: 'logado', usuario: { id: 7, email: 'joao@exemplo.com', name: 'João Técnico', role: 'tecnico' } };
});

const comOp = (ops: ReturnType<typeof opDe>[], extra: Partial<EstadoDados> = {}) => {
  const contagens = {
    pendentes: ops.filter((o) => o.estado === 'pendente' && o.tipo !== 'rascunho').length,
    enviando: ops.filter((o) => o.estado === 'enviando').length,
    atencao: ops.filter((o) => o.estado === 'atencao').length,
  };
  return estadoDados({ dados: dadosDe({}, ops), ops, contagens, ...extra });
};

describe('Minhas OS: sincronização visível', () => {
  it('cada OS mostra o ícone com o texto do estado: sincronizada, aguardando envio ou requer atenção', () => {
    const ops = [opDe('lancamento', { id: 1, os_id: 102, estado: 'pendente' }), opDe('lancamento', { id: 2, os_id: 101, estado: 'atencao', erro: { status: 400, mensagem: 'x' } })];
    mockDados = comOp(ops);
    render(<MinhasOS />);
    expect(screen.getByTestId('sync-pendente')).toBeTruthy();
    expect(screen.getByTestId('sync-erro')).toBeTruthy();
    expect(screen.getByLabelText(/^OS 2,.*Aguardando envio/)).toBeTruthy();
    expect(screen.getByLabelText(/^OS 1,.*Requer atenção/)).toBeTruthy();
    fireEvent.press(screen.getByRole('tab', { name: /Encerradas/ }));
    expect(screen.getByTestId('sync-sincronizado')).toBeTruthy(); // a OS 103 (encerrada) não tem nada pendente
    expect(screen.getByLabelText(/^OS 3,.*Sincronizada/)).toBeTruthy();
  });

  it('o contador global fala dos envios que aguardam e oferece "Sincronizar agora"', () => {
    mockDados = comOp([opDe('lancamento', { id: 1 }), opDe('foto', { id: 2 })], { semConexao: true });
    render(<MinhasOS />);
    expect(screen.getByText(/2 envios aguardando conexão\. Está tudo salvo no aparelho\. Dados de \d\d:\d\d\./)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Sincronizar agora' }));
    expect(mockDados.atualizar).toHaveBeenCalled();
  });

  it('enquanto envia, mostra "Enviando…" e esconde o botão', () => {
    mockDados = comOp([opDe('lancamento', { id: 1, estado: 'enviando' })], { sincronizando: true });
    render(<MinhasOS />);
    expect(screen.getByText('Enviando…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sincronizar agora' })).toBeNull();
  });

  it('itens que o servidor recusou ganham um aviso vermelho que leva à tela "Requer atenção"', () => {
    mockDados = comOp([opDe('lancamento', { id: 1, estado: 'atencao', erro: { status: 400, mensagem: 'x' } })]);
    render(<MinhasOS />);
    expect(screen.getByText('1 item requer a sua atenção: o servidor não aceitou.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Ver' }));
    expect(mockPush).toHaveBeenCalledWith('/atencao');
  });

  it('sessão expirada: avisa que nada foi perdido', () => {
    mockDados = estadoDados({ pausadoPorSessao: true });
    render(<MinhasOS />);
    expect(screen.getByText(/Sua sessão expirou\. Entre de novo para enviar\. Nada do que você fez foi perdido\./)).toBeTruthy();
  });

  it('tudo em dia: nenhum aviso de envio', () => {
    render(<MinhasOS />);
    expect(screen.queryByText(/aguardando|requer/i)).toBeNull();
  });
});

describe('Meu estoque: reservado', () => {
  it('mostra o saldo já descontado e quanto está reservado em lançamentos que ainda não chegaram ao servidor', () => {
    const lanc = opDe('lancamento', { id: 1, os_id: 101, payload: { corpo: { descricao: 'x', trecho: 'y', materiais: [{ lote_id: 11, quantidade: 100 }] }, exibicao: { linhas: [] } } });
    mockDados = comOp([lanc]);
    render(<MeuEstoque />);
    expect(screen.getByText('349,5 m')).toBeTruthy();
    expect(screen.getByText('Reservado em lançamentos não enviados: 100 m')).toBeTruthy();
    expect(screen.getByText(/já descontado do que você lançou ou separou para devolução e ainda não foi confirmado/)).toBeTruthy();
  });
});

describe('Requer atenção', () => {
  const lancamentoRecusado = opDe('lancamento', { id: 5, estado: 'atencao', erro: { status: 400, mensagem: 'Quantidade maior que a posse do técnico neste lote (50)' } });

  it('mostra a mensagem do servidor por inteiro, a OS e o que fazer', () => {
    mockDados = comOp([lancamentoRecusado]);
    render(<Atencao />);
    expect(screen.getByText('Lançamento de material')).toBeTruthy();
    expect(screen.getByText('OS #2 · Rota PL-902 → CEO-02')).toBeTruthy();
    expect(screen.getByText('Quantidade maior que a posse do técnico neste lote (50)')).toBeTruthy();
    expect(screen.getByText(/mudou desde o último download/)).toBeTruthy();
  });

  it('finalização incompleta mostra TODOS os problemas apontados pelo servidor', () => {
    const detalhes = [{ campo: 'descricao', mensagem: 'Descrição muito curta: escreva mais de 10 caracteres' }, { campo: 'fotos', mensagem: 'Envie ao menos 1 foto do serviço' }];
    mockDados = comOp([opDe('finalizar', { id: 6, estado: 'atencao', erro: { status: 400, mensagem: 'A OS não pode ser finalizada: Descrição muito curta (e mais 1 problema(s))', detalhes } })]);
    render(<Atencao />);
    expect(screen.getByText('• Descrição muito curta: escreva mais de 10 caracteres')).toBeTruthy();
    expect(screen.getByText('• Envie ao menos 1 foto do serviço')).toBeTruthy();
  });

  it('"Tentar de novo" reenvia sem pedir confirmação', async () => {
    mockDados = comOp([lancamentoRecusado]);
    render(<Atencao />);
    fireEvent.press(screen.getByTestId('acao-tentar_de_novo-5'));
    await waitFor(() => expect(mockDados.comandos.reenviar).toHaveBeenCalledWith(5));
    expect(mockConfirmar).not.toHaveBeenCalled();
  });

  it('"Descartar" só descarta depois de confirmar; dizer não não faz nada', async () => {
    mockDados = comOp([lancamentoRecusado]);
    render(<Atencao />);
    mockConfirmar.mockResolvedValueOnce(false);
    fireEvent.press(screen.getByTestId('acao-descartar-5'));
    await waitFor(() => expect(mockConfirmar).toHaveBeenCalledTimes(1));
    expect(mockDados.comandos.descartar).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('acao-descartar-5'));
    await waitFor(() => expect(mockDados.comandos.descartar).toHaveBeenCalledWith(5));
  });

  it('"Corrigir quantidades" leva ao formulário de lançamento com o lançamento a corrigir', () => {
    mockDados = comOp([lancamentoRecusado]);
    render(<Atencao />);
    fireEvent.press(screen.getByTestId('acao-corrigir-5'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/os/[id]/finalizar/lancamento', params: { id: '102', corrigir: '5' } });
  });

  it('"Voltar a editar" cancela a finalização na fila e abre a finalização da OS', async () => {
    mockDados = comOp([opDe('finalizar', { id: 6, estado: 'atencao', erro: { status: 400, mensagem: 'x' } })]);
    render(<Atencao />);
    fireEvent.press(screen.getByTestId('acao-voltar_a_editar-6'));
    await waitFor(() => expect(mockDados.comandos.voltarAEditar).toHaveBeenCalledWith(102));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/os/[id]/finalizar', params: { id: '102' } });
  });

  it('operação parada por ser antiga: explica e só envia depois de confirmar', async () => {
    const velha = opDe('lancamento', { id: 7, estado: 'atencao', criado_em: new Date(Date.now() - 20 * 86_400_000).toISOString(), erro: { status: null, mensagem: 'Esta operação foi feita há mais de 14 dias e ainda não chegou ao servidor. Confira com o escritório.' } });
    mockDados = comOp([velha]);
    render(<Atencao />);
    expect(screen.getByText('Parado por segurança')).toBeTruthy();
    fireEvent.press(screen.getByTestId('acao-enviar_mesmo_assim-7'));
    await waitFor(() => expect(mockDados.comandos.reenviar).toHaveBeenCalledWith(7, { forcar: true }));
    expect(mockConfirmar).toHaveBeenCalledTimes(1);
  });

  it('erro ao executar a ação aparece na tela (nada some em silêncio)', async () => {
    mockDados = comOp([lancamentoRecusado]);
    mockDados.comandos.reenviar.mockRejectedValue(new ApiError(500, 'Erro interno'));
    render(<Atencao />);
    fireEvent.press(screen.getByTestId('acao-tentar_de_novo-5'));
    expect(await screen.findByText('Erro interno')).toBeTruthy();
  });

  it('avisa quantos envios estão esperando por estes itens', () => {
    mockDados = comOp([lancamentoRecusado, opDe('finalizar', { id: 8, estado: 'pendente', depende_de: [5] })]);
    render(<Atencao />);
    expect(screen.getByText(/1 envio\(s\) estão esperando estes itens serem resolvidos\. Nada foi perdido\./)).toBeTruthy();
  });

  it('sem nada a resolver mostra um estado vazio claro', () => {
    render(<Atencao />);
    expect(screen.getByText('Nada precisa de atenção')).toBeTruthy();
  });
});

describe('Conta: sair sem perder trabalho', () => {
  it('sem pendências: confirma e sai apagando os dados baixados', async () => {
    render(<Conta />);
    fireEvent.press(screen.getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(mockSessao.sair).toHaveBeenCalled());
    expect(mockDescartarTudoLocal).toHaveBeenCalled();
    expect(mockEscolher).not.toHaveBeenCalled();
  });

  it('com pendências: o padrão é MANTER — sai, mas não apaga nada', async () => {
    mockResumo = { operacoes: 3, rascunhos: 1, fotos: 2, total: 4 };
    render(<Conta />);
    fireEvent.press(screen.getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(mockSessao.sair).toHaveBeenCalled());
    expect(mockEscolher.mock.calls[0][1]).toMatch(/3 envio\(s\), 1 finalização\(ões\) em andamento, 2 foto\(s\)/);
    expect(mockDescartarTudoLocal).not.toHaveBeenCalled();
  });

  it('descartar exige uma SEGUNDA confirmação; recusando, a pessoa continua logada e nada é apagado', async () => {
    mockResumo = { operacoes: 1, rascunhos: 0, fotos: 0, total: 1 };
    mockEscolher = jest.fn(async () => 'descartar');
    mockConfirmar = jest.fn(async () => false);
    render(<Conta />);
    fireEvent.press(screen.getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(mockConfirmar).toHaveBeenCalledTimes(1));
    expect(mockSessao.sair).not.toHaveBeenCalled();
    expect(mockDescartarTudoLocal).not.toHaveBeenCalled();
  });

  it('descartar confirmado: sai e apaga', async () => {
    mockResumo = { operacoes: 1, rascunhos: 0, fotos: 0, total: 1 };
    mockEscolher = jest.fn(async () => 'descartar');
    render(<Conta />);
    fireEvent.press(screen.getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(mockSessao.sair).toHaveBeenCalled());
    expect(mockDescartarTudoLocal).toHaveBeenCalled();
  });

  it('cancelar (fechar o diálogo) não faz nada', async () => {
    mockResumo = { operacoes: 1, rascunhos: 0, fotos: 0, total: 1 };
    mockEscolher = jest.fn(async () => null);
    render(<Conta />);
    fireEvent.press(screen.getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(mockEscolher).toHaveBeenCalled());
    expect(mockSessao.sair).not.toHaveBeenCalled();
    expect(mockDescartarTudoLocal).not.toHaveBeenCalled();
  });

  it('mostra quantos envios aguardam e quantos pedem atenção, com o botão "Sincronizar agora"', () => {
    mockDados = estadoDados({ contagens: { pendentes: 2, enviando: 1, atencao: 1 } });
    render(<Conta />);
    expect(screen.getByLabelText('Aguardando envio: 3')).toBeTruthy();
    expect(screen.getByLabelText('Requerem atenção: 1')).toBeTruthy();
    fireEvent.press(screen.getByTestId('botao-sincronizar'));
    expect(mockDados.atualizar).toHaveBeenCalled();
  });
});

describe('Tela de bloqueio (troca de técnico com trabalho pendente)', () => {
  const montar = () => {
    const onSair = jest.fn(async () => undefined); const onDescartar = jest.fn(async () => undefined);
    render(<TelaBloqueio donoNome="Ana Técnica" pendencias={3} onSair={onSair} onDescartar={onDescartar} />);
    return { onSair, onDescartar };
  };
  it('explica quem é o dono e quanto há pendente, sem mostrar nenhum dado', () => {
    montar();
    expect(screen.getByText('Há trabalho não enviado neste aparelho')).toBeTruthy();
    expect(screen.getByText(/Ana Técnica deixou 3 itens/)).toBeTruthy();
  });
  it('sair da conta não apaga nada', () => {
    const { onSair, onDescartar } = montar();
    fireEvent.press(screen.getByTestId('bloqueio-sair'));
    expect(onSair).toHaveBeenCalled();
    expect(onDescartar).not.toHaveBeenCalled();
  });
  it('descartar exige DUAS confirmações — com qualquer "não", nada é apagado', async () => {
    const { onDescartar } = montar();
    mockConfirmar = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    fireEvent.press(screen.getByTestId('bloqueio-descartar'));
    await waitFor(() => expect(mockConfirmar).toHaveBeenCalledTimes(2));
    expect(onDescartar).not.toHaveBeenCalled();
    mockConfirmar = jest.fn(async () => true);
    fireEvent.press(screen.getByTestId('bloqueio-descartar'));
    await waitFor(() => expect(onDescartar).toHaveBeenCalledTimes(1));
    expect(mockConfirmar).toHaveBeenCalledTimes(2);
  });
});

