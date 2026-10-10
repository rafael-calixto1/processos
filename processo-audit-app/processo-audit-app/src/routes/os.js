import express from 'express';
import pool from '../config/database.js';
import { verifyToken, checkRole } from '../middlewares/auth.js';
import { loadTecnico, handle } from '../middlewares/estoqueAccess.js';
import multer from 'multer-v2';
import * as svc from '../services/estoqueService.js';
import * as fotos from '../services/fotosService.js';
import { finalizarNaTx, carregarFechamento } from '../services/fechamentoService.js';
import { executarIdempotente, hashDe } from '../services/idempotencia.js';
import { REGRAS_FECHAMENTO } from '../config/regrasFechamento.js';

const router = express.Router();
router.use(verifyToken, loadTecnico, checkRole(['admin', 'estoque', 'tecnico']));

const staff = checkRole(['admin', 'estoque']);
const actorOf = (req) => ({ id: req.userId, role: req.userRole, tecnicoId: req.tecnicoId });

const carregarOS = async (req) => {
  const [[os]] = await pool.query(
    `SELECT o.*, t.nome AS tecnico_nome, t.empresa AS tecnico_empresa, u.name AS criado_por_nome
     FROM ordens_servico o JOIN tecnicos t ON t.id = o.tecnico_id LEFT JOIN users u ON u.id = o.criado_por
     WHERE o.id = ?`, [req.params.id]);
  if (!os) throw new svc.ServiceError(404, 'OS não encontrada');
  svc.assertAcessoOS(os, actorOf(req));
  return os;
};

router.get('/', handle(async (req, res) => {
  const where = [];
  const params = [];
  if (req.userRole === 'tecnico') {
    if (!req.tecnicoId) throw new svc.ServiceError(403, 'Seu usuário não está vinculado a um técnico');
    where.push('o.tecnico_id = ?'); params.push(req.tecnicoId);
  } else if (req.query.tecnico_id) { where.push('o.tecnico_id = ?'); params.push(req.query.tecnico_id); }
  if (req.query.status) { where.push('o.status = ?'); params.push(req.query.status); }
  if (req.query.atualizado_desde) {
    // (colunas da migração do app só entram na consulta neste modo: a lista usada pelo web não depende da migração)
    // `>=` de propósito: o app reenvia o último instante visto e deduplica por id (a coluna tem precisão de segundos)
    const desde = new Date(req.query.atualizado_desde);
    if (Number.isNaN(desde.getTime())) throw new svc.ServiceError(400, 'atualizado_desde inválido: use uma data ISO');
    where.push('o.atualizado_em >= ?'); params.push(desde);
  }
  const [rows] = await pool.query(
    `SELECT o.id, o.numero, o.cliente, o.endereco, o.tipo_execucao, o.prazo, o.prioridade, o.status, o.criado_em,${req.query.atualizado_desde ? ' o.atualizado_em, o.iniciado_em,' : ''}
       o.tipo_servico, o.bairro, o.cidade, o.latitude, o.longitude, o.pop_nome, o.rota_id, o.poste_id,
       t.nome AS tecnico_nome,
       EXISTS(SELECT 1 FROM os_rascunhos r WHERE r.os_id = o.id) AS tem_rascunho
     FROM ordens_servico o JOIN tecnicos t ON t.id = o.tecnico_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY o.id DESC LIMIT 300`, params);
  res.json(rows);
}));

router.post('/', staff, handle(async (req, res) => {
  res.status(201).json(await svc.criarOS(req.body, req.userId));
}));

// tipos de serviço (lista editável pelo staff)
router.get('/tipos-servico', handle(async (req, res) => {
  const [rows] = await pool.query('SELECT id, nome FROM os_tipos_servico ORDER BY nome');
  res.json(rows);
}));
router.post('/tipos-servico', staff, handle(async (req, res) => {
  const nome = String(req.body.nome || '').trim().replace(/\s+/g, ' ');
  if (nome.length < 2 || nome.length > 60) throw new svc.ServiceError(400, 'Informe um nome de 2 a 60 caracteres');
  await pool.query('INSERT IGNORE INTO os_tipos_servico (nome) VALUES (?)', [nome]);
  const [[row]] = await pool.query('SELECT id, nome FROM os_tipos_servico WHERE nome = ?', [nome]);
  res.status(201).json(row);
}));

// sugestões de serviços já lançados (autocompletar)
router.get('/servicos/sugestoes', handle(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT descricao, COUNT(*) AS n FROM os_servicos GROUP BY descricao ORDER BY n DESC, descricao LIMIT 40');
  res.json(rows.map((r) => r.descricao));
}));

