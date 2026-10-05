/**
 * Importa a planilha CONTROLE_DE_ESTOQUE_CONEXAO_WEB (já extraída em scripts/data/controle_estoque.json)
 * para os módulos Estoque e Ordens de Serviço, reproduzindo o histórico em ordem cronológica
 * pelas mesmas regras do estoqueService (nada de INSERT direto em saldos/posse).
 *
 *   node scripts/import_controle_estoque.js            # aborta se já houver itens de estoque
 *
 * Inconsistências da planilha (saldo negativo, retirada/baixa sem saldo, material sem lote) NÃO são
 * escondidas: o que faltar vira uma movimentação tipo `ajuste` com observação "AJUSTE DE IMPORTAÇÃO".
 */
import fs from 'fs';
import pool from '../src/config/database.js';
import * as svc from '../src/services/estoqueService.js';

const data = JSON.parse(fs.readFileSync(new URL('./data/controle_estoque.json', import.meta.url)));
const HOJE = new Date().toISOString().slice(0, 10);

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const title = (s) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
const q2 = (n) => Math.round(Number(n) * 100) / 100;

// datas digitadas errado na planilha: ano 2006 -> 2026; data futura -> inverte dia/mês
const fixDate = (d, notas) => {
  let [y, m, day] = d.split('-').map(Number);
  const orig = d;
  if (y < 2020) y += 20;
  let out = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (out > HOJE && day <= 12) out = `${y}-${String(day).padStart(2, '0')}-${String(m).padStart(2, '0')}`;
  if (out !== orig) notas.push(`data ${orig} corrigida para ${out}`);
  return out;
};
const anteriores = () => `${data.retiradas.filter((x) => x.linha < 39).length} retiradas e ${data.terceirizada.filter((x) => x.linha < 68).length} retiradas de terceirizadas anteriores ao balanço`;
const ts = (d) => `${d} 12:00:00`;

const notas = [];
const ajustes = [];
const ignorados = [];

const [[admin]] = await pool.query("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1");
if (!admin) throw new Error('Nenhum usuário admin encontrado');
const actor = { id: admin.id, role: 'admin', tecnicoId: null };
const [[{ n: jaTem }]] = await pool.query('SELECT COUNT(*) n FROM estoque_itens');
if (jaTem > 0) throw new Error('Já existem itens de estoque: importação abortada para não duplicar dados.');

/* ── Fornecedores ── */
const fornId = {};
for (const f of data.fornecedores) {
  const [r] = await pool.query('INSERT INTO fornecedores (nome, cnpj, contato) VALUES (?,?,?)', [f.nome, f.cnpj || null, f.contato || null]);
  fornId[norm(f.nome)] = r.insertId;
}

/* ── Técnicos / equipes ── */
const tecId = {};
const tecInfo = {};
const garantirTecnico = async (nome, tipo, obs) => {
  const k = norm(nome);
  if (tecId[k]) return tecId[k];
  const [r] = await pool.query('INSERT INTO tecnicos (nome, tipo) VALUES (?,?)', [title(nome), tipo]);
  tecId[k] = r.insertId; tecInfo[k] = { tipo, obs };
  return r.insertId;
};
for (const t of data.tecnicos) await garantirTecnico(t.nome, t.tipo === 'TERCEIRIZADA' ? 'terceirizado' : 'interno', t.obs);
const SEM_ID = 'SEM IDENTIFICACAO (PLANILHA)';

/* ── Itens ── */
const itemId = {};
const itemUn = {};
const unidadeDe = (nome) => (/^(CABO|CORDOALHA)\b/.test(norm(nome)) ? 'metros' : 'pecas');
const garantirItem = async (nome, categoria, minimo) => {
  const k = norm(nome);
  if (itemId[k]) return itemId[k];
  const un = unidadeDe(nome);
  const [r] = await pool.query('INSERT INTO estoque_itens (nome, categoria, unidade, estoque_minimo) VALUES (?,?,?,?)',
    [nome.trim(), ['Insumo', 'Patrimônio'].includes(categoria) ? categoria : null, un, minimo || 0]);
  itemId[k] = r.insertId; itemUn[k] = un;
  return r.insertId;
};
for (const i of data.itens) await garantirItem(i.nome, i.tipo, i.minimo);

/* ── Eventos em ordem cronológica ── */
const eventos = [];
let seq = 0;
const add = (kind, ord, e) => eventos.push({ kind, ord, seq: seq++, ...e, data: fixDate(e.data, notas) });
for (const c of data.compras) add('compra', 0, c);
// A planilha só soma RETIRADOS (linha >= 39) e TERCERIZADA (linha >= 68); o que vem antes é histórico anterior ao balanço de estoque.
const LINHA_INICIO = { retiradas: 39, terceirizada: 68 };
for (const r of data.retiradas.filter((x) => x.linha >= LINHA_INICIO.retiradas)) add('retirada', 1, { ...r, tipoTec: 'interno' });
for (const r of data.terceirizada.filter((x) => x.linha >= LINHA_INICIO.terceirizada)) add('retirada', 1, { ...r, tipoTec: 'terceirizado' });
for (const d of data.devolucoes) add('devolucao', 2, d);
for (const b of data.baixas) add('baixa', 3, b);
eventos.sort((a, b) => a.data.localeCompare(b.data) || a.ord - b.ord || a.seq - b.seq);

