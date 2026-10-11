import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Botao } from '@/components/Botao';
import { abrirConfiguracoes } from '@/estado/configuracoes';
import { Carregando } from '@/components/Carregando';
import { espaco, fonte, type Paleta } from '@/theme';
import { useEstilos } from '@/estado/tema';

interface Props { aoLer: (texto: string) => void; aoFechar: () => void }

/** Leitor de QR code do lote (câmera traseira). Lê UMA vez e avisa; sem permissão, explica e deixa digitar/escolher na lista. */
export function LeitorQR({ aoLer, aoFechar }: Props) {
  const s = useEstilos(criarEstilos);
  const [permissao, pedir] = useCameraPermissions();
  const { top, bottom } = useSafeAreaInsets();
  const jaLeu = useRef(false);

  if (!permissao) return <Carregando texto="Abrindo a câmera…" />;
  if (!permissao.granted) {
    return (
      <View style={[s.aviso, { paddingTop: top + espaco.xl, paddingBottom: bottom + espaco.xl }]}>
        <Text style={s.avisoTitulo} accessibilityRole="header">Precisamos da câmera</Text>
        <Text style={s.avisoTexto}>
          {permissao.canAskAgain ? 'Permita o uso da câmera para ler o QR code da etiqueta do lote.' : 'A câmera está bloqueada para este aplicativo. Abra as Configurações do aparelho e permita o uso da câmera.'} Se preferir, escolha o material na lista.
        </Text>
        {permissao.canAskAgain ? <Botao titulo="Permitir câmera" onPress={() => void pedir()} testID="leitor-permitir" /> : <Botao titulo="Abrir configurações" onPress={() => void abrirConfiguracoes()} testID="leitor-configuracoes" />}
        <Botao titulo="Escolher na lista" variante="secundario" onPress={aoFechar} testID="leitor-fechar" />
      </View>
    );
  }
  return (
    <View style={s.tela}>
      <CameraView
        style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => { if (jaLeu.current || !data) return; jaLeu.current = true; aoLer(String(data)); }}
      />
      <View style={[s.topo, { paddingTop: top + espaco.lg }]} pointerEvents="none">
        <Text style={s.dica} accessibilityRole="header">Aponte para o QR code da etiqueta do lote</Text>
      </View>
      <View style={s.mira} pointerEvents="none" />
      <View style={[s.rodape, { paddingBottom: Math.max(bottom, espaco.lg) }]}>
        <Botao titulo="Fechar" variante="secundario" onPress={aoFechar} testID="leitor-fechar" />
      </View>
    </View>
  );
}

const criarEstilos = (cores: Paleta) => StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#000' },
  topo: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: espaco.lg, paddingBottom: espaco.md, backgroundColor: 'rgba(0,0,0,0.55)' },
  dica: { color: '#fff', fontSize: fonte.destaque, fontWeight: '700', textAlign: 'center' },
  mira: { position: 'absolute', alignSelf: 'center', top: '30%', width: 240, height: 240, borderWidth: 4, borderColor: cores.secundaria, borderRadius: 24 },
  rodape: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: espaco.lg },
  aviso: { flex: 1, backgroundColor: cores.fundo, paddingHorizontal: espaco.lg, gap: espaco.lg, justifyContent: 'center' },
  avisoTitulo: { fontSize: fonte.grande, fontWeight: '800', color: cores.primariaEscura },
  avisoTexto: { fontSize: fonte.corpo + 1, color: cores.texto, lineHeight: 24 },
});
