import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { processAPI, departmentAPI } from '../api/index';
import { useAuth } from '../context/AuthContext';
import {
  Plus, Pencil, Trash2, Eye, Camera, FileDown, Search, Building2, Layers, X,
  CheckCircle2, FileText, Archive,
} from 'lucide-react';
import styles from './Processes.module.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const STATUS_META = {
  active:   { label: 'Ativo',     Icon: CheckCircle2, variant: 'statusActive'   },
  draft:    { label: 'Rascunho',  Icon: FileText,     variant: 'statusDraft'    },
  archived: { label: 'Arquivado', Icon: Archive,      variant: 'statusArchived' },
};

const Processes = () => {
  const [processes, setProcesses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterDept, setFilterDept] = useState(searchParams.get('departamento') || '');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    department_id: '',
    steps: []
  });
  const [newStep, setNewStep] = useState({ title: '', description: '', section: '', photo_url: '' });
  const { user } = useAuth();

  // Search and Pagination
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProcesses, setTotalProcesses] = useState(0);

  useEffect(() => {
    loadData();
  }, [filterDept, filterStatus, currentPage]);

  // Debounced search effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (currentPage === 1) {
        loadData();
      } else {
        setCurrentPage(1);
      }
    }, 700);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [procsResponse, depts] = await Promise.all([
        processAPI.list(filterDept || null, filterStatus || null, search, currentPage),
        departmentAPI.list()
      ]);
      setProcesses(procsResponse.processes);
      setTotalPages(procsResponse.pages);
      setTotalProcesses(procsResponse.total);
      setDepartments(depts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setLoading(true);
      // Fetch all processes with current filters (large limit)
      const response = await processAPI.list(filterDept || null, filterStatus || null, search, 1, 1000);
      const allProcesses = response.processes;

      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(18);
      doc.text('Relatório de Processos', 14, 22);
      
      doc.setFontSize(11);
      doc.setTextColor(100);
      
      // Add metadata
      const date = new Date().toLocaleString();
      doc.text(`Gerado em: ${date}`, 14, 30);
      doc.text(`Total de processos: ${allProcesses.length}`, 14, 35);
      
      // Filters info
      let filters = [];
      if (search) filters.push(`Busca: "${search}"`);
      if (filterDept) {
        const dept = departments.find(d => d.id === parseInt(filterDept));
        if (dept) filters.push(`Depto: ${dept.name}`);
      }
      if (filterStatus) filters.push(`Status: ${filterStatus}`);
      
      if (filters.length > 0) {
        doc.text(`Filtros: ${filters.join(' | ')}`, 14, 40);
      }
      
      // Define table columns
      const tableColumn = ["ID", "Título", "Departamento", "Status", "Passos"];
      const tableRows = [];

      allProcesses.forEach(process => {
        const processData = [
          process.id,
          process.title,
          process.department_name,
          process.status === 'active' ? 'Ativo' : process.status === 'draft' ? 'Rascunho' : 'Arquivado',
          process.steps?.length || 0
        ];
        tableRows.push(processData);
      });

      // Generate table
      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: filters.length > 0 ? 45 : 40,
        theme: 'striped',
        headStyles: { fillColor: [0, 123, 255] },
        styles: { fontSize: 9 }
      });

      doc.save(`relatorio_processos_${new Date().getTime()}.pdf`);
    } catch (err) {
      setError('Erro ao exportar PDF: ' + err.message);
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
      setNewStep({ title: '', description: '', section: '', photo_url: '' });
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
    return url;
  };

  const handleAddStep = () => {
    if (newStep.title) {
      setFormData({
        ...formData,
        steps: [...formData.steps, { ...newStep, documentation_markdown: '' }]
      });
      setNewStep({ title: '', description: '', section: '', photo_url: '' });
    }
  };

  const handleRemoveStep = (index) => {
    setFormData({
      ...formData,
      steps: formData.steps.filter((_, i) => i !== index)
    });
  };

  const handleDeleteProcess = async (id) => {
    if (window.confirm('Tem certeza que deseja inativar este processo?')) {
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
        <div className={styles.headerActions}>
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <>
              <button
                className={`btn btn-secondary`}
                onClick={handleExportPDF}
                style={{ marginRight: '10px' }}
              >
                <FileDown size={16} /> Exportar PDF
              </button>
              <button
                className={`btn btn-primary`}
                onClick={() => setShowModal(true)}
              >
                <Plus size={16} /> Novo Processo
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className={styles.alert}>{error}</div>}

      {/* Filtros e Busca */}
      <div className={styles.filtersArea}>
        <div className={styles.searchBar}>
          <Search size={16} strokeWidth={2} className={styles.searchIcon} />
          <input
            type="search"
            placeholder="Buscar por título ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.filters}>
          <select
            value={filterDept}
            onChange={(e) => {
              const value = e.target.value;
              setFilterDept(value);
              setCurrentPage(1);
              // mantém a URL compartilhável
              const next = new URLSearchParams(searchParams);
              if (value) next.set('departamento', value); else next.delete('departamento');
              setSearchParams(next, { replace: true });
            }}
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
            onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
          >
            <option value="">Todos os Status</option>
            <option value="draft">Rascunho</option>
            <option value="active">Ativo</option>
            <option value="archived">Arquivado</option>
          </select>
        </div>
      </div>

      <div className={styles.stats}>
        Total: <strong>{totalProcesses}</strong> processos encontrados
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
                {process.description && <p>{process.description}</p>}
                <div className={styles.metadata}>
                  {(() => {
                    const meta = STATUS_META[process.status] ?? STATUS_META.draft;
                    const StatusIcon = meta.Icon;
                    return (
                      <span className={`${styles.statusBadge} ${styles[meta.variant]}`}>
                        <StatusIcon size={12} strokeWidth={2.5} />
                        {meta.label}
                      </span>
                    );
                  })()}
                  <span className={styles.dept}>
                    <Building2 size={12} strokeWidth={2} />
                    {process.department_name}
                  </span>
                  <span className={styles.steps}>
                    <Layers size={12} strokeWidth={2.5} />
                    {process.steps?.length || 0} passos
                  </span>
                </div>
              </div>

              <div className={styles.actions}>
                <Link
                  to={`/processos/${process.id}`}
                  className={styles.iconBtn}
                  title="Visualizar"
                  aria-label={`Visualizar ${process.title}`}
                >
                  <Eye size={16} strokeWidth={2} />
                </Link>
                {(user?.role === 'admin' || user?.role === 'manager') && (
                  <>
                    <Link
                      to={`/processos/${process.id}/edit`}
                      className={styles.iconBtn}
                      title="Editar"
                      aria-label={`Editar ${process.title}`}
                    >
                      <Pencil size={16} strokeWidth={2} />
                    </Link>
                    {user?.role === 'admin' && (
                      <button
                        className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                        onClick={() => handleDeleteProcess(process.id)}
                        title="Inativar"
                        aria-label={`Inativar ${process.title}`}
                      >
                        <Trash2 size={16} strokeWidth={2} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => prev - 1)}
            className={styles.pageBtn}
          >
            Anterior
          </button>
          <span className={styles.pageInfo}>
            Página <strong>{currentPage}</strong> de {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((prev) => prev + 1)}
            className={styles.pageBtn}
          >
            Próxima
          </button>
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
                aria-label="Fechar"
              >
                <X size={18} strokeWidth={2} />
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
                          {step.section && <span className={styles.sectionBadge}>{step.section}</span>}
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
                          <Trash2 size={14} />
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
                  <input
                    type="text"
                    placeholder="Seção (ex: Preparação)"
                    value={newStep.section}
                    onChange={(e) =>
                      setNewStep({ ...newStep, section: e.target.value })
                    }
                  />

                  <div className={styles.stepPhotoSection}>
                    <label htmlFor="step-photo" className={styles.photoBtn}>
                      <Camera size={15} /> {newStep.photo_url ? 'Alterar Foto' : 'Foto de Instrução'}
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
                    <Plus size={15} /> Adicionar Passo
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
