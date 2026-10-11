import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { CartaoOS } from '@/components/CartaoOS';
import { Cabecalho } from '@/components/Cabecalho';
import { EstadoVazio } from '@/components/EstadoVazio';
import { BarraSincronia } from '@/components/BarraSincronia';
import { Faixa } from '@/components/Faixa';
import { isPendente, ordenarPorPrazo } from '@/domain/os';
import { rotuloAtualizacao } from '@/domain/tempo';
import { useDados } from '@/estado/DadosProvider';
import { ALVO_MINIMO, cores, espaco, fonte, raio } from '@/theme';

type Filtro = 'pendentes' | 'encerradas';

export default function MinhasOS() {
  const router = useRouter();
  const { dados, carregado, sincronizando, semConexao, erro, atualizar, contagens, pausadoPorSessao, sincronizadoEm } = useDados();
  const [filtro, setFiltro] = useState<Filtro>('pendentes');

  const { pendentes, encerradas } = useMemo(() => {
    const os = dados?.os ?? [];
    return {
      pendentes: ordenarPorPrazo(os.filter((o) => isPendente(o.status))),
      encerradas: os.filter((o) => !isPendente(o.status)).sort((a, b) => (b.concluida_em ?? b.atualizado_em).localeCompare(a.concluida_em ?? a.atualizado_em)),
    };
  }, [dados]);
  const lista = filtro === 'pendentes' ? pendentes : encerradas;
  const agora = useMemo(() => Date.now(), [dados, filtro]);

  const subtitulo = dados ? `${dados.tecnico.nome} · ${rotuloAtualizacao(dados.geradoEm)}` : sincronizando ? 'Atualizando…' : 'Sem dados ainda';

  return (
    <View style={s.tela}>
      <Cabecalho titulo="Minhas OS" subtitulo={subtitulo} />
      <View style={s.abas} accessibilityRole="tablist">
        <Aba rotulo={`Pendentes (${pendentes.length})`} ativa={filtro === 'pendentes'} onPress={() => setFiltro('pendentes')} />
        <Aba rotulo={`Encerradas (${encerradas.length})`} ativa={filtro === 'encerradas'} onPress={() => setFiltro('encerradas')} />
      </View>
      <View style={s.avisos}>
        {dados || contagens.pendentes + contagens.enviando + contagens.atencao > 0 ? (
          <BarraSincronia contagens={contagens} sincronizando={sincronizando} semConexao={semConexao} pausadoPorSessao={pausadoPorSessao} sincronizadoEm={dados?.geradoEm ?? sincronizadoEm} atualizar={() => void atualizar()} />
        ) : null}
        {erro ? <Faixa texto={erro} tom="erro" acao={{ rotulo: 'Tentar', onPress: () => void atualizar() }} /> : null}
      </View>
      <FlatList
        data={lista}
        keyExtractor={(o) => String(o.id)}
        contentContainerStyle={s.lista}
        ItemSeparatorComponent={() => <View style={{ height: espaco.md }} />}
        refreshControl={<RefreshControl refreshing={sincronizando} onRefresh={() => void atualizar()} tintColor={cores.primaria} colors={[cores.primaria]} />}
        renderItem={({ item }) => <CartaoOS os={item} agora={agora} onPress={() => router.push({ pathname: '/os/[id]', params: { id: String(item.id) } })} />}
        ListEmptyComponent={
          !carregado ? null
            : !dados ? (
              <EstadoVazio icone={semConexao ? 'cloud-offline-outline' : 'alert-circle-outline'} titulo={semConexao ? 'Sem conexão' : 'Ainda não há dados no aparelho'}
                texto={semConexao ? 'Conecte-se à internet uma vez para baixar suas OS. Depois elas ficam disponíveis mesmo sem sinal.' : 'Toque para baixar suas OS agora.'}
                acao={{ rotulo: 'Tentar de novo', onPress: () => void atualizar() }} />
            ) : (
              <EstadoVazio icone="checkmark-circle-outline" titulo={filtro === 'pendentes' ? 'Nenhuma OS pendente' : 'Nenhuma OS encerrada recente'}
                texto={filtro === 'pendentes' ? 'Quando o escritório atribuir uma OS a você, ela aparece aqui. Puxe a lista para baixo para atualizar.' : 'Aqui aparecem as OS encerradas nos últimos 30 dias.'} />
            )
        }
      />
    </View>
  );
}

function Aba({ rotulo, ativa, onPress }: { rotulo: string; ativa: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: ativa }} accessibilityLabel={rotulo} style={[s.aba, ativa && s.abaAtiva]}>
      <Text style={[s.abaTexto, ativa && s.abaTextoAtivo]}>{rotulo}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  abas: { flexDirection: 'row', gap: espaco.sm, padding: espaco.lg, paddingBottom: espaco.sm },
  aba: { flex: 1, minHeight: ALVO_MINIMO, alignItems: 'center', justifyContent: 'center', borderRadius: raio.pilula, borderWidth: 2, borderColor: cores.borda, backgroundColor: cores.superficie },
  abaAtiva: { backgroundColor: cores.primariaEscura, borderColor: cores.primariaEscura },
  abaTexto: { fontSize: fonte.corpo, fontWeight: '700', color: cores.textoSuave },
  abaTextoAtivo: { color: '#fff' },
  avisos: { paddingHorizontal: espaco.lg, gap: espaco.sm },
  lista: { padding: espaco.lg, flexGrow: 1 },
});
