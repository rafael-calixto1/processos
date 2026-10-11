import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Botao } from '@/components/Botao';
import { Cabecalho } from '@/components/Cabecalho';
import { Cartao } from '@/components/Cartao';
import { Carregando } from '@/components/Carregando';
import { EstadoVazio } from '@/components/EstadoVazio';
import { Faixa } from '@/components/Faixa';
import { Selo } from '@/components/Selo';
import { agruparFicha, filtrarGruposFicha, FILTROS_FICHA, posseDetalhada, resumoGrupo, ROTULO_TIPO, type FiltroFicha, type GrupoFicha, type PosseDetalhada } from '@/domain/ficha';
import { fmtQtd } from '@/domain/quantidade';
import { fmtDataHora, rotuloAtualizacao } from '@/domain/tempo';
import { useFicha } from '@/estado/useFicha';
import { ALVO_MINIMO, espaco, fonte, raio, type Tom, type Paleta } from '@/theme';
import { useCores, useEstilos } from '@/estado/tema';

const PAGINA = 12;
const TOM: Record<string, Tom> = { retirada: 'info', baixa_os: 'aviso', devolucao: 'sucesso' };

/** Ficha de movimentações: o que o técnico recebeu, gastou em OS e devolveu (estornos não aparecem), como na tela do escritório. */
export default function Ficha() {
  const s = useEstilos(criarEstilos);
  const router = useRouter();
  const { ficha, baixadaEm, carregando, atualizando, semConexao, erro, atualizar } = useFicha();
  const [filtro, setFiltro] = useState<FiltroFicha>('todos');
  const [limite, setLimite] = useState(PAGINA);
  const [aberto, setAberto] = useState<string | null>(null);
  const [aberta, setAberta] = useState<number | null>(null);

  const { validas, grupos } = useMemo(() => (ficha ? agruparFicha(ficha.historico) : { validas: [], grupos: [] }), [ficha]);
  const posse = useMemo(() => (ficha ? posseDetalhada(ficha.itens, validas) : []), [ficha, validas]);
  const visiveis = useMemo(() => filtrarGruposFicha(grupos, filtro), [grupos, filtro]);
  const voltar = () => (router.canGoBack() ? router.back() : router.replace('/estoque'));

  if (carregando) return <View style={s.tela}><Cabecalho titulo="Ficha de movimentações" aoVoltar={voltar} /><Carregando texto="Carregando a ficha…" /></View>;

  return (
    <View style={s.tela}>
      <Cabecalho titulo="Ficha de movimentações" subtitulo={ficha ? rotuloAtualizacao(baixadaEm) : undefined} aoVoltar={voltar} />
      {!ficha ? (
        <EstadoVazio icone={semConexao ? 'cloud-offline-outline' : 'alert-circle-outline'} titulo={semConexao ? 'Sem conexão e nada guardado ainda' : 'Não foi possível carregar a ficha'}
          texto={semConexao ? 'Abra a ficha uma vez com internet. Depois ela fica guardada no aparelho para consultar sem sinal.' : erro ?? undefined} acao={{ rotulo: atualizando ? 'Carregando…' : 'Tentar de novo', onPress: () => void atualizar() }} />
      ) : (
        <FlatList
          data={visiveis.slice(0, limite)}
          keyExtractor={(g) => g.key}
          contentContainerStyle={s.lista}
          ItemSeparatorComponent={() => <View style={{ height: espaco.sm }} />}
          ListHeaderComponent={
            <View style={{ gap: espaco.md }}>
              {semConexao ? <Faixa texto="Sem conexão: mostrando a ficha guardada no aparelho." icone="cloud-offline-outline" acao={{ rotulo: 'Tentar', onPress: () => void atualizar() }} /> : null}
              {erro ? <Faixa tom="erro" texto={erro} acao={{ rotulo: 'Tentar', onPress: () => void atualizar() }} /> : null}
              <Cartao titulo="Em posse agora">
                {posse.length === 0 ? <Text style={s.nota}>Você não tem material em posse.</Text> : posse.map((p) => <LinhaPosse key={p.lote_id} p={p} aberto={aberta === p.lote_id} alternar={() => setAberta((a) => (a === p.lote_id ? null : p.lote_id))} />)}
              </Cartao>
              <Text style={s.titulo} accessibilityRole="header">Histórico</Text>
              <View style={s.chips} accessibilityRole="radiogroup" accessibilityLabel="Filtrar histórico">
                {FILTROS_FICHA.map((f) => (
                  <Pressable key={f.valor} testID={`filtro-${f.valor}`} onPress={() => { setFiltro(f.valor); setLimite(PAGINA); setAberto(null); }} accessibilityRole="radio" accessibilityState={{ checked: filtro === f.valor }} accessibilityLabel={f.rotulo}
                    style={[s.chip, filtro === f.valor && s.chipAtivo]}><Text style={[s.chipTexto, filtro === f.valor && s.chipTextoAtivo]}>{f.rotulo}</Text></Pressable>
                ))}
              </View>
            </View>
          }
          renderItem={({ item: g }) => <LinhaGrupo g={g} aberto={aberto === g.key} alternar={() => setAberto((a) => (a === g.key ? null : g.key))} />}
          ListFooterComponent={visiveis.length > limite ? <Botao titulo={`Ver mais (${visiveis.length - limite})`} variante="secundario" onPress={() => setLimite((l) => l + PAGINA)} estilo={{ marginTop: espaco.md }} testID="ver-mais" /> : null}
          ListEmptyComponent={<EstadoVazio icone="document-text-outline" titulo="Sem movimentações" texto={filtro === 'todos' ? 'Quando você retirar, usar ou devolver material, o registro aparece aqui.' : 'Nada deste tipo ainda. Toque em "Todos" para ver tudo.'} />}
        />
      )}
    </View>
  );
}

