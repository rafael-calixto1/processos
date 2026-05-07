import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { processAPI, departmentAPI } from '../api/index';
import { useBranding } from '../context/BrandingContext';
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

  return (
    <div className={styles.dashboard}>
      <h1>Dashboard</h1>
      <p className={styles.subtitle}>
        Bem-vindo ao {branding?.company_name || 'Processo Audit'}
      </p>

      {error && <div className={styles.alert}>{error}</div>}

      {/* Cards de Estatísticas */}
      <div className={styles.statsGrid}>
        <div 
          className={styles.statCard}
          style={{ borderLeftColor: branding?.primary_color || '#0ba52b' }}
        >
          <div className={styles.statIcon}>📊</div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{processes.length}</div>
            <div className={styles.statLabel}>Total de Processos</div>
          </div>
        </div>

        <div 
          className={styles.statCard}
          style={{ borderLeftColor: branding?.secondary_color || '#bbf804' }}
        >
          <div className={styles.statIcon}>✅</div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{activeProcesses}</div>
            <div className={styles.statLabel}>Processos Ativos</div>
          </div>
        </div>

        <div 
          className={styles.statCard}
          style={{ borderLeftColor: branding?.accent_color || '#274518' }}
        >
          <div className={styles.statIcon}>📋</div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{draftProcesses}</div>
            <div className={styles.statLabel}>Rascunhos</div>
          </div>
        </div>

        <div 
          className={styles.statCard}
          style={{ borderLeftColor: '#2196f3' }}
        >
          <div className={styles.statIcon}>🏢</div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{departments.length}</div>
            <div className={styles.statLabel}>Departamentos</div>
          </div>
        </div>
      </div>

      {/* Processos Recentes */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Processos Recentes</h2>
          <Link to="/processos" className={styles.viewMore}>
            Ver todos →
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
                    <Link to={`/processos/${process.id}`}>
                      {process.title}
                    </Link>
                  </h3>
                  <span className={`badge badge-${process.status}`}>
                    {process.status === 'active' ? '✅ Ativo' : 
                     process.status === 'draft' ? '📝 Rascunho' : 
                     '📦 Arquivado'}
                  </span>
                </div>
                <p className={styles.processDesc}>{process.description}</p>
                <div className={styles.processFooter}>
                  <span className={styles.department}>
                    🏢 {process.department_name}
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
        <h2>Departamentos</h2>
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
