import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ALVO_MINIMO, cores, espaco, fonte, raio } from '@/theme';

interface Props {
  rotulo: string;
  detalhe?: string;
  selecionado: boolean;
  tipo: 'radio' | 'check';
  onPress: () => void;
  desabilitado?: boolean;
  testID?: string;
}

/** Linha grande de lista de escolha (motivo, participantes...): alvo de toque de 56 dp, marca clara e texto sempre à vista. */
export function LinhaOpcao({ rotulo, detalhe, selecionado, tipo, onPress, desabilitado, testID }: Props) {
  const icone = tipo === 'radio' ? (selecionado ? 'radio-button-on' : 'radio-button-off') : selecionado ? 'checkbox' : 'square-outline';
  return (
    <Pressable
      testID={testID} onPress={onPress} disabled={desabilitado} accessibilityRole={tipo === 'radio' ? 'radio' : 'checkbox'}
      accessibilityState={{ checked: selecionado, disabled: !!desabilitado }} accessibilityLabel={detalhe ? `${rotulo}, ${detalhe}` : rotulo}
      style={({ pressed }) => [s.linha, selecionado && s.selecionada, pressed && s.pressionada, desabilitado && s.desabilitada]}
    >
      <Ionicons name={icone} size={28} color={selecionado ? cores.primariaBotao : cores.textoSuave} />
      <View style={s.textos}>
        <Text style={s.rotulo}>{rotulo}</Text>
        {detalhe ? <Text style={s.detalhe}>{detalhe}</Text> : null}
      </View>
    </Pressable>
  );
}
const s = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.md, minHeight: Math.max(ALVO_MINIMO, 56), paddingHorizontal: espaco.lg, paddingVertical: espaco.sm, borderRadius: raio.md, borderWidth: 2, borderColor: cores.borda, backgroundColor: cores.superficie },
  selecionada: { borderColor: cores.primariaBotao, backgroundColor: cores.primariaClara },
  pressionada: { opacity: 0.85 },
  desabilitada: { opacity: 0.5 },
  textos: { flex: 1, gap: 2 },
  rotulo: { fontSize: fonte.corpo + 1, fontWeight: '700', color: cores.texto },
  detalhe: { fontSize: fonte.pequena + 1, color: cores.textoSuave },
});
