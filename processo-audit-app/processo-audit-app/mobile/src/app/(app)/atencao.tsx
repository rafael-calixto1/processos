import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { mensagemDeErro } from '@/api/erros';
import { Botao } from '@/components/Botao';
import { Cabecalho } from '@/components/Cabecalho';
import { Cartao } from '@/components/Cartao';
import { EstadoVazio } from '@/components/EstadoVazio';
import { Faixa } from '@/components/Faixa';
import { confirmar } from '@/components/confirmar';
import { descreverAtencao, rotuloDaOS, type AcaoAtencao } from '@/domain/atencao';
import { DIAS_MAX_OPERACAO, idadeEmDias, type Operacao } from '@/domain/operacoes';
import { fmtDataHora } from '@/domain/tempo';
import { useDados } from '@/estado/DadosProvider';
import { cores, espaco, fonte } from '@/theme';

const ROTULOS: Record<AcaoAtencao, string> = {
  tentar_de_novo: 'Tentar de novo',
  enviar_mesmo_assim: 'Enviar mesmo assim',
  corrigir: 'Corrigir quantidades',
  descartar: 'Descartar',
  voltar_a_editar: 'Voltar a editar',
};

/** "Requer atenção": tudo o que o servidor recusou. Nada some sozinho: cada item mostra a mensagem do servidor e o que fazer. */
export default function Atencao() {
  const router = useRouter();
  const { ops, comandos, atualizar, sincronizando } = useDados();
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const itens = ops.filter((o) => o.estado === 'atencao' && o.tipo !== 'rascunho');
  const aguardando = ops.filter((o) => o.estado === 'pendente' && o.tipo !== 'rascunho' && o.depende_de.some((d) => itens.some((i) => i.id === d))).length;
  const voltar = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const executar = async (op: Operacao, acao: AcaoAtencao) => {
    setErro(null);
    try {
      if (acao === 'descartar') {
        const ok = await confirmar('Descartar este item?', 'Ele não será enviado ao servidor e não dá para desfazer.', 'Descartar');
        if (!ok) return;
      }
      if (acao === 'enviar_mesmo_assim') {
        const ok = await confirmar('Enviar mesmo assim?', 'Esta operação é antiga. Se o escritório já registrou isto, o material pode ser baixado em duplicidade.', 'Enviar');
        if (!ok) return;
      }
      setOcupado(op.id);
      if (acao === 'tentar_de_novo') await comandos.reenviar(op.id);
      else if (acao === 'enviar_mesmo_assim') await comandos.reenviar(op.id, { forcar: true });
      else if (acao === 'descartar') await comandos.descartar(op.id);
      else if (acao === 'voltar_a_editar') { await comandos.voltarAEditar(op.os_id); router.push({ pathname: '/os/[id]/finalizar', params: { id: String(op.os_id) } }); }
      else if (acao === 'corrigir') router.push({ pathname: '/os/[id]/finalizar/lancamento', params: { id: String(op.os_id), corrigir: String(op.id) } });
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(null);
    }
  };

  return (
    <View style={s.tela}>
      <Cabecalho titulo="Requer atenção" subtitulo={itens.length ? `${itens.length} item(ns)` : undefined} aoVoltar={voltar} />
      <FlatList
        data={itens}
        keyExtractor={(o) => String(o.id)}
        contentContainerStyle={s.lista}
        ItemSeparatorComponent={() => <View style={{ height: espaco.md }} />}
        ListHeaderComponent={
          <View style={{ gap: espaco.sm }}>
            {erro ? <Faixa tom="erro" texto={erro} /> : null}
            {aguardando > 0 ? <Faixa tom="info" icone="hourglass-outline" texto={`${aguardando} envio(s) estão esperando estes itens serem resolvidos. Nada foi perdido.`} /> : null}
          </View>
        }
        renderItem={({ item }) => {
          const d = descreverAtencao(item, Date.now());
          const velha = item.erro?.status === null && idadeEmDias(item.criado_em, Date.now()) > DIAS_MAX_OPERACAO;
          return (
            <Cartao titulo={d.titulo}>
              <Text style={s.os}>{rotuloDaOS(item)}</Text>
              <Text style={s.quando}>Feito em {fmtDataHora(item.criado_em)}</Text>
              <View style={s.erro} accessibilityRole="alert">
                <Text style={s.erroTitulo}>{velha ? 'Parado por segurança' : 'O servidor não aceitou'}</Text>
                <Text style={s.erroTexto}>{item.erro?.mensagem}</Text>
                {item.erro?.detalhes?.map((x, i) => <Text key={i} style={s.detalhe}>• {x.mensagem}</Text>)}
              </View>
              <Text style={s.fazer}>{d.oQueFazer}</Text>
              <View style={s.acoes}>
                {d.acoes.map((a, i) => (
                  <Botao key={a} titulo={ROTULOS[a]} variante={a === 'descartar' ? 'perigo' : i === 0 ? 'primario' : 'secundario'} carregando={ocupado === item.id} desabilitado={ocupado !== null && ocupado !== item.id}
                    onPress={() => void executar(item, a)} testID={`acao-${a}-${item.id}`} />
                ))}
              </View>
            </Cartao>
          );
        }}
        ListEmptyComponent={<EstadoVazio icone="checkmark-circle-outline" titulo="Nada precisa de atenção" texto="Tudo o que você fez foi aceito pelo servidor ou está esperando a sua vez de ser enviado." acao={{ rotulo: sincronizando ? 'Enviando…' : 'Sincronizar agora', onPress: () => void atualizar() }} />}
      />
    </View>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  lista: { padding: espaco.lg, flexGrow: 1 },
  os: { fontSize: fonte.corpo, fontWeight: '700', color: cores.texto },
  quando: { fontSize: fonte.pequena, color: cores.textoSuave },
  erro: { backgroundColor: cores.erroClaro, borderRadius: 12, padding: espaco.md, gap: espaco.xs },
  erroTitulo: { fontSize: fonte.pequena, fontWeight: '800', color: cores.erro, textTransform: 'uppercase', letterSpacing: 0.4 },
  erroTexto: { fontSize: fonte.corpo, color: cores.erro, fontWeight: '600', lineHeight: 22 },
  detalhe: { fontSize: fonte.pequena + 1, color: cores.erro, lineHeight: 20 },
  fazer: { fontSize: fonte.corpo, color: cores.texto, lineHeight: 22 },
  acoes: { gap: espaco.sm },
});
