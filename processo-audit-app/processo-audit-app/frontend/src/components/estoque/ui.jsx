import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Loader2, Inbox, RefreshCw, X, Camera, Search, PackageMinus, Flame, Clock, PlayCircle, Ban } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import QRCode from 'qrcode';
import { estoqueAPI } from '../../api/estoque';
import s from './Estoque.module.css';

/* ── Formatação pt-BR ── */
export const fmtNum = (v) => Number(v ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
export const fmtQtd = (v, unidade) => `${fmtNum(v)} ${unidade === 'metros' ? 'm' : 'un'}`;
const parse = (v) => {
  if (!v) return null;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (m && !String(v).endsWith('Z')) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
export const fmtData = (v) => { const d = parse(v); return d ? d.toLocaleDateString('pt-BR') : '—'; };
export const fmtDataHora = (v) => { const d = parse(v); return d ? `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '—'; };
export const hoje = () => new Date().toISOString().slice(0, 10);

/* ── Selos: ícone + texto (nunca só cor) ── */
export const StatusBadge = ({ status }) => {
  const map = {
    OK: [s.ok, CheckCircle2, 'OK'], BAIXO: [s.baixo, AlertTriangle, 'Baixo'], ZERADO: [s.zerado, XCircle, 'Zerado'],
  };
  const [cls, Icon, label] = map[status] || [s.neutro, CheckCircle2, status];
  return <span className={`${s.badge} ${cls}`}><Icon size={14} aria-hidden="true" />{label}</span>;
};

export const OsStatusBadge = ({ status }) => {
  const map = {
    aberta: [s.info, Clock, 'Aberta'], em_andamento: [s.baixo, PlayCircle, 'Em andamento'],
    concluida: [s.ok, CheckCircle2, 'Concluída'], cancelada: [s.neutro, Ban, 'Cancelada'],
  };
  const [cls, Icon, label] = map[status] || [s.neutro, Clock, status];
  return <span className={`${s.badge} ${cls}`}><Icon size={14} aria-hidden="true" />{label}</span>;
};

export const PrioridadeBadge = ({ p }) => {
  const map = { baixa: [s.neutro, 'Baixa'], normal: [s.info, 'Normal'], alta: [s.zerado, 'Alta'] };
  const [cls, label] = map[p] || map.normal;
  return <span className={`${s.badge} ${cls}`}>{p === 'alta' && <Flame size={14} aria-hidden="true" />}{label}</span>;
};

/* ── Estados: carregando (skeleton) / vazio (com ação) / erro (tentar de novo) ── */
export const AsyncState = ({ loading, error, empty, onRetry, emptyTitle = 'Nada por aqui ainda', emptyAction, children }) => {
  if (loading) {
    return <div aria-busy="true" aria-label="Carregando">{[0, 1, 2].map((i) => <div key={i} className={s.skeleton} />)}</div>;
  }
  if (error) {
    return (
      <div className={`${s.state} ${s.stateErr}`} role="alert">
        <XCircle size={36} /><strong>{error}</strong>
        {onRetry && <button className={s.btn} onClick={onRetry}><RefreshCw size={16} />Tentar de novo</button>}
      </div>
    );
  }
  if (empty) return <div className={s.state}><Inbox size={36} /><strong>{emptyTitle}</strong>{emptyAction}</div>;
  return children;
};

/* hook de carga com erro/retry */
export const useLoad = (fn, deps = []) => {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const run = useCallback(async () => {
    setState((p) => ({ ...p, loading: true, error: null }));
    try { setState({ loading: false, error: null, data: await fn() }); }
    catch (e) { setState({ loading: false, error: e.message, data: null }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { ...state, reload: run };
};

/* ── Toasts ── */
export const useToasts = () => {
  const [items, setItems] = useState([]);
  const notify = useCallback((msg, type = 'ok') => {
    const id = Math.random();
    setItems((p) => [...p, { id, msg, type }]);
    setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), 4500);
  }, []);
  const toasts = (
    <div className={s.toasts} role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`${s.toast} ${t.type === 'ok' ? s.toastOk : s.toastErr}`}>
          {t.type === 'ok' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}{t.msg}
        </div>
      ))}
    </div>
  );
  return { notify, toasts };
};

/* ── Modal e confirmação ── */
export const Modal = ({ title, onClose, children }) => (
  <div className={s.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className={s.modal} role="dialog" aria-modal="true" aria-label={title}>
      <div className={s.modalHead}>
        <h2>{title}</h2>
        <button className={s.iconBtn} onClick={onClose} aria-label="Fechar"><X size={20} /></button>
      </div>
      {children}
    </div>
  </div>
);

export const ConfirmDialog = ({ title, children, confirmLabel = 'Confirmar', danger, busy, confirmDisabled, onConfirm, onCancel }) => (
  <Modal title={title} onClose={onCancel}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {children}
      <div className={s.actions}>
        <button className={s.btn} onClick={onCancel} disabled={busy}>Cancelar</button>
        <button className={`${s.btn} ${danger ? s.btnDanger : s.btnPrimary}`} onClick={onConfirm} disabled={busy || confirmDisabled}>
          {busy && <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} />}{confirmLabel}
        </button>
      </div>
    </div>
  </Modal>
);

/* Aviso de consequência: RETIRAR (fica com o técnico) ≠ BAIXAR EM OS (consumido) */
export const ConsequenceRetirada = () => (
  <div className={`${s.callout} ${s.calloutKeep}`}>
    <PackageMinus size={20} aria-hidden="true" />
    <span><b>RETIRAR:</b> o material continua sendo do técnico/equipe (fica no estoque dele) e pode voltar por devolução. Não é consumo.</span>
  </div>
);
export const ConsequenceBaixa = () => (
  <div className={`${s.callout} ${s.calloutConsume}`}>
    <Flame size={20} aria-hidden="true" />
    <span><b>BAIXAR EM OS:</b> o material é <b>consumido e não retorna ao estoque</b>. Só pode ser desfeito por estorno (estoque/admin), com motivo.</span>
  </div>
);

/* ── Leitura de lote: câmera (QR/código de barras) OU digitação manual ──
   getUserMedia exige contexto seguro (HTTPS ou localhost). */
export const LoteInput = ({ onLote, value, onChange, label = 'Código do lote' }) => {
  const [scanning, setScanning] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const scannerRef = useRef(null);

  const buscar = useCallback(async (codigo) => {
    if (!codigo.trim()) return;
    setBusy(true); setErr('');
    try { onLote(await estoqueAPI.lote(codigo)); }
    catch (e) { setErr(e.message); onLote(null); }
    finally { setBusy(false); }
  }, [onLote]);

  const stop = useCallback(async () => {
    const sc = scannerRef.current;
    scannerRef.current = null;
    if (sc) { try { await sc.stop(); sc.clear(); } catch { /* já parado */ } }
    setScanning(false);
  }, []);

  useEffect(() => {
    if (!scanning) return undefined;
    const sc = new Html5Qrcode('reader-box');
    scannerRef.current = sc;
    sc.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } },
      (text) => { onChange(text.trim().toUpperCase()); stop(); buscar(text); }, () => {})
      .catch(() => {
        setErr(window.isSecureContext
          ? 'Não foi possível acessar a câmera. Verifique a permissão ou digite o código.'
          : 'A câmera só funciona em HTTPS ou localhost. Digite o código do lote.');
        setScanning(false);
      });
    return () => { stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  return (
    <div className={s.field}>
      <label htmlFor="lote-codigo">{label}</label>
      <div className={s.inline}>
        <input id="lote-codigo" value={value} placeholder="LOTE-BOB-0001" autoCapitalize="characters" autoComplete="off"
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscar(value); } }} />
        <button type="button" className={s.btn} onClick={() => buscar(value)} disabled={busy || !value.trim()} aria-label="Buscar lote"><Search size={18} /></button>
        <button type="button" className={s.btn} onClick={() => (scanning ? stop() : setScanning(true))} aria-label={scanning ? 'Fechar câmera' : 'Ler com a câmera'}>
          <Camera size={18} />
        </button>
      </div>
      {scanning && <div className={s.scanBox}><div id="reader-box" /></div>}
      <span className={s.hint}>Aponte a câmera para a etiqueta ou digite o código (etiqueta danificada, pouca luz).</span>
      {err && <span role="alert" style={{ color: '#b91c1c', fontSize: '0.85rem', fontWeight: 600 }}>{err}</span>}
    </div>
  );
};

/* ── Etiquetas com QR (imprimíveis) ── */
export const LabelSheet = ({ lotes, itemNome }) => {
  const [qrs, setQrs] = useState({});
  useEffect(() => {
    let alive = true;
    (async () => {
      const out = {};
      for (const l of lotes) out[l.codigo] = await QRCode.toDataURL(l.codigo, { margin: 1, width: 168 });
      if (alive) setQrs(out);
    })();
    return () => { alive = false; };
  }, [lotes]);
  return (
    <div className={s.printArea}>
      <div className={s.labels}>
        {lotes.map((l) => (
          <div key={l.codigo} className={s.label}>
            {qrs[l.codigo] ? <img src={qrs[l.codigo]} alt={`QR Code do ${l.codigo}`} /> : <div className={s.skeleton} style={{ width: 84, height: 84, margin: 0 }} />}
            <div><strong className={s.mono}>{l.codigo}</strong><small>{itemNome || l.item_nome}<br />{fmtNum(l.saldo_inicial)} {l.unidade === 'metros' ? 'm' : 'un'}</small></div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* Barras horizontais com valor em texto (acessíveis) */
export const Bars = ({ rows, fmt = fmtNum }) => {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className={s.bars}>
      {rows.map((r) => (
        <li key={r.key} className={s.barRow}>
          <span>{r.label}</span><b className={s.num}>{fmt(r.value)}</b>
          <div className={s.barTrack} role="presentation"><div className={s.barFill} style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
};


export { Combobox } from '../Select/Select';

export const Field = ({ label, children, hint, className = '' }) => (
  <div className={`${s.field} ${className}`}><label>{label}</label>{children}{hint && <span className={s.hint}>{hint}</span>}</div>
);

export { s as styles };
