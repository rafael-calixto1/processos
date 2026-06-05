import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, X, Car, Eye, CheckCircle2, AlertTriangle, AlertCircle, Clock } from 'lucide-react';
import styles from './Fleet.module.css';

/* ─── Maintenance status helpers ─── */
const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };

const calcStatus = (item, currentKm) => {
  if (!item.recurrence_mode) return 'none';
  const now = today();
  let worst = 'green';

  const worse = (a, b) => {
    const rank = { red: 3, yellow: 2, green: 1, none: 0 };
    return rank[a] >= rank[b] ? a : b;
  };

  if (item.recurrence_mode === 'km' || item.recurrence_mode === 'both') {
    if (item.recurrency) {
      if (item.last_km == null) {
        worst = worse(worst, 'yellow');
      } else {
        const rem = (Number(item.last_km) + Number(item.recurrency)) - Number(currentKm || 0);
        if (rem <= 0)    worst = worse(worst, 'red');
        else if (rem <= 1000) worst = worse(worst, 'yellow');
      }
    }
  }

  if (item.recurrence_mode === 'date' || item.recurrence_mode === 'both') {
    if (item.recurrency_date) {
      if (!item.last_date) {
        worst = worse(worst, 'yellow');
      } else {
        const next = new Date(item.last_date);
        next.setDate(next.getDate() + Number(item.recurrency_date));
        const days = Math.floor((next - now) / 86400000);
        if (days <= 0)  worst = worse(worst, 'red');
        else if (days <= 30) worst = worse(worst, 'yellow');
      }
    }
  }

  return worst;
};

const STATUS_STYLE = {
  red:    { bg: 'rgba(220,38,38,0.08)',   border: 'rgba(220,38,38,0.35)',   color: '#b91c1c',  icon: AlertCircle   },
  yellow: { bg: 'rgba(234,179,8,0.10)',   border: 'rgba(234,179,8,0.40)',   color: '#92400e',  icon: AlertTriangle },
  green:  { bg: 'rgba(22,163,74,0.08)',   border: 'rgba(22,163,74,0.30)',   color: '#15803d',  icon: CheckCircle2  },
  none:   { bg: 'var(--bg-card)',          border: 'var(--border-color)',    color: 'var(--text-medium)', icon: Clock },
};

const fmtDays = days => {
  if (!days) return null;
  if (days % 30 === 0) { const n = days/30; return `${n} ${n===1?'mês':'meses'}`; }
  if (days % 7  === 0) { const n = days/7;  return `${n} ${n===1?'semana':'semanas'}`; }
  return `${days} ${days===1?'dia':'dias'}`;
};

const nextDueText = (item, currentKm) => {
  const lines = [];
  if ((item.recurrence_mode==='km'||item.recurrence_mode==='both') && item.recurrency) {
    const base = item.last_km != null ? Number(item.last_km) : 0;
    const next = base + Number(item.recurrency);
    const rem  = next - Number(currentKm || 0);
    lines.push(rem > 0
      ? `Km: faltam ${Number(rem).toLocaleString('pt-BR')} km (próx. aos ${Number(next).toLocaleString('pt-BR')} km)`
      : `Km: vencido há ${Math.abs(rem).toLocaleString('pt-BR')} km`);
  }
  if ((item.recurrence_mode==='date'||item.recurrence_mode==='both') && item.recurrency_date) {
    if (!item.last_date) {
      lines.push(`Data: nunca realizado (a cada ${fmtDays(item.recurrency_date)})`);
    } else {
      const next = new Date(item.last_date);
      next.setDate(next.getDate() + Number(item.recurrency_date));
      const days = Math.floor((next - today()) / 86400000);
      lines.push(days > 0
        ? `Data: faltam ${days} dias (${next.toLocaleDateString('pt-BR')})`
        : `Data: vencido há ${Math.abs(days)} dias`);
    }
  }
  return lines;
};

