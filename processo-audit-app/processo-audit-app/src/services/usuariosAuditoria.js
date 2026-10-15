// Auditoria do cadastro de usuários: quem criou, editou ou inativou qual usuário, quando, de qual IP e o que mudou.
// Senha nunca é guardada: só o fato de ter sido trocada. Tabela criada por scripts/migrate_usuarios_auditoria.js.
// Falha ao registrar nunca impede a ação principal.
import pool from '../config/database.js';
import { dadosRequisicao, diferencas } from './referral/auditoria.js';

export const ACOES = {
  criado: 'Cadastro',
  editado: 'Edição',
  inativado: 'Inativação',
  senha_propria: 'Troca da própria senha',
};

export const PAPEIS = { admin: 'Admin', manager: 'Manager', viewer: 'Viewer', tecnico: 'Técnico' };

// Campos comparados na edição, com o nome que a tela mostra
export const CAMPOS = {
  name: 'Nome',
  email: 'E-mail',
  role: 'Papel',
  status: 'Status',
  departamentos: 'Departamentos',
  senha: 'Senha',
};
const COMPARAR = ['name', 'email', 'role', 'status', 'departamentos'];

/** Retrato do usuário para a auditoria (sem a senha): dados do cadastro + nomes dos departamentos. Nunca lança. */
export async function retrato(id) {
  try {
    if (id === undefined || id === null || !/^\d+$/.test(String(id))) return null;
    const [[u]] = await pool.execute('SELECT id, name, email, role, status FROM users WHERE id = ?', [Number(id)]);
    if (!u) return null;
    let departamentos = [];
    try {
      const [deps] = await pool.execute(
        `SELECT COALESCE(d.name, CONCAT('#', ud.department_id)) AS nome
           FROM user_departments ud LEFT JOIN departments d ON d.id = ud.department_id
          WHERE ud.user_id = ? ORDER BY nome`,
        [u.id]
      );
      departamentos = deps.map((d) => d.nome);
    } catch (err) {
      if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
    }
    return { ...u, departamentos };
  } catch (err) {
    console.error('[Usuários] Erro ao ler usuário para a auditoria:', err.message);
    return null;
  }
}

const MAX_JSON = 20000;
const paraJson = (v) => {
  if (v === undefined || v === null) return null;
  const s = JSON.stringify(v);
  return s.length > MAX_JSON ? JSON.stringify({ truncado: true, inicio: s.slice(0, MAX_JSON) }) : s;
};

