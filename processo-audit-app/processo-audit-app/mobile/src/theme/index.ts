/** Identidade do web (verde #0ba52b, lima #bbf804, escuro #274518), ajustada para uso ao ar livre: contraste alto e alvos grandes. */
export const cores = {
  primaria: '#0ba52b', // detalhes, ícones, aba ativa (não usar como cor de texto sobre branco: contraste baixo)
  primariaBotao: '#087f21', // texto branco sobre esta cor passa de 5:1
  primariaEscura: '#274518',
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
} as const;

export const espaco = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const raio = { sm: 8, md: 12, lg: 16, pilula: 999 } as const;
/** Fonte maior que o padrão: leitura sob sol forte e com uma mão. */
export const fonte = { pequena: 14, corpo: 16, destaque: 18, titulo: 22, grande: 28 } as const;
/** Área mínima de toque (dp) recomendada para uso com luvas. */
export const ALVO_MINIMO = 48;

export type Tom = 'neutro' | 'sucesso' | 'aviso' | 'erro' | 'info' | 'marca';
export const tons: Record<Tom, { fundo: string; texto: string }> = {
  neutro: { fundo: cores.neutroClaro, texto: cores.texto },
  sucesso: { fundo: cores.sucessoClaro, texto: cores.sucesso },
  aviso: { fundo: cores.avisoClaro, texto: cores.aviso },
  erro: { fundo: cores.erroClaro, texto: cores.erro },
  info: { fundo: cores.infoClaro, texto: cores.info },
  marca: { fundo: cores.primariaClara, texto: cores.primariaEscura },
};
