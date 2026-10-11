import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Botao } from '@/components/Botao';
import { Faixa } from '@/components/Faixa';
import type { FotoBruta } from '@/estado/fotos';
import { cores, espaco, fonte } from '@/theme';

interface Props { aoCapturar: (foto: FotoBruta) => Promise<void>; aoConcluir: () => void; totalTiradas: number }

/** SIMULAÇÃO da câmera, só para a pré-visualização no navegador: gera uma imagem de teste (4000×3000, com data e hora) como se fosse a foto. */
const imagemDeTeste = async (n: number): Promise<FotoBruta> => {
  const canvas = document.createElement('canvas');
  canvas.width = 4000; canvas.height = 3000;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#274518'; c.fillRect(0, 0, 4000, 3000);
  c.fillStyle = '#bbf804'; c.font = 'bold 220px sans-serif'; c.fillText(`FOTO SIMULADA ${n}`, 300, 1400);
  c.fillStyle = '#fff'; c.font = '120px sans-serif'; c.fillText(new Date().toLocaleString('pt-BR'), 300, 1700);
  const blob: Blob = await new Promise((ok) => canvas.toBlob((b) => ok(b!), 'image/png'));
  return { uri: URL.createObjectURL(blob), width: 4000, height: 3000 };
};

export function CameraFoto({ aoCapturar, aoConcluir, totalTiradas }: Props) {
  const { top } = useSafeAreaInsets();
  const [ocupada, setOcupada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <View style={[s.tela, { paddingTop: top + espaco.xl }]}>
      <Text style={s.titulo} accessibilityRole="header">Câmera (simulada)</Text>
      <Faixa tom="aviso" icone="flask-outline" texto="SIMULAÇÃO: este navegador não tem câmera. No celular, a câmera do aparelho abre aqui. O botão abaixo gera uma imagem de teste." />
      {erro ? <Faixa tom="erro" texto={erro} /> : null}
      <Text style={s.contador}>{totalTiradas} foto(s) nesta OS</Text>
      <Botao titulo="Tirar foto (simulada)" carregando={ocupada} testID="camera-disparar" onPress={async () => {
        setOcupada(true); setErro(null);
        try { await aoCapturar(await imagemDeTeste(totalTiradas + 1)); } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao tirar a foto.'); } finally { setOcupada(false); }
      }} />
      <Botao titulo="Concluir" variante="secundario" onPress={aoConcluir} testID="camera-concluir" />
    </View>
  );
}
const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo, paddingHorizontal: espaco.lg, gap: espaco.lg },
  titulo: { fontSize: fonte.grande, fontWeight: '800', color: cores.primariaEscura },
  contador: { fontSize: fonte.destaque, fontWeight: '700', color: cores.texto },
});
