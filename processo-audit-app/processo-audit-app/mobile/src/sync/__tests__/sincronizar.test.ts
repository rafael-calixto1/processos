import { ApiError, NetworkError } from '@/api/erros';
import { armazenamentoEmMemoria } from '@/auth/armazenamento';
import { ConfigServidor } from '@/config/servidor';
import { lerDados, lerMeta, salvarBootstrap } from '@/db/repositorio';
import { criarBancoDeTeste } from '@/testing/bancoNode';
import { criarBootstrap, criarOS } from '@/testing/fixtures';
import { garantirDono, iniciarExecucao, sincronizar } from '../sincronizar';

describe('sincronizar', () => {
  it('baixa o retrato, troca o espelho e registra quando sincronizou', async () => {
    const { banco } = await criarBancoDeTeste();
    const bootstrap = jest.fn(async () => criarBootstrap());
    await sincronizar({ bootstrap }, banco, () => new Date('2026-10-11T14:00:00Z'));
    expect((await lerDados(banco))?.os).toHaveLength(3);
    expect(await lerMeta(banco, 'sincronizado_em')).toBe('2026-10-11T14:00:00.000Z');
  });

  it('se o servidor falha ou não há rede, o espelho anterior fica intacto e o erro sobe', async () => {
    const { banco } = await criarBancoDeTeste();
    await salvarBootstrap(banco, criarBootstrap());
    await expect(sincronizar({ bootstrap: async () => { throw new NetworkError(); } }, banco)).rejects.toBeInstanceOf(NetworkError);
    await expect(sincronizar({ bootstrap: async () => { throw new ApiError(500, 'Erro interno do servidor'); } }, banco)).rejects.toThrow('Erro interno');
    const d = (await lerDados(banco))!;
    expect(d.geradoEm).toBe('2026-10-11T13:30:00.000Z');
    expect(d.os).toHaveLength(3);
  });
});

describe('garantirDono', () => {
  it('o primeiro técnico só marca o dono; o mesmo técnico mantém os dados', async () => {
    const { banco } = await criarBancoDeTeste();
    expect(await garantirDono(banco, 7)).toEqual({ limpou: false });
    await salvarBootstrap(banco, criarBootstrap());
    expect(await garantirDono(banco, 7)).toEqual({ limpou: false });
    expect((await lerDados(banco))?.os).toHaveLength(3);
  });
  it('outro técnico no mesmo aparelho NUNCA vê os dados do anterior', async () => {
    const { banco } = await criarBancoDeTeste();
    await garantirDono(banco, 7);
    await salvarBootstrap(banco, criarBootstrap());
    expect(await garantirDono(banco, 8)).toEqual({ limpou: true });
    expect(await lerDados(banco)).toBeNull();
    expect(await lerMeta(banco, 'usuario_id')).toBe('8');
  });
});

describe('iniciarExecucao', () => {
  it('envia o horário do aparelho com uma chave de idempotência e atualiza a OS local com a resposta do servidor', async () => {
    const { banco } = await criarBancoDeTeste();
    await salvarBootstrap(banco, criarBootstrap());
    const iniciarOS = jest.fn(async () => ({ status: 'em_andamento' as const, iniciado_em: '2026-10-11T14:02:00.000Z' }));
    const os = await iniciarExecucao({ iniciarOS }, banco, 102, { novaChave: () => 'chave-fixa-123', agora: () => new Date('2026-10-11T14:02:10Z') });
    expect(iniciarOS).toHaveBeenCalledWith(102, '2026-10-11T14:02:10.000Z', 'chave-fixa-123');
    expect(os).toMatchObject({ id: 102, status: 'em_andamento', iniciado_em: '2026-10-11T14:02:00.000Z' });
    expect((await lerDados(banco))!.os.find((o) => o.id === 102)?.status).toBe('em_andamento');
  });
  it('se o servidor recusa (OS encerrada, de outro técnico) ou não há rede, a OS local não muda', async () => {
    const { banco } = await criarBancoDeTeste();
    await salvarBootstrap(banco, criarBootstrap());
    for (const erro of [new ApiError(409, 'OS encerrada: não pode ser iniciada'), new ApiError(403, 'Esta OS não está atribuída a você'), new NetworkError()]) {
      await expect(iniciarExecucao({ iniciarOS: async () => { throw erro; } }, banco, 102, { novaChave: () => 'k' })).rejects.toBe(erro);
    }
    expect((await lerDados(banco))!.os.find((o) => o.id === 102)?.status).toBe('aberta');
  });
  it('OS que sumiu da lista local gera um erro claro', async () => {
    const { banco } = await criarBancoDeTeste();
    await salvarBootstrap(banco, criarBootstrap({ os: [criarOS(1)] }));
    await expect(iniciarExecucao({ iniciarOS: async () => ({ status: 'em_andamento', iniciado_em: 'x' }) }, banco, 555, { novaChave: () => 'k' })).rejects.toThrow(/não está mais na sua lista/);
  });
});

describe('ConfigServidor', () => {
  it('usa o padrão do ambiente, e o que o técnico digitar passa a valer e fica guardado', async () => {
    const arm = armazenamentoEmMemoria();
    const c = new ConfigServidor(arm, '10.0.0.1:5002');
    expect(c.url()).toBe('http://10.0.0.1:5002/api');
    expect(await c.definir('os.exemplo.com.br')).toEqual({ ok: true, url: 'http://os.exemplo.com.br/api' });
    const outro = new ConfigServidor(arm, '10.0.0.1:5002');
    await outro.carregar();
    expect(outro.url()).toBe('http://os.exemplo.com.br/api'); // o digitado vence o padrão
  });
  it('endereço inválido é recusado e não substitui o atual', async () => {
    const c = new ConfigServidor(armazenamentoEmMemoria(), 'http://a:1');
    expect((await c.definir('ftp://x')).ok).toBe(false);
    expect(c.url()).toBe('http://a:1/api');
  });
  it('sem padrão e sem valor guardado não há servidor', async () => {
    const c = new ConfigServidor(armazenamentoEmMemoria());
    await c.carregar();
    expect(c.url()).toBeNull();
  });
});
