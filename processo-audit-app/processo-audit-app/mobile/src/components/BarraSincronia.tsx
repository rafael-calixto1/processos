import { useRouter } from 'expo-router';
import type { Contagens } from '@/db/outbox';
import { fmtHora } from '@/domain/tempo';
import { Faixa } from './Faixa';

interface Props {
  contagens: Contagens;
  sincronizando: boolean;
  semConexao: boolean;
  pausadoPorSessao: boolean;
  sincronizadoEm: string | null;
  atualizar: () => void;
}

/** Situação do envio no topo das telas: o que espera conexão, o que o servidor recusou e o botão "Sincronizar agora". */
export function BarraSincronia({ contagens, sincronizando, semConexao, pausadoPorSessao, sincronizadoEm, atualizar }: Props) {
  const router = useRouter();
  const aguardando = contagens.pendentes + contagens.enviando;
  return (
    <>
      {pausadoPorSessao ? <Faixa tom="erro" icone="lock-closed-outline" texto="Sua sessão expirou. Entre de novo para enviar. Nada do que você fez foi perdido." /> : null}
      {contagens.atencao > 0 ? (
        <Faixa tom="erro" icone="alert-circle" texto={contagens.atencao === 1 ? '1 item requer a sua atenção: o servidor não aceitou.' : `${contagens.atencao} itens requerem a sua atenção: o servidor não aceitou.`}
          acao={{ rotulo: 'Ver', onPress: () => router.push('/atencao') }} />
      ) : null}
      {aguardando > 0 ? (
        <Faixa tom="aviso" icone={sincronizando ? 'sync-outline' : 'cloud-upload-outline'}
          texto={sincronizando ? 'Enviando…' : `${aguardando === 1 ? '1 envio aguardando' : `${aguardando} envios aguardando`} ${semConexao ? 'conexão' : 'a vez'}. Está tudo salvo no aparelho.${semConexao ? ` Dados de ${fmtHora(sincronizadoEm)}.` : ''}`}
          acao={sincronizando ? undefined : { rotulo: 'Sincronizar agora', onPress: atualizar }} />
      ) : null}
      {semConexao && aguardando === 0 ? (
        <Faixa texto={`Sem conexão. Mostrando os dados de ${fmtHora(sincronizadoEm)}.`} icone="cloud-offline-outline" acao={{ rotulo: 'Tentar', onPress: atualizar }} />
      ) : null}
    </>
  );
}
