import { useMemo } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { paletaClara, paletaEscura, tonsDe, type Paleta, type Tons } from '@/theme';

/** O técnico escolhe na tela Conta: seguir o aparelho (padrão), sempre claro ou sempre escuro. */
export type PreferenciaTema = 'sistema' | 'claro' | 'escuro';
export const PREFERENCIAS: ReadonlyArray<{ valor: PreferenciaTema; rotulo: string }> = [
  { valor: 'sistema', rotulo: 'Automático' }, { valor: 'claro', rotulo: 'Claro' }, { valor: 'escuro', rotulo: 'Escuro' },
];
export const preferenciaValida = (v: unknown): v is PreferenciaTema => v === 'sistema' || v === 'claro' || v === 'escuro';

/** Paleta que vale agora (reage à mudança do aparelho e à escolha do técnico). */
export const paletaDoEsquema = (esquema: string | null | undefined): Paleta => (esquema === 'dark' ? paletaEscura : paletaClara);
export const useCores = (): Paleta => paletaDoEsquema(useColorScheme());
export const useTons = (): Tons => { const c = useCores(); return useMemo(() => tonsDe(c), [c]); };

/** Estilos que dependem das cores: `criar` fica fora do componente e é recalculada só quando o tema muda. */
export const useEstilos = <T,>(criar: (c: Paleta) => T): T => {
  const c = useCores();
  return useMemo(() => criar(c), [c, criar]);
};

/** Faz o app inteiro (e os diálogos nativos) seguir a escolha. Sem suporte na plataforma, não faz nada. */
export const aplicarPreferencia = (p: PreferenciaTema): void => {
  try { (Appearance as unknown as { setColorScheme?: (v: string) => void }).setColorScheme?.(p === 'sistema' ? 'auto' : p === 'claro' ? 'light' : 'dark'); } catch { /* plataforma sem a função */ }
};
