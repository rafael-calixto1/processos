import pool from '../config/database.js';

/**
 * Regras de estoque. Toda operação que altera saldo roda numa transação com
 * `SELECT ... FOR UPDATE` na linha do lote (e da OS, quando houver), sempre nessa
 * ordem (OS -> lote) para evitar deadlock.
 *
 * Modelo: lote.saldo_atual = almoxarifado + soma(estoque_posse). Nada edita saldo
 * "na mão"; cada função grava uma linha em estoque_movimentacoes (auditoria).
 */

export class ServiceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const r2 = (n) => Math.round(Number(n) * 100) / 100;

const parseQtd = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new ServiceError(400, 'A quantidade deve ser maior que zero');
  return r2(n);
};

export const withTx = async (fn, db = pool) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const TIPO_PREFIXO = { bobina: 'BOB', caixa: 'CXA', rolo: 'ROL', unidade: 'UNI' };

const nextSequence = async (conn, chave, qtd = 1) => {
  await conn.query(
    'INSERT INTO estoque_sequencias (chave, valor) VALUES (?, LAST_INSERT_ID(?)) ON DUPLICATE KEY UPDATE valor = LAST_INSERT_ID(valor + ?)',
    [chave, qtd, qtd]
  );
  const [[{ id }]] = await conn.query('SELECT LAST_INSERT_ID() AS id');
  return Number(id) - qtd + 1; // primeiro número reservado
};

export const normalizarCodigo = (codigo) => String(codigo || '').trim().toUpperCase();

const lockLote = async (conn, { lote_id, codigo }) => {
  const [rows] = codigo
    ? await conn.query('SELECT * FROM estoque_lotes WHERE codigo = ? FOR UPDATE', [normalizarCodigo(codigo)])
    : await conn.query('SELECT * FROM estoque_lotes WHERE id = ? FOR UPDATE', [lote_id]);
  if (!rows.length) throw new ServiceError(404, 'Lote não encontrado');
  return rows[0];
};

const somaPosse = async (conn, lote_id) => {
  const [[{ total }]] = await conn.query(
    'SELECT COALESCE(SUM(quantidade),0) AS total FROM estoque_posse WHERE lote_id = ?', [lote_id]
  );
  return r2(total);
};

const getPosse = async (conn, lote_id, tecnico_id) => {
  const [rows] = await conn.query(
    'SELECT quantidade FROM estoque_posse WHERE lote_id = ? AND tecnico_id = ? FOR UPDATE', [lote_id, tecnico_id]
  );
  return rows.length ? r2(rows[0].quantidade) : 0;
};

const addPosse = (conn, lote_id, tecnico_id, delta) =>
  delta < 0
    ? conn.query('UPDATE estoque_posse SET quantidade = quantidade + ? WHERE lote_id = ? AND tecnico_id = ?', [delta, lote_id, tecnico_id])
    : conn.query(
        `INSERT INTO estoque_posse (lote_id, tecnico_id, quantidade) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE quantidade = quantidade + VALUES(quantidade)`,
        [lote_id, tecnico_id, delta]
      );

