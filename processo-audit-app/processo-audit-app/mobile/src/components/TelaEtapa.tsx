import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { BarraAcao } from '@/components/BarraAcao';
import { Botao } from '@/components/Botao';
import { Cabecalho } from '@/components/Cabecalho';
import { EstadoVazio } from '@/components/EstadoVazio';
import { Faixa } from '@/components/Faixa';
import { useFinalizacao } from '@/estado/FinalizacaoProvider';
import { cores, espaco } from '@/theme';

interface Props {
  titulo: string;
  concluida?: boolean;
  /** Botão fixo no rodapé. Padrão: "Salvar e voltar". */
  acao?: ReactNode;
  children: ReactNode;
}

/**
 * Moldura de uma etapa da finalização: cabeçalho com voltar, conteúdo que rola, ação fixa no rodapé ao alcance do polegar e os
 * estados de carregando, OS indisponível e "finalização já na fila" (somente leitura) resolvidos num lugar só.
 */
export function TelaEtapa({ titulo, concluida, acao, children }: Props) {
  const router = useRouter();
  const f = useFinalizacao();
  const voltar = async () => {
    await f.salvarAgora();
    if (router.canGoBack()) router.back(); else router.replace('/');
  };
  const subtitulo = f.os ? `OS #${f.os.numero} · ${f.os.cliente}` : undefined;

  if (!f.os) {
    return (
      <View style={s.tela}>
        <Cabecalho titulo={titulo} aoVoltar={voltar} />
        {f.dados ? <EstadoVazio icone="alert-circle-outline" titulo="OS não encontrada" texto="Ela pode ter sido encerrada ou passada para outro técnico." acao={{ rotulo: 'Voltar', onPress: voltar }} /> : null}
      </View>
    );
  }
  return (
    <View style={s.tela}>
      <Cabecalho titulo={titulo} subtitulo={subtitulo} aoVoltar={voltar} />
      <KeyboardAvoidingView style={s.corpo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
          {f.erroSalvar ? <Faixa tom="erro" texto={`Não foi possível guardar o que você digitou: ${f.erroSalvar}`} /> : null}
          {!f.editavel ? <Faixa tom="info" icone="lock-closed-outline" texto="Esta OS não aceita mais mudanças aqui (ela já foi finalizada ou está na fila para finalizar)." /> : null}
          {concluida === false && f.editavel ? <Faixa tom="aviso" icone="ellipse-outline" texto="Etapa obrigatória ainda não concluída." /> : null}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
      <BarraAcao>{acao ?? <Botao titulo="Salvar e voltar" onPress={voltar} testID="botao-salvar-voltar" />}</BarraAcao>
    </View>
  );
}
const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  corpo: { flex: 1 },
  conteudo: { padding: espaco.lg, gap: espaco.lg, paddingBottom: espaco.xxl },
});
