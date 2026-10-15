/**
 * Migration: auditoria dos Processos.
 *
 *   DB_NAME=processo_audit_test node scripts/migrate_processos_auditoria.js          # aplica (idempotente)
 *   DB_NAME=processo_audit_test node scripts/migrate_processos_auditoria.js --down   # reverte
 *
 * Pela CLI o DB_NAME precisa vir explícito no comando (o valor do .env é ignorado de propósito),
 * para nunca migrar o banco de produção por engano.
 *
 * Cria processos_auditoria: tudo o que é feito em /processos (processos criados, editados, inativados e abertos, fotos
 * de instrução, PDFs exportados, execuções iniciadas, passos concluídos, execuções finalizadas e canceladas) — quem,
 * quando, de onde, de qual IP, o que mudou e se deu certo. Sem FK de propósito: o registro precisa sobreviver a
 * qualquer exclusão (processo, passo, execução, usuário).
 */
import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const dbExplicito = process.env.DB_NAME; // antes do dotenv: só vale o que veio do comando
dotenv.config();

export const up = async (c) => {
  await c.query(`
    CREATE TABLE IF NOT EXISTS processos_auditoria (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      acao VARCHAR(30) NOT NULL,
      processo_id INT NULL,
      processo_titulo VARCHAR(255) NULL,
      departamento_id INT NULL,
      execucao_id INT NULL,
      resumo VARCHAR(500) NOT NULL,
      campos_alterados VARCHAR(500) NULL,
      dados_antes LONGTEXT NULL,
      dados_depois LONGTEXT NULL,
      resultado VARCHAR(10) NOT NULL DEFAULT 'ok',
      http_status SMALLINT NULL,
      erro VARCHAR(500) NULL,
      origem VARCHAR(10) NOT NULL DEFAULT 'outro',
      usuario_id INT NULL,
      usuario_email VARCHAR(255) NULL,
      usuario_nome VARCHAR(255) NULL,
      usuario_papel VARCHAR(20) NULL,
      ip VARCHAR(64) NULL,
      ip_cadeia VARCHAR(255) NULL,
      user_agent VARCHAR(500) NULL,
      metodo VARCHAR(8) NULL,
      rota VARCHAR(255) NULL,
      INDEX idx_procaud_data (created_at),
      INDEX idx_procaud_acao (acao, created_at),
      INDEX idx_procaud_processo (processo_id, created_at),
      INDEX idx_procaud_departamento (departamento_id, created_at),
      INDEX idx_procaud_execucao (execucao_id),
      INDEX idx_procaud_usuario (usuario_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
};

export const down = async (c) => {
  await c.query('DROP TABLE IF EXISTS processos_auditoria');
};

export const connect = (database) =>
  mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
  });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!dbExplicito) {
    console.error('Informe o banco no comando, ex.: DB_NAME=processo_audit_test node scripts/migrate_processos_auditoria.js');
    process.exit(1);
  }
  const conn = await connect(dbExplicito);
  try {
    console.log(`Banco: ${dbExplicito}`);
    if (process.argv.includes('--down')) {
      await down(conn);
      console.log('✅ Auditoria dos Processos revertida');
    } else {
      await up(conn);
      console.log('✅ Auditoria dos Processos migrada');
    }
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}
