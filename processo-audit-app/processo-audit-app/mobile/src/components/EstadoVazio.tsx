import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { espaco, fonte, type Paleta } from '@/theme';
import { Botao } from './Botao';
import { useCores, useEstilos } from '@/estado/tema';

/** Lista vazia ou erro de carga: sempre com explicação e, quando faz sentido, a próxima ação. */
export function EstadoVazio({ icone, titulo, texto, acao }: { icone: keyof typeof Ionicons.glyphMap; titulo: string; texto?: string; acao?: { rotulo: string; onPress: () => void } }) {
  const cores = useCores();
  const s = useEstilos(criarEstilos);
  return (
    <View style={s.caixa}>
      <Ionicons name={icone} size={48} color={cores.desabilitado} />
      <Text style={s.titulo} accessibilityRole="header">{titulo}</Text>
      {texto ? <Text style={s.texto}>{texto}</Text> : null}
      {acao ? <Botao titulo={acao.rotulo} onPress={acao.onPress} variante="secundario" estilo={{ alignSelf: 'stretch' }} /> : null}
    </View>
  );
}
const criarEstilos = (cores: Paleta) => StyleSheet.create({
  caixa: { alignItems: 'center', gap: espaco.md, padding: espaco.xxl },
  titulo: { fontSize: fonte.destaque, fontWeight: '700', color: cores.texto, textAlign: 'center' },
  texto: { fontSize: fonte.corpo, color: cores.textoSuave, textAlign: 'center', lineHeight: 22 },
});
