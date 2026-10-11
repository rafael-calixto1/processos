import { ApiError, NetworkError } from '@/api/erros';
import { coalescerRascunho, enfileirar, obter, reenviar } from '@/db/outbox';
import { inserirFoto, lerRascunho, listarFotos, obterFoto, salvarRascunho } from '@/db/trabalho';
import { rascunhoVazio } from '@/domain/etapas';
import { DIAS_MAX_OPERACAO } from '@/domain/operacoes';
import { criarApiFalsa } from '@/testing/apiFalsa';
import { criarBancoDeTeste } from '@/testing/bancoNode';
import { novaFinalizar, novaFoto, novaIniciar, novoLancamento, novoRascunhoOp, uuid } from '@/testing/operacoes';
import { classificarErro, MotorOutbox, type PortaArquivos } from '../outbox';

const T0 = Date.parse('2026-10-11T14:00:00Z');
const DIA = 86_400_000;

const montar = async (comportamentos: Parameters<typeof criarApiFalsa>[0] = {}, opcoes: { usuarioId?: number; arquivos?: PortaArquivos; agora?: { v: number } } = {}) => {
  const { banco, db } = await criarBancoDeTeste();
  const falsa = criarApiFalsa(comportamentos);
  const relogio = opcoes.agora ?? { v: T0 };
  const motor = new MotorOutbox({
    banco, api: falsa.api, usuarioId: opcoes.usuarioId ?? 7, arquivos: opcoes.arquivos, agora: () => relogio.v, aleatorio: () => 1, backoffBaseMs: 5000, backoffTetoMs: 60_000,
  });
  return { banco, db, motor, relogio, ...falsa };
};
const arquivosFalsos = (existentes: string[] = []) => {
  const apagados: string[] = [];
  const porta: PortaArquivos = { existe: async (u) => existentes.includes(u), apagar: async (u) => { apagados.push(u); } };
  return { porta, apagados };
};
const estados = async (banco: Awaited<ReturnType<typeof criarBancoDeTeste>>['banco']) =>
  (await banco.all<{ id: number; tipo: string; estado: string }>('SELECT id, tipo, estado FROM outbox ORDER BY id')).map((r) => `${r.tipo}:${r.estado}`);

describe('ordem causal', () => {
  it('iniciar → lançamentos e fotos → finalizar, mesmo que a OS tenha sido preenchida em outra ordem', async () => {
    const { banco, motor, ordem } = await montar();
    const ini = await enfileirar(banco, novaIniciar(102));
    const lanc = await enfileirar(banco, novoLancamento(102, undefined, { depende_de: [ini.id] }));
    const foto = await enfileirar(banco, novaFoto(102, { depende_de: [ini.id] }));
    await enfileirar(banco, novaFinalizar(102, { depende_de: [ini.id, lanc.id, foto.id] }));
    const r = await motor.executar();
    expect(ordem()).toEqual(['iniciarOS', 'lancar', 'enviarFoto', 'finalizar']);
    expect(r).toMatchObject({ enviadas: 4, atencao: 0, semConexao: false, sessaoPerdida: false });
    expect(await estados(banco)).toEqual(['iniciar:ok', 'lancamento:ok', 'foto:ok', 'finalizar:ok']);
  });

  it('finalizar NÃO roda enquanto uma anterior da OS não estiver ok (falha passageira ou atenção)', async () => {
    const { banco, motor, ordem, definir } = await montar();
    const lanc = await enfileirar(banco, novoLancamento(102));
    const foto = await enfileirar(banco, novaFoto(102));
    await enfileirar(banco, novaFinalizar(102, { depende_de: [lanc.id, foto.id] }));
    definir('lancar', () => new ApiError(400, 'Quantidade maior que a posse do técnico neste lote (50)'));
    await motor.executar();
    expect(ordem()).toEqual(['lancar', 'enviarFoto']); // a foto segue (não depende do lançamento); finalizar espera
    expect(await estados(banco)).toEqual(['lancamento:atencao', 'foto:ok', 'finalizar:pendente']);
    await motor.executar();
    expect(ordem()).toEqual(['lancar', 'enviarFoto']); // nada é reenviado sozinho
  });

  it('uma OS com problema não trava as outras', async () => {
    const { banco, motor, ordem, definir } = await montar();
    await enfileirar(banco, novoLancamento(102));
    await enfileirar(banco, novoLancamento(103));
    definir('lancar', (a) => ((a[0] as number) === 102 ? new ApiError(409, 'OS encerrada: não aceita novos lançamentos') : { id: 2, descricao: 'x', trecho: null, quantidade: 1, materiais: [] }));
    await motor.executar();
    expect(ordem()).toEqual(['lancar', 'lancar']);
    expect(await estados(banco)).toEqual(['lancamento:atencao', 'lancamento:ok']);
  });

  it('só envia o trabalho do técnico logado', async () => {
    const { banco, motor, ordem } = await montar({}, { usuarioId: 7 });
    await enfileirar(banco, novoLancamento(102, undefined, { usuario_id: 8 }));
    await motor.executar();
    expect(ordem()).toEqual([]);
    expect(await estados(banco)).toEqual(['lancamento:pendente']);
  });
});

