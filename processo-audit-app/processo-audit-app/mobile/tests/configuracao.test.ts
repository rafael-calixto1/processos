/**
 * Confere o app.json (o que vira o manifesto do Android e o Info.plist do iOS) e os arquivos de imagem. Existe porque a
 * geração nativa de teste mostrou a permissão de CÂMERA removida por um plugin: no aparelho o QR e as fotos não funcionariam.
 */
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(__dirname, '..');
const app = JSON.parse(fs.readFileSync(path.join(raiz, 'app.json'), 'utf8')).expo;
const plugin = (nome: string): Record<string, unknown> | null => {
  const p = app.plugins.find((x: unknown) => x === nome || (Array.isArray(x) && x[0] === nome));
  return p === undefined ? null : Array.isArray(p) ? (p[1] as Record<string, unknown>) : {};
};
const dimensoes = (arquivo: string) => {
  const b = fs.readFileSync(path.join(raiz, arquivo));
  return { largura: b.readUInt32BE(16), altura: b.readUInt32BE(20), assinatura: b.subarray(1, 4).toString() };
};

describe('permissões (textos em português, nenhuma removida por engano)', () => {
  it('câmera: o plugin da câmera pede com texto; o seletor de fotos NÃO pode tirar a permissão (cameraPermission:false a remove do manifesto)', () => {
    const camera = plugin('expo-camera')!;
    expect(typeof camera.cameraPermission).toBe('string');
    expect(String(camera.cameraPermission).length).toBeGreaterThan(20);
    expect(camera.cameraPermission).toMatch(/QR|foto/i);
    expect(plugin('expo-image-picker')!.cameraPermission).not.toBe(false);
  });
  it('microfone nunca é pedido', () => {
    expect(plugin('expo-camera')!.microphonePermission).toBe(false);
    expect(plugin('expo-camera')!.recordAudioAndroid).toBe(false);
    expect(plugin('expo-image-picker')!.microphonePermission).toBe(false);
  });
  it('localização e fotos explicam para que servem', () => {
    expect(String(plugin('expo-location')!.locationWhenInUsePermission)).toMatch(/localização/i);
    expect(String(plugin('expo-image-picker')!.photosPermission)).toMatch(/fotos/i);
  });
});

