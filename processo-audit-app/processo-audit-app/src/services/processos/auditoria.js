// Auditoria dos Processos: tudo o que é feito em /processos e nas execuções — processos criados, editados (inclusive
// os passos), inativados e abertos, fotos de instrução, PDFs exportados, execuções iniciadas, passos concluídos,
// execuções finalizadas e canceladas — quem, quando, de onde, de qual IP, o que mudou e se deu certo (tentativas
// recusadas também ficam). Tabela criada por scripts/migrate_processos_auditoria.js.
// Falha ao registrar nunca impede nem atrasa a ação principal.
import pool from '../../config/database.js';
import { dadosRequisicao, diferencas } from '../referral/auditoria.js';
import { linha } from '../fleet/auditoria.js';
import { origemDe, ORIGENS } from '../os/auditoria.js';

export const ACOES = {
  processo_aberto: 'Processo aberto',
  processo_criado: 'Processo criado',
  processo_editado: 'Processo editado',
  processo_inativado: 'Processo inativado',
  foto_instrucao: 'Foto de instrução enviada',
  pdf_exportado: 'PDF exportado',
  execucao_iniciada: 'Execução iniciada',
  execucao_aberta: 'Execução aberta',
  passo_concluido: 'Passo concluído',
  execucao_finalizada: 'Execução finalizada',
  execucao_cancelada: 'Execução cancelada',
  outra: 'Outra ação',
};

// Grupos de ações (filtro da tela)
export const ABAS = {
  cadastro: { nome: 'Cadastro e edição', acoes: ['processo_criado', 'processo_editado', 'processo_inativado', 'foto_instrucao'] },
  execucoes: { nome: 'Execuções', acoes: ['execucao_iniciada', 'passo_concluido', 'execucao_finalizada', 'execucao_cancelada'] },
  consultas: { nome: 'Aberturas e PDFs', acoes: ['processo_aberto', 'execucao_aberta', 'pdf_exportado'] },
};

// Nome legível dos campos (resumo e tela)
export const CAMPOS = {
  title: 'título', description: 'descrição', status: 'status', department_id: 'departamento', passos: 'passos',
  departamento: 'departamento', notas: 'observação', foto: 'foto', arquivo: 'arquivo', tamanho: 'tamanho',
  quantidade: 'quantidade', filtros: 'filtros', passos_total: 'passos', iniciada_em: 'iniciada em',
  concluidos: 'passos concluídos', faltando: 'passos faltando', executor: 'executor',
};

export const STATUS = { active: 'Ativo', draft: 'Rascunho', archived: 'Arquivado' };
const STATUS_EXEC = { in_progress: 'em andamento', completed: 'finalizada', abandoned: 'cancelada' };

// Ações repetidas o tempo todo (recarregar a tela): grava no máximo uma por pessoa/processo/execução na janela (minutos)
export const DEDUP_MIN = { processo_aberto: 10, execucao_aberta: 10 };

const MAX_JSON = 20000;
const paraJson = (v) => {
  if (v === undefined || v === null) return null;
  const s = JSON.stringify(v);
  return s.length > MAX_JSON ? JSON.stringify({ truncado: true, inicio: s.slice(0, MAX_JSON) }) : s;
};

// Só estes caminhos (relativos a /api) são de /processos; o middleware fica em /api e ignora o resto
const DO_MODULO = /^\/(process(es)?|executions?|step-executions)(\/|$)/;

// [método, regex do caminho (relativo a /api), ação, o que o número capturado identifica]
const ROTAS = [
  ['GET', /^\/process(?:es)?\/(\d+)$/, 'processo_aberto', 'processo'],
  ['POST', /^\/process(?:es)?$/, 'processo_criado', null],
  ['PUT', /^\/process(?:es)?\/(\d+)$/, 'processo_editado', 'processo'],
  ['DELETE', /^\/process(?:es)?\/(\d+)$/, 'processo_inativado', 'processo'],
  ['POST', /^\/processes\/upload-step-photo$/, 'foto_instrucao', null],
  ['POST', /^\/processes\/auditoria\/pdf$/, 'pdf_exportado', null],
  ['POST', /^\/executions?\/start\/(\d+)$/, 'execucao_iniciada', 'processo'],
  ['GET', /^\/executions?\/(\d+)$/, 'execucao_aberta', 'execucao'],
  ['PUT', /^\/step-executions\/(\d+)\/complete$/, 'passo_concluido', 'passo_execucao'],
  ['PUT', /^\/executions?\/(\d+)\/complete$/, 'execucao_finalizada', 'execucao'],
  ['PUT', /^\/executions?\/(\d+)\/cancel$/, 'execucao_cancelada', 'execucao'],
];

