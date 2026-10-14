// Auditoria das Ordens de Serviço: tudo o que o usuário do web e o técnico (web ou app CW Campo) fazem nas OS —
// quem, quando, de onde, de qual IP, o que mudou e se deu certo (tentativas recusadas também ficam).
// Tabela criada por scripts/migrate_os_auditoria.js. Falha ao registrar nunca impede nem atrasa a ação principal.
import pool from '../../config/database.js';
import { dadosRequisicao, diferencas } from '../referral/auditoria.js';
import { linha } from '../fleet/auditoria.js';

export const ACOES = {
  visualizada: 'OS aberta',
  criada: 'OS criada',
  editada: 'OS editada',
  iniciada: 'Execução iniciada',
  lancamento: 'Lançamento (serviço + materiais)',
  material_baixado: 'Material baixado',
  servico_adicionado: 'Serviço adicionado',
  servico_removido: 'Serviço removido',
  foto_enviada: 'Foto enviada',
  foto_apagada: 'Foto apagada',
  rascunho_salvo: 'Rascunho da finalização salvo',
  finalizada: 'OS finalizada (campo)',
  concluida: 'OS concluída',
  cancelada: 'OS cancelada',
  estorno: 'Estorno de material',
  tipo_servico_criado: 'Tipo de serviço cadastrado',
  motivo_criado: 'Motivo de fechamento cadastrado',
  motivo_editado: 'Motivo de fechamento editado',
  checklist_criado: 'Item de checklist cadastrado',
  checklist_editado: 'Item de checklist editado',
  app_sincronizado: 'App sincronizado',
  outra: 'Outra ação',
};

export const ORIGENS = { web: 'Web', app: 'App CW Campo', outro: 'Outro' };

// Ações repetidas o tempo todo: grava no máximo uma por usuário/OS dentro da janela (minutos)
export const DEDUP_MIN = { visualizada: 10, rascunho_salvo: 10, app_sincronizado: 30 };

const MAX_JSON = 20000;

/** De onde veio a ação: o app manda `X-Cliente: cw-campo/...`; sem ele, decide pelo User-Agent. */
export const origemDe = (req) => {
  const cliente = String(req?.headers?.['x-cliente'] || '').toLowerCase();
  if (cliente.startsWith('cw-campo')) return 'app';
  if (cliente.startsWith('web')) return 'web';
  const ua = String(req?.headers?.['user-agent'] || '');
  if (/okhttp|CFNetwork|Darwin|Expo|ReactNative|Dalvik/i.test(ua)) return 'app';
  if (/Mozilla\//.test(ua)) return 'web';
  return 'outro';
};

// [método, regex do caminho (relativo ao router), ação, nomes dos grupos capturados]
const ROTAS = {
  os: [
    ['GET', /^\/(\d+)$/, 'visualizada', ['os']],
    ['POST', /^\/?$/, 'criada', []],
    ['PUT', /^\/(\d+)$/, 'editada', ['os']],
    ['POST', /^\/tipos-servico$/, 'tipo_servico_criado', []],
    ['POST', /^\/(\d+)\/materiais$/, 'material_baixado', ['os']],
    ['POST', /^\/(\d+)\/lancamentos$/, 'lancamento', ['os']],
    ['POST', /^\/(\d+)\/servicos$/, 'servico_adicionado', ['os']],
    ['DELETE', /^\/(\d+)\/servicos\/(\d+)$/, 'servico_removido', ['os', 'item']],
    ['POST', /^\/(\d+)\/fotos$/, 'foto_enviada', ['os']],
    ['DELETE', /^\/(\d+)\/fotos\/(\d+)$/, 'foto_apagada', ['os', 'item']],
    ['POST', /^\/(\d+)\/finalizar$/, 'finalizada', ['os']],
    ['POST', /^\/(\d+)\/iniciar$/, 'iniciada', ['os']],
    ['POST', /^\/(\d+)\/fechar$/, 'concluida', ['os']],
    ['PUT', /^\/(\d+)\/rascunho$/, 'rascunho_salvo', ['os']],
    ['POST', /^\/(\d+)\/cancelar$/, 'cancelada', ['os']],
    ['POST', /^\/(\d+)\/estornos$/, 'estorno', ['os']],
  ],
  catalogos: [
    ['POST', /^\/motivos$/, 'motivo_criado', []],
    ['PUT', /^\/motivos\/(\d+)$/, 'motivo_editado', ['item']],
    ['POST', /^\/checklist$/, 'checklist_criado', []],
    ['PUT', /^\/checklist\/(\d+)$/, 'checklist_editado', ['item']],
  ],
  mobile: [
    ['GET', /^\/bootstrap$/, 'app_sincronizado', []],
  ],
};

/** Qual ação de auditoria corresponde à requisição (null = leitura que não se registra). Exportado para teste. */
export const acaoDaRota = (grupo, metodo, caminho) => {
  const m = String(metodo || '').toUpperCase();
  const p = String(caminho || '/').replace(/\/+$/, '') || '/';
  for (const [metodoRota, re, acao, nomes] of ROTAS[grupo] ?? []) {
    if (metodoRota !== m) continue;
    const r = p.match(re);
    if (!r) continue;
    const ids = {};
    nomes.forEach((n, i) => { ids[n] = Number(r[i + 1]); });
    return { acao, osId: ids.os ?? null, itemId: ids.item ?? null };
  }
  // Qualquer outra escrita (rota nova que ainda não tem nome) também fica registrada
  if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') {
    const os = grupo === 'os' ? p.match(/^\/(\d+)(\/|$)/) : null;
    return { acao: 'outra', osId: os ? Number(os[1]) : null, itemId: null };
  }
  return null;
};