/* ─── Car Detail Modal ─── */
const CarDetailModal = ({ carId, onClose }) => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/fleet/cars/${carId}/detail`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [carId]);

  const fmtDate = v => {
    if (!v) return '—';
    try { return new Date(v).toLocaleDateString('pt-BR'); } catch { return '—'; }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modal}
        style={{ maxWidth: 720, width: '95%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
          <h3 style={{ margin:0 }}>Detalhes do Veículo</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-light)' }}>
            <X size={18} />
          </button>
        </div>

        {loading && <div className={styles.loadingState}><div className="spinner"/><span>Carregando...</span></div>}
        {error   && <div className={styles.errorState}>{error}</div>}

        {data && (
          <>
            {/* Car info */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'0.75rem', marginBottom:'1.75rem', padding:'1rem', background:'var(--bg-subtle,#f8f9fa)', borderRadius:10 }}>
              {[
                ['Veículo',   `${data.car.make} ${data.car.model}`],
                ['Placa',     data.car.license_plate],
                ['Km Atual',  data.car.current_kilometers != null ? Number(data.car.current_kilometers).toLocaleString('pt-BR') : '—'],
                ['Motorista', data.car.driver_name || '—'],
                ['Status',    data.car.status === 'active' ? 'Ativo' : 'Inativo'],
              ].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize:'0.72rem', fontWeight:600, color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:2 }}>{label}</div>
                  <div style={{ fontWeight:600, color:'var(--text-dark)' }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Maintenance status */}
            <h4 style={{ margin:'0 0 0.75rem', color:'var(--text-dark)' }}>Status das Manutenções</h4>
            {data.maintenanceStatus.length === 0 ? (
              <p style={{ color:'var(--text-light)', fontSize:'0.875rem' }}>Nenhum tipo de manutenção cadastrado.</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem', marginBottom:'1.75rem' }}>
                {data.maintenanceStatus.map(item => {
                  const st = calcStatus(item, data.car.current_kilometers);
                  const { bg, border, color, icon: Icon } = STATUS_STYLE[st];
                  const lines = nextDueText(item, data.car.current_kilometers);
                  return (
                    <div key={item.id} style={{ display:'flex', gap:'0.75rem', alignItems:'flex-start', padding:'0.75rem 1rem', borderRadius:8, background:bg, border:`1px solid ${border}` }}>
                      <Icon size={18} style={{ color, flexShrink:0, marginTop:2 }} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, color:'var(--text-dark)', marginBottom: lines.length ? 2 : 0 }}>{item.name}</div>
                        {lines.map((l,i) => <div key={i} style={{ fontSize:'0.82rem', color }}>{l}</div>)}
                        {!item.recurrence_mode && (
                          <div style={{ fontSize:'0.82rem', color:'var(--text-light)' }}>Sem recorrência configurada</div>
                        )}
                        {item.last_date && (
                          <div style={{ fontSize:'0.78rem', color:'var(--text-light)', marginTop:2 }}>
                            Última: {fmtDate(item.last_date)}{item.last_km != null ? ` · ${Number(item.last_km).toLocaleString('pt-BR')} km` : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* History */}
            <h4 style={{ margin:'0 0 0.75rem', color:'var(--text-dark)' }}>Histórico Recente</h4>
            {data.history.length === 0 ? (
              <p style={{ color:'var(--text-light)', fontSize:'0.875rem' }}>Nenhuma manutenção registrada.</p>
            ) : (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Data</th>
                      <th>Km</th>
                      <th>Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map(h => (
                      <tr key={h.id}>
                        <td>
                          <span className={styles.statusBadge} style={{ background:'var(--primary-light)', color:'var(--primary-color)' }}>
                            {h.type_name || '—'}
                          </span>
                        </td>
                        <td>{fmtDate(h.maintenance_date)}</td>
                        <td>{h.maintenance_kilometers != null ? Number(h.maintenance_kilometers).toLocaleString('pt-BR') : '—'}</td>
                        <td style={{ maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text-medium)' }}>
                          {h.observation || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const LIMIT = 15;

const emptyForm = {
  make: '', model: '', license_plate: '',
  current_kilometers: '', driver_id: '', status: 'active',
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
  const [viewId,       setViewId]       = useState(null);

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
                  <td>{getDriverName(car.driver_id)}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${car.status === 'active' ? styles.statusActive : styles.statusInactive}`}>
                      {car.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actionBtns}>
                      <button onClick={() => setViewId(car.id)} title="Visualizar"><Eye size={15} /></button>
                      <button className="primary" onClick={() => openEdit(car)} title="Editar"><Pencil size={15} /></button>
                      <button className="danger" onClick={() => setDeleteTarget(car)} title="Excluir"><Trash2 size={15} /></button>
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

      {/* Car Detail Modal */}
      {viewId && <CarDetailModal carId={viewId} onClose={() => setViewId(null)} />}

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
