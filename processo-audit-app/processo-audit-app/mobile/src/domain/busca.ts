import type { GrupoPosse } from './posse';

/** Minúsculas e sem acentos, para a busca achar "conector" digitando "Conéctor". */
export const normalizar = (texto: string): string => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Todas as palavras digitadas precisam aparecer no nome do item ou no código do lote. */
export const filtrarGrupos = (grupos: readonly GrupoPosse[], termo: string): GrupoPosse[] => {
  const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
  if (!palavras.length) return [...grupos];
  return grupos.filter((g) => {
    const alvo = normalizar(`${g.item_nome} ${g.lote_codigo ?? ''} ${g.lotes.map((l) => l.lote_codigo).join(' ')}`);
    return palavras.every((p) => alvo.includes(p));
  });
};