function LinhaPosse({ p, aberto, alternar }: { p: PosseDetalhada; aberto: boolean; alternar: () => void }) {
  const cores = useCores();
  const s = useEstilos(criarEstilos);
  return (
    <View style={s.posse}>
      <Pressable onPress={alternar} testID={`posse-${p.lote_id}`} accessibilityRole="button" accessibilityState={{ expanded: aberto }}
        accessibilityLabel={`${p.item_nome}, lote ${p.lote_codigo}, recebido ${fmtQtd(p.recebido, p.unidade)}, usado em OS ${fmtQtd(p.usado, p.unidade)}, em posse ${fmtQtd(p.quantidade, p.unidade)}`} style={s.posseTopo}>
        <Ionicons name={aberto ? 'chevron-down' : 'chevron-forward'} size={22} color={cores.textoSuave} />
        <View style={{ flex: 1 }}>
          <Text style={s.nome}>{p.item_nome}</Text>
          <Text style={s.det}>{p.lote_codigo} · recebido {fmtQtd(p.recebido, p.unidade)} · usado {fmtQtd(p.usado, p.unidade)}</Text>
        </View>
        <Text style={s.qtd}>{fmtQtd(p.quantidade, p.unidade)}</Text>
      </Pressable>
      {aberto ? (
        <View style={s.detalhe}>
          <Text style={s.detTexto}><Text style={s.negrito}>Entregue em: </Text>{p.entregas.length ? p.entregas.map((e) => `${fmtDataHora(e.quando)} (${fmtQtd(e.quantidade, p.unidade)})`).join(' · ') : '—'}</Text>
          <Text style={s.detTexto}><Text style={s.negrito}>Gasto nas OS: </Text>{p.porOS.length ? p.porOS.map((o) => `#${o.os_numero ?? o.os_id} (${fmtQtd(o.quantidade, p.unidade)})`).join(' · ') : 'Nada usado ainda'}</Text>
        </View>
      ) : null}
    </View>
  );
}