describe('operação congelada: o mesmo corpo e a mesma chave em todo reenvio', () => {
  it('reenvio depois de falha passageira repete exatamente os mesmos argumentos (inclusive a Idempotency-Key)', async () => {
    const { banco, motor, relogio, chamadas, definir } = await montar();
    const lanc = await enfileirar(banco, novoLancamento(102, [{ lote_id: 11, quantidade: 350.5 }], { chave: 'chave-fixa-0001' }));
    definir('lancar', (_a, n) => (n === 1 ? new NetworkError() : { id: 5, descricao: 'x', trecho: null, quantidade: 1, materiais: [] }));
    await motor.executar();
    relogio.v += 60_000;
    await motor.executar();
    expect(chamadas).toHaveLength(2);
    expect(chamadas[1].args).toEqual(chamadas[0].args);
    expect(chamadas[0].args).toEqual([102, (lanc as Extract<typeof lanc, { tipo: 'lancamento' }>).payload.corpo, 'chave-fixa-0001']);
  });

  it('nada mais vai ao servidor além do corpo congelado (a parte de exibição fica no aparelho)', async () => {
    const { banco, motor, chamadas } = await montar();
    await enfileirar(banco, novoLancamento(102));
    await motor.executar();
    const corpo = chamadas[0].args[1] as Record<string, unknown>;
    expect(Object.keys(corpo).sort()).toEqual(['descricao', 'materiais', 'trecho']);
  });
});