const paraJson = (v) => {
  if (v === undefined || v === null) return null;
  const s = JSON.stringify(v);
  return s.length > MAX_JSON ? JSON.stringify({ truncado: true, inicio: s.slice(0, MAX_JSON) }) : s;
};

/** O que o usuário enviou, sem o que não interessa guardar (caminho do mapa ponto a ponto, rascunho inteiro). */
export const corpoParaGuardar = (acao, body) => {
  if (!body || typeof body !== 'object') return null;
  if (acao === 'rascunho_salvo') return null;
  const b = { ...body };
  if (b.rota && typeof b.rota === 'object') {
    b.rota = { pontos: b.rota.pontos, metros: b.rota.metros, caminho_pontos: Array.isArray(b.rota.caminho) ? b.rota.caminho.length : undefined };
  }
  for (const k of ['senha', 'password', 'token']) if (k in b) b[k] = '***';
  return Object.keys(b).length ? b : null;
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : String(v ?? '');
};
const qtd = (q, unidade) => `${num(q)} ${unidade === 'metros' ? 'm' : 'un'}`;
const osTxt = (os) => (os ? `OS #${os.numero}${os.cliente ? ` — ${os.cliente}` : ''}` : '');

// Campos da OS com nome legível (para o resumo da edição)
export const CAMPOS_OS = {
  numero: 'número', cliente: 'nome', endereco: 'endereço', prazo: 'prazo', prioridade: 'prioridade', descricao: 'descrição',
  tipo_servico: 'tipo de serviço', cep: 'CEP', logradouro: 'rua', numero_endereco: 'nº', complemento: 'complemento',
  bairro: 'bairro', cidade: 'cidade', uf: 'UF', latitude: 'latitude', longitude: 'longitude', pop_nome: 'POP',
  rota_id: 'rota', poste_id: 'poste', tecnico_id: 'responsável', status: 'status',
};

const buscarOS = async (id) => {
  if (!id) return null;
  const [[os]] = await pool.query(
    `SELECT o.*, t.nome AS tecnico_nome FROM ordens_servico o LEFT JOIN tecnicos t ON t.id = o.tecnico_id WHERE o.id = ?`, [id]);
  return linha(os);
};

