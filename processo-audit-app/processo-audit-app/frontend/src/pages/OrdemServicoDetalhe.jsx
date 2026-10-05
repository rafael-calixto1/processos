import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, CheckCircle2, Undo2 } from 'lucide-react';
import { osAPI } from '../api/estoque';
import { useAuth } from '../context/AuthContext';
import { AsyncState, useLoad, useToasts, Modal, Field, LoteInput, ConfirmDialog, ConsequenceBaixa, OsStatusBadge, PrioridadeBadge,
  fmtData, fmtDataHora, fmtQtd, fmtNum, styles as s } from '../components/estoque/ui';

const AddMaterial = ({ os, onClose, onDone, notify }) => {
  const [codigo, setCodigo] = useState('');
  const [lote, setLote] = useState(null);
  const [qtd, setQtd] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [busy, setBusy] = useState(false);
  const max = lote ? (lote.minha_posse ?? lote.posse?.find((p) => p.tecnico_id === os.tecnico_id)?.quantidade) : null;
  const enviar = async () => {
    setBusy(true);
    try { await osAPI.adicionarMaterial(os.id, { codigo: lote.codigo, quantidade: Number(qtd) }); notify('Material lançado na OS'); onDone(); }
    catch (e) { notify(e.message, 'err'); setConfirmar(false); } finally { setBusy(false); }
  };
  return (
    <Modal title="Adicionar material usado" onClose={onClose}>
      <form className={s.form} onSubmit={(e) => { e.preventDefault(); setConfirmar(true); }}>
        <ConsequenceBaixa />
        <LoteInput value={codigo} onChange={setCodigo} onLote={setLote} />
        {lote && <div className={`${s.callout} ${s.calloutKeep}`}><span><b className={s.mono}>{lote.codigo}</b> — {lote.item_nome}<br />Em posse de {os.tecnico_nome}: <b>{max != null ? fmtQtd(max, lote.unidade) : 'nenhum'}</b></span></div>}
        <Field label={`Quantidade usada (${lote?.unidade === 'metros' ? 'metros' : 'peças'})`}>
          <input type="number" min="0.01" step="0.01" max={max ?? undefined} value={qtd} onChange={(e) => setQtd(e.target.value)} required disabled={!lote} />
        </Field>
        <button className={`${s.btn} ${s.btnPrimary}`} disabled={!lote || !qtd}>Revisar baixa</button>
      </form>
      {confirmar && (
        <ConfirmDialog title="Confirmar baixa em OS" danger confirmLabel="Baixar material" busy={busy} onConfirm={enviar} onCancel={() => setConfirmar(false)}>
          <p style={{ margin: 0 }}>Lançar <b>{fmtQtd(qtd, lote.unidade)}</b> do lote <b className={s.mono}>{lote.codigo}</b> na OS #{os.numero}?</p>
          <ConsequenceBaixa />
        </ConfirmDialog>
      )}
    </Modal>
  );
};

