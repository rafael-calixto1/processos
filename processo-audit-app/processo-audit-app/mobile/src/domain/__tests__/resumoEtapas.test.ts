import { rascunhoVazio, type ContextoEtapas } from '../etapas';
import { erroChecklist, resumoDaEtapa } from '../resumoEtapas';

const ctx: ContextoEtapas = {
  checklist: [
    { id: 1, codigo: 'metros', rotulo: 'Metros', tipo: 'number', unidade: 'm', obrigatorio: true, tipo_servico_id: null },
    { id: 2, codigo: 'ok', rotulo: 'Ok?', tipo: 'boolean', unidade: null, obrigatorio: true, tipo_servico_id: null },
    { id: 3, codigo: 'obs', rotulo: 'Obs', tipo: 'text', unidade: null, obrigatorio: false, tipo_servico_id: null },
  ],
  lancamentosComMaterial: 0, regras: { descricao_min_caracteres: 11, fotos_min: 1 },
};
const info = { motivos: [{ id: 1, codigo: 'route_launched', rotulo: 'Rota lançada com sucesso', tipo_servico_id: null }], lancamentos: 0, fotos: 0 };

describe('erroChecklist', () => {
  const num = { tipo: 'number' as const };
  it.each([['350,5'], ['350.5'], ['0'], [12], ['']])('aceita %p', (v) => expect(erroChecklist(num, v)).toBeNull());
  it.each([['abc'], ['1,2,3'], [true]])('recusa %p com mensagem em português', (v) => expect(erroChecklist(num, v)).toMatch(/Digite um número/));
  it('recusa negativo', () => expect(erroChecklist(num, '-4')).toMatch(/negativo/));
  it('só confere número; sim/não e texto nunca dão erro', () => { expect(erroChecklist({ tipo: 'boolean' }, true)).toBeNull(); expect(erroChecklist({ tipo: 'text' }, 'x')).toBeNull(); });
});

describe('resumoDaEtapa', () => {
  const r = rascunhoVazio();
  it('descrição: vazia não tem resumo; curta avisa; longa é cortada', () => {
    expect(resumoDaEtapa('descricao', r, ctx, info)).toBeNull();
    expect(resumoDaEtapa('descricao', { ...r, descricao: 'curta' }, ctx, info)).toBe('Muito curta: mínimo de 11 caracteres');
    const longa = 'Lançados 350 m de cabo entre PL-0932 e CEO-03 com fusões';
    expect(resumoDaEtapa('descricao', { ...r, descricao: longa }, ctx, info)).toBe(`${longa.slice(0, 40)}…`);
    expect(resumoDaEtapa('descricao', { ...r, descricao: longa }, ctx, info)).toHaveLength(41);
  });
  it('motivo mostra o rótulo; local mostra a origem, a precisão e as coordenadas', () => {
    expect(resumoDaEtapa('motivo', { ...r, motivo_codigo: 'route_launched' }, ctx, info)).toBe('Rota lançada com sucesso');
    expect(resumoDaEtapa('local', { ...r, local: { lat: -23.5445, lng: -46.3118, origem: 'gps', precisao_m: 6 } }, ctx, info)).toBe('GPS ±6 m · -23.54450, -46.31180');
    expect(resumoDaEtapa('local', { ...r, local: { lat: -23.5, lng: -46.3, origem: 'pole_reference' } }, ctx, info)).toBe('Poste · -23.50000, -46.30000');
  });
  it('checklist conta só os obrigatórios respondidos', () => {
    expect(resumoDaEtapa('checklist', { ...r, checklist: { metros: '10' } }, ctx, info)).toBe('1 de 2 obrigatórios respondidos');
    expect(resumoDaEtapa('checklist', { ...r, checklist: { obs: 'x' } }, ctx, info)).toBe('0 de 2 obrigatórios respondidos');
  });
  it('materiais, fotos e participantes', () => {
    expect(resumoDaEtapa('usados', r, ctx, { ...info, lancamentos: 2 })).toBe('2 lançamentos');
    expect(resumoDaEtapa('usados', { ...r, materiais_usados: false }, ctx, info)).toBe('Nenhum material usado');
    expect(resumoDaEtapa('retirados', { ...r, materiais_retirados: false }, ctx, info)).toBe('Nenhum material retirado');
    expect(resumoDaEtapa('retirados', { ...r, materiais_retirados: true, retirados: [{ chave: 'a', item_id: null, descricao: 'x', quantidade: '1', unidade: 'pecas', condicao: 'novo' }] }, ctx, info)).toBe('1 item');
    expect(resumoDaEtapa('fotos', r, ctx, { ...info, fotos: 3 })).toBe('3 fotos');
    expect(resumoDaEtapa('participantes', { ...r, participantes: [2] }, ctx, info)).toBe('1 participante');
    expect(resumoDaEtapa('fotos', r, ctx, info)).toBeNull();
  });
});
