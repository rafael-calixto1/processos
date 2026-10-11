import Database from 'better-sqlite3';
import { BancoSerial, type Executor } from '@/db/banco';
import { migrar } from '@/db/migracoes';

/** SQLite de verdade no Node (better-sqlite3) por trás da mesma `BancoSerial` do app, para testar SQL e migrações. */
export const criarBancoDeTeste = async (migrado = true, atraso = 0) => {
  const db = new Database(':memory:');
  const pausa = () => (atraso ? new Promise<void>((r) => setTimeout(r, atraso)) : Promise.resolve());
  const ex: Executor = {
    exec: async (sql) => { await pausa(); db.exec(sql); },
    run: async (sql, params) => { await pausa(); return { alteradas: db.prepare(sql).run(...params).changes }; },
    all: async <T,>(sql: string, params: (string | number | null)[]) => { await pausa(); return db.prepare(sql).all(...params) as T[]; },
  };
  const banco = new BancoSerial(ex);
  if (migrado) await migrar(banco);
  return { banco, db };
};
