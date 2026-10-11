import type { Unidade } from './tipos';

/** Arredonda para 2 casas como o servidor (`r2`), sem erro de ponto flutuante (1.005 -> 1.01). */
export const r2 = (n: number): number => {
  const v = Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100;
  return n < 0 ? -v : v;
};

/** Número no padrão pt-BR, até 2 casas e sem zeros à direita: 1234.5 -> "1.234,5". */
export const fmtNum = (v: number): string => {
  const [inteiro, dec] = r2(v).toFixed(2).split('.');
  const milhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimais = dec.replace(/0+$/, '');
  return decimais ? `${milhar},${decimais}` : milhar;
};

/** Quantidade com a unidade sempre à vista: "350,5 m" ou "4 un". */
export const fmtQtd = (v: number, unidade: Unidade): string => `${fmtNum(v)} ${unidade === 'metros' ? 'm' : 'un'}`;

export type ResultadoQtd = { ok: true; valor: number } | { ok: false; erro: string };

const MAX = 1_000_000_000;

/**
 * Lê a quantidade digitada no teclado do celular (vírgula ou ponto) e aplica as regras de unidade do servidor:
 * metros aceitam até 2 casas decimais; peças só números inteiros. Nunca arredonda em silêncio.
 */
export const parseQuantidade = (texto: string, unidade: Unidade): ResultadoQtd => {
  let t = String(texto ?? '').trim().replace(/\s+/g, '');
  if (!t) return { ok: false, erro: 'Informe a quantidade' };
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, ''); // "1.234,5": o ponto é separador de milhar
  t = t.replace(',', '.');
  if (!/^\d*\.?\d+$|^\d+\.$/.test(t)) return { ok: false, erro: 'Digite apenas números' };
  const n = Number(t);
  if (!Number.isFinite(n) || n > MAX) return { ok: false, erro: 'Quantidade inválida' };
  if (n <= 0) return { ok: false, erro: 'A quantidade deve ser maior que zero' };
  if (unidade === 'pecas' && !Number.isInteger(n)) return { ok: false, erro: 'Este item é contado em unidades: informe um número inteiro' };
  if (unidade === 'metros' && r2(n) !== n) return { ok: false, erro: 'Use no máximo 2 casas decimais' };
  return { ok: true, valor: n };
};
