import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { espaco, fonte, raio, type Paleta } from '@/theme';
import { useEstilos } from '@/estado/tema';

interface Props { html: string; online: boolean; origem?: string; altura?: number; testID?: string; rotulo?: string }

/** Mostra uma página de mapa (HTML com Leaflet) num WebView. Sem internet mostra um aviso em vez de um quadro em branco. */
export function PaginaMapa({ html, online, origem, altura = 260, testID = 'mapa-local', rotulo }: Props) {
  const s = useEstilos(criarEstilos);
  if (!online) {
    return (
      <View style={[s.caixa, s.sem, { height: altura }]} accessible accessibilityLabel="Mapa indisponível sem internet" testID="mapa-sem-conexao">
        <Text style={s.semTexto}>O mapa aparece quando houver internet. As coordenadas já estão guardadas.</Text>
      </View>
    );
  }
  return (
    <View style={[s.caixa, { height: altura }]} testID={testID} accessibilityLabel={rotulo}>
      {/* o endereço do nosso servidor serve de "origem" da página: o OpenStreetMap exige saber quem pede os mapas */}
      <WebView source={{ html, baseUrl: origem ?? 'https://tile.openstreetmap.org/' }} originWhitelist={['*']} javaScriptEnabled domStorageEnabled scrollEnabled={false} nestedScrollEnabled mixedContentMode="always" style={s.mapa} />
    </View>
  );
}
const criarEstilos = (cores: Paleta) => StyleSheet.create({
  caixa: { borderRadius: raio.lg, overflow: 'hidden', borderWidth: 1, borderColor: cores.borda, backgroundColor: cores.neutroClaro },
  mapa: { flex: 1, backgroundColor: cores.neutroClaro },
  sem: { alignItems: 'center', justifyContent: 'center', padding: espaco.lg },
  semTexto: { fontSize: fonte.corpo, color: cores.textoSuave, textAlign: 'center', lineHeight: 22 },
});
