import { useCallback, useEffect, useRef, useState } from 'react';
import { WebView } from 'react-native-webview';
import { htmlDoEditorTrecho } from '@/domain/mapa';
import type { PontoGeo } from '@/domain/trecho';

export type MensagemDoMapa = { tipo: 'toque'; lat: number; lng: number } | { tipo: 'mover'; i: number; lat: number; lng: number } | { tipo: 'erro-mapa' } | { tipo: 'pronto' };

export interface PropsMapaTrecho {
  centro: PontoGeo;
  pontosIniciais: readonly PontoGeo[];
  caminhoInicial: ReadonlyArray<readonly [number, number]>;
  /** Estado atual (a verdade está no aplicativo): a cada mudança é reenviado à página. */
  pontos: readonly PontoGeo[];
  caminho: ReadonlyArray<readonly [number, number]>;
  /** Sobe a cada tentativa recusada, para a página voltar ao último estado válido (ex.: ponto arrastado para fora da rua). */
  versao: number;
  aoMensagem: (m: MensagemDoMapa) => void;
  origem?: string;
}

/** Ponte entre o aplicativo e a página do mapa (WebView): a página avisa toques e arrastes; o aplicativo devolve os pontos e o caminho. */
export function MapaTrecho({ centro, pontosIniciais, caminhoInicial, pontos, caminho, versao, aoMensagem, origem }: PropsMapaTrecho) {
  const ref = useRef<WebView>(null);
  const pronto = useRef(false);
  const [html] = useState(() => htmlDoEditorTrecho({ centro, pontos: pontosIniciais, caminho: caminhoInicial }));
  const enviar = useCallback(() => {
    if (!pronto.current) return;
    ref.current?.injectJavaScript(`window.definirPontos(${JSON.stringify(pontos)},${JSON.stringify(caminho)},false);true;`);
  }, [pontos, caminho]);
  useEffect(() => { enviar(); }, [enviar, versao]);

  return (
    <WebView
      ref={ref} testID="mapa-trecho" style={{ flex: 1 }} source={{ html, baseUrl: origem ?? 'https://tile.openstreetmap.org/' }} originWhitelist={['*']}
      javaScriptEnabled domStorageEnabled mixedContentMode="always"
      onMessage={(e) => {
        let m: MensagemDoMapa;
        try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
        if (m.tipo === 'pronto') { pronto.current = true; enviar(); return; }
        aoMensagem(m);
      }}
    />
  );
}
