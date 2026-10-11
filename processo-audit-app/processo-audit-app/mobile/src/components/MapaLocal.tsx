import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { htmlDoMapa } from '@/domain/mapa';
import { cores, espaco, fonte, raio } from '@/theme';

interface Props { lat: number; lng: number; precisaoM?: number | null; online: boolean; origem?: string }

/** Mapa do ponto registrado, com o círculo da precisão do GPS. Sem internet mostra um aviso (as coordenadas continuam guardadas). */
export function MapaLocal({ lat, lng, precisaoM, online, origem }: Props) {
  const html = useMemo(() => htmlDoMapa({ lat, lng, precisao_m: precisaoM }), [lat, lng, precisaoM]);
  if (!online) {
    return (
      <View style={[s.caixa, s.sem]} accessible accessibilityLabel="Mapa indisponível sem internet" testID="mapa-sem-conexao">
        <Text style={s.semTexto}>O mapa aparece quando houver internet. As coordenadas já estão guardadas.</Text>
      </View>
    );
  }
  return (
    <View style={s.caixa} testID="mapa-local" accessibilityLabel={`Mapa do local ${lat.toFixed(5)}, ${lng.toFixed(5)}`}>
      {/* o endereço do nosso servidor serve de "origem" da página: o OpenStreetMap exige saber quem pede os mapas */}
      <WebView source={{ html, baseUrl: origem ?? 'https://tile.openstreetmap.org/' }} originWhitelist={['*']} javaScriptEnabled domStorageEnabled scrollEnabled={false} nestedScrollEnabled mixedContentMode="always" style={s.mapa} />
    </View>
  );
}
const s = StyleSheet.create({
  caixa: { height: 260, borderRadius: raio.lg, overflow: 'hidden', borderWidth: 1, borderColor: cores.borda, backgroundColor: cores.neutroClaro },
  mapa: { flex: 1, backgroundColor: cores.neutroClaro },
  sem: { alignItems: 'center', justifyContent: 'center', padding: espaco.lg },
  semTexto: { fontSize: fonte.corpo, color: cores.textoSuave, textAlign: 'center', lineHeight: 22 },
});
