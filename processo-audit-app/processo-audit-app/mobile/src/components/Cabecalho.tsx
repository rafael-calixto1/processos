import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ALVO_MINIMO, cores, espaco, fonte } from '@/theme';

/** Cabeçalho verde das telas. Com `aoVoltar` mostra a seta de voltar (área de toque de 48 dp). */
export function Cabecalho({ titulo, subtitulo, aoVoltar, direita }: { titulo: string; subtitulo?: string; aoVoltar?: () => void; direita?: ReactNode }) {
  const { top } = useSafeAreaInsets();
  return (
    <View style={[s.caixa, { paddingTop: top + espaco.md }]}>
      {aoVoltar ? (
        <Pressable onPress={aoVoltar} accessibilityRole="button" accessibilityLabel="Voltar" style={s.voltar} hitSlop={8}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </Pressable>
      ) : null}
      <View style={s.textos}>
        <Text style={s.titulo} numberOfLines={1} accessibilityRole="header">{titulo}</Text>
        {subtitulo ? <Text style={s.subtitulo} numberOfLines={1}>{subtitulo}</Text> : null}
      </View>
      {direita}
    </View>
  );
}
const s = StyleSheet.create({
  caixa: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm, backgroundColor: cores.primariaEscura, paddingHorizontal: espaco.lg, paddingBottom: espaco.lg, borderBottomWidth: 4, borderBottomColor: cores.primaria },
  voltar: { width: ALVO_MINIMO, height: ALVO_MINIMO, marginLeft: -espaco.sm, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1, gap: 2 },
  titulo: { fontSize: fonte.titulo, fontWeight: '800', color: '#fff' },
  subtitulo: { fontSize: fonte.pequena + 1, color: cores.primariaClara, fontWeight: '600' },
});
