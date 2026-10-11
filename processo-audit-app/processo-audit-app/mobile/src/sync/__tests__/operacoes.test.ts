import { concluirOk, enfileirar, listarTodas, marcarAtencao, marcarNoRetrato, obter, reservar } from '@/db/outbox';
import { salvarBootstrap } from '@/db/repositorio';
import { lerRascunho, listarFotos, obterFoto, salvarDetalhe } from '@/db/trabalho';
import { rascunhoVazio, type Rascunho } from '@/domain/etapas';
import { agrupar } from '@/domain/posse';
import { aplicarPendencias, lancamentosDaOS } from '@/domain/visao';
import { criarBancoDeTeste } from '@/testing/bancoNode';
import { criarBootstrap } from '@/testing/fixtures';
import { novaIniciar, uuid } from '@/testing/operacoes';
import { carregarEstadoLocal } from '../estadoLocal';
import {
  adicionarFoto, descartarOperacao, ErroOperacao, finalizarOS, iniciarOS, registrarLancamento, reenviarOperacao, removerFotoDaOS, removerLancamento, salvarRascunhoLocal, solicitarDevolucao, substituirLancamento, voltarAEditar,
  type ContextoComandos,
} from '../operacoes';

const T0 = Date.parse('2026-10-11T14:00:00Z');

const montar = async (bootstrap = criarBootstrap()) => {
  const { banco } = await criarBancoDeTeste();
  await salvarBootstrap(banco, bootstrap);
  let n = 5000;
  const apagados: string[] = [];
  const ctx: ContextoComandos = { banco, usuarioId: 7, uuid: () => uuid(++n), agora: () => T0, dispositivo: 'android 14', versaoApp: '1.0.0', arquivos: { apagar: async (u) => { apagados.push(u); } } };
  const estado = async () => (await carregarEstadoLocal(banco, 7))!;
  const posse = async (lote: number) => (await estado()).visao.posse.find((p) => p.lote_id === lote)!;
  return { banco, ctx, apagados, estado, posse };
};
// OS 101 já está em andamento, 102 aberta, 103 concluída
const lanc = (osId: number, itens: Array<[string, string]> = [['l11', '100']], extra: { descricao?: string; trecho?: string } = {}) =>
  ({ osId, descricao: extra.descricao ?? 'Lançamento de cabo ASU 12F', trecho: extra.trecho ?? 'PL-0932 → PL-0945', itens: itens.map(([chaveGrupo, quantidade]) => ({ chaveGrupo, quantidade })) });
const pedir = (p: Promise<unknown>) => p.then(() => null, (e: Error) => e);

describe('iniciarOS (offline)', () => {
  it('grava a hora do aparelho na fila e a OS já aparece em andamento', async () => {
    const { ctx, estado } = await montar();
    const op = await iniciarOS(ctx, 102);
    expect(op).toMatchObject({ tipo: 'iniciar', os_id: 102, estado: 'pendente', payload: { corpo: { iniciado_em: '2026-10-11T14:00:00.000Z' } } });
    const os = (await estado()).visao.os.find((o) => o.id === 102)!;
    expect(os).toMatchObject({ status: 'em_andamento', iniciado_em: '2026-10-11T14:00:00.000Z', sync: 'pendente' });
  });
  it('tocar duas vezes não cria duas operações', async () => {
    const { ctx, banco } = await montar();
    const a = await iniciarOS(ctx, 102); const b = await iniciarOS(ctx, 102);
    expect(b?.id).toBe(a?.id);
    expect(await listarTodas(banco, 7)).toHaveLength(1);
  });
  it('OS já iniciada não gera operação; OS encerrada ou desconhecida é recusada', async () => {
    const { ctx, banco } = await montar();
    expect(await iniciarOS(ctx, 101)).toBeNull();
    expect(await pedir(iniciarOS(ctx, 103))).toBeInstanceOf(ErroOperacao);
    expect((await pedir(iniciarOS(ctx, 999)))?.message).toMatch(/não está mais na sua lista/);
    expect(await listarTodas(banco, 7)).toHaveLength(0);
  });
});

describe('iniciarOS com um "iniciar" antigo guardado no aparelho', () => {
  it('já confirmado e refletido no retrato, mas o servidor mostra a OS aberta de novo: cria um novo, não devolve o antigo (antes "nada acontecia")', async () => {
    const { ctx, banco, estado } = await montar();
    const antigo = (await enfileirar(banco, { ...novaIniciar(102), usuario_id: 7 }, T0 - 5000));
    await reservar(banco, antigo.id, T0 - 4000); await concluirOk(banco, antigo.id, { status: 'em_andamento' }, T0 - 3000); await marcarNoRetrato(banco, 7, T0);
    expect((await estado()).visao.os.find((o) => o.id === 102)?.status).toBe('aberta'); // é isso que a tela mostra, com o botão "Iniciar execução"
    const nova = await iniciarOS(ctx, 102);
    expect(nova?.id).not.toBe(antigo.id);
    expect(nova).toMatchObject({ tipo: 'iniciar', estado: 'pendente', os_id: 102 });
    expect((await estado()).visao.os.find((o) => o.id === 102)).toMatchObject({ status: 'em_andamento', sync: 'pendente' });
  });
  it('confirmado mas ainda fora do retrato conta como válido: tocar de novo não duplica', async () => {
    const { ctx, banco } = await montar();
    const op = await iniciarOS(ctx, 102);
    await reservar(banco, op!.id, T0); await concluirOk(banco, op!.id, { status: 'em_andamento' }, T0);
    const de_novo = await iniciarOS(ctx, 102);
    expect(de_novo?.id).toBe(op!.id); // devolve o mesmo registro, não cria outro
    expect((await listarTodas(banco, 7)).filter((o) => o.tipo === 'iniciar')).toHaveLength(1);
  });
});

