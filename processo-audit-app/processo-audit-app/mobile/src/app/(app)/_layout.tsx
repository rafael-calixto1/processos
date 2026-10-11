import { Stack } from 'expo-router';
import { useCores } from '@/estado/tema';

export default function AppLayout() {
  const cores = useCores();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cores.fundo } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="atencao" />
      <Stack.Screen name="devolver" />
      <Stack.Screen name="devolucoes" />
      <Stack.Screen name="ficha" />
    </Stack>
  );
}
