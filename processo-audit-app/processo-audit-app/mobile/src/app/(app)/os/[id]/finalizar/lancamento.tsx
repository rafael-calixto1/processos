import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError, mensagemDeErro } from '@/api/erros';
import { Botao } from '@/components/Botao';
import { Cartao } from '@/components/Cartao';
import { Faixa } from '@/components/Faixa';
import { LeitorQR } from '@/components/LeitorQR';
import { TelaEtapa } from '@/components/TelaEtapa';
import { filtrarGrupos, normalizar } from '@/domain/busca';
import { acharGrupoPorCodigo, agrupar, devolverReserva, extrairCodigoLote, validarQuantidadeGrupo, type GrupoPosse } from '@/domain/posse';
import { fmtNum, fmtQtd } from '@/domain/quantidade';
import { useApp } from '@/estado/AppProvider';
import { useDados } from '@/estado/DadosProvider';
import { useFinalizacao } from '@/estado/FinalizacaoProvider';
import { useOnline } from '@/estado/rede';
import { ALVO_MINIMO, cores, espaco, fonte, raio } from '@/theme';

const LIMITE_SUGESTOES = 5;

/** Novo lançamento (ou correção de um que o servidor recusou): serviço, trecho e material da posse, com o limite sempre à vista. */
export default function Lancamento() {
  const { id, corrigir } = useLocalSearchParams<{ id: string; corrigir?: string }>();
  const router = useRouter();
  const f = useFinalizacao();
  const { comandos, ops } = useDados();
  const { api } = useApp();
  const online = useOnline();

  const antigo = corrigir ? ops.find((o) => o.id === Number(corrigir) && o.tipo === 'lancamento') : undefined;
  // ao corrigir, o que o lançamento antigo reservava volta a estar disponível para o novo valor
  const posse = useMemo(() => (antigo && antigo.tipo === 'lancamento' ? devolverReserva(f.dados?.posse ?? [], antigo.payload.corpo.materiais) : f.dados?.posse ?? []), [antigo, f.dados]);
  const grupos = useMemo(() => agrupar(posse), [posse]);

  const [descricao, setDescricao] = useState(antigo && antigo.tipo === 'lancamento' ? antigo.payload.corpo.descricao : '');
  const [trecho, setTrecho] = useState(antigo && antigo.tipo === 'lancamento' ? antigo.payload.corpo.trecho : '');
  const [qtds, setQtds] = useState<Record<string, string>>(() => {
    if (!antigo || antigo.tipo !== 'lancamento') return {};
    const inicial: Record<string, number> = {};
    for (const m of antigo.payload.corpo.materiais) {
      const g = agrupar(devolverReserva(f.dados?.posse ?? [], antigo.payload.corpo.materiais)).find((x) => x.lotes.some((l) => l.lote_id === m.lote_id));
      if (g) inicial[g.key] = (inicial[g.key] ?? 0) + m.quantidade;
    }
    return Object.fromEntries(Object.entries(inicial).map(([k, v]) => [k, fmtNum(v).replace(/\./g, '')]));
  });
  const [busca, setBusca] = useState('');
  const [lendo, setLendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const visiveis = filtrarGrupos(grupos, busca);
  const selecionados = grupos.filter((g) => qtds[g.key] !== undefined);
  const validos = selecionados.length > 0 && selecionados.every((g) => validarQuantidadeGrupo(g, qtds[g.key]).ok);
  const pode = descricao.trim().length >= 2 && trecho.trim().length > 0 && validos && f.editavel;
  const sugestoes = (f.dados?.sugestoesServicos ?? []).filter((x) => (descricao.trim() ? normalizar(x).includes(normalizar(descricao)) && normalizar(x) !== normalizar(descricao) : true)).slice(0, LIMITE_SUGESTOES);

  const alternar = (g: GrupoPosse) => setQtds((q) => { const n = { ...q }; if (n[g.key] !== undefined) delete n[g.key]; else n[g.key] = ''; return n; });

  const aoLerQR = async (texto: string) => {
    setLendo(false); setErro(null); setAviso(null);
    const g = acharGrupoPorCodigo(grupos, texto);
    const codigo = extrairCodigoLote(texto);
    if (g) {
      setQtds((q) => (q[g.key] === undefined ? { ...q, [g.key]: '' } : q));
      setAviso(`Lote ${codigo} encontrado: ${g.item_nome}. Informe a quantidade usada.`);
      return;
    }
    if (!online) { setErro(`O lote ${codigo} não está na sua posse (conforme os dados deste aparelho). Se acabou de retirá-lo, sincronize quando tiver internet.`); return; }
    try {
      await api.lotePorCodigo(codigo);
      setErro(`O lote ${codigo} está com você, mas ainda não aparece no seu estoque deste aparelho. Toque em “Sincronizar agora” e tente de novo.`);
    } catch (e) {
      setErro(e instanceof ApiError && e.status === 403 ? `O lote ${codigo} não está em sua posse. Fale com o estoque.` : e instanceof ApiError && e.status === 404 ? `Lote ${codigo} não encontrado. Confira a etiqueta.` : mensagemDeErro(e));
    }
  };

  const salvar = async () => {
    setErro(null); setSalvando(true);
    const entrada = { descricao, trecho, itens: selecionados.map((g) => ({ chaveGrupo: g.key, quantidade: qtds[g.key] })) };
    try {
      if (antigo) await comandos.substituirLancamento(antigo.id, entrada); else await comandos.registrarLancamento({ osId: Number(id), ...entrada });
      if (router.canGoBack()) router.back(); else router.replace({ pathname: '/os/[id]/finalizar/materiais', params: { id: String(id) } });
    } catch (e) { setErro(mensagemDeErro(e)); } finally { setSalvando(false); }
  };

  if (lendo) return <LeitorQR aoLer={(t) => void aoLerQR(t)} aoFechar={() => setLendo(false)} />;

  return (
    <TelaEtapa titulo={antigo ? 'Corrigir lançamento' : 'Novo lançamento'} acao={<Botao titulo="Salvar lançamento" onPress={salvar} desabilitado={!pode} carregando={salvando} testID="botao-salvar-lancamento" />}>
      {antigo?.erro ? <Faixa tom="erro" texto={`O servidor não aceitou: ${antigo.erro.mensagem}`} /> : null}
      {erro ? <Faixa tom="erro" texto={erro} /> : null}
      {aviso ? <Faixa tom="sucesso" icone="checkmark-circle-outline" texto={aviso} /> : null}

      <Cartao titulo="Serviço realizado">
        <TextInput testID="campo-servico" accessibilityLabel="Serviço realizado" value={descricao} onChangeText={setDescricao} placeholder="Ex.: Lançamento de cabo ASU 12F" placeholderTextColor={cores.desabilitado} style={s.campo} maxLength={255} />
        <View style={s.chips}>
          {sugestoes.map((x) => (
            <Pressable key={x} onPress={() => setDescricao(x)} accessibilityRole="button" accessibilityLabel={`Usar ${x}`} style={s.chip} testID="sugestao-servico"><Text style={s.chipTexto}>{x}</Text></Pressable>
          ))}
        </View>
      </Cartao>

      <Cartao titulo="Trecho">
        <TextInput testID="campo-trecho" accessibilityLabel="Trecho" value={trecho} onChangeText={setTrecho} placeholder="Ex.: PL-0932 → PL-0945" placeholderTextColor={cores.desabilitado} style={s.campo} maxLength={255} />
      </Cartao>

      <Cartao titulo="Materiais usados neste trecho">
        <Text style={s.nota}>Do seu estoque. O material é baixado e não volta ao estoque.</Text>
        <Botao titulo="Ler QR do lote" variante="secundario" onPress={() => { setAviso(null); setLendo(true); }} testID="botao-ler-qr" />
        <TextInput testID="busca-posse" accessibilityLabel="Buscar item ou lote" value={busca} onChangeText={setBusca} placeholder="Buscar item ou lote" placeholderTextColor={cores.desabilitado} style={s.campo} autoCorrect={false} />
        {grupos.length === 0 ? <Text style={s.nota}>Você não tem material em posse.</Text> : null}
        {visiveis.length === 0 && grupos.length > 0 ? <Text style={s.nota}>Nada encontrado para “{busca}”.</Text> : null}
        {visiveis.map((g) => {
          const marcado = qtds[g.key] !== undefined;
          const q = marcado ? validarQuantidadeGrupo(g, qtds[g.key]) : null;
          const tudoReservado = g.quantidade <= 0;
          return (
            <View key={g.key} style={s.grupo}>
              <Pressable testID={`grupo-${g.key}`} onPress={() => alternar(g)} disabled={tudoReservado && !marcado} accessibilityRole="checkbox" accessibilityState={{ checked: marcado, disabled: tudoReservado && !marcado }}
                accessibilityLabel={`${g.item_nome}, ${g.lote_codigo ?? `${g.lotes.length} lotes`}, em posse ${fmtQtd(g.quantidade, g.unidade)}`} style={[s.linhaGrupo, marcado && s.linhaMarcada, tudoReservado && !marcado && { opacity: 0.5 }]}>
                <Ionicons name={marcado ? 'checkbox' : 'square-outline'} size={28} color={marcado ? cores.primariaBotao : cores.textoSuave} />
                <View style={{ flex: 1 }}>
                  <Text style={s.nomeGrupo}>{g.item_nome}</Text>
                  <Text style={s.detGrupo}>{g.lote_codigo ?? (g.lotes.length === 1 ? g.lotes[0].lote_codigo : `${g.lotes.length} lotes`)} · em posse: {fmtQtd(g.quantidade, g.unidade)}</Text>
                  {g.reservado > 0 ? <Text style={s.reservado}>{tudoReservado ? 'Tudo reservado em lançamentos não enviados' : `Reservado em outros lançamentos: ${fmtQtd(g.reservado, g.unidade)}`}</Text> : null}
                </View>
              </Pressable>
              {marcado ? (
                <View style={s.qtd}>
                  <View style={s.qtdLinha}>
                    <TextInput testID={`qtd-${g.key}`} accessibilityLabel={`Quantidade de ${g.item_nome}`} keyboardType={g.unidade === 'pecas' ? 'number-pad' : 'decimal-pad'} value={qtds[g.key]} onChangeText={(t) => setQtds((x) => ({ ...x, [g.key]: t }))}
                      placeholder="Quantidade" placeholderTextColor={cores.desabilitado} style={[s.campo, s.campoQtd, q && !q.ok && qtds[g.key] !== '' ? s.campoErro : null]} />
                    <Text style={s.unidade}>{g.unidade === 'metros' ? 'm' : 'un'}</Text>
                  </View>
                  <Text style={[s.limite, q && !q.ok && qtds[g.key] !== '' ? s.limiteErro : null]} accessibilityRole="alert" testID={`limite-${g.key}`}>
                    {q && !q.ok && qtds[g.key] !== '' ? q.erro : `Você tem ${fmtQtd(g.quantidade, g.unidade)} em posse`}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </Cartao>
    </TelaEtapa>
  );
}

const s = StyleSheet.create({
  campo: { minHeight: Math.max(ALVO_MINIMO, 56), borderWidth: 2, borderColor: cores.borda, borderRadius: raio.md, paddingHorizontal: espaco.md, fontSize: fonte.corpo + 1, color: cores.texto, backgroundColor: cores.superficie },
  campoQtd: { flex: 1, fontSize: fonte.destaque + 2 },
  campoErro: { borderColor: cores.erro },
  nota: { fontSize: fonte.pequena + 1, color: cores.textoSuave, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  chip: { minHeight: ALVO_MINIMO, justifyContent: 'center', paddingHorizontal: espaco.md, borderRadius: raio.pilula, backgroundColor: cores.primariaClara, borderWidth: 1, borderColor: cores.primaria },
  chipTexto: { fontSize: fonte.pequena + 1, fontWeight: '700', color: cores.primariaEscura },
  grupo: { gap: espaco.sm },
  linhaGrupo: { flexDirection: 'row', alignItems: 'center', gap: espaco.md, minHeight: 64, paddingHorizontal: espaco.md, paddingVertical: espaco.sm, borderRadius: raio.md, borderWidth: 2, borderColor: cores.borda, backgroundColor: cores.superficie },
  linhaMarcada: { borderColor: cores.primariaBotao, backgroundColor: cores.primariaClara },
  nomeGrupo: { fontSize: fonte.corpo + 1, fontWeight: '700', color: cores.texto },
  detGrupo: { fontSize: fonte.pequena + 1, color: cores.textoSuave },
  reservado: { fontSize: fonte.pequena, color: cores.aviso, fontWeight: '700' },
  qtd: { gap: espaco.xs, paddingLeft: espaco.sm },
  qtdLinha: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
  unidade: { fontSize: fonte.destaque, fontWeight: '700', color: cores.textoSuave, minWidth: 32 },
  limite: { fontSize: fonte.corpo, fontWeight: '700', color: cores.primariaEscura },
  limiteErro: { color: cores.erro },
});