describe('registrarLancamento', () => {
  it('congela o corpo (serviço, trecho, lote e quantidade) e reserva a posse na hora', async () => {
    const { ctx, posse } = await montar();
    const op = await registrarLancamento(ctx, lanc(101, [['l11', '350,5']]));
    expect(op).toMatchObject({ tipo: 'lancamento', estado: 'pendente', depende_de: [], os_numero: 1 });
    expect(op.payload).toEqual({
      corpo: { descricao: 'Lançamento de cabo ASU 12F', trecho: 'PL-0932 → PL-0945', materiais: [{ lote_id: 11, quantidade: 350.5 }] },
      exibicao: { linhas: [{ item_nome: 'Cabo óptico ASU 12F', unidade: 'metros', lote_id: 11, lote_codigo: 'LOTE-BOB-0001', quantidade: 350.5 }] },
    });
    expect(await posse(11)).toMatchObject({ quantidade: 99, reservado: 350.5 });
  });
  it('peças de vários lotes saem pelo mais antigo primeiro (FIFO por lote_id)', async () => {
    const { ctx } = await montar();
    const op = await registrarLancamento(ctx, lanc(101, [['i2', '35']]));
    expect((op.payload as { corpo: { materiais: unknown } }).corpo.materiais).toEqual([{ lote_id: 21, quantidade: 30 }, { lote_id: 22, quantidade: 5 }]);
  });
  it('o segundo lançamento enxerga o que o primeiro reservou: não dá para usar o mesmo material duas vezes sem sinal', async () => {
    const { ctx, posse, banco } = await montar();
    await registrarLancamento(ctx, lanc(101, [['l11', '300']]));
    const erro = await pedir(registrarLancamento(ctx, lanc(101, [['l11', '200']])));
    expect(erro).toBeInstanceOf(ErroOperacao);
    expect(erro?.message).toBe('Cabo óptico ASU 12F: Você tem 149,5 m em posse');
    expect(await posse(11)).toMatchObject({ quantidade: 149.5 });
    expect(await listarTodas(banco, 7)).toHaveLength(1);
    await registrarLancamento(ctx, lanc(101, [['l11', '149,5']])); // o que sobrou é usável
    expect(await posse(11)).toMatchObject({ quantidade: 0, reservado: 449.5 });
  });
  it('dois toques simultâneos que juntos passam da posse: só um entra', async () => {
    const { ctx, banco } = await montar();
    const r = await Promise.all([registrarLancamento(ctx, lanc(101, [['l11', '300']])).then(() => 'ok', () => 'recusado'), registrarLancamento(ctx, lanc(101, [['l11', '300']])).then(() => 'ok', () => 'recusado')]);
    expect(r.sort()).toEqual(['ok', 'recusado']);
    expect(await listarTodas(banco, 7)).toHaveLength(1);
  });
  it.each([
    ['acima da posse', [['l11', '449,51']], /Você tem 449,5 m em posse/],
    ['peça fracionada', [['i2', '2,5']], /contado em unidades: informe um número inteiro/],
    ['metros com 3 casas', [['l11', '1,234']], /no máximo 2 casas decimais/],
    ['zero', [['l11', '0']], /maior que zero/],
    ['texto', [['l11', 'abc']], /apenas números/],
    ['vazio', [['l11', '']], /Informe a quantidade/],
    ['lote que não é do técnico', [['l999', '1']], /não está mais na sua posse/],
    ['o mesmo item duas vezes', [['l11', '1'], ['l11', '2']], /aparece duas vezes/],
  ] as Array<[string, Array<[string, string]>, RegExp]>)('recusa %s, com mensagem clara e sem enfileirar nada', async (_n, itens, msg) => {
    const { ctx, banco } = await montar();
    const erro = await pedir(registrarLancamento(ctx, lanc(101, itens)));
    expect(erro).toBeInstanceOf(ErroOperacao);
    expect(erro?.message).toMatch(msg);
    expect(await listarTodas(banco, 7)).toHaveLength(0);
  });
  it('exige serviço, trecho e ao menos um material', async () => {
    const { ctx } = await montar();
    expect((await pedir(registrarLancamento(ctx, lanc(101, [['l11', '1']], { descricao: ' ' }))))?.message).toMatch(/serviço realizado/);
    expect((await pedir(registrarLancamento(ctx, lanc(101, [['l11', '1']], { trecho: '' }))))?.message).toMatch(/trecho/);
    expect((await pedir(registrarLancamento(ctx, lanc(101, []))))?.message).toMatch(/ao menos um material/);
  });
  it('OS que ainda não foi iniciada ou que já foi encerrada não aceita material', async () => {
    const { ctx } = await montar();
    expect((await pedir(registrarLancamento(ctx, lanc(102))))?.message).toMatch(/Inicie a execução/);
    expect((await pedir(registrarLancamento(ctx, lanc(103))))?.message).toMatch(/já foi encerrada/);
  });
  it('depois de iniciar offline, pode lançar; o lançamento espera o "iniciar" sair antes', async () => {
    const { ctx } = await montar();
    const ini = (await iniciarOS(ctx, 102))!;
    const op = await registrarLancamento(ctx, lanc(102));
    expect(op.depende_de).toEqual([ini.id]);
  });
});

