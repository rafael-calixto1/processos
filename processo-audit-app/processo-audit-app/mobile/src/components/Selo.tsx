import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { espaco, fonte, raio, type Tom, type Paleta } from '@/theme';
import { useEstilos, useTons } from '@/estado/tema';

/** Selo com texto (e ícone opcional): o estado nunca é comunicado só por cor. */
export function Selo({ texto, tom = 'neutro', icone }: { texto: string; tom?: Tom; icone?: keyof typeof Ionicons.glyphMap }) {
  const s = useEstilos(criarEstilos);
  const tons = useTons();
  const t = tons[tom];
  return (
    <View style={[s.selo, { backgroundColor: t.fundo }]} accessible accessibilityLabel={texto}>
      {icone ? <Ionicons name={icone} size={14} color={t.texto} /> : null}
      <Text style={[s.texto, { color: t.texto }]}>{texto}</Text>
    </View>
  );
}
const criarEstilos = (cores: Paleta) => StyleSheet.create({
  selo: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: espaco.md, paddingVertical: 4, borderRadius: raio.pilula, alignSelf: 'flex-start' },
  texto: { fontSize: fonte.pequena, fontWeight: '700' },
});
