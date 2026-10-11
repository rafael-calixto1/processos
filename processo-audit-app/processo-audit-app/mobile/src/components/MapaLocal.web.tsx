import { createElement, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { htmlDoMapa } from '@/domain/mapa';
import { cores, espaco, fonte, raio } from '@/theme';

interface Props { lat: number; lng: number; precisaoM?: number | null; online: boolean; origem?: string }

/** Pré-visualização no navegador: a mesma página do mapa dentro de um iframe. */
export function MapaLocal({ lat, lng, precisaoM, online }: Props) {
  const html = useMemo(() => htmlDoMapa({ lat, lng, precisao_m: precisaoM }), [lat, lng, precisaoM]);
  if (!online) return <View style={[s.caixa, s.sem]} testID="mapa-sem-conexao"><Text style={s.semTexto}>O mapa aparece quando houver internet. As coordenadas já estão guardadas.</Text></View>;
  return <View style={s.caixa} testID="mapa-local">{createElement('iframe', { srcDoc: html, title: 'Mapa do local', style: { border: 0, width: '100%', height: '100%' } })}</View>;
}
const s = StyleSheet.create({
  caixa: { height: 260, borderRadius: raio.lg, overflow: 'hidden', borderWidth: 1, borderColor: cores.borda, backgroundColor: cores.neutroClaro },
  sem: { alignItems: 'center', justifyContent: 'center', padding: espaco.lg },
  semTexto: { fontSize: fonte.corpo, color: cores.textoSuave, textAlign: 'center', lineHeight: 22 },
});
