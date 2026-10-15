import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, X, Users, Eye } from 'lucide-react';
import styles from './Fleet.module.css';
import { fleetFetch } from './fleetFetch';
import { StatusFilter, StatusButton, StatusModal, InactiveBadge, isInactive } from './fleetStatus';
import { worstStatus, STATUS_STYLE } from './fleetMaintenanceStatus';
import { CarDetailModal } from './FleetCars';

const carLabel = c => `${c.make} ${c.model} · ${c.license_plate}`;

/* ─── Driver Detail Modal ─── */
const DriverDetailModal = ({ driverId, onClose, onViewCar }) => {
  const [data,     setData]     = useState(null);
  const [overview, setOverview] = useState({});
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fleetFetch(`/api/fleet/drivers/${driverId}/detail`).then(r => r.json()),
      fleetFetch('/api/fleet/cars/maintenance-overview').then(r => r.json()).catch(() => ({})),
    ])
      .then(([d, o]) => {
        if (d.error) throw new Error(d.error);
        setData(d);
        setOverview(o.overview || {});
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [driverId]);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modal}
        style={{ maxWidth: 720, width: '95%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
          <h3 style={{ margin:0 }}>Detalhes do Motorista</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-light)' }}>
            <X size={18} />
          </button>
        </div>

        {loading && <div className={styles.loadingState}><div className="spinner"/><span>Carregando...</span></div>}
        {error   && <div className={styles.errorState}>{error}</div>}

        {data && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'0.75rem', marginBottom:'1.75rem', padding:'1rem', background:'var(--bg-subtle,#f8f9fa)', borderRadius:10 }}>
              {[
                ['Nome',   data.driver.name],
                ['Nº CNH', data.driver.license_number || '—'],
                ['Status', data.driver.status === 'inactive' ? 'Inativo' : 'Ativo'],
              ].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize:'0.72rem', fontWeight:600, color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:2 }}>{label}</div>
                  <div style={{ fontWeight:600, color:'var(--text-dark)' }}>{val}</div>
                </div>
              ))}
            </div>

            <h4 style={{ margin:'0 0 0.75rem', color:'var(--text-dark)' }}>Veículos Atribuídos</h4>
            {data.cars.length === 0 ? (
              <p style={{ color:'var(--text-light)', fontSize:'0.875rem' }}>Nenhum veículo atribuído a este motorista.</p>
            ) : (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Veículo</th>
                      <th>Placa</th>
                      <th>Km Atual</th>
                      <th>Manutenção</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cars.map(car => {
                      const s = STATUS_STYLE[worstStatus(overview[car.id], car.current_kilometers)];
                      const Icon = s.icon;
                      return (
                        <tr key={car.id}>
                          <td style={{ fontWeight:600, color:'var(--text-dark)' }}>{car.make} {car.model}</td>
                          <td>{car.license_plate}</td>
                          <td>{car.current_kilometers != null ? Number(car.current_kilometers).toLocaleString('pt-BR') : '—'}</td>
                          <td>
                            <span
                              className={styles.statusBadge}
                              style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                              <Icon size={13} /> {s.label}
                            </span>
                          </td>
                          <td>
                            <div className={styles.actionBtns}>
                              <button onClick={() => onViewCar(car.id)} title="Visualizar veículo"><Eye size={15} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
const emptyForm = { name: '', license_number: '' };

const FleetDrivers = () => {
  const [drivers,      setDrivers]      = useState([]);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  const [showForm,     setShowForm]     = useState(false);
  const [editId,       setEditId]       = useState(null);
  const [form,         setForm]         = useState(emptyForm);
  const [saving,       setSaving]       = useState(false);

  const [statusFilter, setStatusFilter] = useState('active');
  const [statusTarget, setStatusTarget] = useState(null);
  const [viewId,       setViewId]       = useState(null);
  const [viewCarId,    setViewCarId]    = useState(null);

  const totalPages = Math.ceil(total / LIMIT) || 1;

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (statusFilter) params.set('status', statusFilter);
      const res  = await fleetFetch(`/api/fleet/drivers?${params}`);
      const json = await res.json();
      setDrivers(json.drivers || []);
      setTotal(json.total || 0);
    } catch (e) {
      setError('Erro ao carregar motoristas: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  const openAdd = () => { setEditId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = d => { setEditId(d.id); setForm({ name: d.name || '', license_number: d.license_number || '' }); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditId(null); setForm(emptyForm); };

  const handleSave = async e => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editId) {
        await fleetFetch(`/api/fleet/drivers/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else {
        await fleetFetch('/api/fleet/drivers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }
      closeForm();
      fetchDrivers();
    } catch (e) {
      setError('Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {error && <div className={styles.errorState}>{error}</div>}

      {/* Toolbar */}
      <div className={styles.filterRow}>
        <StatusFilter value={statusFilter} onChange={v => { setStatusFilter(v); setPage(1); }} />
        <div style={{ flex: 1 }} />
        <button className={styles.btnPrimary} onClick={openAdd}>
          <Plus size={16} /> Novo Motorista
        </button>
      </div>

      {/* Inline Form */}
      {showForm && (
        <div className={styles.formCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0 }}>{editId ? 'Editar Motorista' : 'Novo Motorista'}</h3>
            <button onClick={closeForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSave}>
            <div className={styles.formGrid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Nome *</label>
                <input
                  className={styles.input}
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="Nome completo"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Nº CNH</label>
                <input
                  className={styles.input}
                  value={form.license_number}
                  onChange={e => setForm({ ...form, license_number: e.target.value })}
                  placeholder="Número da habilitação"
                />
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
      ) : drivers.length === 0 ? (
        <div className={styles.emptyState}>
          <Users size={40} color="var(--border-color)" style={{ marginBottom: '0.75rem' }} />
          {statusFilter === 'inactive' ? (
            <p>Nenhum motorista inativo.</p>
          ) : (
            <>
              <p>Nenhum motorista cadastrado.</p>
              <button className={styles.btnPrimary} onClick={openAdd}><Plus size={16} /> Adicionar Motorista</button>
            </>
          )}
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Nome</th>
                <th>Nº CNH</th>
                <th>Veículo</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d, i) => (
                <tr key={d.id} className={isInactive(d) ? styles.rowInactive : undefined}>
                  <td style={{ color: 'var(--text-light)', width: '48px' }}>{(page - 1) * LIMIT + i + 1}</td>
                  <td style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{d.name} <InactiveBadge item={d} /></td>
                  <td>{d.license_number || '—'}</td>
                  <td>
                    {d.vehicles?.length
                      ? d.vehicles.map(c => <div key={c.id}>{carLabel(c)}</div>)
                      : <span style={{ color: 'var(--text-light)' }}>—</span>}
                  </td>
                  <td>
                    <div className={styles.actionBtns}>
                      <button onClick={() => setViewId(d.id)} title="Visualizar"><Eye size={15} /></button>
                      <button className="primary" onClick={() => openEdit(d)} title="Editar">
                        <Pencil size={15} />
                      </button>
                      <StatusButton item={d} onClick={setStatusTarget} />
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

      <StatusModal
        key={statusTarget?.id}
        target={statusTarget}
        endpoint="/api/fleet/drivers"
        kind="cadastro"
        label={<>o motorista <strong>{statusTarget?.name}</strong></>}
        onClose={() => setStatusTarget(null)}
        onDone={() => { setStatusTarget(null); fetchDrivers(); }}
      />

      {viewId && <DriverDetailModal driverId={viewId} onClose={() => setViewId(null)} onViewCar={setViewCarId} />}
      {viewCarId && <CarDetailModal carId={viewCarId} onClose={() => setViewCarId(null)} />}
    </div>
  );
};

export default FleetDrivers;
