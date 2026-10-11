import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { htmlDoEditorTrecho } from '@/domain/mapa';
import type { PropsMapaTrecho, MensagemDoMapa } from './MapaTrecho';

/** Pré-visualização no navegador: a mesma página do mapa num iframe, conversando por postMessage. */
export function MapaTrecho({ centro, pontosIniciais, caminhoInicial, pontos, caminho, versao, aoMensagem }: PropsMapaTrecho) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const pronto = useRef(false);
  const [html] = useState(() => htmlDoEditorTrecho({ centro, pontos: pontosIniciais, caminho: caminhoInicial }));
  const enviar = useCallback(() => {
    if (pronto.current) ref.current?.contentWindow?.postMessage(JSON.stringify({ cmd: 'pontos', pontos, caminho, ajustar: false }), '*');
  }, [pontos, caminho]);
  useEffect(() => { enviar(); }, [enviar, versao]);
  useEffect(() => {
    const ouvir = (ev: MessageEvent) => {
      if (ev.source !== ref.current?.contentWindow) return;
      let m: MensagemDoMapa;
      try { m = JSON.parse(String(ev.data)); } catch { return; }
      if (m.tipo === 'pronto') { pronto.current = true; enviar(); return; }
      aoMensagem(m);
    };
    window.addEventListener('message', ouvir);
    return () => window.removeEventListener('message', ouvir);
  }, [aoMensagem, enviar]);
  return createElement('iframe', { ref, srcDoc: html, title: 'Mapa do trecho', 'data-testid': 'mapa-trecho', style: { border: 0, width: '100%', height: '100%', flex: 1 } });
}
