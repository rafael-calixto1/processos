import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { processAPI, departmentAPI } from '../api/index';
import { FiArrowLeft, FiPlus, FiTrash2, FiSave, FiEdit2, FiCheck, FiX, FiCamera, FiArrowUp, FiArrowDown } from 'react-icons/fi';
import styles from './ProcessEdit.module.css';

const ProcessEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    department_id: '',
    status: 'active',
    steps: []
  });
  const [newStep, setNewStep] = useState({ title: '', description: '', photo_url: '' });
  const [editingIndex, setEditingIndex] = useState(null);
  const [editStepData, setEditStepData] = useState({ title: '', description: '', photo_url: '' });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const depts = await departmentAPI.list();
      setDepartments(depts);

      if (id) {
        const proc = await processAPI.get(id);
        setFormData({
          title: proc.title,
          description: proc.description || '',
          department_id: proc.department_id,
          status: proc.status,
          steps: proc.steps || []
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStepPhotoUpload = async (file, isEditing = false) => {
    if (!file) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('photo', file);
      const result = await processAPI.uploadStepPhoto(formData);
      
      if (isEditing) {
        setEditStepData(prev => ({ ...prev, photo_url: result.photo_url }));
      } else {
        setNewStep(prev => ({ ...prev, photo_url: result.photo_url }));
      }
    } catch (err) {
      setError('Erro ao subir foto: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const getFullUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http') || url.startsWith('blob:')) return url;
    return url;
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

  const handleInsertStep = (index) => {
    const newEmptyStep = { title: '', description: '', photo_url: '', documentation_markdown: '' };
    const updatedSteps = [...formData.steps];
    updatedSteps.splice(index, 0, newEmptyStep);
    
    setFormData({
      ...formData,
      steps: updatedSteps
    });
    setEditingIndex(index);
    setEditStepData({ title: '', description: '', photo_url: '' });
  };

  const handleRemoveStep = (index) => {
    setFormData({
      ...formData,
      steps: formData.steps.filter((_, i) => i !== index)
    });
    if (editingIndex === index) setEditingIndex(null);
  };

  const handleMoveStep = (index, direction) => {
    const updatedSteps = [...formData.steps];
    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < updatedSteps.length) {
      const temp = updatedSteps[index];
      updatedSteps[index] = updatedSteps[newIndex];
      updatedSteps[newIndex] = temp;
      setFormData({ ...formData, steps: updatedSteps });
      if (editingIndex === index) setEditingIndex(newIndex);
      else if (editingIndex === newIndex) setEditingIndex(index);
    }
  };

  const startEditing = (index) => {
    setEditingIndex(index);
    setEditStepData({
      title: formData.steps[index].title,
      description: formData.steps[index].description || '',
      photo_url: formData.steps[index].photo_url || ''
    });
  };

  const saveStepEdit = (index) => {
    const updatedSteps = [...formData.steps];
    updatedSteps[index] = {
      ...updatedSteps[index],
      title: editStepData.title,
      description: editStepData.description,
      photo_url: editStepData.photo_url
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
              <React.Fragment key={idx}>
                <div className={styles.insertStepDivider}>
                  <button 
                    type="button" 
                    onClick={() => handleInsertStep(idx)}
                    className={styles.insertStepBtn}
                    title="Inserir passo antes deste"
                  >
                    <FiPlus /> Inserir passo
                  </button>
                </div>
                
                <div className={`${styles.stepItem} ${editingIndex === idx ? styles.editing : ''}`}>
                  {editingIndex === idx ? (
                  <div className={styles.stepEditForm} style={{ flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
                    <input
                      type="text"
                      value={editStepData.title}
                      onChange={(e) => setEditStepData({ ...editStepData, title: e.target.value })}
                      placeholder="Título do passo"
                      className={styles.editInput}
                      style={{ width: '100%', marginBottom: '0.5rem' }}
                    />
                    <input
                      type="text"
                      value={editStepData.description}
                      onChange={(e) => setEditStepData({ ...editStepData, description: e.target.value })}
                      placeholder="Descrição (opcional)"
                      className={styles.editInput}
                      style={{ width: '100%', marginBottom: '0.5rem' }}
                    />
                    
                    <div className={styles.stepPhotoSection} style={{ marginBottom: '1rem' }}>
                      <label htmlFor={`edit-photo-${idx}`} className={styles.photoBtn}>
                        <FiCamera /> {editStepData.photo_url ? '📸 Alterar Foto' : '➕ Foto de Instrução'}
                      </label>
                      <input
                        type="file"
                        id={`edit-photo-${idx}`}
                        accept="image/*"
                        className={styles.photoInput}
                        onChange={(e) => handleStepPhotoUpload(e.target.files[0], true)}
                      />
                      {editStepData.photo_url && (
                        <div className={styles.photoPreview}>
                          <img src={getFullUrl(editStepData.photo_url)} alt="Preview" />
                        </div>
                      )}
                    </div>

                    <div className={styles.editActions}>
                      <button
                        type="button"
                        onClick={() => saveStepEdit(idx)}
                        className="btn btn-primary btn-small"
                        title="Salvar Passo"
                        disabled={uploading}
                      >
                        <FiCheck /> Salvar Passo
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingIndex(null)}
                        className="btn btn-outline btn-small"
                        title="Cancelar"
                      >
                        <FiX /> Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={styles.stepInfo}>
                      <h4>{idx + 1}. {step.title}</h4>
                      {step.description && <p>{step.description}</p>}
                      {step.photo_url && (
                        <img 
                          src={getFullUrl(step.photo_url)} 
                          alt="Thumbnail" 
                          className={styles.stepThumb} 
                        />
                      )}
                    </div>
                    <div className={styles.stepActions}>
                      <button
                        type="button"
                        onClick={() => handleMoveStep(idx, -1)}
                        className="btn btn-outline btn-small"
                        title="Mover para Cima"
                        disabled={idx === 0}
                      >
                        <FiArrowUp />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveStep(idx, 1)}
                        className="btn btn-outline btn-small"
                        title="Mover para Baixo"
                        disabled={idx === formData.steps.length - 1}
                      >
                        <FiArrowDown />
                      </button>
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
            </React.Fragment>
          ))}

          {formData.steps.length > 0 && (
            <div className={styles.insertStepDivider}>
              <button 
                type="button" 
                onClick={() => handleInsertStep(formData.steps.length)}
                className={styles.insertStepBtn}
                title="Inserir passo ao final"
              >
                <FiPlus /> Inserir passo
              </button>
            </div>
          )}
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

            <div className={styles.stepPhotoSection}>
              <label htmlFor="new-step-photo" className={styles.photoBtn}>
                <FiCamera /> {newStep.photo_url ? '📸 Alterar Foto' : '➕ Foto de Instrução'}
              </label>
              <input
                type="file"
                id="new-step-photo"
                accept="image/*"
                className={styles.photoInput}
                onChange={(e) => handleStepPhotoUpload(e.target.files[0], false)}
              />
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
              disabled={!newStep.title || uploading}
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
