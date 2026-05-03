import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { FiMenu, FiX, FiLogOut, FiSettings } from 'react-icons/fi';
import styles from './Layout.module.css';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  const menuItems = [
    { label: 'Dashboard', path: '/dashboard', icon: '📊' },
    { label: 'Processos', path: '/processos', icon: '📋' },
    { label: 'Processos Visuais', path: '/processos-visual', icon: '🎨' },
    { label: 'Departamentos', path: '/departamentos', icon: '🏢' },
    { label: 'Minhas Execuções', path: '/execucoes', icon: '✓' },
  ];

  if (user?.role === 'admin') {
    menuItems.push({ label: 'Branding', path: '/branding', icon: '🎨' });
  }

  return (
    <div className={styles.layout}>
      {/* Header */}
      <header 
        className={styles.header}
        style={{
          backgroundColor: branding?.primary_color || '#0ba52b',
          borderBottom: `4px solid ${branding?.secondary_color || '#bbf804'}`
        }}
      >
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <button
              className={`${styles.menuToggle} ${sidebarOpen ? styles.toggleActive : ''}`}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <FiMenu size={24} className={styles.iconHamburger} />
              <FiX size={24} className={styles.iconClose} />
            </button>
            <Link to="/dashboard" className={styles.logo}>
              {branding?.logo_url ? (
                <img src={branding.logo_url} alt="Logo" className={styles.logoImage} />
              ) : (
                <div className={styles.logoPlaceholder}>
                  {branding?.company_name?.charAt(0).toUpperCase()}
                </div>
              )}
              <span>{branding?.company_name || 'Processo Audit'}</span>
            </Link>
          </div>

          <div className={styles.headerRight}>
            {user && (
              <>
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{user.name}</span>
                  <span className={styles.userRole}>{user.role}</span>
                </div>
                <div className={styles.userMenu}>
                  {user.role === 'admin' && (
                    <Link
                      to="/settings"
                      className={styles.menuIcon}
                      title="Configurações"
                    >
                      <FiSettings size={20} />
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className={styles.logoutBtn}
                    title="Sair"
                  >
                    <FiLogOut size={20} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className={styles.container}>
        {/* Sidebar */}
        <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
          <nav className={styles.nav}>
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`${styles.navItem} ${isActive(item.path) ? styles.active : ''}`}
                onClick={() => setSidebarOpen(false)}
                style={
                  isActive(item.path)
                    ? {
                        backgroundColor: branding?.primary_color || '#0ba52b',
                        color: 'white',
                        borderLeft: `4px solid ${branding?.secondary_color || '#bbf804'}`
                      }
                    : {}
                }
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className={styles.main}>
          <div className={styles.content}>
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className={styles.overlay}
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout;
