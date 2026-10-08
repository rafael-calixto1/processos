import React, { useState, useEffect, useRef } from 'react';
import { Search, ArrowLeftRight, Pencil, History } from 'lucide-react';
import { estoqueAPI, cadastrosAPI } from '../api/estoque';
import { AsyncState, useLoad, useToasts, Modal, Field, StatusBadge, fmtQtd, fmtDataHora, styles as s } from '../components/estoque/ui';
import { Combobox } from '../components/estoque/ui';
import { Select } from '../components/Select/Select';
import { HistoricoLote } from './EstoqueEntrada';

const MIN = 3;
const TIPOS = [['nome', 'Produto (Nome)'], ['lote', 'Lote (Código)'], ['categoria', 'Produto (Categoria)'], ['auto', 'Automático']];
const STATUS = [['', 'Todos'], ['com_saldo', 'Com saldo'], ['esgotado', 'Esgotado']];
const PLACEHOLDER = { nome: 'Nome do item (ex.: cabo 6fo)', lote: 'Código do lote (ex.: LOTE-BOB-0012)', categoria: 'Categoria (ex.: Cabos)', auto: 'Nome, lote ou categoria' };
const stepDe = (un) => (un === 'metros' ? '0.01' : '1');

/* Campo de busca com recomendações a partir de 3 letras */
const BuscaComSugestoes = ({ tipo, valor, onChange, onBuscar }) => {
  const [sug, setSug] = useState([]);
  const [aberto, setAberto] = useState(false);
  const [hi, setHi] = useState(-1);
  const seq = useRef(0);
  useEffect(() => {
    const termo = valor.trim();
    if (termo.length < MIN) { setSug([]); return undefined; }
    const id = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const r = await estoqueAPI.patrimonioSugestoes(tipo, termo);
        if (id === seq.current) { setSug(r); setHi(-1); }
      } catch { if (id === seq.current) setSug([]); }
    }, 200);
    return () => clearTimeout(t);
  }, [valor, tipo]);

  const escolher = (v) => { onChange(v); setAberto(false); onBuscar(v); };
  const teclas = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAberto(true); setHi((h) => Math.min(h + 1, sug.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Escape') setAberto(false);
    else if (e.key === 'Enter') { e.preventDefault(); if (aberto && hi >= 0 && sug[hi]) escolher(sug[hi].valor); else { setAberto(false); onBuscar(valor); } }
  };
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <input value={valor} autoComplete="off" role="combobox" aria-expanded={aberto && sug.length > 0} aria-autocomplete="list"
        aria-label="Consulta" placeholder={PLACEHOLDER[tipo]}
        onChange={(e) => { onChange(e.target.value); setAberto(true); }} onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)} onKeyDown={teclas} />
      {aberto && sug.length > 0 && (
        <ul role="listbox" style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, top: '100%', margin: '4px 0 0', padding: 4, listStyle: 'none',
          background: '#fff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 320, overflowY: 'auto' }}>
          {sug.map((x, i) => (
            <li key={`${x.tipo}-${x.valor}`} role="option" aria-selected={i === hi} onMouseDown={(e) => { e.preventDefault(); escolher(x.valor); }}
              style={{ padding: '10px 12px', cursor: 'pointer', borderRadius: 6, background: i === hi ? 'var(--bg-light, #f0f5f1)' : 'transparent' }}>
              <b>{x.valor}</b>{x.detalhe && <span style={{ color: 'var(--text-light)', marginLeft: 8, fontSize: '0.85rem' }}>{x.detalhe}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* Movimentar: retirar para técnico, devolver ao almoxarifado ou descartar */
const MovimentarModal = ({ lote, onClose, onDone, notify }) => {
  const tecs = useLoad(() => cadastrosAPI.tecnicos());
  const temPosse = lote.com_tecnicos.length > 0;
  const [acao, setAcao] = useState(lote.no_almoxarifado > 0 ? 'retirar' : temPosse ? 'devolver' : 'retirar');
  const [tecnicoId, setTecnicoId] = useState(lote.com_tecnicos[0] ? String(lote.com_tecnicos[0].tecnico_id) : '');
  const [qtd, setQtd] = useState('');
  const [condicao, setCondicao] = useState('novo');
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const posseDoTec = lote.com_tecnicos.find((p) => String(p.tecnico_id) === String(tecnicoId))?.quantidade || 0;
  const max = acao === 'devolver' ? posseDoTec : lote.no_almoxarifado;
  const valido = Number(qtd) > 0 && Number(qtd) <= max && (acao === 'descartar' ? !!texto.trim() : !!tecnicoId);

  const trocarAcao = (a) => { setAcao(a); setQtd(''); setTexto(''); if (a === 'devolver' && lote.com_tecnicos[0]) setTecnicoId(String(lote.com_tecnicos[0].tecnico_id)); if (a === 'retirar') setTecnicoId(''); };
  const enviar = async (e) => {
    e.preventDefault(); if (!valido) return; setBusy(true);
    try {
      if (acao === 'retirar') await estoqueAPI.retirar({ lote_id: lote.id, tecnico_id: Number(tecnicoId), quantidade: Number(qtd), observacao: texto });
      else if (acao === 'devolver') await estoqueAPI.devolver({ lote_id: lote.id, tecnico_id: Number(tecnicoId), quantidade: Number(qtd), condicao, observacao: texto });
      else await estoqueAPI.descartarLote(lote.id, { quantidade: Number(qtd), motivo: texto });
      notify(acao === 'retirar' ? 'Retirada registrada' : acao === 'devolver' ? 'Devolução registrada' : 'Saldo descartado');
      onDone();
    } catch (err) { notify(err.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Movimentar ${lote.codigo}`} onClose={onClose}>
      <form className={s.form} onSubmit={enviar}>
        <p className={s.sub}>{lote.item_nome} · almoxarifado {fmtQtd(lote.no_almoxarifado, lote.unidade)}
          {temPosse ? ` · com ${lote.com_tecnicos.map((p) => `${p.tecnico} (${fmtQtd(p.quantidade, lote.unidade)})`).join(', ')}` : ''}</p>
        <Field label="Ação">
          <Select value={acao} onChange={(e) => trocarAcao(e.target.value)}>
            <option value="retirar" disabled={!(lote.no_almoxarifado > 0)}>Retirar para técnico / equipe</option>
            <option value="devolver" disabled={!temPosse}>Devolver ao almoxarifado</option>
            <option value="descartar" disabled={!(lote.no_almoxarifado > 0)}>Descartar saldo (avaria, perda…)</option>
          </Select>
        </Field>
        {acao === 'retirar' && (
          <Field label="Destino">
            <Combobox avatar value={tecnicoId} onChange={setTecnicoId} required placeholder="Selecione o técnico ou equipe…"
              options={(tecs.data || []).filter((t) => t.ativo).map((t) => ({ value: t.id, label: t.nome, sub: t.empresa || (t.tipo === 'terceirizado' ? 'Equipe terceirizada' : 'Técnico interno') }))} />
          </Field>
        )}
        {acao === 'devolver' && (
          <>
            <Field label="Devolvido por">
              <Select value={tecnicoId} onChange={(e) => { setTecnicoId(e.target.value); setQtd(''); }}>
                {lote.com_tecnicos.map((p) => <option key={p.tecnico_id} value={p.tecnico_id}>{p.tecnico} — {fmtQtd(p.quantidade, lote.unidade)}</option>)}
              </Select>
            </Field>
            <Field label="Condição"><Select value={condicao} onChange={(e) => setCondicao(e.target.value)}><option value="novo">Novo</option><option value="usado">Usado</option></Select></Field>
          </>
        )}
        <Field label={`Quantidade (máx. ${fmtQtd(max, lote.unidade)})`}>
          <input type="number" min={stepDe(lote.unidade)} step={stepDe(lote.unidade)} max={max} value={qtd} onChange={(e) => setQtd(e.target.value)} required />
        </Field>
        <Field label={acao === 'descartar' ? 'Motivo' : 'Observação (opcional)'}>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} required={acao === 'descartar'} placeholder={acao === 'descartar' ? 'Avaria, perda, vencido…' : ''} />
        </Field>
        <button className={`${s.btn} ${s.btnPrimary}`} disabled={busy || !valido}>{busy ? 'Salvando…' : 'Confirmar'}</button>
      </form>
    </Modal>
  );
};

/* Editar: código do lote e dados do item */
const EditarModal = ({ lote, onClose, onDone, notify }) => {
  const [f, setF] = useState({ codigo: lote.codigo, nome: lote.item_nome, categoria: lote.categoria || '', estoque_minimo: lote.estoque_minimo });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const salvar = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const itemMudou = f.nome !== lote.item_nome || f.categoria !== (lote.categoria || '') || Number(f.estoque_minimo) !== lote.estoque_minimo;
      if (f.codigo.trim() !== lote.codigo) await estoqueAPI.editarLote(lote.id, { codigo: f.codigo });
      if (itemMudou) await estoqueAPI.atualizarItem(lote.item_id, { nome: f.nome, categoria: f.categoria, unidade: lote.unidade, estoque_minimo: f.estoque_minimo });
      notify('Alterações salvas'); onDone();
    } catch (err) { notify(err.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Editar ${lote.codigo}`} onClose={onClose}>
      <form className={s.form} onSubmit={salvar}>
        <Field label="Código do lote"><input value={f.codigo} onChange={set('codigo')} required /></Field>
        <h3 className={s.cardTitle}>Item (vale para todos os lotes dele)</h3>
        <Field label="Nome"><input value={f.nome} onChange={set('nome')} required /></Field>
        <Field label="Categoria"><input value={f.categoria} onChange={set('categoria')} /></Field>
        <Field label={`Estoque mínimo (${lote.unidade === 'metros' ? 'm' : 'un'})`}><input type="number" min="0" step={stepDe(lote.unidade)} value={f.estoque_minimo} onChange={set('estoque_minimo')} /></Field>
        <button className={`${s.btn} ${s.btnPrimary}`} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
      </form>
    </Modal>
  );
};

const HistoricoModal = ({ lote, onClose }) => (
  <Modal title={`Lote ${lote.codigo}`} onClose={onClose}>
    <p className={s.sub}>{lote.item_nome} · saldo {fmtQtd(lote.saldo_atual, lote.unidade)} de {fmtQtd(lote.saldo_inicial, lote.unidade)} · entrou em {fmtDataHora(lote.criado_em)}</p>
    <h3 className={s.cardTitle}>Histórico</h3>
    <HistoricoLote lote={lote} />
  </Modal>
);

const EstoquePatrimonio = () => {
  const [tipo, setTipo] = useState('nome');
  const [local, setLocal] = useState('');
  const [status, setStatus] = useState('');
  const tecs = useLoad(() => cadastrosAPI.tecnicos());
  const [valor, setValor] = useState('');
  const [busca, setBusca] = useState(null); // filtros da última pesquisa
  const [modal, setModal] = useState(null); // { tipo: 'mover'|'editar'|'historico', lote }
  const { notify, toasts } = useToasts();
  const res = useLoad(() => (busca ? estoqueAPI.patrimonio(busca) : Promise.resolve(null)), [busca]);
  const lotes = res.data || [];

  const buscar = (q = valor) => {
    const t = String(q).trim();
    if (t && t.length < MIN) return;
    setBusca({ tipo, q: t, local, status, n: Date.now() });
  };
  const limpar = () => { setValor(''); setLocal(''); setStatus(''); setBusca(null); };
  const fechar = () => setModal(null);
  const feito = () => { setModal(null); res.reload(); };

  // lotes agrupados por item
  const grupos = [];
  for (const l of lotes) { const g = grupos[grupos.length - 1]; if (g && g.item_id === l.item_id) g.lotes.push(l); else grupos.push({ item_id: l.item_id, nome: l.item_nome, unidade: l.unidade, lotes: [l] }); }

  return (
    <div className={s.page}>
      <div><h1 className={s.title}>Consulta de patrimônio</h1><p className={s.sub}>Encontre materiais e lotes, veja onde estão e movimente ou edite direto da pesquisa</p></div>
      <form className={s.card} onSubmit={(e) => { e.preventDefault(); buscar(); }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, alignItems: 'end' }}>
        <div style={{ gridColumn: 'span 2' }}>
          <Field label="Consulta"><BuscaComSugestoes tipo={tipo} valor={valor} onChange={setValor} onBuscar={buscar} /></Field>
        </div>
        <Field label="Local de estoque">
          <Select value={local} onChange={(e) => setLocal(e.target.value)}>
            <option value="">Todos</option><option value="almoxarifado">Almoxarifado</option><option value="tecnicos">Com técnicos (todos)</option>
            {(tecs.data || []).filter((t) => t.ativo).map((t) => <option key={t.id} value={`tec:${t.id}`}>Com {t.nome}</option>)}
          </Select>
        </Field>
        <Field label="Status de produtos">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>{STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
        </Field>
        <Field label="Tipo de busca *">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>{TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
        </Field>
        <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className={`${s.btn} ${s.btnPrimary}`}><Search size={18} />Pesquisar</button>
          {(busca || valor || local || status) && <button type="button" className={s.btn} onClick={limpar}>Limpar</button>}
          <span className={s.sub}>Recomendações a partir de {MIN} letras. Deixe a consulta vazia para listar tudo conforme os filtros.</span>
        </div>
      </form>

      {busca && (
        <AsyncState loading={res.loading} error={res.error} onRetry={res.reload} empty={lotes.length === 0} emptyTitle="Nada encontrado para essa pesquisa">
          {grupos.map((g) => (
            <div key={g.item_id} className={s.card}>
              <h2 className={s.cardTitle}>{g.nome} <span className={s.sub}>· {g.lotes.length} {g.lotes.length === 1 ? 'lote' : 'lotes'}</span></h2>
              <div className={s.tableWrap}><table className={s.table}>
                <thead><tr><th>Lote</th><th>Saldo</th><th>Almoxarifado</th><th>Com técnicos</th><th>Situação</th><th>Ações</th></tr></thead>
                <tbody>{g.lotes.map((l) => (
                  <tr key={l.id} className={s.clickRow} onClick={() => setModal({ tipo: 'historico', lote: l })} title="Ver histórico do lote">
                    <td data-label="Lote" className={s.mono}><b>{l.codigo}</b></td>
                    <td data-label="Saldo">{fmtQtd(l.saldo_atual, l.unidade)} / {fmtQtd(l.saldo_inicial, l.unidade)}</td>
                    <td data-label="Almoxarifado">{fmtQtd(l.no_almoxarifado, l.unidade)}</td>
                    <td data-label="Com técnicos">{l.com_tecnicos.length ? l.com_tecnicos.map((p) => <div key={p.tecnico_id}>{p.tecnico}: {fmtQtd(p.quantidade, l.unidade)}</div>) : '—'}</td>
                    <td data-label="Situação">{l.status === 'esgotado' || Number(l.saldo_atual) === 0 ? <StatusBadge status="ZERADO" /> : <StatusBadge status="OK" />}</td>
                    <td data-label="Ações" onClick={(e) => e.stopPropagation()}><div className={s.actions}>
                      <button className={s.iconBtn} title="Movimentar" aria-label={`Movimentar ${l.codigo}`} onClick={() => setModal({ tipo: 'mover', lote: l })}><ArrowLeftRight size={16} /></button>
                      <button className={s.iconBtn} title="Editar" aria-label={`Editar ${l.codigo}`} onClick={() => setModal({ tipo: 'editar', lote: l })}><Pencil size={16} /></button>
                      <button className={s.iconBtn} title="Histórico" aria-label={`Histórico de ${l.codigo}`} onClick={() => setModal({ tipo: 'historico', lote: l })}><History size={16} /></button>
                    </div></td>
                  </tr>))}</tbody></table></div>
            </div>
          ))}
        </AsyncState>
      )}

      {modal?.tipo === 'mover' && <MovimentarModal lote={modal.lote} notify={notify} onClose={fechar} onDone={feito} />}
      {modal?.tipo === 'editar' && <EditarModal lote={modal.lote} notify={notify} onClose={fechar} onDone={feito} />}
      {modal?.tipo === 'historico' && <HistoricoModal lote={modal.lote} onClose={fechar} />}
      {toasts}
    </div>
  );
};
export default EstoquePatrimonio;
