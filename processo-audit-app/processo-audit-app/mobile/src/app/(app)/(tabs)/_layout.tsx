import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cores, fonte } from '@/theme';

export default function AbasLayout() {
  const { bottom } = useSafeAreaInsets();
  const icone = (nome: keyof typeof Ionicons.glyphMap) => ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={nome} size={size + 2} color={color} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: cores.primariaEscura,
        tabBarInactiveTintColor: cores.textoSuave,
        tabBarLabelStyle: { fontSize: fonte.pequena, fontWeight: '700' },
        tabBarStyle: { height: 62 + bottom, paddingTop: 6, paddingBottom: Math.max(bottom, 6), backgroundColor: cores.superficie, borderTopColor: cores.borda },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Minhas OS', tabBarIcon: icone('list-outline') }} />
      <Tabs.Screen name="estoque" options={{ title: 'Meu estoque', tabBarIcon: icone('cube-outline') }} />
      <Tabs.Screen name="conta" options={{ title: 'Conta', tabBarIcon: icone('person-circle-outline') }} />
    </Tabs>
  );
}
