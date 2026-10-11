import { criarBancoDeTeste } from '@/testing/bancoNode';
import { novaFinalizar, novaFoto, novaIniciar, novoLancamento, novoRascunhoOp, uuid } from '@/testing/operacoes';
import {
  cancelar, cancelarRascunhosPendentes, coalescerRascunho, concluirOk, contagens, enfileirar, listarEmFila, listarPorEstado, marcarAtencao, marcarNoRetrato,
  obter, pendenciasDeOutros, podarConfirmadas, proximaHora, proximaPronta, reagendar, recuperarEnviando, reenviar, reservar,
} from '../outbox';
import { salvarRascunho } from '../trabalho';
import { rascunhoVazio } from '@/domain/etapas';

const T0 = Date.parse('2026-10-11T14:00:00Z');

describe('enfileirar', () => {
  it('guarda a operação congelada (corpo, chave, dependências) e a devolve pendente', async () => {
    const { banco } = await criarBancoDeTeste();
    const n = novoLancamento(102, [{ lote_id: 11, quantidade: 350.5 }], { chave: 'chave-fixa-0001' });
    const op = await enfileirar(banco, n, T0);
    expect(op).toMatchObject({ id: 1, usuario_id: 7, os_id: 102, tipo: 'lancamento', estado: 'pendente', tentativas: 0, proxima_tentativa: 0, ok_em: null, no_retrato: false, resposta: null, erro: null, chave: 'chave-fixa-0001', os_numero: 2 });
    expect(op.payload).toEqual(n.payload);
    expect(op.criado_em).toBe('2026-10-11T14:00:00.000Z');
  });
  it('o mesmo client_uuid nunca entra duas vezes (clique repetido não duplica a ação)', async () => {
    const { banco } = await criarBancoDeTeste();
    const n = novaIniciar(102);
    await enfileirar(banco, n);
    await expect(enfileirar(banco, n)).rejects.toThrow(/UNIQUE/);
    expect(await banco.all('SELECT id FROM outbox')).toHaveLength(1);
  });
  it('recusa tipo desconhecido (o banco confere)', async () => {
    const { banco } = await criarBancoDeTeste();
    await expect(enfileirar(banco, { ...novaIniciar(102), tipo: 'coisa' } as never)).rejects.toThrow(/CHECK/);
  });
});

