import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Botao } from '@/components/Botao';
import { Cabecalho } from '@/components/Cabecalho';
import { Cartao, Dado } from '@/components/Cartao';
import { Segmento } from '@/components/Segmento';
import { Faixa } from '@/components/Faixa';
import { confirmar } from '@/components/confirmar';
import { escolher } from '@/components/escolher';
import { limparDadosLocais } from '@/db/repositorio';
import { fmtDataHora } from '@/domain/tempo';
import { versaoApp } from '@/estado/dispositivo';
import { useApp } from '@/estado/AppProvider';
import { useDados } from '@/estado/DadosProvider';
import { useEstadoSessao } from '@/estado/useSessao';
import { descartarTudoLocal, resumoDoTrabalho } from '@/sync/sincronizar';
import { espaco, type Paleta } from '@/theme';
import { aplicarPreferencia, PREFERENCIAS, useEstilos, type PreferenciaTema } from '@/estado/tema';

export default function Conta() {
  const s = useEstilos(criarEstilos);
  const { sessao, servidor, banco, arquivos, tema } = useApp();
  const [preferencia, setPreferencia] = useState<PreferenciaTema>(tema.atual());
  const estado = useEstadoSessao();
  const { dados, sincronizando, sincronizadoEm, erro, semConexao, atualizar, contagens, pausadoPorSessao } = useDados();
  const [saindo, setSaindo] = useState(false);
  const usuario = estado.status === 'logado' ? estado.usuario : null;

  const escolherTema = (p: PreferenciaTema) => {
    setPreferencia(p);
    aplicarPreferencia(p);
    void tema.definir(p);
  };

  const sair = async () => {
    if (!usuario) return;
    const trabalho = await resumoDoTrabalho(banco, usuario.id);
    if (trabalho.total === 0) {
      const ok = await confirmar('Sair do aplicativo?', 'Os dados baixados neste aparelho (OS e estoque) serão apagados. Você precisará de internet para entrar de novo.', 'Sair');
      if (!ok) return;
      setSaindo(true);
      try { await sessao.sair(); await descartarTudoLocal(banco, arquivos.apagar); } finally { setSaindo(false); }
      return;
    }
    // há trabalho que o servidor ainda não recebeu: o padrão é MANTER; descartar exige uma segunda confirmação
    const partes = [trabalho.operacoes ? `${trabalho.operacoes} envio(s)` : null, trabalho.rascunhos ? `${trabalho.rascunhos} finalização(ões) em andamento` : null, trabalho.fotos ? `${trabalho.fotos} foto(s)` : null].filter(Boolean).join(', ');
    const escolha = await escolher<'manter' | 'descartar'>('Você tem trabalho que não foi enviado', `Ainda não chegaram ao servidor: ${partes}. Se você sair, eles ficam guardados neste aparelho e serão enviados quando você entrar de novo. Para enviar agora, volte e toque em "Sincronizar agora".`, [
      { rotulo: 'Sair e manter', valor: 'manter' },
      { rotulo: 'Sair e descartar tudo', valor: 'descartar', estilo: 'destructive' },
      { rotulo: 'Cancelar', valor: 'cancelar' as never, estilo: 'cancel' },
    ]);
    if (escolha === null || (escolha as string) === 'cancelar') return;
    if (escolha === 'descartar') {
      const certeza = await confirmar('Descartar mesmo?', `Isto apaga ${partes} que ainda não foram enviados. Não dá para desfazer.`, 'Descartar tudo');
      if (!certeza) return;
    }
    setSaindo(true);
    try {
      await sessao.sair();
      if (escolha === 'descartar') await descartarTudoLocal(banco, arquivos.apagar);
    } finally { setSaindo(false); }
  };

  return (
    <View style={s.tela}>
      <Cabecalho titulo="Conta" subtitulo={usuario?.email} />
      <ScrollView contentContainerStyle={s.conteudo}>
        {semConexao ? <Faixa texto="Sem conexão com o servidor no momento." icone="cloud-offline-outline" /> : null}
        {erro ? <Faixa texto={erro} tom="erro" /> : null}
        <Cartao titulo="Técnico">
          <Dado rotulo="Nome" valor={dados?.tecnico.nome ?? usuario?.name} />
          <Dado rotulo="Tipo" valor={dados ? (dados.tecnico.tipo === 'interno' ? 'Interno' : `Terceirizado${dados.tecnico.empresa ? ` · ${dados.tecnico.empresa}` : ''}`) : null} />
          <Dado rotulo="E-mail" valor={usuario?.email} />
        </Cartao>
        {pausadoPorSessao ? <Faixa tom="erro" icone="lock-closed-outline" texto="Sua sessão expirou. Saia e entre de novo para enviar. Nada foi perdido." /> : null}
        <Cartao titulo="Envio ao servidor">
          <Dado rotulo="Aguardando envio" valor={String(contagens.pendentes + contagens.enviando)} />
          <Dado rotulo="Requerem atenção" valor={String(contagens.atencao)} />
          <Dado rotulo="Dados do servidor de" valor={fmtDataHora(dados?.geradoEm)} />
          <Dado rotulo="Baixado neste aparelho em" valor={fmtDataHora(sincronizadoEm)} />
          <Botao titulo="Sincronizar agora" variante="secundario" onPress={() => void atualizar()} carregando={sincronizando} testID="botao-sincronizar" />
        </Cartao>
        <Cartao titulo="Aparência">
          <Segmento rotulo="Tema do aplicativo" opcoes={PREFERENCIAS} valor={preferencia} onChange={escolherTema} testID="tema" />
        </Cartao>
        <Cartao titulo="Aplicativo">
          <Dado rotulo="Servidor" valor={servidor.url()} />
          <Dado rotulo="Versão" valor={versaoApp()} />
        </Cartao>
        <Botao titulo="Sair" variante="perigo" onPress={sair} carregando={saindo} />
      </ScrollView>
    </View>
  );
}

const criarEstilos = (cores: Paleta) => StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.lg },
});
