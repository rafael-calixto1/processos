// Checklist de publicação (scripts/verificar-publicacao.cjs): o que bloqueia um build de verdade e o que só avisa.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { verificar } = require('../scripts/verificar-publicacao.cjs') as { verificar: (e: any) => Array<{ id: string; ok: boolean; obrigatorio: boolean }> };

const app = (extra: Record<string, unknown> = {}) => ({ version: '1.0.0', android: { package: 'br.com.empresa.app', versionCode: 1 }, extra: { eas: { projectId: 'abc' } }, updates: { url: 'https://u.expo.dev/abc' }, ...extra });
const eas = (url: string) => ({ build: { preview: { env: { EXPO_PUBLIC_API_URL: url } }, production: { env: { EXPO_PUBLIC_API_URL: url } } } });
const pronto = (sobrescrever: Record<string, unknown> = {}) => ({ app: app(), eas: eas('https://api.empresa.com.br/api'), arquivosExistem: [true, true, true, true], repositorioLimpo: true, identificadorConfirmado: true, soPreview: false, ...sobrescrever });
const faltando = (e: any) => verificar(e).filter((i) => !i.ok && i.obrigatorio).map((i) => i.id).sort();

describe('checklist de publicação', () => {
  it('tudo em ordem: nada pendente', () => { expect(faltando(pronto())).toEqual([]); });

  it('URL de modelo, http, localhost e exemplo NÃO valem (o Android bloqueia http em build de produção)', () => {
    for (const ruim of ['https://api.SEU-DOMINIO.com.br/api', 'http://api.empresa.com.br/api', 'https://localhost:5002/api', 'https://api.exemplo.com/api', '', 'api.empresa.com.br']) {
      expect(faltando(pronto({ eas: eas(ruim) }))).toEqual(['url-preview', 'url-production']);
    }
    expect(faltando(pronto({ eas: eas('https://os.conexaoweb.com.br/api') }))).toEqual([]);
  });

  it('sem projeto EAS, sem URL de atualização ou identificador não confirmado: pendente na produção', () => {
    expect(faltando(pronto({ app: app({ extra: {} }) }))).toEqual(['projeto-eas']);
    expect(faltando(pronto({ app: app({ updates: {} }) }))).toEqual(['atualizacao-pelo-ar']);
    expect(faltando(pronto({ identificadorConfirmado: false }))).toEqual(['identificador']);
  });

  it('APK de teste interno (--preview) não exige projeto EAS, atualização pelo ar, identificador nem URL de produção; ainda exige URL https de preview, commit e ícones', () => {
    const teste = pronto({ soPreview: true, app: app({ extra: {}, updates: {} }), identificadorConfirmado: false, eas: { build: { preview: { env: { EXPO_PUBLIC_API_URL: 'https://api.empresa.com.br/api' } }, production: { env: { EXPO_PUBLIC_API_URL: 'https://api.SEU-DOMINIO.com.br/api' } } } } });
    expect(faltando(teste)).toEqual([]);
    expect(faltando({ ...teste, eas: eas('http://10.0.0.5:5002/api') })).toEqual(['url-preview']);
    expect(faltando({ ...teste, repositorioLimpo: false })).toEqual(['repositorio-limpo']);
    expect(faltando({ ...teste, arquivosExistem: [true, false, true, true] })).toEqual(['icones']);
  });

  it('versão e código de versão precisam existir', () => {
    expect(faltando(pronto({ app: app({ version: undefined }) }))).toEqual(['versao']);
    expect(faltando(pronto({ app: app({ android: { package: 'a.b', versionCode: '1' } }) }))).toEqual(['versao']);
  });
});
