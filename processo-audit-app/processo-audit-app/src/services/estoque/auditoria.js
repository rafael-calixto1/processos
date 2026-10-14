// Auditoria do Estoque: tudo o que é feito nas abas de /estoque — itens, entradas, lotes, retiradas, devoluções e
// aprovações, técnicos, fornecedores e equipamentos — quem, quando, de onde (web/app), de qual IP, o que mudou e se deu
// certo (tentativas recusadas também ficam). Tabela criada por scripts/migrate_estoque_auditoria.js.
// Falha ao registrar nunca impede nem atrasa a ação principal.
import pool from '../../config/database.js';
import { dadosRequisicao, diferencas } from '../referral/auditoria.js';
import { linha } from '../fleet/auditoria.js';
import { origemDe, ORIGENS } from '../os/auditoria.js';

export const ACOES = {
  item_criado: 'Item cadastrado',
  item_editado: 'Item editado',
  entrada: 'Entrada / compra',
  lote_renomeado: 'Lote renomeado',
  lote_descartado: 'Descarte de lote',
  lote_excluido: 'Lote excluído',
  retirada: 'Retirada para técnico',
  devolucao: 'Devolução recebida',
  devolucao_solicitada: 'Devolução solicitada',
  devolucao_aprovada: 'Devolução aprovada',
  devolucao_negada: 'Devolução negada',
  tecnico_criado: 'Técnico cadastrado',
  tecnico_editado: 'Técnico editado',
  fornecedor_criado: 'Fornecedor cadastrado',
  fornecedor_editado: 'Fornecedor editado',
  equipamento_criado: 'Equipamento cadastrado',
  equipamento_editado: 'Equipamento editado',
  equipamento_emprestado: 'Equipamento emprestado',
  equipamento_devolvido: 'Equipamento devolvido',
  outra: 'Outra ação',
};

// Aba do /estoque em que cada ação acontece (filtro da tela)
export const ABAS = {
  itens: { nome: 'Itens', acoes: ['item_criado', 'item_editado'] },
  entrada: { nome: 'Entrada / Compra', acoes: ['entrada'] },
  lotes: { nome: 'Lotes (patrimônio)', acoes: ['lote_renomeado', 'lote_descartado', 'lote_excluido'] },
  retirada: { nome: 'Retirada', acoes: ['retirada'] },
  devolucao: { nome: 'Devoluções', acoes: ['devolucao', 'devolucao_solicitada', 'devolucao_aprovada', 'devolucao_negada'] },
  equipamentos: { nome: 'Equipamentos', acoes: ['equipamento_criado', 'equipamento_editado', 'equipamento_emprestado', 'equipamento_devolvido'] },
  cadastros: { nome: 'Cadastros', acoes: ['tecnico_criado', 'tecnico_editado', 'fornecedor_criado', 'fornecedor_editado'] },
};

// Nome legível dos campos (resumo e tela de edição)
export const CAMPOS = {
  nome: 'nome', categoria: 'categoria', unidade: 'unidade', estoque_minimo: 'estoque mínimo', ativo: 'ativo',
  codigo: 'código', tipo: 'tipo', empresa: 'empresa', telefone: 'telefone', usuario_id: 'usuário vinculado',
  cnpj: 'CNPJ', contato: 'contato', patrimonio: 'patrimônio', estado: 'estado',
  nf: 'NF', grupo: 'código da compra', fornecedor: 'fornecedor', saldo_atual: 'saldo atual', descartado: 'descartado', motivo: 'motivo',
};

const MAX_JSON = 20000;
const paraJson = (v) => {
  if (v === undefined || v === null) return null;
  const s = JSON.stringify(v);
  return s.length > MAX_JSON ? JSON.stringify({ truncado: true, inicio: s.slice(0, MAX_JSON) }) : s;
};

