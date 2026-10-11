import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { BarraAcao } from '@/components/BarraAcao';
import { Botao } from '@/components/Botao';
import { Cabecalho } from '@/components/Cabecalho';
import { EstadoVazio } from '@/components/EstadoVazio';
import { Faixa } from '@/components/Faixa';
import { filtrarGrupos } from '@/domain/busca';
import { agrupar } from '@/domain/posse';
import { fmtQtd } from '@/domain/quantidade';
import { rotuloAtualizacao } from '@/domain/tempo';
import { devolucoesDoTecnico } from '@/domain/visao';
import { useDados } from '@/estado/DadosProvider';
import { ALVO_MINIMO, cores, espaco, fonte, raio } from '@/theme';

export default function MeuEstoque() {
  const router = useRouter();
  const { dados, ops, carregado, semConexao, atualizar } = useDados();
  const [busca, setBusca] = useState('');
  const grupos = useMemo(() => agrupar(dados?.posse ?? []), [dados]);
  const visiveis = useMemo(() => filtrarGrupos(grupos, busca), [grupos, busca]);
  const abertas = useMemo(() => devolucoesDoTecnico(dados?.devolucoes ?? [], ops).filter((d) => d.estado !== 'aprovada' && d.estado !== 'negada').length, [dados, ops]);

  return (
    <View style={s.tela}>
      <Cabecalho titulo="Meu estoque" subtitulo={dados ? rotuloAtualizacao(dados.geradoEm) : 'Sem dados ainda'} />
      <View style={s.topo}>
        <View style={s.busca}>
          <Ionicons name="search-outline" size={22} color={cores.textoSuave} />
          <TextInput value={busca} onChangeText={setBusca} placeholder="Buscar item ou lote" placeholderTextColor={cores.desabilitado} style={s.input}
            accessibilityLabel="Buscar item ou lote" autoCorrect={false} autoCapitalize="none" returnKeyType="search" clearButtonMode="while-editing" />
        </View>
        <Botao titulo={abertas > 0 ? `Minhas devoluções (${abertas} em andamento)` : 'Minhas devoluções'} variante="secundario" onPress={() => router.push('/devolucoes')} testID="botao-minhas-devolucoes" />
        {dados ? <Faixa tom="info" icone="time-outline" texto="Saldo do último download, já descontado do que você lançou ou separou para devolução e ainda não foi confirmado. O servidor confere de novo ao receber." /> : null}
        {semConexao && dados ? <Faixa texto="Sem conexão: mostrando o saldo guardado no aparelho." icone="cloud-offline-outline" acao={{ rotulo: 'Tentar', onPress: () => void atualizar() }} /> : null}
      </View>
      <FlatList
        data={visiveis}
        keyExtractor={(g) => g.key}
        contentContainerStyle={s.lista}
        ItemSeparatorComponent={() => <View style={{ height: espaco.sm }} />}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: g }) => (
          <View style={s.linha} accessible accessibilityLabel={`${g.item_nome}, ${g.lote_codigo ?? `${g.lotes.length} lotes`}, ${fmtQtd(g.quantidade, g.unidade)} em posse${g.reservado > 0 ? `, mais ${fmtQtd(g.reservado, g.unidade)} reservados em lançamentos não enviados` : ''}${g.emDevolucao > 0 ? `, mais ${fmtQtd(g.emDevolucao, g.unidade)} separados para devolução` : ''}`}>
            <View style={s.info}>
              <Text style={s.nome}>{g.item_nome}</Text>
              <Text style={s.lote}>{g.lote_codigo ?? (g.lotes.length === 1 ? g.lotes[0].lote_codigo : `${g.lotes.length} lotes`)}</Text>
              {g.reservado > 0 ? <Text style={s.reservado}>Reservado em lançamentos não enviados: {fmtQtd(g.reservado, g.unidade)}</Text> : null}
              {g.emDevolucao > 0 ? <Text style={s.reservado}>Separado para devolução: {fmtQtd(g.emDevolucao, g.unidade)}</Text> : null}
            </View>
            <Text style={s.qtd}>{fmtQtd(g.quantidade, g.unidade)}</Text>
          </View>
        )}
        ListEmptyComponent={
          !carregado ? null
            : !dados ? <EstadoVazio icone="cloud-offline-outline" titulo="Ainda não há dados no aparelho" texto="Conecte-se à internet uma vez para baixar seu estoque." acao={{ rotulo: 'Tentar de novo', onPress: () => void atualizar() }} />
              : busca.trim() ? <EstadoVazio icone="search-outline" titulo="Nada encontrado" texto="Confira o nome do item ou o código do lote." />
                : <EstadoVazio icone="cube-outline" titulo="Você não tem material em posse" texto="O material retirado no almoxarifado aparece aqui." />
        }
      />
      <BarraAcao><Botao titulo="Devolver material" onPress={() => router.push('/devolver')} desabilitado={!dados || grupos.length === 0} testID="botao-devolver" /></BarraAcao>
    </View>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  topo: { padding: espaco.lg, gap: espaco.sm },
  busca: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm, minHeight: 56, borderWidth: 2, borderColor: cores.borda, borderRadius: raio.md, backgroundColor: cores.superficie, paddingHorizontal: espaco.md },
  input: { flex: 1, minHeight: ALVO_MINIMO, fontSize: fonte.corpo + 1, color: cores.texto },
  lista: { padding: espaco.lg, paddingTop: 0, flexGrow: 1 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.md, backgroundColor: cores.superficie, borderRadius: raio.md, borderWidth: 1, borderColor: cores.borda, padding: espaco.lg },
  info: { flex: 1, gap: 2 },
  nome: { fontSize: fonte.corpo + 1, fontWeight: '700', color: cores.texto },
  lote: { fontSize: fonte.pequena + 1, color: cores.textoSuave },
  reservado: { fontSize: fonte.pequena, color: cores.aviso, fontWeight: '700' },
  qtd: { fontSize: fonte.destaque + 2, fontWeight: '800', color: cores.primariaEscura },
});