const descreverMovs = async (ids) => {
  const lista = (ids || []).filter((x) => Number.isInteger(Number(x)) && Number(x) > 0);
  if (!lista.length) return [];
  const [rows] = await pool.query(
    `SELECT m.id, m.quantidade, i.nome, i.unidade, l.codigo FROM estoque_movimentacoes m
       JOIN estoque_itens i ON i.id = m.item_id JOIN estoque_lotes l ON l.id = m.lote_id
      WHERE m.id IN (${lista.map(() => '?').join(',')}) ORDER BY m.id`, lista);
  return rows.map((r) => ({ id: r.id, item: r.nome, quantidade: Number(r.quantidade), unidade: r.unidade, lote: r.codigo }));
};
const textoMovs = (movs) => movs.map((m) => `${qtd(m.quantidade, m.unidade)} ${m.item} (lote ${m.lote})`).join(', ');

/** Lê o que a ação vai mudar/apagar (roda ANTES do handler). Nunca lança. */
export async function lerAntes(acao, osId, itemId, body) {
  try {
    const os = osId ? await buscarOS(osId) : null;
    let item = null;
    if (acao === 'servico_removido' && itemId) {
      const [[r]] = await pool.query('SELECT id, os_id, descricao, trecho, quantidade, criado_por, criado_em FROM os_servicos WHERE id = ?', [itemId]);
      item = linha(r);
    } else if (acao === 'foto_apagada' && itemId) {
      const [[r]] = await pool.query('SELECT id, os_id, mime, tamanho, legenda, tirada_em, lat, lng, criado_por, criado_em FROM os_fotos WHERE id = ?', [itemId]);
      item = linha(r);
    } else if (acao === 'estorno' && body?.movimentacao_id) {
      item = (await descreverMovs([body.movimentacao_id]))[0] ?? null;
    } else if (acao === 'motivo_editado' && itemId) {
      const [[r]] = await pool.query('SELECT id, codigo, rotulo, ordem, ativo FROM os_motivos_fechamento WHERE id = ?', [itemId]);
      item = linha(r);
    } else if (acao === 'checklist_editado' && itemId) {
      const [[r]] = await pool.query('SELECT id, codigo, rotulo, tipo, unidade, obrigatorio, ordem, ativo FROM os_checklist_itens WHERE id = ?', [itemId]);
      item = linha(r);
    }
    return { os, item };
  } catch (err) {
    console.error('[OS] Erro ao ler registro para a auditoria:', err.message);
    return { os: null, item: null };
  }
}

/**
 * Monta resumo/antes/depois de uma ação que DEU CERTO, a partir do que havia antes, do que foi enviado e da resposta.
 * Exportado para teste (as consultas extras só acontecem nas ações que precisam delas).
 */