const OrdemServicoDetalhe = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const staff = ['admin', 'estoque'].includes(user?.role);
  const { loading, error, data: os, reload } = useLoad(() => osAPI.get(id), [id]);
  const [add, setAdd] = useState(false);
  const [fechar, setFechar] = useState(false);
  const [estornar, setEstornar] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [cancelar, setCancelar] = useState(false);
  const [busy, setBusy] = useState(false);
  const { notify, toasts } = useToasts();
  const aberta = os && ['aberta', 'em_andamento'].includes(os.status);

  const exec = async (fn, ok) => {
    setBusy(true);
    try { await fn(); notify(ok); setFechar(false); setEstornar(null); setCancelar(false); setMotivo(''); reload(); }
    catch (e) { notify(e.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <div className={s.page}>
      <Link to="/os" className={s.rowLink} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44 }}><ArrowLeft size={16} />Voltar para as OS</Link>
      <AsyncState loading={loading} error={error} onRetry={reload}>
        {os && (<>
          <div className={s.head}>
            <div><h1 className={s.title}>OS #{os.numero} — {os.cliente}</h1>
              <div className={s.actions} style={{ marginTop: 6 }}><OsStatusBadge status={os.status} /><PrioridadeBadge p={os.prioridade} /></div></div>
            <div className={s.actions}>
              {aberta && <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => setAdd(true)}><Plus size={18} />Adicionar material usado</button>}
              {aberta && <button className={s.btn} onClick={() => setFechar(true)}><CheckCircle2 size={18} />Fechar OS</button>}
              {aberta && staff && <button className={s.btn} onClick={() => setCancelar(true)}>Cancelar OS</button>}
            </div>
          </div>
          {!aberta && <div className={`${s.callout} ${s.calloutKeep}`}><span>Esta OS está <b>{os.status === 'concluida' ? 'concluída' : 'cancelada'}</b> e é somente leitura.{staff ? ' Correções só por estorno de material.' : ''}</span></div>}
          <div className={s.card}><dl className={s.detailGrid}>
            <div><dt>Responsável</dt><dd>{os.tecnico_nome}{os.tipo_execucao === 'terceirizado' ? ' (terceirizada)' : ''}</dd></div>
            <div><dt>Prazo</dt><dd>{fmtData(os.prazo)}</dd></div>
            <div><dt>Endereço</dt><dd>{os.endereco || '—'}</dd></div>
            <div><dt>Aberta em</dt><dd>{fmtDataHora(os.criado_em)}</dd></div>
            <div><dt>Concluída em</dt><dd>{os.concluida_em ? fmtDataHora(os.concluida_em) : '—'}</dd></div>
            <div><dt>Descrição</dt><dd>{os.descricao || '—'}</dd></div>
          </dl></div>
          <div className={s.kpis} style={{ gridTemplateColumns: 'repeat(2, 1fr)', maxWidth: 420 }}>
            <div className={s.kpi}><b>{fmtNum(os.totais.metros)} m</b><span>Cabo consumido</span></div>
            <div className={s.kpi}><b>{fmtNum(os.totais.pecas)}</b><span>Peças consumidas</span></div>
          </div>
          <div className={s.card}>
            <h2 className={s.cardTitle}>Materiais usados</h2>
            <AsyncState empty={os.materiais.length === 0} emptyTitle="Nenhum material lançado ainda">
              <div className={s.tableWrap}><table className={s.table}>
                <thead><tr><th>Item</th><th>Lote</th><th>Qtd</th><th>Lançado por</th><th>Quando</th>{staff && <th />}</tr></thead>
                <tbody>{os.materiais.map((m) => (
                  <tr key={m.id}>
                    <td data-label="Item">{m.item_nome}{m.estorno_id && <b className={`${s.badge} ${s.neutro}`} style={{ marginLeft: 6 }}>estornado</b>}</td>
                    <td data-label="Lote" className={s.mono}>{m.lote_codigo}</td>
                    <td data-label="Qtd" style={m.estorno_id ? { textDecoration: 'line-through' } : undefined}>{fmtQtd(m.quantidade, m.unidade)}</td>
                    <td data-label="Por">{m.usuario_nome || '—'}</td><td data-label="Quando">{fmtDataHora(m.criado_em)}</td>
                    {staff && <td>{!m.estorno_id && <button className={`${s.btn} ${s.btnSm}`} onClick={() => setEstornar(m)}><Undo2 size={16} />Estornar</button>}</td>}
                  </tr>))}</tbody></table></div>
            </AsyncState>
          </div>
          <div className={s.card}>
            <h2 className={s.cardTitle}>Histórico de status</h2>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>{os.historico.map((h) => (
              <li key={h.id}>{fmtDataHora(h.criado_em)} — {h.de ? `${h.de} → ` : ''}<b>{h.para}</b> ({h.usuario_nome})</li>))}</ul>
          </div>
        </>)}
      </AsyncState>

      {add && os && <AddMaterial os={os} notify={notify} onClose={() => setAdd(false)} onDone={() => { setAdd(false); reload(); }} />}
      {fechar && (
        <ConfirmDialog title="Fechar OS" confirmLabel="Fechar OS" busy={busy} onCancel={() => setFechar(false)}
          onConfirm={() => exec(() => osAPI.fechar(os.id), 'OS concluída')}>
          <p style={{ margin: 0 }}>Após fechar, a OS fica <b>somente leitura</b>. Confira se todos os materiais usados foram lançados ({fmtNum(os.totais.metros)} m e {fmtNum(os.totais.pecas)} peças até agora).</p>
        </ConfirmDialog>
      )}
      {cancelar && (
        <ConfirmDialog title="Cancelar OS" danger confirmLabel="Cancelar OS" busy={busy} onCancel={() => setCancelar(false)}
          onConfirm={() => exec(() => osAPI.cancelar(os.id), 'OS cancelada')}><p style={{ margin: 0 }}>A OS será cancelada e ficará somente leitura.</p></ConfirmDialog>
      )}
      {estornar && (
        <ConfirmDialog title="Estornar baixa" danger confirmLabel="Estornar" busy={busy} confirmDisabled={!motivo.trim()} onCancel={() => { setEstornar(null); setMotivo(''); }}
          onConfirm={() => exec(() => osAPI.estornar(os.id, { movimentacao_id: estornar.id, motivo }), 'Baixa estornada')}>
          <p style={{ margin: 0 }}>Estornar <b>{fmtQtd(estornar.quantidade, estornar.unidade)}</b> do lote <b className={s.mono}>{estornar.lote_codigo}</b>. O material volta para a posse de {os.tecnico_nome}. Fica registrado em auditoria.</p>
          <Field label="Motivo (obrigatório)"><textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Field>
        </ConfirmDialog>
      )}
      {toasts}
    </div>
  );
};
export default OrdemServicoDetalhe;