describe('falhas passageiras e backoff', () => {
  it('sem rede: a rodada para na primeira operação (não tenta as outras) e nada é perdido', async () => {
    const { banco, motor, chamadas } = await montar({ lancar: () => new NetworkError() });
    await enfileirar(banco, novoLancamento(102));
    await enfileirar(banco, novoLancamento(103));
    const r = await motor.executar();
    expect(chamadas).toHaveLength(1);
    expect(r).toMatchObject({ enviadas: 0, atencao: 0, semConexao: true });
    expect(await estados(banco)).toEqual(['lancamento:pendente', 'lancamento:pendente']);
    expect(r.proximaTentativaEm).toBe(T0 + 5000);
  });

  it('espera cresce em dobro a cada tentativa, até o teto, e só volta na hora marcada', async () => {
    const { banco, motor, relogio, chamadas } = await montar({ lancar: () => new ApiError(503, 'Serviço indisponível') });
    const op = await enfileirar(banco, novoLancamento(102));
    const esperas: number[] = [];
    for (let i = 0; i < 6; i++) {
      await motor.executar();
      const atual = (await obter(banco, op.id))!;
      esperas.push(atual.proxima_tentativa - relogio.v);
      await motor.executar(); // ainda não chegou a hora: não chama de novo
      relogio.v = atual.proxima_tentativa;
    }
    expect(esperas).toEqual([5000, 10_000, 20_000, 40_000, 60_000, 60_000]);
    expect(chamadas).toHaveLength(6);
  });

  it('o jitter fica entre 50% e 100% da espera', async () => {
    const { motor } = await montar();
    const m2 = new MotorOutbox({ banco: (motor as never as { p: { banco: never } }).p.banco, api: criarApiFalsa().api, usuarioId: 7, aleatorio: () => 0, backoffBaseMs: 1000, backoffTetoMs: 60_000 });
    expect(m2.backoff(3)).toBe(2000); // 4000 × 0,5
    expect(motor.backoff(3)).toBe(20_000); // 20000 × 1
  });

  it('429 respeita o Retry-After do servidor quando ele pede mais que o backoff', async () => {
    const { banco, motor, relogio } = await montar({ lancar: () => new ApiError(429, 'Muitas tentativas', { retryAfter: 120 }) });
    const op = await enfileirar(banco, novoLancamento(102));
    await motor.executar();
    expect((await obter(banco, op.id))!.proxima_tentativa).toBe(relogio.v + 120_000);
  });

  it('409 "operação ainda em andamento" (reenvio que chegou antes do fim do primeiro) é passageiro; outro 409 pede atenção', async () => {
    expect(classificarErro(new ApiError(409, 'Esta operação ainda está em andamento. Tente novamente em instantes')).tipo).toBe('passageiro');
    expect(classificarErro(new ApiError(409, 'OS encerrada: não aceita novos lançamentos')).tipo).toBe('atencao');
  });

  it.each([[500], [502], [503], [504], [408]])('%i é passageiro', (status) => {
    expect(classificarErro(new ApiError(status, 'x')).tipo).toBe('passageiro');
  });
  it.each([[400], [403], [404], [409], [413], [422]])('%i é recusa por regra: requer atenção', (status) => {
    expect(classificarErro(new ApiError(status, 'x')).tipo).toBe('atencao');
  });

  it('erro inesperado do próprio app tenta de novo e só depois de várias vezes pede atenção — nunca some', async () => {
    const { banco, motor, relogio } = await montar({ lancar: () => new TypeError('algo quebrou') });
    const op = await enfileirar(banco, novoLancamento(102));
    for (let i = 0; i < 8; i++) { await motor.executar(); relogio.v += 3_600_000; }
    expect((await obter(banco, op.id))).toMatchObject({ estado: 'atencao', erro: { mensagem: expect.stringContaining('algo quebrou') } });
  });
});

describe('ação explícita ignora a espera do backoff', () => {
  it('reconexão / "Sincronizar agora" tentam na hora; o reenvio automático continua respeitando a espera', async () => {
    const { banco, motor, chamadas, definir } = await montar({ lancar: () => new NetworkError() });
    await enfileirar(banco, novoLancamento(102));
    await motor.executar();
    expect(chamadas).toHaveLength(1);
    definir('lancar', () => ({ id: 1, descricao: 'x', trecho: null, quantidade: 1, materiais: [] }));
    await motor.executar();                          // automático, ainda dentro da espera: não tenta
    expect(chamadas).toHaveLength(1);
    const r = await motor.executar({ ignorarEspera: true });
    expect(chamadas).toHaveLength(2);
    expect(r.enviadas).toBe(1);
  });
});

