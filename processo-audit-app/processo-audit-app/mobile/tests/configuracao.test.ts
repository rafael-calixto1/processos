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
