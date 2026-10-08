import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { estoqueItems } from '../components/menuItems';
import styles from './EstoqueHub.module.css';

// minúsculas e sem acento, para o filtro ignorar "Patrimônio" x "patrimonio"
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/* /estoque: atalhos para tudo que é de estoque (OS fica no próprio menu "OS"). */
const EstoqueHub = () => {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const inputRef = useRef(null);

  const items = useMemo(
    () => estoqueItems
      .filter((i) => i.roles.includes(user?.role))
      .map((i) => ({ ...i, label: i.labelByRole?.[user?.role] || i.label })),
    [user?.role],
  );
  const visible = useMemo(() => {
    const term = norm(q);
    return term ? items.filter((i) => norm(i.label).includes(term)) : items;
  }, [items, q]);

  // "/" foca o filtro
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={styles.wrap}>
      <label className={styles.search}>
        <Search size={18} aria-hidden />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setQ('')}
          placeholder="Filtrar"
          aria-label="Filtrar atalhos do estoque"
          autoFocus
        />
      </label>

      <h1 className={styles.title}>Estoque</h1>

      {visible.length === 0 ? (
        <p className={styles.empty}>Nenhum atalho encontrado para “{q}”.</p>
      ) : (
        <div className={styles.grid}>
          {visible.map(({ label, path, Icon }, i) => (
            <Link key={path} to={path} className={styles.tile} style={{ '--i': i }}>
              <span className={styles.badge}><Icon size={46} strokeWidth={2.5} aria-hidden /></span>
              <span>{label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
export default EstoqueHub;
