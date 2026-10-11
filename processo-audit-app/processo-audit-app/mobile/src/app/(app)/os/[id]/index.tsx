import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { mensagemDeErro } from '@/api/erros';
import { BarraAcao } from '@/components/BarraAcao';
import { Botao } from '@/components/Botao';
import { Cabecalho } from '@/components/Cabecalho';
import { Cartao, Dado } from '@/components/Cartao';
import { EstadoVazio } from '@/components/EstadoVazio';
import { Faixa } from '@/components/Faixa';
import { IndicadorSync } from '@/components/IndicadorSync';
import { Selo } from '@/components/Selo';
import { enderecoLinha, isPendente, PRIORIDADE_LABEL, redeLinha, slaInfo, STATUS_LABEL, urlMapa } from '@/domain/os';
import { fmtData, fmtDataHora, fmtHora } from '@/domain/tempo';
import { useDados } from '@/estado/DadosProvider';
import { espaco, fonte, type Tom, type Paleta } from '@/theme';
import { useEstilos } from '@/estado/tema';

const TOM_SLA = { estourado: 'erro', em_risco: 'aviso', no_prazo: 'sucesso', sem_prazo: 'neutro' } as const satisfies Record<string, Tom>;

export default function DetalheOS() {
  const s = useEstilos(criarEstilos);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { dados, carregado, comandos } = useDados();
  const [iniciando, setIniciando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const os = dados?.os.find((o) => String(o.id) === id);

  const voltar = () => (router.canGoBack() ? router.back() : router.replace('/'));
  if (!os) {
    return (
      <View style={s.tela}>
        <Cabecalho titulo="OS" aoVoltar={voltar} />
        {carregado ? <EstadoVazio icone="alert-circle-outline" titulo="OS não encontrada" texto="Ela pode ter sido encerrada ou passada para outro técnico. Volte e atualize a lista." acao={{ rotulo: 'Voltar para minhas OS', onPress: voltar }} /> : null}
      </View>
    );
  }

  const pendente = isPendente(os.status);
  const sla = slaInfo(os.prazo);
  const mapa = urlMapa(os);
  const temBarra = os.status === 'aberta' || os.status === 'em_andamento'; // com barra de ação fixa, o erro aparece nela (junto do botão)

  const abrirMapa = async () => {
    try { if (mapa) await Linking.openURL(mapa); } catch { setErro('Não foi possível abrir o mapa neste aparelho.'); }
  };
  const iniciar = async () => {
    setErro(null);
    setIniciando(true);
    try { await comandos.iniciarOS(os.id); } catch (e) { setErro(mensagemDeErro(e)); } finally { setIniciando(false); }
  };

  return (
    <View style={s.tela}>
      <Cabecalho titulo={`OS #${os.numero}`} subtitulo={os.cliente} aoVoltar={voltar} />
      <ScrollView contentContainerStyle={s.conteudo}>
        {erro && !temBarra ? <Faixa texto={erro} tom="erro" /> : null}

        <View style={s.selos}>
          <Selo texto={STATUS_LABEL[os.status]} tom={os.status === 'em_andamento' ? 'marca' : os.status === 'concluida' ? 'sucesso' : os.status === 'aberta' ? 'info' : 'neutro'} />
          {os.prioridade === 'alta' ? <Selo texto="Prioridade alta" tom="erro" icone="flame-outline" /> : <Selo texto={`Prioridade ${PRIORIDADE_LABEL[os.prioridade].toLowerCase()}`} />}
          {pendente ? <Selo texto={sla.label} tom={TOM_SLA[sla.estado]} icone="time-outline" /> : null}
        </View>

        <Cartao titulo="Serviço">
          <Dado rotulo="Nome da OS" valor={os.cliente} />
          <Dado rotulo="Tipo de serviço" valor={os.tipo_servico} />
          <Dado rotulo="Descrição" valor={os.descricao} />
          <Dado rotulo="Prazo" valor={fmtData(os.prazo)} />
        </Cartao>

        <Cartao titulo="Local">
          <Dado rotulo="Endereço" valor={enderecoLinha(os)} />
          <Dado rotulo="Rede (POP · rota · poste)" valor={redeLinha(os)} />
          {os.latitude != null && os.longitude != null ? <Dado rotulo="Coordenadas" valor={`${os.latitude.toFixed(6)}, ${os.longitude.toFixed(6)}`} /> : null}
          {mapa ? <Botao titulo="Abrir no mapa" variante="secundario" onPress={abrirMapa} /> : null}
        </Cartao>

        <Cartao titulo="Andamento">
          <Dado rotulo="Aberta em" valor={`${fmtDataHora(os.criado_em)}${os.criado_por_nome ? ` por ${os.criado_por_nome}` : ''}`} />
          <Dado rotulo="Execução iniciada em" valor={os.iniciado_em ? fmtDataHora(os.iniciado_em) : 'Ainda não iniciada'} />
          <IndicadorSync estado={os.sync} pendencias={os.pendencias} />
          {os.concluida_em ? <Dado rotulo="Encerrada em" valor={fmtDataHora(os.concluida_em)} /> : null}
        </Cartao>

        {os.sync === 'erro' ? (
          <Faixa tom="erro" icone="alert-circle" texto="O servidor não aceitou algo desta OS. Veja o que precisa ser resolvido." acao={{ rotulo: 'Ver', onPress: () => router.push('/atencao') }} />
        ) : os.sync === 'pendente' ? (
          <Faixa tom="aviso" icone="cloud-upload-outline" texto={`${os.pendencias === 1 ? '1 envio desta OS aguarda' : `${os.pendencias} envios desta OS aguardam`} conexão. Está tudo salvo no aparelho.`} />
        ) : null}
        {os.status === 'em_andamento' ? <Faixa tom="info" icone="construct-outline" texto={`Execução iniciada às ${fmtHora(os.iniciado_em)}.`} /> : null}
        {!pendente ? <Faixa tom="neutro" icone="document-text-outline" texto={`Esta OS está ${STATUS_LABEL[os.status].toLowerCase()} e é somente leitura.`} /> : null}
        <Text style={s.rodape}>Dados de {fmtDataHora(dados?.geradoEm)}</Text>
      </ScrollView>

      {os.status === 'aberta' ? (
        <BarraAcao>
          {erro ? <Faixa texto={erro} tom="erro" /> : null}{/* junto do botão: um erro lá em cima da página passaria despercebido */}
          <Botao titulo="Iniciar execução" onPress={iniciar} carregando={iniciando} testID="botao-iniciar" />
        </BarraAcao>
      ) : null}
      {os.status === 'em_andamento' ? (
        <BarraAcao>
          {erro ? <Faixa texto={erro} tom="erro" /> : null}
          <Botao titulo={os.finalizacao === 'nenhuma' ? 'Continuar execução' : 'Ver finalização'} testID="botao-continuar"
            onPress={() => router.push({ pathname: '/os/[id]/finalizar', params: { id: String(os.id) } })} />
        </BarraAcao>
      ) : null}
    </View>
  );
}

const criarEstilos = (cores: Paleta) => StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.lg },
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  rodape: { fontSize: fonte.pequena, color: cores.textoSuave, textAlign: 'center' },
});
