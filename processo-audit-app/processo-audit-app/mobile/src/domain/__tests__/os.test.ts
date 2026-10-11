import { enderecoLinha, fimDoPrazo, isPendente, ordenarPorPrazo, redeLinha, slaInfo, urlMapa } from '../os';

/* Cópia LITERAL de slaInfo em frontend/src/pages/fieldwork/ui.jsx, para provar a paridade. */
const slaInfoWeb = (deadlineIso: string | null, now = Date.now()) => {
  if (!deadlineIso) return { label: 'Sem prazo', state: 'on_time' };
  const ms = new Date(deadlineIso).getTime() - now;
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600000); const m = Math.floor((abs % 3600000) / 60000);
  const txt = h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${String(m).padStart(2, '0')}min`;
  if (ms < 0) return { label: `Estourado há ${txt}`, state: 'breached' };
  return { label: `Restam ${txt}`, state: ms < 4 * 3600000 ? 'at_risk' : 'on_time' };
};
const ESTADO_WEB = { breached: 'estourado', at_risk: 'em_risco', on_time: 'no_prazo' } as const;

describe('slaInfo', () => {
  const agora = new Date('2026-10-11T10:00:00').getTime();

  it('conta até o fim do dia do prazo, com os textos do web', () => {
    expect(slaInfo('2026-10-11', agora)).toEqual({ label: 'Restam 13h 59min', estado: 'no_prazo' });
    expect(slaInfo('2026-10-14', agora)).toEqual({ label: 'Restam 3d 13h', estado: 'no_prazo' });
    expect(slaInfo('2026-10-10', agora)).toEqual({ label: 'Estourado há 10h 00min', estado: 'estourado' });
    expect(slaInfo('2026-10-01', agora)).toEqual({ label: 'Estourado há 9d 10h', estado: 'estourado' });
  });
  it('fica "em risco" nas últimas 4 horas', () => {
    expect(slaInfo('2026-10-11', new Date('2026-10-11T20:00:00').getTime())).toMatchObject({ estado: 'em_risco', label: 'Restam 3h 59min' });
    expect(slaInfo('2026-10-11', new Date('2026-10-11T19:59:59').getTime()).estado).toBe('no_prazo');
  });
  it('sem prazo (ou prazo inválido)', () => {
    expect(slaInfo(null, agora)).toEqual({ label: 'Sem prazo', estado: 'sem_prazo' });
    expect(slaInfo('lixo', agora).estado).toBe('sem_prazo');
  });
  it('aceita prazo com hora anexada (usa só a data)', () => {
    expect(slaInfo('2026-10-11T00:00:00.000Z', agora)).toEqual(slaInfo('2026-10-11', agora));
  });
  it('é igual ao web em instantes aleatórios', () => {
    let s = 12345;
    const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
    for (let i = 0; i < 500; i++) {
      const dia = 1 + Math.floor(rnd() * 28);
      const prazo = `2026-10-${String(dia).padStart(2, '0')}`;
      const t = new Date(2026, 9, 1 + Math.floor(rnd() * 30), Math.floor(rnd() * 24), Math.floor(rnd() * 60)).getTime();
      const web = slaInfoWeb(`${prazo}T23:59:59`, t);
      const nosso = slaInfo(prazo, t);
      expect(nosso.label).toBe(web.label);
      expect(nosso.estado).toBe(ESTADO_WEB[web.state as keyof typeof ESTADO_WEB]);
    }
  });
  it('fimDoPrazo devolve null sem prazo', () => {
    expect(fimDoPrazo(null)).toBeNull();
    expect(fimDoPrazo('2026-10-11')?.getHours()).toBe(23);
  });
});

describe('ordenarPorPrazo', () => {
  it('prazo mais próximo primeiro, sem prazo por último, empate pelo número', () => {
    const lista = [
      { numero: 5, prazo: null }, { numero: 3, prazo: '2026-10-20' }, { numero: 2, prazo: '2026-10-12' },
      { numero: 4, prazo: '2026-10-12' }, { numero: 1, prazo: null },
    ];
    expect(ordenarPorPrazo(lista).map((o) => o.numero)).toEqual([2, 4, 3, 1, 5]);
    expect(lista[0].numero).toBe(5); // não altera a lista original
  });
});

describe('endereço, mapa e rede', () => {
  const vazio = { endereco: null, logradouro: null, numero_endereco: null, bairro: null, cidade: null, uf: null, latitude: null, longitude: null };
  it('usa o endereço livre ou monta pelos campos estruturados', () => {
    expect(enderecoLinha({ ...vazio, endereco: '  Rua A, 10 ' })).toBe('Rua A, 10');
    expect(enderecoLinha({ ...vazio, logradouro: 'Estrada Takashi Kobata', numero_endereco: '572', bairro: 'Centro', cidade: 'Suzano', uf: 'SP' })).toBe('Estrada Takashi Kobata, 572 · Centro · Suzano/SP');
    expect(enderecoLinha(vazio)).toBe('');
  });
  it('mapa: coordenadas quando há, senão busca pelo endereço, senão nada', () => {
    expect(urlMapa({ ...vazio, latitude: -23.5445, longitude: -46.3118 })).toBe('https://www.google.com/maps/search/?api=1&query=-23.5445,-46.3118');
    expect(urlMapa({ ...vazio, endereco: 'Rua A, 10 São Paulo' })).toBe('https://www.google.com/maps/search/?api=1&query=Rua%20A%2C%2010%20S%C3%A3o%20Paulo');
    expect(urlMapa(vazio)).toBeNull();
  });
  it('rede e pendência', () => {
    expect(redeLinha({ pop_nome: 'POP Centro', rota_id: null, poste_id: 'PL-0932' })).toBe('POP Centro · PL-0932');
    expect(isPendente('aberta') && isPendente('em_andamento') && !isPendente('concluida') && !isPendente('cancelada')).toBe(true);
  });
});
