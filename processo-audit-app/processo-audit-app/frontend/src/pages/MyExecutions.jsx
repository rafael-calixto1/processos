import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { executionAPI } from '../api/index';
import { FiPlay, FiCheckCircle, FiClock } from 'react-icons/fi';
import styles from './MyExecutions.module.css';

const MyExecutions = () => {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, in_progress, completed, abandoned

  useEffect(() => {
    loadExecutions();
  }, []);

  const loadExecutions = async () => {
    try {
      setLoading(true);
      const data = await executionAPI.listMine();
      setExecutions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredExecutions = executions.filter(e => 
    filter === 'all' || e.status === filter
  );

  const stats = {
    total: executions.length,
    inProgress: executions.filter(e => e.status === 'in_progress').length,
    completed: executions.filter(e => e.status === 'completed').length,
    abandoned: executions.filter(e => e.status === 'abandoned').length
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'in_progress':
        return '⏱️';
      case 'completed':
        return '✅';
      case 'abandoned':
        return '⏸️';
      default:
        return '📋';
    }
  };

  const getStatusLabel = (status) => {
    switch(status) {
      case 'in_progress':
        return 'Em Progresso';
      case 'completed':
        return 'Completo';
      case 'abandoned':
        return 'Abandonado';
      default:
        return 'Desconhecido';
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className="spinner" />
        <p>Carregando execuções...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1>Minhas Execuções de Processos</h1>
      <p className={styles.subtitle}>Histórico de todos os processos que você executou</p>

      {error && <div className={styles.alert}>{error}</div>}

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📊</div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{stats.total}</div>
            <div className={styles.statLabel}>Total de Execuções</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>⏱️</div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{stats.inProgress}</div>
            <div className={styles.statLabel}>Em Progresso</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>✅</div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{stats.completed}</div>
            <div className={styles.statLabel}>Completadas</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>⏸️</div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{stats.abandoned}</div>
            <div className={styles.statLabel}>Abandonadas</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <button
          className={`${styles.filterBtn} ${filter === 'all' ? styles.active : ''}`}
          onClick={() => setFilter('all')}
        >
          Todas ({stats.total})
        </button>
        <button
          className={`${styles.filterBtn} ${filter === 'in_progress' ? styles.active : ''}`}
          onClick={() => setFilter('in_progress')}
        >
          Em Progresso ({stats.inProgress})
        </button>
        <button
          className={`${styles.filterBtn} ${filter === 'completed' ? styles.active : ''}`}
          onClick={() => setFilter('completed')}
        >
          Completadas ({stats.completed})
        </button>
        <button
          className={`${styles.filterBtn} ${filter === 'abandoned' ? styles.active : ''}`}
          onClick={() => setFilter('abandoned')}
        >
          Abandonadas ({stats.abandoned})
        </button>
      </div>

      {/* Executions List */}
      {filteredExecutions.length === 0 ? (
        <div className={styles.emptyState}>
          <p>
            {filter === 'all'
              ? 'Você ainda não executou nenhum processo'
              : `Nenhuma execução ${getStatusLabel(filter).toLowerCase()}`}
          </p>
          <Link to="/processos" className="btn btn-primary">
            Ver Processos
          </Link>
        </div>
      ) : (
        <div className={styles.executionsList}>
          {filteredExecutions.map((execution) => (
            <div key={execution.id} className={styles.executionCard}>
              <div className={styles.cardHeader}>
                <div className={styles.title}>
                  <span className={styles.statusIcon}>
                    {getStatusIcon(execution.status)}
                  </span>
                  <div className={styles.titleContent}>
                    <h3>{execution.title}</h3>
                    <span className={`badge badge-${execution.status}`}>
                      {getStatusLabel(execution.status)}
                    </span>
                  </div>
                </div>
                <div className={styles.actions}>
                  {execution.status === 'in_progress' && (
                    <Link
                      to={`/execucoes/${execution.id}`}
                      className="btn btn-primary btn-small"
                    >
                      <FiPlay /> Continuar
                    </Link>
                  )}
                  {execution.status === 'completed' && (
                    <Link
                      to={`/execucoes/${execution.id}`}
                      className="btn btn-outline btn-small"
                    >
                      <FiCheckCircle /> Visualizar
                    </Link>
                  )}
                </div>
              </div>

              {execution.description && (
                <p className={styles.description}>{execution.description}</p>
              )}

              <div className={styles.metadata}>
                <span className={styles.date}>
                  🕐 Iniciado em {new Date(execution.started_at).toLocaleString('pt-BR')}
                </span>
                {execution.completed_at && (
                  <span className={styles.date}>
                    ✓ Finalizado em {new Date(execution.completed_at).toLocaleString('pt-BR')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyExecutions;
