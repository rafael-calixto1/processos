import React, { useState, useRef, useMemo } from 'react';
import { Printer, PackagePlus, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { estoqueAPI, cadastrosAPI } from '../api/estoque';
import { FornecedorForm } from './EstoqueCadastros';
import { Modal, Combobox, AsyncState, useLoad, useToasts, Field, LabelSheet, fmtNum, fmtQtd, fmtDataHora, styles as s } from '../components/estoque/ui';
import { Select } from '../components/Select/Select';

const VOLUMES = { bobina: 'Bobina', caixa: 'Caixa', rolo: 'Rolo', unidade: 'Unidade' };

let seq = 0;
const novaLinha = () => ({ uid: ++seq, item_id: '', usaLote: null, tipo_volume: '', qtd_volumes: '', medida_por_volume: '', ajustes: {}, nomes: {} }); // nada pré-preenchido

const nLotesDe = (l) => Math.min(Math.max(Math.floor(Number(l.qtd_volumes)) || 0, 0), 500);
const medidasDe = (l) => Array.from({ length: nLotesDe(l) }, (_, i) => l.ajustes[i] ?? l.medida_por_volume);

/* Um item da compra: item, forma de registro, volumes e (opcional) nome/medida de cada lote */
const LinhaCompra = ({ linha, indice, itens, podeRemover, onChange, onRemover }) => {
  const item = (itens || []).find((i) => String(i.id) === String(linha.item_id));
  const unid = item?.unidade === 'metros' ? 'metros' : 'peças';
  const passo = item?.unidade === 'metros' ? '0.01' : '1'; // peças: só inteiros
  const medidas = medidasDe(linha);
  const total = linha.usaLote ? medidas.reduce((a, m) => a + (Number(m) || 0), 0) : Number(linha.medida_por_volume) || 0;
  const set = (patch) => onChange({ ...linha, ...patch });
  const setBase = (patch) => set({ ...patch, ajustes: {} });

  return (
    <div className={s.span2} style={{ border: '1px solid #dfe9db', borderRadius: 16, padding: 16, background: '#fff', display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ color: 'var(--accent-color)' }}>Item {indice + 1}</strong>
        {podeRemover && <button type="button" className={`${s.btn} ${s.btnSm}`} onClick={onRemover} aria-label={`Remover item ${indice + 1}`}><Trash2 size={16} />Remover</button>}
      </div>
      <Field label="Item">
        <Combobox value={linha.item_id} onChange={(v) => set({ item_id: v })} required placeholder="Selecione o item…"
          options={(itens || []).map((i) => ({ value: i.id, label: i.nome, sub: `${i.categoria ? i.categoria + ' · ' : ''}saldo ${fmtQtd(i.saldo, i.unidade)}`, tag: i.unidade === 'metros' ? 'metros' : 'unidades' }))} />
      </Field>
      <Field label="Como registrar esta entrada?">
        <Select value={linha.usaLote === null ? '' : linha.usaLote ? 'sim' : 'nao'} required onChange={(e) => set({ usaLote: e.target.value === '' ? null : e.target.value === 'sim' })}>
          <option value="">Selecione…</option>
          <option value="sim">Gerar lotes (bobinas, rolos, caixas — com etiqueta QR)</option>
          <option value="nao">Apenas unidades (sem lote nem etiqueta)</option>
        </Select>
      </Field>
      {linha.usaLote !== null && (
      <div className={`${s.form} ${s.cols2}`}>
        {linha.usaLote && (<>
          <Field label="Tipo de volume"><Select value={linha.tipo_volume} required onChange={(e) => setBase({ tipo_volume: e.target.value })}><option value="">Selecione…</option>{Object.entries(VOLUMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Nº de volumes"><input type="number" min="1" max="500" step="1" value={linha.qtd_volumes} onChange={(e) => setBase({ qtd_volumes: e.target.value })} required /></Field>
        </>)}
        <Field label={linha.usaLote ? `Medida por volume (${unid})` : `Quantidade (${unid})`} className={s.span2}>
          <input type="number" min={passo} step={passo} value={linha.medida_por_volume} onChange={(e) => setBase({ medida_por_volume: e.target.value })} required />
        </Field>
      </div>
      )}
      {linha.usaLote !== null && (
      <div className={`${s.callout} ${s.calloutKeep}`}>
        <PackagePlus size={20} aria-hidden="true" />
        {linha.usaLote
          ? <span>Serão gerados <b>{nLotesDe(linha)} lote(s)</b>{total > 0 && item && <> totalizando <b>{fmtQtd(total, item.unidade)}</b></>}.</span>
          : <span>Entrarão <b>{fmtQtd(Number(linha.medida_por_volume) || 0, item?.unidade || 'pecas')}</b> no estoque, sem etiqueta por volume.</span>}
      </div>
      )}
      {linha.usaLote === true && linha.tipo_volume && nLotesDe(linha) > 0 && (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Lotes que serão gerados — dê um nome a cada lote (opcional) e ajuste a medida</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
            {medidas.map((m, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid #dfe9db', borderRadius: 12, background: '#fbfdf9' }}>
                <span style={{ whiteSpace: 'nowrap', fontSize: 13, fontWeight: 700, minWidth: 64 }}>{VOLUMES[linha.tipo_volume]} {i + 1}</span>
                <input type="text" maxLength={40} value={linha.nomes[i] || ''} placeholder="Nome (ex.: BOB-011-06)" aria-label={`Nome do lote ${i + 1}`}
                  style={{ flex: 1, minWidth: 0, textTransform: 'uppercase' }} onChange={(e) => set({ nomes: { ...linha.nomes, [i]: e.target.value } })} />
                <input type="number" min={passo} step={passo} value={m} required style={{ width: 96, flex: 'none' }} aria-label={`Medida do lote ${i + 1}`}
                  onChange={(e) => set({ ajustes: { ...linha.ajustes, [i]: e.target.value } })} />
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>O nome vira o código do lote e da etiqueta QR. Deixe em branco para gerar automaticamente (ex.: LOTE-BOB-0001).</div>
        </div>
      )}
    </div>
  );
};

const TIPO_MOV = { entrada: 'Entrada', retirada: 'Retirada', devolucao: 'Devolução', baixa_os: 'Baixa em OS', estorno: 'Estorno', ajuste: 'Ajuste' };
const rowBtn = { cursor: 'pointer' };
const toggleKey = (fn) => (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };

/* Histórico de um lote */
export const HistoricoLote = ({ lote }) => {
  const h = useLoad(() => estoqueAPI.historicoLote(lote.id), [lote.id]);
  return (
    <AsyncState loading={h.loading} error={h.error} onRetry={h.reload} empty={(h.data || []).length === 0} emptyTitle="Sem movimentações">
      <div className={s.tableWrap}><table className={s.table}>
        <thead><tr><th>Data</th><th>Tipo</th><th>Quantidade</th><th>Técnico / OS</th><th>Por</th><th>Obs.</th></tr></thead>
        <tbody>{(h.data || []).map((m) => (
          <tr key={m.id}><td data-label="Data">{fmtDataHora(m.criado_em)}</td><td data-label="Tipo">{TIPO_MOV[m.tipo] || m.tipo}{m.condicao ? ` (${m.condicao})` : ''}</td>
            <td data-label="Quantidade">{fmtQtd(m.quantidade, lote.unidade)}</td>
            <td data-label="Técnico / OS">{[m.tecnico_nome, m.os_numero && `OS ${m.os_numero}`].filter(Boolean).join(' · ') || '—'}</td>
            <td data-label="Por">{m.usuario_nome || '—'}</td><td data-label="Obs.">{m.observacao || '—'}</td></tr>))}</tbody></table></div>
    </AsyncState>
  );
};

/* Compra → itens (ex.: "3 × 3.000 Bobina") → lotes; o lote abre num modal com o histórico. */
const DetalheCompra = ({ linhas }) => {
  const d = useLoad(() => estoqueAPI.detalheCompra(linhas.map((x) => x.id)), [linhas.map((x) => x.id).join(',')]);
  const [itemAberto, setItemAberto] = useState(null);
  const [loteAberto, setLoteAberto] = useState(null); // lote exibido no modal
  const lotes = d.data || [];
  return (
    <AsyncState loading={d.loading} error={d.error} onRetry={d.reload}>
      {linhas.map((x) => {
        const ls = lotes.filter((l) => l.compra_id === x.id); const aberto = itemAberto === x.id;
        const toggle = () => { setItemAberto(aberto ? null : x.id); };
        return (
          <div key={x.id} style={{ marginBottom: 8 }}>
            <div onClick={toggle} onKeyDown={toggleKey(toggle)} tabIndex={0} role="button" aria-expanded={aberto} style={{ ...rowBtn, padding: '8px 0', fontWeight: 600 }}>
              {aberto ? '▾' : '▸'} {x.item_nome} — {x.qtd_volumes} × {fmtNum(x.medida_por_volume)} ({VOLUMES[x.tipo_volume]})
            </div>
            {aberto && (ls.length === 0 ? <p className={s.sub}>Entrada sem lotes: só a quantidade entrou no estoque.</p> : (
              <div className={s.tableWrap}><table className={s.table}>
                <thead><tr><th>Lote</th><th>Saldo</th><th>Almoxarifado</th><th>Com técnicos</th><th>Consumido</th></tr></thead>
                <tbody>{ls.map((l) => {
                  const t = () => setLoteAberto(l);
                  return (
                    <tr key={l.id} onClick={t} onKeyDown={toggleKey(t)} tabIndex={0} title="Ver detalhes e histórico do lote" style={rowBtn}>
                      <td data-label="Lote"><b>{l.codigo}</b></td>
                      <td data-label="Saldo">{fmtQtd(l.saldo_atual, l.unidade)} / {fmtQtd(l.saldo_inicial, l.unidade)}</td>
                      <td data-label="Almoxarifado">{fmtQtd(l.no_almoxarifado, l.unidade)}</td>
                      <td data-label="Com técnicos">{l.com_tecnicos.length ? l.com_tecnicos.map((p) => <div key={p.tecnico}>{p.tecnico}: {fmtQtd(p.quantidade, l.unidade)}</div>) : '—'}</td>
                      <td data-label="Consumido">{fmtQtd(l.consumido, l.unidade)}</td></tr>);
                })}</tbody></table></div>
            ))}
          </div>
        );
      })}
      {loteAberto && (
        <Modal title={`Lote ${loteAberto.codigo}`} onClose={() => setLoteAberto(null)}>
          <p className={s.sub}>{loteAberto.item_nome} · saldo {fmtQtd(loteAberto.saldo_atual, loteAberto.unidade)} de {fmtQtd(loteAberto.saldo_inicial, loteAberto.unidade)}
            {' · '}almoxarifado {fmtQtd(loteAberto.no_almoxarifado, loteAberto.unidade)}
            {loteAberto.com_tecnicos.length ? ` · com ${loteAberto.com_tecnicos.map((p) => `${p.tecnico} (${fmtQtd(p.quantidade, loteAberto.unidade)})`).join(', ')}` : ''}</p>
          <h3 className={s.cardTitle}>Histórico</h3>
          <HistoricoLote lote={loteAberto} />
        </Modal>
      )}
    </AsyncState>
  );
};

const EstoqueEntrada = () => {
  const itens = useLoad(() => estoqueAPI.itens());
  const forn = useLoad(() => cadastrosAPI.fornecedores());
  const hist = useLoad(() => estoqueAPI.compras());
  const [comum, setComum] = useState({ fornecedor_id: '', nf: '' });
  const [linhas, setLinhas] = useState(() => [novaLinha()]);
  const [novoForn, setNovoForn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState(null);
  const chave = useRef(crypto.randomUUID()); // idempotência: duplo clique não gera lotes em dobro
  const { notify, toasts } = useToasts();
  const setC = (k) => (e) => setComum({ ...comum, [k]: e.target.value });
  const mudar = (uid, nova) => setLinhas((l) => l.map((x) => (x.uid === uid ? nova : x)));
  const itemDe = (l) => (itens.data || []).find((i) => String(i.id) === String(l.item_id));

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const ids = linhas.map((l) => String(l.item_id));
      if (new Set(ids).size !== ids.length) throw new Error('O mesmo item aparece mais de uma vez: junte em uma única linha');
      const payload = linhas.map((l) => {
        const medidas = medidasDe(l);
        if (l.usaLote === null) throw new Error('Escolha como registrar cada item');
        if (l.usaLote && !l.tipo_volume) throw new Error('Escolha o tipo de volume');
        if (l.usaLote && medidas.some((m) => !(Number(m) > 0))) throw new Error('Informe a medida de todos os lotes');
        return l.usaLote
          ? { item_id: l.item_id, tipo_volume: l.tipo_volume, qtd_volumes: nLotesDe(l), medida_por_volume: l.medida_por_volume, medidas: medidas.map(Number), nomes: medidas.map((_, i) => (l.nomes[i] || '').trim()) }
          : { item_id: l.item_id, tipo_volume: 'unidade', qtd_volumes: 1, medida_por_volume: l.medida_por_volume };
      });
      const out = await estoqueAPI.criarCompra({ ...comum, itens: payload, chave_idempotencia: chave.current });
      const feitas = (out.linhas || [{ compra: out.compra, lotes: out.lotes }]).map((r, i) => ({ ...r, item: itemDe(linhas[i]), semLote: !linhas[i].usaLote, qtd: Number(linhas[i].medida_por_volume) }));
      setResultado({ linhas: feitas });
      chave.current = crypto.randomUUID();
      const nLotes = feitas.filter((r) => !r.semLote).reduce((a, r) => a + r.lotes.length, 0);
      notify(nLotes ? `${nLotes} lote(s) gerado(s)` : 'Entrada registrada'); hist.reload(); itens.reload();
    } catch (err) { notify(err.message, 'err'); } finally { setBusy(false); }
  };

  const novaEntrada = () => { setResultado(null); setLinhas([novaLinha()]); setComum({ fornecedor_id: '', nf: '' }); };
  const lotesEtiqueta = resultado ? resultado.linhas.filter((r) => !r.semLote).flatMap((r) => r.lotes.map((l) => ({ ...l, item_nome: r.item?.nome, unidade: r.item?.unidade }))) : [];

  // histórico: agrupa as linhas de uma mesma compra (grupo_id)
  const [aberta, setAberta] = useState(null);
  const compras = useMemo(() => {
    const m = new Map();
    for (const c of hist.data || []) {
      const key = c.grupo_id || `c${c.id}`;
      const g = m.get(key) || { key, ...c, linhas: [] };
      g.linhas.push(c); m.set(key, g);
    }
    return [...m.values()];
  }, [hist.data]);

  return (
    <div className={s.page}>
      <div><h1 className={s.title}>Entrada / Compra</h1><p className={s.sub}>Uma compra pode ter vários itens. Com lotes, cada volume ganha código único e etiqueta QR; sem lotes, só a quantidade entra no estoque</p></div>
      {!resultado ? (
        <form className={`${s.card} ${s.form} ${s.cols2}`} onSubmit={submit}>
          <Field label="Fornecedor">
            <div className={s.inline}>
              <Select style={{ flex: 1, minWidth: 0 }} value={comum.fornecedor_id} onChange={setC('fornecedor_id')}><option value="">—</option>{(forn.data || []).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</Select>
              <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => setNovoForn(true)} title="Cadastrar novo fornecedor" aria-label="Cadastrar novo fornecedor"><Plus size={18} /></button>
            </div>
          </Field>
          <Field label="Nota fiscal (opcional)"><input value={comum.nf} onChange={setC('nf')} /></Field>

          {linhas.map((l, i) => (
            <LinhaCompra key={l.uid} linha={l} indice={i} itens={itens.data} podeRemover={linhas.length > 1}
              onChange={(nova) => mudar(l.uid, nova)} onRemover={() => setLinhas((x) => x.filter((y) => y.uid !== l.uid))} />
          ))}

          <button type="button" className={`${s.btn} ${s.span2}`} onClick={() => setLinhas((l) => [...l, novaLinha()])}><Plus size={18} />Adicionar outro item à compra</button>
          <button className={`${s.btn} ${s.btnPrimary} ${s.span2}`} disabled={busy}>
            {busy ? 'Registrando…' : linhas.some((l) => l.usaLote) ? 'Registrar entrada e gerar lotes' : 'Registrar entrada'}
          </button>
        </form>
      ) : (
        <div className={s.card}>
          <div className={s.head}>
            <h2 className={s.cardTitle}><CheckCircle2 size={18} style={{ verticalAlign: -3, color: '#166534' }} /> Entrada registrada: {resultado.linhas.length} {resultado.linhas.length === 1 ? 'item' : 'itens'}{lotesEtiqueta.length ? `, ${lotesEtiqueta.length} lote(s) com etiqueta` : ''}</h2>
            <div className={`${s.actions} ${s.noPrint}`}>
              {lotesEtiqueta.length > 0 && <button className={s.btn} onClick={() => window.print()}><Printer size={18} />Imprimir etiquetas</button>}
              <button className={`${s.btn} ${s.btnPrimary}`} onClick={novaEntrada}>Nova entrada</button>
            </div>
          </div>
          <ul className={s.noPrint} style={{ margin: '0 0 12px', paddingLeft: 18, lineHeight: 1.7 }}>
            {resultado.linhas.map((r, i) => (
              <li key={i}><b>{r.item?.nome}</b> — {r.semLote ? fmtQtd(r.qtd, r.item?.unidade) : `${r.lotes.length} lote(s)`}</li>
            ))}
          </ul>
          {lotesEtiqueta.length > 0 && <LabelSheet lotes={lotesEtiqueta} />}
        </div>
      )}
      <div className={`${s.card} ${s.noPrint}`}>
        <h2 className={s.cardTitle}>Entradas recentes</h2>
        <AsyncState loading={hist.loading} error={hist.error} onRetry={hist.reload} empty={compras.length === 0} emptyTitle="Nenhuma entrada registrada">
          <div className={s.tableWrap}><table className={s.table}>
            <thead><tr><th>Data</th><th>Itens</th><th>Volumes</th><th>Fornecedor</th><th>NF</th><th>Por</th></tr></thead>
            <tbody>{compras.map((c) => (
              <React.Fragment key={c.key}>
                <tr onClick={() => setAberta(aberta === c.key ? null : c.key)} style={{ cursor: 'pointer' }} tabIndex={0} aria-expanded={aberta === c.key}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAberta(aberta === c.key ? null : c.key); } }}>
                  <td data-label="Data">{fmtDataHora(c.criado_em)}</td>
                  <td data-label="Itens">{c.linhas.map((x) => <div key={x.id}>{x.item_nome}</div>)}</td>
                  <td data-label="Volumes">{c.linhas.map((x) => <div key={x.id}>{x.qtd_volumes} × {fmtNum(x.medida_por_volume)} ({VOLUMES[x.tipo_volume]})</div>)}</td>
                  <td data-label="Fornecedor">{c.fornecedor_nome || '—'}</td><td data-label="NF">{c.nf || '—'}</td><td data-label="Por">{c.usuario_nome}</td></tr>
                {aberta === c.key && <tr><td colSpan={6}><DetalheCompra linhas={c.linhas} /></td></tr>}
              </React.Fragment>))}</tbody></table></div>
        </AsyncState>
      </div>
      {novoForn && (
        <FornecedorForm
          inicial={{ nome: '' }}
          notify={notify}
          onClose={() => setNovoForn(false)}
          onSaved={async (r) => { setNovoForn(false); await forn.reload(); if (r?.id) setComum((p) => ({ ...p, fornecedor_id: String(r.id) })); }}
        />
      )}
      {toasts}
    </div>
  );
};
export default EstoqueEntrada;
