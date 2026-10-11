import { normalizarUrlServidor } from '../servidor';

describe('normalizarUrlServidor', () => {
  it.each([
    ['10.100.100.130:5002', 'http://10.100.100.130:5002/api'],
    ['http://10.100.100.130:5002', 'http://10.100.100.130:5002/api'],
    ['  http://10.100.100.130:5002/  ', 'http://10.100.100.130:5002/api'],
    ['http://10.100.100.130:5002/api', 'http://10.100.100.130:5002/api'],
    ['http://10.100.100.130:5002/api/', 'http://10.100.100.130:5002/api'],
    ['https://os.exemplo.com.br', 'https://os.exemplo.com.br/api'],
    ['https://os.exemplo.com.br/sistema', 'https://os.exemplo.com.br/sistema/api'],
    ['HTTPS://os.exemplo.com.br/API', 'https://os.exemplo.com.br/API'],
    ['localhost:5000', 'http://localhost:5000/api'],
  ])('%s -> %s', (entrada, esperado) => {
    expect(normalizarUrlServidor(entrada)).toEqual({ ok: true, url: esperado });
  });
  it.each(['', '   ', 'ftp://servidor', 'http://', 'http:// espaço'])('recusa %p', (entrada) => {
    expect(normalizarUrlServidor(entrada).ok).toBe(false);
  });
});
