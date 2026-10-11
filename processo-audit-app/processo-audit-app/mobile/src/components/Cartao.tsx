import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { espaco, fonte, raio, type Paleta } from '@/theme';
import { useEstilos } from '@/estado/tema';

export function Cartao({ titulo, children, estilo }: { titulo?: string; children: ReactNode; estilo?: StyleProp<ViewStyle> }) {
  const s = useEstilos(criarEstilos);
  return (
    <View style={[s.cartao, estilo]}>
      {titulo ? <Text style={s.titulo} accessibilityRole="header">{titulo}</Text> : null}
      {children}
    </View>
  );
}

/** Linha "rótulo / valor" usada nos detalhes. */
export function Dado({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  const s = useEstilos(criarEstilos);
  return (
    <View style={s.dado} accessible accessibilityLabel={`${rotulo}: ${valor || 'não informado'}`}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <Text style={s.valor}>{valor || '—'}</Text>
    </View>
  );
}

const criarEstilos = (cores: Paleta) => StyleSheet.create({
  cartao: { backgroundColor: cores.superficie, borderRadius: raio.lg, borderWidth: 1, borderColor: cores.borda, padding: espaco.lg, gap: espaco.md },
  titulo: { fontSize: fonte.destaque, fontWeight: '700', color: cores.primariaEscura },
  dado: { gap: 2 },
  rotulo: { fontSize: fonte.pequena, fontWeight: '700', color: cores.textoSuave, textTransform: 'uppercase', letterSpacing: 0.4 },
  valor: { fontSize: fonte.corpo, color: cores.texto, lineHeight: 22 },
});
