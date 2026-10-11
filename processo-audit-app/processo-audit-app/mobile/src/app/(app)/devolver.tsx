import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { mensagemDeErro } from '@/api/erros';
import { BarraAcao } from '@/components/BarraAcao';
import { Botao } from '@/components/Botao';
import { Cabecalho } from '@/components/Cabecalho';
import { Cartao } from '@/components/Cartao';
import { EstadoVazio } from '@/components/EstadoVazio';
import { Faixa } from '@/components/Faixa';
import { LeitorQR } from '@/components/LeitorQR';
import { Segmento } from '@/components/Segmento';
import { filtrarGrupos } from '@/domain/busca';
import { acharGrupoPorCodigo, agrupar, extrairCodigoLote, validarQuantidadeGrupo, type GrupoPosse } from '@/domain/posse';
import { fmtQtd } from '@/domain/quantidade';
import type { CondicaoMaterial } from '@/domain/tipos';
import { useDados } from '@/estado/DadosProvider';
import { ALVO_MINIMO, cores, espaco, fonte, raio } from '@/theme';

const CONDICOES = [{ valor: 'novo', rotulo: 'Novo' }, { valor: 'usado', rotulo: 'Usado' }] as const;

/** Devolver material ao estoque: o técnico só SOLICITA; o saldo muda quando o estoque aprova. Funciona sem sinal (vai para a fila). */
export default function Devolver() {
  const router = useRouter();
  const { dados, carregado, comandos } = useDados();
  const grupos = useMemo(() => agrupar(dados?.posse ?? []), [dados]);
  const [qtds, setQtds] = useState<Record<string, string>>({});
  const [condicoes, setCondicoes] = useState<Record<string, CondicaoMaterial | null>>({});
  const [observacao, setObservacao] = useState('');
  const [busca, setBusca] = useState('');
  const [lendo, setLendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const visiveis = filtrarGrupos(grupos, busca);
  const selecionados = grupos.filter((g) => qtds[g.key] !== undefined);
  const pronto = (g: GrupoPosse) => validarQuantidadeGrupo(g, qtds[g.key]).ok && !!condicoes[g.key];
  const pode = selecionados.length > 0 && selecionados.every(pronto);
  const voltar = () => (router.canGoBack() ? router.back() : router.replace('/estoque'));

  const alternar = (g: GrupoPosse) => setQtds((q) => { const n = { ...q }; if (n[g.key] !== undefined) delete n[g.key]; else n[g.key] = ''; return n; });

  const aoLerQR = (texto: string) => {
    setLendo(false); setErro(null); setAviso(null);
    const g = acharGrupoPorCodigo(grupos, texto);
    const codigo = extrairCodigoLote(texto);
    if (!g) { setErro(`O lote ${codigo} não está na sua posse (conforme os dados deste aparelho). Se acabou de retirá-lo, sincronize quando tiver internet.`); return; }
    if (g.quantidade <= 0) { setErro(`${g.item_nome}: todo o material deste lote já está separado em outro pedido ou lançamento.`); return; }
    setQtds((q) => (q[g.key] === undefined ? { ...q, [g.key]: '' } : q));
    setAviso(`Lote ${codigo} encontrado: ${g.item_nome}. Informe a quantidade e a condição.`);
  };

  const enviar = async () => {
    setErro(null); setSalvando(true);
    try {
      await comandos.solicitarDevolucao({ itens: selecionados.map((g) => ({ chaveGrupo: g.key, quantidade: qtds[g.key], condicao: condicoes[g.key] ?? null })), observacao });
      router.replace('/devolucoes');
    } catch (e) { setErro(mensagemDeErro(e)); } finally { setSalvando(false); }
  };

  if (lendo) return <LeitorQR aoLer={aoLerQR} aoFechar={() => setLendo(false)} />;

  return (
    <View style={s.tela}>
      <Cabecalho titulo="Devolver material" subtitulo="Pedido ao estoque" aoVoltar={voltar} />
      <KeyboardAvoidingView style={s.corpo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
          <Faixa tom="info" icone="information-circle-outline" texto="Você faz o pedido; o estoque confere e aprova. Seu saldo só diminui depois da aprovação, mas este material fica separado e não pode ser usado em lançamentos." />
          {erro ? <Faixa tom="erro" texto={erro} /> : null}
          {aviso ? <Faixa tom="sucesso" icone="checkmark-circle-outline" texto={aviso} /> : null}

          {carregado && grupos.length === 0 ? (
            <EstadoVazio icone="cube-outline" titulo="Você não tem material para devolver" texto="O material retirado no almoxarifado aparece aqui." />
          ) : (
            <Cartao titulo="O que você vai devolver">
              <Botao titulo="Ler QR do lote" variante="secundario" onPress={() => { setAviso(null); setLendo(true); }} testID="botao-ler-qr" />
              <TextInput testID="busca-posse" accessibilityLabel="Buscar item ou lote" value={busca} onChangeText={setBusca} placeholder="Buscar item ou lote" placeholderTextColor={cores.desabilitado} style={s.campo} autoCorrect={false} />
              {visiveis.length === 0 && grupos.length > 0 ? <Text style={s.nota}>Nada encontrado para “{busca}”.</Text> : null}
              {visiveis.map((g) => {
                const marcado = qtds[g.key] !== undefined;
                const q = marcado ? validarQuantidadeGrupo(g, qtds[g.key]) : null;
                const nada = g.quantidade <= 0;
                const lote = g.lote_codigo ?? (g.lotes.length === 1 ? g.lotes[0].lote_codigo : `${g.lotes.length} lotes`);
                return (
                  <View key={g.key} style={s.grupo}>
                    <Pressable testID={`grupo-${g.key}`} onPress={() => alternar(g)} disabled={nada && !marcado} accessibilityRole="checkbox" accessibilityState={{ checked: marcado, disabled: nada && !marcado }}
                      accessibilityLabel={`${g.item_nome}, ${lote}, disponível para devolver ${fmtQtd(g.quantidade, g.unidade)}`} style={[s.linhaGrupo, marcado && s.linhaMarcada, nada && !marcado && { opacity: 0.5 }]}>
                      <Ionicons name={marcado ? 'checkbox' : 'square-outline'} size={28} color={marcado ? cores.primariaBotao : cores.textoSuave} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.nomeGrupo}>{g.item_nome}</Text>
                        <Text style={s.detGrupo}>{lote} · disponível: {fmtQtd(g.quantidade, g.unidade)}</Text>
                        {g.emDevolucao > 0 ? <Text style={s.separado}>Já separado para devolução: {fmtQtd(g.emDevolucao, g.unidade)}</Text> : null}
                        {g.reservado > 0 ? <Text style={s.separado}>Reservado em lançamentos não enviados: {fmtQtd(g.reservado, g.unidade)}</Text> : null}
                      </View>
                    </Pressable>
                    {marcado ? (
                      <View style={s.detalhe}>
                        <View style={s.qtdLinha}>
                          <TextInput testID={`qtd-${g.key}`} accessibilityLabel={`Quantidade de ${g.item_nome} a devolver`} keyboardType={g.unidade === 'pecas' ? 'number-pad' : 'decimal-pad'} value={qtds[g.key]}
                            onChangeText={(t) => setQtds((x) => ({ ...x, [g.key]: t }))} placeholder="Quantidade" placeholderTextColor={cores.desabilitado}
                            style={[s.campo, s.campoQtd, q && !q.ok && qtds[g.key] !== '' ? s.campoErro : null]} />
                          <Text style={s.unidade}>{g.unidade === 'metros' ? 'm' : 'un'}</Text>
                        </View>
                        <Text style={[s.limite, q && !q.ok && qtds[g.key] !== '' ? s.limiteErro : null]} accessibilityRole="alert" testID={`limite-${g.key}`}>
                          {q && !q.ok && qtds[g.key] !== '' ? q.erro : `Você pode devolver até ${fmtQtd(g.quantidade, g.unidade)}`}
                        </Text>
                        <Text style={s.rotuloCondicao}>Como está o material?</Text>
                        <Segmento rotulo={`Condição de ${g.item_nome}`} opcoes={CONDICOES} valor={condicoes[g.key]} onChange={(v) => setCondicoes((c) => ({ ...c, [g.key]: v }))} testID={`condicao-${g.key}`} />
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </Cartao>
          )}

          {grupos.length > 0 ? (
            <Cartao titulo="Observação (opcional)">
              <TextInput testID="campo-observacao" accessibilityLabel="Observação" value={observacao} onChangeText={setObservacao} placeholder="Ex.: sobra do lançamento da OS 12" placeholderTextColor={cores.desabilitado}
                style={[s.campo, s.campoTexto]} multiline maxLength={500} />
            </Cartao>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <BarraAcao>
        <Botao titulo={selecionados.length > 1 ? `Pedir devolução de ${selecionados.length} itens` : 'Pedir devolução'} onPress={enviar} desabilitado={!pode} carregando={salvando} testID="botao-pedir-devolucao" />
      </BarraAcao>
    </View>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  corpo: { flex: 1 },
  conteudo: { padding: espaco.lg, gap: espaco.lg, paddingBottom: espaco.xxl },
  campo: { minHeight: Math.max(ALVO_MINIMO, 56), borderWidth: 2, borderColor: cores.borda, borderRadius: raio.md, paddingHorizontal: espaco.md, fontSize: fonte.corpo + 1, color: cores.texto, backgroundColor: cores.superficie },
  campoTexto: { minHeight: 88, paddingTop: espaco.md, textAlignVertical: 'top' },
  campoQtd: { flex: 1, fontSize: fonte.destaque + 2 },
  campoErro: { borderColor: cores.erro },
  nota: { fontSize: fonte.pequena + 1, color: cores.textoSuave, lineHeight: 20 },
  grupo: { gap: espaco.sm },
  linhaGrupo: { flexDirection: 'row', alignItems: 'center', gap: espaco.md, minHeight: 64, paddingHorizontal: espaco.md, paddingVertical: espaco.sm, borderRadius: raio.md, borderWidth: 2, borderColor: cores.borda, backgroundColor: cores.superficie },
  linhaMarcada: { borderColor: cores.primariaBotao, backgroundColor: cores.primariaClara },
  nomeGrupo: { fontSize: fonte.corpo + 1, fontWeight: '700', color: cores.texto },
  detGrupo: { fontSize: fonte.pequena + 1, color: cores.textoSuave },
  separado: { fontSize: fonte.pequena, color: cores.aviso, fontWeight: '700' },
  detalhe: { gap: espaco.sm, paddingLeft: espaco.sm },
  qtdLinha: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
  unidade: { fontSize: fonte.destaque, fontWeight: '700', color: cores.textoSuave, minWidth: 32 },
  limite: { fontSize: fonte.corpo, fontWeight: '700', color: cores.primariaEscura },
  limiteErro: { color: cores.erro },
  rotuloCondicao: { fontSize: fonte.pequena + 1, fontWeight: '700', color: cores.textoSuave },
});
