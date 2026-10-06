import React, { useState } from 'react';
import { estoqueAPI, cadastrosAPI } from '../api/estoque';
import { Combobox, useLoad, useToasts, Field, LoteInput, ConfirmDialog, ConsequenceRetirada, fmtQtd, styles as s } from '../components/estoque/ui';
import { Select } from '../components/Select/Select';

const EstoqueRetirada = () => {
  const tecs = useLoad(() => cadastrosAPI.tecnicos());
  const itens = useLoad(() => estoqueAPI.itens());
  const [porLote, setPorLote] = useState(true); // false = itens sem lote (unidade): informa só item + quantidade
  const [itemId, setItemId] = useState('');
  const [itemLotes, setItemLotes] = useState([]); // lotes LOTE-UNI com saldo no almoxarifado, mais antigos primeiro
  const [loadingItem, setLoadingItem] = useState(false);
  const itemSel = (itens.data || []).find((i) => String(i.id) === String(itemId));
  const dispItem = itemLotes.reduce((a, l) => a + l.no_almoxarifado, 0);
  const escolherItem = async (id) => {
    setItemId(id); setQtd(''); setItemLotes([]);
    if (!id) return;
    setLoadingItem(true);
    try {
      const d = await estoqueAPI.item(id);
      setItemLotes((d.lotes || []).filter((l) => String(l.codigo).startsWith('LOTE-UNI') && l.no_almoxarifado > 0).sort((a, b) => a.id - b.id));
    } catch (e) { notify(e.message, 'err'); } finally { setLoadingItem(false); }
  };
  const [tecnicoId, setTecnicoId] = useState('');
  const [codigo, setCodigo] = useState('');
  const [lote, setLote] = useState(null);
  const [qtd, setQtd] = useState('');
  const [obs, setObs] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [busy, setBusy] = useState(false);
  const { notify, toasts } = useToasts();
  const tec = (tecs.data || []).find((t) => String(t.id) === String(tecnicoId));
  const un = porLote ? lote?.unidade : itemSel?.unidade;
  const pronto = porLote ? !!lote : !!itemSel && dispItem > 0;
  const maxQtd = porLote ? lote?.no_almoxarifado : dispItem;

  const enviar = async () => {
    setBusy(true);
    try {
      if (porLote) {
        await estoqueAPI.retirar({ codigo: lote.codigo, tecnico_id: Number(tecnicoId), quantidade: Number(qtd), observacao: obs });
      } else {
        let resta = Number(qtd);
        for (const l of itemLotes) {
          if (resta <= 0) break;
          const q = Math.min(resta, l.no_almoxarifado);
          await estoqueAPI.retirar({ lote_id: l.id, tecnico_id: Number(tecnicoId), quantidade: q, observacao: obs });
          resta = Math.round((resta - q) * 100) / 100;
        }
      }
      notify(`Retirada registrada para ${tec.nome}`);
      setConfirmar(false); setLote(null); setCodigo(''); setQtd(''); setObs('');
      if (!porLote) escolherItem(itemId);
    } catch (e) { notify(e.message, 'err'); setConfirmar(false); if (!porLote) escolherItem(itemId); } finally { setBusy(false); }
  };

  return (
    <div className={s.page}>
      <div><h1 className={s.title}>Retirada</h1><p className={s.sub}>Entrega de material a técnico ou equipe terceirizada</p></div>
      <ConsequenceRetirada />
      <form className={`${s.card} ${s.form}`} onSubmit={(e) => { e.preventDefault(); if (pronto) setConfirmar(true); }}>
        <Field label="Destino (técnico ou equipe)">
          <Combobox avatar value={tecnicoId} onChange={setTecnicoId} required placeholder="Selecione o técnico ou equipe…"
            options={(tecs.data || []).filter((t) => t.ativo).map((t) => ({ value: t.id, label: t.nome, sub: t.empresa || (t.tipo === 'terceirizado' ? 'Equipe terceirizada' : 'Técnico interno'), tag: t.tipo === 'terceirizado' ? 'Terceirizada' : undefined }))} />
        </Field>
        <Field label="Como identificar o material?">
          <Select value={porLote ? 'lote' : 'item'} onChange={(e) => { setPorLote(e.target.value === 'lote'); setQtd(''); }}>
            <option value="lote">Por lote (bobina, rolo, caixa — código/etiqueta)</option>
            <option value="item">Por item, sem lote (unidades)</option>
          </Select>
        </Field>
        {porLote ? <LoteInput value={codigo} onChange={setCodigo} onLote={setLote} /> : (
          <Field label="Item">
            <Combobox value={itemId} onChange={escolherItem} required placeholder="Selecione o item…"
              options={(itens.data || []).map((i) => ({ value: i.id, label: i.nome, sub: `${i.categoria ? i.categoria + ' · ' : ''}${fmtQtd(i.no_almoxarifado, i.unidade)} no almoxarifado`, tag: i.unidade === 'metros' ? 'metros' : 'unidades' }))} />
          </Field>
        )}
        {!porLote && itemSel && !loadingItem && (
          <div className={`${s.callout} ${s.calloutKeep}`}>
            <span><b>{itemSel.nome}</b><br />{dispItem > 0 ? <>Disponível no almoxarifado (sem lote): <b>{fmtQtd(dispItem, un)}</b></> : 'Nada disponível sem lote para este item. Para bobinas/rolos use a retirada por lote.'}</span>
          </div>
        )}
        {porLote && lote && (
          <div className={`${s.callout} ${s.calloutKeep}`}>
            <span><b className={s.mono}>{lote.codigo}</b> — {lote.item_nome}<br />Disponível no almoxarifado: <b>{fmtQtd(lote.no_almoxarifado, un)}</b></span>
          </div>
        )}
        <Field label={`Quantidade (${un === 'metros' ? 'metros' : 'peças'})`}>
          <input type="number" min={un === 'metros' ? '0.01' : '1'} step={un === 'metros' ? '0.01' : '1'} max={maxQtd} value={qtd} onChange={(e) => setQtd(e.target.value)} required disabled={!pronto} />
        </Field>
        <Field label="Observação (opcional)"><input value={obs} onChange={(e) => setObs(e.target.value)} /></Field>
        <button className={`${s.btn} ${s.btnPrimary}`} disabled={!pronto || !tecnicoId || !qtd}>Revisar retirada</button>
      </form>
      {confirmar && (
        <ConfirmDialog title="Confirmar retirada" confirmLabel="Confirmar retirada" busy={busy} onConfirm={enviar} onCancel={() => setConfirmar(false)}>
          <p style={{ margin: 0 }}>Entregar <b>{fmtQtd(qtd, un)}</b> {porLote ? <>do lote <b className={s.mono}>{lote.codigo}</b></> : <>de <b>{itemSel?.nome}</b></>} a <b>{tec?.nome}</b>?</p>
          <ConsequenceRetirada />
        </ConfirmDialog>
      )}
      {toasts}
    </div>
  );
};
export default EstoqueRetirada;