describe('identidade visual', () => {
  it('ícone do app: PNG quadrado de 1024 px (o iOS exige exatamente quadrado)', () => {
    expect(app.icon).toBe('./assets/icon.png');
    expect(dimensoes('assets/icon.png')).toEqual({ largura: 1024, altura: 1024, assinatura: 'PNG' });
  });
  it('ícone adaptativo do Android: fundo verde-escuro da marca, primeiro plano e versão monocromática; sem imagem de fundo (só uma das duas)', () => {
    const a = app.android.adaptiveIcon;
    expect(a.backgroundColor).toBe('#274518');
    expect(a.backgroundImage).toBeUndefined();
    for (const chave of ['foregroundImage', 'monochromeImage']) {
      expect(fs.existsSync(path.join(raiz, a[chave]))).toBe(true);
      expect(dimensoes(a[chave].replace('./', ''))).toMatchObject({ largura: 1024, altura: 1024 });
    }
  });
  it('splash pelo plugin expo-splash-screen (imagem PNG existente, fundo da marca)', () => {
    const s = plugin('expo-splash-screen')!;
    expect(s).not.toBeNull();
    expect(s.backgroundColor).toBe('#274518');
    expect(fs.existsSync(path.join(raiz, String(s.image)))).toBe(true);
    expect(String(s.image)).toMatch(/\.png$/);
    expect(app.plugins.filter((x: unknown) => x === 'expo-splash-screen' || (Array.isArray(x) && x[0] === 'expo-splash-screen'))).toHaveLength(1);
  });
  it('tema escuro liberado (o app segue o aparelho ou a escolha do técnico)', () => {
    expect(app.userInterfaceStyle).toBe('automatic');
    expect(JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8')).dependencies['expo-system-ui']).toBeDefined();
  });
  it('nenhum arquivo de imagem do modelo padrão do Expo ficou para trás', () => {
    expect(fs.existsSync(path.join(raiz, 'assets/android-icon-background.png'))).toBe(false);
  });
});

describe('build e distribuição (EAS)', () => {
  const eas = JSON.parse(fs.readFileSync(path.join(raiz, 'eas.json'), 'utf8'));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const gerarConfig = require('../app.config.js') as ((a: { config: Record<string, any> }) => Record<string, any>) & { PERMISSOES_QUE_O_APP_NAO_USA: string[] };
  const comPerfil = (perfil: string | undefined) => {
    const antes = process.env.EAS_BUILD_PROFILE;
    if (perfil === undefined) delete process.env.EAS_BUILD_PROFILE; else process.env.EAS_BUILD_PROFILE = perfil;
    try { return gerarConfig({ config: app }); } finally { if (antes === undefined) delete process.env.EAS_BUILD_PROFILE; else process.env.EAS_BUILD_PROFILE = antes; }
  };

  it('perfis: development (cliente de desenvolvimento), preview (APK interno) e production (pacote da loja, versão automática)', () => {
    expect(eas.build.development).toMatchObject({ developmentClient: true, distribution: 'internal' });
    expect(eas.build.preview).toMatchObject({ distribution: 'internal', channel: 'preview', android: { buildType: 'apk' } });
    expect(eas.build.production).toMatchObject({ distribution: 'store', channel: 'production', autoIncrement: true, android: { buildType: 'app-bundle' } });
    expect(eas.cli.appVersionSource).toBe('remote'); // o número da versão do Android é controlado pelo EAS, não por arquivo editado à mão
    for (const perfil of ['development', 'preview', 'production']) expect(typeof eas.build[perfil].env.EXPO_PUBLIC_API_URL).toBe('string');
  });

  it('identificação: versionCode e buildNumber iniciais, atualização por versão do app e sem pergunta de criptografia na Apple', () => {
    expect(Number.isInteger(app.android.versionCode) && app.android.versionCode >= 1).toBe(true);
    expect(app.ios.buildNumber).toMatch(/^\d+$/);
    expect(app.runtimeVersion).toEqual({ policy: 'appVersion' });
    expect(app.ios.config.usesNonExemptEncryption).toBe(false);
    expect(app.android.package).toMatch(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);
    expect(app.ios.bundleIdentifier).toBe(app.android.package);
    expect(JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8')).dependencies['expo-updates']).toBeDefined(); // sem ele um build nunca receberia atualização pelo ar
  });

  it('nome e identificador seguem a marca: "CW Campo", br.net.cwtelecom.* (padrão do app de TV da empresa) e slug do Expo coerente', () => {
    expect(app.name).toBe('CW Campo');
    expect(app.slug).toBe('cw-campo');
    expect(app.android.package).toBe('br.net.cwtelecom.campo');
    expect(app.ios.bundleIdentifier).toBe(app.android.package);
    expect(app.scheme).toBe('cwcampo');
    expect(JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8')).name).toBe(app.slug);
  });

  it('http (sem certificado) só nos perfis de TESTE (development e preview); produção e prebuild local nunca', () => {
    const temHttp = (perfil: string | undefined) => (comPerfil(perfil).plugins as unknown[]).some((p) => Array.isArray(p) && p[0] === 'expo-build-properties' && (p[1] as any)?.android?.usesCleartextTraffic === true);
    expect(temHttp('preview')).toBe(true);
    expect(temHttp('development')).toBe(true);
    expect(temHttp('production')).toBe(false);
    expect(temHttp(undefined)).toBe(false);
    expect(JSON.stringify(app.plugins)).not.toMatch(/usesCleartextTraffic/); // nunca no app.json estático
    expect(eas.build.production.env.EXPO_PUBLIC_API_URL).not.toMatch(/^http:/); // e a URL de produção nunca é http
    expect(comPerfil('preview').plugins.length).toBe(app.plugins.length + 1); // o resto dos plugins passa intacto
  });

  it('dados do aparelho não vão para a nuvem do Google (restaurar a fila de envio em outro celular repetiria operações)', () => {
    expect(app.android.allowBackup).toBe(false);
  });

  it('permissões: build normal bloqueia o que o app não usa; o de desenvolvimento não bloqueia nada; câmera, localização e internet nunca são bloqueadas', () => {
    expect(gerarConfig.PERMISSOES_QUE_O_APP_NAO_USA).toEqual(expect.arrayContaining(['android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.VIBRATE']));
    for (const perfil of ['preview', 'production', undefined]) {
      const bloqueadas = comPerfil(perfil).android.blockedPermissions as string[];
      expect(bloqueadas).toEqual(expect.arrayContaining(['android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.VIBRATE']));
      for (const usada of ['android.permission.CAMERA', 'android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION', 'android.permission.INTERNET']) expect(bloqueadas).not.toContain(usada);
    }
    expect(comPerfil('development').android.blockedPermissions).toEqual([]);
    expect(comPerfil('preview').android.adaptiveIcon).toEqual(app.android.adaptiveIcon); // o resto da configuração passa intacto
  });
});
