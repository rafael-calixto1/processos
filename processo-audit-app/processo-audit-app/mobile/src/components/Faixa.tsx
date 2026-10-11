import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ALVO_MINIMO, espaco, fonte, raio, tons, type Tom } from '@/theme';

/** Aviso de uma linha (sem conexão, erro de sincronização...) com ação opcional. */
export function Faixa({ texto, tom = 'aviso', icone = 'alert-circle-outline', acao }: { texto: string; tom?: Tom; icone?: keyof typeof Ionicons.glyphMap; acao?: { rotulo: string; onPress: () => void } }) {
  const t = tons[tom];
  return (
    <View style={[s.faixa, { backgroundColor: t.fundo }]} accessibilityRole="alert">
      <Ionicons name={icone} size={20} color={t.texto} />
      <Text style={[s.texto, { color: t.texto }]}>{texto}</Text>
      {acao ? (
        <Pressable onPress={acao.onPress} accessibilityRole="button" accessibilityLabel={acao.rotulo} style={s.acao} hitSlop={8}>
          <Text style={[s.acaoTexto, { color: t.texto }]}>{acao.rotulo}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
const s = StyleSheet.create({
  faixa: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm, padding: espaco.md, borderRadius: raio.md },
  texto: { flex: 1, fontSize: fonte.pequena + 1, fontWeight: '600', lineHeight: 20 },
  acao: { minHeight: ALVO_MINIMO, justifyContent: 'center', paddingHorizontal: espaco.sm },
  acaoTexto: { fontSize: fonte.pequena + 1, fontWeight: '800', textDecorationLine: 'underline' },
});