describe('trecho marcado no mapa', () => {
  const rota = { pontos: [{ lat: -23.5, lng: -46.3 }, { lat: -23.51, lng: -46.31 }], metros: 1850, caminho: [[-23.5, -46.3], [-23.51, -46.31]] as Array<[number, number]> };
  it('a rota vai no corpo congelado do lançamento (é o que o servidor grava)', async () => {
    const { ctx } = await montar();
    const op = await registrarLancamento(ctx, { ...lanc(101, [['l11', '10']]), rota });
    expect((op.payload as { corpo: { rota: unknown } }).corpo.rota).toEqual(rota);
  });
  it('sem rota o corpo não ganha o campo', async () => {
    const { ctx } = await montar();
    const op = await registrarLancamento(ctx, lanc(101, [['l11', '10']]));
    expect((op.payload as { corpo: object }).corpo).not.toHaveProperty('rota');
    const op2 = await registrarLancamento(ctx, { ...lanc(101, [['l11', '10']]), rota: null });
    expect((op2.payload as { corpo: object }).corpo).not.toHaveProperty('rota');
  });
  it('caminho muito longo é reduzido para 600 pontos, sem perder o início nem o fim (o servidor cortaria em 700)', async () => {
    const { ctx } = await montar();
    const caminho = Array.from({ length: 2500 }, (_, i) => [-23.5 - i / 1e5, -46.3] as [number, number]);
    const op = await registrarLancamento(ctx, { ...lanc(101, [['l11', '10']]), rota: { ...rota, caminho } });
    const gravado = (op.payload as { corpo: { rota: { caminho: Array<[number, number]> } } }).corpo.rota.caminho;
    expect(gravado).toHaveLength(600);
    expect(gravado[0]).toEqual(caminho[0]);
    expect(gravado[599]).toEqual(caminho[2499]);
  });
  it.each([
    ['um ponto só', { ...rota, pontos: [rota.pontos[0]] }],
    ['26 pontos', { ...rota, pontos: Array.from({ length: 26 }, (_, i) => ({ lat: -23 - i / 100, lng: -46 })) }],
    ['coordenada impossível', { ...rota, pontos: [rota.pontos[0], { lat: 99, lng: 0 }] }],
  ])('recusa rota inválida (%s) sem enfileirar nada', async (_n, ruim) => {
    const { ctx, banco } = await montar();
    const erro = await pedir(registrarLancamento(ctx, { ...lanc(101, [['l11', '10']]), rota: ruim }));
    expect(erro).toBeInstanceOf(ErroOperacao);
    expect(erro?.message).toBe('O trecho marcado no mapa precisa de 2 a 25 pontos válidos.');
    expect(await listarTodas(banco, 7)).toHaveLength(0);
  });
  it('a lista de lançamentos traz a rota marcada', async () => {
    const { ctx, estado } = await montar();
    await registrarLancamento(ctx, { ...lanc(101, [['l11', '10']]), rota });
    
    const e = await estado();
    expect(lancamentosDaOS(101, null, e.ops)[0].rota).toEqual(rota);
  });
});

describe('corrigir ou remover lançamento', () => {
  it('um que o servidor recusou é substituído por outro com identificadores novos, e a reserva acompanha', async () => {
    const { ctx, banco, posse } = await montar();
    const antigo = await registrarLancamento(ctx, lanc(101, [['l11', '400']]));
    await reservar(banco, antigo.id, T0);
    await marcarAtencao(banco, antigo.id, { status: 400, mensagem: 'Quantidade maior que a posse do técnico neste lote (300)' }, T0);
    expect(await posse(11)).toMatchObject({ quantidade: 49.5 }); // ainda reservando 400
    const novo = await substituirLancamento(ctx, antigo.id, { descricao: 'Lançamento de cabo ASU 12F', trecho: 'PL-1 → PL-2', itens: [{ chaveGrupo: 'l11', quantidade: '300' }] });
    expect(novo.id).not.toBe(antigo.id);
    expect(novo.client_uuid).not.toBe(antigo.client_uuid);
    expect(novo.chave).not.toBe(antigo.chave);
    expect(await obter(banco, antigo.id)).toBeNull();
    expect(await posse(11)).toMatchObject({ quantidade: 149.5, reservado: 300 });
  });
  it('se a correção é inválida nada muda (o antigo continua lá)', async () => {
    const { ctx, banco } = await montar();
    const antigo = await registrarLancamento(ctx, lanc(101, [['l11', '100']]));
    const erro = await pedir(substituirLancamento(ctx, antigo.id, { descricao: 'x y', trecho: 'a', itens: [{ chaveGrupo: 'l11', quantidade: '9999' }] }));
    expect(erro).toBeInstanceOf(ErroOperacao);
    expect((await obter(banco, antigo.id))?.estado).toBe('pendente');
  });
  it('um lançamento já enviado (ou em envio) não pode ser alterado nem removido pelo app', async () => {
    const { ctx, banco } = await montar();
    const a = await registrarLancamento(ctx, lanc(101, [['l11', '10']]));
    await reservar(banco, a.id, T0);
    expect((await pedir(removerLancamento(ctx, a.id)))?.message).toMatch(/fale com o estoque/);
    expect((await pedir(substituirLancamento(ctx, a.id, lanc(101))))?.message).toMatch(/fale com o estoque/);
  });
  it('remover um pendente libera a posse', async () => {
    const { ctx, posse } = await montar();
    const a = await registrarLancamento(ctx, lanc(101, [['l11', '100']]));
    await removerLancamento(ctx, a.id);
    expect(await posse(11)).toMatchObject({ quantidade: 449.5 });
    expect((await posse(11)).reservado).toBeUndefined();
  });
});

