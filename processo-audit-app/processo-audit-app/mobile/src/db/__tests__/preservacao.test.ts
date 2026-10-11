import { aplicarPendencias } from '@/domain/visao';
import { criarBancoDeTeste } from '@/testing/bancoNode';
import { criarBootstrap, criarOS } from '@/testing/fixtures';
import { novaFoto, novaIniciar, novoLancamento, uuid } from '@/testing/operacoes';
import { rascunhoVazio } from '@/domain/etapas';
import { migrar } from '../migracoes';
import { concluirOk, enfileirar, listarEmFila, marcarNoRetrato, reservar } from '../outbox';
import { lerDados, limparDadosLocais, salvarBootstrap } from '../repositorio';
import { apagarFoto, inserirFoto, lerDetalhes, lerRascunho, listarFotos, podarDetalhes, salvarDetalhe, salvarRascunho } from '../trabalho';

const foto = (osId: number, n: number) => ({ client_uuid: uuid(n), usuario_id: 7, os_id: osId, arquivo: `file:///f${n}.jpg`, mime: 'image/jpeg', tamanho: 1234, tirada_em: '2026-10-11T14:00:00.000Z', lat: -23.5, lng: -46.3, legenda: null, criado_em: '2026-10-11T14:00:00.000Z' });

describe('novo retrato do servidor NÃO sobrescreve trabalho pendente', () => {
  it('operações, rascunho e fotos sobrevivem à troca do retrato — mesmo se a OS sumir dele', async () => {
    const { banco } = await criarBancoDeTeste();
    await salvarBootstrap(banco, criarBootstrap());
    const ini = await enfileirar(banco, novaIniciar(102));
    const lanc = await enfileirar(banco, novoLancamento(102, [{ lote_id: 11, quantidade: 100 }], { depende_de: [ini.id] }));
    await salvarRascunho(banco, 7, 102, { ...rascunhoVazio(), descricao: 'Rota lançada até a CEO-03' });
    await inserirFoto(banco, foto(102, 1));

    // o servidor ainda diz "aberta" e posse cheia; depois reatribui a OS 102 para outro técnico (some do retrato)
    await salvarBootstrap(banco, criarBootstrap({ gerado_em: '2026-10-11T14:30:00.000Z' }));
    await salvarBootstrap(banco, criarBootstrap({ gerado_em: '2026-10-11T15:00:00.000Z', os: [criarOS(1)] }));

    expect((await listarEmFila(banco, 7)).map((o) => o.id)).toEqual([ini.id, lanc.id]);
    expect((await lerRascunho(banco, 102))?.descricao).toBe('Rota lançada até a CEO-03');
    expect(await listarFotos(banco, 102)).toHaveLength(1);
  });

  it('na visão, o que o técnico fez continua valendo por cima do retrato novo (status e posse)', async () => {
    const { banco } = await criarBancoDeTeste();
    await salvarBootstrap(banco, criarBootstrap());
    await enfileirar(banco, novaIniciar(102));
    await enfileirar(banco, novoLancamento(102, [{ lote_id: 11, quantidade: 100 }]));
    await salvarBootstrap(banco, criarBootstrap({ gerado_em: '2026-10-11T14:30:00.000Z' })); // servidor não recebeu nada ainda
    const v = aplicarPendencias((await lerDados(banco))!, await listarEmFila(banco, 7));
    expect(v.os.find((o) => o.id === 102)).toMatchObject({ status: 'em_andamento', sync: 'pendente', pendencias: 2 });
    expect(v.posse.find((p) => p.lote_id === 11)).toMatchObject({ quantidade: 349.5, reservado: 100 });
  });

  it('quando o servidor já aplicou a operação, o retrato novo + confirmação não desconta duas vezes', async () => {
    const { banco } = await criarBancoDeTeste();
    const lanc = await enfileirar(banco, novoLancamento(102, [{ lote_id: 11, quantidade: 100 }]));
    await reservar(banco, lanc.id, 1000); await concluirOk(banco, lanc.id, { id: 5 }, 2000);
    // retrato baixado depois da confirmação: a posse do servidor JÁ está 100 m menor
    await salvarBootstrap(banco, criarBootstrap({ posse: [{ lote_id: 11, lote_codigo: 'LOTE-BOB-0001', item_id: 1, item_nome: 'Cabo óptico ASU 12F', unidade: 'metros', quantidade: 349.5 }] }));
    await marcarNoRetrato(banco, 7, 3000);
    const v = aplicarPendencias((await lerDados(banco))!, await listarEmFila(banco, 7));
    expect(v.posse[0]).toMatchObject({ quantidade: 349.5 });
    expect(v.posse[0].reservado).toBeUndefined();
  });

  it('limparDadosLocais apaga só o espelho do servidor (e o cache de detalhe), nunca o trabalho do técnico', async () => {
    const { banco } = await criarBancoDeTeste();
    await salvarBootstrap(banco, criarBootstrap());
    await salvarDetalhe(banco, 102, { baixado_em: 'x', servicos: [], materiais: [], fotos: [] });
    await enfileirar(banco, novoLancamento(102));
    await salvarRascunho(banco, 7, 102, rascunhoVazio());
    await inserirFoto(banco, foto(102, 2));
    await limparDadosLocais(banco);
    expect(await lerDados(banco)).toBeNull();
    expect(await lerDetalhes(banco)).toEqual({});
    expect(await listarEmFila(banco, 7)).toHaveLength(1);
    expect(await lerRascunho(banco, 102)).not.toBeNull();
    expect(await listarFotos(banco, 102)).toHaveLength(1);
  });
});

