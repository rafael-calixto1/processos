import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { estoqueAPI } from '../api/estoque';
import { AsyncState, useLoad, useToasts, Modal, Field, fmtQtd, fmtDataHora, styles as s } from '../components/estoque/ui';
import { Select } from '../components/Select/Select';

const FILTROS = [['pendente', 'Pendentes'], ['aprovada', 'Aprovadas'], ['negada', 'Negadas'], ['', 'Todas']];

const Situacao = ({ d }) => {
  if (d.status === 'pendente') return <span style={{ color: '#b45309', fontWeight: 700 }}>Pendente</span>;
  if (d.status === 'aprovada') return <span style={{ color: '#166534', fontWeight: 700 }}>Aprovada{d.revisor_nome ? ` por ${d.revisor_nome}` : ''}</span>;
  return <span style={{ color: '#991b1b', fontWeight: 700 }}>Negada{d.revisor_nome ? ` por ${d.revisor_nome}` : ''}{d.motivo_negacao ? ` — ${d.motivo_negacao}` : ''}</span>;
};

const EstoqueDevolucoesRevisao = () => {
  const [status, setStatus] = useState('pendente');
  const { loading, error, data, reload } = useLoad(() => estoqueAPI.devolucoes({ status }), [status]);
  const [revisar, setRevisar] = useState(null); // { d, acao: 'aprovar' | 'negar' }
  const [condicao, setCondicao] = useState('novo');
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);
  const { notify, toasts } = useToasts();
  const lista = data || [];

  const abrir = (d, acao) => { setRevisar({ d, acao }); setCondicao(d.condicao); setMotivo(''); };
  const confirmar = async () => {
    setBusy(true);
    try {
      if (revisar.acao === 'aprovar') { await estoqueAPI.aprovarDevolucao(revisar.d.id, { condicao }); notify('Devolução aprovada: material voltou ao almoxarifado'); }
      else { await estoqueAPI.negarDevolucao(revisar.d.id, { motivo }); notify('Devolução negada: o material continua com o técnico'); }
      setRevisar(null); reload();
    } catch (e) { notify(e.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div><h1 className={s.title}>Aprovar devoluções</h1><p className={s.sub}>Revise o que os técnicos estão devolvendo ao almoxarifado</p></div>
      </div>
      <div className={s.chips} role="group" aria-label="Filtrar por situação">
        {FILTROS.map(([v, l]) => <button key={v} className={`${s.chip} ${status === v ? s.chipActive : ''}`} aria-pressed={status === v} onClick={() => setStatus(v)}>{l}</button>)}
      </div>
      <AsyncState loading={loading} error={error} onRetry={reload} empty={lista.length === 0} emptyTitle={status === 'pendente' ? 'Nenhuma devolução aguardando aprovação' : 'Nenhuma solicitação encontrada'}>
        <div className={s.tableWrap}><table className={s.table}>
          <thead><tr><th>Solicitada</th><th>Técnico / equipe</th><th>Item</th><th>Lote</th><th>Qtd</th><th>Condição</th><th>Situação</th><th /></tr></thead>
          <tbody>{lista.map((d) => (
            <tr key={d.id}>
              <td data-label="Solicitada">{fmtDataHora(d.solicitado_em)}</td>
              <td data-label="Técnico"><b>{d.tecnico_nome}</b></td>
              <td data-label="Item">{d.item_nome}</td>
              <td data-label="Lote" className={s.mono}>{d.lote_codigo}</td>
              <td data-label="Qtd" className={s.num}><b>{fmtQtd(d.quantidade, d.unidade)}</b></td>
              <td data-label="Condição">{d.condicao === 'novo' ? 'Novo' : 'Usado'}</td>
              <td data-label="Situação"><Situacao d={d} /></td>
              <td data-label="">
                {d.status === 'pendente' && (
                  <div className={s.actions}>
                    <button className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`} onClick={() => abrir(d, 'aprovar')}><Check size={16} />Aprovar</button>
                    <button className={`${s.btn} ${s.btnDanger} ${s.btnSm}`} onClick={() => abrir(d, 'negar')}><X size={16} />Negar</button>
                  </div>
                )}
              </td>
            </tr>))}</tbody></table></div>
      </AsyncState>

      {revisar && (
        <Modal title={revisar.acao === 'aprovar' ? 'Aprovar devolução' : 'Negar devolução'} onClose={() => setRevisar(null)}>
          <div className={s.form}>
            <p style={{ margin: 0 }}>
              <b>{revisar.d.tecnico_nome}</b> devolve <b>{fmtQtd(revisar.d.quantidade, revisar.d.unidade)}</b> de {revisar.d.item_nome} <span className={s.mono}>{revisar.d.lote_codigo}</span>.
            </p>
            {revisar.acao === 'aprovar' ? (
              <Field label="Condição do material" hint="Corrija se o material recebido não for o que o técnico informou.">
                <Select value={condicao} onChange={(e) => setCondicao(e.target.value)}><option value="novo">Novo</option><option value="usado">Usado</option></Select>
              </Field>
            ) : (
              <Field label="Motivo da negativa" hint="O técnico verá este motivo. O material continua em posse dele.">
                <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} rows={3} />
              </Field>
            )}
            <button className={`${s.btn} ${revisar.acao === 'aprovar' ? s.btnPrimary : s.btnDanger}`} disabled={busy} onClick={confirmar}>
              {revisar.acao === 'aprovar' ? 'Confirmar aprovação' : 'Confirmar negativa'}
            </button>
          </div>
        </Modal>
      )}
      {toasts}
    </div>
  );
};
export default EstoqueDevolucoesRevisao;
