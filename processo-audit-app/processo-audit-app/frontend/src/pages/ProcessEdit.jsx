import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { processAPI, departmentAPI } from '../api/index';
import { FiArrowLeft, FiPlus, FiTrash2, FiSave, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import styles from './ProcessEdit.module.css';

const ProcessEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    department_id: '',
    status: '',
    steps: []
  });
  const [newStep, setNewStep] = useState({ title: '', description: '' });
  const [editingIndex, setEditingIndex] = useState(null);
  const [editStepData, setEditStepData] = useState({ title: '', description: '' });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [proc, depts] = await Promise.all([
        processAPI.get(id),
        departmentAPI.list()
      ]);
      setFormData({
        title: proc.title,
        description: proc.description || '',
        department_id: proc.department_id,
        status: proc.status,
        steps: proc.steps || []
      });
      setDepartments(depts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStep = () => {
    if (newStep.title) {
      setFormData({
        ...formData,
        steps: [...formData.steps, { ...newStep, documentation_markdown: '' }]
      });
      setNewStep({ title: '', description: '' });
    }
  };

  const handleRemoveStep = (index) => {
    setFormData({
      ...formData,
      steps: formData.steps.filter((_, i) => i !== index)
    });
    if (editingIndex === index) setEditingIndex(null);
  };

  const startEditing = (index) => {
    setEditingIndex(index);
    setEditStepData({
      title: formData.steps[index].title,
      description: formData.steps[index].description || ''
    });
  };

  const saveStepEdit = (index) => {
    const updatedSteps = [...formData.steps];
    updatedSteps[index] = {
      ...updatedSteps[index],
      title: editStepData.title,
      description: editStepData.description
    };
    setFormData({ ...formData, steps: updatedSteps });
    setEditingIndex(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');

      // Auto-add current step if input is not empty
      let finalFormData = { ...formData };
      if (newStep.title) {
        finalFormData.steps = [...formData.steps, { ...newStep, documentation_markdown: '' }];
      }

      await processAPI.update(id, finalFormData);
      alert(`Processo atualizado com ${finalFormData.steps.length} passos!`);
      navigate(`/processos/${id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className="spinner" />
        <p>Carregando dados do processo...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => navigate(-1)} className={styles.backBtn}>
          <FiArrowLeft /> Voltar
        </button>
        <h1>Editar Processo</h1>
      </div>

      {error && <div className={styles.alert}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label>Título *</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label>Descrição</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Departamento *</label>
          <select
            value={formData.department_id}
            onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
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

        <div className={styles.formGroup}>
          <label>Status *</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            required
          >
            <option value="draft">📝 Rascunho</option>
            <option value="active">✅ Ativo</option>
            <option value="archived">📦 Arquivado</option>
          </select>
        </div>

        <div className={styles.stepsSection}>
          <h3>Passos do Processo</h3>
          
          <div className={styles.stepsList}>
            {formData.steps.map((step, idx) => (
              <div key={idx} className={`${styles.stepItem} ${editingIndex === idx ? styles.editing : ''}`}>
                {editingIndex === idx ? (
                  <div className={styles.stepEditForm}>
                    <input
                      type="text"
                      value={editStepData.title}
                      onChange={(e) => setEditStepData({ ...editStepData, title: e.target.value })}
                      placeholder="Título do passo"
                      className={styles.editInput}
                    />
                    <input
                      type="text"
                      value={editStepData.description}
                      onChange={(e) => setEditStepData({ ...editStepData, description: e.target.value })}
                      placeholder="Descrição (opcional)"
                      className={styles.editInput}
                    />
                    <div className={styles.editActions}>
                      <button
                        type="button"
                        onClick={() => saveStepEdit(idx)}
                        className="btn btn-primary btn-small"
                        title="Salvar Passo"
                      >
                        <FiCheck />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingIndex(null)}
                        className="btn btn-outline btn-small"
                        title="Cancelar"
                      >
                        <FiX />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={styles.stepInfo}>
                      <h4>{idx + 1}. {step.title}</h4>
                      {step.description && <p>{step.description}</p>}
                    </div>
                    <div className={styles.stepActions}>
                      <button
                        type="button"
                        onClick={() => startEditing(idx)}
                        className="btn btn-outline btn-small"
                        title="Editar Passo"
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveStep(idx)}
                        className="btn btn-danger btn-small"
                        title="Remover Passo"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className={styles.addStepForm}>
            <h4>Adicionar Novo Passo</h4>
            <div className={styles.formGroup}>
              <input
                type="text"
                placeholder="Título do passo"
                value={newStep.title}
                onChange={(e) => setNewStep({ ...newStep, title: e.target.value })}
              />
            </div>
            <div className={styles.formGroup}>
              <input
                type="text"
                placeholder="Descrição (opcional)"
                value={newStep.description}
                onChange={(e) => setNewStep({ ...newStep, description: e.target.value })}
              />
            </div>
            <button
              type="button"
              onClick={handleAddStep}
              className="btn btn-secondary btn-small"
              disabled={!newStep.title}
            >
              <FiPlus /> Adicionar Passo
            </button>
          </div>
        </div>

        <div className={styles.formActions}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || !formData.title || !formData.department_id}
          >
            <FiSave /> {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-outline"
            disabled={saving}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProcessEdit;
