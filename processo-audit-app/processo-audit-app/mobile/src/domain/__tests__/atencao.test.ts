import type { Operacao } from '../operacoes';
import { descreverAtencao, rotuloDaOS } from '../atencao';

const AGORA = Date.parse('2026-10-20T12:00:00Z');
const op = (tipo: Operacao['tipo'], erro: Operacao['erro'], extra: Record<string, unknown> = {}): Operacao => ({
  id: 1, usuario_id: 7, os_id: 102, tipo, client_uuid: 'u', chave: 'k', payload: {}, depende_de: [], estado: 'atencao', tentativas: 1, proxima_tentativa: 0,
  criado_em: '2026-10-19T12:00:00.000Z', atualizado_em: '', ok_em: null, no_retrato: false, forcada: false, resposta: null, erro, os_numero: 12, os_cliente: 'Rota PL-900', ...extra,
} as unknown as Operacao);

describe('descreverAtencao', () => {
  it('lançamento recusado por quantidade/posse (400): corrigir, tentar de novo ou descartar', () => {
    const d = descreverAtencao(op('lancamento', { status: 400, mensagem: 'Quantidade maior que a posse do técnico neste lote (50)' }), AGORA);
    expect(d).toMatchObject({ titulo: 'Lançamento de material', acoes: ['corrigir', 'tentar_de_novo', 'descartar'] });
  });
  it('OS reatribuída (403), inexistente (404) ou encerrada (409): só descartar — insistir não resolve', () => {
    for (const status of [403, 404, 409]) expect(descreverAtencao(op('lancamento', { status, mensagem: 'x' }), AGORA).acoes).toEqual(['descartar']);
    expect(descreverAtencao(op('lancamento', { status: 403, mensagem: 'x' }), AGORA).oQueFazer).toMatch(/não está mais com você/);
    expect(descreverAtencao(op('iniciar', { status: 409, mensagem: 'x' }), AGORA).acoes).toEqual(['descartar']);
  });
  it('finalização recusada por regra (400): voltar a editar ou tentar de novo; 409: só descartar', () => {
    expect(descreverAtencao(op('finalizar', { status: 400, mensagem: 'x' }), AGORA).acoes).toEqual(['voltar_a_editar', 'tentar_de_novo']);
    expect(descreverAtencao(op('finalizar', { status: 409, mensagem: 'x' }), AGORA).acoes).toEqual(['descartar']);
  });
  it('foto que sumiu do aparelho: descartar e tirar outra', () => {
    expect(descreverAtencao(op('foto', { status: null, mensagem: 'A foto não está mais guardada no aparelho.' }), AGORA)).toMatchObject({ acoes: ['descartar'], oQueFazer: expect.stringContaining('tire outra foto') });
  });
  it('operação com mais de 14 dias: confirmar com o escritório e "enviar mesmo assim"; passou de 50: só descartar', () => {
    const velha = (dias: number) => op('lancamento', { status: null, mensagem: 'x' }, { criado_em: new Date(AGORA - dias * 86_400_000).toISOString() });
    expect(descreverAtencao(velha(20), AGORA).acoes).toEqual(['enviar_mesmo_assim', 'descartar']);
    expect(descreverAtencao(velha(51), AGORA).acoes).toEqual(['descartar']);
  });
  it('depois de confirmada ("forçada"), a operação velha volta a ser tratada pelo erro do servidor', () => {
    const d = descreverAtencao(op('lancamento', { status: 400, mensagem: 'x' }, { criado_em: new Date(AGORA - 20 * 86_400_000).toISOString(), forcada: true }), AGORA);
    expect(d.acoes).toContain('corrigir');
  });
  it('qualquer outra coisa: tentar de novo ou descartar', () => {
    expect(descreverAtencao(op('remover_foto', { status: 400, mensagem: 'x' }), AGORA).acoes).toEqual(['tentar_de_novo', 'descartar']);
  });
  it('rotuloDaOS usa o número e o cliente guardados, mesmo se a OS saiu da lista', () => {
    expect(rotuloDaOS(op('lancamento', null))).toBe('OS #12 · Rota PL-900');
    expect(rotuloDaOS({ os_id: 5, os_numero: null, os_cliente: null })).toBe('OS 5');
  });
});