/** Qual ação de auditoria corresponde à requisição (null = consulta ou fora de /processos). Exportado para teste. */
export const acaoDaRota = (metodo, caminho) => {
  const m = String(metodo || '').toUpperCase();
  const p = String(caminho || '/').replace(/\/+$/, '') || '/';
  if (!DO_MODULO.test(p)) return null;
  for (const [metodoRota, re, acao, alvo] of ROTAS) {
    if (metodoRota !== m) continue;
    const r = p.match(re);
    if (!r) continue;
    const id = r[1] ? Number(r[1]) : null;
    return {
      acao,
      processoId: alvo === 'processo' ? id : null,
      execucaoId: alvo === 'execucao' ? id : null,
      passoExecucaoId: alvo === 'passo_execucao' ? id : null,
    };
  }
  // qualquer outra escrita (rota nova que ainda não tem nome) também fica registrada
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m)) return { acao: 'outra', processoId: null, execucaoId: null, passoExecucaoId: null };
  return null;
};

const um = async (sql, params) => linha((await pool.query(sql, params))[0][0]);

const buscarProcesso = (id) => um(
  `SELECT p.id, p.title, p.description, p.status, p.department_id, d.name AS departamento, p.version
   FROM processes p LEFT JOIN departments d ON d.id = p.department_id WHERE p.id = ?`, [id]);
const buscarPassos = async (processoId) => (await pool.query(
  `SELECT step_number, title, section, description, documentation_markdown, photo_url
   FROM steps WHERE process_id = ? ORDER BY step_number`, [processoId]))[0].map(linha);
const buscarExecucao = (id) => um(
  `SELECT pe.id, pe.process_id, pe.user_id, u.name AS executor, pe.status, pe.started_at, pe.completed_at,
     (SELECT COUNT(*) FROM step_executions se WHERE se.execution_id = pe.id) AS passos_total,
     (SELECT COUNT(*) FROM step_executions se WHERE se.execution_id = pe.id AND se.completed_at IS NOT NULL) AS concluidos
   FROM process_executions pe LEFT JOIN users u ON u.id = pe.user_id WHERE pe.id = ?`, [id]);
const buscarPassoExecucao = (id) => um(
  `SELECT se.id, se.execution_id, se.completed_at, se.notes, se.photo_url, s.step_number, s.title, s.section, pe.process_id
   FROM step_executions se JOIN steps s ON s.id = se.step_id JOIN process_executions pe ON pe.id = se.execution_id
   WHERE se.id = ?`, [id]);

/** Lê o que a ação vai mudar (roda ANTES do handler). Nunca lança. */
export async function lerAntes({ acao, processoId, execucaoId, passoExecucaoId }) {
  try {
    if (['processo_editado', 'processo_inativado'].includes(acao) && processoId) {
      const p = await buscarProcesso(processoId);
      return p ? { processo: p, passos: acao === 'processo_editado' ? await buscarPassos(processoId) : null } : null;
    }
    if (['execucao_finalizada', 'execucao_cancelada'].includes(acao) && execucaoId) return { execucao: await buscarExecucao(execucaoId) };
    if (acao === 'passo_concluido' && passoExecucaoId) return { passo: await buscarPassoExecucao(passoExecucaoId) };
    return null;
  } catch (err) {
    console.error('[Processos] Erro ao ler registro para a auditoria:', err.message);
    return null;
  }
}

