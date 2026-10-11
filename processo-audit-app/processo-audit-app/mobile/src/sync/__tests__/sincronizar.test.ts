import { ApiError, NetworkError } from '@/api/erros';
import { armazenamentoEmMemoria } from '@/auth/armazenamento';
import { ConfigServidor } from '@/config/servidor';
import { enfileirar, listarTodas } from '@/db/outbox';
import { lerDados, lerMeta, salvarBootstrap } from '@/db/repositorio';
import { inserirFoto, lerRascunho, listarFotos, salvarDetalhe, salvarRascunho } from '@/db/trabalho';
import { rascunhoVazio } from '@/domain/etapas';
import { novaIniciar, novoLancamento, uuid } from '@/testing/operacoes';
import { criarBancoDeTeste } from '@/testing/bancoNode';
import { criarBootstrap, criarOS } from '@/testing/fixtures';
import { descartarTudoLocal, garantirDono, resumoDoTrabalho, sincronizar } from '../sincronizar';

describe('sincronizar', () => {
  it('baixa o retrato, troca o espelho e registra quando sincronizou', async () => {
    const { banco } = await criarBancoDeTeste();
    const bootstrap = jest.fn(async () => criarBootstrap());
    await sincronizar({ bootstrap, detalheOS: jest.fn(async () => ({ servicos: [], materiais: [], fotos: [] })) }, banco, { usuarioId: 7, agora: () => Date.parse('2026-10-11T14:00:00Z') });
    expect((await lerDados(banco))?.os).toHaveLength(3);
    expect(await lerMeta(banco, 'sincronizado_em')).toBe('2026-10-11T14:00:00.000Z');
  });

  it('se o servidor falha ou não há rede, o espelho anterior fica intacto e o erro sobe', async () => {
    const { banco } = await criarBancoDeTeste();
    await salvarBootstrap(banco, criarBootstrap());
    const detalheOS = jest.fn(async () => ({ servicos: [], materiais: [], fotos: [] }));
    await expect(sincronizar({ bootstrap: async () => { throw new NetworkError(); }, detalheOS }, banco, { usuarioId: 7 })).rejects.toBeInstanceOf(NetworkError);
    await expect(sincronizar({ bootstrap: async () => { throw new ApiError(500, 'Erro interno do servidor'); }, detalheOS }, banco, { usuarioId: 7 })).rejects.toThrow('Erro interno');
    const d = (await lerDados(banco))!;
    expect(d.geradoEm).toBe('2026-10-11T13:30:00.000Z');
    expect(d.os).toHaveLength(3);
  });
});

const joao = { id: 7, nome: 'João Técnico' };
const ana = { id: 8, nome: 'Ana Técnica' };
const foto = (n: number) => ({ client_uuid: uuid(n), usuario_id: 7, os_id: 102, arquivo: `file:///fotos/${n}.jpg`, mime: 'image/jpeg', tamanho: 10, tirada_em: 'x', lat: null, lng: null, legenda: null, criado_em: 'x' });