describe('fotos', () => {
  it('guarda a foto no aparelho e enfileira o envio (depois do iniciar, se ele ainda não saiu)', async () => {
    const { ctx, banco } = await montar();
    const ini = (await iniciarOS(ctx, 102))!;
    const { clientUuid } = await adicionarFoto(ctx, { osId: 102, arquivo: 'file:///fotos/a.jpg', tamanho: 123456, lat: -23.5, lng: -46.3 });
    const ops = await listarTodas(banco, 7);
    expect(ops.find((o) => o.tipo === 'foto')).toMatchObject({ client_uuid: clientUuid, depende_de: [ini.id], payload: { arquivo: 'file:///fotos/a.jpg', campos: { client_uuid: clientUuid, lat: -23.5, lng: -46.3 } } });
    expect(await listarFotos(banco, 102)).toMatchObject([{ client_uuid: clientUuid, tamanho: 123456, servidor_id: null }]);
  });
  it('respeita o limite de fotos do servidor (contando as que já estão lá)', async () => {
    const { ctx, banco } = await montar(criarBootstrap({ regras: { ...criarBootstrap().regras, fotos_max: 2 } }));
    await salvarDetalhe(banco, 101, { baixado_em: 'x', servicos: [], materiais: [], fotos: [{ id: 1, client_uuid: uuid(1) }] });
    await adicionarFoto(ctx, { osId: 101, arquivo: 'file:///1.jpg', tamanho: 1 });
    expect((await pedir(adicionarFoto(ctx, { osId: 101, arquivo: 'file:///2.jpg', tamanho: 1 })))?.message).toBe('Cada OS aceita no máximo 2 fotos.');
  });
  it('remover uma foto que ainda não saiu: some do aparelho (arquivo apagado) e do envio, sem rastro no servidor', async () => {
    const { ctx, banco, apagados } = await montar();
    const { clientUuid } = await adicionarFoto(ctx, { osId: 101, arquivo: 'file:///fotos/b.jpg', tamanho: 10 });
    await removerFotoDaOS(ctx, 101, clientUuid);
    expect(await listarTodas(banco, 7)).toEqual([]);
    expect(await listarFotos(banco, 101)).toEqual([]);
    expect(await obterFoto(banco, clientUuid)).toBeNull();
    expect(apagados).toEqual(['file:///fotos/b.jpg']);
  });
  it('remover uma foto já enviada (ou em envio): marca como removida e manda o pedido de remoção atrás', async () => {
    const { ctx, banco } = await montar();
    const { clientUuid } = await adicionarFoto(ctx, { osId: 101, arquivo: 'file:///fotos/c.jpg', tamanho: 10 });
    const opFoto = (await listarTodas(banco, 7))[0];
    await reservar(banco, opFoto.id, T0); // em envio: resultado incerto, não dá para cancelar
    await removerFotoDaOS(ctx, 101, clientUuid);
    const ops = await listarTodas(banco, 7);
    expect(ops.map((o) => o.tipo)).toEqual(['foto', 'remover_foto']);
    expect(ops[1]).toMatchObject({ depende_de: [opFoto.id], payload: { foto_client_uuid: clientUuid } });
    expect(await listarFotos(banco, 101)).toEqual([]); // some da tela na hora
    expect((await obterFoto(banco, clientUuid))?.removida).toBe(true);
  });
});

describe('rascunho', () => {
  it('guarda no aparelho e deixa só UMA cópia (a mais nova) esperando para o servidor', async () => {
    const { ctx, banco } = await montar();
    await salvarRascunhoLocal(ctx, 101, { ...rascunhoVazio(), descricao: 'primeira' });
    await salvarRascunhoLocal(ctx, 101, { ...rascunhoVazio(), descricao: 'segunda versão' });
    expect((await lerRascunho(banco, 101))?.descricao).toBe('segunda versão');
    const ops = (await listarTodas(banco, 7)).filter((o) => o.tipo === 'rascunho');
    expect(ops).toHaveLength(1);
    expect((ops[0].payload as { corpo: { rascunho: { descricao: string } } }).corpo.rascunho.descricao).toBe('segunda versão');
  });
  it('em OS encerrada não guarda nada', async () => {
    const { ctx, banco } = await montar();
    await salvarRascunhoLocal(ctx, 103, { ...rascunhoVazio(), descricao: 'x' });
    expect(await lerRascunho(banco, 103)).toBeNull();
  });
});