describe('proximaPronta', () => {
  it('entrega pela ordem em que as ações foram feitas', async () => {
    const { banco } = await criarBancoDeTeste();
    const a = await enfileirar(banco, novaIniciar(102));
    await enfileirar(banco, novoLancamento(102));
    expect((await proximaPronta(banco, 7, T0))?.id).toBe(a.id);
  });
  it('respeita a hora da próxima tentativa (backoff) e depois libera', async () => {
    const { banco } = await criarBancoDeTeste();
    const a = await enfileirar(banco, novaIniciar(102));
    await reservar(banco, a.id, T0);
    await reagendar(banco, a.id, T0 + 5000, T0);
    expect(await proximaPronta(banco, 7, T0 + 4999)).toBeNull();
    expect((await proximaPronta(banco, 7, T0 + 5000))?.id).toBe(a.id);
    expect(await proximaHora(banco, 7, T0)).toBe(T0 + 5000);
    expect(await proximaHora(banco, 7, T0 + 5000)).toBeNull(); // já chegou a hora: não há mais espera pela frente
  });
  it('só entrega operações do técnico logado: o token de um não envia o trabalho de outro', async () => {
    const { banco } = await criarBancoDeTeste();
    await enfileirar(banco, novaIniciar(102, { usuario_id: 8 }));
    expect(await proximaPronta(banco, 7, T0)).toBeNull();
    expect((await proximaPronta(banco, 8, T0))?.usuario_id).toBe(8);
  });
  it('espera as dependências: só sai depois que a anterior estiver "ok"', async () => {
    const { banco } = await criarBancoDeTeste();
    const ini = await enfileirar(banco, novaIniciar(102));
    const lanc = await enfileirar(banco, novoLancamento(102, undefined, { depende_de: [ini.id] }));
    await reservar(banco, ini.id, T0);
    expect(await proximaPronta(banco, 7, T0)).toBeNull(); // iniciar em envio: o lançamento espera
    await concluirOk(banco, ini.id, { status: 'em_andamento' }, T0 + 1);
    expect((await proximaPronta(banco, 7, T0 + 1))?.id).toBe(lanc.id);
  });
  it('dependência em "atenção" bloqueia quem depende dela, mas não as outras OS', async () => {
    const { banco } = await criarBancoDeTeste();
    const ini = await enfileirar(banco, novaIniciar(102));
    await enfileirar(banco, novoLancamento(102, undefined, { depende_de: [ini.id] }));
    const outra = await enfileirar(banco, novaIniciar(103));
    await reservar(banco, ini.id, T0);
    await marcarAtencao(banco, ini.id, { status: 409, mensagem: 'OS encerrada: não pode ser iniciada' }, T0);
    expect((await proximaPronta(banco, 7, T0))?.id).toBe(outra.id);
    await reservar(banco, outra.id, T0); await concluirOk(banco, outra.id, {}, T0);
    expect(await proximaPronta(banco, 7, T0)).toBeNull(); // o lançamento segue bloqueado
  });
  it('dependência cancelada pelo técnico deixa de bloquear', async () => {
    const { banco } = await criarBancoDeTeste();
    const lanc = await enfileirar(banco, novoLancamento(102));
    const fin = await enfileirar(banco, novaFinalizar(102, { depende_de: [lanc.id] }));
    await reservar(banco, lanc.id, T0); await concluirOk(banco, lanc.id, {}, T0);
    const foto = await enfileirar(banco, novaFoto(102));
    await cancelar(banco, foto.id);
    const fin2 = await enfileirar(banco, novaFinalizar(102, { depende_de: [lanc.id, foto.id] }));
    await cancelar(banco, fin.id);
    expect((await proximaPronta(banco, 7, T0))?.id).toBe(fin2.id);
  });
});

