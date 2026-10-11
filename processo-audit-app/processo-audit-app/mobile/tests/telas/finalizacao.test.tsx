import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { ApiError } from '@/api/erros';
import { criarBootstrap, criarOS } from '@/testing/fixtures';
import { dadosDe, estadoDados, opDe, valorFinalizacao, type EstadoDados } from './ajudas';

let mockDados: EstadoDados = estadoDados();
let mockFin: ReturnType<typeof valorFinalizacao> = valorFinalizacao();
let mockConfirmar = jest.fn(async (..._a: unknown[]) => true);
let mockOnline = true;
const mockApi = { buscarEndereco: jest.fn(), geocodificar: jest.fn() };
const mockCapturar = jest.fn();
let mockMapa: any = null;
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace, canGoBack: () => true }), useLocalSearchParams: () => ({ id: '101' }) }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/estado/DadosProvider', () => ({ useDados: () => mockDados }));
jest.mock('@/estado/FinalizacaoProvider', () => ({ useFinalizacao: () => mockFin }));
jest.mock('@/components/confirmar', () => ({ confirmar: (...a: unknown[]) => mockConfirmar(...a) }));
jest.mock('@/estado/AppProvider', () => ({ useApp: () => ({ api: mockApi }) }));
jest.mock('@/estado/rede', () => ({ useOnline: () => mockOnline }));
jest.mock('@/components/MapaLocal', () => ({ MapaLocal: (p: unknown) => { mockMapa = p; return require('react').createElement('Mapa', { testID: 'mapa-mock' }); } }));
jest.mock('@/estado/localizacao', () => ({ capturarPosicao: (...a: unknown[]) => mockCapturar(...a) }));

import Hub from '@/app/(app)/os/[id]/finalizar/index';
import Descricao from '@/app/(app)/os/[id]/finalizar/descricao';
import Motivo from '@/app/(app)/os/[id]/finalizar/motivo';
import Checklist from '@/app/(app)/os/[id]/finalizar/checklist';
import Retirados from '@/app/(app)/os/[id]/finalizar/retirados';
import Participantes from '@/app/(app)/os/[id]/finalizar/participantes';
import Local from '@/app/(app)/os/[id]/finalizar/local';
import { ErroLocalizacao } from '@/domain/localizacao';

const LOCAL = { lat: -23.5445, lng: -46.3118, origem: 'gps' as const, precisao_m: 6 };
const completo = { descricao: 'Rota lançada e CEO fechada no poste', motivo_codigo: 'route_launched', local: LOCAL, checklist: { fiberLaunchedMeters: '350,5' }, materiais_usados: false, materiais_retirados: false, fotos: ['u1'] };

beforeEach(() => {
  jest.clearAllMocks();
  mockDados = estadoDados();
  mockFin = valorFinalizacao(101);
  mockConfirmar = jest.fn(async () => true);
  mockOnline = true;
  mockCapturar.mockReset().mockResolvedValue({ lat: -23.5445, lng: -46.3118, precisao_m: 6.2 });
  mockApi.buscarEndereco.mockReset().mockResolvedValue([]); mockApi.geocodificar.mockReset();
  mockMapa = null;
});

