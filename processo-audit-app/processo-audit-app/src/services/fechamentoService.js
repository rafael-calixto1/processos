import pool from '../config/database.js';
import { REGRAS_FECHAMENTO as R } from '../config/regrasFechamento.js';
import { ServiceError, assertAcessoOS, fecharNaTx, lockOS } from './estoqueService.js';
import { metadados, quando, uuidValido } from './fotosService.js';

/**
 * Finalização da OS pelo app: grava descrição, motivo, local, checklist, retirados, participantes e o vínculo com as
 * fotos já enviadas, encerra a OS e apaga o rascunho, tudo numa transação. O servidor revalida todas as regras
 * (o app só as espelha) e devolve TODOS os problemas de uma vez.
 */
const ORIGENS_LOCAL = ['gps', 'address', 'pole_reference'];
const r2 = (n) => Math.round(Number(n) * 100) / 100;
const texto = (v) => (typeof v === 'string' ? v.trim() : '');
const numero = (v) => (v === '' || v === null || v === undefined || typeof v === 'boolean' ? NaN : Number(String(v).replace(',', '.')));
const inteiroPositivo = (v) => Number.isInteger(Number(v)) && Number(v) > 0;

// Contas de uso do estoque que contam como "material usado" (baixa ainda não totalmente estornada)
const SQL_BAIXAS_ATIVAS = `SELECT COUNT(*) AS n FROM estoque_movimentacoes m WHERE m.os_id = ? AND m.tipo = 'baixa_os'
  AND m.quantidade > (SELECT COALESCE(SUM(e.quantidade), 0) FROM estoque_movimentacoes e WHERE e.estorno_de_id = m.id)`;

/** Validações que não dependem do banco. Devolve { erros, local, retiradosBrutos }. */
export const validarForma = (d) => {
  const erros = [];
  const erro = (campo, mensagem) => erros.push({ campo, mensagem });

  const descricao = texto(d.descricao);
  if (descricao.length < R.descricao_min_caracteres) erro('descricao', `Descrição muito curta: escreva mais de ${R.descricao_min_caracteres - 1} caracteres`);
  if (descricao.length > R.descricao_max_caracteres) erro('descricao', `Descrição longa demais (máximo de ${R.descricao_max_caracteres} caracteres)`);

  if (d.motivo_id === undefined && !texto(d.motivo_codigo)) erro('motivo', 'Escolha o motivo de fechamento');

  const l = d.local;
  let local = null;
  if (!l || typeof l !== 'object') erro('local', 'Informe o local da intervenção');
  else {
    const lat = numero(l.lat); const lng = numero(l.lng);
    if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180) erro('local', 'Local da intervenção com coordenadas inválidas');
    else if (!ORIGENS_LOCAL.includes(l.origem)) erro('local', 'Origem do local inválida (gps, address ou pole_reference)');
    else {
      const precisao = l.precisao_m === undefined || l.precisao_m === null ? null : Math.round(numero(l.precisao_m));
      if (precisao !== null && (!Number.isFinite(precisao) || precisao < 0 || precisao > 1000000)) erro('local', 'Precisão do GPS inválida');
      else {
        local = { lat, lng, precisao_m: precisao, origem: l.origem, endereco: texto(l.endereco).slice(0, 500) || null,
          aproximado: l.aproximado ? 1 : 0, capturado_em: quando(l.capturado_em) };
      }
    }
  }

  if (typeof d.materiais_usados !== 'boolean') erro('materiais_usados', 'Informe se materiais foram usados (true ou false)');
  if (typeof d.materiais_retirados !== 'boolean') erro('materiais_retirados', 'Informe se materiais foram retirados da rede (true ou false)');
  const retiradosBrutos = d.retirados === undefined ? [] : d.retirados;
  if (!Array.isArray(retiradosBrutos)) erro('retirados', 'Lista de materiais retirados inválida');
  else if (retiradosBrutos.length > R.retirados_max) erro('retirados', `Máximo de ${R.retirados_max} itens retirados`);
  else if (d.materiais_retirados === true && retiradosBrutos.length === 0) erro('retirados', 'Liste os materiais retirados ou marque que nenhum foi retirado');
  else if (d.materiais_retirados === false && retiradosBrutos.length > 0) erro('retirados', 'Há materiais retirados listados, mas a etapa diz que nenhum foi retirado');

  if (d.participantes !== undefined && (!Array.isArray(d.participantes) || d.participantes.length > R.participantes_max || !d.participantes.every(inteiroPositivo))) {
    erro('participantes', `Participantes inválidos (até ${R.participantes_max} ids de técnicos)`);
  }
  if (d.checklist !== undefined && (typeof d.checklist !== 'object' || d.checklist === null || Array.isArray(d.checklist))) erro('checklist', 'Respostas do checklist inválidas');
  if (d.fotos_esperadas !== undefined && (!Array.isArray(d.fotos_esperadas) || !d.fotos_esperadas.every(uuidValido))) erro('fotos', 'Lista de fotos esperadas inválida');

  return { erros, descricao, local, retiradosBrutos: Array.isArray(retiradosBrutos) ? retiradosBrutos : [] };
};

