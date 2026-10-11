import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDados } from '@/estado/DadosProvider';
import { cores, fonte } from '@/theme';

export default function AbasLayout() {
  const { bottom } = useSafeAreaInsets();
  const { contagens } = useDados();
  const icone = (nome: keyof typeof Ionicons.glyphMap) => ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={nome} size={size + 2} color={color} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: cores.primariaEscura,
        tabBarInactiveTintColor: cores.textoSuave,
        tabBarLabelStyle: { fontSize: fonte.pequena, fontWeight: '700' },
        tabBarStyle: { height: 74 + bottom, paddingTop: 8, paddingBottom: Math.max(bottom, 10), backgroundColor: cores.superficie, borderTopColor: cores.borda },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Minhas OS', tabBarIcon: icone('list-outline'), tabBarBadge: contagens.atencao > 0 ? contagens.atencao : undefined, tabBarBadgeStyle: { backgroundColor: cores.erro }, tabBarAccessibilityLabel: contagens.atencao > 0 ? `Minhas OS, ${contagens.atencao} item(ns) requer(em) atenção` : 'Minhas OS' }} />
      <Tabs.Screen name="estoque" options={{ title: 'Meu estoque', tabBarIcon: icone('cube-outline') }} />
      <Tabs.Screen name="conta" options={{ title: 'Conta', tabBarIcon: icone('person-circle-outline') }} />
    </Tabs>
  );
}
