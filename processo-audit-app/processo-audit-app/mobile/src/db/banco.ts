/** Banco local (SQLite) como o resto do app o enxerga. Funciona igual sobre expo-sqlite (celular) e better-sqlite3 (testes). */
export type Param = string | number | null;

export interface Banco {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: Param[]): Promise<{ alteradas: number }>;
  all<T>(sql: string, params?: Param[]): Promise<T[]>;
  first<T>(sql: string, params?: Param[]): Promise<T | null>;
  /** Tudo ou nada. Enquanto roda, nenhuma outra operação entra na transação. */
  transacao<T>(fn: (tx: Banco) => Promise<T>): Promise<T>;
}

/** O mínimo que cada driver precisa oferecer. */
export interface Executor {
  exec(sql: string): Promise<void>;
  run(sql: string, params: Param[]): Promise<{ alteradas: number }>;
  all<T>(sql: string, params: Param[]): Promise<T[]>;
}

/**
 * Serializa as operações. Sem isso, no expo-sqlite, uma consulta de outra tarefa assíncrona feita no meio de uma transação
 * entra nela (e é desfeita junto se ela falhar). Aqui a transação segura a fila e usa um `Banco` próprio, sem fila.
 */
export class BancoSerial implements Banco {
  private fila: Promise<unknown> = Promise.resolve();
  private readonly ex: Executor;
  constructor(ex: Executor) { this.ex = ex; }

  private naFila<T>(tarefa: () => Promise<T>): Promise<T> {
    const r = this.fila.then(tarefa, tarefa);
    this.fila = r.catch(() => undefined);
    return r;
  }

  exec = (sql: string) => this.naFila(() => this.ex.exec(sql));
  run = (sql: string, params: Param[] = []) => this.naFila(() => this.ex.run(sql, params));
  all = <T>(sql: string, params: Param[] = []) => this.naFila(() => this.ex.all<T>(sql, params));
  first = async <T>(sql: string, params: Param[] = []) => (await this.all<T>(sql, params))[0] ?? null;

  transacao = <T>(fn: (tx: Banco) => Promise<T>): Promise<T> => this.naFila(async () => {
    await this.ex.exec('BEGIN IMMEDIATE');
    const tx: Banco = {
      exec: (sql) => this.ex.exec(sql),
      run: (sql, params = []) => this.ex.run(sql, params),
      all: (sql, params = []) => this.ex.all(sql, params),
      first: async (sql, params = []) => (await this.ex.all<any>(sql, params))[0] ?? null,
      transacao: (g) => g(tx), // transação dentro de transação: apenas continua na mesma
    };
    try {
      const r = await fn(tx);
      await this.ex.exec('COMMIT');
      return r;
    } catch (e) {
      await this.ex.exec('ROLLBACK').catch(() => undefined);
      throw e;
    }
  });
}
