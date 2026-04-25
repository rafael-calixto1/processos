import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { processAPI, departmentAPI } from '../api/index';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiCamera } from 'react-icons/fi';
import styles from './Processes.module.css';

const Processes = () => {
  const [processes, setProcesses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    department_id: '',
    steps: []
  });
  const [newStep, setNewStep] = useState({ title: '', description: '', photo_url: '' });
  const { user } = useAuth();

  useEffect(() => {
    loadData();
  }, [filterDept, filterStatus]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [procs, depts] = await Promise.all([
        processAPI.list(filterDept || null, filterStatus || null),
        departmentAPI.list()
      ]);
      setProcesses(procs);
      setDepartments(depts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProcess = async (e) => {
    e.preventDefault();
    
    // Auto-add current step if input is not empty
    let finalFormData = { ...formData };
    if (newStep.title) {
      finalFormData.steps = [...formData.steps, { ...newStep, documentation_markdown: '' }];
    }

    if (finalFormData.steps.length === 0) {
      if (!window.confirm('Este processo não tem passos. Deseja criar mesmo assim?')) {
        return;
      }
    }

    try {
      await processAPI.create(finalFormData);
      alert(`Processo criado com ${finalFormData.steps.length} passos!`);
      setShowModal(false);
      setFormData({ title: '', description: '', department_id: '', steps: [] });
      setNewStep({ title: '', description: '', photo_url: '' });
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStepPhotoUpload = async (file) => {
    if (!file) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('photo', file);
      const result = await processAPI.uploadStepPhoto(formData);
      setNewStep(prev => ({ ...prev, photo_url: result.photo_url }));
    } catch (err) {
      setError('Erro ao subir foto: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const getFullUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    // Usa o mesmo host (IP) que o usuário está usando, mas porta 5001
    const host = window.location.hostname;
    return `http://${host}:5002${url}`;
  };

  const handleAddStep = () => {
    if (newStep.title) {
      setFormData({
        ...formData,
        steps: [...formData.steps, { ...newStep, documentation_markdown: '' }]
      });
      setNewStep({ title: '', description: '', photo_url: '' });
    }
  };

  const handleRemoveStep = (index) => {
    setFormData({
      ...formData,
      steps: formData.steps.filter((_, i) => i !== index)
    });
  };

  const handleDeleteProcess = async (id) => {
    if (window.confirm('Tem certeza que deseja deletar este processo?')) {
      try {
        await processAPI.delete(id);
        loadData();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className="spinner" />
        <p>Carregando processos...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Processos</h1>
        {(user?.role === 'admin' || user?.role === 'manager') && (
          <button
            className={`btn btn-primary`}
            onClick={() => setShowModal(true)}
          >
            <FiPlus /> Novo Processo
          </button>
        )}
      </div>

      {error && <div className={styles.alert}>{error}</div>}

      {/* Filtros */}
      <div className={styles.filters}>
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
        >
          <option value="">Todos os Departamentos</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">Todos os Status</option>
          <option value="draft">Rascunho</option>
          <option value="active">Ativo</option>
          <option value="archived">Arquivado</option>
        </select>
      </div>

      {/* Lista de Processos */}
      {processes.length === 0 ? (
        <div className={styles.emptyState}>
          <p>Nenhum processo encontrado</p>
        </div>
      ) : (
        <div className={styles.processList}>
          {processes.map((process) => (
            <div key={process.id} className={styles.processItem}>
              <div className={styles.processInfo}>
                <h3>{process.title}</h3>
                <p>{process.description}</p>
                <div className={styles.metadata}>
                  <span className={`badge badge-${process.status}`}>
                    {process.status === 'active' ? '✅ Ativo' : 
                     process.status === 'draft' ? '📝 Rascunho' : 
                     '📦 Arquivado'}
                  </span>
                  <span className={styles.dept}>🏢 {process.department_name}</span>
                  <span className={styles.steps}>{process.steps?.length || 0} passos</span>
                </div>
              </div>

              <div className={styles.actions}>
                <Link
                  to={`/processos/${process.id}`}
                  className={`btn btn-outline btn-small`}
                  title="Visualizar"
                >
                  <FiEye />
                </Link>
                {(user?.role === 'admin' || user?.role === 'manager') && (
                  <>
                    <Link
                      to={`/processos/${process.id}/edit`}
                      className={`btn btn-outline btn-small`}
                      title="Editar"
                    >
                      <FiEdit2 />
                    </Link>
                    {user?.role === 'admin' && (
                      <button
                        className={`btn btn-danger btn-small`}
                        onClick={() => handleDeleteProcess(process.id)}
                        title="Deletar"
                      >
                        <FiTrash2 />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Criar Processo */}
      {showModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>Criar Novo Processo</h2>
              <button
                className={styles.closeBtn}
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProcess} className={styles.form}>
              <div className={styles.formGroup}>
                <label>Título *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Descrição</label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Departamento *</label>
                <select
                  value={formData.department_id}
                  onChange={(e) =>
                    setFormData({ ...formData, department_id: e.target.value })
                  }
                  required
                >
                  <option value="">Selecione um departamento</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Passos */}
              <div className={styles.stepsSection}>
                <h3>Passos do Processo</h3>

                {formData.steps.length > 0 && (
                  <div className={styles.stepsList}>
                    {formData.steps.map((step, idx) => (
                      <div key={idx} className={styles.stepItem}>
                        <div>
                          <strong>{idx + 1}. {step.title}</strong>
                          {step.description && <p>{step.description}</p>}
                          {step.photo_url && (
                            <img 
                              src={getFullUrl(step.photo_url)} 
                              alt="Thumbnail" 
                              className={styles.stepThumb} 
                            />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveStep(idx)}
                          className="btn btn-danger btn-small"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className={styles.addStepForm}>
                  <input
                    type="text"
                    placeholder="Título do passo"
                    value={newStep.title}
                    onChange={(e) =>
                      setNewStep({ ...newStep, title: e.target.value })
                    }
                  />
                  <input
                    type="text"
                    placeholder="Descrição (opcional)"
                    value={newStep.description}
                    onChange={(e) =>
                      setNewStep({ ...newStep, description: e.target.value })
                    }
                  />
                  
                  <div className={styles.stepPhotoSection}>
                    <label htmlFor="step-photo" className={styles.photoBtn}>
                      <FiCamera /> {newStep.photo_url ? '📸 Alterar Foto' : '➕ Foto de Instrução'}
                    </label>
                    <input
                      type="file"
                      id="step-photo"
                      accept="image/*"
                      className={styles.photoInput}
                      onChange={(e) => handleStepPhotoUpload(e.target.files[0])}
                    />
                    {uploading && <p>Subindo...</p>}
                    {newStep.photo_url && (
                      <div className={styles.photoPreview}>
                        <img src={getFullUrl(newStep.photo_url)} alt="Preview" />
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddStep}
                    className="btn btn-secondary btn-small"
                    disabled={uploading}
                  >
                    <FiPlus /> Adicionar Passo
                  </button>
                </div>
              </div>

              <div className={styles.formActions}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!formData.title || !formData.department_id}
                >
                  Criar Processo
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

export default Processes;