describe('ciclo de vida da operação', () => {
  it('reservar é atômico: a segunda reserva da mesma operação falha e as tentativas contam', async () => {
    const { banco } = await criarBancoDeTeste();
    const a = await enfileirar(banco, novaIniciar(102));
    expect(await reservar(banco, a.id, T0)).toBe(true);
    expect(await reservar(banco, a.id, T0)).toBe(false);
    expect(await obter(banco, a.id)).toMatchObject({ estado: 'enviando', tentativas: 1 });
  });
  it('ok guarda a resposta do servidor e o instante da confirmação', async () => {
    const { banco } = await criarBancoDeTeste();
    const a = await enfileirar(banco, novoLancamento(102));
    await reservar(banco, a.id, T0);
    await concluirOk(banco, a.id, { id: 55, materiais: [{ movimentacao_id: 9 }] }, T0 + 10);
    expect(await obter(banco, a.id)).toMatchObject({ estado: 'ok', ok_em: T0 + 10, resposta: { id: 55, materiais: [{ movimentacao_id: 9 }] }, erro: null });
  });
  it('atenção guarda a mensagem e os detalhes do servidor; reenviar volta a pendente e limpa o erro', async () => {
    const { banco } = await criarBancoDeTeste();
    const a = await enfileirar(banco, novaFinalizar(102));
    await reservar(banco, a.id, T0);
    const erro = { status: 400, mensagem: 'A OS não pode ser finalizada: Descrição muito curta', detalhes: [{ campo: 'descricao', mensagem: 'Descrição muito curta' }] };
    await marcarAtencao(banco, a.id, erro, T0);
    expect(await obter(banco, a.id)).toMatchObject({ estado: 'atencao', erro });
    expect(await reenviar(banco, a.id, T0 + 1)).toBe(true);
    expect(await obter(banco, a.id)).toMatchObject({ estado: 'pendente', tentativas: 0, erro: null });
    expect(await reenviar(banco, a.id, T0 + 2)).toBe(false); // só quem está em atenção pode ser reenviado
  });
  it('cancelar só apaga o que o servidor não confirmou e não está em envio', async () => {
    const { banco } = await criarBancoDeTeste();
    const pend = await enfileirar(banco, novoLancamento(102));
    const env = await enfileirar(banco, novoLancamento(102));
    const ok = await enfileirar(banco, novoLancamento(102));
    const aten = await enfileirar(banco, novoLancamento(102));
    await reservar(banco, env.id, T0);
    await reservar(banco, ok.id, T0); await concluirOk(banco, ok.id, {}, T0);
    await reservar(banco, aten.id, T0); await marcarAtencao(banco, aten.id, { status: 400, mensagem: 'x' }, T0);
    expect(await cancelar(banco, pend.id)).toBe(true);
    expect(await cancelar(banco, aten.id)).toBe(true);
    expect(await cancelar(banco, env.id)).toBe(false); // resultado incerto: não pode sumir
    expect(await cancelar(banco, ok.id)).toBe(false);
    expect((await banco.all<{ id: number }>('SELECT id FROM outbox ORDER BY id')).map((r) => r.id)).toEqual([env.id, ok.id]);
  });
  it('depois de o app morrer no meio de um envio, "enviando" volta a pendente para reenvio', async () => {
    const { banco } = await criarBancoDeTeste();
    const a = await enfileirar(banco, novoLancamento(102));
    await reservar(banco, a.id, T0);
    expect(await proximaPronta(banco, 7, T0 + 1)).toBeNull();
    expect(await recuperarEnviando(banco)).toBe(1);
    expect(await obter(banco, a.id)).toMatchObject({ estado: 'pendente', tentativas: 1 });
    expect((await proximaPronta(banco, 7, T0 + 1))?.id).toBe(a.id);
  });
});

describe('retrato do servidor', () => {
  it('só marca como "já no retrato" o que foi confirmado ANTES de o retrato começar a ser baixado', async () => {
    const { banco } = await criarBancoDeTeste();
    const antes = await enfileirar(banco, novoLancamento(102));
    const depois = await enfileirar(banco, novoLancamento(102));
    const pendente = await enfileirar(banco, novoLancamento(102));
    await reservar(banco, antes.id, T0); await concluirOk(banco, antes.id, {}, T0 + 100);
    await reservar(banco, depois.id, T0); await concluirOk(banco, depois.id, {}, T0 + 300);
    await marcarNoRetrato(banco, 7, T0 + 200); // o retrato começou em T0+200
    expect((await obter(banco, antes.id))?.no_retrato).toBe(true);
    expect((await obter(banco, depois.id))?.no_retrato).toBe(false); // confirmada durante o download: o retrato pode não tê-la
    expect((await obter(banco, pendente.id))?.no_retrato).toBe(false);
    expect((await listarEmFila(banco, 7)).map((o) => o.id)).toEqual([depois.id, pendente.id]);
  });
  it('confirmadas e já refletidas no retrato são podadas depois de um tempo', async () => {
    const { banco } = await criarBancoDeTeste();
    const a = await enfileirar(banco, novoLancamento(102));
    await reservar(banco, a.id, T0); await concluirOk(banco, a.id, {}, T0 + 1);
    expect(await podarConfirmadas(banco, 7, T0 + 1000)).toBe(0); // ainda não está no retrato
    await marcarNoRetrato(banco, 7, T0 + 2);
    expect(await podarConfirmadas(banco, 7, T0)).toBe(0); // recente demais
    expect(await podarConfirmadas(banco, 7, T0 + 1000)).toBe(1);
  });
});

