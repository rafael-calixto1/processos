import { ETAPAS, etapasConcluidas, podeFinalizar, progresso, rascunhoVazio, retiradosCompletos, type ContextoEtapas, type Rascunho } from '../etapas';
import type { ChecklistItem } from '../tipos';

const item = (codigo: string, tipo: ChecklistItem['tipo'], obrigatorio: boolean): ChecklistItem =>
  ({ id: 1, codigo, rotulo: codigo, tipo, unidade: null, obrigatorio, tipo_servico_id: null });
const CHECKLIST = [
  item('fiberLaunchedMeters', 'number', true), item('spliceEnclosureSealed', 'boolean', true), item('dropClampsUsed', 'number', true),
  item('slackLoopsLeft', 'number', true), item('fiberTagged', 'boolean', true), item('opticalPowerOk', 'boolean', true), item('fieldNotes', 'text', false),
];
const ctx = (sobrescrever: Partial<ContextoEtapas> = {}): ContextoEtapas =>
  ({ checklist: CHECKLIST, lancamentosComMaterial: 1, regras: { descricao_min_caracteres: 11, fotos_min: 1 }, ...sobrescrever });
const completo = (): Rascunho => ({
  descricao: 'Lançados 350 m de cabo entre os postes.', motivo_codigo: 'route_launched',
  local: { lat: -23.5, lng: -46.3, origem: 'gps', precisao_m: 6 },
  checklist: { fiberLaunchedMeters: '350,5', spliceEnclosureSealed: true, dropClampsUsed: 4, slackLoopsLeft: '0', fiberTagged: false, opticalPowerOk: true },
  materiais_usados: true, materiais_retirados: false, retirados: [], fotos: ['f1'], participantes: [],
});

