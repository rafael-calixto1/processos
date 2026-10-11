import { fmtData, fmtDataHora, fmtHora, rotuloAtualizacao } from '../tempo';

const local = (y: number, m: number, d: number, h: number, mi: number) => new Date(y, m - 1, d, h, mi).toISOString();

describe('tempo', () => {
  it('formata no horário do aparelho', () => {
    expect(fmtHora(local(2026, 10, 11, 9, 5))).toBe('09:05');
    expect(fmtDataHora(local(2026, 1, 2, 23, 59))).toBe('02/01/2026 23:59');
  });
  it('data pura não muda de dia por causa do fuso', () => {
    expect(fmtData('2026-10-20')).toBe('20/10/2026');
    expect(fmtData('2026-10-20T00:00:00.000Z')).toBe('20/10/2026');
    expect(fmtData(null)).toBe('—');
  });
  it('trata vazio e lixo', () => {
    expect(fmtHora(null)).toBe('—');
    expect(fmtHora('lixo')).toBe('—');
    expect(fmtDataHora(undefined)).toBe('—');
  });
  it('"Atualizado às" para hoje e com data para outros dias', () => {
    const agora = new Date(2026, 9, 11, 15, 0);
    expect(rotuloAtualizacao(local(2026, 10, 11, 10, 30), agora)).toBe('Atualizado às 10:30');
    expect(rotuloAtualizacao(local(2026, 10, 9, 10, 30), agora)).toBe('Atualizado em 09/10 às 10:30');
    expect(rotuloAtualizacao(null, agora)).toBe('Ainda não atualizado');
  });
});
