import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { EstadoSync } from '@/domain/visao';
import { espaco, fonte, type Tom, type Paleta } from '@/theme';
import { useEstilos, useTons } from '@/estado/tema';

const VISUAL: Record<EstadoSync, { icone: keyof typeof Ionicons.glyphMap; tom: Tom }> = {
  sincronizado: { icone: 'checkmark-circle-outline', tom: 'sucesso' },
  pendente: { icone: 'cloud-upload-outline', tom: 'aviso' },
  erro: { icone: 'alert-circle', tom: 'erro' },
};

export const textoSync = (estado: EstadoSync, pendencias = 0): string =>
  estado === 'sincronizado' ? 'Sincronizada' : estado === 'pendente' ? `Aguardando envio${pendencias > 1 ? ` (${pendencias})` : ''}` : 'Requer atenção';

/** Ícone + texto do estado de envio de uma OS (nunca só cor: o texto sempre acompanha). */
export function IndicadorSync({ estado, pendencias = 0 }: { estado: EstadoSync; pendencias?: number }) {
  const s = useEstilos(criarEstilos);
  const tons = useTons();
  const v = VISUAL[estado];
  const cor = tons[v.tom].texto;
  return (
    <View style={s.caixa} accessible accessibilityLabel={textoSync(estado, pendencias)} testID={`sync-${estado}`}>
      <Ionicons name={v.icone} size={18} color={cor} />
      <Text style={[s.texto, { color: cor }]}>{textoSync(estado, pendencias)}</Text>
    </View>
  );
}
const criarEstilos = (cores: Paleta) => StyleSheet.create({
  caixa: { flexDirection: 'row', alignItems: 'center', gap: espaco.xs },
  texto: { fontSize: fonte.pequena, fontWeight: '700' },
});
