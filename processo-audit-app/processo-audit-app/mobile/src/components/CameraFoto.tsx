import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Botao } from '@/components/Botao';
import { abrirConfiguracoes } from '@/estado/configuracoes';
import { Carregando } from '@/components/Carregando';
import type { FotoBruta } from '@/estado/fotos';
import { espaco, fonte, type Paleta } from '@/theme';
import { useEstilos } from '@/estado/tema';

interface Props {
  /** Chamada a cada foto tirada; a câmera continua aberta para a próxima. Se falhar, o erro aparece aqui. */
  aoCapturar: (foto: FotoBruta) => Promise<void>;
  aoConcluir: () => void;
  totalTiradas: number;
}

/**
 * Câmera dentro do próprio app (não a câmera do sistema): no Android o sistema pode encerrar o app enquanto a câmera externa
 * está aberta e a foto se perde. Botão do disparo grande, para uso com luvas.
 */
export function CameraFoto({ aoCapturar, aoConcluir, totalTiradas }: Props) {
  const s = useEstilos(criarEstilos);
  const [permissao, pedir] = useCameraPermissions();
  const { top, bottom } = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const [pronta, setPronta] = useState(false);
  const [ocupada, setOcupada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!permissao) return <Carregando texto="Abrindo a câmera…" />;
  if (!permissao.granted) {
    return (
      <View style={[s.aviso, { paddingTop: top + espaco.xl, paddingBottom: bottom + espaco.xl }]}>
        <Text style={s.avisoTitulo} accessibilityRole="header">Precisamos da câmera</Text>
        <Text style={s.avisoTexto}>{permissao.canAskAgain ? 'Permita o uso da câmera para fotografar o serviço.' : 'A câmera está bloqueada para este aplicativo. Abra as Configurações do aparelho e permita o uso da câmera.'} Você também pode escolher fotos da galeria.</Text>
        {permissao.canAskAgain ? <Botao titulo="Permitir câmera" onPress={() => void pedir()} testID="camera-permitir" /> : <Botao titulo="Abrir configurações" onPress={() => void abrirConfiguracoes()} testID="camera-configuracoes" />}
        <Botao titulo="Voltar" variante="secundario" onPress={aoConcluir} testID="camera-concluir" />
      </View>
    );
  }

  const disparar = async () => {
    if (ocupada || !pronta || !camera.current) return;
    setOcupada(true); setErro(null);
    try {
      const foto = await camera.current.takePictureAsync({ quality: 1, skipProcessing: false });
      await aoCapturar({ uri: foto.uri, width: foto.width, height: foto.height });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível tirar a foto. Tente de novo.');
    } finally { setOcupada(false); }
  };

  return (
    <View style={s.tela}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setPronta(true)} />
      <View style={[s.topo, { paddingTop: top + espaco.md }]} pointerEvents="none">
        <Text style={s.dica} accessibilityLiveRegion="polite">{erro ?? (totalTiradas > 0 ? `${totalTiradas} foto${totalTiradas > 1 ? 's' : ''} nesta OS` : 'Enquadre o serviço e toque no botão redondo')}</Text>
      </View>
      <View style={[s.rodape, { paddingBottom: Math.max(bottom, espaco.lg) }]}>
        <Pressable onPress={() => void disparar()} disabled={ocupada || !pronta} accessibilityRole="button" accessibilityLabel="Tirar foto" accessibilityState={{ disabled: ocupada || !pronta, busy: ocupada }} testID="camera-disparar" style={[s.disparo, (ocupada || !pronta) && { opacity: 0.5 }]}>
          <View style={s.disparoInterno} />
        </Pressable>
        <Botao titulo="Concluir" variante="secundario" onPress={aoConcluir} testID="camera-concluir" estilo={{ alignSelf: 'stretch' }} />
      </View>
    </View>
  );
}

const criarEstilos = (cores: Paleta) => StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#000' },
  topo: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: espaco.lg, paddingBottom: espaco.md, backgroundColor: 'rgba(0,0,0,0.55)' },
  dica: { color: '#fff', fontSize: fonte.destaque, fontWeight: '700', textAlign: 'center' },
  rodape: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: espaco.lg, gap: espaco.md, alignItems: 'center' },
  disparo: { width: 88, height: 88, borderRadius: 44, borderWidth: 6, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  disparoInterno: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff' },
  aviso: { flex: 1, backgroundColor: cores.fundo, paddingHorizontal: espaco.lg, gap: espaco.lg, justifyContent: 'center' },
  avisoTitulo: { fontSize: fonte.grande, fontWeight: '800', color: cores.primariaEscura },
  avisoTexto: { fontSize: fonte.corpo + 1, color: cores.texto, lineHeight: 24 },
});