describe('garantirDono', () => {
  it('o primeiro técnico só marca o dono; o mesmo técnico mantém os dados', async () => {
    const { banco } = await criarBancoDeTeste();
    expect(await garantirDono(banco, joao)).toEqual({ bloqueado: false, limpou: false });
    await salvarBootstrap(banco, criarBootstrap());
    expect(await garantirDono(banco, joao)).toEqual({ bloqueado: false, limpou: false });
    expect((await lerDados(banco))?.os).toHaveLength(3);
    expect(await lerMeta(banco, 'usuario_nome')).toBe('João Técnico');
  });
  it('outro técnico no mesmo aparelho NUNCA vê os dados do anterior quando não há nada pendente', async () => {
    const { banco } = await criarBancoDeTeste();
    await garantirDono(banco, joao);
    await salvarBootstrap(banco, criarBootstrap());
    expect(await garantirDono(banco, ana)).toEqual({ bloqueado: false, limpou: true });
    expect(await lerDados(banco)).toBeNull();
    expect(await lerMeta(banco, 'usuario_id')).toBe('8');
    expect(await lerMeta(banco, 'usuario_nome')).toBe('Ana Técnica');
  });
  it('com trabalho NÃO enviado do anterior, o novo técnico fica BLOQUEADO e nada é apagado', async () => {
    const { banco } = await criarBancoDeTeste();
    await garantirDono(banco, joao);
    await salvarBootstrap(banco, criarBootstrap());
    await enfileirar(banco, novoLancamento(102));
    await inserirFoto(banco, foto(1));
    const apagados: string[] = [];
    const r = await garantirDono(banco, ana, async (u) => { apagados.push(u); });
    expect(r).toEqual({ bloqueado: true, limpou: false, pendencias: 1, donoNome: 'João Técnico' });
    expect(apagados).toEqual([]);
    expect(await lerMeta(banco, 'usuario_id')).toBe('7'); // continua sendo do João
    expect((await lerDados(banco))?.os).toHaveLength(3);
    expect(await listarTodas(banco, 7)).toHaveLength(1);
    expect(await listarFotos(banco, 102)).toHaveLength(1);
  });
  it('um rascunho começado e ainda não enviado também conta como trabalho a proteger', async () => {
    const { banco } = await criarBancoDeTeste();
    await garantirDono(banco, joao);
    await salvarRascunho(banco, 7, 102, { ...rascunhoVazio(), descricao: 'metade escrita' });
    expect(await garantirDono(banco, ana)).toMatchObject({ bloqueado: true, pendencias: 1 });
  });
  it('o dono de volta destrava: continua de onde parou', async () => {
    const { banco } = await criarBancoDeTeste();
    await garantirDono(banco, joao);
    await enfileirar(banco, novoLancamento(102));
    expect((await garantirDono(banco, ana)).bloqueado).toBe(true);
    expect(await garantirDono(banco, joao)).toEqual({ bloqueado: false, limpou: false });
    expect(await listarTodas(banco, 7)).toHaveLength(1);
  });
  it('só histórico já confirmado do anterior não bloqueia: é limpo, inclusive os arquivos de foto que sobraram', async () => {
    const { banco } = await criarBancoDeTeste();
    await garantirDono(banco, joao);
    const op = await enfileirar(banco, novaIniciar(102));
    await banco.run("UPDATE outbox SET estado = 'ok', ok_em = 1, no_retrato = 1 WHERE id = ?", [op.id]);
    await inserirFoto(banco, foto(2));
    const apagados: string[] = [];
    expect(await garantirDono(banco, ana, async (u) => { apagados.push(u); })).toEqual({ bloqueado: false, limpou: true });
    expect(await listarTodas(banco, 7)).toEqual([]);
    expect(apagados).toEqual(['file:///fotos/2.jpg']);
  });
});

describe('descarte confirmado e resumo do trabalho', () => {
  it('resume o que seria perdido (envios, rascunhos e fotos) para a confirmação', async () => {
    const { banco } = await criarBancoDeTeste();
    await enfileirar(banco, novoLancamento(102));
    await enfileirar(banco, novaIniciar(102));
    await inserirFoto(banco, foto(3));
    await enfileirar(banco, { ...novoLancamento(102), tipo: 'foto', payload: { arquivo: 'file:///fotos/3.jpg', mime: 'image/jpeg', campos: { client_uuid: uuid(3), tirada_em: 'x' } } } as never);
    await salvarRascunho(banco, 7, 102, rascunhoVazio());
    expect(await resumoDoTrabalho(banco, 7)).toEqual({ operacoes: 3, rascunhos: 1, fotos: 1, total: 4 });
    expect(await resumoDoTrabalho(banco, 8)).toEqual({ operacoes: 0, rascunhos: 0, fotos: 0, total: 0 });
  });
  it('descartarTudoLocal apaga fila, rascunho, fotos (e os arquivos), detalhe e espelho', async () => {
    const { banco } = await criarBancoDeTeste();
    await salvarBootstrap(banco, criarBootstrap());
    await salvarDetalhe(banco, 102, { baixado_em: 'x', servicos: [], materiais: [], fotos: [] });
    await enfileirar(banco, novoLancamento(102));
    await salvarRascunho(banco, 7, 102, rascunhoVazio());
    await inserirFoto(banco, foto(4));
    const apagados: string[] = [];
    await descartarTudoLocal(banco, async (u) => { apagados.push(u); });
    expect(await lerDados(banco)).toBeNull();
    expect(await listarTodas(banco, 7)).toEqual([]);
    expect(await lerRascunho(banco, 102)).toBeNull();
    expect(await listarFotos(banco, 102)).toEqual([]);
    expect(apagados).toEqual(['file:///fotos/4.jpg']);
  });
});
