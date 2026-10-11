import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mensagemDeErro } from '@/api/erros';
import { Botao } from '@/components/Botao';
import { Faixa } from '@/components/Faixa';
import { confirmar } from '@/components/confirmar';
import { espaco, fonte, type Paleta } from '@/theme';
import { useEstilos } from '@/estado/tema';

interface Props {
  donoNome: string | null;
  pendencias: number;
  onSair: () => Promise<void>;
  onDescartar: () => Promise<void>;
}

/**
 * Outro técnico deixou trabalho que o servidor ainda não recebeu neste aparelho. Nada é mostrado nem apagado: a pessoa escolhe
 * entre voltar para a conta dona dos dados (para enviá-los) ou descartá-los, depois de uma confirmação explícita.
 */
export function TelaBloqueio({ donoNome, pendencias, onSair, onDescartar }: Props) {
  const s = useEstilos(criarEstilos);
  const { top, bottom } = useSafeAreaInsets();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const dono = donoNome ?? 'outro técnico';

  const descartar = async () => {
    const ok = await confirmar(`Descartar o trabalho de ${dono}?`, `${pendencias} item(ns) que ainda não chegaram ao servidor serão apagados deste aparelho. Isso não pode ser desfeito e o trabalho será perdido.`, 'Descartar');
    if (!ok) return;
    const certeza = await confirmar('Tem certeza?', `Se ${dono} ainda não enviou, o escritório não vai receber o que foi feito em campo.`, 'Sim, descartar');
    if (!certeza) return;
    setOcupado(true);
    try { await onDescartar(); } catch (e) { setErro(mensagemDeErro(e)); } finally { setOcupado(false); }
  };

  return (
    <ScrollView style={s.tela} contentContainerStyle={[s.conteudo, { paddingTop: top + espaco.xl, paddingBottom: bottom + espaco.xl }]}>
      <Text style={s.titulo} accessibilityRole="header">Há trabalho não enviado neste aparelho</Text>
      <Text style={s.texto}>{dono} deixou {pendencias === 1 ? '1 item' : `${pendencias} itens`} (lançamentos de material, fotos ou finalização de OS) que o servidor ainda não recebeu.</Text>
      <Text style={s.texto}>Para não perder nada, o aplicativo não mostra nem apaga esses dados sozinho.</Text>
      {erro ? <Faixa tom="erro" texto={erro} /> : null}
      <View style={s.acoes}>
        <Botao titulo={`Sair desta conta e entrar como ${dono}`} onPress={() => void onSair()} carregando={ocupado} testID="bloqueio-sair" />
        <Text style={s.dica}>{dono} entra com a própria senha, o aplicativo envia o que ficou pendente e depois a troca de conta é liberada.</Text>
        <Botao titulo={`Descartar o trabalho de ${dono}`} variante="perigo" onPress={() => void descartar()} carregando={ocupado} testID="bloqueio-descartar" />
      </View>
    </ScrollView>
  );
}

const criarEstilos = (cores: Paleta) => StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { paddingHorizontal: espaco.lg, gap: espaco.lg },
  titulo: { fontSize: fonte.grande, fontWeight: '800', color: cores.primariaEscura },
  texto: { fontSize: fonte.corpo + 1, color: cores.texto, lineHeight: 24 },
  acoes: { gap: espaco.md, marginTop: espaco.md },
  dica: { fontSize: fonte.pequena + 1, color: cores.textoSuave, lineHeight: 20 },
});