router.get('/:id', handle(async (req, res) => {
  const os = await carregarOS(req);
  const [materiaisRaw] = await pool.query(
    `SELECT m.id, m.servico_id, m.quantidade, m.criado_em, m.observacao, l.codigo AS lote_codigo, i.nome AS item_nome, i.unidade,
       u.name AS usuario_nome,
       (SELECT COALESCE(SUM(e.quantidade), 0) FROM estoque_movimentacoes e WHERE e.estorno_de_id = m.id) AS estornado_qtd
     FROM estoque_movimentacoes m JOIN estoque_lotes l ON l.id = m.lote_id JOIN estoque_itens i ON i.id = m.item_id
     LEFT JOIN users u ON u.id = m.criado_por
     WHERE m.os_id = ? AND m.tipo = 'baixa_os' ORDER BY m.id`, [os.id]);
  // estorno parcial: `quantidade` passa a ser o saldo ainda baixado; estorno_id só marca baixa totalmente estornada
  const materiais = materiaisRaw.map(({ estornado_qtd, ...m }) => {
    const original = Number(m.quantidade), estornado = Number(estornado_qtd), restante = Math.round((original - estornado) * 100) / 100;
    const total = restante <= 0;
    return { ...m, quantidade: total ? original : restante, quantidade_original: original, estornado_qtd: estornado, estorno_id: total ? 1 : null };
  });
  const [historico] = await pool.query(
    `SELECT h.*, u.name AS usuario_nome FROM os_historico_status h LEFT JOIN users u ON u.id = h.usuario_id
     WHERE h.os_id = ? ORDER BY h.id`, [os.id]);
  const [servicos] = await pool.query(
    `SELECT sv.id, sv.descricao, sv.trecho, sv.rota_trecho, sv.quantidade, sv.criado_em, u.name AS usuario_nome
     FROM os_servicos sv LEFT JOIN users u ON u.id = sv.criado_por WHERE sv.os_id = ? ORDER BY sv.id`, [os.id]);
  const totais = { metros: 0, pecas: 0 };
  for (const m of materiais) if (!m.estorno_id) totais[m.unidade === 'metros' ? 'metros' : 'pecas'] += Number(m.quantidade);
  const fechamento = await carregarFechamento(os.id); // { fechamento, fotos, materiais_retirados } (vazios se não houver)
  res.json({ ...os, materiais, servicos: servicos.map((x) => ({ ...x, quantidade: Number(x.quantidade), rota_trecho: x.rota_trecho ? JSON.parse(x.rota_trecho) : null })), historico, totais, ...fechamento });
}));

router.put('/:id', staff, handle(async (req, res) => {
  const os = await carregarOS(req);
  if (['concluida', 'cancelada'].includes(os.status)) throw new svc.ServiceError(409, 'OS encerrada é somente leitura');
  const b = req.body;
  if (!b.cliente || !String(b.cliente).trim()) throw new svc.ServiceError(400, 'Informe o cliente');
  let numero = os.numero;
  if (b.numero !== undefined && Number(b.numero) !== os.numero) {
    if (req.userRole !== 'admin') throw new svc.ServiceError(403, 'Somente o administrador altera o número da OS');
    numero = Number(b.numero);
    if (!Number.isInteger(numero) || numero <= 0) throw new svc.ServiceError(400, 'Número inválido');
  }
  await pool.query(
    `UPDATE ordens_servico SET numero=?, cliente=?, endereco=?, prazo=?, prioridade=?, descricao=?,
       tipo_servico=?, cep=?, logradouro=?, numero_endereco=?, complemento=?, bairro=?, cidade=?, uf=?, latitude=?, longitude=?, pop_nome=?, rota_id=?, poste_id=? WHERE id=?`,
    [numero, b.cliente.trim(), b.endereco || null, b.prazo || null, b.prioridade || os.prioridade, b.descricao || null,
     ...Object.values(svc.camposInfraOS(b)), os.id]);
  res.json({ ok: true });
}));

// Operações que mexem em estoque/serviços aceitam `Idempotency-Key`: repetir a mesma chave devolve a mesma resposta
// (com `repetida: true`) sem executar de novo. Sem a chave, o comportamento é o de sempre.
const idempotente = (fn, status = 201, hash) => handle(async (req, res) => {
  req.arquivosCriados = []; // arquivos gravados em disco pela operação; apagados se ela falhar
  let r;
  try {
    r = await executarIdempotente(req, { status, hash: hash?.(req) }, (conn) => fn(conn, req));
  } catch (e) {
    await fotos.apagarArquivos(req.arquivosCriados);
    throw e;
  }
  if (r.repetida) res.set('Idempotent-Replayed', 'true');
  res.status(r.status).json(r.repetida ? { ...r.body, repetida: true } : r.body);
});
const comOS = (req) => ({ ...req.body, os_id: Number(req.params.id) });

router.post('/:id/materiais', idempotente((conn, req) => svc.baixarNaTx(conn, comOS(req), actorOf(req))));

router.post('/:id/lancamentos', idempotente((conn, req) => svc.lancarNaTx(conn, comOS(req), actorOf(req))));

router.post('/:id/servicos', idempotente((conn, req) => svc.adicionarServicoNaTx(conn, comOS(req), actorOf(req))));

// Fotos do serviço: multipart (campo "foto" + client_uuid, tirada_em, lat, lng, legenda). Ficam em diretório privado.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: REGRAS_FECHAMENTO.foto_max_bytes, files: 1, fields: 10, fieldSize: 2048 } });
const receberFoto = (req, res, next) => upload.single('foto')(req, res, (err) => {
  if (!err) return next();
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'A foto é grande demais (máximo de 8 MB)' });
  if (err instanceof multer.MulterError) return res.status(400).json({ error: 'Envio inválido: mande uma única foto no campo "foto"' });
  return next(err);
});

