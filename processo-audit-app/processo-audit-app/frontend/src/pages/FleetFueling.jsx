import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Fuel } from 'lucide-react';
import styles from './Fleet.module.css';

const LIMIT = 15;
const FUEL_TYPES = ['Gasolina', 'Etanol', 'Diesel', 'GNV'];

const emptyForm = {
  car_id: '', fuel_date: '', fueling_kilometers: '',
  fuel_amount: '', liters_quantity: '', price_per_liter: '',
  total_cost: '', fuel_type: 'Gasolina', observation: '',
};

const FleetFueling = () => {
  const [records,      setRecords]      = useState([]);
  const [cars,         setCars]         = useState([]);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  const [showForm,     setShowForm]     = useState(false);
  const [editId,       setEditId]       = useState(null);
  const [form,         setForm]         = useState(emptyForm);
  const [saving,       setSaving]       = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);

  const totalPages = Math.ceil(total / LIMIT) || 1;

  useEffect(() => {
    fetch('/api/fleet/cars?limit=500')
      .then(r => r.json())
      .then(j => setCars(j.cars || []))
      .catch(() => {});
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      const res  = await fetch(`/api/fleet/fueling?${params}`);
      const json = await res.json();
      setRecords(json.fuelingHistory || []);
      setTotal(json.total || 0);
    } catch (e) {
      setError('Erro ao carregar abastecimentos: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  /* Auto-calculate total_cost */
  const handleFormChange = (field, value) => {
    const next = { ...form, [field]: value };
    const liters = parseFloat(field === 'liters_quantity' ? value : next.liters_quantity) || 0;
    const price  = parseFloat(field === 'price_per_liter' ? value : next.price_per_liter) || 0;
    if (liters > 0 && price > 0) {
      next.total_cost = (liters * price).toFixed(2);
    }
    setForm(next);
  };

  const openAdd = () => { setEditId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = r => {
    setEditId(r.id);
    setForm({
      car_id:              r.car_id ?? '',
      fuel_date:           r.fuel_date ? r.fuel_date.slice(0, 10) : '',
      fueling_kilometers:  r.fueling_kilometers ?? '',
      fuel_amount:         r.fuel_amount ?? '',
      liters_quantity:     r.liters_quantity ?? '',
      price_per_liter:     r.price_per_liter ?? '',
      total_cost:          r.total_cost ?? '',
      fuel_type:           r.fuel_type || 'Gasolina',
      observation:         r.observation || '',
    });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditId(null); setForm(emptyForm); };

  const handleSave = async e => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        car_id:             form.car_id !== '' ? Number(form.car_id) : undefined,
        fueling_kilometers: form.fueling_kilometers !== '' ? Number(form.fueling_kilometers) : undefined,
        fuel_amount:        form.fuel_amount !== '' ? Number(form.fuel_amount) : undefined,
        liters_quantity:    form.liters_quantity !== '' ? Number(form.liters_quantity) : undefined,
        price_per_liter:    form.price_per_liter !== '' ? Number(form.price_per_liter) : undefined,
        total_cost:         form.total_cost !== '' ? Number(form.total_cost) : undefined,
      };
      if (editId) {
        await fetch(`/api/fleet/fueling/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch('/api/fleet/fueling', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      closeForm();
      fetchRecords();
    } catch (e) {
      setError('Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/fleet/fueling/entry/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      fetchRecords();
    } catch (e) {
      setError('Erro ao excluir: ' + e.message);
    }
  };

  const getCarLabel = id => {
    const c = cars.find(x => String(x.id) === String(id));
    return c ? `${c.make} ${c.model} (${c.license_plate})` : '—';
  };

  const fmtDate = v => {
    if (!v) return '—';
    try { return new Date(v).toLocaleDateString('pt-BR'); } catch { return '—'; }
  };

  return (
    <div>
      {error && <div className={styles.errorState}>{error}</div>}

      <div className={styles.filterRow}>
        <div style={{ flex: 1 }} />
        <button className={styles.btnPrimary} onClick={openAdd}>
          <Plus size={16} /> Novo Abastecimento
        </button>
      </div>

      {/* Inline Form */}
      {showForm && (
        <div className={styles.formCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0 }}>{editId ? 'Editar Abastecimento' : 'Novo Abastecimento'}</h3>
            <button onClick={closeForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSave}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Veículo *</label>
                <select className={styles.select} value={form.car_id} onChange={e => handleFormChange('car_id', e.target.value)} required>
                  <option value="">— Selecione —</option>
                  {cars.map(c => <option key={c.id} value={c.id}>{c.make} {c.model} ({c.license_plate})</option>)}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Data *</label>
                <input type="date" className={styles.input} value={form.fuel_date} onChange={e => handleFormChange('fuel_date', e.target.value)} required />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Km no Abastecimento</label>
                <input type="number" min="0" className={styles.input} value={form.fueling_kilometers} onChange={e => handleFormChange('fueling_kilometers', e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Tipo de Combustível</label>
                <select className={styles.select} value={form.fuel_type} onChange={e => handleFormChange('fuel_type', e.target.value)}>
                  {FUEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Litros</label>
                <input type="number" min="0" step="0.001" className={styles.input} value={form.liters_quantity} onChange={e => handleFormChange('liters_quantity', e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Preço por Litro (R$)</label>
                <input type="number" min="0" step="0.001" className={styles.input} value={form.price_per_liter} onChange={e => handleFormChange('price_per_liter', e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Valor Total (R$)</label>
                <input type="number" min="0" step="0.01" className={styles.input} value={form.total_cost} onChange={e => handleFormChange('total_cost', e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Valor Pago (R$)</label>
                <input type="number" min="0" step="0.01" className={styles.input} value={form.fuel_amount} onChange={e => handleFormChange('fuel_amount', e.target.value)} />
              </div>
              <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                <label className={styles.label}>Observação</label>
                <textarea className={styles.textarea} value={form.observation} onChange={e => handleFormChange('observation', e.target.value)} rows={2} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" className={styles.btnSecondary} onClick={closeForm}>Cancelar</button>
              <button type="submit" className={styles.btnPrimary} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className={styles.loadingState}><div className="spinner" /><span>Carregando...</span></div>
      ) : records.length === 0 ? (
        <div className={styles.emptyState}>
          <Fuel size={40} color="var(--border-color)" style={{ marginBottom: '0.75rem' }} />
          <p>Nenhum abastecimento registrado.</p>
          <button className={styles.btnPrimary} onClick={openAdd}><Plus size={16} /> Adicionar Abastecimento</button>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Veículo</th>
                <th>Tipo</th>
                <th>Litros</th>
                <th>R$/L</th>
                <th>Total (R$)</th>
                <th>Km</th>
                <th>Data</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>
                      {getCarLabel(r.car_id)}
                    </span>
                  </td>
                  <td>
                    <span className={styles.statusBadge} style={{ background: 'var(--primary-light)', color: 'var(--primary-color)' }}>
                      {r.fuel_type || '—'}
                    </span>
                  </td>
                  <td>{r.liters_quantity != null ? parseFloat(r.liters_quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}</td>
                  <td>{r.price_per_liter != null ? `R$ ${parseFloat(r.price_per_liter).toLocaleString('pt-BR', { minimumFractionDigits: 3 })}` : '—'}</td>
                  <td style={{ fontWeight: 600 }}>
                    {r.total_cost != null ? `R$ ${parseFloat(r.total_cost).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td>{r.fueling_kilometers != null ? Number(r.fueling_kilometers).toLocaleString('pt-BR') : '—'}</td>
                  <td>{fmtDate(r.fuel_date)}</td>
                  <td>
                    <div className={styles.actionBtns}>
                      <button className="primary" onClick={() => openEdit(r)} title="Editar"><Pencil size={15} /></button>
                      <button className="danger" onClick={() => setDeleteTarget(r)} title="Excluir"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button className={styles.paginationBtn} disabled={page === 1} onClick={() => setPage(1)}>«</button>
              <button className={styles.paginationBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`${styles.paginationBtn} ${page === p ? styles.paginationBtnActive : ''}`}
                  >{p}</button>
                );
              })}
              <button className={styles.paginationBtn} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
              <button className={styles.paginationBtn} disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
            </div>
          )}
        </div>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 style={{ marginBottom: '0.75rem' }}>Confirmar exclusão</h3>
            <p style={{ color: 'var(--text-medium)', marginBottom: 0 }}>
              Deseja excluir este registro de abastecimento? Esta ação não pode ser desfeita.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setDeleteTarget(null)}>Cancelar</button>
              <button className={styles.btnDanger} onClick={handleDelete}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FleetFueling;
