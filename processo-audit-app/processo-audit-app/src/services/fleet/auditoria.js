// Auditoria da Frota: quem cadastrou, editou, inativou ou reativou o quê, quando e de qual IP.
// Na Frota nada é mais apagado: "excluido" só aparece em registros antigos, de antes da inativação.
// Tabela criada por scripts/migrate_frota_auditoria.js. Falha ao registrar nunca impede a ação principal.
import pool from '../../config/database.js';
import { dadosRequisicao, diferencas } from '../referral/auditoria.js';

export const ACOES = {
  criado: 'Cadastro',
  editado: 'Edição',
  inativado: 'Inativação',
  reativado: 'Reativação',
  excluido: 'Exclusão',
  cupom_lido: 'Cupom fiscal lido',
};

// `fem` só serve para o texto do resumo ("cadastrada" / "cadastrado")
export const ENTIDADES = {
  veiculo:         { nome: 'Veículo',             tabela: 'fleet_cars' },
  motorista:       { nome: 'Motorista',           tabela: 'fleet_drivers' },
  abastecimento:   { nome: 'Abastecimento',       tabela: 'fleet_fueling' },
  manutencao:      { nome: 'Manutenção',          tabela: 'fleet_maintenance_history', fem: true },
  tipo_manutencao: { nome: 'Tipo de manutenção',  tabela: 'fleet_maintenance_types' },
  troca_oleo:      { nome: 'Troca de óleo',       tabela: 'fleet_oil_changes', fem: true },
  troca_pneu:      { nome: 'Troca de pneu',       tabela: 'fleet_tire_changes', fem: true },
  cupom:           { nome: 'Cupom fiscal' },
};

const MAX_JSON = 20000;
const IGNORAR = new Set(['id', 'created_at']); // não entram na comparação de edição

const doisDig = (n) => String(n).padStart(2, '0');

// DATE do MySQL chega como Date à meia-noite local: guarda como AAAA-MM-DD para não virar data e hora UTC
const valorParaGuardar = (v) => {
  if (!(v instanceof Date)) return v;
  if (Number.isNaN(v.getTime())) return null;
  if (v.getHours() === 0 && v.getMinutes() === 0 && v.getSeconds() === 0 && v.getMilliseconds() === 0) {
    return `${v.getFullYear()}-${doisDig(v.getMonth() + 1)}-${doisDig(v.getDate())}`;
  }
  return v.toISOString();
};

/** Linha do banco pronta para guardar/comparar (exportado para teste). */
export const linha = (row) => {
  if (!row) return null;
  const r = {};
  for (const [k, v] of Object.entries(row)) r[k] = valorParaGuardar(v);
  return r;
};

const dataBr = (v) => {
  const s = valorParaGuardar(v);
  const m = typeof s === 'string' && s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (s ?? 'sem data');
};
const reais = (v) => (v === null || v === undefined || v === '' ? null : `R$ ${Number(v).toFixed(2).replace('.', ',')}`);
const nomeVeiculo = (c) => (c ? `${c.make ?? ''} ${c.model ?? ''} (${c.license_plate ?? 's/ placa'})`.replace(/\s+/g, ' ').trim() : null);

const paraJson = (v) => {
  if (v === undefined || v === null) return null;
  const s = JSON.stringify(v);
  return s.length > MAX_JSON ? JSON.stringify({ truncado: true, inicio: s.slice(0, MAX_JSON) }) : s;
};

/** Registro atual (ou null) para guardar o "antes" de uma edição/exclusão. Nunca lança. */
export async function buscar(entidade, id) {
  try {
    const tabela = ENTIDADES[entidade]?.tabela;
    if (!tabela || id === undefined || id === null) return null;
    const [[row]] = await pool.execute(`SELECT * FROM ${tabela} WHERE id = ?`, [id]);
    return linha(row);
  } catch (err) {
    console.error('[Frota] Erro ao ler registro para a auditoria:', err.message);
    return null;
  }
}

const buscarVeiculo = async (carId) => {
  if (!carId) return null;
  const [[c]] = await pool.execute('SELECT id, make, model, license_plate FROM fleet_cars WHERE id = ?', [carId]);
  return c ?? null;
};

