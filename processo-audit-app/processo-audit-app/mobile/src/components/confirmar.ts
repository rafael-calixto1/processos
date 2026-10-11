import { Alert, Platform } from 'react-native';

/** Pergunta de confirmação antes de ações sem volta. Devolve true se o técnico confirmou. */
export const confirmar = (titulo: string, mensagem: string, rotuloConfirmar: string): Promise<boolean> => {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(`${titulo}\n\n${mensagem}`) ?? false); // só na pré-visualização web
  return new Promise((resolve) => {
    Alert.alert(titulo, mensagem, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: rotuloConfirmar, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
};
