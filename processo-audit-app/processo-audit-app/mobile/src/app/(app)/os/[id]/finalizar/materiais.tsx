import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { mensagemDeErro } from '@/api/erros';
import { Botao } from '@/components/Botao';
import { Cartao } from '@/components/Cartao';
import { MapaDoTrecho } from '@/components/MapaDoTrecho';
import { Faixa } from '@/components/Faixa';
import { Segmento } from '@/components/Segmento';
import { TelaEtapa } from '@/components/TelaEtapa';
import { confirmar } from '@/components/confirmar';
import { fmtQtd } from '@/domain/quantidade';
import { fmtMetros } from '@/domain/trecho';
import type { LancamentoVisao } from '@/domain/visao';
import { useApp } from '@/estado/AppProvider';
import { useDados } from '@/estado/DadosProvider';
import { useOnline } from '@/estado/rede';
import { useFinalizacao } from '@/estado/FinalizacaoProvider';
import { espaco, fonte, raio, type Paleta } from '@/theme';
import { useCores, useEstilos } from '@/estado/tema';

const estadoDe = (cores: Paleta): Record<LancamentoVisao['estado'], { texto: string; cor: string }> => ({
  enviado: { texto: 'Enviado ao servidor', cor: cores.sucesso },
  ok: { texto: 'Enviado ao servidor', cor: cores.sucesso },
  pendente: { texto: 'Aguardando envio', cor: cores.aviso },
  enviando: { texto: 'Enviando…', cor: cores.aviso },
  atencao: { texto: 'O servidor não aceitou', cor: cores.erro },
});

