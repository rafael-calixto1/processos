import { useNetInfo } from '@react-native-community/netinfo';

/** Falso só quando o aparelho SABE que está sem internet; na dúvida (null) tenta mesmo assim. */
export const useOnline = (): boolean => {
  const { isConnected, isInternetReachable } = useNetInfo();
  return isConnected !== false && isInternetReachable !== false;
};
