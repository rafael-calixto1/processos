import { createElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { espaco, fonte, raio, type Paleta } from '@/theme';
import { useEstilos } from '@/estado/tema';

interface Props { html: string; online: boolean; origem?: string; altura?: number; testID?: string; rotulo?: string }

/** Pré-visualização no navegador: a mesma página do mapa num iframe. */
export function PaginaMapa({ html, online, altura = 260, testID = 'mapa-local' }: Props) {
  const s = useEstilos(criarEstilos);
  if (!online) return <View style={[s.caixa, s.sem, { height: altura }]} testID="mapa-sem-conexao"><Text style={s.semTexto}>O mapa aparece quando houver internet. As coordenadas já estão guardadas.</Text></View>;
  return <View style={[s.caixa, { height: altura }]} testID={testID}>{createElement('iframe', { srcDoc: html, title: 'Mapa', style: { border: 0, width: '100%', height: '100%' } })}</View>;
}
const criarEstilos = (cores: Paleta) => StyleSheet.create({
  caixa: { borderRadius: raio.lg, overflow: 'hidden', borderWidth: 1, borderColor: cores.borda, backgroundColor: cores.neutroClaro },
  sem: { alignItems: 'center', justifyContent: 'center', padding: espaco.lg },
  semTexto: { fontSize: fonte.corpo, color: cores.textoSuave, textAlign: 'center', lineHeight: 22 },
});
