import express from 'express';
import pool from '../config/database.js';
import { verifyToken, checkRole } from '../middlewares/auth.js';
import { loadTecnico, handle } from '../middlewares/estoqueAccess.js';
import { ServiceError } from '../services/estoqueService.js';
import { auditarOS } from '../services/os/auditoria.js';

/**
 * Administração dos catálogos da finalização de OS pelo app (só admin): motivos de fechamento e itens do checklist.
 * Nada é apagado (os fechamentos já feitos referenciam o motivo): item que não serve mais é DESATIVADO e some do app na
 * próxima sincronização. O `codigo` é a chave que o app e o histórico usam: depois de criado não muda. Os rótulos do histórico
 * ficam copiados em cada fechamento, então editar um rótulo não reescreve o passado.
 */
const router = express.Router();
router.use(verifyToken, loadTecnico, checkRole(['admin']));
router.use(auditarOS('catalogos'));

const CODIGO_VALIDO = /^[A-Za-z][A-Za-z0-9_]{1,59}$/;

/** "Rota lançada com sucesso" → "rota_lancada_com_sucesso" */
export const codigoDoRotulo = (rotulo) => String(rotulo).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);

const texto = (v) => (v === undefined || v === null ? '' : String(v).trim());
const exigirRotulo = (v, max) => {
  const r = texto(v);
  if (r.length < 3) throw new ServiceError(400, 'Informe o nome (mínimo de 3 caracteres)');
  if (r.length > max) throw new ServiceError(400, `O nome pode ter no máximo ${max} caracteres`);
  return r;
};
const lerOrdem = (v) => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 100000) throw new ServiceError(400, 'A ordem deve ser um número inteiro de 0 a 100000');
  return n;
};
const lerBooleano = (v, nome) => {
  if (v === undefined) return undefined;
  if (v === true || v === 1 || v === '1') return 1;
  if (v === false || v === 0 || v === '0') return 0;
  throw new ServiceError(400, `"${nome}" deve ser verdadeiro ou falso`);
};
const lerCodigo = async (tabela, informado, rotulo) => {
  const c = texto(informado) || codigoDoRotulo(rotulo);
  if (!CODIGO_VALIDO.test(c)) throw new ServiceError(400, 'O código deve começar com letra e ter só letras, números e _ (2 a 60 caracteres)');
  const [[existe]] = await pool.query(`SELECT id FROM ${tabela} WHERE codigo = ?`, [c]);
  if (existe) throw new ServiceError(409, `Já existe um item com o código "${c}". Use outro nome ou informe um código diferente.`);
  return c;
};
const proximaOrdem = async (tabela) => (await pool.query(`SELECT COALESCE(MAX(ordem), 0) + 1 AS n FROM ${tabela}`))[0][0].n;
const aplicar = async (tabela, id, campos) => {
  const entradas = Object.entries(campos).filter(([, v]) => v !== undefined);
  if (!entradas.length) throw new ServiceError(400, 'Nada para alterar');
  const [r] = await pool.query(`UPDATE ${tabela} SET ${entradas.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`, [...entradas.map(([, v]) => v), id]);
  if (!r.affectedRows) throw new ServiceError(404, 'Item não encontrado');
};

/* ───── Motivos de fechamento ───── */
const MOTIVOS_SQL = `SELECT m.id, m.codigo, m.rotulo, m.ordem, m.ativo, (SELECT COUNT(*) FROM os_fechamentos f WHERE f.motivo_id = m.id) AS usos FROM os_motivos_fechamento m`;
const motivo = (m) => ({ ...m, ativo: Boolean(m.ativo), usos: Number(m.usos) });

router.get('/motivos', handle(async (req, res) => {
  const [rows] = await pool.query(`${MOTIVOS_SQL} ORDER BY m.ativo DESC, m.ordem, m.id`);
  res.json(rows.map(motivo));
}));

router.post('/motivos', handle(async (req, res) => {
  const rotulo = exigirRotulo(req.body?.rotulo, 160);
  const codigo = await lerCodigo('os_motivos_fechamento', req.body?.codigo, rotulo);
  const ordem = lerOrdem(req.body?.ordem) ?? (await proximaOrdem('os_motivos_fechamento'));
  const [r] = await pool.query('INSERT INTO os_motivos_fechamento (codigo, rotulo, ordem) VALUES (?,?,?)', [codigo, rotulo, ordem]);
  res.status(201).json(motivo((await pool.query(`${MOTIVOS_SQL} WHERE m.id = ?`, [r.insertId]))[0][0]));
}));

