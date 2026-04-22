import React, { useState, useEffect } from 'react';
import { departmentAPI } from '../api/index';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import styles from './Departments.module.css';

const Departments = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
    if (window.confirm('Tem certeza que deseja deletar este departamento?')) {
      try {
        await departmentAPI.delete(id);
        loadDepartments();
      } catch (err) {
        setError(err.message);
      }
    }
  };

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
        {user?.role === 'admin' && (
          <button
            className="btn btn-primary"
            onClick={() => handleOpenModal()}
          >
            <FiPlus /> Novo Departamento
          </button>
        )}
      </div>

      {error && <div className={styles.alert}>{error}</div>}

      {departments.length === 0 ? (
        <div className={styles.emptyState}>
          <p>Nenhum departamento criado ainda</p>
          {user?.role === 'admin' && (
            <button
              className="btn btn-primary"
              onClick={() => handleOpenModal()}
            >
              Criar Primeiro Departamento
            </button>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {departments.map((dept) => (
            <div key={dept.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>{dept.name}</h2>
                {user?.role === 'admin' && (
                  <div className={styles.actions}>
                    <button
                      className="btn btn-outline btn-small"
                      onClick={() => handleOpenModal(dept)}
                      title="Editar"
                    >
                      <FiEdit2 />
                    </button>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={() => handleDelete(dept.id)}
                      title="Deletar"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                )}
              </div>

              <p className={styles.description}>
                {dept.description || 'Sem descrição'}
              </p>

              <div className={styles.footer}>
                <span className={styles.processCount}>
                  📋 {dept.process_count} {dept.process_count === 1 ? 'processo' : 'processos'}
                </span>
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
              >
                ✕
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