export async function montarRegistro({ acao, antes, body, resposta, osId }) {
  const os = antes?.os;
  const enviado = corpoParaGuardar(acao, body);
  const r = resposta && typeof resposta === 'object' ? resposta : {};
  const base = { resumo: ACOES[acao] ?? acao, antes: null, depois: enviado ? { enviado } : null, campos: null };

  switch (acao) {
    case 'visualizada':
      return { ...base, resumo: `Abriu a ${osTxt(os)}`, depois: null };
    case 'criada': {
      const nova = await buscarOS(r.id);
      return { ...base, resumo: `${osTxt(nova ?? { numero: r.numero, cliente: body?.cliente })} criada${nova?.tecnico_nome ? ` · responsável ${nova.tecnico_nome}` : ''}`, depois: nova ?? enviado };
    }
    case 'editada': {
      const depois = await buscarOS(osId);
      const campos = Object.keys(CAMPOS_OS);
      const d = diferencas(os ?? {}, depois ?? {}, campos);
      const nomes = d.campos.map((c) => CAMPOS_OS[c] ?? c);
      return {
        resumo: d.campos.length ? `${osTxt(depois ?? os)} editada: ${nomes.join(', ')}` : `${osTxt(depois ?? os)} salva sem alterações`,
        antes: d.campos.length ? d.antes : null, depois: d.campos.length ? d.depois : null, campos: d.campos,
      };
    }
    case 'tipo_servico_criado':
      return { ...base, resumo: `Tipo de serviço cadastrado: ${r.nome ?? body?.nome ?? ''}` };
    case 'material_baixado': {
      const movs = await descreverMovs([r.movimentacao_id]);
      return { ...base, resumo: `Material baixado na ${osTxt(os)}: ${textoMovs(movs) || `${num(r.quantidade)} (lote ${r.lote_codigo})`}`, depois: { enviado, materiais: movs } };
    }
    case 'lancamento': {
      const movs = await descreverMovs((r.materiais || []).map((m) => m.movimentacao_id));
      const trecho = r.trecho ?? body?.trecho;
      return {
        ...base,
        resumo: `Lançamento na ${osTxt(os)}: ${r.descricao ?? body?.descricao ?? ''}${trecho ? ` (${trecho})` : ''}${movs.length ? ` — ${textoMovs(movs)}` : ' — sem materiais'}`,
        depois: { enviado, servico_id: r.id ?? null, materiais: movs },
      };
    }
    case 'servico_adicionado':
      return { ...base, resumo: `Serviço adicionado na ${osTxt(os)}: ${r.descricao ?? body?.descricao ?? ''} × ${num(r.quantidade ?? body?.quantidade ?? 1)}` };
    case 'servico_removido':
      return { ...base, resumo: `Serviço removido da ${osTxt(os)}${antes?.item ? `: ${antes.item.descricao} × ${num(antes.item.quantidade)}` : ''}`, antes: antes?.item ?? null, depois: null };
    case 'foto_enviada':
      return { ...base, resumo: `Foto enviada na ${osTxt(os)}${r.legenda || body?.legenda ? `: ${r.legenda ?? body.legenda}` : ''}`, depois: { foto: r.id ? r : null, enviado } };
    case 'foto_apagada':
      return { ...base, resumo: `Foto apagada da ${osTxt(os)}${antes?.item?.legenda ? `: ${antes.item.legenda}` : ''}`, antes: antes?.item ?? null, depois: null };
    case 'iniciada':
      return { ...base, resumo: `Execução iniciada na ${osTxt(os)}`, antes: os ? { status: os.status, iniciado_em: os.iniciado_em ?? null } : null, depois: { status: r.status, iniciado_em: r.iniciado_em } };
    case 'finalizada': {
      let fech = null;
      if (r.fechamento_id) {
        const [[f]] = await pool.query('SELECT id, motivo_rotulo, descricao, local_origem, local_endereco, finalizado_em, dispositivo, versao_app FROM os_fechamentos WHERE id = ?', [r.fechamento_id]);
        fech = linha(f);
      }
      return { ...base, resumo: `${osTxt(os)} finalizada${fech?.motivo_rotulo ? ` — motivo: ${fech.motivo_rotulo}` : ''}`, antes: os ? { status: os.status } : null, depois: { fechamento: fech, enviado } };
    }
    case 'concluida':
      return { ...base, resumo: `${osTxt(os)} concluída`, antes: os ? { status: os.status } : null, depois: { status: 'concluida' } };
    case 'cancelada':
      return { ...base, resumo: `${osTxt(os)} cancelada`, antes: os ? { status: os.status } : null, depois: { status: 'cancelada' } };
    case 'rascunho_salvo':
      return { ...base, resumo: `Rascunho da finalização salvo na ${osTxt(os)}`, depois: null };
    case 'estorno': {
      const mov = antes?.item;
      return {
        ...base,
        resumo: `Estorno na ${osTxt(os)}: ${num(r.quantidade ?? body?.quantidade)}${mov ? ` ${mov.unidade === 'metros' ? 'm' : 'un'} ${mov.item} (lote ${mov.lote})` : ''}${body?.motivo ? ` — motivo: ${body.motivo}` : ''}`,
        antes: mov ?? null,
      };
    }
    case 'motivo_criado':
    case 'checklist_criado':
      return { ...base, resumo: `${ACOES[acao]}: ${r.rotulo ?? body?.rotulo ?? ''}`, depois: r.id ? r : enviado };
    case 'motivo_editado':
    case 'checklist_editado': {
      const depois = linha(r.id ? r : null);
      const campos = Object.keys(depois ?? {}).filter((c) => !['id', 'usos'].includes(c));
      const d = diferencas(antes?.item ?? {}, depois ?? {}, campos);
      return {
        resumo: `${ACOES[acao]}: ${depois?.rotulo ?? antes?.item?.rotulo ?? ''}${d.campos.length ? ` (${d.campos.join(', ')})` : ' (sem alterações)'}`,
        antes: d.campos.length ? d.antes : null, depois: d.campos.length ? d.depois : null, campos: d.campos,
      };
    }
    case 'app_sincronizado':
      return { ...base, resumo: 'App sincronizado (baixou as OS e o estoque do técnico)', depois: null };
    default:
      return base;
  }
}