/** Texto curto que identifica o registro no resumo ("Fiat Strada (ABC1D23)", "Abastecimento de 14/10/2026..."). */
export async function descrever(entidade, r) {
  if (!r) return '';
  switch (entidade) {
    case 'veiculo':         return nomeVeiculo(r);
    case 'motorista':       return r.name ?? `#${r.id}`;
    case 'tipo_manutencao': return r.name ?? `#${r.id}`;
    case 'abastecimento': {
      const v = nomeVeiculo(await buscarVeiculo(r.car_id)) ?? `veículo #${r.car_id}`;
      return [dataBr(r.fuel_date), r.fuel_type, reais(r.total_cost), v].filter(Boolean).join(' · ');
    }
    case 'troca_oleo': {
      const v = nomeVeiculo(await buscarVeiculo(r.car_id)) ?? `veículo #${r.car_id}`;
      return [dataBr(r.oil_change_date), reais(r.total_cost), v].filter(Boolean).join(' · ');
    }
    case 'troca_pneu': {
      const v = nomeVeiculo(await buscarVeiculo(r.car_id)) ?? `veículo #${r.car_id}`;
      return [dataBr(r.tire_change_date), v].filter(Boolean).join(' · ');
    }
    case 'manutencao': {
      const v = nomeVeiculo(await buscarVeiculo(r.car_id)) ?? `veículo #${r.car_id}`;
      let tipo = 'sem tipo';
      if (r.maintenance_type_id) {
        const [[t]] = await pool.execute('SELECT name FROM fleet_maintenance_types WHERE id = ?', [r.maintenance_type_id]);
        tipo = t?.name ?? `tipo #${r.maintenance_type_id}`;
      }
      return [tipo, dataBr(r.maintenance_date), reais(r.total_cost), v].filter(Boolean).join(' · ');
    }
    default: return '';
  }
}

const veiculoDe = (entidade, r) => {
  if (!r) return null;
  if (entidade === 'veiculo') return r.id ?? null;
  return r.car_id ?? null;
};

