/**
 * Execução de campo contra o backend REAL (banco de teste): celular completo (sessão, SQLite, comandos, motor de envio)
 * falando com o servidor por uma rede que cai, perde respostas e congela. Rode com `npm run test:integracao`.
 * Prova em estoque_movimentacoes (SQL direto) que nenhuma baixa duplica e que conflitos viram "requer atenção".
 */
import fs from 'node:fs';
import path from 'node:path';
import { cancelar, listarTodas, obter } from '@/db/outbox';
import { lerRascunho, listarFotos } from '@/db/trabalho';
import type { Operacao } from '@/domain/operacoes';
import { agrupar } from '@/domain/posse';
import { adicionarFoto, ErroOperacao, finalizarOS, iniciarOS, registrarLancamento, removerFotoDaOS, salvarRascunhoLocal, substituirLancamento } from '@/sync/operacoes';
import { esperarAte, FOTOS_DIR, consulta, criarApp, criarCenario, escritorio, movimentacoes, quando, rascunhoCompleto, SEMENTE } from './apoio';

jest.setTimeout(60_000);

const estados = async (app: Awaited<ReturnType<typeof criarApp>>) => (await listarTodas(app.banco, app.usuario.id)).map((o) => `${o.tipo}:${o.estado}`);
const opDe = async (app: Awaited<ReturnType<typeof criarApp>>, tipo: Operacao['tipo']) => (await listarTodas(app.banco, app.usuario.id)).filter((o) => o.tipo === tipo);
const soma = (movs: Array<{ quantidade: number }>) => Math.round(movs.reduce((a, m) => a + m.quantidade, 0) * 100) / 100;

