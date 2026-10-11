import { criarBancoDeTeste } from '@/testing/bancoNode';
import { criarBootstrap, criarOS } from '@/testing/fixtures';
import { migrar, VERSAO_ATUAL } from '../migracoes';
import { atualizarOS, definirMeta, lerDados, lerMeta, limparDadosLocais, salvarBootstrap } from '../repositorio';

describe('migrações', () => {
  it('criam o schema do zero e guardam a versão', async () => {
    const { banco, db } = await criarBancoDeTeste(false);
    expect(await migrar(banco)).toBe(VERSAO_ATUAL);
    const tabelas = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[]).map((t) => t.name);
    expect(tabelas).toEqual(['catalogo', 'meta', 'os', 'posse']);
    expect(db.pragma('user_version', { simple: true })).toBe(VERSAO_ATUAL);
  });
  it('rodar de novo não faz nada (e não perde dados)', async () => {
    const { banco } = await criarBancoDeTeste();
    await salvarBootstrap(banco, criarBootstrap());
    await migrar(banco); await migrar(banco);
    expect((await lerDados(banco))?.os).toHaveLength(3);
  });
  it('um banco de versão mais nova que o app é recusado em vez de ser corrompido', async () => {
    const { banco, db } = await criarBancoDeTeste();
    db.pragma(`user_version = ${VERSAO_ATUAL + 1}`);
    await expect(migrar(banco)).rejects.toThrow(/mais novo/);
  });
});

describe('salvarBootstrap / lerDados', () => {
  it('antes da primeira sincronização não há dados', async () => {
    const { banco } = await criarBancoDeTeste();
    expect(await lerDados(banco)).toBeNull();
  });

  it('guarda e devolve tudo, com tipos e ordem do servidor preservados', async () => {
    const { banco } = await criarBancoDeTeste();
    const b = criarBootstrap();
    await salvarBootstrap(banco, b);
    const d = (await lerDados(banco))!;
    expect(d.geradoEm).toBe(b.gerado_em);
    expect(d.tecnico).toEqual(b.tecnico);
    expect(d.os).toEqual(b.os);
    expect(d.os.map((o) => o.numero)).toEqual([1, 2, 3]);
    expect(typeof d.os[0].latitude).toBe('number');
    expect(d.os[0].tem_rascunho).toBe(false);
    expect(d.posse).toHaveLength(3);
    expect(d.posse.find((p) => p.lote_id === 11)?.quantidade).toBe(449.5);
    expect(d.motivos).toEqual(b.motivos);
    expect(d.checklist[0].obrigatorio).toBe(true);
    expect(d.regras.fotos_min).toBe(1);
    expect(d.sugestoesServicos).toEqual(b.sugestoes_servicos);
  });

  it('o retrato novo SUBSTITUI o anterior: OS que saíram do técnico somem e as alteradas são atualizadas', async () => {
    const { banco } = await criarBancoDeTeste();
    await salvarBootstrap(banco, criarBootstrap());
    await salvarBootstrap(banco, criarBootstrap({
      gerado_em: '2026-10-11T14:00:00.000Z',
      os: [criarOS(2, { status: 'cancelada', prazo: '2026-10-12' }), criarOS(9)],
      posse: [],
    }));
    const d = (await lerDados(banco))!;
    expect(d.os.map((o) => [o.numero, o.status])).toEqual([[2, 'cancelada'], [9, 'aberta']]);
    expect(d.posse).toEqual([]);
    expect(d.geradoEm).toBe('2026-10-11T14:00:00.000Z');
  });

  it('é tudo ou nada: se algo falha no meio, o retrato anterior continua inteiro', async () => {
    const { banco } = await criarBancoDeTeste();
    await salvarBootstrap(banco, criarBootstrap());
    const ruim = criarBootstrap({ gerado_em: '2026-10-11T15:00:00.000Z', os: [criarOS(7), criarOS(7)] }); // mesmo id duas vezes: viola a chave primária
    await expect(salvarBootstrap(banco, ruim)).rejects.toThrow();
    const d = (await lerDados(banco))!;
    expect(d.geradoEm).toBe('2026-10-11T13:30:00.000Z');
    expect(d.os.map((o) => o.numero)).toEqual([1, 2, 3]);
  });
});

