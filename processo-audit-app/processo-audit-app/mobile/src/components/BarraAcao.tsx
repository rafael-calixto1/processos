import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { espaco, type Paleta } from '@/theme';
import { useEstilos } from '@/estado/tema';

/** Ação principal fixa no rodapé, ao alcance do polegar, respeitando a área segura do aparelho. */
export function BarraAcao({ children }: { children: ReactNode }) {
  const s = useEstilos(criarEstilos);
  const { bottom } = useSafeAreaInsets();
  return <View style={[s.barra, { paddingBottom: Math.max(bottom, espaco.md) }]}>{children}</View>;
}
const criarEstilos = (cores: Paleta) => StyleSheet.create({
  barra: { backgroundColor: cores.superficie, borderTopWidth: 1, borderTopColor: cores.borda, paddingHorizontal: espaco.lg, paddingTop: espaco.md, gap: espaco.sm },
});