// [método, regex do caminho (relativo ao router), ação, entidade, tabela para o "antes"]
const ROTAS = {
  estoque: [
    ['POST', /^\/itens$/, 'item_criado', 'item'],
    ['PUT', /^\/itens\/(\d+)$/, 'item_editado', 'item', 'estoque_itens'],
    ['POST', /^\/compras$/, 'entrada', 'compra'],
    ['PUT', /^\/lotes\/(\d+)$/, 'lote_renomeado', 'lote', 'estoque_lotes'],
    ['POST', /^\/lotes\/(\d+)\/descartar$/, 'lote_descartado', 'lote', 'estoque_lotes'],
    ['DELETE', /^\/lotes\/(\d+)$/, 'lote_excluido', 'lote', 'estoque_lotes'],
    ['POST', /^\/retiradas$/, 'retirada', 'movimentacao'],
    ['POST', /^\/devolucoes$/, 'devolucao', 'devolucao'],
    ['POST', /^\/devolucoes\/(\d+)\/aprovar$/, 'devolucao_aprovada', 'devolucao', 'estoque_devolucoes'],
    ['POST', /^\/devolucoes\/(\d+)\/negar$/, 'devolucao_negada', 'devolucao', 'estoque_devolucoes'],
  ],
  tecnicos: [
    ['POST', /^\/?$/, 'tecnico_criado', 'tecnico'],
    ['PUT', /^\/(\d+)$/, 'tecnico_editado', 'tecnico', 'tecnicos'],
  ],
  fornecedores: [
    ['POST', /^\/?$/, 'fornecedor_criado', 'fornecedor'],
    ['PUT', /^\/(\d+)$/, 'fornecedor_editado', 'fornecedor', 'fornecedores'],
  ],
  equipamentos: [
    ['POST', /^\/?$/, 'equipamento_criado', 'equipamento'],
    ['PUT', /^\/(\d+)$/, 'equipamento_editado', 'equipamento', 'equipamentos'],
    ['POST', /^\/(\d+)\/saida$/, 'equipamento_emprestado', 'equipamento', 'equipamentos'],
    ['POST', /^\/(\d+)\/devolucao$/, 'equipamento_devolvido', 'equipamento', 'equipamentos'],
  ],
};

/** Qual ação de auditoria corresponde à requisição (null = leitura, não se registra). Exportado para teste. */
export const acaoDaRota = (grupo, metodo, caminho) => {
  const m = String(metodo || '').toUpperCase();
  const p = String(caminho || '/').replace(/\/+$/, '') || '/';
  for (const [metodoRota, re, acao, entidade, tabela] of ROTAS[grupo] ?? []) {
    if (metodoRota !== m) continue;
    const r = p.match(re);
    if (!r) continue;
    return { acao, entidade, id: r[1] ? Number(r[1]) : null, tabela: tabela ?? null };
  }
  // qualquer outra escrita (rota nova que ainda não tem nome) também fica registrada
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m)) return { acao: 'outra', entidade: grupo, id: null, tabela: null };
  return null;
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : String(v ?? '');
};
const qtd = (q, unidade) => `${num(q)} ${unidade === 'metros' ? 'm' : 'un'}`;

const um = async (sql, params) => linha((await pool.query(sql, params))[0][0]);

const buscarLote = (id) => um(
  `SELECT l.id, l.codigo, l.item_id, i.nome AS item_nome, i.unidade, l.compra_id, l.saldo_inicial, l.saldo_atual, l.status, l.criado_em,
     COALESCE((SELECT SUM(p.quantidade) FROM estoque_posse p WHERE p.lote_id = l.id), 0) AS com_tecnicos
   FROM estoque_lotes l JOIN estoque_itens i ON i.id = l.item_id WHERE l.id = ?`, [id]);
const buscarDevolucao = (id) => um(
  `SELECT d.id, d.status, d.quantidade, d.condicao, d.observacao, d.motivo_negacao, d.solicitado_em, d.revisado_em,
     d.item_id, i.nome AS item_nome, i.unidade, l.codigo AS lote_codigo, d.tecnico_id, t.nome AS tecnico_nome
   FROM estoque_devolucoes d JOIN estoque_itens i ON i.id = d.item_id JOIN estoque_lotes l ON l.id = d.lote_id
   JOIN tecnicos t ON t.id = d.tecnico_id WHERE d.id = ?`, [id]);
