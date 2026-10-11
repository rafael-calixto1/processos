import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ALVO_MINIMO, cores, espaco, fonte, raio } from '@/theme';

interface Props<T extends string> {
  rotulo: string; // para leitor de tela
  opcoes: ReadonlyArray<{ valor: T; rotulo: string }>;
  valor: T | null | undefined;
  onChange: (v: T) => void;
  desabilitado?: boolean;
  testID?: string;
}

/** Escolha entre poucas opções (Sim/Não, Novo/Usado): botões grandes lado a lado, o escolhido bem destacado. */
export function Segmento<T extends string>({ rotulo, opcoes, valor, onChange, desabilitado, testID }: Props<T>) {
  return (
    <View style={s.grupo} accessibilityRole="radiogroup" accessibilityLabel={rotulo} testID={testID}>
      {opcoes.map((o) => {
        const ativo = valor === o.valor;
        return (
          <Pressable key={o.valor} disabled={desabilitado} onPress={() => onChange(o.valor)} accessibilityRole="radio" accessibilityState={{ checked: ativo, disabled: !!desabilitado }} accessibilityLabel={`${rotulo}: ${o.rotulo}`}
            testID={testID ? `${testID}-${o.valor}` : undefined} style={[s.botao, ativo && s.ativo, desabilitado && s.desabilitado]}>
            <Text style={[s.texto, ativo && s.textoAtivo]}>{o.rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const s = StyleSheet.create({
  grupo: { flexDirection: 'row', gap: espaco.sm },
  botao: { flex: 1, minHeight: Math.max(ALVO_MINIMO, 56), alignItems: 'center', justifyContent: 'center', borderRadius: raio.md, borderWidth: 2, borderColor: cores.borda, backgroundColor: cores.superficie, paddingHorizontal: espaco.md },
  ativo: { backgroundColor: cores.primariaEscura, borderColor: cores.primariaEscura },
  desabilitado: { opacity: 0.5 },
  texto: { fontSize: fonte.destaque, fontWeight: '700', color: cores.textoSuave },
  textoAtivo: { color: '#fff' },
});