export const finalizarNaTx = async (conn, d, actor) => {
  if (!uuidValido(d.client_uuid)) throw new ServiceError(400, 'Informe o client_uuid da finalização (UUID)');
  const os = await lockOS(conn, d.os_id);
  assertAcessoOS(os, actor);

  // Reenvio da mesma finalização (ex.: resposta perdida): devolve o resultado sem refazer nada
  const [[existente]] = await conn.query('SELECT id, os_id, client_uuid, criado_em FROM os_fechamentos WHERE os_id = ? OR client_uuid = ?', [os.id, d.client_uuid]);
  if (existente) {
    if (existente.os_id === os.id && existente.client_uuid === d.client_uuid) {
      return { status: 'concluida', fechamento_id: existente.id, finalizado_em: existente.criado_em, repetida: true };
    }
    throw new ServiceError(409, existente.os_id === os.id ? 'Esta OS já foi finalizada' : 'Este identificador de finalização já foi usado em outra OS');
  }
  if (os.status === 'concluida') throw new ServiceError(409, 'OS encerrada: não pode mais ser finalizada pelo app');
  if (os.status === 'cancelada') throw new ServiceError(409, 'OS cancelada não pode ser finalizada');

  const { erros, descricao, local, retiradosBrutos } = validarForma(d);
  const erro = (campo, mensagem) => erros.push({ campo, mensagem });

  // Motivo
  let motivo = null;
  if (d.motivo_id !== undefined || texto(d.motivo_codigo)) {
    const [[m]] = d.motivo_id !== undefined
      ? await conn.query('SELECT id, rotulo FROM os_motivos_fechamento WHERE id = ? AND ativo = 1', [Number(d.motivo_id) || 0])
      : await conn.query('SELECT id, rotulo FROM os_motivos_fechamento WHERE codigo = ? AND ativo = 1', [texto(d.motivo_codigo)]);
    if (!m) erro('motivo', 'Motivo de fechamento inválido ou desativado'); else motivo = m;
  }

  // Checklist: todo item ativo obrigatório precisa de resposta do tipo certo; o que foi respondido fica copiado (rótulo incluso)
  const respostas = d.checklist && typeof d.checklist === 'object' && !Array.isArray(d.checklist) ? d.checklist : {};
  const [itens] = await conn.query('SELECT codigo, rotulo, tipo, unidade, obrigatorio FROM os_checklist_itens WHERE ativo = 1 ORDER BY ordem, id');
  const checklist = [];
  for (const it of itens) {
    const bruto = respostas[it.codigo];
    const vazio = bruto === undefined || bruto === null || (typeof bruto === 'string' && bruto.trim() === '');
    if (vazio) {
      if (it.obrigatorio) erro('checklist', `Responda o item do checklist: ${it.rotulo}`);
      continue;
    }
    let resposta;
    if (it.tipo === 'boolean') resposta = typeof bruto === 'boolean' ? bruto : null;
    else if (it.tipo === 'number') { const n = numero(bruto); resposta = Number.isFinite(n) && n >= 0 ? n : null; }
    else resposta = typeof bruto === 'string' ? bruto.trim().slice(0, 2000) : null;
    if (resposta === null) erro('checklist', `Resposta inválida no checklist: ${it.rotulo}`);
    else checklist.push({ codigo: it.codigo, rotulo: it.rotulo, tipo: it.tipo, unidade: it.unidade, obrigatorio: Boolean(it.obrigatorio), resposta });
  }

  // Materiais usados precisam bater com o que foi lançado de fato na OS
  if (typeof d.materiais_usados === 'boolean') {
    const [[{ n }]] = await conn.query(SQL_BAIXAS_ATIVAS, [os.id]);
    if (d.materiais_usados && n === 0) erro('materiais_usados', 'Nenhum material foi lançado nesta OS: adicione um lançamento ou marque que não usou material');
    if (!d.materiais_usados && n > 0) erro('materiais_usados', 'Há materiais lançados nesta OS: a etapa não pode dizer que nenhum foi usado');
  }

  // Retirados da rede (só informação; não mexe no saldo do estoque)
  const retirados = [];
  for (const [i, bruto] of retiradosBrutos.entries()) {
    const campo = `retirados[${i}]`;
    if (!bruto || typeof bruto !== 'object') { erro(campo, 'Item retirado inválido'); continue; }
    let descr = texto(bruto.descricao).slice(0, 255); let unidade = bruto.unidade; let itemId = null;
    if (bruto.item_id !== undefined && bruto.item_id !== null) {
      const [[it]] = await conn.query('SELECT id, nome, unidade FROM estoque_itens WHERE id = ?', [Number(bruto.item_id) || 0]);
      if (!it) { erro(campo, 'Item do estoque não encontrado'); continue; }
      itemId = it.id; descr = it.nome; unidade = it.unidade;
    } else if (descr.length < 2) { erro(campo, 'Descreva o material retirado'); continue; }
    if (!['metros', 'pecas'].includes(unidade)) { erro(campo, 'Informe a unidade do material retirado (metros ou pecas)'); continue; }
    const q = numero(bruto.quantidade);
    if (!Number.isFinite(q) || q <= 0) { erro(campo, `${descr}: a quantidade deve ser maior que zero`); continue; }
    if (unidade === 'pecas' && !Number.isInteger(q)) { erro(campo, `${descr}: este item é contado em unidades, informe um número inteiro`); continue; }
    if (!['novo', 'usado'].includes(bruto.condicao)) { erro(campo, `${descr}: informe a condição (novo ou usado)`); continue; }
    retirados.push({ item_id: itemId, descricao: descr, quantidade: r2(q), unidade, condicao: bruto.condicao });
  }

  // Participantes (opcional): técnicos/equipes ativos, sem repetir nem incluir o próprio técnico
  const participantes = [];
  const ids = [...new Set((Array.isArray(d.participantes) ? d.participantes : []).map(Number))].filter((id) => id !== os.tecnico_id);
  if (ids.length) {
    const [tecs] = await conn.query('SELECT id, nome FROM tecnicos WHERE ativo = 1 AND id IN (?)', [ids]);
    const achados = new Map(tecs.map((t) => [t.id, t.nome]));
    for (const id of ids) {
      if (achados.has(id)) participantes.push({ tecnico_id: id, nome: achados.get(id) });
      else erro('participantes', `Participante ${id} não encontrado ou inativo`);
    }
  }

  // Fotos: precisa de ao menos uma e todas as que o app diz ter enviado precisam estar no servidor
  const [fotos] = await conn.query('SELECT client_uuid FROM os_fotos WHERE os_id = ?', [os.id]);
  if (fotos.length < R.fotos_min) erro('fotos', `Envie ao menos ${R.fotos_min} foto do serviço`);
  const naoEnviadas = (Array.isArray(d.fotos_esperadas) ? d.fotos_esperadas : []).filter((u) => !fotos.some((f) => f.client_uuid === u));
  if (naoEnviadas.length) erro('fotos', `${naoEnviadas.length} foto(s) ainda não chegaram ao servidor: aguarde o envio terminar`);

  if (erros.length) {
    throw new ServiceError(400, `A OS não pode ser finalizada: ${erros[0].mensagem}${erros.length > 1 ? ` (e mais ${erros.length - 1} problema(s))` : ''}`, erros);
  }

  const agora = new Date();
  const finalizadoEm = quando(d.finalizado_em) || agora;
  const iniciadoEm = quando(d.iniciado_em) || os.iniciado_em || null;
  const [res] = await conn.query(
    `INSERT INTO os_fechamentos
       (os_id, descricao, motivo_id, motivo_rotulo, local_lat, local_lng, local_precisao_m, local_origem, local_endereco, local_aproximado,
        local_capturado_em, checklist, participantes, materiais_usados, materiais_retirados, iniciado_em, finalizado_em, dispositivo,
        versao_app, client_uuid, finalizado_por)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [os.id, descricao, motivo.id, motivo.rotulo, local.lat, local.lng, local.precisao_m, local.origem, local.endereco, local.aproximado,
      local.capturado_em, JSON.stringify(checklist), JSON.stringify(participantes), d.materiais_usados ? 1 : 0, d.materiais_retirados ? 1 : 0,
      iniciadoEm, finalizadoEm, texto(d.dispositivo).slice(0, 160) || null, texto(d.versao_app).slice(0, 30) || null, d.client_uuid, actor.id]);
  for (const r of retirados) {
    await conn.query('INSERT INTO os_materiais_retirados (os_id, item_id, descricao, quantidade, unidade, condicao) VALUES (?,?,?,?,?,?)',
      [os.id, r.item_id, r.descricao, r.quantidade, r.unidade, r.condicao]);
  }
  if (!os.iniciado_em && iniciadoEm) await conn.query('UPDATE ordens_servico SET iniciado_em = ? WHERE id = ?', [iniciadoEm, os.id]);
  await conn.query('DELETE FROM os_rascunhos WHERE os_id = ?', [os.id]);
  await fecharNaTx(conn, { os_id: os.id }, actor);
  return { status: 'concluida', fechamento_id: res.insertId, finalizado_em: finalizadoEm.toISOString() };
};

/** Fechamento, fotos e retirados de uma OS para exibição. Tolera a migração do app ainda não aplicada (devolve vazio). */
export const carregarFechamento = async (osId) => {
  try {
    const [[f]] = await pool.query(
      `SELECT f.*, u.name AS finalizado_por_nome FROM os_fechamentos f LEFT JOIN users u ON u.id = f.finalizado_por WHERE f.os_id = ?`, [osId]);
    const [fotos] = await pool.query('SELECT * FROM os_fotos WHERE os_id = ? ORDER BY id', [osId]);
    const [retirados] = await pool.query('SELECT id, item_id, descricao, quantidade, unidade, condicao FROM os_materiais_retirados WHERE os_id = ? ORDER BY id', [osId]);
    return {
      fechamento: f ? {
        id: f.id, descricao: f.descricao, motivo: f.motivo_rotulo,
        local: { lat: Number(f.local_lat), lng: Number(f.local_lng), precisao_m: f.local_precisao_m, origem: f.local_origem, endereco: f.local_endereco, aproximado: Boolean(f.local_aproximado), capturado_em: f.local_capturado_em },
        checklist: JSON.parse(f.checklist), participantes: JSON.parse(f.participantes),
        materiais_usados: Boolean(f.materiais_usados), materiais_retirados: Boolean(f.materiais_retirados),
        iniciado_em: f.iniciado_em, finalizado_em: f.finalizado_em, dispositivo: f.dispositivo, versao_app: f.versao_app,
        finalizado_por_nome: f.finalizado_por_nome, criado_em: f.criado_em,
      } : null,
      fotos: fotos.map(metadados),
      materiais_retirados: retirados.map((r) => ({ ...r, quantidade: Number(r.quantidade) })),
    };
  } catch (e) {
    if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
    return { fechamento: null, fotos: [], materiais_retirados: [] };
  }
};