/* ── Helpers de estoque ── */
const setMovData = (id, d) => pool.query('UPDATE estoque_movimentacoes SET criado_em = ? WHERE id = ?', [ts(d), id]);

const almoxLotes = async (item) => (await pool.query(
  `SELECT l.id, l.codigo, l.saldo_atual - COALESCE((SELECT SUM(p.quantidade) FROM estoque_posse p WHERE p.lote_id = l.id),0) AS livre
   FROM estoque_lotes l WHERE l.item_id = ? HAVING livre > 0 ORDER BY l.id`, [item]))[0];
const posseLotes = async (tec, item) => (await pool.query(
  `SELECT p.lote_id AS id, l.codigo, p.quantidade FROM estoque_posse p JOIN estoque_lotes l ON l.id = p.lote_id
   WHERE p.tecnico_id = ? AND l.item_id = ? AND p.quantidade > 0 ORDER BY p.lote_id`, [tec, item]))[0];
const preferir = (lotes, cod) => (cod ? [...lotes.filter((l) => l.codigo === cod), ...lotes.filter((l) => l.codigo !== cod)] : lotes);

const criarLoteAjuste = async (item, qtd, d, motivo) => {
  const { lotes } = await svc.criarCompra({ item_id: item, tipo_volume: 'unidade', qtd_volumes: 1, medida_por_volume: qtd }, admin.id);
  const l = lotes[0];
  await pool.query("UPDATE estoque_movimentacoes SET tipo = 'ajuste', observacao = ?, criado_em = ? WHERE lote_id = ? AND tipo = 'entrada'", [motivo, ts(d), l.id]);
  await pool.query('UPDATE estoque_compras SET criado_em = ? WHERE id = ?', [ts(d), l.compra_id]);
  ajustes.push({ item: Object.keys(itemId).find((k) => itemId[k] === item), qtd, motivo, data: d });
  return l;
};

// tira `qtd` do almoxarifado para o técnico (lote preferido primeiro, depois FIFO); falta vira ajuste
const retirarParaTecnico = async (tec, item, qtd, d, cod, obs, motivoFalta) => {
  let resto = q2(qtd);
  for (const l of preferir(await almoxLotes(item), cod)) {
    if (resto <= 0) break;
    const x = Math.min(resto, q2(l.livre));
    const r = await svc.retirar({ lote_id: l.id, tecnico_id: tec, quantidade: x, observacao: obs }, admin.id);
    await setMovData(r.movimentacao_id, d); resto = q2(resto - x);
  }
  if (resto > 0) {
    const l = await criarLoteAjuste(item, resto, d, `AJUSTE DE IMPORTAÇÃO: ${motivoFalta}`);
    const r = await svc.retirar({ lote_id: l.id, tecnico_id: tec, quantidade: resto, observacao: `AJUSTE DE IMPORTAÇÃO: ${motivoFalta}` }, admin.id);
    await setMovData(r.movimentacao_id, d);
  }
};
const garantirPosse = async (tec, item, qtd, d, motivo) => {
  const tem = (await posseLotes(tec, item)).reduce((s, l) => s + Number(l.quantidade), 0);
  if (tem < qtd) await retirarParaTecnico(tec, item, q2(qtd - tem), d, null, null, motivo);
};

/* ── OS (uma por técnico + identificação do serviço) ── */
const osMap = {};
const obterOS = async (tec, texto, d) => {
  const k = `${tec}|${norm(texto)}`;
  if (osMap[k]) { osMap[k].ultima = d; return osMap[k].id; }
  const cliente = texto || 'Baixas sem OS informada';
  const { id } = await svc.criarOS({ cliente, tecnico_id: tec, descricao: 'Importada da planilha de controle de estoque' }, admin.id);
  osMap[k] = { id, primeira: d, ultima: d };
  return id;
};

/* ── Replay ── */
let nLotesLegado = 0;
const legado = {};
for (const l of data.lotes) (legado[norm(l.material)] ||= []).push(l);

