import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { processAPI } from '../api/index';
import { useAuth } from '../context/AuthContext';
import { FiArrowLeft, FiEdit2, FiTrash2, FiPlay, FiImage } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './ProcessDetail.module.css';

const ProcessDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [process, setProcess] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('steps'); // steps, audit
  const [expandedStep, setExpandedStep] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [proc, logs] = await Promise.all([
        processAPI.get(id),
        processAPI.getAudit(id).catch(() => []) // Fallback se não tiver permissão
      ]);
      setProcess(proc);
      setAuditLogs(logs);
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

  const handleDelete = async () => {
    if (window.confirm('Tem certeza que deseja deletar este processo?')) {
      try {
        await processAPI.delete(id);
        navigate('/processos');
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleExecute = async () => {
    navigate(`/execucoes/novo/${id}`);
  };

  const getFullUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http') || url.startsWith('blob:')) return url;
    return url;
  };

  const formatStatus = (status) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'draft': return 'Rascunho';
      case 'archived': return 'Arquivado';
      default: return status;
    }
  };

  const JsonHighlighter = ({ json }) => {
    const jsonString = JSON.stringify(json, null, 2);
    
    // Regex for basic syntax highlighting
    const parts = jsonString.split(/("(?:\\.|[^"])*")|(\b\d+\b)|(\btrue\b|\bfalse\b)|(\bnull\b)/g);

    return (
      <pre className={styles.rawJson}>
        {parts.map((part, index) => {
          if (!part) return null;
          
          if (part.startsWith('"')) {
            // Check if it's a key (ends with :)
            const isKey = jsonString[jsonString.indexOf(part) + part.length] === ':';
            return (
              <span key={index} className={isKey ? styles.jsonKey : styles.jsonString}>
                {part}
              </span>
            );
          }
          
          if (/^\d+$/.test(part)) {
            return <span key={index} className={styles.jsonNumber}>{part}</span>;
          }
          
          if (part === 'true' || part === 'false') {
            return <span key={index} className={styles.jsonBoolean}>{part}</span>;
          }
          
          if (part === 'null') {
            return <span key={index} className={styles.jsonNull}>{part}</span>;
          }
          
          return part;
        })}
      </pre>
    );
  };

  const DataViewer = ({ data }) => {
    const [showTechnical, setShowTechnical] = useState(false);
    if (!data) return null;
    let parsedData;
    try {
      parsedData = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
      return <JsonHighlighter json={{ raw: data }} />;
    }

    const labels = {
      title: 'Título',
      description: 'Descrição',
      status: 'Status',
      version: 'Versão',
      department_id: 'ID Departamento',
      department_name: 'Departamento',
      created_by: 'Criado por (ID)',
      created_by_name: 'Proprietário',
      created_at: 'Criado em',
      updated_at: 'Atualizado em',
      steps: 'Passos'
    };

    const formatValue = (key, value) => {
      if (value === null || value === undefined) return 'N/A';
      if (key === 'status') {
        const statuses = {
          'active': '✅ Ativo',
          'draft': '📝 Rascunho',
          'archived': '📦 Arquivado'
        };
        return statuses[value] || value.charAt(0).toUpperCase() + value.slice(1);
      }
      if (key === 'created_at' || key === 'updated_at' || key === 'timestamp') {
        return new Date(value).toLocaleString('pt-BR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      if (Array.isArray(value)) {
        return `${value.length} passo(s)`;
      }
      if (typeof value === 'object') {
        return 'Objeto de dados';
      }
      return String(value);
    };

    const technicalFields = ['id', 'department_id', 'created_by', 'updated_at', 'created_at', 'version', 'updated_by'];
    const displayFields = Object.entries(parsedData).filter(([key]) => !technicalFields.includes(key));

    return (
      <div className={styles.dataViewer}>
        <div className={styles.dataGrid}>
          {displayFields.length > 0 ? (
            displayFields.map(([key, value]) => (
              <div key={key} className={styles.dataItem}>
                <span className={styles.dataKey}>{labels[key] || key}:</span>
                <span className={styles.dataValue}>{formatValue(key, value)}</span>
              </div>
            ))
          ) : (
            <p className={styles.empty}>Nenhum dado legível disponível.</p>
          )}
        </div>
        
        <div className={styles.technicalDetails}>
          <button 
            type="button"
            className={styles.technicalBtn}
            onClick={(e) => {
              e.stopPropagation();
              setShowTechnical(!showTechnical);
            }}
          >
            {showTechnical ? 'Hide technical details' : 'View technical details (JSON)'}
          </button>
          
          {showTechnical && (
            <JsonHighlighter json={parsedData} />
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className="spinner" />
        <p>Carregando detalhes...</p>
      </div>
    );
  }

  if (!process) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Processo não encontrado</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button onClick={() => navigate('/processos')} className={styles.backBtn}>
          <FiArrowLeft /> Voltar
        </button>
        <div className={styles.titleSection}>
          <h1>{process.title}</h1>
          <span className={`badge badge-${process.status}`}>
            {process.status === 'active' ? '✅ Ativo' : 
             process.status === 'draft' ? '📝 Rascunho' : 
             '📦 Arquivado'}
          </span>
        </div>
        <div className={styles.actions}>
          {process.status === 'active' && (
            <button 
              onClick={handleExecute}
              className="btn btn-primary"
              title="Executar como checklist"
            >
              <FiPlay /> Executar
            </button>
          )}
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <>
              <Link
                to={`/processos/${process.id}/edit`}
                className="btn btn-outline"
                title="Editar"
              >
                <FiEdit2 /> Editar
              </Link>
              {user?.role === 'admin' && (
                <button
                  onClick={handleDelete}
                  className="btn btn-danger"
                  title="Deletar"
                >
                  <FiTrash2 /> Deletar
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {error && <div className={styles.alert}>{error}</div>}

      {/* Informações Básicas */}
      <div className={styles.card}>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <label>Descrição</label>
            <p>{process.description || 'Sem descrição'}</p>
          </div>
          <div className={styles.infoItem}>
            <label>Departamento</label>
            <p>🏢 {process.department_name}</p>
          </div>
          <div className={styles.infoItem}>
            <label>Versão</label>
            <p>{process.version}</p>
          </div>
          <div className={styles.infoItem}>
            <label>Criado por</label>
            <p>{process.created_by_name}</p>
          </div>
          <div className={styles.infoItem}>
            <label>Criado em</label>
            <p>{new Date(process.created_at).toLocaleString('pt-BR')}</p>
          </div>
          <div className={styles.infoItem}>
            <label>Última atualização</label>
            <p>{new Date(process.updated_at).toLocaleString('pt-BR')}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'steps' ? styles.active : ''}`}
          onClick={() => setActiveTab('steps')}
        >
          📋 Passos ({process.steps?.length || 0})
        </button>
        {(user?.role === 'admin' || user?.role === 'manager') && (
          <button
            className={`${styles.tab} ${activeTab === 'audit' ? styles.active : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            📊 Auditoria ({auditLogs.length})
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {activeTab === 'steps' && (
          <div className={styles.stepsSection}>
            {process.steps && process.steps.length > 0 ? (
              <div className={styles.stepsList}>
                {process.steps.map((step, idx) => (
                  <div key={step.id} className={styles.stepCard}>
                    <div
                      className={styles.stepHeader}
                      onClick={() => 
                        setExpandedStep(expandedStep === step.id ? null : step.id)
                      }
                    >
                      <div className={styles.stepNumber}>{idx + 1}</div>
                      <div className={styles.stepTitle}>
                        <h3>{step.title}</h3>
                        {step.description && (
                          <p className={styles.stepDesc}>{step.description}</p>
                        )}
                      </div>
                      <div className={styles.expandIcon}>
                        {expandedStep === step.id ? '▼' : '▶'}
                      </div>
                    </div>

                    {(expandedStep === step.id && (step.documentation_markdown || step.photo_url)) && (
                      <div className={styles.stepContent}>
                        {step.documentation_markdown && (
                          <div className={styles.markdown}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {step.documentation_markdown}
                            </ReactMarkdown>
                          </div>
                        )}
                        {step.photo_url && (
                          <div className={styles.photoContainer}>
                            <img 
                              src={getFullUrl(step.photo_url)} 
                              alt="Instrução visual" 
                              className={styles.instructionPhoto}
                              onClick={() => openImage(step.photo_url)}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <p>Nenhum passo definido para este processo</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'audit' && (
          <div className={styles.auditSection}>
            {auditLogs.length > 0 ? (
              <div className={styles.auditLog}>
                {auditLogs.map((log, idx) => (
                  <div key={log.id} className={styles.auditEntry}>
                    <div className={styles.auditHeader}>
                      <span className={styles.action}>
                        {log.action === 'CREATE' && '➕ Criado'}
                        {log.action === 'UPDATE' && '✏️ Atualizado'}
                        {log.action === 'DELETE' && '🗑️ Deletado'}
                      </span>
                      <span className={styles.user}>{log.user_name}</span>
                      <span className={styles.time}>
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </span>
                    </div>

                    <div className={styles.auditDetails}>
                      {log.ip_address && (
                        <p><strong>IP:</strong> {log.ip_address}</p>
                      )}
                      
                      {log.old_data && (
                        <details className={styles.details}>
                          <summary>📋 Antes</summary>
                          <div className={styles.auditContent}>
                            <DataViewer data={log.old_data} />
                          </div>
                        </details>
                      )}

                      {log.new_data && (
                        <details className={styles.details}>
                          <summary>📋 Depois</summary>
                          <div className={styles.auditContent}>
                            <DataViewer data={log.new_data} />
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <p>Nenhum registro de auditoria disponível</p>
              </div>
            )}
          </div>
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

export default ProcessDetail;
