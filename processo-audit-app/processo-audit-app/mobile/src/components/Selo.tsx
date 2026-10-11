import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { espaco, fonte, raio, tons, type Tom } from '@/theme';

/** Selo com texto (e ícone opcional): o estado nunca é comunicado só por cor. */
export function Selo({ texto, tom = 'neutro', icone }: { texto: string; tom?: Tom; icone?: keyof typeof Ionicons.glyphMap }) {
  const t = tons[tom];
  return (
    <View style={[s.selo, { backgroundColor: t.fundo }]} accessible accessibilityLabel={texto}>
      {icone ? <Ionicons name={icone} size={14} color={t.texto} /> : null}
      <Text style={[s.texto, { color: t.texto }]}>{texto}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  selo: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: espaco.md, paddingVertical: 4, borderRadius: raio.pilula, alignSelf: 'flex-start' },
  texto: { fontSize: fonte.pequena, fontWeight: '700' },
});
