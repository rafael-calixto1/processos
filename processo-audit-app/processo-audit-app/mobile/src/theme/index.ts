/**
 * Identidade do web (verde #0ba52b, lima #bbf804, escuro #274518), ajustada para uso ao ar livre: contraste alto e alvos grandes.
 * Duas paletas com os MESMOS nomes. Quem desenha pega a do momento com `useCores()` / `useEstilos()` (estado/tema.ts).
 */
export const paletaClara = {
  primaria: '#0ba52b', // detalhes, ícones, aba ativa (não usar como cor de texto sobre branco: contraste baixo)
  primariaBotao: '#087f21', // texto branco sobre esta cor passa de 5:1
  primariaEscura: '#274518', // título e texto de destaque sobre as superfícies
  destaqueFundo: '#274518', // fundo do cabeçalho e dos chips ativos (sempre com texto branco por cima)
  sobreDestaqueSuave: '#e6f9ec', // subtítulo sobre o destaqueFundo
  secundaria: '#bbf804',
  primariaClara: '#e6f9ec',
  fundo: '#f3f7f4',
  superficie: '#ffffff',
  borda: '#d3dcd5',
  texto: '#14231a',
  textoSuave: '#4a5d50',
  desabilitado: '#9aa89f',
  erro: '#b42318', erroClaro: '#fee4e2',
  aviso: '#93370d', avisoClaro: '#fef0c7',
  info: '#175cd3', infoClaro: '#d1e9ff',
  sucesso: '#067647', sucessoClaro: '#d1fadf',
  neutroClaro: '#e8eeea',
};
export type Paleta = typeof paletaClara;

/** Tema escuro: fundo quase preto esverdeado, textos claros e os mesmos verdes da marca nos botões. Contraste conferido em teste. */
export const paletaEscura: Paleta = {
  primaria: '#34d058',
  primariaBotao: '#1b7f33',
  primariaEscura: '#a6ecb9',
  destaqueFundo: '#1d3a12',
  sobreDestaqueSuave: '#bfe6c9',
  secundaria: '#bbf804',
  primariaClara: '#17301c',
  fundo: '#0e1511',
  superficie: '#17211a',
  borda: '#34463a',
  texto: '#e9f2eb',
  textoSuave: '#aabdb0',
  desabilitado: '#74877b',
  erro: '#ff9a90', erroClaro: '#3b1c1a',
  aviso: '#ffc66e', avisoClaro: '#3a2d12',
  info: '#97caff', infoClaro: '#14293f',
  sucesso: '#74e6a5', sucessoClaro: '#12362a',
  neutroClaro: '#243028',
};

export const espaco = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const raio = { sm: 8, md: 12, lg: 16, pilula: 999 } as const;
/** Fonte maior que o padrão: leitura sob sol forte e com uma mão. */
export const fonte = { pequena: 14, corpo: 16, destaque: 18, titulo: 22, grande: 28 } as const;
/** Área mínima de toque (dp) recomendada para uso com luvas. */
export const ALVO_MINIMO = 48;

export type Tom = 'neutro' | 'sucesso' | 'aviso' | 'erro' | 'info' | 'marca';
export type Tons = Record<Tom, { fundo: string; texto: string }>;
/** Cores de cada tom de aviso/selo na paleta dada. */
export const tonsDe = (c: Paleta): Tons => ({
  neutro: { fundo: c.neutroClaro, texto: c.texto },
  sucesso: { fundo: c.sucessoClaro, texto: c.sucesso },
  aviso: { fundo: c.avisoClaro, texto: c.aviso },
  erro: { fundo: c.erroClaro, texto: c.erro },
  info: { fundo: c.infoClaro, texto: c.info },
  marca: { fundo: c.primariaClara, texto: c.primariaEscura },
});
