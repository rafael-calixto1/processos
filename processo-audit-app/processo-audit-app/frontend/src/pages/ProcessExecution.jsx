import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { executionAPI, processAPI } from '../api/index';
import { FiArrowLeft, FiCheckCircle, FiCamera, FiImage } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './ProcessExecution.module.css';

const ProcessExecution = () => {
  const { processId, executionId } = useParams();
  const navigate = useNavigate();
  const [execution, setExecution] = useState(null);
  const [process, setProcess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expandedStep, setExpandedStep] = useState(null);
  const [stepNotes, setStepNotes] = useState({});
  const [stepPhotos, setStepPhotos] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    loadData();
  }, [executionId]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (executionId) {
        // Carregando execução existente
        const exec = await executionAPI.get(executionId);
        setExecution(exec);
        setProcess({
          title: exec.title,
          description: exec.description
        });
      } else if (processId) {
        // Iniciando nova execução
        const result = await executionAPI.start(processId);
        // Redirecionar para a URL com o ID da execução para evitar loops
        navigate(`/execucoes/${result.execution_id}`, { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openImage = (url) => {
    setSelectedImage(getFullUrl(url));
  };

  const closeImage = () => {
    setSelectedImage(null);
  };

  const handleCompleteStep = async (stepExecutionId) => {
    try {
      setSaving(true);
      const notes = stepNotes[stepExecutionId] || '';
      const photo = stepPhotos[stepExecutionId];

      const formData = new FormData();
      formData.append('notes', notes);
      if (photo) {
        formData.append('photo', photo);
      }

      await executionAPI.completeStep(stepExecutionId, formData);
      
      // Atualizar dados
      await loadData();
      // Limpar estado do passo que foi completado
      setStepNotes(prev => {
        const newNotes = { ...prev };
        delete newNotes[stepExecutionId];
        return newNotes;
      });
      setStepPhotos(prev => {
        const newPhotos = { ...prev };
        delete newPhotos[stepExecutionId];
        return newPhotos;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = (stepExecutionId, file) => {
    if (file) {
      setStepPhotos({
        ...stepPhotos,
        [stepExecutionId]: file
      });
    }
  };

  const getFullUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http') || url.startsWith('blob:')) return url;
    return url;
  };

  const groupStepsBySection = (steps) => {
    if (!steps) return [];
    const groups = [];
    let currentGroup = { section: null, steps: [] };

    steps.forEach((step) => {
      if (step.section !== currentGroup.section) {
        if (currentGroup.steps.length > 0 || currentGroup.section !== null) {
          groups.push(currentGroup);
        }
        currentGroup = { section: step.section, steps: [step] };
      } else {
        currentGroup.steps.push(step);
      }
    });

    if (currentGroup.steps.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  };

  const handleFinalize = async () => {
    if (window.confirm('Tem certeza que deseja finalizar este processo? Todos os passos devem estar completos.')) {
      try {
        setSaving(true);
        await executionAPI.complete(execution.id);
        navigate('/execucoes');
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleCancel = async () => {
    if (window.confirm('Deseja cancelar a execução deste processo?')) {
      try {
        setSaving(true);
        await executionAPI.cancel(execution.id);
        navigate('/execucoes');
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className="spinner" />
        <p>Carregando execução...</p>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Execução não encontrada</div>
      </div>
    );
  }

  const completedSteps = execution.steps?.filter(s => s.completed_at).length || 0;
  const totalSteps = execution.steps?.length || 0;
  const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button onClick={() => navigate('/execucoes')} className={styles.backBtn}>
          <FiArrowLeft /> Voltar
        </button>
        <div className={styles.title}>
          <h1>{process?.title}</h1>
          <span className={`badge badge-${execution.status}`}>
            {execution.status === 'in_progress' ? '⏱️ Em Progresso' :
             execution.status === 'completed' ? '✅ Completo' :
             '⏸️ Abandonado'}
          </span>
        </div>
      </div>

      {error && <div className={styles.alert}>{error}</div>}

      {/* Progress Bar */}
      <div className={styles.progressCard}>
        <div className={styles.progressHeader}>
          <h3>Progresso</h3>
          <span className={styles.counter}>
            {completedSteps} de {totalSteps} passos completos
          </span>
        </div>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <p className={styles.progressPercent}>{Math.round(progressPercentage)}%</p>
      </div>

      {/* Description */}
      {process?.description && (
        <div className={styles.description}>
          <p>{process.description}</p>
        </div>
      )}

      {/* Checklist */}
      <div className={styles.checklistContainer}>
        {execution.steps && execution.steps.length > 0 ? (
          <div className={styles.stepsList}>
            {groupStepsBySection(execution.steps).map((group, gIdx) => (
              <div key={gIdx} className={styles.sectionGroup}>
                {group.section && (
                  <div className={styles.sectionHeader}>
                    <h3>{group.section}</h3>
                  </div>
                )}
                {group.steps.map((stepExec) => {
                  const isCompleted = !!stepExec.completed_at;
                  // Encontrar o índice global para a numeração
                  const globalIdx = execution.steps.findIndex(s => s.id === stepExec.id);
                  return (
                    <div
                      key={stepExec.id}
                      className={`${styles.stepItem} ${isCompleted ? styles.completed : ''}`}
                    >
                      {/* Step Header */}
                      <div
                        className={styles.stepHeader}
                        onClick={() =>
                          setExpandedStep(expandedStep === stepExec.id ? null : stepExec.id)
                        }
                      >
                        <div className={styles.stepNumber}>
                          {isCompleted ? (
                            <FiCheckCircle size={24} color="var(--success)" />
                          ) : (
                            <div className={styles.number}>{globalIdx + 1}</div>
                          )}
                        </div>

                        <div className={styles.stepInfo}>
                          <h3 className={isCompleted ? styles.completedText : ''}>
                            {stepExec.title}
                          </h3>
                          {stepExec.description && (
                            <p className={styles.stepDesc}>{stepExec.description}</p>
                          )}
                          {isCompleted && stepExec.completed_at && (
                            <p className={styles.completedInfo}>
                              ✓ Completo em {new Date(stepExec.completed_at).toLocaleString('pt-BR')}
                            </p>
                          )}
                        </div>

                        <div className={styles.expandIcon}>
                          {expandedStep === stepExec.id ? '▼' : '▶'}
                        </div>
                      </div>

                      {/* Step Content */}
                      {expandedStep === stepExec.id && (
                        <div className={styles.stepContent}>
                          {/* Documentation */}
                          {(stepExec.documentation_markdown || stepExec.photo_url) && (
                            <div className={styles.documentation}>
                              <h4>Instruções</h4>
                              {stepExec.documentation_markdown && (
                                <div className={styles.markdown}>
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {stepExec.documentation_markdown}
                                  </ReactMarkdown>
                                </div>
                              )}
                              {stepExec.photo_url && (
                                <img 
                                  src={getFullUrl(stepExec.photo_url)} 
                                  alt="Instrução visual" 
                                  className={styles.instructionPhoto}
                                  onClick={() => openImage(stepExec.photo_url)}
                                />
                              )}
                            </div>
                          )}

                          {/* Notes and Photo Upload */}
                          {!isCompleted && (
                            <div className={styles.notesSection}>
                              <label htmlFor={`notes-${stepExec.id}`}>
                                Anotações (opcional)
                              </label>
                              <textarea
                                id={`notes-${stepExec.id}`}
                                value={stepNotes[stepExec.id] || ''}
                                onChange={(e) =>
                                  setStepNotes({
                                    ...stepNotes,
                                    [stepExec.id]: e.target.value
                                  })
                                }
                                placeholder="Adicione anotações sobre este passo..."
                                rows={3}
                              />

                              {/* Photo Upload */}
                              <div className={styles.photoSection}>
                                <label>
                                  <FiCamera /> Evidência Fotográfica
                                </label>
                                
                                <label htmlFor={`photo-${stepExec.id}`} className={styles.photoButton}>
                                  {stepPhotos[stepExec.id] ? '📸 Alterar Foto' : '➕ Adicionar Foto'}
                                </label>
                                
                                <input
                                  type="file"
                                  id={`photo-${stepExec.id}`}
                                  accept="image/*"
                                  className={styles.photoInput}
                                  onChange={(e) => handlePhotoChange(stepExec.id, e.target.files[0])}
                                />
                                
                                {stepPhotos[stepExec.id] && (
                                  <div className={styles.photoPreview}>
                                    <img 
                                      src={URL.createObjectURL(stepPhotos[stepExec.id])} 
                                      alt="Preview" 
                                      onClick={() => openImage(URL.createObjectURL(stepPhotos[stepExec.id]))}
                                      style={{ cursor: 'pointer' }}
                                    />
                                    <p style={{ fontSize: '0.8rem', color: 'var(--success)', marginTop: '0.5rem' }}>
                                      ✓ Foto selecionada: {stepPhotos[stepExec.id].name}
                                    </p>
                                  </div>
                                )}
                              </div>

                              <button
                                onClick={() => handleCompleteStep(stepExec.id)}
                                disabled={saving}
                                className={`btn btn-primary btn-small`}
                              >
                                {saving ? 'Salvando...' : 'Marcar como Completo'}
                              </button>
                            </div>
                          )}

                          {isCompleted && (
                            <>
                              {stepExec.notes && (
                                <div className={styles.notesDisplay}>
                                  <h4>Anotações</h4>
                                  <p>{stepExec.notes}</p>
                                </div>
                              )}
                              
                              {stepExec.photo_url && (
                                <div className={styles.photoDisplay}>
                                  <h4><FiImage /> Evidência</h4>
                                  <img 
                                    src={getFullUrl(stepExec.photo_url)} 
                                    alt="Evidência do passo" 
                                    className={styles.photoImg}
                                    onClick={() => openImage(stepExec.photo_url)}
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <p>Nenhum passo neste processo</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        {execution.status === 'in_progress' && (
          <>
            <button
              onClick={handleFinalize}
              disabled={completedSteps < totalSteps || saving}
              className="btn btn-primary"
              title={completedSteps < totalSteps ? 'Complete todos os passos primeiro' : ''}
            >
              <FiCheckCircle /> Finalizar Execução
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="btn btn-outline"
            >
              Cancelar
            </button>
          </>
        )}

        {execution.status === 'completed' && (
          <button
            onClick={() => navigate('/execucoes')}
            className="btn btn-primary"
          >
            Voltar às Execuções
          </button>
        )}
      </div>

      {/* Info */}
      <div className={styles.info}>
        <p className={styles.infoText}>
          🕐 Iniciado em: {new Date(execution.started_at).toLocaleString('pt-BR')}
        </p>
        {execution.completed_at && (
          <p className={styles.infoText}>
            ✓ Finalizado em: {new Date(execution.completed_at).toLocaleString('pt-BR')}
          </p>
        )}
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div className={styles.modal} onClick={closeImage}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <button className={styles.closeModal} onClick={closeImage}>&times;</button>
            <img src={selectedImage} alt="Expanded" className={styles.modalImage} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessExecution;