describe('finalizarOS', () => {
  const completo = (fotoUuid: string, extra: Partial<Rascunho> = {}): Rascunho => ({
    ...rascunhoVazio(), descricao: 'Rota lançada e CEO fechada no poste', motivo_codigo: 'route_launched',
    local: { lat: -23.5445, lng: -46.3118, origem: 'gps', precisao_m: 6, capturado_em: '2026-10-11T13:00:00.000Z' },
    checklist: { fiberLaunchedMeters: '350,5' }, materiais_usados: true, materiais_retirados: false, fotos: [fotoUuid], participantes: [2], ...extra,
  });
  const preparar = async (extra: Partial<Rascunho> = {}) => {
    const m = await montar();
    const l = await registrarLancamento(m.ctx, lanc(101, [['l11', '350,5']]));
    const { clientUuid } = await adicionarFoto(m.ctx, { osId: 101, arquivo: 'file:///fotos/f.jpg', tamanho: 5000 });
    await salvarRascunhoLocal(m.ctx, 101, completo(clientUuid, extra));
    return { ...m, l, fotoUuid: clientUuid };
  };

  it('congela o pacote inteiro: tudo que o servidor precisa, números como número, fotos esperadas e dependência de todas as operações da OS', async () => {
    const { ctx, banco, l, fotoUuid } = await preparar({ materiais_retirados: true, retirados: [
      { chave: 'a', item_id: 1, descricao: 'Cabo óptico ASU 12F', quantidade: '15,5', unidade: 'metros', condicao: 'usado' },
      { chave: 'b', item_id: null, descricao: ' Splitter antigo ', quantidade: '1', unidade: 'pecas', condicao: 'novo' },
    ] });
    const op = await finalizarOS(ctx, 101);
    const opFoto = (await listarTodas(banco, 7)).find((o) => o.tipo === 'foto')!;
    expect(op).toMatchObject({ tipo: 'finalizar', estado: 'pendente', depende_de: [l.id, opFoto.id] });
    expect(op.payload).toEqual({ corpo: {
      client_uuid: expect.any(String), descricao: 'Rota lançada e CEO fechada no poste', motivo_codigo: 'route_launched',
      local: { lat: -23.5445, lng: -46.3118, precisao_m: 6, origem: 'gps', endereco: null, aproximado: false, capturado_em: '2026-10-11T13:00:00.000Z' },
      checklist: { fiberLaunchedMeters: 350.5 }, materiais_usados: true, materiais_retirados: true,
      retirados: [{ item_id: 1, quantidade: 15.5, condicao: 'usado' }, { descricao: 'Splitter antigo', quantidade: 1, unidade: 'pecas', condicao: 'novo' }],
      participantes: [2], fotos_esperadas: [fotoUuid], iniciado_em: '2026-10-11T12:00:00.000Z', finalizado_em: '2026-10-11T14:00:00.000Z', dispositivo: 'android 14', versao_app: '1.0.0',
    } });
  });
  it('o corpo enviado ao servidor NUNCA traz o client_uuid igual ao da chave de idempotência', async () => {
    const { ctx } = await preparar();
    const op = await finalizarOS(ctx, 101);
    expect((op.payload as { corpo: { client_uuid: string } }).corpo.client_uuid).not.toBe(op.chave);
  });
  it('"materiais usados" vem dos lançamentos reais, não do interruptor: sem lançamento é false', async () => {
    const m = await montar();
    const { clientUuid } = await adicionarFoto(m.ctx, { osId: 101, arquivo: 'file:///fotos/g.jpg', tamanho: 1 });
    await salvarRascunhoLocal(m.ctx, 101, completo(clientUuid, { materiais_usados: false }));
    const op = await finalizarOS(m.ctx, 101);
    expect((op.payload as { corpo: { materiais_usados: boolean } }).corpo.materiais_usados).toBe(false);
  });
  it('lançamento que o servidor já tem (cache) também conta como material usado', async () => {
    const m = await montar();
    await salvarDetalhe(m.banco, 101, { baixado_em: 'x', servicos: [{ id: 5, descricao: 'Lançamento', trecho: 'A', quantidade: 1, criado_em: 'x' }], materiais: [{ id: 1, servico_id: 5, item_nome: 'Cabo', lote_codigo: 'L', unidade: 'metros', quantidade: 10, estorno_id: null }], fotos: [] });
    const { clientUuid } = await adicionarFoto(m.ctx, { osId: 101, arquivo: 'file:///fotos/h.jpg', tamanho: 1 });
    await salvarRascunhoLocal(m.ctx, 101, completo(clientUuid, { materiais_usados: null }));
    expect((await finalizarOS(m.ctx, 101)).payload).toMatchObject({ corpo: { materiais_usados: true } });
  });
  it('as fotos valem pelo que existe de verdade: rascunho sem a lista de fotos finaliza se há foto; sem foto nenhuma, não', async () => {
    const m = await montar();
    await registrarLancamento(m.ctx, lanc(101, [['l11', '10']]));
    await salvarRascunhoLocal(m.ctx, 101, completo('qualquer', { fotos: [] }));
    expect((await pedir(finalizarOS(m.ctx, 101)))?.message).toBe('Ainda falta concluir: Fotos do Serviço.');
    const { clientUuid } = await adicionarFoto(m.ctx, { osId: 101, arquivo: 'file:///fotos/k.jpg', tamanho: 1 });
    const op = await finalizarOS(m.ctx, 101);
    expect((op.payload as { corpo: { fotos_esperadas: string[] } }).corpo.fotos_esperadas).toEqual([clientUuid]);
  });
  it('uma foto removida deixa de contar, mesmo que o rascunho ainda a lembre', async () => {
    const p = await preparar();
    await removerFotoDaOS(p.ctx, 101, p.fotoUuid);
    await salvarRascunhoLocal(p.ctx, 101, completo(p.fotoUuid));
    expect((await pedir(finalizarOS(p.ctx, 101)))?.message).toBe('Ainda falta concluir: Fotos do Serviço.');
  });
  it('etapa faltando: recusa dizendo quais, e nada entra na fila', async () => {
    const { ctx, banco } = await preparar({ descricao: 'curta', motivo_codigo: null });
    const antes = (await listarTodas(banco, 7)).length;
    const erro = await pedir(finalizarOS(ctx, 101));
    expect(erro).toBeInstanceOf(ErroOperacao);
    expect(erro?.message).toBe('Ainda falta concluir: Descrição, Motivo de Fechamento.');
    expect((await listarTodas(banco, 7)).length).toBe(antes);
  });
  it('sem iniciar a execução, sem rascunho, ou com um envio recusado pelo servidor: não finaliza', async () => {
    const m = await montar();
    expect((await pedir(finalizarOS(m.ctx, 102)))?.message).toMatch(/Inicie a execução/);
    expect((await pedir(finalizarOS(m.ctx, 101)))?.message).toMatch(/Preencha as etapas/);
    const p = await preparar();
    await reservar(p.banco, p.l.id, T0); await marcarAtencao(p.banco, p.l.id, { status: 400, mensagem: 'x' }, T0);
    expect((await pedir(finalizarOS(p.ctx, 101)))?.message).toMatch(/Requer atenção/);
  });
  it('tocar em Finalizar duas vezes devolve a mesma operação', async () => {
    const { ctx, banco } = await preparar();
    const a = await finalizarOS(ctx, 101); const b = await finalizarOS(ctx, 101);
    expect(b.id).toBe(a.id);
    expect((await listarTodas(banco, 7)).filter((o) => o.tipo === 'finalizar')).toHaveLength(1);
  });
  it('finalizar cancela o backup do rascunho que ainda esperava e passa a trancar a OS (lançamento, foto e remoção)', async () => {
    const { ctx, banco, l } = await preparar();
    await finalizarOS(ctx, 101);
    expect((await listarTodas(banco, 7)).filter((o) => o.tipo === 'rascunho')).toEqual([]);
    expect((await pedir(registrarLancamento(ctx, lanc(101))))?.message).toMatch(/Voltar a editar/);
    expect((await pedir(adicionarFoto(ctx, { osId: 101, arquivo: 'file:///x.jpg', tamanho: 1 })))?.message).toMatch(/Voltar a editar/);
    expect((await pedir(removerLancamento(ctx, l.id)))?.message).toMatch(/Voltar a editar/);
    await salvarRascunhoLocal(ctx, 101, rascunhoVazio());
    expect((await listarTodas(banco, 7)).filter((o) => o.tipo === 'rascunho')).toEqual([]); // com a finalização na fila não cria cópia
  });
  it('"Voltar a editar" cancela a finalização que ainda não saiu e libera a OS; em envio, pede para aguardar', async () => {
    const { ctx, banco } = await preparar();
    const fin = await finalizarOS(ctx, 101);
    await voltarAEditar(ctx, 101);
    expect(await obter(banco, fin.id)).toBeNull();
    await registrarLancamento(ctx, lanc(101, [['l11', '1']])); // voltou a aceitar
    const outra = await finalizarOS(ctx, 101);
    await reservar(banco, outra.id, T0);
    expect((await pedir(voltarAEditar(ctx, 101)))?.message).toMatch(/Aguarde/);
  });
  it('a visão mostra a finalização na fila e a OS continua em andamento até o servidor confirmar', async () => {
    const { ctx, estado } = await preparar();
    await finalizarOS(ctx, 101);
    expect((await estado()).visao.os.find((o) => o.id === 101)).toMatchObject({ status: 'em_andamento', finalizacao: 'na_fila' });
  });
  it('quantidade de material retirado inválida impede o pacote (o servidor também recusaria)', async () => {
    const { ctx } = await preparar({ materiais_retirados: true, retirados: [{ chave: 'a', item_id: null, descricao: 'Splitter', quantidade: '1,5', unidade: 'pecas', condicao: 'usado' }] });
    const erro = await pedir(finalizarOS(ctx, 101));
    expect(erro).toBeInstanceOf(ErroOperacao);
    expect(erro?.message).toMatch(/Materiais Retirados/);
  });
});

