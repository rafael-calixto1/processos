import { fmtNum, fmtQtd, parseQuantidade, r2 } from '../quantidade';

describe('r2', () => {
  it('arredonda como o servidor, sem erro de ponto flutuante', () => {
    expect(r2(1.005)).toBe(1.01);
    expect(r2(0.1 + 0.2)).toBe(0.3);
    expect(r2(2.675)).toBe(2.68);
    expect(r2(-1.005)).toBe(-1.01);
    expect(r2(10)).toBe(10);
  });
});

describe('fmtNum / fmtQtd', () => {
  it('usa o padrão pt-BR, até 2 casas e sem zeros sobrando', () => {
    expect(fmtNum(1234.5)).toBe('1.234,5');
    expect(fmtNum(1234567.891)).toBe('1.234.567,89');
    expect(fmtNum(350.5)).toBe('350,5');
    expect(fmtNum(4)).toBe('4');
    expect(fmtNum(0)).toBe('0');
    expect(fmtNum(0.1 + 0.2)).toBe('0,3');
    expect(fmtNum(999.999)).toBe('1.000');
  });
  it('mostra a unidade sempre', () => {
    expect(fmtQtd(350.5, 'metros')).toBe('350,5 m');
    expect(fmtQtd(4, 'pecas')).toBe('4 un');
  });
  it('é igual ao toLocaleString pt-BR usado pelo web', () => {
    for (const v of [0, 1, 12.3, 99.99, 1000, 1234.56, 100000.1, 2.5, 7.25]) {
      expect(fmtNum(v)).toBe(v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
    }
  });
});

describe('parseQuantidade', () => {
  const ok = (t: string, u: 'metros' | 'pecas', valor: number) => expect(parseQuantidade(t, u)).toEqual({ ok: true, valor });
  const erro = (t: string, u: 'metros' | 'pecas', trecho: RegExp) => {
    const r = parseQuantidade(t, u);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(trecho);
  };

  it('aceita vírgula ou ponto como decimal (teclado do celular)', () => {
    ok('12,5', 'metros', 12.5);
    ok('12.5', 'metros', 12.5);
    ok(' 350,50 ', 'metros', 350.5);
    ok('1.234,5', 'metros', 1234.5);
    ok('5.', 'metros', 5);
    ok('.5', 'metros', 0.5);
  });
  it('peças só aceitam inteiros', () => {
    ok('4', 'pecas', 4);
    erro('1,5', 'pecas', /número inteiro/);
    erro('2.5', 'pecas', /número inteiro/);
  });
  it('metros aceitam no máximo 2 casas e nunca arredondam em silêncio', () => {
    erro('1,234', 'metros', /2 casas/);
    erro('0,001', 'metros', /2 casas/);
  });
  it('recusa vazio, zero, negativo, lixo e valores absurdos', () => {
    erro('', 'metros', /Informe a quantidade/);
    erro('   ', 'pecas', /Informe a quantidade/);
    erro('0', 'pecas', /maior que zero/);
    erro('0,00', 'metros', /maior que zero/);
    erro('-3', 'metros', /apenas números/);
    erro('abc', 'metros', /apenas números/);
    erro('1,2,3', 'metros', /apenas números/);
    erro('1e3', 'metros', /apenas números/);
    erro('99999999999', 'pecas', /inválida/);
  });
});