describe('erro de regra → requer atenção, com a mensagem do servidor', () => {
  it('guarda a mensagem e a lista de problemas da finalização, e não reenvia sozinha', async () => {
    const detalhes = [{ campo: 'descricao', mensagem: 'Descrição muito curta' }, { campo: 'checklist', mensagem: 'Responda o item do checklist: Metros de fibra lançados?' }];
    const { banco, motor, chamadas } = await montar({ finalizar: () => new ApiError(400, 'A OS não pode ser finalizada: Descrição muito curta (e mais 1 problema(s))', { detalhes }) });
    const op = await enfileirar(banco, novaFinalizar(102));
    const r = await motor.executar();
    expect(r.atencao).toBe(1);
    expect(await obter(banco, op.id)).toMatchObject({ estado: 'atencao', erro: { status: 400, mensagem: expect.stringContaining('Descrição muito curta'), detalhes } });
    await motor.executar();
    expect(chamadas).toHaveLength(1);
  });

  it('depois de o técnico corrigir (reenviar), a operação volta à fila e sai', async () => {
    const { banco, motor, chamadas, definir } = await montar({ lancar: () => new ApiError(400, 'Este lote não está em posse do técnico/equipe da OS') });
    const op = await enfileirar(banco, novoLancamento(102));
    await motor.executar();
    definir('lancar', () => ({ id: 9, descricao: 'x', trecho: null, quantidade: 1, materiais: [] }));
    await reenviar(banco, op.id, T0);
    await motor.executar();
    expect(chamadas).toHaveLength(2);
    expect((await obter(banco, op.id))?.estado).toBe('ok');
  });
});

describe('sessão (401 / login recusado)', () => {
  it('pausa tudo, preserva a operação e retoma quando o técnico entra de novo', async () => {
    const { banco, motor, ordem, definir } = await montar({ lancar: () => new ApiError(401, 'Sua sessão expirou. Entre novamente.', { code: 'sessao_expirada' }) });
    await enfileirar(banco, novoLancamento(102));
    await enfileirar(banco, novoLancamento(103));
    const r = await motor.executar();
    expect(r.sessaoPerdida).toBe(true);
    expect(ordem()).toEqual(['lancar']); // parou: não insiste com as outras
    expect(await estados(banco)).toEqual(['lancamento:pendente', 'lancamento:pendente']);
    definir('lancar', () => ({ id: 1, descricao: 'x', trecho: null, quantidade: 1, materiais: [] }));
    const depois = await motor.executar();
    expect(depois).toMatchObject({ enviadas: 2, sessaoPerdida: false });
  });
});

describe('o app morre no meio de um envio', () => {
  it('no reinício a operação em "enviando" é reenviada com a MESMA chave', async () => {
    const { banco, db, chamadas } = await montar();
    const op = await enfileirar(banco, novoLancamento(102, undefined, { chave: 'chave-fixa-0002' }));
    db.prepare("UPDATE outbox SET estado = 'enviando', tentativas = 1 WHERE id = ?").run(op.id); // o app morreu aqui
    const apiNova = criarApiFalsa();
    const motorNovo = new MotorOutbox({ banco, api: apiNova.api, usuarioId: 7, agora: () => T0 });
    expect(await motorNovo.executar()).toMatchObject({ enviadas: 0 }); // preso em "enviando": ainda não é tentada
    expect(await motorNovo.recuperar()).toBe(1);
    await motorNovo.executar();
    expect(apiNova.chamadas[0].args[2]).toBe('chave-fixa-0002');
    expect(chamadas).toHaveLength(0);
    expect((await obter(banco, op.id))?.estado).toBe('ok');
  });

  it('servidor idempotente: resposta perdida + reenvio NÃO duplica a baixa', async () => {
    // Servidor de mentira com o contrato real: a mesma Idempotency-Key devolve a mesma resposta sem baixar de novo
    const baixas: number[] = []; const guardadas = new Map<string, unknown>(); let perderResposta = true;
    const lancar = async (a: unknown[]) => {
      const chave = a[2] as string;
      if (guardadas.has(chave)) return { ...(guardadas.get(chave) as object), repetida: true };
      baixas.push(1);
      const resp = { id: 77, descricao: 'x', trecho: null, quantidade: 1, materiais: [] };
      guardadas.set(chave, resp);
      if (perderResposta) { perderResposta = false; throw new NetworkError(); } // baixou, mas a resposta não chegou
      return resp;
    };
    const { banco, motor, relogio } = await montar({ lancar });
    await enfileirar(banco, novoLancamento(102));
    await motor.executar();            // 1ª tentativa: baixou e perdeu a resposta
    relogio.v += 60_000;
    await motor.executar();            // 2ª: mesma chave → replay
    expect(baixas).toHaveLength(1);
    expect(await estados(banco)).toEqual(['lancamento:ok']);
  });
});

