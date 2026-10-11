import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { mensagemDeErro } from '@/api/erros';
import { BarraAcao } from '@/components/BarraAcao';
import { Botao } from '@/components/Botao';
import { Cabecalho } from '@/components/Cabecalho';
import { Cartao } from '@/components/Cartao';
import { EstadoVazio } from '@/components/EstadoVazio';
import { Faixa } from '@/components/Faixa';
import { Selo } from '@/components/Selo';
import { confirmar } from '@/components/confirmar';
import { fmtQtd } from '@/domain/quantidade';
import { fmtDataHora } from '@/domain/tempo';
import { devolucoesDoTecnico, type DevolucaoVisao, type EstadoDevolucao } from '@/domain/visao';
import { useDados } from '@/estado/DadosProvider';
import type { Tom } from '@/theme';
import { espaco, fonte, type Paleta } from '@/theme';
import { useEstilos } from '@/estado/tema';

const SELO: Record<EstadoDevolucao, { texto: string; tom: Tom; icone: 'time-outline' | 'cloud-upload-outline' | 'alert-circle-outline' | 'hourglass-outline' | 'checkmark-circle-outline' | 'close-circle-outline' }> = {
  na_fila: { texto: 'Na fila para enviar', tom: 'neutro', icone: 'time-outline' },
  enviando: { texto: 'Enviando…', tom: 'info', icone: 'cloud-upload-outline' },
  atencao: { texto: 'Requer atenção', tom: 'erro', icone: 'alert-circle-outline' },
  aguardando: { texto: 'Aguardando o estoque', tom: 'aviso', icone: 'hourglass-outline' },
  aprovada: { texto: 'Aprovada', tom: 'sucesso', icone: 'checkmark-circle-outline' },
  negada: { texto: 'Negada', tom: 'erro', icone: 'close-circle-outline' },
};

/** Minhas devoluções: o que está no aparelho, o que o estoque ainda vai decidir e o que já foi aprovado ou negado (com o motivo). */
export default function Devolucoes() {
  const s = useEstilos(criarEstilos);
  const router = useRouter();
  const { dados, ops, carregado, comandos, atualizar, sincronizando, semConexao } = useDados();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const lista = useMemo(() => devolucoesDoTecnico(dados?.devolucoes ?? [], ops), [dados, ops]);
  const voltar = () => (router.canGoBack() ? router.back() : router.replace('/estoque'));

  const cancelar = async (d: DevolucaoVisao) => {
    if (d.operacaoId === undefined) return;
    setErro(null);
    try {
      if (!(await confirmar('Cancelar este pedido?', 'Ele ainda não foi enviado ao estoque. O material volta a ficar disponível para você.', 'Cancelar pedido'))) return;
      setOcupado(d.operacaoId);
      await comandos.descartar(d.operacaoId);
    } catch (e) { setErro(mensagemDeErro(e)); } finally { setOcupado(null); }
  };

  return (
    <View style={s.tela}>
      <Cabecalho titulo="Minhas devoluções" subtitulo={lista.length ? `${lista.length} pedido(s)` : undefined} aoVoltar={voltar} />
      <FlatList
        data={lista}
        keyExtractor={(d) => d.chave}
        contentContainerStyle={s.lista}
        ItemSeparatorComponent={() => <View style={{ height: espaco.md }} />}
        ListHeaderComponent={
          <View style={{ gap: espaco.sm, marginBottom: lista.length ? espaco.md : 0 }}>
            {erro ? <Faixa tom="erro" texto={erro} /> : null}
            {semConexao ? <Faixa texto="Sem conexão: a decisão do estoque aparece quando houver internet." icone="cloud-offline-outline" acao={{ rotulo: 'Tentar', onPress: () => void atualizar() }} /> : null}
          </View>
        }
        renderItem={({ item: d }) => {
          const selo = SELO[d.estado];
          return (
            <Cartao>
              <View style={s.topo}>
                <View style={{ flex: 1 }}>
                  <Text style={s.nome}>{d.item_nome}</Text>
                  <Text style={s.lote}>{d.lote_codigo} · {d.condicao === 'novo' ? 'novo' : 'usado'}</Text>
                </View>
                <Text style={s.qtd}>{fmtQtd(d.quantidade, d.unidade)}</Text>
              </View>
              <Selo texto={selo.texto} tom={selo.tom} icone={selo.icone} />
              <Text style={s.quando}>Pedido em {fmtDataHora(d.quando)}</Text>
              {d.observacao ? <Text style={s.obs}>Sua observação: {d.observacao}</Text> : null}
              {d.estado === 'negada' ? (
                <View style={s.negada} accessibilityRole="alert">
                  <Text style={s.negadaTitulo}>Motivo da negação</Text>
                  <Text style={s.negadaTexto}>{d.motivoNegacao || 'O estoque não informou o motivo. Fale com o estoque.'}</Text>
                  <Text style={s.negadaNota}>O material continua com você.</Text>
                </View>
              ) : null}
              {d.estado === 'aguardando' ? <Text style={s.nota}>O material está separado até o estoque decidir.</Text> : null}
              {d.estado === 'atencao' ? (
                <View style={s.negada} accessibilityRole="alert">
                  <Text style={s.negadaTexto}>{d.erro?.mensagem}</Text>
                  <Botao titulo="Resolver" onPress={() => router.push('/atencao')} testID={`resolver-${d.chave}`} />
                </View>
              ) : null}
              {d.estado === 'na_fila' ? <Botao titulo="Cancelar pedido" variante="perigo" carregando={ocupado === d.operacaoId} onPress={() => void cancelar(d)} testID={`cancelar-${d.chave}`} /> : null}
            </Cartao>
          );
        }}
        ListEmptyComponent={
          !carregado ? null
            : <EstadoVazio icone="swap-horizontal-outline" titulo="Nenhum pedido de devolução" texto="Quando você devolver material ao estoque, o pedido e a decisão aparecem aqui."
              acao={{ rotulo: sincronizando ? 'Atualizando…' : 'Atualizar', onPress: () => void atualizar() }} />
        }
      />
      <BarraAcao><Botao titulo="Devolver material" onPress={() => router.push('/devolver')} testID="botao-nova-devolucao" /></BarraAcao>
    </View>
  );
}

const criarEstilos = (cores: Paleta) => StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  lista: { padding: espaco.lg, flexGrow: 1 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: espaco.md },
  nome: { fontSize: fonte.corpo + 1, fontWeight: '700', color: cores.texto },
  lote: { fontSize: fonte.pequena + 1, color: cores.textoSuave },
  qtd: { fontSize: fonte.destaque + 2, fontWeight: '800', color: cores.primariaEscura },
  quando: { fontSize: fonte.pequena, color: cores.textoSuave },
  obs: { fontSize: fonte.pequena + 1, color: cores.texto },
  nota: { fontSize: fonte.pequena + 1, color: cores.textoSuave },
  negada: { backgroundColor: cores.erroClaro, borderRadius: 12, padding: espaco.md, gap: espaco.xs },
  negadaTitulo: { fontSize: fonte.pequena, fontWeight: '800', color: cores.erro, textTransform: 'uppercase', letterSpacing: 0.4 },
  negadaTexto: { fontSize: fonte.corpo, color: cores.erro, fontWeight: '600', lineHeight: 22 },
  negadaNota: { fontSize: fonte.pequena + 1, color: cores.erro },
});
