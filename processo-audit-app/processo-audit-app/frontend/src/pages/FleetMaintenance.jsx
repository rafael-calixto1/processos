import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, ClipboardList } from 'lucide-react';
import styles from './Fleet.module.css';

const LIMIT = 15;

/* ════════════════════════════════════════════════════════
   History sub-component
   ════════════════════════════════════════════════════════ */
const emptyHistoryForm = {
  car_id: '', maintenance_type_id: '', maintenance_date: '',
  maintenance_kilometers: '', observation: '',
};

const MaintenanceHistory = ({ cars, types }) => {
  const [records,      setRecords]      = useState([]);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  const [showForm,     setShowForm]     = useState(false);
  const [editId,       setEditId]       = useState(null);
  const [form,         setForm]         = useState(emptyHistoryForm);
  const [saving,       setSaving]       = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const totalPages = Math.ceil(total / LIMIT) || 1;

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      const res  = await fetch(`/api/fleet/maintenance/history?${params}`);
      const json = await res.json();
      setRecords(json.maintenanceHistory || []);
      setTotal(json.total || 0);
    } catch (e) {
      setError('Erro ao carregar histórico: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const openAdd  = () => { setEditId(null); setForm(emptyHistoryForm); setShowForm(true); };
  const openEdit = r => {
    setEditId(r.id);
    setForm({
      car_id:                 r.car_id ?? '',
      maintenance_type_id:    r.maintenance_type_id ?? '',
      maintenance_date:       r.maintenance_date ? r.maintenance_date.slice(0, 10) : '',
      maintenance_kilometers: r.maintenance_kilometers ?? '',
      observation:            r.observation || '',
    });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditId(null); setForm(emptyHistoryForm); };

  const handleSave = async e => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        car_id:               form.car_id !== '' ? Number(form.car_id) : undefined,
        maintenance_type_id:  form.maintenance_type_id !== '' ? Number(form.maintenance_type_id) : undefined,
        maintenance_kilometers: form.maintenance_kilometers !== '' ? Number(form.maintenance_kilometers) : undefined,
      };
      if (editId) {
        await fetch(`/api/fleet/maintenance/history/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch('/api/fleet/maintenance/history', {
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
      await fetch(`/api/fleet/maintenance/history/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      fetchRecords();
    } catch (e) {
      setError('Erro ao excluir: ' + e.message);
    }
  };

  const getCarLabel = id => {
    const c = cars.find(x => String(x.id) === String(id));
    return c ? `${c.make} ${c.model} (${c.license_plate})` : String(id || '—');
  };

  const getTypeName = id => {
    const t = types.find(x => String(x.id) === String(id));
    return t ? t.name : '—';
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
          <Plus size={16} /> Novo Registro
        </button>
      </div>

      {showForm && (
        <div className={styles.formCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0 }}>{editId ? 'Editar Manutenção' : 'Nova Manutenção'}</h3>
            <button onClick={closeForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSave}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Veículo *</label>
                <select className={styles.select} value={form.car_id} onChange={e => setForm({ ...form, car_id: e.target.value })} required>
                  <option value="">— Selecione —</option>
                  {cars.map(c => <option key={c.id} value={c.id}>{c.make} {c.model} ({c.license_plate})</option>)}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Tipo de Manutenção *</label>
                <select className={styles.select} value={form.maintenance_type_id} onChange={e => setForm({ ...form, maintenance_type_id: e.target.value })} required>
                  <option value="">— Selecione —</option>
                  {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Data *</label>
                <input type="date" className={styles.input} value={form.maintenance_date} onChange={e => setForm({ ...form, maintenance_date: e.target.value })} required />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Km na Manutenção</label>
                <input type="number" min="0" className={styles.input} value={form.maintenance_kilometers} onChange={e => setForm({ ...form, maintenance_kilometers: e.target.value })} />
              </div>
              <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                <label className={styles.label}>Observação</label>
                <textarea className={styles.textarea} value={form.observation} onChange={e => setForm({ ...form, observation: e.target.value })} rows={2} />
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

      {loading ? (
        <div className={styles.loadingState}><div className="spinner" /><span>Carregando...</span></div>
      ) : records.length === 0 ? (
        <div className={styles.emptyState}>
          <ClipboardList size={40} color="var(--border-color)" style={{ marginBottom: '0.75rem' }} />
          <p>Nenhum registro de manutenção.</p>
          <button className={styles.btnPrimary} onClick={openAdd}><Plus size={16} /> Adicionar Manutenção</button>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Veículo</th>
                <th>Tipo</th>
                <th>Data</th>
                <th>Km</th>
                <th>Observação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{getCarLabel(r.car_id)}</td>
                  <td>
                    <span className={styles.statusBadge} style={{ background: 'var(--primary-light)', color: 'var(--primary-color)' }}>
                      {getTypeName(r.maintenance_type_id)}
                    </span>
                  </td>
                  <td>{fmtDate(r.maintenance_date)}</td>
                  <td>{r.maintenance_kilometers != null ? Number(r.maintenance_kilometers).toLocaleString('pt-BR') : '—'}</td>
                  <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.observation || '—'}
                  </td>
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

      {deleteTarget && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 style={{ marginBottom: '0.75rem' }}>Confirmar exclusão</h3>
            <p style={{ color: 'var(--text-medium)', marginBottom: 0 }}>
              Deseja excluir este registro de manutenção? Esta ação não pode ser desfeita.
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

/* ════════════════════════════════════════════════════════
   Types sub-component
   ════════════════════════════════════════════════════════ */
const emptyTypeForm = { name: '', recurrency: '', recurrency_date: '', status: 'active' };

const MaintenanceTypes = ({ types, onRefresh }) => {
  const [showForm,     setShowForm]     = useState(false);
  const [editId,       setEditId]       = useState(null);
  const [form,         setForm]         = useState(emptyTypeForm);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const openAdd  = () => { setEditId(null); setForm(emptyTypeForm); setShowForm(true); };
  const openEdit = t => {
    setEditId(t.id);
    setForm({
      name:           t.name || '',
      recurrency:     t.recurrency ?? '',
      recurrency_date: t.recurrency_date ?? '',
      status:         t.status || 'active',
    });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditId(null); setForm(emptyTypeForm); };

  const handleSave = async e => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        recurrency:      form.recurrency      !== '' ? Number(form.recurrency)      : undefined,
        recurrency_date: form.recurrency_date !== '' ? Number(form.recurrency_date) : undefined,
      };
      if (editId) {
        await fetch(`/api/fleet/maintenance/types/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch('/api/fleet/maintenance/types', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      closeForm();
      onRefresh();
    } catch (e) {
      setError('Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/fleet/maintenance/types/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      onRefresh();
    } catch (e) {
      setError('Erro ao excluir: ' + e.message);
    }
  };

  return (
    <div>
      {error && <div className={styles.errorState}>{error}</div>}

      <div className={styles.filterRow}>
        <div style={{ flex: 1 }} />
        <button className={styles.btnPrimary} onClick={openAdd}>
          <Plus size={16} /> Novo Tipo
        </button>
      </div>

      {showForm && (
        <div className={styles.formCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0 }}>{editId ? 'Editar Tipo' : 'Novo Tipo de Manutenção'}</h3>
            <button onClick={closeForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSave}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Nome *</label>
                <input className={styles.input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Recorrência (km)</label>
                <input type="number" min="0" className={styles.input} value={form.recurrency} onChange={e => setForm({ ...form, recurrency: e.target.value })} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Recorrência (dias)</label>
                <input type="number" min="0" className={styles.input} value={form.recurrency_date} onChange={e => setForm({ ...form, recurrency_date: e.target.value })} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Status</label>
                <select className={styles.select} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
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

      {types.length === 0 ? (
        <div className={styles.emptyState}>
          <p>Nenhum tipo de manutenção cadastrado.</p>
          <button className={styles.btnPrimary} onClick={openAdd}><Plus size={16} /> Adicionar Tipo</button>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Recorrência (km)</th>
                <th>Recorrência (dias)</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {types.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{t.name}</td>
                  <td>{t.recurrency != null ? Number(t.recurrency).toLocaleString('pt-BR') : '—'}</td>
                  <td>{t.recurrency_date != null ? `${t.recurrency_date} dias` : '—'}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${t.status === 'active' ? styles.statusActive : styles.statusInactive}`}>
                      {t.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actionBtns}>
                      <button className="primary" onClick={() => openEdit(t)} title="Editar"><Pencil size={15} /></button>
                      <button className="danger" onClick={() => setDeleteTarget(t)} title="Excluir"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 style={{ marginBottom: '0.75rem' }}>Confirmar exclusão</h3>
            <p style={{ color: 'var(--text-medium)', marginBottom: 0 }}>
              Deseja excluir o tipo <strong>{deleteTarget.name}</strong>? Esta ação não pode ser desfeita.
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

/* ════════════════════════════════════════════════════════
   Main FleetMaintenance component
   ════════════════════════════════════════════════════════ */
const FleetMaintenance = () => {
  const [activeTab, setActiveTab] = useState('history');
  const [cars,  setCars]  = useState([]);
  const [types, setTypes] = useState([]);

  const fetchTypes = useCallback(async () => {
    try {
      const res  = await fetch('/api/fleet/maintenance/types');
      const json = await res.json();
      setTypes(json.maintenanceTypes || []);
    } catch (e) {
      console.error('Failed to load maintenance types', e);
    }
  }, []);

  useEffect(() => {
    fetch('/api/fleet/cars?limit=500')
      .then(r => r.json())
      .then(j => setCars(j.cars || []))
      .catch(() => {});
    fetchTypes();
  }, [fetchTypes]);

  return (
    <div>
      <div className={styles.innerTabBar}>
        <button
          className={`${styles.innerTab} ${activeTab === 'history' ? styles.innerTabActive : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Histórico
        </button>
        <button
          className={`${styles.innerTab} ${activeTab === 'types' ? styles.innerTabActive : ''}`}
          onClick={() => setActiveTab('types')}
        >
          Tipos
        </button>
      </div>

      {activeTab === 'history' && (
        <MaintenanceHistory cars={cars} types={types} />
      )}
      {activeTab === 'types' && (
        <MaintenanceTypes types={types} onRefresh={fetchTypes} />
      )}
    </div>
  );
};

export default FleetMaintenance;
