import React, { useState } from 'react';
import { estoqueAPI, cadastrosAPI } from '../api/estoque';
import { useAuth } from '../context/AuthContext';
import { AsyncState, useLoad, useToasts, Field, ConfirmDialog, fmtQtd, styles as s } from '../components/estoque/ui';

const EstoqueDevolucao = () => {
  const { user } = useAuth();
  const isTecnico = user?.role === 'tecnico';
  const tecs = useLoad(() => (isTecnico ? Promise.resolve([]) : cadastrosAPI.tecnicos()), [isTecnico]);
  const [tecnicoId, setTecnicoId] = useState('');
  const posse = useLoad(() => (isTecnico ? estoqueAPI.minhaPosse() : tecnicoId ? estoqueAPI.fichaTecnico(tecnicoId).then((r) => r.itens) : Promise.resolve([])), [isTecnico, tecnicoId]);
  const [sel, setSel] = useState('');
  const [qtd, setQtd] = useState('');
  const [condicao, setCondicao] = useState('novo');
  const [confirmar, setConfirmar] = useState(false);
  const [busy, setBusy] = useState(false);
  const { notify, toasts } = useToasts();
  const linha = (posse.data || []).find((p) => String(p.lote_id) === String(sel));

  const enviar = async () => {
    setBusy(true);
    try {
      await estoqueAPI.devolver({ lote_id: linha.lote_id, tecnico_id: isTecnico ? undefined : Number(tecnicoId), quantidade: Number(qtd), condicao });
      notify('Devolução registrada: material voltou ao almoxarifado');
      setConfirmar(false); setSel(''); setQtd(''); posse.reload();
    } catch (e) { notify(e.message, 'err'); setConfirmar(false); } finally { setBusy(false); }
  };

  return (
    <div className={s.page}>
      <div><h1 className={s.title}>Devolução</h1><p className={s.sub}>O material sai da posse do técnico e volta ao almoxarifado</p></div>
      <form className={`${s.card} ${s.form}`} onSubmit={(e) => { e.preventDefault(); setConfirmar(true); }}>
        {!isTecnico && (
          <Field label="Técnico / equipe">
            <select value={tecnicoId} onChange={(e) => { setTecnicoId(e.target.value); setSel(''); }} required>
              <option value="">Selecione…</option>{(tecs.data || []).filter((t) => t.ativo).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </Field>
        )}
        <AsyncState loading={posse.loading && (isTecnico || !!tecnicoId)} error={posse.error} onRetry={posse.reload}
          empty={(isTecnico || tecnicoId) && (posse.data || []).length === 0} emptyTitle="Nada em posse para devolver">
          {(isTecnico || tecnicoId) && (
            <Field label="Lote em posse">
              <select value={sel} onChange={(e) => { setSel(e.target.value); setQtd(''); }} required>
                <option value="">Selecione…</option>
                {(posse.data || []).map((p) => <option key={p.lote_id} value={p.lote_id}>{p.lote_codigo} — {p.item_nome} ({fmtQtd(p.quantidade, p.unidade)})</option>)}
              </select>
            </Field>
          )}
        </AsyncState>
        <Field label={`Quantidade (${linha?.unidade === 'metros' ? 'metros' : 'peças'})`}>
          <input type="number" min="0.01" step="0.01" max={linha?.quantidade} value={qtd} onChange={(e) => setQtd(e.target.value)} required disabled={!linha} />
        </Field>
        <Field label="Condição do material devolvido">
          <select value={condicao} onChange={(e) => setCondicao(e.target.value)}><option value="novo">Novo</option><option value="usado">Usado</option></select>
        </Field>
        <button className={`${s.btn} ${s.btnPrimary}`} disabled={!linha || !qtd}>Revisar devolução</button>
      </form>
      {confirmar && linha && (
        <ConfirmDialog title="Confirmar devolução" busy={busy} onConfirm={enviar} onCancel={() => setConfirmar(false)}>
          <p style={{ margin: 0 }}>Devolver <b>{fmtQtd(qtd, linha.unidade)}</b> do lote <b className={s.mono}>{linha.lote_codigo}</b> como <b>{condicao}</b>?</p>
        </ConfirmDialog>
      )}
      {toasts}
    </div>
  );
};
export default EstoqueDevolucao;
