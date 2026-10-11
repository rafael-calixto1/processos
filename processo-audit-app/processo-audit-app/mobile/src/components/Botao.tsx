import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { ALVO_MINIMO, espaco, fonte, raio, type Paleta } from '@/theme';
import { useCores, useEstilos } from '@/estado/tema';

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

const visualDe = (cores: Paleta): Record<Variante, { fundo: string; texto: string; borda: string }> => ({
  primario: { fundo: cores.primariaBotao, texto: '#fff', borda: cores.primariaBotao },
  secundario: { fundo: cores.superficie, texto: cores.primariaEscura, borda: cores.primariaBotao },
  perigo: { fundo: cores.superficie, texto: cores.erro, borda: cores.erro },
  fantasma: { fundo: 'transparent', texto: cores.primariaEscura, borda: 'transparent' },
});

/** Botão grande (52 dp de altura), com estado de carregamento que também bloqueia toques repetidos. */
export function Botao({ titulo, onPress, variante = 'primario', carregando, desabilitado, estilo, testID }: Props) {
  const s = useEstilos(criarEstilos);
  const v = visualDe(useCores())[variante];
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

const criarEstilos = (cores: Paleta) => StyleSheet.create({
  base: { minHeight: Math.max(ALVO_MINIMO, 52), paddingHorizontal: espaco.xl, borderRadius: raio.md, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  texto: { fontSize: fonte.destaque, fontWeight: '700', textAlign: 'center' },
  inativo: { opacity: 0.45 },
  pressionado: { opacity: 0.8 },
});