describe('Hub da finalização', () => {
  it('lista as 8 etapas na ordem do sistema, marca as opcionais e mostra o progresso', () => {
    render(<Hub />);
    const ordem = ['Descrição', 'Motivo de Fechamento', 'Local do Endereço', 'Checklists', 'Materiais Utilizados', 'Materiais Retirados', 'Fotos do Serviço', 'Participantes'];
    const etapas = screen.getAllByRole('button').filter((b) => String(b.props.testID ?? '').startsWith('etapa-'));
    expect(etapas.map((e) => e.props.accessibilityLabel.split(',')[0])).toEqual(ordem);
    expect(etapas[7].props.accessibilityLabel).toMatch(/Participantes, opcional/);
    expect(screen.getByText('Participantes (opcional)')).toBeTruthy();
    expect(screen.getByText('0 de 7 etapas obrigatórias concluídas')).toBeTruthy();
  });

  it('o botão Finalizar fica travado até todas as etapas obrigatórias estarem concluídas, e diz por quê', () => {
    render(<Hub />);
    expect(screen.getByText('Conclua as 7 etapas obrigatórias para finalizar.')).toBeTruthy();
    expect(screen.getByTestId('botao-finalizar').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('botao-finalizar'));
    expect(mockDados.comandos.finalizar).not.toHaveBeenCalled();
  });

  it('com tudo pronto, mostra o resumo de cada etapa, habilita Finalizar e só finaliza depois de confirmar', async () => {
    mockFin = valorFinalizacao(101, { rascunho: completo, totalFotos: 2 });
    render(<Hub />);
    expect(screen.getByText('7 de 7 etapas obrigatórias concluídas')).toBeTruthy();
    expect(screen.getByText('Rota lançada com sucesso')).toBeTruthy();
    expect(screen.getByText('GPS ±6 m · -23.54450, -46.31180')).toBeTruthy();
    expect(screen.getByText('2 fotos')).toBeTruthy();
    expect(screen.queryByText(/Conclua as 7 etapas/)).toBeNull();
    mockConfirmar.mockResolvedValueOnce(false);
    fireEvent.press(screen.getByTestId('botao-finalizar'));
    await waitFor(() => expect(mockConfirmar).toHaveBeenCalledTimes(1));
    expect(mockConfirmar.mock.calls[0][1]).toMatch(/fica somente leitura/);
    expect(mockDados.comandos.finalizar).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('botao-finalizar'));
    await waitFor(() => expect(mockDados.comandos.finalizar).toHaveBeenCalledWith(101));
    expect(mockFin.salvarAgora).toHaveBeenCalled(); // grava o rascunho antes de congelar o pacote
  });

  it('mostra a recusa do app/servidor ao finalizar', async () => {
    mockFin = valorFinalizacao(101, { rascunho: completo, totalFotos: 1 });
    mockDados.comandos.finalizar.mockRejectedValue(new ApiError(400, 'Ainda falta concluir: Descrição.'));
    render(<Hub />);
    fireEvent.press(screen.getByTestId('botao-finalizar'));
    expect(await screen.findByText('Ainda falta concluir: Descrição.')).toBeTruthy();
  });

  it('tocar numa etapa abre a tela dela', () => {
    render(<Hub />);
    fireEvent.press(screen.getByTestId('etapa-usados'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/os/[id]/finalizar/materiais', params: { id: '101' } });
    fireEvent.press(screen.getByTestId('etapa-descricao'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/os/[id]/finalizar/descricao', params: { id: '101' } });
  });

  it('OS ainda não iniciada: pede para iniciar primeiro em vez de mostrar etapas', () => {
    mockFin = valorFinalizacao(102);
    render(<Hub />);
    expect(screen.getByText('Inicie a execução primeiro')).toBeTruthy();
    expect(screen.queryByTestId('botao-finalizar')).toBeNull();
  });

  describe('depois de finalizar (nunca mostra sucesso que o servidor não confirmou)', () => {
    const comFinalizacao = (estado: 'pendente' | 'enviando' | 'atencao' | 'ok', fin: 'na_fila' | 'atencao' | 'enviada', erro?: object) => {
      const op = opDe('finalizar', { id: 9, os_id: 101, estado, erro: erro ?? null });
      const base = dadosDe({}, [op]);
      const os = base.os.map((o) => (o.id === 101 ? { ...o, finalizacao: fin, status: fin === 'enviada' ? ('concluida' as const) : o.status } : o));
      mockDados = estadoDados({ dados: { ...base, os }, ops: [op] });
      mockFin = valorFinalizacao(101, { dados: { ...base, os } });
    };
    it('na fila: diz que está salva no aparelho e ainda não chegou ao servidor, e permite voltar a editar', async () => {
      comFinalizacao('pendente', 'na_fila');
      render(<Hub />);
      expect(screen.getByText('Finalização salva no aparelho')).toBeTruthy();
      expect(screen.getByText(/Ainda não chegou ao servidor/)).toBeTruthy();
      expect(screen.queryByText(/finalizada$/)).toBeNull();
      fireEvent.press(screen.getByTestId('voltar-a-editar'));
      await waitFor(() => expect(mockDados.comandos.voltarAEditar).toHaveBeenCalledWith(101));
    });
    it('em envio: não oferece voltar a editar (resultado incerto)', () => {
      comFinalizacao('enviando', 'na_fila');
      render(<Hub />);
      expect(screen.queryByTestId('voltar-a-editar')).toBeNull();
    });
    it('recusada pelo servidor: mostra a mensagem e leva à tela de atenção', () => {
      comFinalizacao('atencao', 'atencao', { status: 400, mensagem: 'A OS não pode ser finalizada: Envie ao menos 1 foto do serviço' });
      render(<Hub />);
      expect(screen.getByText('O servidor não aceitou a finalização')).toBeTruthy();
      expect(screen.getByText('A OS não pode ser finalizada: Envie ao menos 1 foto do serviço')).toBeTruthy();
      fireEvent.press(screen.getByRole('button', { name: 'Ver o que precisa ser resolvido' }));
      expect(mockPush).toHaveBeenCalledWith('/atencao');
    });
    it('confirmada pelo servidor: aí sim, tela de sucesso', () => {
      comFinalizacao('ok', 'enviada');
      render(<Hub />);
      expect(screen.getByText('OS #1 finalizada')).toBeTruthy();
      expect(screen.getByText(/O servidor recebeu a finalização/)).toBeTruthy();
    });
  });
});

describe('Descrição', () => {
  it('conta caracteres e diz quantos faltam até o mínimo; fica verde quando chega', () => {
    mockFin = valorFinalizacao(101, { rascunho: { descricao: 'curta' } });
    const { rerender } = render(<Descricao />);
    expect(screen.getByTestId('contador-descricao').props.children).toBe('5 caracteres: faltam 6 para chegar ao mínimo de 11');
    mockFin = valorFinalizacao(101, { rascunho: { descricao: 'Rota lançada' } });
    rerender(<Descricao />);
    expect(screen.getByTestId('contador-descricao').props.children).toBe('12 caracteres');
  });
  it('não conta espaços nas pontas', () => {
    mockFin = valorFinalizacao(101, { rascunho: { descricao: '   curta   ' } });
    render(<Descricao />);
    expect(screen.getByTestId('contador-descricao').props.children).toMatch(/^5 caracteres/);
  });
  it('digitar altera o rascunho (que o provedor grava no aparelho)', () => {
    render(<Descricao />);
    fireEvent.changeText(screen.getByTestId('campo-descricao'), 'Rota lançada até a CEO-03');
    expect(mockFin.rascunho.descricao).toBe('Rota lançada até a CEO-03');
  });
  it('respeita o limite de caracteres do servidor', () => {
    render(<Descricao />);
    expect(screen.getByTestId('campo-descricao').props.maxLength).toBe(5000);
  });
  it('não deixa editar quando a OS já está na fila de finalização', () => {
    mockFin = valorFinalizacao(101, { editavel: false });
    render(<Descricao />);
    expect(screen.getByTestId('campo-descricao').props.editable).toBe(false);
    expect(screen.getByText(/não aceita mais mudanças aqui/)).toBeTruthy();
  });
});

describe('Motivo de fechamento', () => {
  it('mostra os motivos do servidor e marca o escolhido', () => {
    mockFin = valorFinalizacao(101, { dados: dadosDe({ motivos: [{ id: 1, codigo: 'route_launched', rotulo: 'Rota lançada com sucesso', tipo_servico_id: null }, { id: 2, codigo: 'cancelled', rotulo: 'Cliente cancelou', tipo_servico_id: null }] }) });
    render(<Motivo />);
    fireEvent.press(screen.getByTestId('motivo-cancelled'));
    expect(mockFin.rascunho.motivo_codigo).toBe('cancelled');
    expect(screen.getByRole('radio', { name: 'Rota lançada com sucesso' })).toBeTruthy();
  });
  it('sem motivos baixados, explica em vez de mostrar uma lista vazia', () => {
    mockFin = valorFinalizacao(101, { dados: dadosDe({ motivos: [] }) });
    render(<Motivo />);
    expect(screen.getByText('Nenhum motivo disponível')).toBeTruthy();
  });
});

describe('Checklist', () => {
  const dadosCheck = dadosDe({ checklist: [
    { id: 1, codigo: 'metros', rotulo: 'Metros de fibra lançados?', tipo: 'number', unidade: 'm', obrigatorio: true, tipo_servico_id: null },
    { id: 2, codigo: 'ceo', rotulo: 'CEO vedada?', tipo: 'boolean', unidade: null, obrigatorio: true, tipo_servico_id: null },
    { id: 3, codigo: 'obs', rotulo: 'Observações', tipo: 'text', unidade: null, obrigatorio: false, tipo_servico_id: null },
  ] });
  it('marca obrigatórios e opcionais e usa o tipo certo de campo', () => {
    mockFin = valorFinalizacao(101, { dados: dadosCheck });
    render(<Checklist />);
    expect(screen.getAllByText(/\* obrigatório/)).toHaveLength(2);
    expect(screen.getByText(/\(opcional\)/)).toBeTruthy();
    expect(screen.getByTestId('check-metros').props.keyboardType).toBe('decimal-pad');
    expect(screen.getByText('m')).toBeTruthy();
  });
  it('sim/não grava um booleano de verdade; número e texto gravam o que foi digitado', () => {
    mockFin = valorFinalizacao(101, { dados: dadosCheck });
    render(<Checklist />);
    fireEvent.press(screen.getByTestId('check-ceo-nao'));
    fireEvent.changeText(screen.getByTestId('check-metros'), '350,5');
    fireEvent.changeText(screen.getByTestId('check-obs'), 'Tudo certo');
    expect(mockFin.rascunho.checklist).toEqual({ ceo: false, metros: '350,5', obs: 'Tudo certo' });
    fireEvent.press(screen.getByTestId('check-ceo-sim'));
    expect(mockFin.rascunho.checklist.ceo).toBe(true);
  });
  it('número inválido mostra o erro na hora', () => {
    mockFin = valorFinalizacao(101, { dados: dadosCheck, rascunho: { checklist: { metros: 'abc' } } });
    render(<Checklist />);
    expect(screen.getByText('Digite um número (use vírgula ou ponto).')).toBeTruthy();
  });
});

describe('Materiais retirados', () => {
  it('"Não" conclui a etapa e apaga qualquer linha que existia; "Sim" abre a lista', () => {
    mockFin = valorFinalizacao(101, { rascunho: { materiais_retirados: true, retirados: [{ chave: 'a', item_id: null, descricao: 'Splitter', quantidade: '1', unidade: 'pecas', condicao: 'usado' }] } });
    render(<Retirados />);
    fireEvent.press(screen.getByTestId('retirados-pergunta-nao'));
    expect(mockFin.rascunho).toMatchObject({ materiais_retirados: false, retirados: [] });
  });
  it('adiciona do catálogo com a unidade do item e depois exige quantidade e condição', () => {
    mockFin = valorFinalizacao(101, { rascunho: { materiais_retirados: true }, dados: dadosDe({ itens: [{ id: 1, nome: 'Cabo óptico ASU 12F', categoria: 'Cabos', unidade: 'metros' }, { id: 2, nome: 'Conector SC/APC', categoria: null, unidade: 'pecas' }] }) });
    const { rerender } = render(<Retirados />);
    fireEvent.press(screen.getByTestId('adicionar-material'));
    fireEvent.changeText(screen.getByTestId('busca-catalogo'), 'conéctor');
    fireEvent.press(screen.getByTestId('catalogo-2'));
    expect(mockFin.rascunho.retirados).toMatchObject([{ item_id: 2, descricao: 'Conector SC/APC', unidade: 'pecas', quantidade: '', condicao: null }]);
    expect(mockFin.concluidas.retirados).toBe(false);
    rerender(<Retirados />);
    const chave = mockFin.rascunho.retirados[0].chave;
    expect(screen.getByText('Informe se está novo ou usado.')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId(`qtd-${chave}`), '4');
    fireEvent.press(screen.getByTestId(`condicao-${chave}-usado`));
    expect(mockFin.concluidas.retirados).toBe(true);
  });
  it('peça fracionada e metros com 3 casas mostram o erro do domínio na hora', () => {
    mockFin = valorFinalizacao(101, { rascunho: { materiais_retirados: true, retirados: [
      { chave: 'a', item_id: 2, descricao: 'Conector SC/APC', quantidade: '2,5', unidade: 'pecas', condicao: 'novo' },
      { chave: 'b', item_id: 1, descricao: 'Cabo', quantidade: '1,234', unidade: 'metros', condicao: 'novo' },
    ] } });
    render(<Retirados />);
    expect(screen.getByText('Este item é contado em unidades: informe um número inteiro')).toBeTruthy();
    expect(screen.getByText('Use no máximo 2 casas decimais')).toBeTruthy();
    expect(mockFin.concluidas.retirados).toBe(false);
  });
  it('material fora do catálogo: descrição livre com a unidade escolhida', () => {
    mockFin = valorFinalizacao(101, { rascunho: { materiais_retirados: true } });
    render(<Retirados />);
    fireEvent.press(screen.getByTestId('adicionar-material'));
    expect(screen.getByTestId('adicionar-livre').props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByTestId('descricao-livre'), '  Splitter 1:8 antigo ');
    fireEvent.press(screen.getByTestId('unidade-livre-metros'));
    fireEvent.press(screen.getByTestId('adicionar-livre'));
    expect(mockFin.rascunho.retirados).toMatchObject([{ item_id: null, descricao: 'Splitter 1:8 antigo', unidade: 'metros' }]);
  });
  it('remover uma linha', () => {
    mockFin = valorFinalizacao(101, { rascunho: { materiais_retirados: true, retirados: [{ chave: 'a', item_id: null, descricao: 'Splitter', quantidade: '1', unidade: 'pecas', condicao: 'usado' }] } });
    render(<Retirados />);
    fireEvent.press(screen.getByTestId('remover-a'));
    expect(mockFin.rascunho.retirados).toEqual([]);
  });
  it('lembra que é só registro: não mexe no estoque', () => {
    render(<Retirados />);
    expect(screen.getByText(/não muda o seu saldo de estoque/)).toBeTruthy();
  });
});

describe('Participantes', () => {
  it('lista os outros técnicos e equipes, marca e desmarca (etapa opcional)', () => {
    render(<Participantes />);
    expect(screen.getByText('Equipe Apoio')).toBeTruthy();
    expect(screen.getByText('Terceirizado · Apoio Ltda')).toBeTruthy();
    fireEvent.press(screen.getByTestId('participante-2'));
    expect(mockFin.rascunho.participantes).toEqual([2]);
    fireEvent.press(screen.getByTestId('participante-2'));
    expect(mockFin.rascunho.participantes).toEqual([]);
    expect(screen.getByText(/Esta etapa é opcional/)).toBeTruthy();
  });
  it('respeita o limite de participantes do servidor', () => {
    const tecnicos = Array.from({ length: 3 }, (_, i) => ({ id: 10 + i, nome: `Téc ${i}`, tipo: 'interno' as const, empresa: null }));
    mockFin = valorFinalizacao(101, { dados: dadosDe({ tecnicos, regras: { ...criarBootstrap().regras, participantes_max: 2 } }), rascunho: { participantes: [10, 11] } });
    render(<Participantes />);
    fireEvent.press(screen.getByTestId('participante-12'));
    expect(mockFin.rascunho.participantes).toEqual([10, 11]);
  });
});

describe('Local do endereço', () => {
  it('GPS: guarda a posição com a precisão e mostra as coordenadas e a origem', async () => {
    render(<Local />);
    fireEvent.press(screen.getByTestId('botao-gps'));
    await waitFor(() => expect(mockFin.rascunho.local).toMatchObject({ lat: -23.5445, lng: -46.3118, origem: 'gps', precisao_m: 6 }));
    expect(mockFin.concluidas.local).toBe(true);
  });
  it('mostra a precisão em metros e avisa quando é ruim', async () => {
    mockCapturar.mockResolvedValue({ lat: -23.5, lng: -46.3, precisao_m: 120 });
    const { rerender } = render(<Local />);
    fireEvent.press(screen.getByTestId('botao-gps'));
    await waitFor(() => expect(mockFin.rascunho.local?.precisao_m).toBe(120));
    rerender(<Local />);
    expect(screen.getByTestId('local-origem').props.children).toBe('GPS · precisão de 120 m');
    expect(screen.getByText(/Precisão baixa \(120 m\)\. Se puder, vá para um lugar aberto/)).toBeTruthy();
  });
  it.each([
    ['permissao_negada', /não tem permissão para usar a localização/],
    ['permissao_bloqueada', /Configurações do aparelho/],
    ['gps_desligado', /GPS do aparelho está desligado/],
    ['tempo_esgotado', /obter a posição a tempo/],
  ] as const)('falha de GPS (%s) aparece em português e nada é registrado', async (codigo, texto) => {
    mockCapturar.mockRejectedValue(new ErroLocalizacao(codigo));
    render(<Local />);
    fireEvent.press(screen.getByTestId('botao-gps'));
    expect(await screen.findByText(texto)).toBeTruthy();
    expect(mockFin.rascunho.local).toBeNull();
  });
  it('coordenadas do poste: um toque, funciona sem internet', () => {
    mockOnline = false;
    render(<Local />);
    fireEvent.press(screen.getByTestId('botao-poste'));
    expect(mockFin.rascunho.local).toMatchObject({ lat: -23.5445, lng: -46.3118, origem: 'pole_reference' });
    expect(screen.getByRole('button', { name: 'Usar coordenadas do PL-0901' })).toBeTruthy();
  });
  it('OS sem coordenadas: não oferece o poste, só diz por quê', () => {
    mockFin = valorFinalizacao(101, { dados: dadosDe({ os: [criarOS(1, { status: 'em_andamento', latitude: null, longitude: null })] }) });
    render(<Local />);
    expect(screen.queryByTestId('botao-poste')).toBeNull();
    expect(screen.getByText('Esta OS não tem coordenadas do poste.')).toBeTruthy();
  });
  it('sem internet a busca de endereço some e explica as alternativas', () => {
    mockOnline = false;
    render(<Local />);
    expect(screen.queryByTestId('campo-endereco')).toBeNull();
    expect(screen.getByText(/a busca de endereço precisa de internet/)).toBeTruthy();
  });
  it('endereço com coordenadas: escolhe da lista e registra como origem "endereço"', async () => {
    mockApi.buscarEndereco.mockResolvedValue([{ label: 'Estrada Takashi Kobata, 572 · Suzano - SP', logradouro: 'Estrada Takashi Kobata', numero: '572', bairro: '', cidade: 'Suzano', uf: 'SP', cep: '', latitude: -23.55, longitude: -46.31 }]);
    render(<Local />);
    fireEvent.changeText(screen.getByTestId('campo-endereco'), 'estrada takashi kobata 572');
    fireEvent.press(screen.getByTestId('botao-buscar'));
    fireEvent.press(await screen.findByTestId('sugestao-0'));
    await waitFor(() => expect(mockFin.rascunho.local).toMatchObject({ lat: -23.55, lng: -46.31, origem: 'address', endereco: 'Estrada Takashi Kobata, 572 · Suzano - SP', aproximado: false }));
    expect(mockApi.geocodificar).not.toHaveBeenCalled();
  });
  it('endereço sem coordenadas: geocodifica; se a rua não está no mapa avisa que é aproximado', async () => {
    mockApi.buscarEndereco.mockResolvedValue([{ label: 'Rua Nova, 10 · Suzano', logradouro: 'Rua Nova', numero: '10', bairro: 'Centro', cidade: 'Suzano', uf: 'SP', cep: '08600000', latitude: null, longitude: null }]);
    mockApi.geocodificar.mockResolvedValue({ latitude: -23.54, longitude: -46.3, aproximado: true });
    const { rerender } = render(<Local />);
    fireEvent.changeText(screen.getByTestId('campo-endereco'), 'rua nova 10 suzano');
    fireEvent.press(screen.getByTestId('botao-buscar'));
    fireEvent.press(await screen.findByTestId('sugestao-0'));
    await waitFor(() => expect(mockFin.rascunho.local).toMatchObject({ origem: 'address', aproximado: true }));
    expect(mockApi.geocodificar).toHaveBeenCalledWith({ street: 'Rua Nova', numero: '10', city: 'Suzano', uf: 'SP', cep: '08600000', bairro: 'Centro' });
    rerender(<Local />);
    expect(screen.getByText(/Posição aproximada: a rua não está no mapa/)).toBeTruthy();
  });
  it('endereço que não dá para localizar no mapa: mensagem clara e nada registrado', async () => {
    mockApi.buscarEndereco.mockResolvedValue([{ label: 'Rua Sumida', logradouro: 'Rua Sumida', numero: '', bairro: '', cidade: 'Suzano', uf: 'SP', cep: '', latitude: null, longitude: null }]);
    mockApi.geocodificar.mockResolvedValue({ latitude: null, longitude: null });
    render(<Local />);
    fireEvent.changeText(screen.getByTestId('campo-endereco'), 'rua sumida');
    fireEvent.press(screen.getByTestId('botao-buscar'));
    fireEvent.press(await screen.findByTestId('sugestao-0'));
    expect(await screen.findByText(/Não foi possível localizar esse endereço no mapa/)).toBeTruthy();
    expect(mockFin.rascunho.local).toBeNull();
  });
  it('busca sem resultados e busca curta demais explicam o que fazer', async () => {
    mockApi.buscarEndereco.mockResolvedValue([]);
    render(<Local />);
    fireEvent.changeText(screen.getByTestId('campo-endereco'), 'ab');
    fireEvent.press(screen.getByTestId('botao-buscar'));
    expect(await screen.findByText(/Digite ao menos 3 letras ou números/)).toBeTruthy();
    expect(mockApi.buscarEndereco).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByTestId('campo-endereco'), 'rua que não existe');
    fireEvent.press(screen.getByTestId('botao-buscar'));
    expect(await screen.findByText(/Nenhum endereço encontrado/)).toBeTruthy();
  });
  it('erro do serviço de endereços aparece como está (o servidor já devolve em português)', async () => {
    mockApi.buscarEndereco.mockRejectedValue(new ApiError(502, 'Serviço de endereços indisponível. Preencha manualmente.'));
    render(<Local />);
    fireEvent.changeText(screen.getByTestId('campo-endereco'), 'rua x 10');
    fireEvent.press(screen.getByTestId('botao-buscar'));
    expect(await screen.findByText('Serviço de endereços indisponível. Preencha manualmente.')).toBeTruthy();
  });
  it('posição simulada (pré-visualização no navegador) é identificada na tela', async () => {
    mockCapturar.mockResolvedValue({ lat: -23.5445, lng: -46.3118, precisao_m: 8, simulado: true });
    const { rerender } = render(<Local />);
    fireEvent.press(screen.getByTestId('botao-gps'));
    await waitFor(() => expect(mockFin.rascunho.local).not.toBeNull());
    rerender(<Local />);
    expect(screen.getByText(/SIMULAÇÃO: esta pré-visualização no navegador não tem GPS/)).toBeTruthy();
  });
});

describe('Local: nome da rua e mapa', () => {
  const ruaDoPonto = { label: 'Estrada Takashi Kobata, 572 · Jardim Revista · Suzano - SP', logradouro: 'Estrada Takashi Kobata', numero: '572', bairro: 'Jardim Revista', cidade: 'Suzano', uf: 'SP', cep: '', latitude: -23.50416, longitude: -46.28119 };
  const comGps = (extra: Record<string, unknown> = {}) => valorFinalizacao(101, { rascunho: { local: { lat: -23.50416, lng: -46.28119, origem: 'gps', precisao_m: 38, ...extra } as never } });

  it('com o ponto do GPS e internet, descobre o nome da rua e guarda no local (vai no fechamento)', async () => {
    mockApi.buscarEndereco.mockResolvedValue([ruaDoPonto]);
    mockFin = comGps();
    const { rerender } = render(<Local />);
    expect(mockApi.buscarEndereco).toHaveBeenCalledWith('-23.504160, -46.281190');
    await waitFor(() => expect(mockFin.rascunho.local?.endereco).toBe(ruaDoPonto.label));
    rerender(<Local />);
    expect(screen.getByTestId('local-endereco').props.children).toBe(`Perto de: ${ruaDoPonto.label}`);
  });
  it('enquanto procura mostra "Buscando o nome da rua…"', async () => {
    let responder!: (v: unknown) => void;
    mockApi.buscarEndereco.mockReturnValue(new Promise((r) => { responder = r; }));
    mockFin = comGps();
    render(<Local />);
    expect(await screen.findByTestId('rua-buscando')).toBeTruthy();
    await act(async () => { responder([]); });
  });
  it('ponto sem rua no mapa (estrada, área rural): explica que as coordenadas valem do mesmo jeito', async () => {
    mockApi.buscarEndereco.mockResolvedValue([{ ...ruaDoPonto, logradouro: '', bairro: '', cidade: '', label: '-23.5, -46.3' }]);
    mockFin = comGps();
    render(<Local />);
    expect(await screen.findByTestId('rua-nao-achou')).toBeTruthy();
    expect(mockFin.rascunho.local?.endereco).toBeUndefined();
  });
  it('falha ao buscar: avisa e oferece tentar de novo', async () => {
    mockApi.buscarEndereco.mockRejectedValueOnce(new ApiError(502, 'Serviço de endereços indisponível. Preencha manualmente.')).mockResolvedValue([ruaDoPonto]);
    mockFin = comGps();
    render(<Local />);
    expect(await screen.findByTestId('rua-erro')).toBeTruthy();
    fireEvent.press(screen.getByTestId('rua-tentar'));
    await waitFor(() => expect(mockFin.rascunho.local?.endereco).toBe(ruaDoPonto.label));
    expect(mockApi.buscarEndereco).toHaveBeenCalledTimes(2);
  });
  it('sem internet não consulta e diz que o nome da rua aparece depois', () => {
    mockOnline = false;
    mockFin = comGps();
    render(<Local />);
    expect(mockApi.buscarEndereco).not.toHaveBeenCalled();
    expect(screen.getByTestId('rua-sem-conexao')).toBeTruthy();
  });
  it('se o local já tem o endereço guardado, não consulta de novo', () => {
    mockFin = comGps({ endereco: 'Rua Já Guardada, 10 · Suzano - SP' });
    render(<Local />);
    expect(mockApi.buscarEndereco).not.toHaveBeenCalled();
    expect(screen.getByTestId('local-endereco').props.children).toBe('Perto de: Rua Já Guardada, 10 · Suzano - SP');
  });
  it('coordenadas do poste também ganham o nome da rua', async () => {
    mockApi.buscarEndereco.mockResolvedValue([ruaDoPonto]);
    mockFin = valorFinalizacao(101, { rascunho: { local: { lat: -23.5445, lng: -46.3118, origem: 'pole_reference' } } });
    render(<Local />);
    await waitFor(() => expect(mockFin.rascunho.local?.endereco).toBe(ruaDoPonto.label));
  });
  it('se o técnico mudar o local antes da resposta chegar, o nome da rua antigo NÃO é gravado no ponto novo', async () => {
    let responder!: (v: unknown) => void;
    mockApi.buscarEndereco.mockReturnValueOnce(new Promise((r) => { responder = r; })).mockReturnValue(new Promise(() => undefined)); // a consulta do ponto novo nunca responde
    mockFin = comGps();
    render(<Local />);
    mockFin.rascunho = { ...mockFin.rascunho, local: { lat: -23.6, lng: -46.4, origem: 'gps', precisao_m: 5 } };
    await act(async () => { responder([ruaDoPonto]); });
    expect(mockFin.rascunho.local?.endereco).toBeUndefined();
  });
  it('endereço escolhido na busca não é consultado de novo (já é o endereço)', () => {
    mockFin = valorFinalizacao(101, { rascunho: { local: { lat: -23.5, lng: -46.3, origem: 'address', endereco: 'Rua X, 1 · Suzano - SP', aproximado: false } } });
    render(<Local />);
    expect(mockApi.buscarEndereco).not.toHaveBeenCalled();
    expect(screen.getByTestId('local-endereco').props.children).toBe('Rua X, 1 · Suzano - SP');
  });

  it('mostra o mapa do ponto com a precisão do GPS (círculo) e avisa quando não há internet', () => {
    mockFin = comGps();
    const { rerender } = render(<Local />);
    expect(mockMapa).toMatchObject({ lat: -23.50416, lng: -46.28119, precisaoM: 38, online: true });
    mockOnline = false;
    rerender(<Local />);
    expect(mockMapa.online).toBe(false);
  });
  it('no poste o mapa não tem círculo de precisão', () => {
    mockFin = valorFinalizacao(101, { rascunho: { local: { lat: -23.5445, lng: -46.3118, origem: 'pole_reference' } } });
    render(<Local />);
    expect(mockMapa.precisaoM).toBeNull();
  });
  it('sem local registrado não há mapa', () => {
    render(<Local />);
    expect(screen.queryByTestId('mapa-mock')).toBeNull();
    expect(screen.queryByTestId('botao-abrir-mapa')).toBeNull();
  });
  it('"Abrir no app de mapas" abre o ponto no celular; se falhar, avisa', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(true as never);
    mockFin = comGps();
    render(<Local />);
    fireEvent.press(screen.getByTestId('botao-abrir-mapa'));
    await waitFor(() => expect(abrir).toHaveBeenCalledWith('https://www.google.com/maps/search/?api=1&query=-23.50416,-46.28119'));
    abrir.mockRejectedValueOnce(new Error('sem app'));
    fireEvent.press(screen.getByTestId('botao-abrir-mapa'));
    expect(await screen.findByText('Não foi possível abrir o app de mapas neste aparelho.')).toBeTruthy();
  });
});