const buscarMov = (id) => um(
  `SELECT m.id, m.tipo, m.quantidade, m.condicao, m.observacao, m.item_id, i.nome AS item_nome, i.unidade,
     l.codigo AS lote_codigo, m.tecnico_id, t.nome AS tecnico_nome
   FROM estoque_movimentacoes m JOIN estoque_itens i ON i.id = m.item_id JOIN estoque_lotes l ON l.id = m.lote_id
   LEFT JOIN tecnicos t ON t.id = m.tecnico_id WHERE m.id = ?`, [id]);
const buscarEquip = (id) => um(
  `SELECT e.id, e.nome, e.patrimonio, e.estado, e.ativo, em.id AS emprestimo_id, em.tecnico_id, t.nome AS tecnico_nome,
     em.saida_em, em.condicao_saida
   FROM equipamentos e LEFT JOIN equipamento_emprestimos em ON em.equipamento_id = e.id AND em.devolucao_em IS NULL
   LEFT JOIN tecnicos t ON t.id = em.tecnico_id WHERE e.id = ?`, [id]);
const nomeTecnico = async (id) => (id ? (await um('SELECT nome FROM tecnicos WHERE id = ?', [id]))?.nome ?? `técnico #${id}` : null);

/** Lê o que a ação vai mudar/apagar (roda ANTES do handler). Nunca lança. */
export async function lerAntes({ tabela, id }) {
  if (!tabela || !id) return null;
  try {
    if (tabela === 'estoque_lotes') return await buscarLote(id);
    if (tabela === 'estoque_devolucoes') return await buscarDevolucao(id);
    if (tabela === 'equipamentos') return await buscarEquip(id);
    return await um(`SELECT * FROM ${tabela} WHERE id = ?`, [id]);
  } catch (err) {
    console.error('[Estoque] Erro ao ler registro para a auditoria:', err.message);
    return null;
  }
}

const TABELA_DA_ENTIDADE = { item: 'estoque_itens', tecnico: 'tecnicos', fornecedor: 'fornecedores', equipamento: 'equipamentos' };
const SEM_COMPARAR = new Set(['id', 'criado_em', 'atualizado_em', 'emprestimo_id', 'tecnico_id', 'tecnico_nome', 'saida_em', 'condicao_saida']);
const comoEstaAgora = async (entidade, id) => (entidade === 'equipamento' ? buscarEquip(id) : um(`SELECT * FROM ${TABELA_DA_ENTIDADE[entidade]} WHERE id = ?`, [id]));
const descrever = (entidade, r) => {
  if (!r) return '';
  if (entidade === 'item') return `${r.nome} (${r.unidade === 'metros' ? 'metros' : 'unidades'})`;
  if (entidade === 'tecnico') return `${r.nome}${r.tipo === 'terceirizado' ? `, terceirizado${r.empresa ? ` (${r.empresa})` : ''}` : ''}`;
  if (entidade === 'fornecedor') return `${r.nome}${r.cnpj ? `, CNPJ ${r.cnpj}` : ''}`;
  if (entidade === 'equipamento') return `${r.nome}${r.patrimonio ? ` (patrimônio ${r.patrimonio})` : ''}`;
  return '';
};

/**
 * Monta resumo/antes/depois de uma ação que DEU CERTO, a partir do que havia antes, do que foi enviado e da resposta.
 * Devolve também os vínculos (item, técnico, lote) usados nos filtros. Exportado para teste.
 */