const CAMPOS_PASSO = ['title', 'section', 'description', 'documentation_markdown', 'photo_url'];
const NOME_CAMPO_PASSO = { title: 'título', section: 'seção', description: 'descrição', documentation_markdown: 'documentação', photo_url: 'foto' };
const chavePasso = (t) => String(t ?? '').trim().toLowerCase();
const vazio = (v) => (v === null || v === undefined ? '' : String(v));

/**
 * O que mudou na lista de passos. Os passos são casados pelo título (a edição apaga e recria todos): o que sobra de um
 * lado foi removido/adicionado; o casado em outra posição foi movido; o casado com conteúdo diferente foi editado.
 * Exportado para teste.
 */
export const mudancasPassos = (antes = [], depois = []) => {
  const livres = depois.map((p, i) => ({ ...p, pos: i + 1 }));
  const r = { adicionados: [], removidos: [], editados: [], movidos: [] };
  antes.forEach((a, i) => {
    const j = livres.findIndex((d) => chavePasso(d.title) === chavePasso(a.title));
    if (j < 0) { r.removidos.push({ posicao: i + 1, titulo: a.title }); return; }
    const [d] = livres.splice(j, 1);
    if (d.pos !== i + 1) r.movidos.push({ titulo: d.title, de: i + 1, para: d.pos });
    const campos = CAMPOS_PASSO.filter((c) => c !== 'title' && vazio(a[c]) !== vazio(d[c]));
    if (campos.length) r.editados.push({ posicao: d.pos, titulo: d.title, campos: campos.map((c) => NOME_CAMPO_PASSO[c]) });
  });
  for (const d of livres) r.adicionados.push({ posicao: d.pos, titulo: d.title });
  // um passo inserido no meio empurra os de baixo: isso não é "mover"
  const deslocamento = (m) => r.adicionados.filter((x) => x.posicao <= m.para).length - r.removidos.filter((x) => x.posicao <= m.de).length;
  r.movidos = r.movidos.filter((m) => m.para - m.de !== deslocamento(m));
  return r;
};

const textoMudancasPassos = (m) => [
  m.adicionados.length && `${m.adicionados.length} passo(s) adicionado(s)`,
  m.removidos.length && `${m.removidos.length} removido(s)`,
  m.editados.length && `${m.editados.length} editado(s)`,
  m.movidos.length && `${m.movidos.length} mudou(aram) de posição`,
].filter(Boolean).join(', ');

const nomeArquivo = (url) => (url ? String(url).split('/').pop() : null);
const tamanho = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/**
 * Monta resumo/antes/depois de uma ação que DEU CERTO, a partir do que havia antes, do que foi enviado e da resposta.
 * Devolve também processo/execução para os filtros. Exportado para teste.
 */
