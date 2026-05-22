import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { processAPI, departmentAPI } from '../api/index';
import { useBranding } from '../context/BrandingContext';
import { BarChart3, CheckCircle2, FileEdit, Building2, ArrowRight } from 'lucide-react';
import styles from './Dashboard.module.css';

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

  const stats = [
    {
      value: processes.length,
      label: 'Total de Processos',
      Icon: BarChart3,
      color: branding?.primary_color || '#0ba52b',
      bg: 'rgba(11,165,43,0.1)',
    },
    {
      value: activeProcesses,
      label: 'Processos Ativos',
      Icon: CheckCircle2,
      color: branding?.secondary_color || '#bbf804',
      bg: 'rgba(187,248,4,0.12)',
    },
    {
      value: draftProcesses,
      label: 'Rascunhos',
      Icon: FileEdit,
      color: branding?.accent_color || '#274518',
      bg: 'rgba(39,69,24,0.09)',
    },
    {
      value: departments.length,
      label: 'Departamentos',
      Icon: Building2,
      color: '#2563eb',
      bg: 'rgba(37,99,235,0.1)',
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
            <div className={styles.statIconWrap}>
              <Icon size={22} strokeWidth={2} />
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{value}</div>
              <div className={styles.statLabel}>{label}</div>
            </div>
          </div>
        ))}
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
                <div className={styles.processHeader}>
                  <h3>
                    <Link to={`/processos/${process.id}`}>{process.title}</Link>
                  </h3>
                  <span className={`badge badge-${process.status === 'active' ? 'success' : process.status === 'draft' ? 'warning' : 'accent'}`}>
                    {process.status === 'active' ? 'Ativo' :
                     process.status === 'draft' ? 'Rascunho' : 'Arquivado'}
                  </span>
                </div>
                <p className={styles.processDesc}>{process.description}</p>
                <div className={styles.processFooter}>
                  <span className={styles.department}>
                    <Building2 size={13} />
                    {process.department_name}
                  </span>
                  <span className={styles.steps}>
                    {process.steps?.length || 0} passos
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
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
                <h3>{dept.name}</h3>
                <p>{dept.description}</p>
                <span className={styles.processCount}>
                  {dept.process_count} processos
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
