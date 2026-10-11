import type { Operacao } from '../operacoes';
import { dimensoesAlvo, LADO_MAXIMO_PX, nomeDeFoto, QUALIDADE_JPEG, situacaoDaFoto } from '../foto';

describe('dimensoesAlvo (1280 px no lado maior)', () => {
  it('reduz foto de celular mantendo a proporção', () => {
    expect(dimensoesAlvo(4000, 3000)).toEqual({ width: 1280, height: 960 });
    expect(dimensoesAlvo(3000, 4000)).toEqual({ width: 960, height: 1280 });
    expect(dimensoesAlvo(4624, 3468)).toEqual({ width: 1280, height: 960 });
  });
  it('foto que já cabe não é reduzida (nunca amplia)', () => {
    expect(dimensoesAlvo(1280, 720)).toBeNull();
    expect(dimensoesAlvo(800, 600)).toBeNull();
  });
  it('valores impossíveis não quebram', () => {
    expect(dimensoesAlvo(0, 0)).toBeNull();
    expect(dimensoesAlvo(5000, 0)).toBeNull();
    expect(dimensoesAlvo(10000, 1)).toEqual({ width: 1280, height: 1 });
  });
  it('constantes combinam com o combinado: 1280 px e JPEG 0,7', () => {
    expect(LADO_MAXIMO_PX).toBe(1280);
    expect(QUALIDADE_JPEG).toBe(0.7);
  });
});

it('nomes de arquivo são únicos para instantes ou sorteios diferentes', () => {
  expect(nomeDeFoto(1000, 0.1)).not.toBe(nomeDeFoto(1001, 0.1));
  expect(nomeDeFoto(1000, 0.1)).not.toBe(nomeDeFoto(1000, 0.2));
  expect(nomeDeFoto(1000, 0.5)).toMatch(/^foto-[a-z0-9]+-[a-z0-9]+$/);
});

describe('situacaoDaFoto', () => {
  const op = (estado: Operacao['estado'], uuid = 'u1') => ({ tipo: 'foto', estado, payload: { campos: { client_uuid: uuid } } }) as unknown as Operacao;
  const foto = { client_uuid: 'u1', servidor_id: null as number | null };
  it('segue o envio: aguardando → enviando → enviada', () => {
    expect(situacaoDaFoto(foto, [op('pendente')])).toBe('aguardando');
    expect(situacaoDaFoto(foto, [op('enviando')])).toBe('enviando');
    expect(situacaoDaFoto(foto, [op('ok')])).toBe('enviada');
  });
  it('recusada pelo servidor pede atenção', () => expect(situacaoDaFoto(foto, [op('atencao')])).toBe('erro'));
  it('com o id do servidor guardado já foi enviada, mesmo que a operação tenha sido apagada do histórico', () => {
    expect(situacaoDaFoto({ ...foto, servidor_id: 77 }, [])).toBe('enviada');
  });
  it('só olha a operação da própria foto', () => {
    expect(situacaoDaFoto(foto, [op('atencao', 'outra')])).toBe('aguardando');
  });
});