describe('atualizarOS', () => {
  it('altera a OS guardada (status e campos) e devolve a versão nova', async () => {
    const { banco } = await criarBancoDeTeste();
    await salvarBootstrap(banco, criarBootstrap());
    const nova = await atualizarOS(banco, 102, { status: 'em_andamento', iniciado_em: '2026-10-11T13:40:00.000Z' });
    expect(nova).toMatchObject({ id: 102, status: 'em_andamento', iniciado_em: '2026-10-11T13:40:00.000Z', cliente: 'Rota PL-902 → CEO-02' });
    const d = (await lerDados(banco))!;
    expect(d.os.find((o) => o.id === 102)?.status).toBe('em_andamento');
    expect(d.os.map((o) => o.id)).toEqual([101, 102, 103]); // ordem intacta
  });
  it('OS desconhecida devolve null e não cria nada', async () => {
    const { banco } = await criarBancoDeTeste();
    await salvarBootstrap(banco, criarBootstrap());
    expect(await atualizarOS(banco, 999, { status: 'concluida' })).toBeNull();
    expect((await lerDados(banco))!.os).toHaveLength(3);
  });
});

describe('limparDadosLocais e meta', () => {
  it('apaga o espelho do servidor e volta ao estado "nunca sincronizou"', async () => {
    const { banco } = await criarBancoDeTeste();
    await salvarBootstrap(banco, criarBootstrap());
    await definirMeta(banco, 'usuario_id', '7');
    await limparDadosLocais(banco);
    expect(await lerDados(banco)).toBeNull();
    expect(await lerMeta(banco, 'usuario_id')).toBeNull();
    expect(await banco.all('SELECT * FROM os')).toEqual([]);
  });
  it('definirMeta sobrescreve o valor', async () => {
    const { banco } = await criarBancoDeTeste();
    await definirMeta(banco, 'k', 'a'); await definirMeta(banco, 'k', 'b');
    expect(await lerMeta(banco, 'k')).toBe('b');
  });
});

describe('fila serial e transações', () => {
  it('uma operação de outra tarefa NÃO entra na transação em andamento (e não é desfeita no rollback)', async () => {
    const { banco } = await criarBancoDeTeste(true, 3);
    let transacaoAberta!: () => void;
    const noMeio = new Promise<void>((r) => { transacaoAberta = r; });
    const transacao = banco.transacao(async (tx) => {
      await tx.run('INSERT INTO meta (chave, valor) VALUES (?, ?)', ['dentro', '1']);
      transacaoAberta(); // a transação já escreveu e continua aberta
      await new Promise((r) => setTimeout(r, 25));
      throw new Error('falhou no meio');
    });
    await noMeio;
    const intruso = banco.run('INSERT INTO meta (chave, valor) VALUES (?, ?)', ['de-fora', '1']); // chega com a transação aberta
    await expect(transacao).rejects.toThrow('falhou no meio');
    await intruso;
    expect(await lerMeta(banco, 'dentro')).toBeNull(); // desfeito
    expect(await lerMeta(banco, 'de-fora')).toBe('1'); // preservado: esperou a transação acabar
  });

  it('operações simultâneas rodam uma por vez, na ordem em que chegaram', async () => {
    const { banco } = await criarBancoDeTeste(true, 2);
    const ordem: number[] = [];
    await Promise.all(Array.from({ length: 8 }, (_, i) => banco.run('INSERT INTO meta (chave, valor) VALUES (?, ?)', [`k${i}`, String(i)]).then(() => ordem.push(i))));
    expect(ordem).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect((await banco.all('SELECT * FROM meta')).length).toBe(8);
  });

  it('um erro numa operação não trava a fila para as seguintes', async () => {
    const { banco } = await criarBancoDeTeste();
    await expect(banco.run('INSERT INTO tabela_que_nao_existe VALUES (1)')).rejects.toThrow();
    await banco.run('INSERT INTO meta (chave, valor) VALUES (?, ?)', ['ok', '1']);
    expect(await lerMeta(banco, 'ok')).toBe('1');
  });

  it('transação dentro de transação continua na mesma (sem travar)', async () => {
    const { banco } = await criarBancoDeTeste();
    await banco.transacao(async (tx) => { await tx.transacao(async (t2) => { await t2.run('INSERT INTO meta (chave, valor) VALUES (?, ?)', ['x', '1']); }); });
    expect(await lerMeta(banco, 'x')).toBe('1');
  });
});
