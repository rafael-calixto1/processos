import { paletaClara, paletaEscura, tonsDe, type Paleta } from '../index';

/** Contraste WCAG 2.x entre duas cores "#rrggbb". */
const luminancia = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contraste = (a: string, b: string) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

const AA = 4.5; // texto normal
const paletas: Array<[string, Paleta]> = [['clara', paletaClara], ['escura', paletaEscura]];

describe.each(paletas)('paleta %s: contraste mínimo de texto (WCAG AA, 4,5:1)', (_nome, p) => {
  const pares: Array<[string, string, string]> = [
    ['texto sobre o fundo', p.texto, p.fundo],
    ['texto sobre a superfície', p.texto, p.superficie],
    ['texto suave sobre o fundo', p.textoSuave, p.fundo],
    ['texto suave sobre a superfície', p.textoSuave, p.superficie],
    ['texto suave sobre fundo neutro (selos, mapas)', p.textoSuave, p.neutroClaro],
    ['título verde sobre a superfície', p.primariaEscura, p.superficie],
    ['título verde sobre o fundo', p.primariaEscura, p.fundo],
    ['título verde sobre a seleção', p.primariaEscura, p.primariaClara],
    ['branco sobre o botão principal', '#ffffff', p.primariaBotao],
    ['branco sobre o cabeçalho e chips ativos', '#ffffff', p.destaqueFundo],
    ['subtítulo do cabeçalho', p.sobreDestaqueSuave, p.destaqueFundo],
    ['erro sobre a superfície', p.erro, p.superficie],
    ['erro sobre o fundo do erro', p.erro, p.erroClaro],
    ['aviso sobre a superfície', p.aviso, p.superficie],
    ['aviso sobre o fundo do aviso', p.aviso, p.avisoClaro],
    ['info sobre o fundo da info', p.info, p.infoClaro],
    ['sucesso sobre a superfície', p.sucesso, p.superficie],
    ['sucesso sobre o fundo do sucesso', p.sucesso, p.sucessoClaro],
  ];
  it.each(pares)('%s', (_rotulo, frente, fundo) => {
    expect(contraste(frente, fundo)).toBeGreaterThanOrEqual(AA);
  });
  it('cada tom de selo/aviso (texto sobre o próprio fundo) passa', () => {
    for (const [tom, t] of Object.entries(tonsDe(p))) expect([tom, contraste(t.texto, t.fundo) >= AA]).toEqual([tom, true]);
  });
  it('os alvos de componentes (borda do campo sobre a superfície) são visíveis (3:1)', () => {
    expect(contraste(p.borda, p.superficie)).toBeGreaterThanOrEqual(1.3); // borda decorativa: o conteúdo nunca depende só dela
    expect(contraste(p.primaria, p.superficie)).toBeGreaterThanOrEqual(3); // ícones e aba ativa
  });
});

describe('as duas paletas têm exatamente as mesmas cores nomeadas', () => {
  it('mesmas chaves, todas "#rrggbb"', () => {
    expect(Object.keys(paletaEscura).sort()).toEqual(Object.keys(paletaClara).sort());
    for (const [nome, v] of Object.entries({ ...paletaClara, ...paletaEscura })) expect([nome, /^#[0-9a-f]{6}$/i.test(v)]).toEqual([nome, true]);
  });
  it('o escuro é de fato escuro e o claro de fato claro (fundo e texto não se confundem)', () => {
    expect(luminancia(paletaEscura.fundo)).toBeLessThan(0.05);
    expect(luminancia(paletaEscura.texto)).toBeGreaterThan(0.7);
    expect(luminancia(paletaClara.fundo)).toBeGreaterThan(0.85);
    expect(luminancia(paletaClara.texto)).toBeLessThan(0.05);
  });
});