router.post('/:id/fotos', receberFoto, idempotente(
  (conn, req) => fotos.salvarFotoNaTx(conn, { ...req.body, os_id: Number(req.params.id), buffer: req.file?.buffer }, actorOf(req), req.arquivosCriados),
  201, (req) => hashDe(`${req.body?.client_uuid}:${hashDe(req.file?.buffer ?? '')}`)));

router.get('/:id/fotos', handle(async (req, res) => {
  const os = await carregarOS(req);
  const [rows] = await pool.query('SELECT * FROM os_fotos WHERE os_id = ? ORDER BY id', [os.id]);
  res.json(rows.map(fotos.metadados));
}));

router.get('/:id/fotos/:fotoId', handle(async (req, res) => {
  const os = await carregarOS(req);
  const [[f]] = await pool.query('SELECT * FROM os_fotos WHERE id = ? AND os_id = ?', [Number(req.params.fotoId) || 0, os.id]);
  if (!f) throw new svc.ServiceError(404, 'Foto não encontrada');
  res.set({ 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' });
  res.type(f.mime);
  res.sendFile(fotos.caminhoDaFoto(f), { dotfiles: 'allow' }, (err) => {
    if (err && !res.headersSent) res.status(err.code === 'ENOENT' ? 404 : 500).json({ error: err.code === 'ENOENT' ? 'Arquivo da foto não encontrado' : 'Erro interno do servidor' });
  });
}));

router.delete('/:id/fotos/:fotoId', handle(async (req, res) => {
  const os = await carregarOS(req);
  if (['concluida', 'cancelada'].includes(os.status)) throw new svc.ServiceError(409, 'OS encerrada é somente leitura');
  const [[f]] = await pool.query('SELECT * FROM os_fotos WHERE id = ? AND os_id = ?', [Number(req.params.fotoId) || 0, os.id]);
  if (!f) throw new svc.ServiceError(404, 'Foto não encontrada');
  await pool.query('DELETE FROM os_fotos WHERE id = ?', [f.id]);
  await fotos.apagarArquivos([fotos.caminhoDaFoto(f)]);
  res.json({ ok: true });
}));

// Finalização completa pelo app: valida tudo no servidor e grava fechamento + retirados, apaga o rascunho e encerra a OS
router.post('/:id/finalizar', idempotente((conn, req) => finalizarNaTx(conn, comOS(req), actorOf(req))));

// "Iniciar execução" do app: registra o início (horário do aparelho) e põe a OS em andamento
router.post('/:id/iniciar', idempotente((conn, req) => svc.iniciarNaTx(conn, comOS(req), actorOf(req)), 200));

router.delete('/:id/servicos/:servicoId', handle(async (req, res) => {
  res.json(await svc.removerServico({ os_id: Number(req.params.id), servico_id: Number(req.params.servicoId) }, actorOf(req)));
}));

router.post('/:id/fechar', handle(async (req, res) => {
  const r = await svc.fecharOS({ os_id: Number(req.params.id) }, actorOf(req));
  await pool.query('DELETE FROM os_rascunhos WHERE os_id = ?', [Number(req.params.id)]);
  res.json(r);
}));

// Rascunho da finalização em campo (progresso salvo no banco)
router.get('/:id/rascunho', handle(async (req, res) => {
  const os = await carregarOS(req);
  const [[r]] = await pool.query('SELECT dados FROM os_rascunhos WHERE os_id = ?', [os.id]);
  res.json({ rascunho: r ? JSON.parse(r.dados) : null });
}));

router.put('/:id/rascunho', handle(async (req, res) => {
  const os = await carregarOS(req);
  if (['concluida', 'cancelada'].includes(os.status)) throw new svc.ServiceError(409, 'OS encerrada é somente leitura');
  if (!req.body || typeof req.body.rascunho !== 'object' || req.body.rascunho === null) throw new svc.ServiceError(400, 'Rascunho inválido');
  await pool.query(
    `INSERT INTO os_rascunhos (os_id, dados, atualizado_por) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE dados = VALUES(dados), atualizado_por = VALUES(atualizado_por)`,
    [os.id, JSON.stringify(req.body.rascunho), req.userId]);
  res.json({ ok: true });
}));

router.post('/:id/cancelar', staff, handle(async (req, res) => {
  res.json(await svc.cancelarOS({ os_id: Number(req.params.id) }, req.userId));
}));

router.post('/:id/estornos', staff, handle(async (req, res) => {
  const [[mov]] = await pool.query('SELECT os_id FROM estoque_movimentacoes WHERE id = ?', [req.body.movimentacao_id]);
  if (!mov || mov.os_id !== Number(req.params.id)) throw new svc.ServiceError(404, 'Baixa não encontrada nesta OS');
  res.status(201).json(await svc.estornarBaixa(req.body, req.userId));
}));

export default router;
