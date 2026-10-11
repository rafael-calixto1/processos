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

  // 2: trabalho do técnico em campo (nada daqui é apagado por uma nova sincronização do servidor)
  `CREATE TABLE outbox (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     usuario_id INTEGER NOT NULL,
     os_id INTEGER NOT NULL,
     tipo TEXT NOT NULL CHECK (tipo IN ('iniciar','lancamento','foto','remover_foto','finalizar','rascunho')),
     client_uuid TEXT NOT NULL UNIQUE,
     chave TEXT NOT NULL,
     payload TEXT NOT NULL,
     depende_de TEXT NOT NULL DEFAULT '[]',
     estado TEXT NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente','enviando','ok','atencao')),
     tentativas INTEGER NOT NULL DEFAULT 0,
     proxima_tentativa INTEGER NOT NULL DEFAULT 0,
     criado_em TEXT NOT NULL,
     atualizado_em TEXT NOT NULL,
     ok_em INTEGER,
     no_retrato INTEGER NOT NULL DEFAULT 0,
     forcada INTEGER NOT NULL DEFAULT 0,
     resposta TEXT,
     erro_status INTEGER,
     erro_mensagem TEXT,
     erro_detalhes TEXT,
     os_numero INTEGER,
     os_cliente TEXT
   );
   CREATE INDEX idx_outbox_usuario_estado ON outbox(usuario_id, estado, proxima_tentativa);
   CREATE INDEX idx_outbox_os ON outbox(os_id, id);
   CREATE TABLE rascunhos (
     os_id INTEGER PRIMARY KEY,
     usuario_id INTEGER NOT NULL,
     dados TEXT NOT NULL,
     atualizado_em TEXT NOT NULL
   );
   CREATE TABLE fotos_locais (
     client_uuid TEXT PRIMARY KEY,
     usuario_id INTEGER NOT NULL,
     os_id INTEGER NOT NULL,
     arquivo TEXT,
     mime TEXT NOT NULL,
     tamanho INTEGER,
     tirada_em TEXT NOT NULL,
     lat REAL,
     lng REAL,
     legenda TEXT,
     servidor_id INTEGER,
     removida INTEGER NOT NULL DEFAULT 0,
     criado_em TEXT NOT NULL
   );
   CREATE INDEX idx_fotos_os ON fotos_locais(os_id);
   CREATE TABLE os_detalhe (os_id INTEGER PRIMARY KEY, dados TEXT NOT NULL, baixado_em TEXT NOT NULL);`,
];

export const VERSAO_ATUAL = MIGRACOES.length;

/** `ate` existe para testar a atualização de um banco antigo; o app sempre migra até a versão atual. */
export const migrar = async (banco: Banco, ate: number = VERSAO_ATUAL): Promise<number> => {
  const atual = (await banco.first<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
  if (atual > VERSAO_ATUAL) throw new Error(`O banco do aparelho é mais novo (v${atual}) do que este app (v${VERSAO_ATUAL}). Atualize o aplicativo.`);
  for (let v = atual; v < Math.min(ate, VERSAO_ATUAL); v++) {
    await banco.transacao(async (tx) => {
      await tx.exec(MIGRACOES[v]);
      await tx.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
  return Math.max(atual, Math.min(ate, VERSAO_ATUAL));
};