export async function montarRegistro({ acao, processoId, execucaoId, antes, body, resposta, arquivo }) {
  const r = resposta && typeof resposta === 'object' ? resposta : {};
  const b = body && typeof body === 'object' ? body : {};
  const base = { resumo: ACOES[acao] ?? acao, antes: null, depois: null, campos: null, processoId: processoId ?? null, execucaoId: execucaoId ?? null };

  switch (acao) {
    case 'processo_aberto': {
      const p = processoId ? await buscarProcesso(processoId) : null;
      return { ...base, resumo: `Abriu o processo ${p?.title ? `"${p.title}"` : `#${processoId}`}`, processo: p };
    }
    case 'processo_criado': {
      const p = r.id ? await buscarProcesso(r.id) : null;
      const passos = Array.isArray(b.steps) ? b.steps : [];
      return {
        ...base, processoId: r.id ?? null, processo: p,
        resumo: `Processo criado: "${p?.title ?? b.title}"${p?.departamento ? ` em ${p.departamento}` : ''}, ${passos.length} passo(s)`,
        depois: {
          title: p?.title ?? b.title, description: p?.description ?? b.description ?? null, status: p?.status ?? 'active',
          departamento: p?.departamento ?? null, passos: passos.map((x, i) => ({ posicao: i + 1, titulo: x.title, secao: x.section || null })),
        },
      };
    }
    case 'processo_editado': {
      const p = await buscarProcesso(processoId);
      const ant = antes?.processo ?? {};
      const d = diferencas(ant, p ?? {}, ['title', 'description', 'status']);
      const campos = [...d.campos];
      const dadosAntes = { ...d.antes };
      const dadosDepois = { ...d.depois };
      let mp = null;
      if (Array.isArray(b.steps)) {
        mp = mudancasPassos(antes?.passos ?? [], await buscarPassos(processoId));
        if (mp.adicionados.length || mp.removidos.length || mp.editados.length || mp.movidos.length) {
          campos.push('passos');
          dadosAntes.passos = (antes?.passos ?? []).length;
          dadosDepois.passos = (antes?.passos ?? []).length - mp.removidos.length + mp.adicionados.length;
          dadosDepois.mudancas_passos = mp;
        }
      }
      const partes = d.campos.map((c) => (c === 'status' ? `status ${STATUS[d.antes.status] ?? d.antes.status} → ${STATUS[d.depois.status] ?? d.depois.status}` : CAMPOS[c]));
      if (campos.includes('passos')) partes.push(textoMudancasPassos(mp));
      const titulo = p?.title ?? ant.title;
      return {
        ...base, processo: p,
        resumo: partes.length ? `Processo "${titulo}" editado: ${partes.join('; ')}` : `Processo "${titulo}" salvo sem alterações`,
        antes: campos.length ? dadosAntes : null, depois: campos.length ? dadosDepois : null, campos,
      };
    }
    case 'processo_inativado': {
      const p = antes?.processo;
      return {
        ...base, processo: p,
        resumo: `Processo inativado (arquivado): "${p?.title ?? `#${processoId}`}"`,
        antes: p ? { status: p.status } : null, depois: { status: 'archived' }, campos: ['status'],
      };
    }
    case 'foto_instrucao':
      return {
        ...base,
        resumo: `Foto de instrução enviada${arquivo?.originalname ? `: ${arquivo.originalname}` : ''}${arquivo?.size ? ` (${tamanho(arquivo.size)})` : ''}`,
        depois: { arquivo: arquivo?.originalname ?? null, tamanho: arquivo?.size ? tamanho(arquivo.size) : null, foto: r.photo_url ?? null },
      };
    case 'pdf_exportado': {
      const pid = Number(b.processo_id) || null;
      const p = pid ? await buscarProcesso(pid) : null;
      const filtros = Array.isArray(b.filtros) ? b.filtros.filter((f) => Array.isArray(f)).map((f) => f.map(String).join(': ')).join(', ') : '';
      return {
        ...base, processoId: pid, processo: p,
        resumo: p
          ? `PDF do processo "${p.title}" exportado`
          : `PDF da lista de processos exportado${Number.isFinite(Number(b.quantidade)) ? ` (${Number(b.quantidade)} processo(s))` : ''}${filtros ? ` — filtros: ${filtros}` : ''}`,
        depois: p ? null : { quantidade: Number(b.quantidade) || 0, filtros: filtros || null },
      };
    }
    case 'execucao_iniciada': {
      const p = processoId ? await buscarProcesso(processoId) : null;
      const ex = r.execution_id ? await buscarExecucao(r.execution_id) : null;
      return {
        ...base, processo: p, execucaoId: r.execution_id ?? null,
        resumo: `Execução #${r.execution_id ?? '?'} iniciada: "${p?.title ?? `processo #${processoId}`}"${ex ? `, ${ex.passos_total} passo(s)` : ''}`,
      };
    }
    case 'execucao_aberta': {
      const ex = await buscarExecucao(execucaoId);
      const p = ex?.process_id ? await buscarProcesso(ex.process_id) : null;
      return {
        ...base, processoId: ex?.process_id ?? null, processo: p,
        resumo: `Abriu a execução #${execucaoId}${p ? ` de "${p.title}"` : ''}${ex ? ` (${STATUS_EXEC[ex.status] ?? ex.status}, ${ex.concluidos}/${ex.passos_total} passos${ex.executor ? `, de ${ex.executor}` : ''})` : ''}`,
      };
    }
    case 'passo_concluido': {
      const pa = antes?.passo;
      const p = pa?.process_id ? await buscarProcesso(pa.process_id) : null;
      const ex = pa?.execution_id ? await buscarExecucao(pa.execution_id) : null;
      const notas = typeof b.notes === 'string' && b.notes.trim() ? b.notes.trim() : null;
      const foto = r.photo_url ?? null;
      return {
        ...base, processoId: pa?.process_id ?? null, execucaoId: pa?.execution_id ?? null, processo: p,
        resumo: `Passo ${pa?.step_number ?? '?'} "${pa?.title ?? '?'}" concluído na execução #${pa?.execution_id ?? '?'}${p ? ` de "${p.title}"` : ''}${ex ? ` (${ex.concluidos}/${ex.passos_total})` : ''}${foto ? ', com foto' : ''}`,
        antes: pa?.completed_at ? { concluido_em: pa.completed_at, notas: pa.notes || null, foto: pa.photo_url || null } : null,
        depois: { passo: pa ? `${pa.step_number}. ${pa.title}` : null, notas, foto },
      };
    }
    case 'execucao_finalizada':
    case 'execucao_cancelada': {
      const ex = antes?.execucao;
      const p = ex?.process_id ? await buscarProcesso(ex.process_id) : null;
      const novo = acao === 'execucao_finalizada' ? 'completed' : 'abandoned';
      return {
        ...base, processoId: ex?.process_id ?? null, processo: p,
        resumo: `Execução #${execucaoId} ${acao === 'execucao_finalizada' ? 'finalizada' : 'cancelada'}${p ? `: "${p.title}"` : ''}${ex ? ` (${ex.concluidos}/${ex.passos_total} passos${ex.executor ? `, de ${ex.executor}` : ''})` : ''}`,
        antes: ex ? { status: STATUS_EXEC[ex.status] ?? ex.status } : null, depois: { status: STATUS_EXEC[novo] }, campos: ['status'],
      };
    }
    default:
      return { ...base, depois: Object.keys(b).length ? { enviado: b } : null };
  }
}

// O que o usuário tentou enviar quando foi recusado (sem o texto enorme da documentação dos passos)
const enviadoParaGuardar = (body) => {
  if (!body || typeof body !== 'object' || !Object.keys(body).length) return null;
  const { steps, ...resto } = body;
  return Array.isArray(steps) ? { ...resto, passos: steps.map((s) => s?.title ?? null) } : resto;
};

const jaRegistradoAgora = async (acao, usuarioId, processoId, execucaoId) => {
  const min = DEDUP_MIN[acao];
  if (!min || !usuarioId) return false;
  const [[r]] = await pool.query(
    `SELECT 1 AS ok FROM processos_auditoria WHERE usuario_id = ? AND acao = ? AND processo_id <=> ? AND execucao_id <=> ?
       AND resultado = 'ok' AND created_at > NOW(3) - INTERVAL ${Number(min)} MINUTE LIMIT 1`,
    [usuarioId, acao, processoId ?? null, execucaoId ?? null]);
  return Boolean(r);
};

async function gravar(req, res, alvo, antes) {
  try {
    const { acao } = alvo;
    const status = res.statusCode;
    const ok = status < 400;
    const resposta = res.locals.auditCorpo;
    // rota que nem existe (404 do servidor): nada aconteceu, não enche o registro com varreduras
    if (acao === 'outra' && status === 404) return;
    const d = dadosRequisicao(req);
    if (ok && await jaRegistradoAgora(acao, d.usuario_id, alvo.processoId, alvo.execucaoId)) return;

    let reg;
    if (ok) {
      reg = await montarRegistro({ ...alvo, antes, body: req.body, resposta, arquivo: req.file });
    } else {
      const msg = typeof resposta?.error === 'string' ? resposta.error : `HTTP ${status}`;
      const pid = alvo.processoId ?? antes?.execucao?.process_id ?? antes?.passo?.process_id ?? null;
      const p = antes?.processo ?? (pid ? await buscarProcesso(pid).catch(() => null) : null);
      const onde = p ? ` — "${p.title}"` : alvo.execucaoId ? ` — execução #${alvo.execucaoId}` : '';
      reg = {
        resumo: `Recusado (${ACOES[acao] ?? acao})${onde}: ${msg}`,
        depois: enviadoParaGuardar(req.body) ? { enviado: enviadoParaGuardar(req.body) } : null,
        processoId: pid, execucaoId: alvo.execucaoId ?? antes?.passo?.execution_id ?? null, processo: p,
      };
    }
    let nome = null;
    if (d.usuario_id) nome = (await um('SELECT name FROM users WHERE id = ?', [d.usuario_id]))?.name ?? null;
    await pool.query(
      `INSERT INTO processos_auditoria
         (acao, processo_id, processo_titulo, departamento_id, execucao_id, resumo, campos_alterados, dados_antes, dados_depois,
          resultado, http_status, erro, origem, usuario_id, usuario_email, usuario_nome, usuario_papel,
          ip, ip_cadeia, user_agent, metodo, rota)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        acao, reg.processoId ?? null, reg.processo?.title ? String(reg.processo.title).slice(0, 255) : null,
        reg.processo?.department_id ?? null, reg.execucaoId ?? null,
        String(reg.resumo ?? acao).slice(0, 500), reg.campos?.length ? reg.campos.join(',').slice(0, 500) : null,
        paraJson(reg.antes), paraJson(reg.depois),
        ok ? 'ok' : 'erro', status, ok ? null : String(resposta?.error ?? `HTTP ${status}`).slice(0, 500),
        origemDe(req), d.usuario_id, d.usuario_email, nome, req.userRole ?? null,
        d.ip, d.ip_cadeia, d.user_agent, req.method, String(req.originalUrl || '').split('?')[0].slice(0, 255),
      ]
    );
  } catch (err) {
    // Sem a tabela (migração ainda não aplicada) avisa uma vez só, para não encher o log a cada requisição
    if (err.code !== 'ER_NO_SUCH_TABLE' || !avisouSemTabela) console.error('[Processos] Erro ao registrar auditoria:', err.message);
    if (err.code === 'ER_NO_SUCH_TABLE') avisouSemTabela = true;
  }
}
let avisouSemTabela = false;

/**
 * Middleware montado em /api antes dos routers de processos e execuções (só age nos caminhos deles).
 * Lê o "antes", guarda o corpo da resposta e grava a auditoria quando a resposta termina, sem atrasá-la.
 */
export const auditarProcessos = async (req, res, next) => {
  const alvo = acaoDaRota(req.method, req.path);
  if (!alvo) return next();
  const antes = await lerAntes(alvo);
  const json = res.json.bind(res);
  res.json = (corpo) => { res.locals.auditCorpo = corpo; return json(corpo); };
  res.on('finish', () => { setImmediate(() => gravar(req, res, alvo, antes)); });
  next();
};

/* ───── Consulta (tela de auditoria) ───── */

const lista = (v) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Monta o WHERE dos filtros da tela (exportado para teste). `limite` restringe o gerente aos departamentos dele e às
 * próprias ações sem departamento ({ departamentos: [ids], usuarioId }); null = sem limite (admin).
 */
export const montarFiltro = (f = {}, limite = null) => {
  const where = [];
  const params = [];
  if (limite) {
    const deps = limite.departamentos ?? [];
    // as próprias ações só entram quando não envolvem processo de outro departamento (foto avulsa, PDF da lista...)
    where.push(`(${deps.length ? `departamento_id IN (${deps.map(() => '?').join(',')}) OR ` : ''}(departamento_id IS NULL AND usuario_id <=> ?))`);
    params.push(...deps, limite.usuarioId ?? null);
  }
  const acoes = [...new Set([...lista(f.acao).filter((a) => ACOES[a]), ...lista(f.aba).flatMap((a) => ABAS[a]?.acoes ?? [])])];
  if (acoes.length) { where.push(`acao IN (${acoes.map(() => '?').join(',')})`); params.push(...acoes); }
  const origens = lista(f.origem).filter((o) => ORIGENS[o]);
  if (origens.length) { where.push(`origem IN (${origens.map(() => '?').join(',')})`); params.push(...origens); }
  if (['ok', 'erro'].includes(f.resultado)) { where.push('resultado = ?'); params.push(f.resultado); }
  for (const [k, col] of [['usuario_id', 'usuario_id'], ['processo_id', 'processo_id'], ['departamento_id', 'departamento_id'], ['execucao_id', 'execucao_id']]) {
    if (f[k] && /^\d+$/.test(String(f[k]))) { where.push(`${col} = ?`); params.push(Number(f[k])); }
  }
  if (f.ip) { where.push('(ip LIKE ? OR ip_cadeia LIKE ?)'); params.push(`%${f.ip}%`, `%${f.ip}%`); }
  if (DATA.test(f.de ?? '')) { where.push('created_at >= ?'); params.push(`${f.de} 00:00:00`); }
  if (DATA.test(f.ate ?? '')) { where.push('created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(f.ate); }
  if (f.q) {
    const t = `%${String(f.q).slice(0, 100)}%`;
    where.push('(resumo LIKE ? OR processo_titulo LIKE ? OR usuario_nome LIKE ? OR usuario_email LIKE ? OR erro LIKE ? OR dados_antes LIKE ? OR dados_depois LIKE ?)');
    params.push(t, t, t, t, t, t, t);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
};

/** O que a pessoa pode ver na auditoria: null = tudo (admin); gerente = departamentos dele + as próprias ações sem departamento. */
export async function limiteDoUsuario(userId, papel) {
  if (papel === 'admin') return null;
  const [rows] = await pool.query('SELECT department_id FROM user_departments WHERE user_id = ?', [userId]);
  return { departamentos: rows.map((r) => Number(r.department_id)), usuarioId: userId ?? null };
}

export async function listarAuditoria(f = {}, limite = null) {
  const porPagina = Math.min(200, Math.max(1, parseInt(f.por_pagina, 10) || 50));
  const pagina = Math.max(1, parseInt(f.pagina, 10) || 1);
  const { sql, params } = montarFiltro(f, limite);
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM processos_auditoria ${sql}`, params);
  const [itens] = await pool.query(
    `SELECT * FROM processos_auditoria ${sql} ORDER BY created_at DESC, id DESC LIMIT ${porPagina} OFFSET ${(pagina - 1) * porPagina}`, params);
  const visivel = montarFiltro({}, limite);
  const [usuarios] = await pool.query(
    `SELECT usuario_id AS id, MAX(usuario_nome) AS nome, MAX(usuario_email) AS email, MAX(usuario_papel) AS papel
       FROM processos_auditoria ${visivel.sql ? `${visivel.sql} AND` : 'WHERE'} usuario_id IS NOT NULL GROUP BY usuario_id ORDER BY nome`, visivel.params);
  const deps = limite ? limite.departamentos : null;
  const emDeps = (col) => (deps ? (deps.length ? `WHERE ${col} IN (${deps.map(() => '?').join(',')})` : 'WHERE 1 = 0') : '');
  const [departamentos] = await pool.query(`SELECT id, name AS nome FROM departments ${emDeps('id')} ORDER BY name`, deps ?? []);
  const [processos] = await pool.query(`SELECT id, title AS nome, status, department_id FROM processes ${emDeps('department_id')} ORDER BY title`, deps ?? []);
  const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return s; } };
  return {
    itens: itens.map((i) => ({ ...i, dados_antes: parse(i.dados_antes), dados_depois: parse(i.dados_depois) })),
    total: Number(total),
    pagina,
    por_pagina: porPagina,
    usuarios,
    acoes: ACOES,
    abas: Object.fromEntries(Object.entries(ABAS).map(([k, v]) => [k, v.nome])),
    origens: ORIGENS,
    campos: CAMPOS,
    status: STATUS,
    catalogo: { departamentos, processos },
  };
}