function LinhaGrupo({ g, aberto, alternar }: { g: GrupoFicha; aberto: boolean; alternar: () => void }) {
  const cores = useCores();
  const s = useEstilos(criarEstilos);
  return (
    <View style={s.grupo}>
      <Pressable onPress={alternar} testID={`grupo-${g.key}`} accessibilityRole="button" accessibilityState={{ expanded: aberto }}
        accessibilityLabel={`${ROTULO_TIPO[g.tipo]}, ${fmtDataHora(g.quando)}, ${resumoGrupo(g)}${g.os_numero ? `, OS ${g.os_numero}` : ''}`} style={s.grupoTopo}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={s.linha}><Selo texto={ROTULO_TIPO[g.tipo]} tom={TOM[g.tipo] ?? 'neutro'} />{g.os_numero ? <Text style={s.os}>OS #{g.os_numero}</Text> : null}</View>
          <Text style={s.det}>{fmtDataHora(g.quando)}</Text>
          <Text style={s.resumo}>{resumoGrupo(g)}</Text>
        </View>
        <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={22} color={cores.textoSuave} />
      </Pressable>
      {aberto ? (
        <View style={s.detalhe}>
          {g.os_cliente ? <Text style={s.detTexto}>{g.os_cliente}</Text> : null}
          {g.itens.map((m) => (
            <View key={m.id} style={s.item}>
              <View style={{ flex: 1 }}><Text style={s.nome}>{m.item_nome}</Text><Text style={s.det}>{m.lote_codigo}{m.condicao ? ` · ${m.condicao === 'novo' ? 'novo' : 'usado'}` : ''}</Text></View>
              <Text style={s.qtd}>{fmtQtd(m.quantidade, m.unidade)}</Text>
            </View>
          ))}
          {g.itens.some((i) => i.observacao) ? <Text style={s.detTexto}>Obs.: {[...new Set(g.itens.map((i) => i.observacao).filter(Boolean))].join(' · ')}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const criarEstilos = (cores: Paleta) => StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  lista: { padding: espaco.lg, flexGrow: 1 },
  titulo: { fontSize: fonte.titulo, fontWeight: '800', color: cores.primariaEscura },
  nota: { fontSize: fonte.corpo, color: cores.textoSuave },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm, marginBottom: espaco.sm },
  chip: { minHeight: ALVO_MINIMO, justifyContent: 'center', paddingHorizontal: espaco.lg, borderRadius: raio.pilula, borderWidth: 2, borderColor: cores.borda, backgroundColor: cores.superficie },
  chipAtivo: { backgroundColor: cores.destaqueFundo, borderColor: cores.destaqueFundo },
  chipTexto: { fontSize: fonte.corpo, fontWeight: '700', color: cores.textoSuave },
  chipTextoAtivo: { color: '#fff' },
  posse: { gap: espaco.sm, borderTopWidth: 1, borderTopColor: cores.borda, paddingTop: espaco.sm },
  posseTopo: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm, minHeight: 56 },
  nome: { fontSize: fonte.corpo + 1, fontWeight: '700', color: cores.texto },
  det: { fontSize: fonte.pequena + 1, color: cores.textoSuave },
  qtd: { fontSize: fonte.destaque + 2, fontWeight: '800', color: cores.primariaEscura },
  detalhe: { gap: espaco.sm, paddingLeft: espaco.xl, paddingBottom: espaco.sm },
  detTexto: { fontSize: fonte.pequena + 1, color: cores.texto, lineHeight: 20 },
  negrito: { fontWeight: '800' },
  grupo: { backgroundColor: cores.superficie, borderRadius: raio.md, borderWidth: 1, borderColor: cores.borda, overflow: 'hidden' },
  grupoTopo: { flexDirection: 'row', alignItems: 'center', gap: espaco.md, minHeight: 64, padding: espaco.md },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
  os: { fontSize: fonte.pequena + 1, fontWeight: '700', color: cores.textoSuave },
  resumo: { fontSize: fonte.corpo, color: cores.texto },
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco.md },
});
