import React, { useState, useEffect } from 'react';
import { hubsoftAPI } from '../api/index';
import styles from './HubsoftUsers.module.css';
import { FiRefreshCw, FiSearch, FiUser } from 'react-icons/fi';

const HubsoftUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await hubsoftAPI.listUsers();
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      setError('Erro ao carregar usuários do HubSoft.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Usuários do HubSoft</h1>
          <p>{total} operador{total !== 1 ? 'es' : ''} encontrado{total !== 1 ? 's' : ''}</p>
        </div>
        <button className={styles.refreshBtn} onClick={loadUsers} disabled={loading}>
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
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingWrap}>
          <div className="spinner" />
          <p>Buscando operadores nos atendimentos do HubSoft...</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.length === 0 ? (
            <div className={styles.empty}>Nenhum usuário encontrado.</div>
          ) : filtered.map(u => (
            <div key={u.id} className={styles.card}>
              <div className={styles.avatar}>
                <FiUser size={22} />
              </div>
              <div className={styles.info}>
                <span className={styles.name}>{u.name}</span>
                <span className={styles.email}>{u.email}</span>
              </div>
              <span className={styles.idBadge}>#{u.id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HubsoftUsers;
