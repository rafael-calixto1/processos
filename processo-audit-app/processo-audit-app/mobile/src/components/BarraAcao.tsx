import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cores, espaco } from '@/theme';

/** Ação principal fixa no rodapé, ao alcance do polegar, respeitando a área segura do aparelho. */
export function BarraAcao({ children }: { children: ReactNode }) {
  const { bottom } = useSafeAreaInsets();
  return <View style={[s.barra, { paddingBottom: Math.max(bottom, espaco.md) }]}>{children}</View>;
}
const s = StyleSheet.create({
  barra: { backgroundColor: cores.superficie, borderTopWidth: 1, borderTopColor: cores.borda, paddingHorizontal: espaco.lg, paddingTop: espaco.md, gap: espaco.sm },
});
