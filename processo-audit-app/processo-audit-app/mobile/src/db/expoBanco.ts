import * as SQLite from 'expo-sqlite';
import { BancoSerial, type Banco, type Executor } from './banco';
import { migrar } from './migracoes';

const executor = (db: SQLite.SQLiteDatabase): Executor => ({
  exec: (sql) => db.execAsync(sql),
  run: async (sql, params) => ({ alteradas: (await db.runAsync(sql, params)).changes }),
  all: <T,>(sql: string, params: (string | number | null)[]) => db.getAllAsync<T>(sql, params),
});

/** Abre o banco do aparelho, liga o modo WAL e aplica as migrações. */
export const abrirBanco = async (nome = 'os-tecnicos.db'): Promise<Banco> => {
  const db = await SQLite.openDatabaseAsync(nome);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const banco = new BancoSerial(executor(db));
  await migrar(banco);
  return banco;
};
