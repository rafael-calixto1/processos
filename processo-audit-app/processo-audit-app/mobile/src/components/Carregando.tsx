import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { espaco, fonte, type Paleta } from '@/theme';
import { useCores, useEstilos } from '@/estado/tema';

export function Carregando({ texto }: { texto?: string }) {
  const cores = useCores();
  const s = useEstilos(criarEstilos);
  return (
    <View style={s.caixa} accessibilityRole="progressbar" accessibilityLabel={texto ?? 'Carregando'}>
      <ActivityIndicator size="large" color={cores.primaria} />
      {texto ? <Text style={s.texto}>{texto}</Text> : null}
    </View>
  );
}
const criarEstilos = (cores: Paleta) => StyleSheet.create({
  caixa: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espaco.md, backgroundColor: cores.fundo },
  texto: { fontSize: fonte.corpo, color: cores.textoSuave },
});
