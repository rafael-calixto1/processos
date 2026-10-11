import { Stack, useLocalSearchParams } from 'expo-router';
import { FinalizacaoProvider } from '@/estado/FinalizacaoProvider';

/** Todas as telas da finalização de uma OS compartilham o mesmo rascunho (salvo no aparelho a cada alteração). */
export default function FinalizacaoLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <FinalizacaoProvider osId={Number(id)}>
      <Stack screenOptions={{ headerShown: false }} />
    </FinalizacaoProvider>
  );
}