router.put('/motivos/:id', handle(async (req, res) => {
  const id = Number(req.params.id);
  const [[atual]] = await pool.query('SELECT id, ativo FROM os_motivos_fechamento WHERE id = ?', [id]);
  if (!atual) throw new ServiceError(404, 'Motivo não encontrado');
  if (req.body?.codigo !== undefined) throw new ServiceError(400, 'O código não pode ser alterado depois de criado');
  const ativo = lerBooleano(req.body?.ativo, 'ativo');
  if (ativo === 0 && atual.ativo) {
    const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM os_motivos_fechamento WHERE ativo = 1 AND id <> ?', [id]);
    if (n === 0) throw new ServiceError(409, 'Mantenha ao menos um motivo ativo: sem motivo os técnicos não conseguem finalizar OS');
  }
  await aplicar('os_motivos_fechamento', id, { rotulo: req.body?.rotulo === undefined ? undefined : exigirRotulo(req.body.rotulo, 160), ordem: lerOrdem(req.body?.ordem), ativo });
  res.json(motivo((await pool.query(`${MOTIVOS_SQL} WHERE m.id = ?`, [id]))[0][0]));
}));

/* ───── Itens do checklist ───── */
const CHECKLIST_SQL = 'SELECT id, codigo, rotulo, tipo, unidade, obrigatorio, ordem, ativo FROM os_checklist_itens';
const item = (c) => ({ ...c, obrigatorio: Boolean(c.obrigatorio), ativo: Boolean(c.ativo) });
const lerUnidade = (v, tipo) => {
  const u = texto(v);
  if (!u) return null;
  if (tipo !== 'number') throw new ServiceError(400, 'A unidade só vale para itens do tipo número');
  if (u.length > 10) throw new ServiceError(400, 'A unidade pode ter no máximo 10 caracteres');
  return u;
};

router.get('/checklist', handle(async (req, res) => {
  const [rows] = await pool.query(`${CHECKLIST_SQL} ORDER BY ativo DESC, ordem, id`);
  res.json(rows.map(item));
}));

router.post('/checklist', handle(async (req, res) => {
  const rotulo = exigirRotulo(req.body?.rotulo, 255);
  const tipo = texto(req.body?.tipo);
  if (!['boolean', 'number', 'text'].includes(tipo)) throw new ServiceError(400, 'Escolha o tipo de resposta: sim/não, número ou texto');
  const codigo = await lerCodigo('os_checklist_itens', req.body?.codigo, rotulo);
  const unidade = lerUnidade(req.body?.unidade, tipo);
  const obrigatorio = lerBooleano(req.body?.obrigatorio, 'obrigatorio') ?? 0;
  const ordem = lerOrdem(req.body?.ordem) ?? (await proximaOrdem('os_checklist_itens'));
  const [r] = await pool.query('INSERT INTO os_checklist_itens (codigo, rotulo, tipo, unidade, obrigatorio, ordem) VALUES (?,?,?,?,?,?)', [codigo, rotulo, tipo, unidade, obrigatorio, ordem]);
  res.status(201).json(item((await pool.query(`${CHECKLIST_SQL} WHERE id = ?`, [r.insertId]))[0][0]));
}));

router.put('/checklist/:id', handle(async (req, res) => {
  const id = Number(req.params.id);
  const [[atual]] = await pool.query('SELECT id, tipo FROM os_checklist_itens WHERE id = ?', [id]);
  if (!atual) throw new ServiceError(404, 'Item não encontrado');
  if (req.body?.codigo !== undefined) throw new ServiceError(400, 'O código não pode ser alterado depois de criado');
  if (req.body?.tipo !== undefined && req.body.tipo !== atual.tipo) throw new ServiceError(400, 'O tipo de resposta não pode ser alterado: crie um item novo e desative este');
  await aplicar('os_checklist_itens', id, {
    rotulo: req.body?.rotulo === undefined ? undefined : exigirRotulo(req.body.rotulo, 255),
    unidade: req.body?.unidade === undefined ? undefined : lerUnidade(req.body.unidade, atual.tipo),
    obrigatorio: lerBooleano(req.body?.obrigatorio, 'obrigatorio'), ordem: lerOrdem(req.body?.ordem), ativo: lerBooleano(req.body?.ativo, 'ativo'),
  });
  res.json(item((await pool.query(`${CHECKLIST_SQL} WHERE id = ?`, [id]))[0][0]));
}));

export default router;