export async function montarRegistro({ acao, entidade, id, antes, body, resposta, papel }) {
  const r = resposta && typeof resposta === 'object' ? resposta : {};
  const b = body && typeof body === 'object' ? body : {};
  const base = { resumo: ACOES[acao] ?? acao, antes: null, depois: null, campos: null, entidadeId: id ?? null, itemId: null, tecnicoId: null, lote: null };

  switch (acao) {
    case 'item_criado':
    case 'tecnico_criado':
    case 'fornecedor_criado':
    case 'equipamento_criado': {
      const novo = r.id ? await comoEstaAgora(entidade, r.id) : null;
      return {
        ...base, resumo: `${ACOES[acao]}: ${descrever(entidade, novo ?? b) || b.nome || ''}`, depois: novo ?? b, entidadeId: r.id ?? null,
        itemId: entidade === 'item' ? r.id ?? null : null, tecnicoId: entidade === 'tecnico' ? r.id ?? null : null,
      };
    }
    case 'item_editado':
    case 'tecnico_editado':
    case 'fornecedor_editado':
    case 'equipamento_editado': {
      const depois = await comoEstaAgora(entidade, id);
      const campos = Object.keys({ ...(antes ?? {}), ...(depois ?? {}) }).filter((c) => !SEM_COMPARAR.has(c));
      const d = diferencas(antes ?? {}, depois ?? {}, campos);
      const nomes = d.campos.map((c) => CAMPOS[c] ?? c);
      const desc = descrever(entidade, depois ?? antes);
      return {
        ...base,
        resumo: d.campos.length ? `${ACOES[acao]}: ${desc} — mudou ${nomes.join(', ')}` : `${ACOES[acao]} sem alterações: ${desc}`,
        antes: d.campos.length ? d.antes : null, depois: d.campos.length ? d.depois : null, campos: d.campos,
        itemId: entidade === 'item' ? id : null, tecnicoId: entidade === 'tecnico' ? id : null,
      };
    }
    case 'entrada': {
      const linhas = Array.isArray(r.linhas) && r.linhas.length ? r.linhas : r.compra ? [{ compra: r.compra, lotes: r.lotes }] : [];
      const ids = [...new Set(linhas.map((l) => l.compra?.item_id).filter(Boolean))];
      const itens = ids.length ? (await pool.query(`SELECT id, nome, unidade FROM estoque_itens WHERE id IN (${ids.map(() => '?').join(',')})`, ids))[0] : [];
      const porId = Object.fromEntries(itens.map((i) => [i.id, i]));
      const fornId = linhas[0]?.compra?.fornecedor_id;
      const forn = fornId ? (await um('SELECT nome FROM fornecedores WHERE id = ?', [fornId]))?.nome : null;
      const nf = linhas[0]?.compra?.nf;
      const partes = linhas.map((l) => {
        const it = porId[l.compra?.item_id];
        const total = (l.lotes || []).reduce((s, x) => s + Number(x.saldo_inicial || 0), 0);
        return `${(l.lotes || []).length} lote(s) de ${it?.nome ?? `item #${l.compra?.item_id}`} (${qtd(total, it?.unidade)})`;
      });
      const lotes = linhas.flatMap((l) => (l.lotes || []).map((x) => ({ codigo: x.codigo, item: porId[l.compra?.item_id]?.nome, quantidade: Number(x.saldo_inicial), unidade: porId[l.compra?.item_id]?.unidade })));
      return {
        ...base,
        resumo: `Entrada${nf ? ` NF ${nf}` : ''}${forn ? ` de ${forn}` : ''}: ${partes.join('; ') || 'sem lotes'}`,
        depois: { grupo: r.grupo_id ?? null, nf: nf ?? null, fornecedor: forn ?? null, lotes },
        entidadeId: linhas[0]?.compra?.id ?? null, itemId: ids.length === 1 ? ids[0] : null, lote: lotes.length === 1 ? lotes[0].codigo : null,
      };
    }
    case 'lote_renomeado':
      return {
        ...base, resumo: `Lote renomeado: ${antes?.codigo ?? '?'} → ${r.codigo ?? b.codigo}${antes?.item_nome ? ` (${antes.item_nome})` : ''}`,
        antes: antes ? { codigo: antes.codigo } : null, depois: { codigo: r.codigo ?? b.codigo }, campos: ['codigo'],
        itemId: antes?.item_id ?? null, lote: r.codigo ?? b.codigo ?? null,
      };
    case 'lote_descartado':
      return {
        ...base,
        resumo: `Descarte no lote ${antes?.codigo ?? r.lote_codigo}${antes?.item_nome ? ` (${antes.item_nome})` : ''}: ${qtd(r.descartado ?? b.quantidade, antes?.unidade)}${b.motivo ? ` — motivo: ${b.motivo}` : ''}`,
        antes: antes ? { saldo_atual: antes.saldo_atual } : null, depois: { descartado: r.descartado ?? null, saldo_atual: r.saldo_atual ?? null, motivo: b.motivo ?? null },
        itemId: antes?.item_id ?? null, lote: antes?.codigo ?? r.lote_codigo ?? null,
      };
    case 'lote_excluido':
      return {
        ...base, resumo: `Lote excluído: ${antes?.codigo ?? `#${id}`}${antes?.item_nome ? ` (${antes.item_nome}, ${qtd(antes.saldo_inicial, antes.unidade)})` : ''}`,
        antes, itemId: antes?.item_id ?? null, lote: antes?.codigo ?? null,
      };
    case 'retirada':
    case 'devolucao': {
      // técnico só solicita (a devolução vira pedido para o estoque aprovar)
      if (acao === 'devolucao' && papel === 'tecnico') {
        const dev = r.solicitacao_id ? await buscarDevolucao(r.solicitacao_id) : null;
        return {
          ...base, acao: 'devolucao_solicitada', entidade: 'devolucao',
          resumo: `Devolução solicitada${dev ? ` por ${dev.tecnico_nome}: ${qtd(dev.quantidade, dev.unidade)} ${dev.item_nome} (lote ${dev.lote_codigo}), ${dev.condicao}` : `: ${num(r.quantidade)} (lote ${r.lote_codigo})`}`,
          depois: dev ?? r, entidadeId: r.solicitacao_id ?? null, itemId: dev?.item_id ?? null, tecnicoId: dev?.tecnico_id ?? null, lote: dev?.lote_codigo ?? r.lote_codigo ?? null,
        };
      }
      const mov = r.movimentacao_id ? await buscarMov(r.movimentacao_id) : null;
      const tec = mov?.tecnico_nome ?? (await nomeTecnico(b.tecnico_id));
      const oque = mov ? `${qtd(mov.quantidade, mov.unidade)} ${mov.item_nome} (lote ${mov.lote_codigo})` : `${num(r.quantidade)} (lote ${r.lote_codigo})`;
      return {
        ...base,
        resumo: acao === 'retirada' ? `Retirada: ${oque} para ${tec ?? 'técnico'}` : `Devolução recebida de ${tec ?? 'técnico'}: ${oque}${b.condicao ? `, ${b.condicao}` : ''}`,
        depois: mov ?? r, entidade: 'movimentacao', entidadeId: r.movimentacao_id ?? null,
        itemId: mov?.item_id ?? null, tecnicoId: mov?.tecnico_id ?? (b.tecnico_id ? Number(b.tecnico_id) : null), lote: mov?.lote_codigo ?? r.lote_codigo ?? null,
      };
    }
    case 'devolucao_aprovada':
    case 'devolucao_negada': {
      const oque = antes ? `${qtd(antes.quantidade, antes.unidade)} ${antes.item_nome} (lote ${antes.lote_codigo}) de ${antes.tecnico_nome}` : `#${id}`;
      return {
        ...base,
        resumo: acao === 'devolucao_aprovada'
          ? `Devolução aprovada: ${oque}${b.condicao && b.condicao !== antes?.condicao ? ` — condição corrigida para ${b.condicao}` : ''}`
          : `Devolução negada: ${oque}${b.motivo ? ` — motivo: ${b.motivo}` : ''}`,
        antes: antes ? { status: antes.status, condicao: antes.condicao } : null,
        depois: { status: acao === 'devolucao_aprovada' ? 'aprovada' : 'negada', ...(b.condicao && { condicao: b.condicao }), ...(b.motivo && { motivo: b.motivo }) },
        itemId: antes?.item_id ?? null, tecnicoId: antes?.tecnico_id ?? null, lote: antes?.lote_codigo ?? null,
      };
    }
    case 'equipamento_emprestado': {
      const agora = await buscarEquip(id);
      return {
        ...base, resumo: `Equipamento emprestado: ${descrever('equipamento', agora ?? antes)} para ${agora?.tecnico_nome ?? (await nomeTecnico(b.tecnico_id))}${b.condicao_saida ? `, saiu ${b.condicao_saida}` : ''}`,
        depois: agora, tecnicoId: agora?.tecnico_id ?? (b.tecnico_id ? Number(b.tecnico_id) : null),
      };
    }
    case 'equipamento_devolvido':
      return {
        ...base, resumo: `Equipamento devolvido: ${descrever('equipamento', antes)}${antes?.tecnico_nome ? ` por ${antes.tecnico_nome}` : ''}, voltou ${b.condicao_devolucao ?? '?'}`,
        antes: antes ? { estado: antes.estado, com: antes.tecnico_nome, desde: antes.saida_em } : null, depois: { estado: b.condicao_devolucao ?? null },
        campos: antes && antes.estado !== b.condicao_devolucao ? ['estado'] : null, tecnicoId: antes?.tecnico_id ?? null,
      };
    default:
      return { ...base, depois: Object.keys(b).length ? { enviado: b } : null };
  }
}