describe('operação velha (chaves de idempotência expiram em 60 dias)', () => {
  const velha = (dias: number) => ({ ...novoLancamento(102) });
  it(`mais de ${DIAS_MAX_OPERACAO} dias vai para atenção sem ser enviada às cegas; "enviar mesmo assim" libera`, async () => {
    const { banco, motor, relogio, chamadas } = await montar();
    const op = await enfileirar(banco, velha(15), T0);
    relogio.v = T0 + 15 * DIA;
    await motor.executar();
    expect(chamadas).toHaveLength(0);
    expect(await obter(banco, op.id)).toMatchObject({ estado: 'atencao', erro: { status: null, mensagem: expect.stringContaining('14 dias') } });
    await reenviar(banco, op.id, relogio.v, { forcar: true });
    await motor.executar();
    expect(chamadas).toHaveLength(1);
    expect((await obter(banco, op.id))?.estado).toBe('ok');
  });
  it('exatamente 14 dias ainda é enviada normalmente', async () => {
    const { banco, motor, relogio, chamadas } = await montar();
    await enfileirar(banco, velha(14), T0);
    relogio.v = T0 + 14 * DIA;
    await motor.executar();
    expect(chamadas).toHaveLength(1);
  });
  it('depois de 50 dias nem forçando: o risco de baixa duplicada é real', async () => {
    const { banco, motor, relogio, chamadas } = await montar();
    const op = await enfileirar(banco, velha(51), T0);
    await reenviar(banco, op.id, T0).catch(() => undefined);
    await banco.run("UPDATE outbox SET forcada = 1 WHERE id = ?", [op.id]);
    relogio.v = T0 + 51 * DIA;
    await motor.executar();
    expect(chamadas).toHaveLength(0);
    expect(await obter(banco, op.id)).toMatchObject({ estado: 'atencao', erro: { mensagem: expect.stringContaining('50 dias') } });
  });
  it('o backup do rascunho não tem essa regra (é só uma cópia)', async () => {
    const { banco, motor, relogio, ordem } = await montar();
    await enfileirar(banco, novoRascunhoOp(102), T0);
    relogio.v = T0 + 30 * DIA;
    await motor.executar();
    expect(ordem()).toEqual(['salvarRascunho']);
  });
});

describe('backup do rascunho', () => {
  it('manda só a versão mais nova, marcada como versão 2 / origem mobile', async () => {
    const { banco, motor, chamadas } = await montar();
    await coalescerRascunho(banco, novoRascunhoOp(102, { descricao: 'v1' }), T0);
    await coalescerRascunho(banco, novoRascunhoOp(102, { descricao: 'v2' }), T0 + 1);
    await motor.executar();
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].args).toEqual([102, { versao: 2, origem: 'mobile', descricao: 'v2' }]);
  });
  it('se o servidor recusa (OS já encerrada...), NÃO vira atenção: é só uma cópia e o rascunho continua no aparelho', async () => {
    const { banco, motor } = await montar({ salvarRascunho: () => new ApiError(409, 'OS encerrada é somente leitura') });
    await salvarRascunho(banco, 7, 102, { ...rascunhoVazio(), descricao: 'texto importante' });
    await coalescerRascunho(banco, novoRascunhoOp(102), T0);
    const r = await motor.executar();
    expect(r.atencao).toBe(0);
    expect(await estados(banco)).toEqual(['rascunho:ok']);
    expect((await lerRascunho(banco, 102))?.descricao).toBe('texto importante');
  });
});