export async function registrar({ req, acao, entidade, entidadeId = null, veiculoId = null, resumo, antes = null, depois = null, campos = null }) {
  try {
    const d = dadosRequisicao(req);
    let nome = null;
    if (d.usuario_id) {
      const [[u]] = await pool.execute('SELECT name FROM users WHERE id = ?', [d.usuario_id]);
      nome = u?.name ?? null;
    }
    await pool.execute(
      `INSERT INTO frota_auditoria
         (acao, entidade, entidade_id, veiculo_id, resumo, campos_alterados, dados_antes, dados_depois,
          usuario_id, usuario_email, usuario_nome, ip, ip_cadeia, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        acao, entidade,
        entidadeId != null && /^\d+$/.test(String(entidadeId)) ? Number(entidadeId) : null,
        veiculoId != null && /^\d+$/.test(String(veiculoId)) ? Number(veiculoId) : null,
        String(resumo ?? ACOES[acao] ?? acao).slice(0, 500),
        campos?.length ? campos.join(',').slice(0, 500) : null,
        paraJson(antes), paraJson(depois),
        d.usuario_id, d.usuario_email, nome, d.ip, d.ip_cadeia, d.user_agent,
      ]
    );
  } catch (err) {
    console.error('[Frota] Erro ao registrar auditoria:', err.message);
  }
}

const genero = (entidade, masc, fem) => (ENTIDADES[entidade]?.fem ? fem : masc);

/** Depois de um INSERT: guarda o registro como ficou no banco. */
export async function auditarCriacao(req, entidade, id) {
  try {
    const depois = await buscar(entidade, id);
    const desc = await descrever(entidade, depois);
    await registrar({
      req, acao: 'criado', entidade, entidadeId: id, veiculoId: veiculoDe(entidade, depois),
      resumo: `${ENTIDADES[entidade].nome} ${genero(entidade, 'cadastrado', 'cadastrada')}${desc ? `: ${desc}` : ''}`,
      depois,
    });
  } catch (err) {
    console.error('[Frota] Erro ao auditar cadastro:', err.message);
  }
}

/** Depois de um UPDATE: compara com o `antes` lido com buscar() e guarda só o que mudou. */
export async function auditarEdicao(req, entidade, antes, id) {
  try {
    const depois = await buscar(entidade, id);
    if (!antes && !depois) return; // id inexistente: nada mudou
    const campos = Object.keys({ ...(antes ?? {}), ...(depois ?? {}) }).filter(c => !IGNORAR.has(c));
    const d = diferencas(antes ?? {}, depois ?? {}, campos);
    const desc = await descrever(entidade, depois ?? antes);
    const nome = ENTIDADES[entidade].nome;
    await registrar({
      req, acao: 'editado', entidade, entidadeId: id, veiculoId: veiculoDe(entidade, depois ?? antes),
      resumo: d.campos.length
        ? `${nome} ${genero(entidade, 'editado', 'editada')}${desc ? `: ${desc}` : ''}`
        : `${nome} salv${genero(entidade, 'o', 'a')} sem alterações${desc ? `: ${desc}` : ''}`,
      antes: d.campos.length ? d.antes : antes,
      depois: d.campos.length ? d.depois : null,
      campos: d.campos,
    });
  } catch (err) {
    console.error('[Frota] Erro ao auditar edição:', err.message);
  }
}

/** Depois de trocar o status (ativo/inativo): guarda o registro como estava e o status novo. */
export async function auditarStatus(req, entidade, antes, id) {
  try {
    const depois = await buscar(entidade, id);
    if (!antes || !depois || antes.status === depois.status) return; // nada mudou
    const inativou = depois.status === 'inactive';
    const desc = await descrever(entidade, depois);
    await registrar({
      req, acao: inativou ? 'inativado' : 'reativado', entidade, entidadeId: id, veiculoId: veiculoDe(entidade, depois),
      resumo: `${ENTIDADES[entidade].nome} ${inativou ? genero(entidade, 'inativado', 'inativada') : genero(entidade, 'reativado', 'reativada')}${desc ? `: ${desc}` : ''}`,
      antes, depois: { status: depois.status }, campos: ['status'],
    });
  } catch (err) {
    console.error('[Frota] Erro ao auditar troca de status:', err.message);
  }
}

/** Leitura de cupom (QR Code da NFC-e) para preencher um abastecimento. */
export async function auditarCupom(req, { url, dados }) {
  const partes = [
    dados?.fleet?.licensePlate && `placa ${dados.fleet.licensePlate}`,
    dados?.issuer?.name,
    reais(dados?.transaction?.totalValue),
  ].filter(Boolean);
  await registrar({
    req, acao: 'cupom_lido', entidade: 'cupom',
    resumo: `Cupom fiscal lido${url ? ' pelo QR Code' : ''}${partes.length ? `: ${partes.join(' · ')}` : ''}`,
    depois: { url: url ?? null, emitente: dados?.issuer ?? null, transacao: dados?.transaction ?? null, frota: dados?.fleet ?? null },
  });
}

const lista = (v) => String(v ?? '').split(',').map(s => s.trim()).filter(Boolean);
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Monta o WHERE dos filtros da tela (exportado para teste). */
export const montarFiltro = (f = {}) => {
  const where = [];
  const params = [];
  const acoes = lista(f.acao).filter(a => ACOES[a]);
  if (acoes.length) { where.push(`acao IN (${acoes.map(() => '?').join(',')})`); params.push(...acoes); }
  const entidades = lista(f.entidade).filter(e => ENTIDADES[e]);
  if (entidades.length) { where.push(`entidade IN (${entidades.map(() => '?').join(',')})`); params.push(...entidades); }
  if (f.usuario_id && /^\d+$/.test(String(f.usuario_id))) { where.push('usuario_id = ?'); params.push(Number(f.usuario_id)); }
  if (f.veiculo_id && /^\d+$/.test(String(f.veiculo_id))) { where.push('veiculo_id = ?'); params.push(Number(f.veiculo_id)); }
  if (f.ip) { where.push('(ip LIKE ? OR ip_cadeia LIKE ?)'); params.push(`%${f.ip}%`, `%${f.ip}%`); }
  if (DATA.test(f.de ?? '')) { where.push('created_at >= ?'); params.push(`${f.de} 00:00:00`); }
  if (DATA.test(f.ate ?? '')) { where.push('created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(f.ate); }
  if (f.q) {
    const t = `%${String(f.q).slice(0, 100)}%`;
    where.push('(resumo LIKE ? OR usuario_nome LIKE ? OR usuario_email LIKE ? OR dados_antes LIKE ? OR dados_depois LIKE ?)');
    params.push(t, t, t, t, t);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
};

const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return s; } };

/** Nomes que a tela usa para trocar car_id / driver_id / maintenance_type_id pelo nome. */
async function nomesParaTela() {
  // Veículos: os que existem hoje + os já apagados que aparecem na auditoria
  const [atuais] = await pool.query('SELECT id, make, model, license_plate FROM fleet_cars ORDER BY make, model');
  const veiculos = atuais.map(c => ({ id: c.id, nome: nomeVeiculo(c) }));
  const conhecidos = new Set(veiculos.map(v => v.id));
  const [apagados] = await pool.query(
    `SELECT entidade_id AS id, dados_antes FROM frota_auditoria
      WHERE entidade = 'veiculo' AND acao = 'excluido' AND entidade_id IS NOT NULL ORDER BY id DESC`
  );
  for (const a of apagados) {
    if (conhecidos.has(a.id)) continue;
    conhecidos.add(a.id);
    veiculos.push({ id: a.id, nome: `${nomeVeiculo(parse(a.dados_antes)) ?? `Veículo #${a.id}`} — apagado` });
  }
  const [motoristas] = await pool.query('SELECT id, name FROM fleet_drivers');
  const [tipos] = await pool.query('SELECT id, name FROM fleet_maintenance_types');
  return {
    veiculos,
    nomes: {
      motoristas: Object.fromEntries(motoristas.map(m => [m.id, m.name])),
      tipos: Object.fromEntries(tipos.map(t => [t.id, t.name])),
    },
  };
}

/**
 * Botão "Histórico" de um registro: os dados atuais e, para quem pode ver a auditoria,
 * tudo o que aconteceu com ele (do mais antigo ao mais novo). null se a entidade ou o registro não existe.
 */
export async function historicoDoRegistro(entidade, id, { comAuditoria }) {
  if (!ENTIDADES[entidade]?.tabela || !/^\d+$/.test(String(id))) return null;
  const registro = await buscar(entidade, id);
  if (!registro) return null;
  let historico = null;
  if (comAuditoria) {
    const [itens] = await pool.query(
      'SELECT * FROM frota_auditoria WHERE entidade = ? AND entidade_id = ? ORDER BY created_at, id',
      [entidade, Number(id)]
    );
    historico = itens.map(i => ({ ...i, dados_antes: parse(i.dados_antes), dados_depois: parse(i.dados_depois) }));
  }
  return { entidade, registro, historico, ...(await nomesParaTela()), acoes: ACOES };
}

export async function listarAuditoria(f = {}) {
  const porPagina = Math.min(200, Math.max(1, parseInt(f.por_pagina, 10) || 50));
  const pagina = Math.max(1, parseInt(f.pagina, 10) || 1);
  const { sql, params } = montarFiltro(f);

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM frota_auditoria ${sql}`, params);
  const [itens] = await pool.query(
    `SELECT * FROM frota_auditoria ${sql} ORDER BY created_at DESC, id DESC LIMIT ${porPagina} OFFSET ${(pagina - 1) * porPagina}`,
    params
  );
  const [usuarios] = await pool.query(
    `SELECT usuario_id AS id, MAX(usuario_nome) AS nome, MAX(usuario_email) AS email
       FROM frota_auditoria WHERE usuario_id IS NOT NULL GROUP BY usuario_id ORDER BY nome`
  );

  const { veiculos, nomes } = await nomesParaTela();

  return {
    itens: itens.map(i => ({ ...i, dados_antes: parse(i.dados_antes), dados_depois: parse(i.dados_depois) })),
    total: Number(total),
    pagina,
    por_pagina: porPagina,
    usuarios,
    veiculos,
    nomes,
    acoes: ACOES,
    entidades: Object.fromEntries(Object.entries(ENTIDADES).map(([k, v]) => [k, v.nome])),
  };
}