const jaRegistradoAgora = async (acao, usuarioId, osId) => {
  const min = DEDUP_MIN[acao];
  if (!min || !usuarioId) return false;
  const [[r]] = await pool.query(
    `SELECT 1 AS ok FROM os_auditoria WHERE usuario_id = ? AND acao = ? AND os_id <=> ? AND resultado = 'ok'
       AND created_at > NOW(3) - INTERVAL ${Number(min)} MINUTE LIMIT 1`, [usuarioId, acao, osId ?? null]);
  return Boolean(r);
};

async function gravar(req, res, { acao, osId, antes }) {
  try {
    const status = res.statusCode;
    const ok = status < 400;
    const resposta = res.locals.auditCorpo;
    const d = dadosRequisicao(req);
    if (ok && await jaRegistradoAgora(acao, d.usuario_id, osId)) return;

    let reg;
    if (ok) {
      reg = await montarRegistro({ acao, antes, body: req.body, resposta, osId });
    } else {
      const msg = typeof resposta?.error === 'string' ? resposta.error : `HTTP ${status}`;
      reg = {
        resumo: `Recusado (${ACOES[acao] ?? acao})${antes?.os ? ` — ${osTxt(antes.os)}` : ''}: ${msg}`,
        antes: null, depois: corpoParaGuardar(acao, req.body) ? { enviado: corpoParaGuardar(acao, req.body), detalhes: resposta?.detalhes } : null, campos: null,
      };
    }

    let nome = null;
    if (d.usuario_id) {
      const [[u]] = await pool.query('SELECT name FROM users WHERE id = ?', [d.usuario_id]);
      nome = u?.name ?? null;
    }
    const osFinal = antes?.os ?? (acao === 'criada' && resposta?.id ? { id: resposta.id, numero: resposta.numero } : null);
    const repetida = Boolean(resposta?.repetida) || res.getHeader?.('Idempotent-Replayed') === 'true';
    await pool.query(
      `INSERT INTO os_auditoria
         (acao, os_id, os_numero, resumo, campos_alterados, dados_antes, dados_depois, resultado, http_status, erro, repetida,
          origem, usuario_id, usuario_email, usuario_nome, usuario_papel, tecnico_id, ip, ip_cadeia, user_agent, metodo, rota)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        acao, osFinal?.id ?? osId ?? null, osFinal?.numero ?? null,
        String(reg.resumo ?? acao).slice(0, 500),
        reg.campos?.length ? reg.campos.join(',').slice(0, 500) : null,
        paraJson(reg.antes), paraJson(reg.depois),
        ok ? 'ok' : 'erro', status,
        ok ? null : String(resposta?.error ?? `HTTP ${status}`).slice(0, 500),
        repetida ? 1 : 0,
        origemDe(req),
        d.usuario_id, d.usuario_email, nome, req.userRole ?? null, req.tecnicoId ?? null,
        d.ip, d.ip_cadeia, d.user_agent,
        req.method, String(req.originalUrl || '').split('?')[0].slice(0, 255),
      ]
    );
  } catch (err) {
    // Sem a tabela (migração ainda não aplicada) avisa uma vez só, para não encher o log a cada requisição
    if (err.code !== 'ER_NO_SUCH_TABLE' || !avisouSemTabela) console.error('[OS] Erro ao registrar auditoria:', err.message);
    if (err.code === 'ER_NO_SUCH_TABLE') avisouSemTabela = true;
  }
}
let avisouSemTabela = false;

/**
 * Middleware do router (`grupo`: os | catalogos | mobile). Precisa vir depois de verifyToken/loadTecnico.
 * Lê o "antes", guarda o corpo da resposta e grava a auditoria quando a resposta termina, sem atrasá-la.
 */
export const auditarOS = (grupo) => async (req, res, next) => {
  const alvo = acaoDaRota(grupo, req.method, req.path);
  if (!alvo) return next();
  // O corpo de multipart (fotos) só existe depois do multer: o "antes" só precisa do JSON, que já chegou aqui
  const precisaAntes = alvo.osId || ['motivo_editado', 'checklist_editado'].includes(alvo.acao);
  const antes = precisaAntes ? await lerAntes(alvo.acao, alvo.osId, alvo.itemId, req.body) : null;
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
  const acoes = lista(f.acao).filter((a) => ACOES[a]);
  if (acoes.length) { where.push(`acao IN (${acoes.map(() => '?').join(',')})`); params.push(...acoes); }
  const origens = lista(f.origem).filter((o) => ORIGENS[o]);
  if (origens.length) { where.push(`origem IN (${origens.map(() => '?').join(',')})`); params.push(...origens); }
  if (['ok', 'erro'].includes(f.resultado)) { where.push('resultado = ?'); params.push(f.resultado); }
  if (f.usuario_id && /^\d+$/.test(String(f.usuario_id))) { where.push('usuario_id = ?'); params.push(Number(f.usuario_id)); }
  if (f.os && /^\d+$/.test(String(f.os).replace(/^#/, ''))) { where.push('os_numero = ?'); params.push(Number(String(f.os).replace(/^#/, ''))); }
  if (f.os_id && /^\d+$/.test(String(f.os_id))) { where.push('os_id = ?'); params.push(Number(f.os_id)); }
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

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM os_auditoria ${sql}`, params);
  const [itens] = await pool.query(
    `SELECT * FROM os_auditoria ${sql} ORDER BY created_at DESC, id DESC LIMIT ${porPagina} OFFSET ${(pagina - 1) * porPagina}`, params);
  const [usuarios] = await pool.query(
    `SELECT usuario_id AS id, MAX(usuario_nome) AS nome, MAX(usuario_email) AS email, MAX(usuario_papel) AS papel
       FROM os_auditoria WHERE usuario_id IS NOT NULL GROUP BY usuario_id ORDER BY nome`);
  const [tecnicos] = await pool.query('SELECT id, nome FROM tecnicos');
  const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return s; } };
  return {
    itens: itens.map((i) => ({ ...i, repetida: Boolean(i.repetida), dados_antes: parse(i.dados_antes), dados_depois: parse(i.dados_depois) })),
    total: Number(total),
    pagina,
    por_pagina: porPagina,
    usuarios,
    acoes: ACOES,
    origens: ORIGENS,
    campos: CAMPOS_OS,
    nomes: { tecnicos: Object.fromEntries(tecnicos.map((t) => [t.id, t.nome])) },
  };
}
