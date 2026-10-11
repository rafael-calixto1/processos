import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { ALVO_MINIMO, cores, espaco, fonte, raio } from '@/theme';

type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma';
interface Props {
  titulo: string;
  onPress: () => void;
  variante?: Variante;
  carregando?: boolean;
  desabilitado?: boolean;
  estilo?: StyleProp<ViewStyle>;
  testID?: string;
}

const visual: Record<Variante, { fundo: string; texto: string; borda: string }> = {
  primario: { fundo: cores.primariaBotao, texto: '#fff', borda: cores.primariaBotao },
  secundario: { fundo: cores.superficie, texto: cores.primariaEscura, borda: cores.primariaBotao },
  perigo: { fundo: cores.superficie, texto: cores.erro, borda: cores.erro },
  fantasma: { fundo: 'transparent', texto: cores.primariaEscura, borda: 'transparent' },
};

/** Botão grande (52 dp de altura), com estado de carregamento que também bloqueia toques repetidos. */
export function Botao({ titulo, onPress, variante = 'primario', carregando, desabilitado, estilo, testID }: Props) {
  const v = visual[variante];
  const inativo = desabilitado || carregando;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: !!inativo, busy: !!carregando }}
      disabled={inativo}
      onPress={onPress}
      style={({ pressed }) => [s.base, { backgroundColor: v.fundo, borderColor: v.borda }, inativo && s.inativo, pressed && s.pressionado, estilo]}
    >
      {carregando ? <ActivityIndicator color={v.texto} /> : <Text style={[s.texto, { color: v.texto }]}>{titulo}</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  base: { minHeight: Math.max(ALVO_MINIMO, 52), paddingHorizontal: espaco.xl, borderRadius: raio.md, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  texto: { fontSize: fonte.destaque, fontWeight: '700' },
  inativo: { opacity: 0.45 },
  pressionado: { opacity: 0.8 },
});