const quem = (u) => (u ? `${u.name ?? `#${u.id}`}${u.email ? ` (${u.email})` : ''}` : '');

export async function registrar({ req, acao, alvo = null, resumo, antes = null, depois = null, campos = null }) {
  try {
    const d = dadosRequisicao(req);
    let nome = null;
    if (d.usuario_id) {
      const [[u]] = await pool.execute('SELECT name FROM users WHERE id = ?', [d.usuario_id]);
      nome = u?.name ?? null;
    }
    await pool.execute(
      `INSERT INTO usuarios_auditoria
         (acao, alvo_id, alvo_nome, alvo_email, resumo, campos_alterados, dados_antes, dados_depois,
          usuario_id, usuario_email, usuario_nome, ip, ip_cadeia, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        acao, alvo?.id ?? null, alvo?.name ?? null, alvo?.email ?? null,
        String(resumo ?? ACOES[acao] ?? acao).slice(0, 500),
        campos?.length ? campos.join(',').slice(0, 500) : null,
        paraJson(antes), paraJson(depois),
        d.usuario_id, d.usuario_email, nome, d.ip, d.ip_cadeia, d.user_agent,
      ]
    );
  } catch (err) {
    console.error('[Usuários] Erro ao registrar auditoria:', err.message);
  }
}

/** Depois de criar: guarda o usuário como ficou. `publico` = cadastro por conta própria (/register). */
export async function auditarCriacao(req, id, { publico = false } = {}) {
  const depois = await retrato(id);
  if (!depois) return;
  await registrar({
    req, acao: 'criado', alvo: depois,
    resumo: `${publico ? 'Cadastro por conta própria' : 'Usuário criado'}: ${quem(depois)}`,
    depois,
  });
}

/** Depois de editar: compara com o `antes` lido com retrato() e guarda só o que mudou; `senhaTrocada` entra como campo. */
export async function auditarEdicao(req, antes, id, { senhaTrocada = false } = {}) {
  const depois = await retrato(id);
  if (!antes && !depois) return; // id inexistente: nada mudou
  const d = diferencas(antes ?? {}, depois ?? {}, COMPARAR);
  if (senhaTrocada) {
    d.campos.push('senha');
    d.antes.senha = '••••••';
    d.depois.senha = 'nova senha definida';
  }
  const alvo = depois ?? antes;
  await registrar({
    req, acao: 'editado', alvo,
    resumo: d.campos.length
      ? `Usuário editado: ${quem(alvo)} — ${d.campos.map((c) => CAMPOS[c] ?? c).join(', ')}`
      : `Usuário salvo sem alterações: ${quem(alvo)}`,
    antes: d.campos.length ? d.antes : antes,
    depois: d.campos.length ? d.depois : null,
    campos: d.campos,
  });
}

/** Depois de inativar: só registra se o usuário estava ativo. */
export async function auditarInativacao(req, antes, id) {
  const depois = await retrato(id);
  if (!antes || !depois || antes.status === depois.status) return;
  await registrar({
    req, acao: 'inativado', alvo: depois,
    resumo: `Usuário inativado: ${quem(depois)}`,
    antes, depois: { status: depois.status }, campos: ['status'],
  });
}

/** O próprio usuário trocou a senha (Minha Conta). */
export async function auditarSenhaPropria(req, id) {
  const alvo = await retrato(id);
  if (!alvo) return;
  await registrar({
    req, acao: 'senha_propria', alvo,
    resumo: `Senha trocada pelo próprio usuário: ${quem(alvo)}`,
    antes: { senha: '••••••' }, depois: { senha: 'nova senha definida' }, campos: ['senha'],
  });
}

/* ── Consulta da tela ── */
const lista = (v) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const inteiro = (v) => (v && /^\d+$/.test(String(v)) ? Number(v) : null);

/** WHERE dos filtros da tela (exportado para teste). */
export const montarFiltro = (f = {}) => {
  const where = [];
  const params = [];
  const acoes = lista(f.acao).filter((a) => ACOES[a]);
  if (acoes.length) { where.push(`acao IN (${acoes.map(() => '?').join(',')})`); params.push(...acoes); }
  if (inteiro(f.alvo_id)) { where.push('alvo_id = ?'); params.push(inteiro(f.alvo_id)); }
  if (inteiro(f.usuario_id)) { where.push('usuario_id = ?'); params.push(inteiro(f.usuario_id)); }
  if (f.ip) { where.push('(ip LIKE ? OR ip_cadeia LIKE ?)'); params.push(`%${f.ip}%`, `%${f.ip}%`); }
  if (DATA.test(f.de ?? '')) { where.push('created_at >= ?'); params.push(`${f.de} 00:00:00`); }
  if (DATA.test(f.ate ?? '')) { where.push('created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(f.ate); }
  if (f.q) {
    const t = `%${String(f.q).slice(0, 100)}%`;
    where.push('(resumo LIKE ? OR alvo_nome LIKE ? OR alvo_email LIKE ? OR usuario_nome LIKE ? OR usuario_email LIKE ?)');
    params.push(t, t, t, t, t);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
};

const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return s; } };

export async function listar(f = {}) {
  const porPagina = Math.min(200, Math.max(1, parseInt(f.por_pagina, 10) || 50));
  const pagina = Math.max(1, parseInt(f.pagina, 10) || 1);
  const { sql, params } = montarFiltro(f);

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM usuarios_auditoria ${sql}`, params);
  const [itens] = await pool.query(
    `SELECT * FROM usuarios_auditoria ${sql} ORDER BY created_at DESC, id DESC LIMIT ${porPagina} OFFSET ${(pagina - 1) * porPagina}`,
    params
  );
  const [autores] = await pool.query(
    `SELECT usuario_id AS id, MAX(usuario_nome) AS nome, MAX(usuario_email) AS email
       FROM usuarios_auditoria WHERE usuario_id IS NOT NULL GROUP BY usuario_id ORDER BY nome`
  );
  const [alvos] = await pool.query(
    `SELECT alvo_id AS id, MAX(alvo_nome) AS nome, MAX(alvo_email) AS email
       FROM usuarios_auditoria WHERE alvo_id IS NOT NULL GROUP BY alvo_id ORDER BY nome`
  );

  return {
    itens: itens.map((i) => ({ ...i, dados_antes: parse(i.dados_antes), dados_depois: parse(i.dados_depois) })),
    total: Number(total),
    pagina,
    por_pagina: porPagina,
    autores,
    alvos,
    acoes: ACOES,
    campos: CAMPOS,
    papeis: PAPEIS,
  };
}
