import { adicionarPonto, CENTRO_PADRAO, distanciaM, fmtMetros, MAX_CAMINHO, MAX_PONTOS, metrosEmLinhaReta, montarRota, moverPonto, novoPonto, removerUltimo, reduzirCaminho, rotaValida, rotuloDoPonto, textoDoTrecho } from '../trecho';

const P = (lat: number, lng: number) => ({ lat, lng });

describe('pontos do trecho', () => {
  it('arredonda para 6 casas (cerca de 10 cm)', () => expect(novoPonto(-23.50416789, -46.281190123)).toEqual({ lat: -23.504168, lng: -46.28119 }));
  it('adiciona na ordem: o primeiro é o início e o último é o fim', () => {
    let pts = adicionarPonto([], P(-23.5, -46.3)); pts = adicionarPonto(pts, P(-23.51, -46.31)); pts = adicionarPonto(pts, P(-23.52, -46.32));
    expect(pts).toHaveLength(3);
    expect([0, 1, 2].map((i) => rotuloDoPonto(i, 3))).toEqual(['Início', 'Ponto 2', 'Fim']);
    expect(rotuloDoPonto(0, 1)).toBe('Início'); // com um ponto só ainda é o início
  });
  it(`aceita até ${MAX_PONTOS} pontos e recusa o seguinte com mensagem clara`, () => {
    let pts: ReturnType<typeof adicionarPonto> = [];
    for (let i = 0; i < MAX_PONTOS; i++) pts = adicionarPonto(pts, P(-23.5 - i / 1000, -46.3));
    expect(pts).toHaveLength(25);
    expect(() => adicionarPonto(pts, P(-24, -46))).toThrow('No máximo 25 pontos por trecho.');
  });
  it('recusa coordenada impossível', () => {
    expect(() => adicionarPonto([], P(91, 0))).toThrow(RangeError);
    expect(() => moverPonto([P(1, 1)], 0, P(0, 181))).toThrow(RangeError);
  });
  it('mover troca só o ponto escolhido; desfazer tira o último e não altera o original', () => {
    const pts = [P(1, 1), P(2, 2), P(3, 3)];
    expect(moverPonto(pts, 1, P(9, 9))).toEqual([P(1, 1), P(9, 9), P(3, 3)]);
    expect(removerUltimo(pts)).toEqual([P(1, 1), P(2, 2)]);
    expect(pts).toHaveLength(3);
    expect(removerUltimo([])).toEqual([]);
  });
});

describe('distâncias', () => {
  it('haversine: 1 grau de latitude ≈ 111 km', () => expect(Math.round(distanciaM(P(0, 0), P(1, 0)) / 1000)).toBe(111));
  it('linha reta soma os segmentos; com menos de 2 pontos é 0', () => {
    expect(metrosEmLinhaReta([P(0, 0), P(0, 0.001), P(0, 0.002)])).toBe(Math.round(distanciaM(P(0, 0), P(0, 0.002))));
    expect(metrosEmLinhaReta([P(1, 1)])).toBe(0);
    expect(metrosEmLinhaReta([])).toBe(0);
  });
  it('formata como o sistema web: metros ou quilômetros com vírgula', () => {
    expect(fmtMetros(350)).toBe('350 m');
    expect(fmtMetros(1850)).toBe('1,85 km');
    expect(fmtMetros(999.6)).toBe('1000 m');
  });
});

describe('reduzirCaminho (o servidor corta em 700: o fim do trecho não pode sumir)', () => {
  const caminho = (n: number): Array<[number, number]> => Array.from({ length: n }, (_, i) => [-23 - i / 10000, -46 + i / 10000]);
  it('caminho pequeno passa intacto', () => expect(reduzirCaminho(caminho(10))).toHaveLength(10));
  it(`caminho grande vira no máximo ${MAX_CAMINHO} pontos, com o primeiro e o último`, () => {
    const c = caminho(2500); const r = reduzirCaminho(c);
    expect(r).toHaveLength(MAX_CAMINHO);
    expect(r[0]).toEqual(c[0]);
    expect(r[r.length - 1]).toEqual(c[c.length - 1]);
  });
  it('descarta pontos inválidos', () => expect(reduzirCaminho([[1, 2], [NaN, 3], [4, 5]])).toEqual([[1, 2], [4, 5]]));
});

describe('montarRota', () => {
  it('menos de 2 pontos não é trecho', () => { expect(montarRota([])).toBeNull(); expect(montarRota([P(1, 1)])).toBeNull(); });
  it('offline: linha reta (sem caminho) com a distância em linha reta', () => {
    const r = montarRota([P(-23.5, -46.3), P(-23.5, -46.29)])!;
    expect(r.caminho).toEqual([]);
    expect(r.metros).toBe(metrosEmLinhaReta([P(-23.5, -46.3), P(-23.5, -46.29)]));
  });
  it('com a resposta do servidor: pontos ajustados à rua, distância por vias e caminho reduzido', () => {
    const caminho = Array.from({ length: 2000 }, (_, i) => [-23.5 - i / 1e5, -46.3] as [number, number]);
    const r = montarRota([P(-23.5, -46.3), P(-23.52, -46.3)], { pontos: [P(-23.50001, -46.30002), P(-23.51999, -46.30001)], metros: 2201.4, caminho })!;
    expect(r.pontos[0]).toEqual({ lat: -23.50001, lng: -46.30002 });
    expect(r.metros).toBe(2201);
    expect(r.caminho).toHaveLength(MAX_CAMINHO);
  });
  it('resposta com número diferente de pontos é ignorada nos pontos (mantém os tocados)', () => {
    const r = montarRota([P(1, 1), P(2, 2)], { pontos: [P(5, 5)], metros: 10, caminho: [] })!;
    expect(r.pontos).toEqual([P(1, 1), P(2, 2)]);
  });
});

it('rotaValida confere quantidade e coordenadas', () => {
  expect(rotaValida({ pontos: [P(1, 1), P(2, 2)], metros: 10, caminho: [] })).toBe(true);
  expect(rotaValida({ pontos: [P(1, 1)], metros: 0, caminho: [] })).toBe(false);
  expect(rotaValida({ pontos: [P(1, 1), P(99, 2)], metros: 0, caminho: [] })).toBe(false);
  expect(rotaValida({ pontos: Array.from({ length: 26 }, (_, i) => P(i / 100, 1)), metros: 0, caminho: [] })).toBe(false);
  expect(rotaValida({ pontos: [P(1, 1), P(2, 2)], metros: -1, caminho: [] })).toBe(false);
});

it('textoDoTrecho sugere "início → fim" com coordenadas', () => {
  expect(textoDoTrecho([P(-23.50416, -46.28119), P(-23.51, -46.29)])).toBe('-23.50416, -46.28119 → -23.51000, -46.29000');
  expect(textoDoTrecho([P(1, 1)])).toBe('');
  expect(CENTRO_PADRAO.lat).toBeCloseTo(-23.54, 1);
});