describe('tela "Requer atenção": reenviar e descartar', () => {
  const emAtencao = async (m: Awaited<ReturnType<typeof montar>>, op: { id: number }) => {
    await reservar(m.banco, op.id, T0);
    await marcarAtencao(m.banco, op.id, { status: 400, mensagem: 'x' }, T0);
  };
  it('tentar de novo devolve o item à fila; só vale para o que está em atenção', async () => {
    const m = await montar();
    const op = await registrarLancamento(m.ctx, lanc(101));
    expect((await pedir(reenviarOperacao(m.ctx, op.id)))?.message).toMatch(/não está mais aguardando atenção/);
    await emAtencao(m, op);
    await reenviarOperacao(m.ctx, op.id);
    expect((await obter(m.banco, op.id))?.estado).toBe('pendente');
  });
  it('"enviar mesmo assim" libera uma operação velha; depois de 50 dias não há como forçar', async () => {
    const m = await montar();
    const op = await registrarLancamento(m.ctx, lanc(101));
    await emAtencao(m, op);
    const dias = (n: number) => ({ ...m.ctx, agora: () => T0 + n * 86_400_000 });
    await reenviarOperacao(dias(20), op.id, { forcar: true });
    expect(await obter(m.banco, op.id)).toMatchObject({ estado: 'pendente', forcada: true });
    await emAtencao(m, op);
    expect((await pedir(reenviarOperacao(dias(51), op.id, { forcar: true })))?.message).toMatch(/mais de 50 dias/);
  });
  it('não mexe em operação de outro técnico', async () => {
    const m = await montar();
    const op = await registrarLancamento(m.ctx, lanc(101));
    await emAtencao(m, op);
    expect((await pedir(reenviarOperacao({ ...m.ctx, usuarioId: 8 }, op.id)))?.message).toMatch(/não está mais aguardando/);
    expect((await pedir(descartarOperacao({ ...m.ctx, usuarioId: 8 }, op.id)))?.message).toMatch(/não foi encontrado/);
  });
  it('descartar lançamento libera a posse reservada', async () => {
    const m = await montar();
    const op = await registrarLancamento(m.ctx, lanc(101, [['l11', '100']]));
    await emAtencao(m, op);
    expect((await m.posse(11)).quantidade).toBe(349.5);
    await descartarOperacao(m.ctx, op.id);
    expect((await m.posse(11)).quantidade).toBe(449.5);
  });
  it('descartar foto apaga também o arquivo e a linha local', async () => {
    const m = await montar();
    const { clientUuid } = await adicionarFoto(m.ctx, { osId: 101, arquivo: 'file:///fotos/z.jpg', tamanho: 1 });
    const op = (await listarTodas(m.banco, 7)).find((o) => o.tipo === 'foto')!;
    await emAtencao(m, op);
    await descartarOperacao(m.ctx, op.id);
    expect(await obterFoto(m.banco, clientUuid)).toBeNull();
    expect(m.apagados).toEqual(['file:///fotos/z.jpg']);
  });
  it('desistir de remover uma foto faz ela voltar para a lista', async () => {
    const m = await montar();
    const { clientUuid } = await adicionarFoto(m.ctx, { osId: 101, arquivo: 'file:///fotos/y.jpg', tamanho: 1 });
    const opFoto = (await listarTodas(m.banco, 7))[0];
    await reservar(m.banco, opFoto.id, T0);
    await removerFotoDaOS(m.ctx, 101, clientUuid);
    expect(await listarFotos(m.banco, 101)).toEqual([]);
    const rem = (await listarTodas(m.banco, 7)).find((o) => o.tipo === 'remover_foto')!;
    await emAtencao(m, rem);
    await descartarOperacao(m.ctx, rem.id);
    expect((await listarFotos(m.banco, 101)).map((f) => f.client_uuid)).toEqual([clientUuid]);
  });
  it('o que já foi enviado ou está em envio não pode ser descartado', async () => {
    const m = await montar();
    const op = await registrarLancamento(m.ctx, lanc(101));
    await reservar(m.banco, op.id, T0);
    expect((await pedir(descartarOperacao(m.ctx, op.id)))?.message).toMatch(/já foi enviado/);
  });
});

