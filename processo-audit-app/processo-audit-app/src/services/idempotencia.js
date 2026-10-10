import crypto from 'node:crypto';
import pool from '../config/database.js';
import { ServiceError, withTx } from './estoqueService.js';
import { retentarSeDeadlock } from './retentativa.js';

/**
 * Idempotência por cabeçalho `Idempotency-Key` (UUID gerado pelo app).
 *
 * A linha de `sync_operacoes` é criada primeiro, na MESMA transação da operação: um retry concorrente
 * espera a primeira tentativa terminar (chave UNIQUE) e então recebe a mesma resposta, sem reexecutar.
 * Se a operação falha, a transação inteira é desfeita, inclusive a linha: falhas não são guardadas e o
 * app pode reenviar com a mesma chave depois de corrigir o problema (ex.: posse ajustada pelo estoque).
 * A chave vale por usuário, por rota (com os ids na URL) e por corpo: reutilizá-la para outra coisa dá 422.
 */
const CHAVE_VALIDA = /^[A-Za-z0-9._:-]{8,80}$/;

const canonico = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
  : x));

export const hashDe = (conteudo) => crypto.createHash('sha256').update(typeof conteudo === 'string' || Buffer.isBuffer(conteudo) ? conteudo : canonico(conteudo ?? {})).digest('hex');

export const lerChaveIdempotencia = (req) => {
  const chave = req.get('Idempotency-Key');
  if (chave === undefined) return null;
  if (!CHAVE_VALIDA.test(chave)) throw new ServiceError(400, 'Idempotency-Key inválida: use um UUID (8 a 80 caracteres)');
  return chave;
};

/**
 * Roda `fn(conn)` em transação. Devolve { status, body, repetida }.
 * `hash` substitui o hash do corpo (upload usa o conteúdo do arquivo); `db` é para testes.
 */
export const executarIdempotente = async (req, { status = 201, hash, db } = {}, fn) => {
  const chave = lerChaveIdempotencia(req);
  if (!chave) return { status, body: await withTx(fn, db), repetida: false };

  const rota = `${req.method} ${req.baseUrl}${req.path}`.slice(0, 160);
  const hashCorpo = hash ?? hashDe(req.body);

  const tentar = () => withTx(async (conn) => {
    // ON DUPLICATE KEY pede o lock exclusivo da linha direto: os retries simultâneos entram numa fila. Se a gente
    // inserisse e tratasse o erro de duplicidade, cada um seguraria um lock compartilhado e todos travariam ao pedir o exclusivo.
    const [r] = await conn.query(
      `INSERT INTO sync_operacoes (usuario_id, chave, rota, hash_corpo) VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`, [req.userId, chave, rota, hashCorpo]);
    const id = r.insertId;
    // Com o lock em mãos, a linha ou é nossa (acabou de ser criada, sem resposta) ou é de uma tentativa já concluída
    const [[prev]] = await conn.query('SELECT rota, hash_corpo, status_http, resposta FROM sync_operacoes WHERE id = ? FOR UPDATE', [id]);
    if (prev.resposta !== null) {
      if (prev.rota !== rota || prev.hash_corpo !== hashCorpo) throw new ServiceError(422, 'Esta Idempotency-Key já foi usada em outra operação');
      return { status: prev.status_http, body: JSON.parse(prev.resposta), repetida: true };
    }
    if (prev.rota !== rota || prev.hash_corpo !== hashCorpo) throw new ServiceError(409, 'Esta operação ainda está em andamento. Tente novamente em instantes');
    const body = await fn(conn);
    await conn.query('UPDATE sync_operacoes SET status_http = ?, resposta = ? WHERE id = ?', [status, JSON.stringify(body), id]);
    return { status, body, repetida: false };
  }, db);

  // Rede de segurança: se o banco abortar a transação por deadlock, ela é refeita.
  return retentarSeDeadlock(tentar);
};

/** Apaga registros antigos. Um app offline por mais que isso deve tratar a operação como "requer atenção". */
export const limparOperacoesAntigas = async (dias = 60) => {
  const [r] = await pool.query('DELETE FROM sync_operacoes WHERE criado_em < (NOW() - INTERVAL ? DAY)', [dias]);
  return r.affectedRows;
};