describe('contadores', () => {
  it('contam pendências reais e ignoram confirmadas e o backup do rascunho', async () => {
    const { banco } = await criarBancoDeTeste();
    const a = await enfileirar(banco, novaIniciar(102));
    const b = await enfileirar(banco, novoLancamento(102));
    const c = await enfileirar(banco, novoLancamento(102));
    const d = await enfileirar(banco, novoLancamento(102));
    await enfileirar(banco, novoRascunhoOp(102));
    await reservar(banco, a.id, T0); await concluirOk(banco, a.id, {}, T0);
    await reservar(banco, b.id, T0);
    await reservar(banco, c.id, T0); await marcarAtencao(banco, c.id, { status: 400, mensagem: 'x' }, T0);
    expect(d.id).toBeGreaterThan(0);
    expect(await contagens(banco, 7)).toEqual({ pendentes: 1, enviando: 1, atencao: 1 });
    expect(await contagens(banco, 8)).toEqual({ pendentes: 0, enviando: 0, atencao: 0 });
  });
  it('pendências de outros técnicos incluem operações e rascunhos locais (para bloquear a troca de técnico)', async () => {
    const { banco } = await criarBancoDeTeste();
    expect(await pendenciasDeOutros(banco, 7)).toBe(0);
    await enfileirar(banco, novoLancamento(102, undefined, { usuario_id: 8 }));
    await enfileirar(banco, novoRascunhoOp(102, undefined, { usuario_id: 8 })); // backup não é pendência
    await salvarRascunho(banco, 8, 102, { ...rascunhoVazio(), descricao: 'metade escrita' });
    expect(await pendenciasDeOutros(banco, 7)).toBe(2);
    expect(await pendenciasDeOutros(banco, 8)).toBe(0);
  });
});

describe('backup do rascunho (coalescência)', () => {
  it('guarda só a versão mais nova enquanto a anterior ainda não saiu', async () => {
    const { banco } = await criarBancoDeTeste();
    const a = await coalescerRascunho(banco, novoRascunhoOp(102, { descricao: 'v1' }), T0);
    const b = await coalescerRascunho(banco, novoRascunhoOp(102, { descricao: 'v2' }), T0 + 1);
    const c = await coalescerRascunho(banco, novoRascunhoOp(102, { descricao: 'v3' }), T0 + 2);
    expect([b.id, c.id]).toEqual([a.id, a.id]);
    expect((await banco.all('SELECT id FROM outbox'))).toHaveLength(1);
    expect((await obter(banco, a.id))?.payload).toEqual({ corpo: { rascunho: { descricao: 'v3' } } });
  });
  it('não mexe numa versão que já está sendo enviada: a mais nova entra atrás', async () => {
    const { banco } = await criarBancoDeTeste();
    const a = await coalescerRascunho(banco, novoRascunhoOp(102, { descricao: 'v1' }), T0);
    await reservar(banco, a.id, T0);
    const b = await coalescerRascunho(banco, novoRascunhoOp(102, { descricao: 'v2' }), T0 + 1);
    expect(b.id).not.toBe(a.id);
    expect((await obter(banco, a.id))?.payload).toEqual({ corpo: { rascunho: { descricao: 'v1' } } });
  });
  it('cada OS tem o seu; finalizar cancela os pendentes da OS (o servidor apaga o rascunho ao finalizar)', async () => {
    const { banco } = await criarBancoDeTeste();
    await coalescerRascunho(banco, novoRascunhoOp(102));
    await coalescerRascunho(banco, novoRascunhoOp(103));
    expect(await cancelarRascunhosPendentes(banco, 7, 102)).toBe(1);
    expect((await listarPorEstado(banco, 7, 'pendente')).map((o) => o.os_id)).toEqual([103]);
  });
});

it('uuid de teste é válido para o servidor', () => {
  expect(uuid(1)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});
