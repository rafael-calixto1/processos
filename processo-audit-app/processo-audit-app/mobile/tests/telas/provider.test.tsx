/**
 * DadosProvider com SQLite de verdade (better-sqlite3), motor de envio de verdade e API falsa: a ordem envia-antes-de-baixar,
 * a fila sobrevivendo à falta de rede, a retomada depois que o app é encerrado, o bloqueio de troca de técnico e os comandos.
 */
import { act, render, waitFor } from '@testing-library/react-native';
import { ApiError, NetworkError } from '@/api/erros';
import { enfileirar, listarTodas, obter, reservar } from '@/db/outbox';
import { lerMeta } from '@/db/repositorio';
import { salvarBootstrap } from '@/db/repositorio';
import { criarBancoDeTeste } from '@/testing/bancoNode';
import { criarBootstrap } from '@/testing/fixtures';
import { novoLancamento, uuid } from '@/testing/operacoes';

let mockServicos: any;
let mockSessao: any = { status: 'logado', usuario: { id: 7, email: 'joao@exemplo.com', name: 'João Técnico', role: 'tecnico' } };
let mockOnline = true;
let mockN = 9000;
jest.mock('@/estado/AppProvider', () => ({ useApp: () => mockServicos }));
jest.mock('@/estado/useSessao', () => ({ useEstadoSessao: () => mockSessao }));
jest.mock('@/estado/rede', () => ({ useOnline: () => mockOnline }));
jest.mock('@/estado/dispositivo', () => ({ descricaoDispositivo: () => 'android 14 · app 1.0.0', versaoApp: () => '1.0.0' }));
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-4000-8000-${String(++mockN).padStart(12, '0')}` }));

import { DadosProvider, useDados } from '@/estado/DadosProvider';

let valor: ReturnType<typeof useDados>;
const Capturar = () => { valor = useDados(); return null; };

const montar = async ({ semear, configurar }: { semear?: (banco: Awaited<ReturnType<typeof criarBancoDeTeste>>['banco']) => Promise<void>; configurar?: (api: any) => void } = {}) => {
  const { banco } = await criarBancoDeTeste();
  if (semear) await semear(banco);
  const ordem: string[] = [];
  const api = {
    bootstrap: jest.fn(async () => { ordem.push('bootstrap'); return criarBootstrap(); }),
    detalheOS: jest.fn(async () => ({ servicos: [], materiais: [], fotos: [] })),
    iniciarOS: jest.fn(async (_id: number, em: string) => { ordem.push('iniciarOS'); return { status: 'em_andamento', iniciado_em: em }; }),
    lancar: jest.fn(async () => { ordem.push('lancar'); return { id: 1, descricao: 'x', trecho: null, quantidade: 1, materiais: [] }; }),
    enviarFoto: jest.fn(), removerFoto: jest.fn(), finalizar: jest.fn(), salvarRascunho: jest.fn(async () => ({ ok: true })),
  };
  configurar?.(api);
  const apagados: string[] = [];
  mockServicos = { banco, api, arquivos: { existe: async () => true, apagar: async (u: string) => { apagados.push(u); } } };
  const tela = render(<DadosProvider><Capturar /></DadosProvider>);
  return { banco, api, ordem, apagados, ...tela };
};
const pronto = () => waitFor(() => { if (!valor?.carregado || valor.sincronizando) throw new Error('ainda carregando'); });

beforeEach(() => {
  mockSessao = { status: 'logado', usuario: { id: 7, email: 'joao@exemplo.com', name: 'João Técnico', role: 'tecnico' } };
  mockOnline = true;
});

describe('DadosProvider', () => {
  it('ao entrar baixa o retrato e mostra a visão (fila vazia, nada pendente)', async () => {
    const { api } = await montar();
    await pronto();
    expect(api.bootstrap).toHaveBeenCalledTimes(1);
    expect(valor.dados?.os).toHaveLength(3);
    expect(valor.dados?.os.every((o) => o.sync === 'sincronizado')).toBe(true);
    expect(valor.contagens).toEqual({ pendentes: 0, enviando: 0, atencao: 0 });
    expect(valor.sincronizadoEm).not.toBeNull();
    expect(valor.semConexao).toBe(false);
  });

  it('ENVIA a fila antes de baixar o retrato novo (o retrato já nasce com o efeito do que foi enviado)', async () => {
    const { ordem } = await montar({ semear: async (b) => { await salvarBootstrap(b, criarBootstrap()); await enfileirar(b, novoLancamento(101)); } });
    await pronto();
    expect(ordem).toEqual(['lancar', 'bootstrap']);
    expect(valor.contagens.pendentes).toBe(0);
  });

  it('sem rede: continua mostrando o que há guardado, com a fila intacta, a posse reservada e o aviso de "sem conexão"', async () => {
    await montar({ semear: async (b) => { await salvarBootstrap(b, criarBootstrap()); await enfileirar(b, novoLancamento(101, [{ lote_id: 11, quantidade: 100 }])); }, configurar: (api) => api.lancar.mockRejectedValue(new NetworkError()) });
    await pronto();
    expect(valor.semConexao).toBe(true);
    expect(valor.contagens.pendentes).toBe(1);
    expect(valor.dados?.posse.find((p) => p.lote_id === 11)).toMatchObject({ quantidade: 349.5, reservado: 100 });
    expect(valor.dados?.os.find((o) => o.id === 101)).toMatchObject({ sync: 'pendente' });
  });

  it('quando a conexão volta, manda a fila e atualiza sozinho', async () => {
    mockOnline = false;
    let ligada = false;
    const { api, rerender } = await montar({
      semear: async (b) => { await salvarBootstrap(b, criarBootstrap()); await enfileirar(b, novoLancamento(101)); },
      configurar: (a) => a.lancar.mockImplementation(async () => { if (!ligada) throw new NetworkError(); return { id: 1, descricao: 'x', trecho: null, quantidade: 1, materiais: [] }; }),
    });
    await pronto();
    expect(valor.contagens.pendentes).toBe(1);
    ligada = true; mockOnline = true;
    rerender(<DadosProvider><Capturar /></DadosProvider>);
    await waitFor(() => expect(valor.contagens.pendentes).toBe(0));
    expect(api.lancar).toHaveBeenCalledTimes(2); // uma tentativa sem rede, outra quando a conexão voltou
    expect(api.bootstrap).toHaveBeenCalled();
  });

  it('o que ficou "enviando" quando o app foi encerrado é reenviado ao abrir, com a MESMA chave', async () => {
    let chave = '';
    const { api, banco } = await montar({ semear: async (b) => {
      await salvarBootstrap(b, criarBootstrap());
      const op = await enfileirar(b, novoLancamento(101, undefined, { chave: 'chave-do-kill-001' }));
      await reservar(b, op.id, Date.now()); chave = op.chave;
    } });
    await pronto();
    expect(api.lancar).toHaveBeenCalledTimes(1);
    expect((api.lancar.mock.calls[0] as unknown[])[2]).toBe(chave);
    expect((await listarTodas(banco, 7))[0].estado).toBe('ok');
  });

  it('sessão recusada no envio: PAUSA, não baixa nada, e mantém a fila para quando entrar de novo', async () => {
    const { api, banco } = await montar({
      semear: async (b) => { await salvarBootstrap(b, criarBootstrap()); await enfileirar(b, novoLancamento(101)); },
      configurar: (a) => a.lancar.mockRejectedValue(new ApiError(401, 'Sua sessão expirou. Entre novamente.', { code: 'sessao_expirada' })),
    });
    await pronto();
    expect(valor.pausadoPorSessao).toBe(true);
    expect((await listarTodas(banco, 7))[0].estado).toBe('pendente');
    expect(api.bootstrap).not.toHaveBeenCalled();
  });

  it('erro do servidor ao baixar aparece como erro (não como falta de conexão)', async () => {
    await montar({ semear: async (b) => { await salvarBootstrap(b, criarBootstrap()); }, configurar: (a) => a.bootstrap.mockRejectedValue(new ApiError(500, 'Erro interno do servidor')) });
    await pronto();
    expect(valor.erro).toBe('Erro interno do servidor');
    expect(valor.semConexao).toBe(false);
    expect(valor.dados?.os).toHaveLength(3); // continua mostrando o último retrato
  });

  describe('troca de técnico no mesmo aparelho', () => {
    it('com trabalho NÃO enviado do técnico anterior: bloqueia, não baixa nem envia nada e não apaga nada', async () => {
      const { api, banco } = await montar({ semear: async (b) => {
        await salvarBootstrap(b, criarBootstrap());
        await b.run("INSERT INTO meta (chave, valor) VALUES ('usuario_id','8'), ('usuario_nome','Ana Técnica')");
        await enfileirar(b, novoLancamento(101, undefined, { usuario_id: 8 }));
      } });
      await pronto();
      expect(valor.bloqueio).toEqual({ pendencias: 1, donoNome: 'Ana Técnica' });
      expect(valor.dados).toBeNull();
      expect(api.bootstrap).not.toHaveBeenCalled();
      expect(api.lancar).not.toHaveBeenCalled();
      expect(await listarTodas(banco, 8)).toHaveLength(1);
      expect(await lerMeta(banco, 'usuario_id')).toBe('8');
    });
    it('descartar é uma ação explícita: só então apaga, libera o novo técnico e baixa os dados dele', async () => {
      const { api, banco } = await montar({ semear: async (b) => {
        await salvarBootstrap(b, criarBootstrap());
        await b.run("INSERT INTO meta (chave, valor) VALUES ('usuario_id','8'), ('usuario_nome','Ana Técnica')");
        await enfileirar(b, novoLancamento(101, undefined, { usuario_id: 8 }));
      } });
      await pronto();
      await act(async () => { await valor.descartarTudo(); });
      await waitFor(() => expect(valor.bloqueio).toBeNull());
      await waitFor(() => expect(api.bootstrap).toHaveBeenCalled());
      expect(await listarTodas(banco, 8)).toEqual([]);
      expect(await lerMeta(banco, 'usuario_id')).toBe('7');
    });
    it('sem pendências do anterior: entra normalmente (dados do anterior apagados)', async () => {
      const { api, banco } = await montar({ semear: async (b) => {
        await salvarBootstrap(b, criarBootstrap());
        await b.run("INSERT INTO meta (chave, valor) VALUES ('usuario_id','8'), ('usuario_nome','Ana Técnica')");
      } });
      await pronto();
      expect(valor.bloqueio).toBeNull();
      expect(api.bootstrap).toHaveBeenCalled();
      expect(await lerMeta(banco, 'usuario_id')).toBe('7');
    });
  });

  describe('comandos', () => {
    it('iniciar a execução aparece na hora e, com rede, já é enviado', async () => {
      const { api } = await montar({ semear: async (b) => { await salvarBootstrap(b, criarBootstrap()); } });
      await pronto();
      await act(async () => { await valor.comandos.iniciarOS(102); });
      expect(valor.dados?.os.find((o) => o.id === 102)?.status).toBe('em_andamento');
      await waitFor(() => expect(api.iniciarOS).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(valor.contagens.pendentes).toBe(0));
    });
    it('quando o aparelho SABE que está sem rede, grava na fila mas nem tenta enviar', async () => {
      const { api, rerender } = await montar({ semear: async (b) => { await salvarBootstrap(b, criarBootstrap()); } });
      await pronto();
      mockOnline = false;
      rerender(<DadosProvider><Capturar /></DadosProvider>); // como o NetInfo faz ao perder a conexão
      await act(async () => { await valor.comandos.iniciarOS(102); });
      expect(valor.dados?.os.find((o) => o.id === 102)).toMatchObject({ status: 'em_andamento', sync: 'pendente' });
      expect(valor.contagens.pendentes).toBe(1);
      expect(api.iniciarOS).not.toHaveBeenCalled();
    });
    it('uma recusa do app (ex.: acima da posse) chega como erro legível e nada entra na fila', async () => {
      await montar({ semear: async (b) => { await salvarBootstrap(b, criarBootstrap()); } });
      await pronto();
      await expect(valor.comandos.registrarLancamento({ osId: 101, descricao: 'Lançamento', trecho: 'A → B', itens: [{ chaveGrupo: 'l11', quantidade: '9999' }] }))
        .rejects.toThrow('Cabo óptico ASU 12F: Você tem 449,5 m em posse');
      expect(valor.contagens).toEqual({ pendentes: 0, enviando: 0, atencao: 0 });
    });
    it('operação recusada pelo servidor aparece em "atenção" e pode ser descartada', async () => {
      const { banco } = await montar({ semear: async (b) => { await salvarBootstrap(b, criarBootstrap()); }, configurar: (a) => a.lancar.mockRejectedValue(new ApiError(400, 'Quantidade maior que a posse do técnico neste lote (50)')) });
      await pronto();
      await act(async () => { await valor.comandos.registrarLancamento({ osId: 101, descricao: 'Lançamento', trecho: 'A → B', itens: [{ chaveGrupo: 'l11', quantidade: '80' }] }); });
      await waitFor(() => expect(valor.contagens.atencao).toBe(1));
      const op = valor.ops.find((o) => o.estado === 'atencao')!;
      expect(op.erro?.mensagem).toBe('Quantidade maior que a posse do técnico neste lote (50)');
      expect(valor.dados?.os.find((o) => o.id === 101)?.sync).toBe('erro');
      await act(async () => { await valor.comandos.descartar(op.id); });
      expect(await obter(banco, op.id)).toBeNull();
      expect(valor.contagens.atencao).toBe(0);
    });
  });

  it('sem login não há nada: nem dados, nem envio', async () => {
    mockSessao = { status: 'deslogado' };
    const { api } = await montar({ semear: async (b) => { await salvarBootstrap(b, criarBootstrap()); await enfileirar(b, novoLancamento(101)); } });
    await act(async () => { await Promise.resolve(); });
    expect(valor.dados).toBeNull();
    expect(api.bootstrap).not.toHaveBeenCalled();
    expect(api.lancar).not.toHaveBeenCalled();
    void uuid;
  });
});
