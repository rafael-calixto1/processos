import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Users } from 'lucide-react';
import styles from './Fleet.module.css';

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

  const [deleteTarget, setDeleteTarget] = useState(null);

  const totalPages = Math.ceil(total / LIMIT) || 1;

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      const res  = await fetch(`/api/fleet/drivers?${params}`);
      const json = await res.json();
      setDrivers(json.drivers || []);
      setTotal(json.total || 0);
    } catch (e) {
      setError('Erro ao carregar motoristas: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [page]);

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
        await fetch(`/api/fleet/drivers/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else {
        await fetch('/api/fleet/drivers', {
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/fleet/drivers/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      fetchDrivers();
    } catch (e) {
      setError('Erro ao excluir: ' + e.message);
    }
  };

  return (
    <div>
      {error && <div className={styles.errorState}>{error}</div>}

      {/* Toolbar */}
      <div className={styles.filterRow}>
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
          <p>Nenhum motorista cadastrado.</p>
          <button className={styles.btnPrimary} onClick={openAdd}><Plus size={16} /> Adicionar Motorista</button>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Nome</th>
                <th>Nº CNH</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d, i) => (
                <tr key={d.id}>
                  <td style={{ color: 'var(--text-light)', width: '48px' }}>{(page - 1) * LIMIT + i + 1}</td>
                  <td style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{d.name}</td>
                  <td>{d.license_number || '—'}</td>
                  <td>
                    <div className={styles.actionBtns}>
                      <button className="primary" onClick={() => openEdit(d)} title="Editar">
                        <Pencil size={15} />
                      </button>
                      <button className="danger" onClick={() => setDeleteTarget(d)} title="Excluir">
                        <Trash2 size={15} />
                      </button>
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
              Deseja excluir o motorista <strong>{deleteTarget.name}</strong>?
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

export default FleetDrivers;