describe('etapas', () => {
  it('mantém a ordem e os textos do web, com Participantes opcional', () => {
    expect(ETAPAS.map((e) => e.rotulo)).toEqual(['Descrição', 'Motivo de Fechamento', 'Local do Endereço', 'Checklists', 'Materiais Utilizados', 'Materiais Retirados', 'Fotos do Serviço', 'Participantes']);
    expect(ETAPAS.filter((e) => !e.obrigatoria).map((e) => e.chave)).toEqual(['participantes']);
  });

  it('um rascunho vazio não conclui nada obrigatório e não deixa finalizar', () => {
    const feitas = etapasConcluidas(rascunhoVazio(), ctx({ lancamentosComMaterial: 0 }));
    expect(Object.values(feitas).some(Boolean)).toBe(false);
    expect(podeFinalizar(rascunhoVazio(), ctx({ lancamentosComMaterial: 0 }))).toBe(false);
    expect(progresso(rascunhoVazio(), ctx({ lancamentosComMaterial: 0 }))).toEqual({ feitas: 0, total: 7 });
  });

  it('um rascunho completo finaliza, mesmo sem participantes', () => {
    expect(podeFinalizar(completo(), ctx())).toBe(true);
    expect(progresso(completo(), ctx())).toEqual({ feitas: 7, total: 7 });
  });

  it('descrição: precisa de mais de 10 caracteres (espaços não contam)', () => {
    expect(etapasConcluidas({ ...completo(), descricao: '1234567890' }, ctx()).descricao).toBe(false);
    expect(etapasConcluidas({ ...completo(), descricao: '12345678901' }, ctx()).descricao).toBe(true);
    expect(etapasConcluidas({ ...completo(), descricao: '   12345   ' }, ctx()).descricao).toBe(false);
  });

  it('checklist: todo obrigatório respondido com o tipo certo; o opcional não trava', () => {
    const r = completo();
    expect(etapasConcluidas(r, ctx()).checklist).toBe(true);
    expect(etapasConcluidas({ ...r, checklist: { ...r.checklist, spliceEnclosureSealed: 'sim' } }, ctx()).checklist).toBe(false); // booleano exige true/false
    expect(etapasConcluidas({ ...r, checklist: { ...r.checklist, fiberLaunchedMeters: '' } }, ctx()).checklist).toBe(false);
    expect(etapasConcluidas({ ...r, checklist: { ...r.checklist, fiberLaunchedMeters: '-1' } }, ctx()).checklist).toBe(false);
    expect(etapasConcluidas({ ...r, checklist: { ...r.checklist, slackLoopsLeft: 0 } }, ctx()).checklist).toBe(true); // zero é resposta válida
    const { fiberTagged, ...semUm } = r.checklist; void fiberTagged;
    expect(etapasConcluidas({ ...r, checklist: semUm }, ctx()).checklist).toBe(false);
  });

  it('checklist: item de texto obrigatório precisa de conteúdo', () => {
    const c = ctx({ checklist: [item('obs', 'text', true)] });
    expect(etapasConcluidas({ ...rascunhoVazio(), checklist: { obs: '  ' } }, c).checklist).toBe(false);
    expect(etapasConcluidas({ ...rascunhoVazio(), checklist: { obs: 'ok' } }, c).checklist).toBe(true);
  });

  it('materiais utilizados: vale com lançamento ou com "não usei" (e só enquanto não há lançamento)', () => {
    expect(etapasConcluidas({ ...completo(), materiais_usados: null }, ctx({ lancamentosComMaterial: 2 })).usados).toBe(true);
    expect(etapasConcluidas({ ...completo(), materiais_usados: false }, ctx({ lancamentosComMaterial: 0 })).usados).toBe(true);
    expect(etapasConcluidas({ ...completo(), materiais_usados: true }, ctx({ lancamentosComMaterial: 0 })).usados).toBe(false);
    expect(etapasConcluidas({ ...completo(), materiais_usados: null }, ctx({ lancamentosComMaterial: 0 })).usados).toBe(false);
  });

  it('materiais retirados: "nenhum" fecha a etapa; "sim" exige itens com quantidade válida e condição', () => {
    const linha = { chave: 'a', item_id: null, descricao: 'Splitter', quantidade: '1', unidade: 'pecas' as const, condicao: 'usado' as const };
    expect(retiradosCompletos({ ...completo(), materiais_retirados: null })).toBe(false);
    expect(retiradosCompletos({ ...completo(), materiais_retirados: false })).toBe(true);
    expect(retiradosCompletos({ ...completo(), materiais_retirados: true, retirados: [] })).toBe(false);
    expect(retiradosCompletos({ ...completo(), materiais_retirados: true, retirados: [linha] })).toBe(true);
    expect(retiradosCompletos({ ...completo(), materiais_retirados: true, retirados: [{ ...linha, quantidade: '1,5' }] })).toBe(false); // peças fracionadas
    expect(retiradosCompletos({ ...completo(), materiais_retirados: true, retirados: [{ ...linha, quantidade: '' }] })).toBe(false);
    expect(retiradosCompletos({ ...completo(), materiais_retirados: true, retirados: [{ ...linha, condicao: null }] })).toBe(false);
    expect(retiradosCompletos({ ...completo(), materiais_retirados: true, retirados: [linha, { ...linha, chave: 'b', quantidade: '0' }] })).toBe(false);
  });

  it('fotos: respeita o mínimo definido pelo servidor', () => {
    expect(etapasConcluidas({ ...completo(), fotos: [] }, ctx()).fotos).toBe(false);
    expect(etapasConcluidas({ ...completo(), fotos: ['a'] }, ctx({ regras: { descricao_min_caracteres: 11, fotos_min: 3 } })).fotos).toBe(false);
    expect(etapasConcluidas({ ...completo(), fotos: ['a', 'b', 'c'] }, ctx({ regras: { descricao_min_caracteres: 11, fotos_min: 3 } })).fotos).toBe(true);
  });

  it('cada etapa obrigatória sozinha impede finalizar', () => {
    const quebras: Array<[string, Partial<Rascunho>]> = [
      ['descricao', { descricao: 'curta' }], ['motivo', { motivo_codigo: null }], ['local', { local: null }],
      ['checklist', { checklist: {} }], ['usados', { materiais_usados: null }], ['retirados', { materiais_retirados: null }], ['fotos', { fotos: [] }],
    ];
    for (const [nome, q] of quebras) {
      const c = ctx({ lancamentosComMaterial: nome === 'usados' ? 0 : 1 });
      expect([nome, podeFinalizar({ ...completo(), ...q }, c)]).toEqual([nome, false]);
    }
  });
});

/* Paridade com `getStepCompletion` do web (frontend/src/pages/fieldwork/state.jsx), usando o mesmo checklist. A única
   diferença proposital: texto obrigatório precisa de conteúdo (no web um texto obrigatório nunca fecharia a etapa). */
describe('paridade com o web nas etapas que ele já tinha', () => {
  const webChecklist = (d: { checklistAnswers: Record<string, unknown> }) => CHECKLIST.filter((i) => i.obrigatorio).every((i) => {
    const v = d.checklistAnswers[i.codigo];
    return i.tipo === 'boolean' ? typeof v === 'boolean' : v !== undefined && v !== '' && Number(v) >= 0;
  });
  it('checklist: mesmas respostas, mesmo resultado', () => {
    const valores: unknown[] = [undefined, '', '0', '12', 12, 0, '-1', 'abc', true, false, null];
    let n = 0;
    for (const a of valores) for (const b of valores) for (const c of valores) {
      const respostas = { fiberLaunchedMeters: a, spliceEnclosureSealed: b, dropClampsUsed: c, slackLoopsLeft: 1, fiberTagged: true, opticalPowerOk: false };
      const nosso = etapasConcluidas({ ...rascunhoVazio(), checklist: respostas as Rascunho['checklist'] }, ctx()).checklist;
      // null/typeof boolean em campo numérico: o web trata Number(null)=0 como válido; o app recusa (o servidor também recusa null)
      const diferenca = [a, c].some((v) => v === null || typeof v === 'boolean');
      if (!diferenca) { expect(nosso).toBe(webChecklist({ checklistAnswers: respostas })); n++; }
    }
    expect(n).toBeGreaterThan(300);
  });
});
