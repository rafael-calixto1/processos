import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { cores, espaco, fonte } from '@/theme';

export function Carregando({ texto }: { texto?: string }) {
  return (
    <View style={s.caixa} accessibilityRole="progressbar" accessibilityLabel={texto ?? 'Carregando'}>
      <ActivityIndicator size="large" color={cores.primaria} />
      {texto ? <Text style={s.texto}>{texto}</Text> : null}
    </View>
  );
}
const s = StyleSheet.create({
  caixa: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espaco.md, backgroundColor: cores.fundo },
  texto: { fontSize: fonte.corpo, color: cores.textoSuave },
});