const registrar = async (conn, m) => {
  const [res] = await conn.query(
    `INSERT INTO estoque_movimentacoes
       (tipo, lote_id, item_id, quantidade, tecnico_id, os_id, estorno_de_id, condicao, observacao, criado_por)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [m.tipo, m.lote_id, m.item_id, m.quantidade, m.tecnico_id ?? null, m.os_id ?? null,
     m.estorno_de_id ?? null, m.condicao ?? null, m.observacao ?? null, m.criado_por]
  );
  return res.insertId;
};

const getTecnicoAtivo = async (conn, tecnico_id) => {
  const [rows] = await conn.query('SELECT * FROM tecnicos WHERE id = ?', [tecnico_id]);
  if (!rows.length) throw new ServiceError(404, 'Técnico/equipe não encontrado');
  if (!rows[0].ativo) throw new ServiceError(400, 'Técnico/equipe inativo');
  return rows[0];
};

/* ── Compra / Entrada: 1 lote por volume ── */
export const criarCompra = (dados, userId, db) => withTx(async (conn) => {
  const { fornecedor_id, item_id, tipo_volume, nf, chave_idempotencia } = dados;
  const qtd = Number(dados.qtd_volumes);
  const medida = Number(dados.medida_por_volume);

  if (!TIPO_PREFIXO[tipo_volume]) throw new ServiceError(400, 'Tipo de volume inválido');
  if (!Number.isInteger(qtd) || qtd <= 0 || qtd > 500) throw new ServiceError(400, 'Número de volumes inválido (1 a 500)');
  if (!Number.isFinite(medida) || medida <= 0) throw new ServiceError(400, 'A medida por volume deve ser maior que zero');

  if (chave_idempotencia) {
    const [[prev]] = await conn.query('SELECT id FROM estoque_compras WHERE chave_idempotencia = ?', [chave_idempotencia]);
    if (prev) return { ...(await getCompra(conn, prev.id)), repetida: true };
  }

  const [[item]] = await conn.query('SELECT id, ativo FROM estoque_itens WHERE id = ?', [item_id]);
  if (!item) throw new ServiceError(404, 'Item não encontrado');
  if (!item.ativo) throw new ServiceError(400, 'Item inativo');
  if (fornecedor_id) {
    const [[f]] = await conn.query('SELECT id FROM fornecedores WHERE id = ?', [fornecedor_id]);
    if (!f) throw new ServiceError(404, 'Fornecedor não encontrado');
  }

  const [res] = await conn.query(
    `INSERT INTO estoque_compras
       (fornecedor_id, item_id, tipo_volume, qtd_volumes, medida_por_volume, nf, chave_idempotencia, criado_por)
     VALUES (?,?,?,?,?,?,?,?)`,
    [fornecedor_id || null, item_id, tipo_volume, qtd, r2(medida), nf || null, chave_idempotencia || null, userId]
  );
  const compra_id = res.insertId;

  const prefixo = `LOTE-${TIPO_PREFIXO[tipo_volume]}`;
  const inicio = await nextSequence(conn, prefixo, qtd);
  for (let i = 0; i < qtd; i++) {
    const codigo = `${prefixo}-${String(inicio + i).padStart(4, '0')}`;
    const [l] = await conn.query(
      'INSERT INTO estoque_lotes (codigo, item_id, compra_id, saldo_inicial, saldo_atual) VALUES (?,?,?,?,?)',
      [codigo, item_id, compra_id, r2(medida), r2(medida)]
    );
    await registrar(conn, {
      tipo: 'entrada', lote_id: l.insertId, item_id, quantidade: r2(medida),
      observacao: nf ? `NF ${nf}` : null, criado_por: userId,
    });
  }
  return getCompra(conn, compra_id);
}, db);

const getCompra = async (conn, id) => {
  const [[compra]] = await conn.query('SELECT * FROM estoque_compras WHERE id = ?', [id]);
  const [lotes] = await conn.query('SELECT * FROM estoque_lotes WHERE compra_id = ? ORDER BY id', [id]);
  return { compra, lotes };
};

/* ── Retirada: material passa a ficar com o técnico (continua sendo estoque dele) ── */
export const retirar = ({ lote_id, codigo, tecnico_id, quantidade, observacao }, userId, db) =>
  withTx(async (conn) => {
    const q = parseQtd(quantidade);
    await getTecnicoAtivo(conn, tecnico_id);
    const lote = await lockLote(conn, { lote_id, codigo });
    const almox = r2(lote.saldo_atual - (await somaPosse(conn, lote.id)));
    if (q > almox) throw new ServiceError(400, `Quantidade maior que o disponível no almoxarifado (${almox})`);
    await addPosse(conn, lote.id, tecnico_id, q);
    const id = await registrar(conn, {
      tipo: 'retirada', lote_id: lote.id, item_id: lote.item_id, quantidade: q,
      tecnico_id, observacao, criado_por: userId,
    });
    return { movimentacao_id: id, lote_codigo: lote.codigo, quantidade: q };
  }, db);

/* ── Devolução: sai da posse do técnico e volta ao almoxarifado ── */
export const devolver = ({ lote_id, codigo, tecnico_id, quantidade, condicao, observacao }, userId, db) =>
  withTx(async (conn) => {
    const q = parseQtd(quantidade);
    if (!['novo', 'usado'].includes(condicao)) throw new ServiceError(400, 'Informe a condição: novo ou usado');
    const lote = await lockLote(conn, { lote_id, codigo });
    const posse = await getPosse(conn, lote.id, tecnico_id);
    if (q > posse) throw new ServiceError(400, `O técnico possui apenas ${posse} deste lote`);
    await addPosse(conn, lote.id, tecnico_id, -q);
    const id = await registrar(conn, {
      tipo: 'devolucao', lote_id: lote.id, item_id: lote.item_id, quantidade: q,
      tecnico_id, condicao, observacao, criado_por: userId,
    });
    return { movimentacao_id: id, lote_codigo: lote.codigo, quantidade: q };
  }, db);

/* ── OS ── */
const lockOS = async (conn, os_id) => {
  const [rows] = await conn.query('SELECT * FROM ordens_servico WHERE id = ? FOR UPDATE', [os_id]);
  if (!rows.length) throw new ServiceError(404, 'OS não encontrada');
  return rows[0];
};

// actor: { id, role, tecnicoId } — técnico só mexe nas OS dele
export const assertAcessoOS = (os, actor) => {
  if (actor.role === 'tecnico' && os.tecnico_id !== actor.tecnicoId) {
    throw new ServiceError(403, 'Esta OS não está atribuída a você');
  }
};

const mudarStatus = async (conn, os, para, userId) => {
  await conn.query('UPDATE ordens_servico SET status = ?, concluida_em = ? WHERE id = ?',
    [para, para === 'concluida' ? new Date() : null, os.id]);
  await conn.query('INSERT INTO os_historico_status (os_id, de, para, usuario_id) VALUES (?,?,?,?)',
    [os.id, os.status, para, userId]);
};

export const baixarEmOS = ({ os_id, lote_id, codigo, quantidade, observacao }, actor, db) =>
  withTx(async (conn) => {
    const q = parseQtd(quantidade);
    const os = await lockOS(conn, os_id);
    assertAcessoOS(os, actor);
    if (!['aberta', 'em_andamento'].includes(os.status)) {
      throw new ServiceError(409, 'OS encerrada: não aceita novos materiais (use estorno para corrigir)');
    }
    const lote = await lockLote(conn, { lote_id, codigo });
    const posse = await getPosse(conn, lote.id, os.tecnico_id);
    if (posse <= 0) throw new ServiceError(400, 'Este lote não está em posse do técnico/equipe da OS');
    if (q > posse) throw new ServiceError(400, `Quantidade maior que a posse do técnico neste lote (${posse})`);

    await addPosse(conn, lote.id, os.tecnico_id, -q);
    const novoSaldo = r2(lote.saldo_atual - q);
    await conn.query('UPDATE estoque_lotes SET saldo_atual = ?, status = ? WHERE id = ?',
      [novoSaldo, novoSaldo === 0 ? 'esgotado' : 'ativo', lote.id]);
    const id = await registrar(conn, {
      tipo: 'baixa_os', lote_id: lote.id, item_id: lote.item_id, quantidade: q,
      tecnico_id: os.tecnico_id, os_id: os.id, observacao, criado_por: actor.id,
    });
    if (os.status === 'aberta') await mudarStatus(conn, os, 'em_andamento', actor.id);
    return { movimentacao_id: id, lote_codigo: lote.codigo, quantidade: q, saldo_lote: novoSaldo };
  }, db);

export const fecharOS = ({ os_id }, actor, db) => withTx(async (conn) => {
  const os = await lockOS(conn, os_id);
  assertAcessoOS(os, actor);
  if (os.status === 'concluida') return { status: 'concluida', repetida: true };
  if (os.status === 'cancelada') throw new ServiceError(409, 'OS cancelada não pode ser fechada');
  await mudarStatus(conn, os, 'concluida', actor.id);
  return { status: 'concluida' };
}, db);

/* ── Estorno de baixa (somente estoque/admin — validado na rota) ── */
export const estornarBaixa = ({ movimentacao_id, motivo }, userId, db) => withTx(async (conn) => {
  if (!motivo || !String(motivo).trim()) throw new ServiceError(400, 'Informe o motivo do estorno');
  const [[mov]] = await conn.query('SELECT * FROM estoque_movimentacoes WHERE id = ?', [movimentacao_id]);
  if (!mov || mov.tipo !== 'baixa_os') throw new ServiceError(404, 'Baixa não encontrada');
  await lockOS(conn, mov.os_id);
  const lote = await lockLote(conn, { lote_id: mov.lote_id });
  const [[ja]] = await conn.query('SELECT id FROM estoque_movimentacoes WHERE estorno_de_id = ?', [mov.id]);
  if (ja) throw new ServiceError(409, 'Esta baixa já foi estornada');

  const q = r2(mov.quantidade);
  await conn.query('UPDATE estoque_lotes SET saldo_atual = ?, status = ? WHERE id = ?',
    [r2(Number(lote.saldo_atual) + q), 'ativo', lote.id]);
  await addPosse(conn, lote.id, mov.tecnico_id, q); // volta para a posse de quem consumiu
  const id = await registrar(conn, {
    tipo: 'estorno', lote_id: lote.id, item_id: lote.item_id, quantidade: q,
    tecnico_id: mov.tecnico_id, os_id: mov.os_id, estorno_de_id: mov.id,
    observacao: String(motivo).trim().slice(0, 500), criado_por: userId,
  });
  return { movimentacao_id: id, quantidade: q };
}, db);

/* ── Consultas derivadas ── */
export const statusItem = (saldo, minimo) => {
  saldo = Number(saldo); minimo = Number(minimo);
  if (saldo <= 0) return 'ZERADO';
  if (saldo < minimo) return 'BAIXO';
  return 'OK';
};

/* ── Criação / cancelamento de OS ── */
export const criarOS = (dados, userId, db) => withTx(async (conn) => {
  if (!dados.cliente || !String(dados.cliente).trim()) throw new ServiceError(400, 'Informe o cliente');
  if (!['baixa', 'normal', 'alta'].includes(dados.prioridade || 'normal')) throw new ServiceError(400, 'Prioridade inválida');
  const tec = await getTecnicoAtivo(conn, dados.tecnico_id);
  const numero = await nextSequence(conn, 'os', 1);
  const [res] = await conn.query(
    `INSERT INTO ordens_servico (numero, cliente, endereco, tipo_execucao, tecnico_id, prazo, prioridade, descricao, criado_por)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [numero, String(dados.cliente).trim(), dados.endereco || null, tec.tipo, tec.id, dados.prazo || null,
     dados.prioridade || 'normal', dados.descricao || null, userId]);
  await conn.query('INSERT INTO os_historico_status (os_id, de, para, usuario_id) VALUES (?,?,?,?)',
    [res.insertId, null, 'aberta', userId]);
  return { id: res.insertId, numero };
}, db);

export const cancelarOS = ({ os_id }, userId, db) => withTx(async (conn) => {
  const os = await lockOS(conn, os_id);
  if (['concluida', 'cancelada'].includes(os.status)) throw new ServiceError(409, 'Esta OS não pode mais ser cancelada');
  const [[{ n }]] = await conn.query(
    `SELECT COUNT(*) n FROM estoque_movimentacoes m WHERE m.os_id = ? AND m.tipo = 'baixa_os'
     AND NOT EXISTS (SELECT 1 FROM estoque_movimentacoes e WHERE e.estorno_de_id = m.id)`, [os.id]);
  if (n > 0) throw new ServiceError(409, 'A OS tem materiais baixados: estorne-os antes de cancelar');
  await mudarStatus(conn, os, 'cancelada', userId);
  return { status: 'cancelada' };
}, db);
