import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Carregando } from '@/components/Carregando';
import { AppProvider } from '@/estado/AppProvider';
import { DadosProvider } from '@/estado/DadosProvider';
import { useEstadoSessao } from '@/estado/useSessao';

function Navegacao() {
  const sessao = useEstadoSessao();
  if (sessao.status === 'carregando') return <Carregando texto="Entrando…" />;
  const logado = sessao.status === 'logado';
  // Rotas protegidas: sem sessão só existe o login; com sessão só existe o app. Trocar o estado redireciona sozinho.
  return (
    <DadosProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={logado}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!logado}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </DadosProvider>
  );
}

export default function RaizLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppProvider>
        <Navegacao />
      </AppProvider>
    </SafeAreaProvider>
  );
}