async function gravar(req, res, { acao, entidade, id, antes }) {
  try {
    const status = res.statusCode;
    const ok = status < 400;
    const resposta = res.locals.auditCorpo;
    const d = dadosRequisicao(req);
    let reg;
    if (ok) {
      reg = await montarRegistro({ acao, entidade, id, antes, body: req.body, resposta, papel: req.userRole });
    } else {
      const msg = typeof resposta?.error === 'string' ? resposta.error : `HTTP ${status}`;
      const rotulo = acao === 'devolucao' && req.userRole === 'tecnico' ? ACOES.devolucao_solicitada : ACOES[acao] ?? acao;
      reg = {
        acao: acao === 'devolucao' && req.userRole === 'tecnico' ? 'devolucao_solicitada' : acao,
        resumo: `Recusado (${rotulo})${antes ? ` — ${descrever(entidade, antes) || antes.codigo || antes.item_nome || ''}` : ''}: ${msg}`,
        depois: req.body && Object.keys(req.body).length ? { enviado: req.body } : null,
        entidadeId: id ?? null, itemId: antes?.item_id ?? null, tecnicoId: antes?.tecnico_id ?? null, lote: antes?.codigo ?? antes?.lote_codigo ?? null,
      };
    }
    let nome = null;
    if (d.usuario_id) nome = (await um('SELECT name FROM users WHERE id = ?', [d.usuario_id]))?.name ?? null;
    const repetida = Boolean(resposta?.repetida) || res.getHeader?.('Idempotent-Replayed') === 'true';
    await pool.query(
      `INSERT INTO estoque_auditoria
         (acao, entidade, entidade_id, item_id, tecnico_id, lote_codigo, resumo, campos_alterados, dados_antes, dados_depois,
          resultado, http_status, erro, repetida, origem, usuario_id, usuario_email, usuario_nome, usuario_papel,
          ip, ip_cadeia, user_agent, metodo, rota)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        reg.acao ?? acao, reg.entidade ?? entidade, reg.entidadeId ?? null, reg.itemId ?? null, reg.tecnicoId ?? null,
        reg.lote ? String(reg.lote).slice(0, 40) : null,
        String(reg.resumo ?? acao).slice(0, 500), reg.campos?.length ? reg.campos.join(',').slice(0, 500) : null,
        paraJson(reg.antes), paraJson(reg.depois),
        ok ? 'ok' : 'erro', status, ok ? null : String(resposta?.error ?? `HTTP ${status}`).slice(0, 500), repetida ? 1 : 0,
        origemDe(req), d.usuario_id, d.usuario_email, nome, req.userRole ?? null,
        d.ip, d.ip_cadeia, d.user_agent, req.method, String(req.originalUrl || '').split('?')[0].slice(0, 255),
      ]
    );
  } catch (err) {
    // Sem a tabela (migração ainda não aplicada) avisa uma vez só, para não encher o log a cada requisição
    if (err.code !== 'ER_NO_SUCH_TABLE' || !avisouSemTabela) console.error('[Estoque] Erro ao registrar auditoria:', err.message);
    if (err.code === 'ER_NO_SUCH_TABLE') avisouSemTabela = true;
  }
}
let avisouSemTabela = false;

/**
 * Middleware do router (`grupo`: estoque | tecnicos | fornecedores | equipamentos), depois de verifyToken/loadTecnico.
 * Lê o "antes", guarda o corpo da resposta e grava a auditoria quando a resposta termina, sem atrasá-la.
 */
export const auditarEstoque = (grupo) => async (req, res, next) => {
  const alvo = acaoDaRota(grupo, req.method, req.path);
  if (!alvo) return next();
  const antes = await lerAntes(alvo);
  const json = res.json.bind(res);
  res.json = (corpo) => { res.locals.auditCorpo = corpo; return json(corpo); };
  res.on('finish', () => { setImmediate(() => gravar(req, res, { ...alvo, antes })); });
  next();
};

/* ───── Consulta (tela de auditoria) ───── */

const lista = (v) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Monta o WHERE dos filtros da tela (exportado para teste). */
export const montarFiltro = (f = {}) => {
  const where = [];
  const params = [];
  const acoes = [...new Set([...lista(f.acao).filter((a) => ACOES[a]), ...lista(f.aba).flatMap((a) => ABAS[a]?.acoes ?? [])])];
  if (acoes.length) { where.push(`acao IN (${acoes.map(() => '?').join(',')})`); params.push(...acoes); }
  const origens = lista(f.origem).filter((o) => ORIGENS[o]);
  if (origens.length) { where.push(`origem IN (${origens.map(() => '?').join(',')})`); params.push(...origens); }
  if (['ok', 'erro'].includes(f.resultado)) { where.push('resultado = ?'); params.push(f.resultado); }
  for (const [k, col] of [['usuario_id', 'usuario_id'], ['item_id', 'item_id'], ['tecnico_id', 'tecnico_id']]) {
    if (f[k] && /^\d+$/.test(String(f[k]))) { where.push(`${col} = ?`); params.push(Number(f[k])); }
  }
  if (f.lote) { where.push('lote_codigo LIKE ?'); params.push(`%${String(f.lote).trim().toUpperCase().slice(0, 40)}%`); }
  if (f.ip) { where.push('(ip LIKE ? OR ip_cadeia LIKE ?)'); params.push(`%${f.ip}%`, `%${f.ip}%`); }
  if (DATA.test(f.de ?? '')) { where.push('created_at >= ?'); params.push(`${f.de} 00:00:00`); }
  if (DATA.test(f.ate ?? '')) { where.push('created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(f.ate); }
  if (f.q) {
    const t = `%${String(f.q).slice(0, 100)}%`;
    where.push('(resumo LIKE ? OR usuario_nome LIKE ? OR usuario_email LIKE ? OR erro LIKE ? OR dados_antes LIKE ? OR dados_depois LIKE ?)');
    params.push(t, t, t, t, t, t);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
};

export async function listarAuditoria(f = {}) {
  const porPagina = Math.min(200, Math.max(1, parseInt(f.por_pagina, 10) || 50));
  const pagina = Math.max(1, parseInt(f.pagina, 10) || 1);
  const { sql, params } = montarFiltro(f);
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM estoque_auditoria ${sql}`, params);
  const [itens] = await pool.query(
    `SELECT * FROM estoque_auditoria ${sql} ORDER BY created_at DESC, id DESC LIMIT ${porPagina} OFFSET ${(pagina - 1) * porPagina}`, params);
  const [usuarios] = await pool.query(
    `SELECT usuario_id AS id, MAX(usuario_nome) AS nome, MAX(usuario_email) AS email, MAX(usuario_papel) AS papel
       FROM estoque_auditoria WHERE usuario_id IS NOT NULL GROUP BY usuario_id ORDER BY nome`);
  const [itensCat] = await pool.query('SELECT id, nome FROM estoque_itens ORDER BY nome');
  const [tecnicos] = await pool.query('SELECT id, nome FROM tecnicos ORDER BY nome');
  const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return s; } };
  return {
    itens: itens.map((i) => ({ ...i, repetida: Boolean(i.repetida), dados_antes: parse(i.dados_antes), dados_depois: parse(i.dados_depois) })),
    total: Number(total),
    pagina,
    por_pagina: porPagina,
    usuarios,
    acoes: ACOES,
    abas: Object.fromEntries(Object.entries(ABAS).map(([k, v]) => [k, v.nome])),
    origens: ORIGENS,
    campos: CAMPOS,
    catalogo: { itens: itensCat, tecnicos },
  };
}
