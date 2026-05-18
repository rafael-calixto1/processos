import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { processAPI } from '../api/index';
import { useAuth } from '../context/AuthContext';
import { FiArrowLeft, FiEdit2, FiTrash2, FiPlay, FiImage, FiFileText } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './ProcessDetail.module.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

  const getBase64ImageFromURL = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.setAttribute('crossOrigin', 'anonymous');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL('image/jpeg');
        resolve({
          dataURL,
          width: img.width,
          height: img.height
        });
      };
      img.onerror = (error) => {
        reject(error);
      };
      img.src = url;
    });
  };

  const handleExportPDF = async () => {
    if (!process) return;

    try {
      setLoading(true);
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(20);
      doc.setTextColor(11, 165, 43); // Primary color
      doc.text(process.title, 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Departamento: ${process.department_name} | Versão: ${process.version}`, 14, 30);
      doc.text(`Criado por: ${process.created_by_name} em ${new Date(process.created_at).toLocaleDateString()}`, 14, 35);
      
      // Description
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text('Descrição:', 14, 45);
      doc.setFontSize(10);
      const descLines = doc.splitTextToSize(process.description || 'Sem descrição', 180);
      doc.text(descLines, 14, 52);
      
      let currentY = 52 + (descLines.length * 5) + 10;

      // Steps Table
      doc.setFontSize(14);
      doc.setTextColor(11, 165, 43);
      doc.text('Passos do Processo', 14, currentY);
      
      const tableColumn = ["#", "Título", "Procedimento / Instruções"];
      const tableRows = [];
      const rowStepMap = new Map();

      // Pre-load all images
      const stepsWithImages = await Promise.all(process.steps?.map(async (step) => {
        let imageData = null;
        if (step.photo_url) {
          try {
            imageData = await getBase64ImageFromURL(getFullUrl(step.photo_url));
          } catch (e) {
            console.error('Erro ao carregar imagem para o PDF:', e);
          }
        }
        return { ...step, imageData };
      }) || []);

      stepsWithImages.forEach((step, index) => {
        // Text row
        tableRows.push([
          index + 1,
          step.title,
          step.description || '-'
        ]);

        // Image row if exists
        if (step.imageData) {
          // Calculate aspect ratio
          const maxWidth = 140;
          const maxHeight = 80;
          let imgWidth = step.imageData.width;
          let imgHeight = step.imageData.height;
          
          const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
          imgWidth *= ratio;
          imgHeight *= ratio;

          rowStepMap.set(tableRows.length, { base64: step.imageData.dataURL, width: imgWidth, height: imgHeight });
          tableRows.push([
            '',
            { 
              content: '', 
              colSpan: 2, 
              styles: { minCellHeight: imgHeight + 10, halign: 'center' } 
            }
          ]);
        }
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: currentY + 5,
        theme: 'striped',
        headStyles: { fillColor: [11, 165, 43] },
        styles: { fontSize: 10, cellPadding: 5 },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 50 },
          2: { cellWidth: 'auto' }
        },
        rowPageBreak: 'avoid',
        didDrawCell: (data) => {
          if (data.section === 'body' && rowStepMap.has(data.row.index) && data.column.index === 1) {
            const imgInfo = rowStepMap.get(data.row.index);
            // Center the image in the spanned cell
            const x = data.cell.x + (data.cell.width - imgInfo.width) / 2;
            const y = data.cell.y + 5;
            doc.addImage(imgInfo.base64, 'JPEG', x, y, imgInfo.width, imgInfo.height);
          }
        }
      });

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${pageCount} - Gerado em ${new Date().toLocaleString()}`, 14, doc.internal.pageSize.height - 10);
      }

      doc.save(`processo_${process.id}_${new Date().getTime()}.pdf`);
    } catch (err) {
      setError('Erro ao exportar PDF: ' + err.message);
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
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <button 
              onClick={handleExportPDF}
              className="btn btn-secondary"
              title="Exportar como PDF"
            >
              <FiFileText /> PDF
            </button>
          )}
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
