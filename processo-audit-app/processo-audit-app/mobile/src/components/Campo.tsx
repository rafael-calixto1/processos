import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { ALVO_MINIMO, cores, espaco, fonte, raio } from '@/theme';

interface Props extends TextInputProps { rotulo: string; erro?: string | null; senha?: boolean }

/** Campo de texto com rótulo sempre visível, mensagem de erro e (para senha) botão de mostrar/ocultar. */
export const Campo = forwardRef<TextInput, Props>(function Campo({ rotulo, erro, senha, style, ...resto }, ref) {
  const [oculta, setOculta] = useState(true);
  return (
    <View style={s.grupo}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <View style={[s.caixa, erro ? s.caixaErro : null]}>
        <TextInput
          ref={ref}
          accessibilityLabel={rotulo}
          placeholderTextColor={cores.desabilitado}
          style={[s.input, style]}
          secureTextEntry={senha && oculta}
          {...resto}
        />
        {senha ? (
          <Pressable onPress={() => setOculta((o) => !o)} accessibilityRole="button" accessibilityLabel={oculta ? 'Mostrar senha' : 'Ocultar senha'} style={s.olho} hitSlop={8}>
            <Text style={s.olhoTexto}>{oculta ? 'Mostrar' : 'Ocultar'}</Text>
          </Pressable>
        ) : null}
      </View>
      {erro ? <Text style={s.erro} accessibilityRole="alert">{erro}</Text> : null}
    </View>
  );
});

const s = StyleSheet.create({
  grupo: { gap: espaco.xs },
  rotulo: { fontSize: fonte.pequena + 1, fontWeight: '700', color: cores.textoSuave },
  caixa: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderWidth: 2, borderColor: cores.borda, borderRadius: raio.md, backgroundColor: cores.superficie, paddingHorizontal: espaco.md },
  caixaErro: { borderColor: cores.erro },
  input: { flex: 1, minHeight: ALVO_MINIMO, fontSize: fonte.destaque, color: cores.texto },
  olho: { minHeight: ALVO_MINIMO, justifyContent: 'center', paddingLeft: espaco.md },
  olhoTexto: { fontSize: fonte.pequena + 1, fontWeight: '800', color: cores.primariaEscura },
  erro: { fontSize: fonte.pequena + 1, color: cores.erro, fontWeight: '600' },
});
