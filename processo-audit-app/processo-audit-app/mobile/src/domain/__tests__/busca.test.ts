import { filtrarGrupos, normalizar } from '../busca';
import { agrupar } from '../posse';
import type { PosseItem } from '../tipos';

const p = (lote_id: number, lote_codigo: string, item_id: number, item_nome: string, quantidade = 10): PosseItem => ({ lote_id, lote_codigo, item_id, item_nome, unidade: 'pecas', quantidade });
const grupos = agrupar([p(1, 'LOTE-BOB-0001', 1, 'Cabo óptico ASU 12F'), p(2, 'LOTE-UNI-0001', 2, 'Conector SC/APC'), p(3, 'LOTE-UNI-0002', 2, 'Conector SC/APC'), p(4, 'LOTE-CXA-0007', 3, 'Caixa de emenda CEO 24F')]);

describe('busca', () => {
  it('normaliza acentos e caixa', () => {
    expect(normalizar('  Óptico ÇÃO  ')).toBe('optico cao');
  });
  it('sem termo devolve tudo', () => {
    expect(filtrarGrupos(grupos, '  ')).toHaveLength(3);
  });
  it('acha por nome sem depender de acento ou caixa', () => {
    expect(filtrarGrupos(grupos, 'OPTICO').map((g) => g.item_nome)).toEqual(['Cabo óptico ASU 12F']);
    expect(filtrarGrupos(grupos, 'conéctor')).toHaveLength(1);
  });
  it('acha pelo código do lote (inclusive dos lotes somados de um item por unidade)', () => {
    expect(filtrarGrupos(grupos, 'bob-0001')).toHaveLength(1);
    expect(filtrarGrupos(grupos, 'uni-0002').map((g) => g.item_nome)).toEqual(['Conector SC/APC']);
  });
  it('todas as palavras precisam casar', () => {
    expect(filtrarGrupos(grupos, 'caixa ceo')).toHaveLength(1);
    expect(filtrarGrupos(grupos, 'caixa asu')).toHaveLength(0);
  });
});
