import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { executionAPI } from '../api/index';
import {
  ClipboardList, Clock, CheckCircle2, PauseCircle,
  Play, Check, ChevronRight
} from 'lucide-react';
import styles from './MyExecutions.module.css';

const STATUS_META = {
  in_progress: { label: 'Em Progresso', Icon: Clock },
  completed: { label: 'Completo', Icon: CheckCircle2 },
  abandoned: { label: 'Abandonado', Icon: PauseCircle },
};

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

  const statCards = [
    { key: 'total', label: 'Total de Execuções', value: stats.total, Icon: ClipboardList },
    { key: 'in_progress', label: 'Em Progresso', value: stats.inProgress, Icon: Clock },
    { key: 'completed', label: 'Completadas', value: stats.completed, Icon: CheckCircle2 },
    { key: 'abandoned', label: 'Abandonadas', value: stats.abandoned, Icon: PauseCircle },
  ];

  const filterItems = [
    { key: 'all', label: 'Todas', count: stats.total, Icon: ClipboardList },
    { key: 'in_progress', label: 'Em Progresso', count: stats.inProgress, Icon: Clock },
    { key: 'completed', label: 'Completadas', count: stats.completed, Icon: CheckCircle2 },
    { key: 'abandoned', label: 'Abandonadas', count: stats.abandoned, Icon: PauseCircle },
  ];

  const getStatusMeta = (status) =>
    STATUS_META[status] || { label: 'Desconhecido', Icon: ClipboardList };

  const getStatusLabel = (status) => getStatusMeta(status).label;

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
      <div className={styles.sectionLabel}>Resumo</div>
      <div className={styles.statsGrid}>
        {statCards.map(({ key, label, value, Icon }) => (
          <div key={key} className={styles.statCard}>
            <span className={styles.statIcon}>
              <Icon size={20} strokeWidth={2} />
            </span>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{value}</div>
              <div className={styles.statLabel}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className={styles.sectionLabel}>Filtrar por status</div>
      <div className={styles.filters}>
        {filterItems.map(({ key, label, count, Icon }) => {
          const isActive = filter === key;
          return (
            <button
              key={key}
              type="button"
              className={`${styles.filterBtn} ${isActive ? styles.active : ''}`}
              onClick={() => setFilter(key)}
            >
              <span className={styles.filterIcon}>
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              </span>
              <span className={styles.filterLabel}>{label}</span>
              <span className={styles.filterCount}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Executions List */}
      <div className={styles.sectionLabel}>Execuções</div>
      {filteredExecutions.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>
            <ClipboardList size={20} strokeWidth={2} />
          </span>
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
          {filteredExecutions.map((execution) => {
            const { label: statusLabel, Icon: StatusIcon } = getStatusMeta(execution.status);
            const isDone = execution.status === 'completed';
            return (
              <div key={execution.id} className={styles.executionCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.title}>
                    <span className={`${styles.statusIcon} ${isDone ? styles.statusIconDone : ''}`}>
                      <StatusIcon size={18} strokeWidth={isDone ? 2.5 : 2} />
                    </span>
                    <div className={styles.titleContent}>
                      <h3>{execution.title}</h3>
                      <span className={`${styles.statusBadge} ${isDone ? styles.statusBadgeDone : ''}`}>
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                  <div className={styles.actions}>
                    {execution.status === 'in_progress' && (
                      <Link
                        to={`/execucoes/${execution.id}`}
                        className="btn btn-primary btn-small"
                      >
                        <Play size={16} strokeWidth={2} /> Continuar
                        <ChevronRight size={14} strokeWidth={2} className={styles.actionArrow} />
                      </Link>
                    )}
                    {execution.status === 'completed' && (
                      <Link
                        to={`/execucoes/${execution.id}`}
                        className="btn btn-outline btn-small"
                      >
                        <CheckCircle2 size={16} strokeWidth={2} /> Visualizar
                        <ChevronRight size={14} strokeWidth={2} className={styles.actionArrow} />
                      </Link>
                    )}
                  </div>
                </div>

                {execution.description && (
                  <p className={styles.description}>{execution.description}</p>
                )}

                <div className={styles.metadata}>
                  <span className={styles.date}>
                    <Clock size={14} strokeWidth={2} />
                    Iniciado em {new Date(execution.started_at).toLocaleString('pt-BR')}
                  </span>
                  {execution.completed_at && (
                    <span className={styles.date}>
                      <Check size={14} strokeWidth={2} />
                      Finalizado em {new Date(execution.completed_at).toLocaleString('pt-BR')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyExecutions;