describe('fotos', () => {
  const comFoto = async (extra: Parameters<typeof montar>[1] = {}) => {
    const m = await montar({}, extra);
    const foto = novaFoto(102);
    const f = foto as Extract<typeof foto, { tipo: 'foto' }>;
    await inserirFoto(m.banco, { client_uuid: f.client_uuid, usuario_id: 7, os_id: 102, arquivo: f.payload.arquivo, mime: 'image/jpeg', tamanho: 100, tirada_em: f.payload.campos.tirada_em, lat: null, lng: null, legenda: null, criado_em: '2026-10-11T14:00:00.000Z' });
    const op = await enfileirar(m.banco, foto);
    return { ...m, f, op };
  };

  it('envia o arquivo com client_uuid e guarda o id do servidor; o arquivo local fica até a OS ser finalizada', async () => {
    const arq = arquivosFalsos();
    const m = await comFoto({ arquivos: undefined });
    const motor = new MotorOutbox({ banco: m.banco, api: m.api, usuarioId: 7, agora: () => T0, arquivos: { existe: async () => true, apagar: arq.porta.apagar } });
    await motor.executar();
    const [osId, arquivo, campos] = m.chamadas[0].args as [number, { uri: string; nome: string; mime: string }, Record<string, string>];
    expect(osId).toBe(102);
    expect(arquivo).toEqual({ uri: m.f.payload.arquivo, nome: `${m.f.client_uuid}.jpg`, mime: 'image/jpeg' });
    expect(campos).toEqual({ client_uuid: m.f.client_uuid, tirada_em: '2026-10-11T14:05:00.000Z' });
    expect((await obterFoto(m.banco, m.f.client_uuid))?.servidor_id).toBe(901);
    expect(arq.apagados).toEqual([]); // confirmou a foto, mas a OS ainda não foi finalizada
    expect((await obterFoto(m.banco, m.f.client_uuid))?.arquivo).not.toBeNull();
  });

  it('foto que sumiu do aparelho vira atenção com mensagem clara (não tenta enviar nada)', async () => {
    const m = await comFoto({ arquivos: arquivosFalsos([]).porta });
    await m.motor.executar();
    expect(m.chamadas).toHaveLength(0);
    expect(await obter(m.banco, m.op.id)).toMatchObject({ estado: 'atencao', erro: { mensagem: expect.stringContaining('Remova a foto') } });
  });

  it('depois de finalizar, os arquivos já enviados são apagados do aparelho, o rascunho local some e o backup que ainda esperava é cancelado', async () => {
    const arq = arquivosFalsos();
    const m = await comFoto();
    const motor = new MotorOutbox({ banco: m.banco, api: m.api, usuarioId: 7, agora: () => T0, arquivos: { existe: async () => true, apagar: arq.porta.apagar } });
    await salvarRascunho(m.banco, 7, 102, { ...rascunhoVazio(), descricao: 'rascunho' });
    await enfileirar(m.banco, novaFinalizar(102, { depende_de: [m.op.id] }));
    await coalescerRascunho(m.banco, novoRascunhoOp(102), T0); // entra na fila DEPOIS do finalizar: ainda esperando quando ele terminar
    await motor.executar();
    expect(m.ordem()).toEqual(['enviarFoto', 'finalizar']); // o backup foi cancelado, nunca chegou a sair
    expect(await estados(m.banco)).toEqual(['foto:ok', 'finalizar:ok']);
    expect(arq.apagados).toEqual([m.f.payload.arquivo]);
    expect((await obterFoto(m.banco, m.f.client_uuid))).toMatchObject({ arquivo: null, servidor_id: 901 });
    expect(await lerRascunho(m.banco, 102)).toBeNull();
  });

  it('nunca apaga o arquivo de uma foto que o servidor ainda não confirmou, nem quando a OS é finalizada', async () => {
    const arq = arquivosFalsos();
    const m = await comFoto();
    const motor = new MotorOutbox({ banco: m.banco, api: m.api, usuarioId: 7, agora: () => T0, arquivos: { existe: async () => true, apagar: arq.porta.apagar } });
    await inserirFoto(m.banco, { client_uuid: uuid(8001), usuario_id: 7, os_id: 102, arquivo: 'file:///fotos/nao-enviada.jpg', mime: 'image/jpeg', tamanho: 10, tirada_em: '2026-10-11T14:06:00.000Z', lat: null, lng: null, legenda: null, criado_em: '2026-10-11T14:06:00.000Z' });
    await enfileirar(m.banco, novaFinalizar(102, { depende_de: [m.op.id] }));
    await motor.executar();
    expect(arq.apagados).toEqual([m.f.payload.arquivo]); // só a que o servidor confirmou
    expect((await obterFoto(m.banco, uuid(8001)))?.arquivo).toBe('file:///fotos/nao-enviada.jpg');
  });

  it('remover foto já enviada: apaga no servidor pelo id guardado; 404 conta como feito; some do aparelho', async () => {
    const arq = arquivosFalsos();
    const m = await comFoto();
    const motor = new MotorOutbox({ banco: m.banco, api: m.api, usuarioId: 7, agora: () => T0, arquivos: { existe: async () => true, apagar: arq.porta.apagar } });
    await motor.executar();
    m.definir('removerFoto', () => new ApiError(404, 'Foto não encontrada'));
    await enfileirar(m.banco, { usuario_id: 7, os_id: 102, os_numero: 2, os_cliente: 'c', depende_de: [m.op.id], client_uuid: uuid(9000), chave: 'chave-remover-1', tipo: 'remover_foto', payload: { foto_client_uuid: m.f.client_uuid } });
    await motor.executar();
    expect(m.chamadas.filter((c) => c.metodo === 'removerFoto')[0].args).toEqual([102, 901]);
    expect(await obterFoto(m.banco, m.f.client_uuid)).toBeNull();
    expect(await listarFotos(m.banco, 102)).toEqual([]);
    expect(arq.apagados).toEqual([m.f.payload.arquivo]);
  });
});

