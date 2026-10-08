import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { estoqueItems } from '../components/menuItems';
import styles from './EstoqueHub.module.css';

/* /estoque: atalhos para tudo que é de estoque (OS fica no próprio menu "OS"). */
const EstoqueHub = () => {
  const { user } = useAuth();
  const items = estoqueItems.filter((i) => i.roles.includes(user?.role));
  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Estoque</h1>
      <div className={styles.grid}>
        {items.map(({ label, path, Icon, labelByRole }) => (
          <Link key={path} to={path} className={styles.tile}>
            <Icon size={36} />
            <span>{labelByRole?.[user?.role] || label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};
export default EstoqueHub;
