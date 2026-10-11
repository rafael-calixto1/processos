import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Botao } from '@/components/Botao';
import { Faixa } from '@/components/Faixa';
import { espaco, fonte, raio, type Paleta } from '@/theme';
import { useCores, useEstilos } from '@/estado/tema';

interface Props { aoLer: (texto: string) => void; aoFechar: () => void }

/** SIMULAÇÃO do leitor, só para a pré-visualização no navegador (sem câmera): digita-se o que o QR da etiqueta traria — o código do lote. */
export function LeitorQR({ aoLer, aoFechar }: Props) {
  const cores = useCores();
  const s = useEstilos(criarEstilos);
  const { top } = useSafeAreaInsets();
  const [texto, setTexto] = useState('');
  return (
    <View style={[s.tela, { paddingTop: top + espaco.xl }]}>
      <Text style={s.titulo} accessibilityRole="header">Leitor de QR (simulado)</Text>
      <Faixa tom="aviso" icone="flask-outline" texto="SIMULAÇÃO: este navegador não tem câmera. No celular, a câmera lê o QR da etiqueta. Aqui, digite o código do lote." />
      <TextInput testID="leitor-codigo" accessibilityLabel="Código do lote" value={texto} onChangeText={setTexto} autoCapitalize="characters" placeholder="LOTE-BOB-0001" placeholderTextColor={cores.desabilitado} style={s.campo} />
      <Botao titulo="Ler código" onPress={() => aoLer(texto)} desabilitado={!texto.trim()} testID="leitor-ler" />
      <Botao titulo="Fechar" variante="secundario" onPress={aoFechar} testID="leitor-fechar" />
    </View>
  );
}
const criarEstilos = (cores: Paleta) => StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo, paddingHorizontal: espaco.lg, gap: espaco.lg },
  titulo: { fontSize: fonte.grande, fontWeight: '800', color: cores.primariaEscura },
  campo: { minHeight: 56, borderWidth: 2, borderColor: cores.borda, borderRadius: raio.md, paddingHorizontal: espaco.md, fontSize: fonte.destaque, color: cores.texto, backgroundColor: cores.superficie },
});
