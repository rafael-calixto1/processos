import { Alert, Platform } from 'react-native';

export interface Opcao<T> { rotulo: string; valor: T; estilo?: 'default' | 'cancel' | 'destructive' }

/** Pergunta com até 3 respostas (ex.: "Sair e manter", "Sair e descartar", "Cancelar"). Devolve o valor escolhido, ou null se fechou sem escolher. */
export const escolher = <T,>(titulo: string, mensagem: string, opcoes: Array<Opcao<T>>): Promise<T | null> => {
  if (Platform.OS === 'web') {
    // só na pré-visualização web: confirma a primeira opção
    return Promise.resolve(globalThis.confirm?.(`${titulo}\n\n${mensagem}\n\nOK = ${opcoes[0].rotulo}`) ? opcoes[0].valor : null);
  }
  return new Promise((resolve) => {
    Alert.alert(titulo, mensagem, opcoes.map((o) => ({ text: o.rotulo, style: o.estilo ?? 'default', onPress: () => resolve(o.valor) })), { cancelable: true, onDismiss: () => resolve(null) });
  });
};