/** Materiais utilizados = lançamentos (serviço + trecho + material da posse) ou "não usei material". */
export default function Materiais() {
  const cores = useCores();
  const s = useEstilos(criarEstilos);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const f = useFinalizacao();
  const { comandos } = useDados();
  const { servidor } = useApp();
  const online = useOnline();
  const urlServidor = servidor?.url?.();
  const origemDoServidor = urlServidor ? new URL(urlServidor).origin : undefined;
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const comLancamento = f.lancamentos.length > 0;
  const resposta = comLancamento ? 'sim' : f.rascunho.materiais_usados === null ? null : f.rascunho.materiais_usados ? 'sim' : 'nao';
  const novo = () => router.push({ pathname: '/os/[id]/finalizar/lancamento', params: { id: String(id) } });
  const corrigir = (op: number) => router.push({ pathname: '/os/[id]/finalizar/lancamento', params: { id: String(id), corrigir: String(op) } });

  const remover = async (opId: number) => {
    setErro(null);
    if (!(await confirmar('Remover este lançamento?', 'Ele ainda não foi enviado. O material volta para o seu saldo.', 'Remover'))) return;
    setOcupado(opId);
    try { await comandos.removerLancamento(opId); } catch (e) { setErro(mensagemDeErro(e)); } finally { setOcupado(null); }
  };

  const acao = resposta === 'sim'
    ? <Botao titulo="Adicionar lançamento" onPress={novo} desabilitado={!f.editavel} testID="botao-novo-lancamento" />
    : undefined;

  return (
    <TelaEtapa titulo="Materiais Utilizados" concluida={f.concluidas.usados} acao={acao}>
      {erro ? <Faixa tom="erro" texto={erro} /> : null}
      <Cartao>
        <Text style={s.pergunta}>Materiais foram utilizados?</Text>
        <Segmento rotulo="Materiais foram utilizados" valor={resposta} desabilitado={!f.editavel || comLancamento} testID="usados-pergunta"
          opcoes={[{ valor: 'sim', rotulo: 'Sim' }, { valor: 'nao', rotulo: 'Não' }]} onChange={(v) => f.alterar((r) => ({ ...r, materiais_usados: v === 'sim' }))} />
        {comLancamento ? <Text style={s.nota}>Há lançamentos nesta OS: a resposta não pode ser “Não”.</Text> : null}
        {resposta === 'nao' ? <Text style={s.nota}>Nenhum material usado. Etapa concluída.</Text> : null}
        {resposta === null ? <Text style={s.nota}>Responda para concluir a etapa. “Não” significa que nenhum material da sua posse foi usado.</Text> : null}
      </Cartao>

      {resposta === 'sim' && !comLancamento ? (
        <View style={s.vazio}><Text style={s.vazioTitulo}>Nenhum lançamento ainda</Text><Text style={s.vazioTexto}>Cada lançamento é um serviço em um trecho, com o material usado nele. Funciona sem sinal.</Text></View>
      ) : null}

      {f.lancamentos.map((l) => {
        const v = estadoDe(cores)[l.estado];
        const editavel = f.editavel && l.origem === 'local' && (l.estado === 'pendente' || l.estado === 'atencao');
        return (
          <Cartao key={l.chave}>
            <Text style={s.nome}>{l.descricao}</Text>
            {l.trecho ? <Text style={s.trecho}>Trecho: <Text style={s.negrito}>{l.trecho}</Text></Text> : null}
            {l.rota ? (
              <>
                <Text style={s.trecho} testID={`rota-${l.chave}`}>Marcado no mapa: {l.rota.pontos.length} pontos · ≈ {fmtMetros(l.rota.metros)}</Text>
                <MapaDoTrecho rota={l.rota} online={online} origem={origemDoServidor} />
              </>
            ) : null}
            {l.linhas.map((x, i) => <Text key={i} style={s.linha}>{x.item_nome} — <Text style={s.negrito}>{fmtQtd(x.quantidade, x.unidade)}</Text> · {x.lote_codigo}</Text>)}
            <Text style={[s.estado, { color: v.cor }]} accessibilityLabel={`Situação: ${v.texto}`}>{v.texto}</Text>
            {l.estado === 'atencao' && l.erro ? <View style={s.erro} accessibilityRole="alert"><Text style={s.erroTexto}>{l.erro.mensagem}</Text></View> : null}
            {editavel && l.operacaoId ? (
              <View style={s.acoes}>
                <Botao titulo="Corrigir quantidades" variante="secundario" onPress={() => corrigir(l.operacaoId!)} testID={`corrigir-${l.operacaoId}`} />
                <Botao titulo="Remover" variante="perigo" onPress={() => void remover(l.operacaoId!)} carregando={ocupado === l.operacaoId} testID={`remover-lancamento-${l.operacaoId}`} />
              </View>
            ) : null}
            {l.origem === 'servidor' || l.estado === 'ok' || l.estado === 'enviando' ? <Text style={s.nota}>Para corrigir um lançamento já enviado, fale com o estoque.</Text> : null}
          </Cartao>
        );
      })}
    </TelaEtapa>
  );
}

const criarEstilos = (cores: Paleta) => StyleSheet.create({
  pergunta: { fontSize: fonte.destaque, fontWeight: '700', color: cores.texto },
  nota: { fontSize: fonte.pequena + 1, color: cores.textoSuave, lineHeight: 20 },
  vazio: { padding: espaco.lg, borderRadius: raio.lg, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda, gap: espaco.xs },
  vazioTitulo: { fontSize: fonte.destaque, fontWeight: '700', color: cores.texto },
  vazioTexto: { fontSize: fonte.corpo, color: cores.textoSuave, lineHeight: 22 },
  nome: { fontSize: fonte.destaque, fontWeight: '700', color: cores.texto },
  trecho: { fontSize: fonte.corpo, color: cores.textoSuave },
  linha: { fontSize: fonte.corpo, color: cores.texto, lineHeight: 22 },
  negrito: { fontWeight: '800' },
  estado: { fontSize: fonte.corpo, fontWeight: '800' },
  erro: { backgroundColor: cores.erroClaro, borderRadius: raio.md, padding: espaco.md },
  erroTexto: { fontSize: fonte.corpo, color: cores.erro, fontWeight: '600', lineHeight: 22 },
  acoes: { gap: espaco.sm },
});
