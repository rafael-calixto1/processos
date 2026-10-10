/**
 * Limitador de tentativas falhas em memória (janela deslizante). Serve para um único processo,
 * que é como o servidor roda. Bloqueia a chave depois de `max` falhas dentro da janela.
 */
export const criarLimitador = ({ janelaMs = 15 * 60 * 1000, max = 10, agora = Date.now } = {}) => {
  const falhas = new Map(); // chave -> instantes das falhas ainda dentro da janela
  const recentes = (chave) => {
    const t = (falhas.get(chave) || []).filter((x) => agora() - x < janelaMs);
    if (t.length) falhas.set(chave, t); else falhas.delete(chave);
    return t;
  };
  return {
    segundosRestantes(chave) {
      const t = recentes(chave);
      return t.length >= max ? Math.max(1, Math.ceil((t[0] + janelaMs - agora()) / 1000)) : 0;
    },
    falha(chave) {
      const t = recentes(chave);
      t.push(agora());
      falhas.set(chave, t);
      if (falhas.size > 10000) falhas.delete(falhas.keys().next().value); // teto de memória
    },
    sucesso(chave) { falhas.delete(chave); },
  };
};
