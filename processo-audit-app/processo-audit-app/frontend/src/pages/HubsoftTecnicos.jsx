import React, { useState, useEffect } from 'react';
import { hubsoftAPI } from '../api/index';
import { FiRefreshCw, FiSearch } from 'react-icons/fi';
import styles from './HubsoftTecnicos.module.css';

const HubsoftTecnicos = () => {
  const [tecnicos, setTecnicos] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await hubsoftAPI.listTecnicos();
      const list = data.tecnicos ?? [];
      setTecnicos(list);
      setTotal(data.total ?? list.length);
      if (list.length > 0) {
        setColumns(Object.keys(list[0]));
      }
    } catch (err) {
      setError('Erro ao carregar técnicos do HubSoft: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = tecnicos.filter(t =>
    columns.some(col =>
      String(t[col] ?? '').toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Técnicos HubSoft</h1>
          <p className={styles.subtitle}>{total} técnico{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</p>
        </div>
        <button className={styles.refreshBtn} onClick={load} disabled={loading}>
          <FiRefreshCw className={loading ? styles.spinning : ''} />
          Atualizar
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.filters}>
        <div className={styles.searchWrap}>
          <FiSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Buscar em qualquer campo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingWrap}>
          <div className="spinner" />
          <p>Buscando técnicos no HubSoft...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>Nenhum técnico encontrado.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr key={t.id ?? i}>
                  {columns.map(col => (
                    <td key={col}>
                      {t[col] === null || t[col] === undefined
                        ? <span className={styles.null}>—</span>
                        : typeof t[col] === 'object'
                          ? <pre className={styles.json}>{JSON.stringify(t[col], null, 2)}</pre>
                          : String(t[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default HubsoftTecnicos;
