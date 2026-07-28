import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { departmentAPI } from '../api/index';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, Trash2, Search, X, FileText, Building2 } from 'lucide-react';
import styles from './Departments.module.css';

const Departments = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const { user } = useAuth();

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const data = await departmentAPI.list();
      setDepartments(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (dept = null) => {
    if (dept) {
      setFormData({ name: dept.name, description: dept.description });
      setEditingId(dept.id);
    } else {
      setFormData({ name: '', description: '' });
      setEditingId(null);
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await departmentAPI.update(editingId, formData);
      } else {
        await departmentAPI.create(formData);
      }
      setShowModal(false);
      loadDepartments();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja inativar este departamento?')) {
      try {
        await departmentAPI.delete(id);
        loadDepartments();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const term = search.trim().toLowerCase();
  const filtered = term
    ? departments.filter(d =>
        (d.name || '').toLowerCase().includes(term) ||
        (d.description || '').toLowerCase().includes(term)
      )
    : departments;

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className="spinner" />
        <p>Carregando departamentos...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Departamentos</h1>
      </div>

      {error && <div className={styles.alert}>{error}</div>}

      {/* Toolbar: busca + ação primária */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={16} strokeWidth={2} className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Buscar por nome ou descrição…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {user?.role === 'admin' && (
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <Plus size={16} /> Novo Departamento
          </button>
        )}
      </div>

      {departments.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>
            <Building2 size={22} strokeWidth={2} />
          </span>
          <p>Nenhum departamento criado ainda</p>
          {user?.role === 'admin' && (
            <button className="btn btn-primary" onClick={() => handleOpenModal()}>
              Criar Primeiro Departamento
            </button>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>
            <Search size={22} strokeWidth={2} />
          </span>
          <p>Nenhum departamento encontrado para “{search.trim()}”</p>
          <button className="btn btn-outline" onClick={() => setSearch('')}>
            Limpar busca
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((dept) => (
            <div key={dept.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>{dept.name}</h2>
                {user?.role === 'admin' && (
                  <div className={styles.actions}>
                    <button
                      className={styles.iconBtn}
                      onClick={() => handleOpenModal(dept)}
                      title="Editar departamento"
                      aria-label={`Editar ${dept.name}`}
                    >
                      <Pencil size={16} strokeWidth={2} />
                    </button>
                    <button
                      className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                      onClick={() => handleDelete(dept.id)}
                      title="Inativar departamento"
                      aria-label={`Inativar ${dept.name}`}
                    >
                      <Trash2 size={16} strokeWidth={2} />
                    </button>
                  </div>
                )}
              </div>

              {/* Sem descrição: o campo some e o espaçador mantém os cartões alinhados */}
              {dept.description
                ? <p className={styles.description}>{dept.description}</p>
                : <div className={styles.descriptionSpacer} aria-hidden="true" />}

              <div className={styles.footer}>
                <Link
                  to={`/processos?departamento=${dept.id}`}
                  className={styles.processCount}
                  title={`Ver processos de ${dept.name}`}
                >
                  <FileText size={13} strokeWidth={2.5} />
                  {dept.process_count} {dept.process_count === 1 ? 'processo' : 'processos'}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>{editingId ? 'Editar Departamento' : 'Novo Departamento'}</h2>
              <button
                className={styles.closeBtn}
                onClick={() => setShowModal(false)}
                aria-label="Fechar"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formGroup}>
                <label>Nome *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  placeholder="ex: Departamento de TI"
                />
              </div>

              <div className={styles.formGroup}>
                <label>Descrição</label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Descrição do departamento"
                  rows={4}
                />
              </div>

              <div className={styles.formActions}>
                <button type="submit" className="btn btn-primary">
                  {editingId ? 'Atualizar' : 'Criar'} Departamento
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-outline"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>

          <div className={styles.modalBackdrop} onClick={() => setShowModal(false)} />
        </div>
      )}
    </div>
  );
};

export default Departments;
