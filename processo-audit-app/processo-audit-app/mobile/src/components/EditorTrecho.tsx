import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, NetworkError, mensagemDeErro } from '@/api/erros';
import { Botao } from '@/components/Botao';
import { Cabecalho } from '@/components/Cabecalho';
import { Faixa } from '@/components/Faixa';
import { MapaTrecho, type MensagemDoMapa } from '@/components/MapaTrecho';
import { adicionarPonto, fmtMetros, metrosEmLinhaReta, montarRota, moverPonto, MAX_PONTOS, novoPonto, removerUltimo, rotuloDoPonto, type PontoGeo, type RotaDoServidor, type RotaTrecho } from '@/domain/trecho';
import { useApp } from '@/estado/AppProvider';
import { cores, espaco, fonte } from '@/theme';

interface Props {
  centro: PontoGeo;
  inicial: RotaTrecho | null;
  origem?: string;
  aoConfirmar: (r: RotaTrecho) => void;
  aoFechar: () => void;
}

/**
 * Marcar o trecho no mapa: o 1º toque é o início, o último é o fim e os do meio são intermediários; os pontos se arrastam. Com
 * internet o trajeto é traçado pelas ruas (os pontos "grudam" na via, como no sistema web); se o servidor de rotas não responder,
 * o trecho fica em linha reta entre os pontos. Ponto que não está sobre uma via é recusado com a mensagem do servidor.
 */
export function EditorTrecho({ centro, inicial, origem, aoConfirmar, aoFechar }: Props) {
  const { api } = useApp();
  const { bottom } = useSafeAreaInsets();
  const [pontos, setPontos] = useState<PontoGeo[]>(inicial?.pontos ?? []);
  const [servidor, setServidor] = useState<RotaDoServidor | null>(inicial && inicial.caminho.length ? { metros: inicial.metros, caminho: inicial.caminho } : null);
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const sequencia = useRef(0);

  /** Aplica uma nova lista de pontos. Só vale se o trajeto puder ser traçado; senão o estado anterior volta (mapa inclusive). */
  const aplicar = useCallback(async (novos: PontoGeo[]) => {
    setErro(null); setAviso(null);
    const minha = ++sequencia.current;
    if (novos.length < 2) { setPontos(novos); setServidor(null); setCalculando(false); setVersao((v) => v + 1); return; }
    setCalculando(true);
    try {
      const r = await api.rotaPorVias(novos);
      if (minha !== sequencia.current) return; // chegou depois de outro toque: ignora
      setPontos(r.pontos.length === novos.length ? r.pontos.map((p) => novoPonto(p.lat, p.lng)) : novos);
      setServidor(r);
    } catch (e) {
      if (minha !== sequencia.current) return;
      if (e instanceof NetworkError) {
        setPontos(novos); setServidor(null);
        setAviso('Sem conexão com o servidor de rotas: o trecho ficou em linha reta entre os pontos, sem seguir as ruas.');
      } else {
        setErro(e instanceof ApiError || e instanceof Error ? mensagemDeErro(e) : 'Não foi possível traçar o trecho.'); // o ponto novo NÃO entra
      }
    } finally {
      if (minha === sequencia.current) { setCalculando(false); setVersao((v) => v + 1); }
    }
  }, [api]);

  const aoMensagem = useCallback((m: MensagemDoMapa) => {
    if (calculando && (m.tipo === 'toque' || m.tipo === 'mover')) { setVersao((v) => v + 1); return; } // espera o trajeto atual terminar, senão um ponto se perderia
    if (m.tipo === 'erro-mapa') { setErro('Não foi possível carregar o mapa. Verifique a conexão.'); return; }
    try {
      if (m.tipo === 'toque') void aplicar(adicionarPonto(pontos, { lat: m.lat, lng: m.lng }));
      else if (m.tipo === 'mover') void aplicar(moverPonto(pontos, m.i, { lat: m.lat, lng: m.lng }));
    } catch (e) { setErro(mensagemDeErro(e)); setVersao((v) => v + 1); }
  }, [pontos, aplicar, calculando]);

  const rota = montarRota(pontos, servidor);
  const metros = servidor ? Math.round(servidor.metros) : metrosEmLinhaReta(pontos);
  const instrucao = pontos.length === 0 ? 'Toque no mapa no ponto de INÍCIO do trecho.'
    : pontos.length === 1 ? 'Agora toque nos pontos seguintes. O último toque é o FIM do trecho.'
      : `${pontos.length} pontos · ≈ ${fmtMetros(metros)}${servidor ? ' pelas ruas' : ' em linha reta'}. Toque para continuar o trecho ou arraste um ponto para ajustar.`;

  return (
    <View style={s.tela}>
      <Cabecalho titulo="Marcar o trecho" subtitulo={pontos.length ? `${rotuloDoPonto(pontos.length - 1, pontos.length)} marcado` : 'Toque no mapa'} aoVoltar={aoFechar} />
      <View style={s.avisos}>
        <Faixa tom="info" icone="map-outline" texto={instrucao} />
        {erro ? <Faixa tom="erro" texto={erro} /> : null}
        {aviso ? <Faixa tom="aviso" icone="warning-outline" texto={aviso} /> : null}
      </View>
      <View style={s.mapa}>
        <MapaTrecho centro={centro} pontosIniciais={inicial?.pontos ?? []} caminhoInicial={inicial?.caminho ?? []} pontos={pontos} caminho={servidor?.caminho ?? []} versao={versao} aoMensagem={aoMensagem} origem={origem} />
      </View>
      <View style={[s.rodape, { paddingBottom: Math.max(bottom, espaco.md) }]}>
        <Text style={s.resumo} accessibilityLiveRegion="polite" testID="trecho-resumo">{calculando ? 'Traçando o trecho pelas ruas…' : pontos.length >= MAX_PONTOS ? `Limite de ${MAX_PONTOS} pontos atingido.` : ' '}</Text>
        <View style={s.linha}>
          <Botao titulo="Desfazer último" variante="secundario" onPress={() => void aplicar(removerUltimo(pontos))} desabilitado={!pontos.length || calculando} testID="trecho-desfazer" estilo={s.metade} />
          <Botao titulo="Limpar" variante="perigo" onPress={() => void aplicar([])} desabilitado={!pontos.length || calculando} testID="trecho-limpar" estilo={s.metade} />
        </View>
        <Botao titulo="Usar este trecho" onPress={() => rota && aoConfirmar(rota)} desabilitado={!rota || calculando} testID="trecho-usar" />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  avisos: { gap: espaco.xs, padding: espaco.sm },
  mapa: { flex: 1, backgroundColor: cores.neutroClaro },
  rodape: { gap: espaco.sm, padding: espaco.md, backgroundColor: cores.superficie, borderTopWidth: 1, borderTopColor: cores.borda },
  resumo: { fontSize: fonte.pequena + 1, color: cores.textoSuave, textAlign: 'center', fontWeight: '700' },
  linha: { flexDirection: 'row', gap: espaco.sm },
  metade: { flex: 1 },
});
