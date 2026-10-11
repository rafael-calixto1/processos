import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError, NetworkError, mensagemDeErro } from '@/api/erros';
import { Botao } from '@/components/Botao';
import { Campo } from '@/components/Campo';
import { Faixa } from '@/components/Faixa';
import { useApp } from '@/estado/AppProvider';
import { useEstadoSessao } from '@/estado/useSessao';
import { espaco, fonte, type Paleta } from '@/theme';
import { useEstilos } from '@/estado/tema';

const textoDoErro = (e: unknown): string => {
  if (e instanceof ApiError && e.status === 429) {
    const min = e.retryAfter ? Math.max(1, Math.ceil(e.retryAfter / 60)) : null;
    return `${e.message}${min ? ` Tente de novo em ${min} min.` : ''}`;
  }
  if (e instanceof NetworkError) return `${e.message} Confira também o endereço do servidor.`;
  return mensagemDeErro(e);
};

export default function Login() {
  const s = useEstilos(criarEstilos);
  const { sessao, servidor } = useApp();
  const estado = useEstadoSessao();
  const router = useRouter();
  const senhaRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [endereco, setEndereco] = useState(servidor.url() ?? '');
  const [mostrarServidor, setMostrarServidor] = useState(!servidor.url());
  const [erros, setErros] = useState<{ email?: string; senha?: string; servidor?: string; geral?: string }>({});
  const [enviando, setEnviando] = useState(false);

  const entrar = async () => {
    if (enviando) return;
    const novos: typeof erros = {};
    if (!email.trim()) novos.email = 'Informe seu e-mail';
    if (!senha) novos.senha = 'Informe sua senha';
    if (mostrarServidor || !servidor.url()) {
      const r = await servidor.definir(endereco);
      if (!r.ok) { novos.servidor = r.erro; setMostrarServidor(true); }
    }
    setErros(novos);
    if (Object.keys(novos).length) return;
    setEnviando(true);
    try {
      await sessao.entrar(email, senha);
      router.replace('/');
    } catch (e) {
      setErros({ geral: textoDoErro(e) });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SafeAreaView style={s.tela}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.tela}>
        <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
          <View style={s.marca}>
            <Text style={s.titulo} accessibilityRole="header">CW Campo</Text>
            <Text style={s.subtitulo}>Execução de ordens de serviço em campo</Text>
          </View>

          {estado.status === 'deslogado' && estado.motivo === 'expirada' ? <Faixa texto="Sua sessão expirou. Entre novamente." tom="info" icone="lock-closed-outline" /> : null}
          {erros.geral ? <Faixa texto={erros.geral} tom="erro" /> : null}

          <Campo rotulo="E-mail" value={email} onChangeText={setEmail} erro={erros.email} autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
            autoComplete="email" textContentType="emailAddress" returnKeyType="next" onSubmitEditing={() => senhaRef.current?.focus()} testID="campo-email" />
          <Campo ref={senhaRef} rotulo="Senha" value={senha} onChangeText={setSenha} erro={erros.senha} senha autoCapitalize="none" autoCorrect={false}
            autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={entrar} testID="campo-senha" />

          {mostrarServidor ? (
            <Campo rotulo="Endereço do servidor" value={endereco} onChangeText={setEndereco} erro={erros.servidor} autoCapitalize="none" autoCorrect={false}
              keyboardType="url" placeholder="ex.: 10.100.100.130:5002" testID="campo-servidor" />
          ) : (
            <Pressable onPress={() => setMostrarServidor(true)} accessibilityRole="button" accessibilityLabel="Alterar o endereço do servidor" style={s.linkServidor} hitSlop={8}>
              <Text style={s.linkTexto}>Servidor: {servidor.url()}  ·  Alterar</Text>
            </Pressable>
          )}

          <Botao titulo="Entrar" onPress={entrar} carregando={enviando} testID="botao-entrar" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const criarEstilos = (cores: Paleta) => StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { flexGrow: 1, justifyContent: 'center', padding: espaco.xl, gap: espaco.lg },
  marca: { gap: espaco.xs, marginBottom: espaco.md },
  titulo: { fontSize: fonte.grande + 4, fontWeight: '800', color: cores.primariaEscura },
  subtitulo: { fontSize: fonte.corpo, color: cores.textoSuave },
  linkServidor: { minHeight: 48, justifyContent: 'center' },
  linkTexto: { fontSize: fonte.pequena + 1, color: cores.textoSuave, textDecorationLine: 'underline' },
});
