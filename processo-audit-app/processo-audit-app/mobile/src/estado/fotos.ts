import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { dimensoesAlvo, QUALIDADE_JPEG } from '@/domain/foto';
import { guardarFotoNoApp, portaArquivos } from './arquivos';

export interface FotoBruta { uri: string; width: number; height: number }

/**
 * Comprime no aparelho (lado maior de 1280 px, JPEG 0,7 — qualquer formato de origem, inclusive HEIC, sai JPEG), guarda no
 * diretório do app e apaga o arquivo temporário. Os MESMOS bytes serão enviados em todo reenvio: nunca recomprimir.
 */
export const prepararFoto = async (bruta: FotoBruta, nome: string): Promise<{ uri: string; tamanho: number }> => {
  const contexto = ImageManipulator.manipulate(bruta.uri);
  const alvo = dimensoesAlvo(bruta.width, bruta.height);
  if (alvo) contexto.resize(alvo);
  const imagem = await contexto.renderAsync();
  const comprimida = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: QUALIDADE_JPEG });
  try {
    return await guardarFotoNoApp(comprimida.uri, nome);
  } finally {
    await portaArquivos.apagar(comprimida.uri).catch(() => undefined);
    await portaArquivos.apagar(bruta.uri).catch(() => undefined); // cópia temporária da câmera/galeria; nunca o arquivo original do usuário
  }
};

const paraBruta = (r: ImagePicker.ImagePickerResult): FotoBruta[] => (r.canceled ? [] : r.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height })));

/** Galeria com seleção múltipla, limitada ao que ainda cabe na OS. */
export const escolherDaGaleria = async (limite: number): Promise<FotoBruta[]> =>
  paraBruta(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: Math.max(1, limite), quality: 1 }));

/** No Android o sistema pode encerrar o app enquanto a galeria está aberta; isto recupera a escolha que ficou pendente. */
export const recuperarGaleriaPendente = async (): Promise<FotoBruta[]> => {
  const r = await ImagePicker.getPendingResultAsync().catch(() => null);
  return r && 'assets' in r && r.assets ? r.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height })) : [];
};
