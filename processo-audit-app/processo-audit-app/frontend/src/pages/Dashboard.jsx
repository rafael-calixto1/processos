import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { processAPI, departmentAPI } from '../api/index';
import { useBranding } from '../context/BrandingContext';
import { BarChart3, CheckCircle2, FileEdit, Building2, ArrowRight, Layers } from 'lucide-react';
import styles from './Dashboard.module.css';

const STATUS_LABEL = {
  active:   'Ativo',
  draft:    'Rascunho',
  archived: 'Arquivado',
};

const STATUS_VARIANT = {
  active:   'statusActive',
  draft:    'statusDraft',
  archived: 'statusArchived',
};

const Dashboard = () => {
  const [processes, setProcesses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { branding } = useBranding();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [procsResponse, depts] = await Promise.all([
        processAPI.list(null, null, '', 1, 1000),
        departmentAPI.list()
      ]);
      setProcesses(procsResponse.processes || []);
      setDepartments(depts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const activeProcesses = processes.filter(p => p.status === 'active').length;
  const draftProcesses = processes.filter(p => p.status === 'draft').length;

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className="spinner" />
        <p>Carregando dados...</p>
      </div>
    );
  }

  /*
   * Acentos vindos dos tokens, com a mesma semântica de status usada em
   * Processos (ativo = success, rascunho = warning). O verde da marca segue
   * o branding; os demais são fixos porque a cor secundária (#bbf804) não
   * tem contraste suficiente para texto/ícone sobre fundo claro.
   */
  const stats = [
    {
      value: processes.length,
      label: 'Total de Processos',
      Icon: BarChart3,
      color: branding?.primary_color || 'var(--primary-color)',
      bg: 'var(--primary-light)',
    },
    {
      value: activeProcesses,
      label: 'Processos Ativos',
      Icon: CheckCircle2,
      color: 'var(--success)',
      bg: 'var(--success-light)',
    },
    {
      value: draftProcesses,
      label: 'Rascunhos',
      Icon: FileEdit,
      color: 'var(--warning)',
      bg: 'var(--warning-light)',
    },
    {
      value: departments.length,
      label: 'Departamentos',
      Icon: Building2,
      color: 'var(--accent-color)',
      bg: 'rgba(39, 69, 24, 0.08)',
    },
  ];

  return (
    <div className={styles.dashboard}>
      <div className={styles.pageHeader}>
        <h1>Dashboard</h1>
        <p className={styles.subtitle}>
          Bem-vindo ao {branding?.company_name || 'Processo Audit'}
        </p>
      </div>

      {error && <div className={styles.alert}>{error}</div>}

      <div className={styles.statsGrid}>
        {stats.map(({ value, label, Icon, color, bg }) => (
          <div
            key={label}
            className={styles.statCard}
            style={{ '--stat-color': color, '--stat-bg': bg }}
          >
            <Icon className={styles.statWatermark} strokeWidth={1.5} aria-hidden="true" />
            <div className={styles.statContent}>
              <div className={styles.statValue}>{value}</div>
              <div className={styles.statLabel}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Departamentos */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Departamentos</h2>
        </div>
        {departments.length === 0 ? (
          <p className={styles.emptyText}>Nenhum departamento criado</p>
        ) : (
          <div className={styles.deptGrid}>
            {departments.map((dept) => (
              <div key={dept.id} className={styles.deptCard}>
                <div className={styles.deptCardTop}>
                  <h3>{dept.name}</h3>
                  {dept.description && <p>{dept.description}</p>}
                </div>
                <span className={styles.processCount}>
                  <Layers size={12} strokeWidth={2.5} />
                  {dept.process_count} {dept.process_count === 1 ? 'processo' : 'processos'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Processos Recentes */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Processos Recentes</h2>
          <Link to="/processos" className={styles.viewMore}>
            Ver todos <ArrowRight size={14} />
          </Link>
        </div>

        {processes.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Nenhum processo criado ainda</p>
            <Link to="/processos" className="btn btn-primary">
              Criar Primeiro Processo
            </Link>
          </div>
        ) : (
          <div className={styles.processList}>
            {processes.slice(0, 5).map((process) => (
              <div key={process.id} className={styles.processCard}>
                <h3>
                  <Link to={`/processos/${process.id}`}>{process.title}</Link>
                </h3>
                {process.description && (
                  <p className={styles.processDesc}>{process.description}</p>
                )}
                <div className={styles.badgeRow}>
                  <span className={`${styles.statusBadge} ${styles[STATUS_VARIANT[process.status] ?? 'statusDraft']}`}>
                    {STATUS_LABEL[process.status] ?? 'Rascunho'}
                  </span>
                  <span className={styles.department}>
                    <Building2 size={12} strokeWidth={2} />
                    {process.department_name}
                  </span>
                  <span className={styles.steps}>
                    <Layers size={12} strokeWidth={2.5} />
                    {process.steps?.length || 0} passos
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
