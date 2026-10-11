import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Botao } from '@/components/Botao';
import { Cabecalho } from '@/components/Cabecalho';
import { Cartao, Dado } from '@/components/Cartao';
import { Faixa } from '@/components/Faixa';
import { confirmar } from '@/components/confirmar';
import { limparDadosLocais } from '@/db/repositorio';
import { fmtDataHora } from '@/domain/tempo';
import { versaoApp } from '@/estado/dispositivo';
import { useApp } from '@/estado/AppProvider';
import { useDados } from '@/estado/DadosProvider';
import { useEstadoSessao } from '@/estado/useSessao';
import { cores, espaco } from '@/theme';

export default function Conta() {
  const { sessao, servidor, banco } = useApp();
  const estado = useEstadoSessao();
  const { dados, sincronizando, sincronizadoEm, erro, semConexao, atualizar } = useDados();
  const [saindo, setSaindo] = useState(false);
  const usuario = estado.status === 'logado' ? estado.usuario : null;

  const sair = async () => {
    const ok = await confirmar('Sair do aplicativo?', 'Os dados baixados neste aparelho (OS e estoque) serão apagados. Você precisará de internet para entrar de novo.', 'Sair');
    if (!ok) return;
    setSaindo(true);
    try {
      await sessao.sair();
      await limparDadosLocais(banco);
    } finally {
      setSaindo(false);
    }
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
        <Cartao titulo="Dados no aparelho">
          <Dado rotulo="Retrato do servidor de" valor={fmtDataHora(dados?.geradoEm)} />
          <Dado rotulo="Baixado neste aparelho em" valor={fmtDataHora(sincronizadoEm)} />
          <Botao titulo="Atualizar agora" variante="secundario" onPress={() => void atualizar()} carregando={sincronizando} />
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

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.lg },
});
