// Na Frota nada é apagado: o registro é inativado (e pode ser reativado). O backend recusa DELETE.
import React, { useState } from 'react';
import { Ban, RotateCcw } from 'lucide-react';
import styles from './Fleet.module.css';
import { Select } from '../components/Select/Select';
import { fleetFetch } from './fleetFetch';

export const isInactive = r => r?.status === 'inactive';

/** Opções de um <select> de cadastro: só os ativos, mais o que já está escolhido (mesmo inativo). */
export const activeOrSelected = (items, selectedId) =>
  items.filter(i => !isInactive(i) || String(i.id) === String(selectedId));

/** Filtro das listas: o padrão é "Ativos"; o valor vai direto para ?status= */
export const StatusFilter = ({ value, onChange }) => (
  <>
    <label>Status</label>
    <Select value={value} onChange={e => onChange(e.target.value)} className={styles.select} style={{ width: 'auto' }}>
      <option value="active">Ativos</option>
      <option value="inactive">Inativos</option>
      <option value="">Todos</option>
    </Select>
  </>
);

export const InactiveBadge = ({ item }) => (isInactive(item)
  ? <span className={`${styles.statusBadge} ${styles.statusInactive}`}>Inativo</span>
  : null);

export const StatusButton = ({ item, onClick }) => (isInactive(item)
  ? <button className="primary" onClick={() => onClick(item)} title="Reativar"><RotateCcw size={15} /></button>
  : <button className="danger" onClick={() => onClick(item)} title="Inativar"><Ban size={15} /></button>);

/**
 * Confirmação de inativar/reativar `target` em `${endpoint}/:id/status`.
 * `kind`: 'cadastro' (veículo, motorista, tipo) some das listas de seleção;
 *         'registro' (abastecimento, manutenção) deixa de contar nos painéis e custos.
 */
export const StatusModal = ({ target, endpoint, label, kind = 'registro', onClose, onDone }) => {
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  if (!target) return null;

  const inativar = !isInactive(target);
  const efeito = kind === 'cadastro'
    ? 'Deixa de aparecer para seleção nos cadastros, mas todo o histórico continua guardado.'
    : 'Deixa de contar nos painéis e custos, mas continua guardado.';

  const confirmar = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fleetFetch(`${endpoint}/${target.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: inativar ? 'inactive' : 'active' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      onDone();
    } catch (e) {
      setError((inativar ? 'Erro ao inativar: ' : 'Erro ao reativar: ') + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3 style={{ marginBottom: '0.75rem' }}>{inativar ? 'Inativar' : 'Reativar'}</h3>
        <p style={{ color: 'var(--text-medium)', marginBottom: 0 }}>
          {inativar ? 'Inativar' : 'Reativar'} {label}?{' '}
          {inativar ? `${efeito} Pode ser reativado a qualquer momento.` : 'Volta a valer normalmente.'}
        </p>
        {error && <div className={styles.errorState} style={{ marginTop: '0.75rem', marginBottom: 0 }}>{error}</div>}
        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={saving}>Cancelar</button>
          <button className={inativar ? styles.btnDanger : styles.btnPrimary} onClick={confirmar} disabled={saving}>
            {saving ? 'Salvando...' : inativar ? 'Inativar' : 'Reativar'}
          </button>
        </div>
      </div>
    </div>
  );
};
