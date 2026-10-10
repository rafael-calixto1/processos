/**
 * Refaz `fn` quando o InnoDB aborta a transação por deadlock (erro normal sob concorrência, a transação inteira já foi
 * desfeita). `fn` deve abrir a própria transação e não ter efeitos fora do banco.
 */
export const retentarSeDeadlock = async (fn, tentativas = 3) => {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) {
      if (e.code !== 'ER_LOCK_DEADLOCK' || i >= tentativas) throw e;
    }
  }
};
