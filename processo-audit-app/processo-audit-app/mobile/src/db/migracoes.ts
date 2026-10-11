import type { Banco } from './banco';

/**
 * Migrações do banco local, aplicadas em ordem e uma única vez (versão guardada em PRAGMA user_version).
 * Nunca edite uma migração já publicada: acrescente a próxima ao fim da lista.
 */
const MIGRACOES: ReadonlyArray<string> = [
  // 1: espelho dos dados do servidor (retrato do bootstrap)
  `CREATE TABLE meta (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
   CREATE TABLE os (
     id INTEGER PRIMARY KEY, numero INTEGER NOT NULL, status TEXT NOT NULL, prazo TEXT,
     ordem INTEGER NOT NULL, dados TEXT NOT NULL
   );
   CREATE INDEX idx_os_status ON os(status);
   CREATE TABLE posse (lote_id INTEGER PRIMARY KEY, item_id INTEGER NOT NULL, dados TEXT NOT NULL);
   CREATE TABLE catalogo (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);`,
];

export const VERSAO_ATUAL = MIGRACOES.length;

export const migrar = async (banco: Banco): Promise<number> => {
  const atual = (await banco.first<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
  if (atual > VERSAO_ATUAL) throw new Error(`O banco do aparelho é mais novo (v${atual}) do que este app (v${VERSAO_ATUAL}). Atualize o aplicativo.`);
  for (let v = atual; v < VERSAO_ATUAL; v++) {
    await banco.transacao(async (tx) => {
      await tx.exec(MIGRACOES[v]);
      await tx.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
  return VERSAO_ATUAL;
};
