import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { mensagemDeErro } from '@/api/erros';
import { Botao } from '@/components/Botao';
import { CameraFoto } from '@/components/CameraFoto';
import { Faixa } from '@/components/Faixa';
import { TelaEtapa } from '@/components/TelaEtapa';
import { confirmar } from '@/components/confirmar';
import { nomeDeFoto, ROTULO_SITUACAO, situacaoDaFoto, type SituacaoFoto } from '@/domain/foto';
import { useApp } from '@/estado/AppProvider';
import { useDados } from '@/estado/DadosProvider';
import { useFinalizacao } from '@/estado/FinalizacaoProvider';
import { escolherDaGaleria, prepararFoto, recuperarGaleriaPendente, type FotoBruta } from '@/estado/fotos';
import { ALVO_MINIMO, espaco, fonte, raio, type Paleta } from '@/theme';
import { useCores, useEstilos } from '@/estado/tema';

const corDe = (cores: Paleta): Record<SituacaoFoto, string> => ({ aguardando: cores.aviso, enviando: cores.aviso, enviada: cores.sucesso, erro: cores.erro });

/** Fotos do serviço: câmera do próprio app e galeria, comprimidas no aparelho e enviadas em segundo plano (inclusive depois, sem sinal). */
export default function Fotos() {
  const cores = useCores();
  const s = useEstilos(criarEstilos);
  const f = useFinalizacao();
  const { comandos, ops } = useDados();
  const { arquivos } = useApp();
  const [camera, setCamera] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const max = f.dados?.regras.fotos_max ?? 30;
  const min = f.dados?.regras.fotos_min ?? 1;
  const restantes = Math.max(0, max - f.totalFotos);
  const doServidor = Math.max(0, f.totalFotos - f.fotos.length);

  /** Comprime, guarda no aparelho e enfileira o envio. Se a fila recusar, o arquivo recém-criado não fica órfão. */
  const adicionar = async (bruta: FotoBruta) => {
    const { uri, tamanho } = await prepararFoto(bruta, nomeDeFoto(Date.now(), Math.random()));
    try { await comandos.adicionarFoto({ osId: f.osId, arquivo: uri, tamanho }); } catch (e) { await arquivos.apagar(uri).catch(() => undefined); throw e; }
  };

  const adicionarVarias = async (brutas: FotoBruta[]) => {
    setErro(null); setPreparando(true);
    const falhas: string[] = [];
    for (const b of brutas) { try { await adicionar(b); } catch (e) { falhas.push(mensagemDeErro(e)); } }
    setPreparando(false);
    if (falhas.length) setErro(`${falhas.length} foto(s) não puderam ser adicionadas: ${[...new Set(falhas)].join(' ')}`);
  };

  // se o sistema encerrou o app enquanto a galeria estava aberta, a escolha feita ainda está lá
  useEffect(() => { void recuperarGaleriaPendente().then((p) => { if (p.length) void adicionarVarias(p); }).catch(() => undefined); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const galeria = async () => {
    setErro(null);
    try { await adicionarVarias(await escolherDaGaleria(restantes)); } catch (e) { setErro(mensagemDeErro(e)); }
  };

  const remover = async (uuid: string) => {
    setErro(null);
    if (!(await confirmar('Remover esta foto?', 'Ela sai desta OS. Se já foi enviada, será removida do servidor também.', 'Remover'))) return;
    try { await comandos.removerFoto(f.osId, uuid); } catch (e) { setErro(mensagemDeErro(e)); }
  };

  if (camera) {
    return <CameraFoto totalTiradas={f.totalFotos} aoConcluir={() => setCamera(false)} aoCapturar={adicionar} />;
  }

  const acao = (
    <View style={{ gap: espaco.sm }}>
      <Botao titulo={preparando ? 'Preparando foto…' : 'Tirar foto'} onPress={() => { setErro(null); setCamera(true); }} carregando={preparando} desabilitado={!f.editavel || restantes <= 0} testID="botao-tirar-foto" />
      <Botao titulo="Escolher da galeria" variante="secundario" onPress={() => void galeria()} desabilitado={!f.editavel || restantes <= 0 || preparando} testID="botao-galeria" />
    </View>
  );

  return (
    <TelaEtapa titulo="Fotos do Serviço" concluida={f.concluidas.fotos} acao={acao}>
      {erro ? <Faixa tom="erro" texto={erro} /> : null}
      <Faixa tom="info" icone="images-outline" texto={`Fotografe a CEO fechada no poste, a rota lançada e as etiquetas. Mínimo ${min} foto${min > 1 ? 's' : ''}, máximo ${max}. As fotos são enviadas quando houver conexão.`} />
      <Text style={s.contador} accessibilityLabel={`${f.totalFotos} de ${max} fotos`} testID="contador-fotos">{f.totalFotos} de {max} fotos{restantes === 0 ? ' (limite atingido)' : ''}</Text>
      {f.totalFotos === 0 ? (
        <View style={s.vazio}><Ionicons name="camera-outline" size={48} color={cores.desabilitado} /><Text style={s.vazioTitulo}>Nenhuma foto ainda</Text></View>
      ) : null}
      <View style={s.grade}>
        {f.fotos.map((foto) => {
          const sit = situacaoDaFoto(foto, ops);
          return (
            <View key={foto.client_uuid} style={s.item} testID={`foto-${foto.client_uuid}`}>
              {foto.arquivo ? <Image source={{ uri: foto.arquivo }} style={s.imagem} accessibilityLabel="Foto do serviço" /> : <View style={[s.imagem, s.semArquivo]}><Ionicons name="checkmark-done" size={36} color={cores.sucesso} /></View>}
              <Text style={[s.situacao, { color: corDe(cores)[sit] }]} testID={`situacao-${foto.client_uuid}`}>{ROTULO_SITUACAO[sit]}</Text>
              {f.editavel ? (
                <Pressable onPress={() => void remover(foto.client_uuid)} accessibilityRole="button" accessibilityLabel="Remover foto" style={s.remover} testID={`remover-${foto.client_uuid}`}>
                  <Ionicons name="trash-outline" size={24} color={cores.erro} />
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
      {doServidor > 0 ? <Text style={s.nota}>+ {doServidor} foto{doServidor > 1 ? 's' : ''} desta OS já no servidor.</Text> : null}
    </TelaEtapa>
  );
}

const criarEstilos = (cores: Paleta) => StyleSheet.create({
  contador: { fontSize: fonte.destaque, fontWeight: '800', color: cores.primariaEscura },
  vazio: { alignItems: 'center', gap: espaco.sm, padding: espaco.xl, borderRadius: raio.lg, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda },
  vazioTitulo: { fontSize: fonte.destaque, fontWeight: '700', color: cores.texto },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.md },
  item: { width: '47%', gap: espaco.xs },
  imagem: { width: '100%', aspectRatio: 4 / 3, borderRadius: raio.md, backgroundColor: cores.neutroClaro },
  semArquivo: { alignItems: 'center', justifyContent: 'center' },
  situacao: { fontSize: fonte.pequena + 1, fontWeight: '800' },
  remover: { position: 'absolute', top: 6, right: 6, width: ALVO_MINIMO, height: ALVO_MINIMO, alignItems: 'center', justifyContent: 'center', borderRadius: raio.pilula, backgroundColor: 'rgba(255,255,255,0.92)' },
  nota: { fontSize: fonte.pequena + 1, color: cores.textoSuave },
});
