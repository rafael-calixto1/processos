import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { mensagemDeErro } from '@/api/erros';
import { BarraAcao } from '@/components/BarraAcao';
import { Botao } from '@/components/Botao';
import { Cabecalho } from '@/components/Cabecalho';
import { EstadoVazio } from '@/components/EstadoVazio';
import { Faixa } from '@/components/Faixa';
import { confirmar } from '@/components/confirmar';
import { ETAPAS, type ChaveEtapa } from '@/domain/etapas';
import { resumoDaEtapa } from '@/domain/resumoEtapas';
import { useDados } from '@/estado/DadosProvider';
import { useFinalizacao } from '@/estado/FinalizacaoProvider';
import { ALVO_MINIMO, cores, espaco, fonte, raio } from '@/theme';

const ROTA: Record<ChaveEtapa, string> = {
  descricao: 'descricao', motivo: 'motivo', local: 'local', checklist: 'checklist', usados: 'materiais', retirados: 'retirados', fotos: 'fotos', participantes: 'participantes',
};

/** Hub da finalização: progresso, as 8 etapas na ordem do sistema e o botão Finalizar fixo (travado até estar tudo certo). */
export default function HubFinalizacao() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { ops, comandos } = useDados();
  const f = useFinalizacao();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const voltarParaOS = () => router.replace({ pathname: '/os/[id]', params: { id: String(id) } });

  if (!f.os) {
    return (
      <View style={s.tela}>
        <Cabecalho titulo="Finalização" aoVoltar={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        {f.dados ? <EstadoVazio icone="alert-circle-outline" titulo="OS não encontrada" texto="Ela pode ter sido encerrada ou passada para outro técnico." acao={{ rotulo: 'Voltar para minhas OS', onPress: () => router.replace('/') }} /> : null}
      </View>
    );
  }
  const os = f.os;
  const subtitulo = `OS #${os.numero} · ${os.cliente}`;

  if (os.status === 'aberta') {
    return (
      <View style={s.tela}>
        <Cabecalho titulo="Finalização" subtitulo={subtitulo} aoVoltar={voltarParaOS} />
        <EstadoVazio icone="play-circle-outline" titulo="Inicie a execução primeiro" texto="Toque em “Iniciar execução” na tela da OS. Funciona mesmo sem sinal." acao={{ rotulo: 'Voltar para a OS', onPress: voltarParaOS }} />
      </View>
    );
  }

  // Situação depois de finalizar: nunca mostra sucesso que o servidor ainda não confirmou
  if (os.finalizacao !== 'nenhuma' || os.status === 'concluida' || os.status === 'cancelada') {
    const opFin = ops.find((o) => o.os_id === os.id && o.tipo === 'finalizar' && o.estado !== 'ok');
    const concluida = os.finalizacao === 'enviada' || os.status === 'concluida';
    const voltarAEditar = async () => {
      setErro(null);
      try { setOcupado(true); await comandos.voltarAEditar(os.id); } catch (e) { setErro(mensagemDeErro(e)); } finally { setOcupado(false); }
    };
    return (
      <View style={s.tela}>
        <Cabecalho titulo="Finalização" subtitulo={subtitulo} aoVoltar={voltarParaOS} />
        <ScrollView contentContainerStyle={s.situacao}>
          {erro ? <Faixa tom="erro" texto={erro} /> : null}
          {concluida ? (
            <>
              <Ionicons name="checkmark-circle" size={96} color={cores.sucesso} />
              <Text style={s.tituloSituacao} accessibilityRole="header">OS #{os.numero} finalizada</Text>
              <Text style={s.textoSituacao}>O servidor recebeu a finalização. A OS agora é somente leitura.</Text>
            </>
          ) : os.finalizacao === 'atencao' ? (
            <>
              <Ionicons name="alert-circle" size={96} color={cores.erro} />
              <Text style={s.tituloSituacao} accessibilityRole="header">O servidor não aceitou a finalização</Text>
              <Text style={s.textoSituacao}>{opFin?.erro?.mensagem ?? 'Veja o que precisa ser corrigido.'}</Text>
              <Botao titulo="Ver o que precisa ser resolvido" onPress={() => router.push('/atencao')} estilo={{ alignSelf: 'stretch' }} />
              {opFin && opFin.estado === 'atencao' ? <Botao titulo="Voltar a editar" variante="secundario" onPress={voltarAEditar} carregando={ocupado} estilo={{ alignSelf: 'stretch' }} testID="voltar-a-editar" /> : null}
            </>
          ) : (
            <>
              <Ionicons name="cloud-upload" size={96} color={cores.aviso} />
              <Text style={s.tituloSituacao} accessibilityRole="header">Finalização salva no aparelho</Text>
              <Text style={s.textoSituacao}>Ainda não chegou ao servidor. Ela será enviada assim que houver conexão; você pode fechar o aplicativo.</Text>
              {opFin && opFin.estado !== 'enviando' ? <Botao titulo="Voltar a editar" variante="secundario" onPress={voltarAEditar} carregando={ocupado} estilo={{ alignSelf: 'stretch' }} testID="voltar-a-editar" /> : null}
            </>
          )}
        </ScrollView>
        <BarraAcao><Botao titulo="Voltar para minhas OS" onPress={() => router.replace('/')} testID="botao-minhas-os" /></BarraAcao>
      </View>
    );
  }

  const info = { motivos: f.dados?.motivos ?? [], lancamentos: f.lancamentos.filter((l) => l.linhas.length > 0).length, fotos: f.totalFotos };
  const obrigatorias = ETAPAS.filter((e) => e.obrigatoria);

  const finalizar = async () => {
    setErro(null);
    const ok = await confirmar(`Finalizar a OS #${os.numero}?`, 'Depois de finalizada, a OS fica somente leitura. Se estiver sem sinal, a finalização é enviada quando a conexão voltar.', 'Finalizar');
    if (!ok) return;
    setOcupado(true);
    try { await f.salvarAgora(); await comandos.finalizar(os.id); } catch (e) { setErro(mensagemDeErro(e)); } finally { setOcupado(false); }
  };

  return (
    <View style={s.tela}>
      <Cabecalho titulo="Finalização" subtitulo={subtitulo} aoVoltar={voltarParaOS} />
      <ScrollView contentContainerStyle={s.conteudo}>
        {erro ? <Faixa tom="erro" texto={erro} /> : null}
        <View accessible accessibilityLabel={`${f.progresso.feitas} de ${f.progresso.total} etapas obrigatórias concluídas`}>
          <View style={s.trilho} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: f.progresso.total, now: f.progresso.feitas }}>
            <View style={[s.barra, { width: `${(f.progresso.feitas / f.progresso.total) * 100}%` }]} />
          </View>
          <Text style={s.progresso}>{f.progresso.feitas} de {f.progresso.total} etapas obrigatórias concluídas</Text>
        </View>
        {ETAPAS.map((e) => {
          const feita = f.concluidas[e.chave];
          const resumo = resumoDaEtapa(e.chave, f.rascunho, f.contexto, info);
          return (
            <Pressable key={e.chave} testID={`etapa-${e.chave}`} accessibilityRole="button" accessibilityLabel={`${e.rotulo}${e.obrigatoria ? '' : ', opcional'}, ${feita ? 'concluída' : 'pendente'}${resumo ? `, ${resumo}` : ''}`}
              onPress={() => router.push({ pathname: `/os/[id]/finalizar/${ROTA[e.chave]}` as '/os/[id]/finalizar/descricao', params: { id: String(os.id) } })}
              style={({ pressed }) => [s.etapa, feita && s.etapaFeita, pressed && { opacity: 0.85 }]}>
              <Ionicons name={feita ? 'checkmark-circle' : e.obrigatoria ? 'ellipse-outline' : 'remove-circle-outline'} size={30} color={feita ? cores.sucesso : cores.desabilitado} />
              <View style={s.etapaTextos}>
                <Text style={s.etapaRotulo}>{e.rotulo}{e.obrigatoria ? '' : ' (opcional)'}</Text>
                {resumo ? <Text style={s.etapaResumo} numberOfLines={2}>{resumo}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={22} color={cores.desabilitado} />
            </Pressable>
          );
        })}
        <Text style={s.nota}>Tudo o que você preenche é salvo no aparelho na hora, mesmo sem sinal.</Text>
      </ScrollView>
      <BarraAcao>
        {!f.pode ? <Text style={s.dica}>Conclua as {obrigatorias.length} etapas obrigatórias para finalizar.</Text> : null}
        <Botao titulo="Finalizar" onPress={finalizar} desabilitado={!f.pode} carregando={ocupado} testID="botao-finalizar" />
      </BarraAcao>
    </View>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.md, paddingBottom: espaco.xxl },
  trilho: { height: 14, borderRadius: raio.pilula, backgroundColor: cores.neutroClaro, overflow: 'hidden' },
  barra: { height: 14, backgroundColor: cores.primariaBotao },
  progresso: { marginTop: espaco.xs, fontSize: fonte.corpo, fontWeight: '700', color: cores.textoSuave },
  etapa: { flexDirection: 'row', alignItems: 'center', gap: espaco.md, minHeight: 64, paddingHorizontal: espaco.lg, paddingVertical: espaco.sm, borderRadius: raio.md, borderWidth: 2, borderColor: cores.borda, backgroundColor: cores.superficie },
  etapaFeita: { borderColor: cores.sucesso },
  etapaTextos: { flex: 1, gap: 2, minHeight: ALVO_MINIMO, justifyContent: 'center' },
  etapaRotulo: { fontSize: fonte.destaque, fontWeight: '700', color: cores.texto },
  etapaResumo: { fontSize: fonte.pequena + 1, color: cores.textoSuave },
  nota: { fontSize: fonte.pequena + 1, color: cores.textoSuave, textAlign: 'center', marginTop: espaco.sm },
  dica: { fontSize: fonte.pequena + 1, color: cores.textoSuave, textAlign: 'center' },
  situacao: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: espaco.xl, gap: espaco.lg },
  tituloSituacao: { fontSize: fonte.grande, fontWeight: '800', color: cores.primariaEscura, textAlign: 'center' },
  textoSituacao: { fontSize: fonte.corpo + 1, color: cores.texto, textAlign: 'center', lineHeight: 24 },
});