for (const e of eventos) {
  const d = e.data;
  if (e.kind === 'compra') {
    const item = await garantirItem(e.material, null, 0);
    const lotesLeg = legado[norm(e.material)] || [];
    const comVol = e.tipo_volume === 'BOBINA' && e.qtd_volumes > 0 && lotesLeg.length === e.qtd_volumes;
    const out = await svc.criarCompra({
      item_id: item, fornecedor_id: fornId[norm(e.fornecedor)] || null, nf: e.nf ? String(e.nf).slice(0, 60) : null,
      tipo_volume: comVol ? 'bobina' : 'unidade', qtd_volumes: comVol ? e.qtd_volumes : 1, medida_por_volume: comVol ? e.medida : e.qtd,
    }, admin.id);
    if (comVol) {
      for (let i = 0; i < out.lotes.length; i++) { // preserva os códigos escritos nas bobinas
        await pool.query('UPDATE estoque_lotes SET codigo = ? WHERE id = ?', [lotesLeg[i].codigo, out.lotes[i].id]); nLotesLegado++;
      }
    }
    await pool.query('UPDATE estoque_compras SET criado_em = ? WHERE id = ?', [ts(d), out.compra.id]);
    await pool.query('UPDATE estoque_lotes SET criado_em = ? WHERE compra_id = ?', [ts(d), out.compra.id]);
    await pool.query("UPDATE estoque_movimentacoes SET criado_em = ?, observacao = ? WHERE tipo = 'entrada' AND lote_id IN (SELECT id FROM estoque_lotes WHERE compra_id = ?)",
      [ts(d), [e.obs, e.nf ? `NF ${e.nf}` : null].filter(Boolean).join(' | ').slice(0, 500) || null, out.compra.id]);
    continue;
  }

  if (!e.material) { ignorados.push(`${e.kind} linha ${e.linha}: sem material (qtd ${e.qtd})`); continue; }
  const item = await garantirItem(e.material, null, 0);
  const tipoTec = e.tipoTec || 'terceirizado';
  const tec = await garantirTecnico(e.usuario || SEM_ID, tipoTec, null);
  const cod = e.lote || null;

  if (e.kind === 'retirada') {
    await retirarParaTecnico(tec, item, e.qtd, d, cod, [e.obs, `Planilha (linha ${e.linha})`].filter(Boolean).join(' | '), 'saldo insuficiente no estoque (compra/estoque inicial não registrado na planilha)');
  } else if (e.kind === 'devolucao') {
    await garantirPosse(tec, item, e.qtd, d, 'devolução sem retirada correspondente na planilha');
    let resto = q2(e.qtd);
    for (const l of preferir(await posseLotes(tec, item), cod)) {
      if (resto <= 0) break;
      const x = Math.min(resto, q2(l.quantidade));
      const r = await svc.devolver({ lote_id: l.id, tecnico_id: tec, quantidade: x, condicao: e.estado === 'novo' ? 'novo' : 'usado', observacao: e.obs || null }, admin.id);
      await setMovData(r.movimentacao_id, d); resto = q2(resto - x);
    }
  } else if (e.kind === 'baixa') {
    await garantirPosse(tec, item, e.qtd, d, 'baixa sem material em posse do técnico/equipe na planilha');
    const os = await obterOS(tec, e.os, d);
    let resto = q2(e.qtd);
    for (const l of preferir(await posseLotes(tec, item), cod)) {
      if (resto <= 0) break;
      const x = Math.min(resto, q2(l.quantidade));
      const r = await svc.baixarEmOS({ os_id: os, lote_id: l.id, quantidade: x, observacao: [e.obs, `Planilha (linha ${e.linha})`].filter(Boolean).join(' | ') }, actor);
      await setMovData(r.movimentacao_id, d); resto = q2(resto - x);
    }
  }
}

/* ── Fecha as OS importadas e acerta datas ── */
for (const o of Object.values(osMap)) {
  await svc.fecharOS({ os_id: o.id }, actor);
  await pool.query('UPDATE ordens_servico SET criado_em = ?, concluida_em = ? WHERE id = ?', [ts(o.primeira), ts(o.ultima), o.id]);
  await pool.query("UPDATE os_historico_status SET criado_em = ? WHERE os_id = ? AND para IN ('aberta','em_andamento')", [ts(o.primeira), o.id]);
  await pool.query("UPDATE os_historico_status SET criado_em = ? WHERE os_id = ? AND para = 'concluida'", [ts(o.ultima), o.id]);
}
for (const [k, t] of Object.entries(tecInfo)) {
  if (t.obs && /N[ÃA]O PRESTA/i.test(t.obs)) await pool.query('UPDATE tecnicos SET ativo = 0, empresa = ? WHERE id = ?', [t.obs, tecId[k]]);
}

/* ── Relatório ── */
const [[c]] = await pool.query(`SELECT (SELECT COUNT(*) FROM estoque_itens) itens, (SELECT COUNT(*) FROM estoque_lotes) lotes,
  (SELECT COUNT(*) FROM estoque_movimentacoes) movs, (SELECT COUNT(*) FROM tecnicos) tecnicos, (SELECT COUNT(*) FROM ordens_servico) os,
  (SELECT COUNT(*) FROM fornecedores) fornecedores`);
console.log('✅ Importação concluída:', c);
console.log(`Lotes com código original da planilha: ${nLotesLegado}`);
console.log(`Ajustes de importação (diferenças da planilha): ${ajustes.length}`);
for (const a of ajustes) console.log(`  - ${a.data} ${a.item}: +${a.qtd} (${a.motivo.replace('AJUSTE DE IMPORTAÇÃO: ', '')})`);
if (notas.length) console.log('Datas corrigidas:', [...new Set(notas)]);
console.log('Fora da importação (mesmo critério da planilha):', anteriores());
if (ignorados.length) console.log('Linhas ignoradas:', ignorados);
await pool.end();
