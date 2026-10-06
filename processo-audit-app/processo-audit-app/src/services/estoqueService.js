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

// Itens em peças não aceitam quantidade fracionada (só metros aceitam decimais)
const exigirInteiro = async (conn, item_id, q) => {
  const [[it]] = await conn.query('SELECT unidade FROM estoque_itens WHERE id = ?', [item_id]);
  if (it?.unidade === 'pecas' && !Number.isInteger(Number(q))) {
    throw new ServiceError(400, 'Este item é contado em unidades: informe um número inteiro');
  }
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
// Uma linha de compra = um item com seus volumes (lotes). Uma compra pode ter várias linhas (mesmo fornecedor/NF).
const inserirLinhaCompra = async (conn, linha, comum, userId, grupo_id, chave) => {
  const { item_id, tipo_volume } = linha;
  const { fornecedor_id, nf } = comum;
  // `medidas` (opcional): medida individual de cada lote; sem ela, todos usam medida_por_volume
  const medidas = Array.isArray(linha.medidas) ? linha.medidas.map(Number) : null;
  const qtd = medidas ? medidas.length : Number(linha.qtd_volumes);
  const medida = medidas ? medidas.reduce((a, b) => a + b, 0) / (qtd || 1) : Number(linha.medida_por_volume);
  if (medidas && medidas.some((m) => !Number.isFinite(m) || m <= 0)) throw new ServiceError(400, 'A medida de cada lote deve ser maior que zero');

  if (!TIPO_PREFIXO[tipo_volume]) throw new ServiceError(400, 'Tipo de volume inválido');
  if (!Number.isInteger(qtd) || qtd <= 0 || qtd > 500) throw new ServiceError(400, 'Número de volumes inválido (1 a 500)');
  if (!Number.isFinite(medida) || medida <= 0) throw new ServiceError(400, 'A medida por volume deve ser maior que zero');

  const [[item]] = await conn.query('SELECT id, nome, ativo, unidade FROM estoque_itens WHERE id = ?', [item_id]);
  if (!item) throw new ServiceError(404, 'Item não encontrado');
  if (item.unidade === 'pecas' && (medidas ? medidas : [medida]).some((m) => !Number.isInteger(m))) {
    throw new ServiceError(400, `${item.nome}: este item é contado em unidades, a medida de cada lote deve ser um número inteiro`);
  }
  if (!item.ativo) throw new ServiceError(400, `Item inativo: ${item.nome}`);

  const [res] = await conn.query(
    `INSERT INTO estoque_compras
       (fornecedor_id, item_id, tipo_volume, qtd_volumes, medida_por_volume, nf, chave_idempotencia, grupo_id, criado_por)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [fornecedor_id || null, item_id, tipo_volume, qtd, r2(medida), nf || null, chave || null, grupo_id, userId]
  );
  const compra_id = res.insertId;
  const medidaPadrao = medida;

  // `nomes` (opcional): nome/código escolhido para cada lote; vazio = gera o código automático
  const nomes = Array.from({ length: qtd }, (_, i) => normalizarCodigo(Array.isArray(linha.nomes) ? linha.nomes[i] : ''));
  const informados = nomes.filter(Boolean);
  if (informados.some((n) => n.length > 40)) throw new ServiceError(400, 'O nome do lote deve ter no máximo 40 caracteres');
  if (new Set(informados).size !== informados.length) throw new ServiceError(400, 'Há nomes de lote repetidos nesta entrada');
  if (informados.length) {
    const [dups] = await conn.query('SELECT codigo FROM estoque_lotes WHERE codigo IN (?)', [informados]);
    if (dups.length) throw new ServiceError(409, `Já existe lote com o nome: ${dups.map((d) => d.codigo).join(', ')}`);
  }

  const prefixo = `LOTE-${TIPO_PREFIXO[tipo_volume]}`;
  const nAuto = nomes.filter((n) => !n).length;
  const inicio = nAuto ? await nextSequence(conn, prefixo, nAuto) : 0;
  let auto = 0;
  for (let i = 0; i < qtd; i++) {
    const codigo = nomes[i] || `${prefixo}-${String(inicio + auto++).padStart(4, '0')}`;
    const medidaLote = medidas ? medidas[i] : medidaPadrao;
    const [l] = await conn.query(
      'INSERT INTO estoque_lotes (codigo, item_id, compra_id, saldo_inicial, saldo_atual) VALUES (?,?,?,?,?)',
      [codigo, item_id, compra_id, r2(medidaLote), r2(medidaLote)]
    );
    await registrar(conn, {
      tipo: 'entrada', lote_id: l.insertId, item_id, quantidade: r2(medidaLote),
      observacao: nf ? `NF ${nf}` : null, criado_por: userId,
    });
  }
  return compra_id;
};

/**
 * Cria uma compra. Aceita `itens: [{ item_id, tipo_volume, qtd_volumes, medida_por_volume, medidas?, nomes? }]`
 * (vários itens na mesma compra) ou, por compatibilidade, os campos de um único item no próprio corpo.
 * Tudo roda numa transação: se qualquer item falhar, nada é gravado.
 * Retorno: { grupo_id, linhas: [{ compra, lotes }], compra, lotes } (compra/lotes = primeira linha).
 */
export const criarCompra = (dados, userId, db) => withTx(async (conn) => {
  const { fornecedor_id, nf, chave_idempotencia } = dados;
  const linhas = Array.isArray(dados.itens) && dados.itens.length ? dados.itens : [dados];
  if (linhas.length > 50) throw new ServiceError(400, 'Máximo de 50 itens por compra');

  if (chave_idempotencia) {
    const [[prev]] = await conn.query('SELECT id, grupo_id FROM estoque_compras WHERE chave_idempotencia = ?', [chave_idempotencia]);
    if (prev) return { ...(await getGrupo(conn, prev)), repetida: true };
  }
  if (fornecedor_id) {
    const [[f]] = await conn.query('SELECT id FROM fornecedores WHERE id = ?', [fornecedor_id]);
    if (!f) throw new ServiceError(404, 'Fornecedor não encontrado');
  }

  const grupo_id = `C${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
  const ids = [];
  for (let i = 0; i < linhas.length; i++) {
    // a chave de idempotência fica na primeira linha (coluna é UNIQUE)
    ids.push(await inserirLinhaCompra(conn, linhas[i], { fornecedor_id, nf }, userId, grupo_id, i === 0 ? chave_idempotencia : null));
  }
  return getGrupo(conn, { id: ids[0], grupo_id });
}, db);

const getGrupo = async (conn, { id, grupo_id }) => {
  const [rows] = grupo_id
    ? await conn.query('SELECT id FROM estoque_compras WHERE grupo_id = ? ORDER BY id', [grupo_id])
    : [[{ id }]];
  const linhas = [];
  for (const r of rows) linhas.push(await getCompra(conn, r.id));
  return { grupo_id: grupo_id || null, linhas, ...linhas[0] };
};

const getCompra = async (conn, id) => {
  const [[compra]] = await conn.query('SELECT * FROM estoque_compras WHERE id = ?', [id]);
  const [lotes] = await conn.query('SELECT * FROM estoque_lotes WHERE compra_id = ? ORDER BY id', [id]);
  return { compra, lotes };
};

/* ── Manutenção de lotes: editar código, descartar saldo, excluir ── */
export const editarLote = ({ lote_id, codigo }, db) => withTx(async (conn) => {
  const novo = normalizarCodigo(codigo);
  if (!novo || novo.length > 40) throw new ServiceError(400, 'Código inválido (até 40 caracteres)');
  const lote = await lockLote(conn, { lote_id });
  const [[dup]] = await conn.query('SELECT id FROM estoque_lotes WHERE codigo = ? AND id <> ?', [novo, lote.id]);
  if (dup) throw new ServiceError(409, 'Já existe um lote com este código');
  await conn.query('UPDATE estoque_lotes SET codigo = ? WHERE id = ?', [novo, lote.id]);
  return { id: lote.id, codigo: novo };
}, db);

// Descarte (perda, avaria): tira do almoxarifado; o que está com técnicos não pode ser descartado aqui.
export const descartarLote = ({ lote_id, quantidade, motivo }, userId, db) => withTx(async (conn) => {
  if (!String(motivo || '').trim()) throw new ServiceError(400, 'Informe o motivo do descarte');
  const lote = await lockLote(conn, { lote_id });
  const almox = r2(lote.saldo_atual - (await somaPosse(conn, lote.id)));
  const q = quantidade === undefined || quantidade === null || quantidade === '' ? almox : parseQtd(quantidade);
  if (q <= 0) throw new ServiceError(400, 'Não há saldo no almoxarifado para descartar');
  await exigirInteiro(conn, lote.item_id, q);
  if (q > almox) throw new ServiceError(400, `Quantidade maior que o disponível no almoxarifado (${almox})`);
  const novoSaldo = r2(lote.saldo_atual - q);
  await conn.query('UPDATE estoque_lotes SET saldo_atual = ?, status = ? WHERE id = ?',
    [novoSaldo, novoSaldo === 0 ? 'esgotado' : 'ativo', lote.id]);
  await registrar(conn, {
    tipo: 'ajuste', lote_id: lote.id, item_id: lote.item_id, quantidade: q,
    observacao: `DESCARTE: ${String(motivo).trim()}`.slice(0, 500), criado_por: userId,
  });
  return { lote_codigo: lote.codigo, descartado: q, saldo_atual: novoSaldo };
}, db);

// Exclusão só para lote sem uso (cadastrado por engano): apenas a movimentação de entrada, nada com técnicos.
export const excluirLote = ({ lote_id }, db) => withTx(async (conn) => {
  const lote = await lockLote(conn, { lote_id });
  const [movs] = await conn.query('SELECT id, tipo FROM estoque_movimentacoes WHERE lote_id = ?', [lote.id]);
  const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM estoque_posse WHERE lote_id = ? AND quantidade > 0', [lote.id]);
  if (n > 0 || movs.some((m) => m.tipo !== 'entrada') || movs.length > 1 || Number(lote.saldo_atual) !== Number(lote.saldo_inicial)) {
    throw new ServiceError(409, 'Este lote já foi movimentado e não pode ser excluído. Use "Descartar".');
  }
  await conn.query('DELETE FROM estoque_posse WHERE lote_id = ?', [lote.id]);
  await conn.query('DELETE FROM estoque_movimentacoes WHERE lote_id = ?', [lote.id]);
  await conn.query('DELETE FROM estoque_lotes WHERE id = ?', [lote.id]);
  return { ok: true };
}, db);

/* ── Retirada: material passa a ficar com o técnico (continua sendo estoque dele) ── */
export const retirar = ({ lote_id, codigo, tecnico_id, quantidade, observacao }, userId, db) =>
  withTx(async (conn) => {
    const q = parseQtd(quantidade);
    await getTecnicoAtivo(conn, tecnico_id);
    const lote = await lockLote(conn, { lote_id, codigo });
    await exigirInteiro(conn, lote.item_id, q);
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
    await exigirInteiro(conn, lote.item_id, q);
    const posse = await getPosse(conn, lote.id, tecnico_id);
    if (q > posse) throw new ServiceError(400, `O técnico possui apenas ${posse} deste lote`);
    await addPosse(conn, lote.id, tecnico_id, -q);
    const id = await registrar(conn, {
      tipo: 'devolucao', lote_id: lote.id, item_id: lote.item_id, quantidade: q,
      tecnico_id, condicao, observacao, criado_por: userId,
    });
    return { movimentacao_id: id, lote_codigo: lote.codigo, quantidade: q };
  }, db);

/* ── Aprovação de devoluções: o técnico solicita, admin/estoque aprova ou nega ── */
const pendenteDe = async (conn, lote_id, tecnico_id) => {
  const [[{ total }]] = await conn.query(
    "SELECT COALESCE(SUM(quantidade),0) AS total FROM estoque_devolucoes WHERE lote_id = ? AND tecnico_id = ? AND status = 'pendente'",
    [lote_id, tecnico_id]
  );
  return r2(total);
};

export const solicitarDevolucao = ({ lote_id, codigo, tecnico_id, quantidade, condicao, observacao }, userId, db) =>
  withTx(async (conn) => {
    const q = parseQtd(quantidade);
    if (!['novo', 'usado'].includes(condicao)) throw new ServiceError(400, 'Informe a condição: novo ou usado');
    const lote = await lockLote(conn, { lote_id, codigo });
    await exigirInteiro(conn, lote.item_id, q);
    const posse = await getPosse(conn, lote.id, tecnico_id);
    const pendente = await pendenteDe(conn, lote.id, tecnico_id);
    const livre = r2(posse - pendente);
    if (q > livre) {
      throw new ServiceError(400, pendente > 0
        ? `Você já tem ${pendente} deste lote aguardando aprovação; disponível para devolver: ${Math.max(livre, 0)}`
        : `Você possui apenas ${posse} deste lote`);
    }
    const [res] = await conn.query(
      `INSERT INTO estoque_devolucoes (lote_id, item_id, tecnico_id, quantidade, condicao, observacao, solicitado_por)
       VALUES (?,?,?,?,?,?,?)`,
      [lote.id, lote.item_id, tecnico_id, q, condicao, observacao || null, userId]
    );
    return { solicitacao_id: res.insertId, lote_codigo: lote.codigo, quantidade: q, status: 'pendente' };
  }, db);

const lockDevolucaoPendente = async (conn, id) => {
  const [rows] = await conn.query('SELECT * FROM estoque_devolucoes WHERE id = ? FOR UPDATE', [id]);
  if (!rows.length) throw new ServiceError(404, 'Solicitação não encontrada');
  if (rows[0].status !== 'pendente') throw new ServiceError(409, `Esta solicitação já foi ${rows[0].status === 'aprovada' ? 'aprovada' : 'negada'}`);
  return rows[0];
};

// condicao: o revisor pode corrigir a condição informada pelo técnico ao aprovar
export const aprovarDevolucao = ({ id, condicao }, userId, db) =>
  withTx(async (conn) => {
    const d = await lockDevolucaoPendente(conn, id);
    const cond = condicao && ['novo', 'usado'].includes(condicao) ? condicao : d.condicao;
    const lote = await lockLote(conn, { lote_id: d.lote_id });
    const posse = await getPosse(conn, lote.id, d.tecnico_id);
    const q = r2(d.quantidade);
    if (q > posse) throw new ServiceError(409, `O técnico possui apenas ${posse} deste lote; negue a solicitação ou ajuste a posse`);
    await addPosse(conn, lote.id, d.tecnico_id, -q);
    const movId = await registrar(conn, {
      tipo: 'devolucao', lote_id: lote.id, item_id: lote.item_id, quantidade: q,
      tecnico_id: d.tecnico_id, condicao: cond, observacao: d.observacao, criado_por: userId,
    });
    await conn.query(
      "UPDATE estoque_devolucoes SET status = 'aprovada', condicao = ?, revisado_por = ?, revisado_em = NOW(), movimentacao_id = ? WHERE id = ?",
      [cond, userId, movId, d.id]
    );
    return { id: d.id, status: 'aprovada', movimentacao_id: movId };
  }, db);

export const negarDevolucao = ({ id, motivo }, userId, db) =>
  withTx(async (conn) => {
    const d = await lockDevolucaoPendente(conn, id);
    await conn.query(
      "UPDATE estoque_devolucoes SET status = 'negada', revisado_por = ?, revisado_em = NOW(), motivo_negacao = ? WHERE id = ?",
      [userId, motivo ? String(motivo).trim().slice(0, 500) : null, d.id]
    );
    return { id: d.id, status: 'negada' };
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
    await exigirInteiro(conn, lote.item_id, q);
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

/* ── Serviços realizados na OS (mão de obra/atividades; não mexem em estoque) ── */
const assertOSAberta = (os) => {
  if (!['aberta', 'em_andamento'].includes(os.status)) throw new ServiceError(409, 'OS encerrada: não aceita novos serviços');
};

export const adicionarServico = ({ os_id, descricao, quantidade }, actor, db) =>
  withTx(async (conn) => {
    const desc = String(descricao || '').trim();
    if (!desc) throw new ServiceError(400, 'Informe o serviço realizado');
    const q = quantidade === undefined || quantidade === '' ? 1 : parseQtd(quantidade);
    const os = await lockOS(conn, os_id);
    assertAcessoOS(os, actor);
    assertOSAberta(os);
    const [res] = await conn.query(
      'INSERT INTO os_servicos (os_id, descricao, quantidade, criado_por) VALUES (?,?,?,?)',
      [os.id, desc.slice(0, 255), q, actor.id]
    );
    if (os.status === 'aberta') await mudarStatus(conn, os, 'em_andamento', actor.id);
    return { id: res.insertId, descricao: desc, quantidade: q };
  }, db);

export const removerServico = ({ os_id, servico_id }, actor, db) =>
  withTx(async (conn) => {
    const os = await lockOS(conn, os_id);
    assertAcessoOS(os, actor);
    assertOSAberta(os);
    const [res] = await conn.query('DELETE FROM os_servicos WHERE id = ? AND os_id = ?', [servico_id, os.id]);
    if (!res.affectedRows) throw new ServiceError(404, 'Serviço não encontrado nesta OS');
    return { ok: true };
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
