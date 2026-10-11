import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Carregando } from '@/components/Carregando';
import { TelaBloqueio } from '@/components/TelaBloqueio';
import { AppProvider } from '@/estado/AppProvider';
import { DadosProvider, useDados } from '@/estado/DadosProvider';
import { useApp } from '@/estado/AppProvider';
import { useEstadoSessao } from '@/estado/useSessao';

function Rotas({ logado }: { logado: boolean }) {
  const { bloqueio, descartarTudo } = useDados();
  const { sessao } = useApp();
  // Outro técnico deixou trabalho não enviado neste aparelho: nada é mostrado até a pessoa decidir (sair ou descartar com confirmação).
  if (logado && bloqueio) return <TelaBloqueio donoNome={bloqueio.donoNome} pendencias={bloqueio.pendencias} onSair={() => sessao.sair()} onDescartar={descartarTudo} />;
  // Rotas protegidas: sem sessão só existe o login; com sessão só existe o app. Trocar o estado redireciona sozinho.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={logado}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!logado}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

function Navegacao() {
  const sessao = useEstadoSessao();
  if (sessao.status === 'carregando') return <Carregando texto="Entrando…" />;
  return (
    <DadosProvider>
      <Rotas logado={sessao.status === 'logado'} />
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
