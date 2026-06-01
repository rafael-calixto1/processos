import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, X, Car } from 'lucide-react';
import styles from './Fleet.module.css';

const LIMIT = 15;

const emptyForm = {
  make: '', model: '', license_plate: '',
  current_kilometers: '', next_tire_change: '', next_oil_change: '',
  driver_id: '', status: 'active',
};

const FleetCars = () => {
  const [cars,        setCars]        = useState([]);
  const [drivers,     setDrivers]     = useState([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [sortField,   setSortField]   = useState('make');
  const [sortOrder,   setSortOrder]   = useState('asc');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  const [showForm,    setShowForm]    = useState(false);
  const [editId,      setEditId]      = useState(null);
  const [form,        setForm]        = useState(emptyForm);
  const [saving,      setSaving]      = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);

  const totalPages = Math.ceil(total / LIMIT) || 1;

  const fetchCars = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page, limit: LIMIT, sortField, sortOrder,
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      const res  = await fetch(`/api/fleet/cars?${params}`);
      const json = await res.json();
      setCars(json.cars || []);
      setTotal(json.totalItems || 0);
    } catch (e) {
      setError('Erro ao carregar veículos: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [page, sortField, sortOrder, statusFilter]);

  useEffect(() => { fetchCars(); }, [fetchCars]);

  useEffect(() => {
    fetch('/api/fleet/drivers?limit=500')
      .then(r => r.json())
      .then(j => setDrivers(j.drivers || []))
      .catch(() => {});
  }, []);

  const handleSort = field => {
    if (sortField === field) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />;
  };

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = car => {
    setEditId(car.id);
    setForm({
      make:               car.make || '',
      model:              car.model || '',
      license_plate:      car.license_plate || '',
      current_kilometers: car.current_kilometers ?? '',
      next_tire_change:   car.next_tire_change ?? '',
      next_oil_change:    car.next_oil_change ?? '',
      driver_id:          car.driver_id ?? '',
      status:             car.status || 'active',
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
        current_kilometers: form.current_kilometers !== '' ? Number(form.current_kilometers) : undefined,
        next_tire_change:   form.next_tire_change   !== '' ? Number(form.next_tire_change)   : undefined,
        next_oil_change:    form.next_oil_change    !== '' ? Number(form.next_oil_change)     : undefined,
        driver_id:          form.driver_id !== '' ? Number(form.driver_id) : null,
      };
      if (editId) {
        await fetch(`/api/fleet/cars/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch('/api/fleet/cars', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      closeForm();
      fetchCars();
    } catch (e) {
      setError('Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/fleet/cars/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      fetchCars();
    } catch (e) {
      setError('Erro ao excluir: ' + e.message);
    }
  };

  const getDriverName = id => {
    const d = drivers.find(x => String(x.id) === String(id));
    return d ? d.name : '—';
  };

  return (
    <div>
      {error && <div className={styles.errorState}>{error}</div>}

      {/* Toolbar */}
      <div className={styles.filterRow}>
        <label>Status</label>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className={styles.select}
          style={{ width: 'auto' }}
        >
          <option value="">Todos</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
        </select>
        <div style={{ flex: 1 }} />
        <button className={styles.btnPrimary} onClick={openAdd}>
          <Plus size={16} /> Novo Veículo
        </button>
      </div>

      {/* Inline Form */}
      {showForm && (
        <div className={styles.formCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0 }}>{editId ? 'Editar Veículo' : 'Novo Veículo'}</h3>
            <button onClick={closeForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSave}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Marca *</label>
                <input className={styles.input} value={form.make} onChange={e => setForm({ ...form, make: e.target.value })} required />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Modelo *</label>
                <input className={styles.input} value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} required />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Placa *</label>
                <input className={styles.input} value={form.license_plate} onChange={e => setForm({ ...form, license_plate: e.target.value })} required />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Km Atual</label>
                <input className={styles.input} type="number" min="0" value={form.current_kilometers} onChange={e => setForm({ ...form, current_kilometers: e.target.value })} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Próx. Troca de Pneu (km)</label>
                <input className={styles.input} type="number" min="0" value={form.next_tire_change} onChange={e => setForm({ ...form, next_tire_change: e.target.value })} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Próx. Troca de Óleo (km)</label>
                <input className={styles.input} type="number" min="0" value={form.next_oil_change} onChange={e => setForm({ ...form, next_oil_change: e.target.value })} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Motorista</label>
                <select className={styles.select} value={form.driver_id} onChange={e => setForm({ ...form, driver_id: e.target.value })}>
                  <option value="">— Nenhum —</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
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

      {/* Table */}
      {loading ? (
        <div className={styles.loadingState}><div className="spinner" /><span>Carregando...</span></div>
      ) : cars.length === 0 ? (
        <div className={styles.emptyState}>
          <Car size={40} color="var(--border-color)" style={{ marginBottom: '0.75rem' }} />
          <p>Nenhum veículo encontrado.</p>
          <button className={styles.btnPrimary} onClick={openAdd}><Plus size={16} /> Adicionar Veículo</button>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort('make')} style={{ cursor: 'pointer' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    Veículo <SortIcon field="make" />
                  </span>
                </th>
                <th className="sortable" onClick={() => handleSort('license_plate')} style={{ cursor: 'pointer' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    Placa <SortIcon field="license_plate" />
                  </span>
                </th>
                <th>Km Atual</th>
                <th>Próx. Pneu (km)</th>
                <th>Próx. Óleo (km)</th>
                <th>Motorista</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {cars.map(car => (
                <tr key={car.id}>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{car.make} {car.model}</span>
                  </td>
                  <td>{car.license_plate}</td>
                  <td>{car.current_kilometers != null ? Number(car.current_kilometers).toLocaleString('pt-BR') : '—'}</td>
                  <td>{car.next_tire_change != null ? Number(car.next_tire_change).toLocaleString('pt-BR') : '—'}</td>
                  <td>{car.next_oil_change  != null ? Number(car.next_oil_change).toLocaleString('pt-BR')  : '—'}</td>
                  <td>{getDriverName(car.driver_id)}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${car.status === 'active' ? styles.statusActive : styles.statusInactive}`}>
                      {car.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actionBtns}>
                      <button className="primary" onClick={() => openEdit(car)} title="Editar">
                        <Pencil size={15} />
                      </button>
                      <button className="danger" onClick={() => setDeleteTarget(car)} title="Excluir">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button className={styles.paginationBtn} disabled={page === 1} onClick={() => setPage(1)}>«</button>
              <button className={styles.paginationBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
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
              Deseja excluir o veículo <strong>{deleteTarget.make} {deleteTarget.model}</strong> ({deleteTarget.license_plate})?
              Esta ação não pode ser desfeita.
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

export default FleetCars;