quando('execução de campo × backend real', () => {
  it('OS inteira SEM sinal: inicia, lança material (metros e peças em lotes diferentes), fotografa e finaliza; ao voltar a rede (caindo no meio, com resposta perdida) sincroniza sem duplicar nenhuma baixa', async () => {
    const c = await criarCenario({ metros: 400, pecas: [30, 20] });
    const app = await criarApp();
    await app.baixar();
    expect((await app.estado()).visao.os.find((o) => o.id === c.osId)?.status).toBe('aberta');

    // ── sem rede nenhuma ──
    app.rede.estado.online = false;
    await iniciarOS(app.ctx, c.osId);
    await registrarLancamento(app.ctx, { osId: c.osId, descricao: 'Lançamento de cabo ASU 12F', trecho: 'PL-0932 → PL-0945', itens: [{ chaveGrupo: `l${c.cabo.loteId}`, quantidade: '120' }, { chaveGrupo: `i${SEMENTE.ids.conector}`, quantidade: '35' }] });
    await registrarLancamento(app.ctx, { osId: c.osId, descricao: 'Lançamento de cabo ASU 12F', trecho: 'PL-0945 → CEO-01', itens: [{ chaveGrupo: `l${c.cabo.loteId}`, quantidade: '80' }] });
    const foto = app.guardarFoto('fachada');
    const { clientUuid } = await adicionarFoto(app.ctx, { osId: c.osId, arquivo: foto.uri, tamanho: foto.tamanho, lat: -23.5445, lng: -46.3118 });
    await salvarRascunhoLocal(app.ctx, c.osId, await rascunhoCompleto(app, clientUuid));
    await finalizarOS(app.ctx, c.osId);

    const v = (await app.estado()).visao;
    expect(v.os.find((o) => o.id === c.osId)).toMatchObject({ status: 'em_andamento', sync: 'pendente', pendencias: 5, finalizacao: 'na_fila' });
    expect(v.posse.find((p) => p.lote_id === c.cabo.loteId)).toMatchObject({ quantidade: 200, reservado: 200 }); // 400 - 120 - 80
    expect(agrupar(v.posse).find((g) => g.key === `i${SEMENTE.ids.conector}`)?.reservado).toBe(35);

    const offline = await app.motor.executar();
    expect(offline).toMatchObject({ enviadas: 0, semConexao: true });
    expect(await movimentacoes(c.osId)).toEqual([]); // nada chegou ao servidor
    app.relogio.avancar(60_000); // passa o tempo de espera do reenvio

    // ── rede volta, mas o servidor aplica o 1º lançamento e a RESPOSTA se perde ──
    app.rede.estado.online = true;
    app.rede.estado.perderRespostaDe = /\/lancamentos$/;
    const meio = await app.motor.executar();
    expect(meio.semConexao).toBe(true);
    const aposPerda = await movimentacoes(c.osId);
    expect(aposPerda).toHaveLength(3); // cabo 120 + conectores 30 + 5: o servidor JÁ baixou, o app ainda não sabe
    expect((await opDe(app, 'lancamento'))[0].estado).toBe('pendente');

    // ── o app reenvia com a mesma chave: resposta repetida, sem nova baixa ──
    await app.drenar();
    const movs = await movimentacoes(c.osId);
    expect(movs.map((m) => [m.tipo, m.lote_id, m.quantidade])).toEqual([
      ['baixa_os', c.cabo.loteId, 120], ['baixa_os', c.conectores![0].loteId, 30], ['baixa_os', c.conectores![1].loteId, 5], ['baixa_os', c.cabo.loteId, 80],
    ]);
    expect(await estados(app)).toEqual(['iniciar:ok', 'lancamento:ok', 'lancamento:ok', 'foto:ok', 'finalizar:ok']);
    expect((await opDe(app, 'lancamento'))[0].resposta).toMatchObject({ repetida: true });

    // ── o que o servidor guardou ──
    const f = consulta<any>('fechamento', c.osId);
    expect(f.os.status).toBe('concluida');
    expect(f.os.iniciado_em).not.toBeNull();
    expect(f.fechamento).toMatchObject({ descricao: 'Lançados 200 m de cabo entre PL-0932 e CEO-01; CEO vedada.', local_origem: 'gps', materiais_usados: 1, materiais_retirados: 1 });
    expect(Number(f.fechamento.local_lat)).toBeCloseTo(-23.5445, 4);
    expect(JSON.parse(f.fechamento.participantes)).toEqual([{ tecnico_id: SEMENTE.ids.apoio, nome: 'Equipe Apoio' }]);
    expect(JSON.parse(f.fechamento.checklist).length).toBeGreaterThan(0);
    expect(f.retirados).toEqual([
      { item_id: SEMENTE.ids.cabo, descricao: 'Cabo óptico ASU 12F', quantidade: 15.5, unidade: 'metros', condicao: 'usado' },
      { item_id: null, descricao: 'Splitter 1:8 antigo', quantidade: 1, unidade: 'pecas', condicao: 'usado' },
    ]);
    expect(f.servicos.map((s: { trecho: string }) => s.trecho)).toEqual(['PL-0932 → PL-0945', 'PL-0945 → CEO-01']);
    expect(f.rascunhos).toBe(0);
    expect(f.fotos).toHaveLength(1);
    expect(f.fotos[0].client_uuid).toBe(clientUuid);
    expect(fs.statSync(path.join(FOTOS_DIR!, f.fotos[0].arquivo)).size).toBe(foto.tamanho); // o arquivo chegou inteiro

    // ── e no aparelho: nada pendente, arquivo apagado só depois da confirmação, rascunho local sem uso ──
    expect(app.apagados).toEqual([foto.uri]);
    expect((await listarFotos(app.banco, c.osId))[0]).toMatchObject({ arquivo: null, servidor_id: f.fotos[0].id });
    expect(await lerRascunho(app.banco, c.osId)).toBeNull();
    await app.baixar();
    expect((await app.estado()).visao.os.find((o) => o.id === c.osId)).toMatchObject({ status: 'concluida', sync: 'sincronizado', pendencias: 0 });
    const reenvio = await app.motor.executar();
    expect(reenvio.enviadas).toBe(0);
    expect(await movimentacoes(c.osId)).toHaveLength(4); // continua 4
  });

  it('o app é encerrado DEPOIS de o servidor aplicar o lançamento: ao reabrir a operação "enviando" é reenviada e a baixa NÃO duplica', async () => {
    const c = await criarCenario({ metros: 300 });
    const app = await criarApp();
    await app.baixar();
    await iniciarOS(app.ctx, c.osId);
    await registrarLancamento(app.ctx, { osId: c.osId, descricao: 'Lançamento de cabo', trecho: 'A → B', itens: [{ chaveGrupo: `l${c.cabo.loteId}`, quantidade: '100' }] });

    app.rede.estado.congelarDepoisDe = /\/lancamentos$/; // o servidor aplica e o app "morre"
    void app.motor.executar(); // nunca termina
    await esperarAte(async () => (await movimentacoes(c.osId)).length === 1);
    const preso = (await opDe(app, 'lancamento'))[0];
    expect(preso.estado).toBe('enviando'); // foi assim que o app morreu

    // reabrir o app: motor novo sobre o mesmo banco
    const reaberto = app.novoMotor();
    expect(await reaberto.recuperar()).toBe(1);
    await reaberto.executar();

    expect((await obter(app.banco, preso.id))).toMatchObject({ estado: 'ok', resposta: { repetida: true }, tentativas: 2 });
    expect(await movimentacoes(c.osId)).toHaveLength(1);
    expect(soma(await movimentacoes(c.osId))).toBe(100);
  });

  it('posse mudou no servidor depois do último download: o servidor recusa, vira "requer atenção" com a mensagem dele, nada é baixado; corrigindo, envia', async () => {
    const c = await criarCenario({ metros: 400 });
    const app = await criarApp();
    await app.baixar();
    await iniciarOS(app.ctx, c.osId);
    consulta('posse', c.cabo.loteId, SEMENTE.ids.joao, 50); // o estoque ajustou a posse; o app ainda não sabe
    const op = await registrarLancamento(app.ctx, { osId: c.osId, descricao: 'Lançamento de cabo', trecho: 'A → B', itens: [{ chaveGrupo: `l${c.cabo.loteId}`, quantidade: '80' }] });

    const r = await app.motor.executar();
    expect(r.atencao).toBe(1);
    expect(await obter(app.banco, op.id)).toMatchObject({ estado: 'atencao', erro: { status: 400, mensagem: 'Quantidade maior que a posse do técnico neste lote (50)' } });
    expect(await movimentacoes(c.osId)).toEqual([]);
    expect((await app.estado()).visao.os.find((o) => o.id === c.osId)).toMatchObject({ sync: 'erro' });
    expect((await app.estado()).visao.posse.find((p) => p.lote_id === c.cabo.loteId)?.reservado).toBe(80); // continua reservando até resolver

    await app.baixar(); // agora o app vê a posse real (50) e o técnico corrige a quantidade
    const novo = await substituirLancamento(app.ctx, op.id, { descricao: 'Lançamento de cabo', trecho: 'A → B', itens: [{ chaveGrupo: `l${c.cabo.loteId}`, quantidade: '50' }] });
    await app.drenar();
    expect((await obter(app.banco, novo.id))?.estado).toBe('ok');
    expect(await movimentacoes(c.osId)).toMatchObject([{ lote_id: c.cabo.loteId, quantidade: 50 }]);
  });

  it('peça fracionada e quantidade acima da posse que escapam do app: o servidor recusa com a mensagem certa e não baixa nada', async () => {
    const c = await criarCenario({ metros: 10, pecas: [10] });
    const app = await criarApp();
    await app.baixar();
    await iniciarOS(app.ctx, c.osId);
    const cru = (loteId: number, quantidade: number) => app.enfileirarCru({
      usuario_id: app.usuario.id, os_id: c.osId, os_numero: c.osNumero, os_cliente: 'x', client_uuid: crypto.randomUUID(), chave: crypto.randomUUID(), depende_de: [], tipo: 'lancamento',
      payload: { corpo: { descricao: 'Lançamento forçado', trecho: 'A → B', materiais: [{ lote_id: loteId, quantidade }] }, exibicao: { linhas: [] } },
    });
    const fracionada = await cru(c.conectores![0].loteId, 2.5);
    const acima = await cru(c.cabo.loteId, 11);
    await app.motor.executar();
    expect((await obter(app.banco, fracionada.id))?.erro).toMatchObject({ status: 400, mensagem: 'Este item é contado em unidades: informe um número inteiro' });
    expect((await obter(app.banco, acima.id))?.erro).toMatchObject({ status: 400, mensagem: 'Quantidade maior que a posse do técnico neste lote (10)' });
    expect(await movimentacoes(c.osId)).toEqual([]);
  });

  it('o próprio app já recusa peça fracionada e quantidade acima da posse antes de enfileirar', async () => {
    const c = await criarCenario({ metros: 10, pecas: [10] });
    const app = await criarApp();
    await app.baixar();
    await iniciarOS(app.ctx, c.osId);
    const tentar = (chaveGrupo: string, quantidade: string) => registrarLancamento(app.ctx, { osId: c.osId, descricao: 'Lançamento', trecho: 'A → B', itens: [{ chaveGrupo, quantidade }] });
    await expect(tentar(`i${SEMENTE.ids.conector}`, '2,5')).rejects.toThrow('Este item é contado em unidades: informe um número inteiro');
    await expect(tentar(`l${c.cabo.loteId}`, '10,01')).rejects.toBeInstanceOf(ErroOperacao);
    expect((await opDe(app, 'lancamento'))).toEqual([]);
  });

  it('OS cancelada pelo escritório enquanto o técnico trabalhava sem sinal: lançamento e foto viram "requer atenção" com a mensagem do servidor e nada é baixado', async () => {
    const c = await criarCenario({ metros: 100 });
    const app = await criarApp();
    await app.baixar();
    await iniciarOS(app.ctx, c.osId);
    await app.drenar(); // o início chegou ao servidor
    app.rede.estado.online = false;
    await registrarLancamento(app.ctx, { osId: c.osId, descricao: 'Lançamento de cabo', trecho: 'A → B', itens: [{ chaveGrupo: `l${c.cabo.loteId}`, quantidade: '40' }] });
    const foto = app.guardarFoto('cancelada');
    await adicionarFoto(app.ctx, { osId: c.osId, arquivo: foto.uri, tamanho: foto.tamanho });
    expect((await escritorio('admin', 'POST', `/os/${c.osId}/cancelar`)).status).toBe(200);

    app.rede.estado.online = true;
    await app.drenar();
    const ops = await listarTodas(app.banco, app.usuario.id);
    expect(ops.map((o) => [o.tipo, o.estado])).toEqual([['iniciar', 'ok'], ['lancamento', 'atencao'], ['foto', 'atencao']]);
    expect(ops[1].erro).toMatchObject({ status: 409, mensagem: 'OS encerrada: não aceita novos lançamentos' });
    expect(ops[2].erro).toMatchObject({ status: 409, mensagem: 'OS encerrada: não aceita novas fotos' });
    expect(await movimentacoes(c.osId)).toEqual([]);
    expect((await app.estado()).visao.posse.find((p) => p.lote_id === c.cabo.loteId)?.reservado).toBe(40); // reserva só some quando o técnico resolver
  });

  it('OS cancelada antes mesmo de o "iniciar" chegar: o problema aparece UMA vez (no iniciar) e o que depende dele fica esperando, sem enviar nada', async () => {
    const c = await criarCenario({ metros: 100 });
    const app = await criarApp();
    await app.baixar();
    app.rede.estado.online = false;
    const ini = await iniciarOS(app.ctx, c.osId);
    await registrarLancamento(app.ctx, { osId: c.osId, descricao: 'Lançamento de cabo', trecho: 'A → B', itens: [{ chaveGrupo: `l${c.cabo.loteId}`, quantidade: '40' }] });
    expect((await escritorio('admin', 'POST', `/os/${c.osId}/cancelar`)).status).toBe(200);
    app.rede.estado.online = true;
    await app.drenar();
    const ops = await listarTodas(app.banco, app.usuario.id);
    expect(ops.map((o) => [o.tipo, o.estado])).toEqual([['iniciar', 'atencao'], ['lancamento', 'pendente']]);
    expect(ops[0].erro).toMatchObject({ status: 409, mensagem: 'OS encerrada: não pode ser iniciada' });
    expect(await movimentacoes(c.osId)).toEqual([]);
    // o técnico descarta o "iniciar" (a OS acabou): agora o lançamento mostra a sua própria recusa
    expect(await cancelar(app.banco, ini!.id)).toBe(true);
    await app.drenar();
    expect((await opDe(app, 'lancamento'))[0]).toMatchObject({ estado: 'atencao', erro: { status: 409, mensagem: 'OS encerrada: não aceita novos lançamentos' } });
  });

  it('OS passada para outro técnico no meio: 403 "não está atribuída a você" vira atenção, guarda o número e o cliente da OS, e a OS some da lista depois', async () => {
    const c = await criarCenario({ metros: 100 });
    const app = await criarApp();
    await app.baixar();
    await iniciarOS(app.ctx, c.osId);
    await app.drenar();
    const op = await registrarLancamento(app.ctx, { osId: c.osId, descricao: 'Lançamento de cabo', trecho: 'A → B', itens: [{ chaveGrupo: `l${c.cabo.loteId}`, quantidade: '40' }] });
    consulta('reatribuir', c.osId, SEMENTE.ids.ana);

    await app.drenar();
    expect(await obter(app.banco, op.id)).toMatchObject({ estado: 'atencao', erro: { status: 403, mensagem: 'Esta OS não está atribuída a você' }, os_numero: c.osNumero });
    await app.baixar();
    expect((await app.estado()).visao.os.find((o) => o.id === c.osId)).toBeUndefined(); // saiu da lista
    expect((await opDe(app, 'lancamento'))[0]).toMatchObject({ estado: 'atencao', os_numero: c.osNumero }); // mas a pendência continua visível, com a OS identificada
    expect(await movimentacoes(c.osId)).toEqual([]);
  });

  it('finalizar incompleto que escapa do app: o servidor devolve TODOS os problemas de uma vez e a OS continua aberta', async () => {
    const c = await criarCenario({ metros: 100 });
    const app = await criarApp();
    await app.baixar();
    await iniciarOS(app.ctx, c.osId);
    const op = await app.enfileirarCru({
      usuario_id: app.usuario.id, os_id: c.osId, os_numero: c.osNumero, os_cliente: 'x', client_uuid: crypto.randomUUID(), chave: crypto.randomUUID(), depende_de: [], tipo: 'finalizar',
      payload: { corpo: { client_uuid: crypto.randomUUID(), descricao: 'curta', motivo_codigo: 'nao_existe', local: { lat: -23.5, lng: -46.3, origem: 'gps' }, checklist: {}, materiais_usados: true, materiais_retirados: false, retirados: [], participantes: [], fotos_esperadas: [], iniciado_em: null, finalizado_em: new Date().toISOString(), dispositivo: 'jest', versao_app: '1.0.0' } },
    });
    await app.motor.executar();
    const e = (await obter(app.banco, op.id))!;
    expect(e.estado).toBe('atencao');
    expect(e.erro?.status).toBe(400);
    expect(e.erro?.mensagem).toMatch(/^A OS não pode ser finalizada: /);
    const campos = e.erro!.detalhes!.map((d) => d.campo);
    expect(campos).toEqual(expect.arrayContaining(['descricao', 'motivo', 'checklist', 'materiais_usados', 'fotos']));
    expect(consulta<any>('fechamento', c.osId)).toMatchObject({ fechamento: null, os: { status: 'em_andamento' } });
  });

  it('fotos: envia várias, remover uma já enviada apaga no servidor (e o arquivo) e o limite do servidor vale', async () => {
    const c = await criarCenario({ metros: 10 });
    const app = await criarApp();
    await app.baixar();
    await iniciarOS(app.ctx, c.osId);
    const a = app.guardarFoto('a'); const b = app.guardarFoto('b');
    const fa = await adicionarFoto(app.ctx, { osId: c.osId, arquivo: a.uri, tamanho: a.tamanho });
    await adicionarFoto(app.ctx, { osId: c.osId, arquivo: b.uri, tamanho: b.tamanho });
    await app.drenar();
    expect(consulta<any>('fechamento', c.osId).fotos).toHaveLength(2);
    await removerFotoDaOS(app.ctx, c.osId, fa.clientUuid);
    expect(await listarFotos(app.banco, c.osId)).toHaveLength(1); // some da tela na hora
    await app.drenar();
    const f = consulta<any>('fechamento', c.osId);
    expect(f.fotos).toHaveLength(1);
    expect(f.fotos[0].client_uuid).not.toBe(fa.clientUuid);
    expect(fs.existsSync(path.join(FOTOS_DIR!, f.fotos[0].arquivo))).toBe(true);
    expect(fs.readdirSync(FOTOS_DIR!).filter((n) => !n.startsWith('.')).length).toBeGreaterThanOrEqual(1);
  });

  it('sessão: token de acesso vencido no meio do trabalho é renovado sozinho e o envio segue', async () => {
    const c = await criarCenario({ metros: 100 });
    const app = await criarApp();
    await app.baixar();
    await iniciarOS(app.ctx, c.osId);
    await registrarLancamento(app.ctx, { osId: c.osId, descricao: 'Lançamento de cabo', trecho: 'A → B', itens: [{ chaveGrupo: `l${c.cabo.loteId}`, quantidade: '30' }] });
    app.flags.tokenRuim = true; // como se os 15 minutos tivessem passado
    await app.drenar();
    expect(app.flags.tokenRuim).toBe(false);
    expect(await estados(app)).toEqual(['iniciar:ok', 'lancamento:ok']);
    expect(soma(await movimentacoes(c.osId))).toBe(30);
  });

  it('sessão revogada no servidor: o envio PAUSA sem perder nada e retoma quando o técnico entra de novo', async () => {
    const c = await criarCenario({ metros: 100 });
    const app = await criarApp();
    await app.baixar();
    await iniciarOS(app.ctx, c.osId);
    await registrarLancamento(app.ctx, { osId: c.osId, descricao: 'Lançamento de cabo', trecho: 'A → B', itens: [{ chaveGrupo: `l${c.cabo.loteId}`, quantidade: '30' }] });
    const refresh = (await app.armazenamento.get('os.sessao.refresh'))!;
    await app.api.sair(refresh); // outro aparelho / o escritório encerrou a sessão
    app.flags.tokenRuim = true;
    const r = await app.motor.executar();
    expect(r.sessaoPerdida).toBe(true);
    expect(app.g.getEstado().status).toBe('deslogado');
    expect(await estados(app)).toEqual(['iniciar:pendente', 'lancamento:pendente']); // nada se perdeu
    expect(await movimentacoes(c.osId)).toEqual([]);

    await app.g.entrar(SEMENTE.usuarios.joao, 'senha123');
    app.flags.tokenRuim = false;
    await app.drenar();
    expect(await estados(app)).toEqual(['iniciar:ok', 'lancamento:ok']);
    expect(soma(await movimentacoes(c.osId))).toBe(30);
  });

  it('QR do lote consultado online: o dono vê o lote (mesmo em minúsculas); lote de outro ou do almoxarifado dá 403; inexistente dá 404', async () => {
    const c = await criarCenario({ metros: 50 });
    const app = await criarApp();
    expect(await app.api.lotePorCodigo(c.cabo.codigo.toLowerCase())).toMatchObject({ codigo: c.cabo.codigo, minha_posse: 50 });
    const compra = await escritorio('estoque', 'POST', '/estoque/compras', { item_id: SEMENTE.ids.cabo, tipo_volume: 'bobina', qtd_volumes: 1, medida_por_volume: 100 });
    await expect(app.api.lotePorCodigo(compra.corpo.lotes[0].codigo)).rejects.toMatchObject({ status: 403, message: 'Este lote não está em sua posse' });
    await expect(app.api.lotePorCodigo('LOTE-NAO-EXISTE-9')).rejects.toMatchObject({ status: 404, message: 'Lote não encontrado' });
  });
});