describe('rascunho, fotos e detalhe em cache', () => {
  it('rascunho: grava, sobrescreve e completa campos novos com o padrão', async () => {
    const { banco } = await criarBancoDeTeste();
    expect(await lerRascunho(banco, 102)).toBeNull();
    await salvarRascunho(banco, 7, 102, { ...rascunhoVazio(), descricao: 'v1', participantes: [2] });
    await salvarRascunho(banco, 7, 102, { ...rascunhoVazio(), descricao: 'v2' });
    expect(await lerRascunho(banco, 102)).toMatchObject({ descricao: 'v2', participantes: [], materiais_usados: null });
    await banco.run('UPDATE rascunhos SET dados = ? WHERE os_id = 102', [JSON.stringify({ descricao: 'de uma versão antiga' })]);
    expect(await lerRascunho(banco, 102)).toEqual({ ...rascunhoVazio(), descricao: 'de uma versão antiga' });
  });
  it('fotos: lista as não removidas por OS e na ordem em que foram tiradas', async () => {
    const { banco } = await criarBancoDeTeste();
    await inserirFoto(banco, { ...foto(102, 1), criado_em: '2026-10-11T14:02:00.000Z' });
    await inserirFoto(banco, { ...foto(102, 2), criado_em: '2026-10-11T14:01:00.000Z' });
    await inserirFoto(banco, foto(103, 3));
    expect((await listarFotos(banco, 102)).map((f) => f.client_uuid)).toEqual([uuid(2), uuid(1)]);
    await banco.run('UPDATE fotos_locais SET removida = 1 WHERE client_uuid = ?', [uuid(2)]);
    expect((await listarFotos(banco, 102)).map((f) => f.client_uuid)).toEqual([uuid(1)]);
    await apagarFoto(banco, uuid(1));
    expect(await listarFotos(banco, 102)).toEqual([]);
  });
  it('detalhe: guarda por OS e poda o que não interessa mais', async () => {
    const { banco } = await criarBancoDeTeste();
    const d = { baixado_em: '2026-10-11T13:00:00.000Z', servicos: [], materiais: [], fotos: [] };
    await salvarDetalhe(banco, 101, d); await salvarDetalhe(banco, 102, d); await salvarDetalhe(banco, 102, { ...d, baixado_em: 'novo' });
    expect(Object.keys(await lerDetalhes(banco))).toEqual(['101', '102']);
    expect((await lerDetalhes(banco))[102].baixado_em).toBe('novo');
    await podarDetalhes(banco, [102]);
    expect(Object.keys(await lerDetalhes(banco))).toEqual(['102']);
  });
});

describe('migração 2', () => {
  it('atualiza um banco da versão 1 sem perder o espelho do servidor', async () => {
    const { banco, db } = await criarBancoDeTeste(false);
    await migrar(banco, 1);
    expect(db.pragma('user_version', { simple: true })).toBe(1);
    await salvarBootstrap(banco, criarBootstrap());
    await migrar(banco);
    expect(db.pragma('user_version', { simple: true })).toBe(2);
    expect((await lerDados(banco))?.os).toHaveLength(3);
    expect(await banco.all('SELECT * FROM outbox')).toEqual([]);
    await enfileirar(banco, novaFoto(101)); // a tabela nova funciona
  });
});
