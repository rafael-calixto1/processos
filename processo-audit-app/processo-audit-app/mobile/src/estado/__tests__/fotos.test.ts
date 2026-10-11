const mockResize = jest.fn();
const mockSalvar = jest.fn();
const mockGuardar = jest.fn();
const mockApagar = jest.fn(async (..._a: unknown[]) => undefined);
const mockLancar = jest.fn();
const mockPendente = jest.fn();
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: { manipulate: (uri: string) => ({ uri, resize: mockResize, renderAsync: async () => ({ saveAsync: mockSalvar }) }) },
}));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: (...a: unknown[]) => mockLancar(...a), getPendingResultAsync: (...a: unknown[]) => mockPendente(...a) }));
jest.mock('../arquivos', () => ({ guardarFotoNoApp: (...a: unknown[]) => mockGuardar(...a), portaArquivos: { apagar: (...a: unknown[]) => mockApagar(...a) } }));

import { escolherDaGaleria, prepararFoto, recuperarGaleriaPendente } from '../fotos';

beforeEach(() => {
  jest.clearAllMocks();
  mockSalvar.mockResolvedValue({ uri: 'file:///cache/comprimida.jpg' });
  mockGuardar.mockResolvedValue({ uri: 'file:///doc/fotos-os/foto-x.jpg', tamanho: 210_000 });
});

describe('prepararFoto', () => {
  it('reduz para 1280 px no lado maior, salva JPEG com qualidade 0,7 e guarda no diretório do app', async () => {
    const r = await prepararFoto({ uri: 'file:///cache/camera.jpg', width: 4000, height: 3000 }, 'foto-x');
    expect(mockResize).toHaveBeenCalledWith({ width: 1280, height: 960 });
    expect(mockSalvar).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.7 });
    expect(mockGuardar).toHaveBeenCalledWith('file:///cache/comprimida.jpg', 'foto-x');
    expect(r).toEqual({ uri: 'file:///doc/fotos-os/foto-x.jpg', tamanho: 210_000 });
  });
  it('foto pequena não é ampliada, mas é recomprimida como JPEG (HEIC/PNG viram JPEG)', async () => {
    await prepararFoto({ uri: 'file:///g/a.heic', width: 800, height: 600 }, 'foto-y');
    expect(mockResize).not.toHaveBeenCalled();
    expect(mockSalvar).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.7 });
  });
  it('apaga os temporários (a comprimida e a original da câmera/galeria) depois de guardar', async () => {
    await prepararFoto({ uri: 'file:///cache/camera.jpg', width: 4000, height: 3000 }, 'foto-x');
    expect(mockApagar).toHaveBeenCalledWith('file:///cache/comprimida.jpg');
    expect(mockApagar).toHaveBeenCalledWith('file:///cache/camera.jpg');
  });
  it('se não conseguir guardar, o erro sobe (e mesmo assim limpa os temporários)', async () => {
    mockGuardar.mockRejectedValue(new Error('sem espaço'));
    await expect(prepararFoto({ uri: 'file:///cache/camera.jpg', width: 4000, height: 3000 }, 'foto-x')).rejects.toThrow('sem espaço');
    expect(mockApagar).toHaveBeenCalledTimes(2);
  });
});

describe('galeria', () => {
  it('seleção múltipla limitada ao que cabe, só imagens', async () => {
    mockLancar.mockResolvedValue({ canceled: false, assets: [{ uri: 'a', width: 10, height: 20 }, { uri: 'b', width: 30, height: 40 }] });
    expect(await escolherDaGaleria(5)).toEqual([{ uri: 'a', width: 10, height: 20 }, { uri: 'b', width: 30, height: 40 }]);
    expect(mockLancar).toHaveBeenCalledWith({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 5, quality: 1 });
  });
  it('cancelar não devolve nada; limite zero ainda abre com 1 (o chamador já trava o botão)', async () => {
    mockLancar.mockResolvedValue({ canceled: true, assets: null });
    expect(await escolherDaGaleria(0)).toEqual([]);
    expect(mockLancar.mock.calls[0][0].selectionLimit).toBe(1);
  });
  it('recupera a escolha pendente quando o Android encerrou o app; sem pendência ou com erro, devolve vazio', async () => {
    mockPendente.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'p', width: 1, height: 2 }] });
    expect(await recuperarGaleriaPendente()).toEqual([{ uri: 'p', width: 1, height: 2 }]);
    mockPendente.mockResolvedValueOnce(null);
    expect(await recuperarGaleriaPendente()).toEqual([]);
    mockPendente.mockRejectedValueOnce(new Error('x'));
    expect(await recuperarGaleriaPendente()).toEqual([]);
  });
});