it('o estado carregado combina retrato e fila (e o retrato bruto continua intacto)', async () => {
  const { ctx, estado } = await montar();
  await registrarLancamento(ctx, lanc(101, [['l11', '100']]));
  const e = await estado();
  expect(e.dados.posse.find((p) => p.lote_id === 11)?.quantidade).toBe(449.5);
  expect(e.visao.posse.find((p) => p.lote_id === 11)?.quantidade).toBe(349.5);
  expect(agrupar(aplicarPendencias(e.dados, e.ops).posse).find((g) => g.key === 'l11')?.quantidade).toBe(349.5);
});

describe('solicitarDevolucao', () => {
  const item = (chaveGrupo: string, quantidade: string, condicao: 'novo' | 'usado' | null = 'usado') => ({ chaveGrupo, quantidade, condicao });

  it('congela o pedido (lote, quantidade, condição e observação), não pertence a nenhuma OS e separa o material na hora', async () => {
    const { ctx, posse, banco } = await montar();
    const [op] = await solicitarDevolucao(ctx, { itens: [item('l11', '120,5', 'novo')], observacao: '  sobra do lance  ' });
    expect(op).toMatchObject({ tipo: 'devolucao', os_id: 0, os_numero: null, estado: 'pendente', depende_de: [] });
    expect(op.payload).toEqual({
      corpo: { lote_id: 11, quantidade: 120.5, condicao: 'novo', observacao: 'sobra do lance' },
      exibicao: { item_nome: 'Cabo óptico ASU 12F', unidade: 'metros', lote_codigo: 'LOTE-BOB-0001' },
    });
    expect(await posse(11)).toMatchObject({ quantidade: 329, emDevolucao: 120.5 });
    expect(await listarTodas(banco, 7)).toHaveLength(1);
  });

  it('item que soma vários lotes vira um pedido por lote, do mais antigo ao mais novo', async () => {
    const { ctx } = await montar();
    const ops = await solicitarDevolucao(ctx, { itens: [item('i2', '35', 'novo')] });
    expect(ops.map((o) => o.tipo === 'devolucao' && [o.payload.corpo.lote_id, o.payload.corpo.quantidade])).toEqual([[21, 30], [22, 5]]);
    expect(new Set(ops.map((o) => o.chave)).size).toBe(2); // uma chave de idempotência por pedido
    expect(new Set(ops.map((o) => o.client_uuid)).size).toBe(2);
  });

  it('a condição (novo/usado) é obrigatória e nunca assumida', async () => {
    const { ctx, banco } = await montar();
    const e = await pedir(solicitarDevolucao(ctx, { itens: [item('l11', '10', null)] }));
    expect(e).toBeInstanceOf(ErroOperacao);
    expect(e?.message).toMatch(/novo ou usado/);
    expect(await listarTodas(banco, 7)).toHaveLength(0);
  });

  it('não deixa passar da posse, nem de peça quebrada, nem quantidade vazia', async () => {
    const { ctx, banco } = await montar();
    expect((await pedir(solicitarDevolucao(ctx, { itens: [item('l11', '450')] })))?.message).toMatch(/Você tem 449,5 m em posse/);
    expect((await pedir(solicitarDevolucao(ctx, { itens: [item('i2', '1,5')] })))?.message).toMatch(/número inteiro/);
    expect((await pedir(solicitarDevolucao(ctx, { itens: [item('l11', '')] })))?.message).toMatch(/Informe a quantidade/);
    expect((await pedir(solicitarDevolucao(ctx, { itens: [] })))?.message).toMatch(/ao menos um material/);
    expect((await pedir(solicitarDevolucao(ctx, { itens: [item('l11', '1')], observacao: 'x'.repeat(501) })))?.message).toMatch(/500 caracteres/);
    expect(await listarTodas(banco, 7)).toHaveLength(0);
  });

  it('dois toques seguidos não devolvem o mesmo material duas vezes', async () => {
    const { ctx, banco } = await montar();
    await solicitarDevolucao(ctx, { itens: [item('l11', '400')] });
    const e = await pedir(solicitarDevolucao(ctx, { itens: [item('l11', '400')] }));
    expect(e?.message).toMatch(/Você tem 49,5 m em posse/);
    expect(await listarTodas(banco, 7)).toHaveLength(1);
  });

  it('tudo ou nada: se um item é inválido, nenhum pedido é gravado', async () => {
    const { ctx, banco } = await montar();
    const e = await pedir(solicitarDevolucao(ctx, { itens: [item('l11', '10'), item('i2', '51')] }));
    expect(e).toBeInstanceOf(ErroOperacao);
    expect(await listarTodas(banco, 7)).toHaveLength(0);
  });

  it('o material separado não pode ser usado em lançamento, e o já reservado em lançamento não pode ser devolvido', async () => {
    const { ctx } = await montar();
    await solicitarDevolucao(ctx, { itens: [item('l11', '400')] });
    expect((await pedir(registrarLancamento(ctx, lanc(101, [['l11', '100']]))))?.message).toMatch(/Você tem 49,5 m em posse/);
    await registrarLancamento(ctx, lanc(101, [['l11', '40']]));
    expect((await pedir(solicitarDevolucao(ctx, { itens: [item('l11', '10')] })))?.message).toMatch(/Você tem 9,5 m em posse/);
  });

  it('o que o servidor já tem aguardando aprovação também conta (não dá para pedir de novo o mesmo material)', async () => {
    const { ctx } = await montar(criarBootstrap({ devolucoes: [{
      id: 1, lote_id: 11, lote_codigo: 'LOTE-BOB-0001', item_id: 1, item_nome: 'Cabo óptico ASU 12F', unidade: 'metros', quantidade: 440, condicao: 'novo', observacao: null,
      status: 'pendente', solicitado_em: '2026-10-11T10:00:00.000Z', revisado_em: null, motivo_negacao: null,
    }] }));
    expect((await pedir(solicitarDevolucao(ctx, { itens: [item('l11', '10')] })))?.message).toMatch(/Você tem 9,5 m em posse/);
  });

  it('descartar um pedido que ainda não saiu devolve o material para uso', async () => {
    const { ctx, posse } = await montar();
    const [op] = await solicitarDevolucao(ctx, { itens: [item('l11', '100')] });
    expect((await posse(11)).quantidade).toBe(349.5);
    await descartarOperacao(ctx, op.id);
    expect(await posse(11)).toMatchObject({ quantidade: 449.5 });
    expect((await posse(11)).emDevolucao).toBeUndefined();
  });

  it('sem dados baixados no aparelho, recusa com explicação', async () => {
    const { banco } = await criarBancoDeTeste();
    const ctx: ContextoComandos = { banco, usuarioId: 7, uuid: () => uuid(1), agora: () => T0 };
    expect((await pedir(solicitarDevolucao(ctx, { itens: [item('l11', '1')] })))?.message).toMatch(/Baixe os seus dados/);
  });
});
