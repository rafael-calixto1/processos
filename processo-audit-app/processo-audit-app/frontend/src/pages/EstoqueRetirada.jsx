import React, { useState } from 'react';
import { estoqueAPI, cadastrosAPI } from '../api/estoque';
import { useLoad, useToasts, Field, LoteInput, ConfirmDialog, ConsequenceRetirada, fmtQtd, styles as s } from '../components/estoque/ui';

const EstoqueRetirada = () => {
  const tecs = useLoad(() => cadastrosAPI.tecnicos());
  const [tecnicoId, setTecnicoId] = useState('');
  const [codigo, setCodigo] = useState('');
  const [lote, setLote] = useState(null);
  const [qtd, setQtd] = useState('');
  const [obs, setObs] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [busy, setBusy] = useState(false);
  const { notify, toasts } = useToasts();
  const tec = (tecs.data || []).find((t) => String(t.id) === String(tecnicoId));
  const un = lote?.unidade;

  const enviar = async () => {
    setBusy(true);
    try {
      await estoqueAPI.retirar({ codigo: lote.codigo, tecnico_id: Number(tecnicoId), quantidade: Number(qtd), observacao: obs });
      notify(`Retirada registrada para ${tec.nome}`);
      setConfirmar(false); setLote(null); setCodigo(''); setQtd(''); setObs('');
    } catch (e) { notify(e.message, 'err'); setConfirmar(false); } finally { setBusy(false); }
  };

  return (
    <div className={s.page}>
      <div><h1 className={s.title}>Retirada</h1><p className={s.sub}>Entrega de material a técnico ou equipe terceirizada</p></div>
      <ConsequenceRetirada />
      <form className={`${s.card} ${s.form}`} onSubmit={(e) => { e.preventDefault(); if (lote) setConfirmar(true); }}>
        <Field label="Destino (técnico ou equipe)">
          <select value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)} required>
            <option value="">Selecione…</option>
            {(tecs.data || []).filter((t) => t.ativo).map((t) => <option key={t.id} value={t.id}>{t.nome}{t.tipo === 'terceirizado' ? ' (terceirizada)' : ''}</option>)}
          </select>
        </Field>
        <LoteInput value={codigo} onChange={setCodigo} onLote={setLote} />
        {lote && (
          <div className={`${s.callout} ${s.calloutKeep}`}>
            <span><b className={s.mono}>{lote.codigo}</b> — {lote.item_nome}<br />Disponível no almoxarifado: <b>{fmtQtd(lote.no_almoxarifado, un)}</b></span>
          </div>
        )}
        <Field label={`Quantidade (${un === 'metros' ? 'metros' : 'peças'})`}>
          <input type="number" min="0.01" step="0.01" max={lote?.no_almoxarifado} value={qtd} onChange={(e) => setQtd(e.target.value)} required disabled={!lote} />
        </Field>
        <Field label="Observação (opcional)"><input value={obs} onChange={(e) => setObs(e.target.value)} /></Field>
        <button className={`${s.btn} ${s.btnPrimary}`} disabled={!lote || !tecnicoId || !qtd}>Revisar retirada</button>
      </form>
      {confirmar && (
        <ConfirmDialog title="Confirmar retirada" confirmLabel="Confirmar retirada" busy={busy} onConfirm={enviar} onCancel={() => setConfirmar(false)}>
          <p style={{ margin: 0 }}>Entregar <b>{fmtQtd(qtd, un)}</b> do lote <b className={s.mono}>{lote.codigo}</b> a <b>{tec?.nome}</b>?</p>
          <ConsequenceRetirada />
        </ConfirmDialog>
      )}
      {toasts}
    </div>
  );
};
export default EstoqueRetirada;
