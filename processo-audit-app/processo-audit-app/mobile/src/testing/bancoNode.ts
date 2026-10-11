import Database from 'better-sqlite3';
import { BancoSerial, type Executor } from '@/db/banco';
import { migrar } from '@/db/migracoes';

/**
 * O addon nativo do better-sqlite3 guarda a classe de erro do PRIMEIRO arquivo de teste carregado no processo do Jest.
 * Nos arquivos seguintes do mesmo processo o erro vem de outro "realm": `instanceof Error` é falso e o `rejects.toThrow`
 * do Jest não o reconhece (a mensagem enganosa é "Received function did not throw"). Era a causa do teste de banco que
 * falhava de vez em quando. Aqui todo erro do driver é refeito como `Error` do realm atual, com a mesma mensagem e código.
 */
const comoErro = (e: unknown): unknown => {
  if (e instanceof Error || typeof e !== 'object' || e === null) return e;
  const { message, code, name } = e as { message?: string; code?: string; name?: string };
  return Object.assign(new Error(String(message ?? e)), { name: name ?? 'Error', code });
};
const protegido = async <T,>(f: () => T | Promise<T>): Promise<T> => {
  try { return await f(); } catch (e) { throw comoErro(e); }
};

/** SQLite de verdade no Node (better-sqlite3) por trás da mesma `BancoSerial` do app, para testar SQL e migrações. */
export const criarBancoDeTeste = async (migrado = true, atraso = 0) => {
  const db = new Database(':memory:');
  const pausa = () => (atraso ? new Promise<void>((r) => setTimeout(r, atraso)) : Promise.resolve());
  const ex: Executor = {
    exec: (sql) => protegido(async () => { await pausa(); db.exec(sql); }),
    run: (sql, params) => protegido(async () => { await pausa(); return { alteradas: db.prepare(sql).run(...params).changes }; }),
    all: <T,>(sql: string, params: (string | number | null)[]) => protegido(async () => { await pausa(); return db.prepare(sql).all(...params) as T[]; }),
  };
  const banco = new BancoSerial(ex);
  if (migrado) await migrar(banco);
  return { banco, db };
};