describe('uma rodada de cada vez', () => {
  it('só UMA operação vai ao servidor por vez, mesmo com várias chamadas de executar ao mesmo tempo', async () => {
    let emVoo = 0; let maximo = 0;
    const lenta = async () => { emVoo++; maximo = Math.max(maximo, emVoo); await new Promise((r) => setTimeout(r, 10)); emVoo--; return { id: 1, descricao: 'x', trecho: null, quantidade: 1, materiais: [] }; };
    const { banco, motor, chamadas } = await montar({ lancar: lenta });
    await enfileirar(banco, novoLancamento(102));
    await enfileirar(banco, novoLancamento(103));
    await enfileirar(banco, novoLancamento(104));
    await Promise.all([motor.executar(), motor.executar(), motor.executar()]);
    expect(chamadas).toHaveLength(3);
    expect(maximo).toBe(1);
  });
  it('chamadas simultâneas não enviam a mesma operação duas vezes', async () => {
    const { banco, motor, chamadas } = await montar({ lancar: async () => { await new Promise((r) => setTimeout(r, 15)); return { id: 1, descricao: 'x', trecho: null, quantidade: 1, materiais: [] }; } });
    await enfileirar(banco, novoLancamento(102));
    const [a, b, c] = await Promise.all([motor.executar(), motor.executar(), motor.executar()]);
    expect(chamadas).toHaveLength(1);
    expect(a.enviadas + b.enviadas + c.enviadas).toBeGreaterThanOrEqual(1);
    expect(await estados(banco)).toEqual(['lancamento:ok']);
  });
  it('o que entra na fila no meio da rodada é pego na volta seguinte', async () => {
    let motorRef: MotorOutbox; let banco!: Awaited<ReturnType<typeof criarBancoDeTeste>>['banco'];
    const m = await montar({
      lancar: async (_a, n) => {
        if (n === 1) { await enfileirar(banco, novoLancamento(103)); void motorRef.executar(); }
        return { id: n, descricao: 'x', trecho: null, quantidade: 1, materiais: [] };
      },
    });
    banco = m.banco; motorRef = m.motor;
    await enfileirar(banco, novoLancamento(102));
    await m.motor.executar();
    expect(await estados(banco)).toEqual(['lancamento:ok', 'lancamento:ok']);
  });
});
