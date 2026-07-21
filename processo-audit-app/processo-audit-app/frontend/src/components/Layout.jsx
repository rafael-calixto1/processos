import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import {
  LayoutDashboard, FileText, Network, FolderOpen, Building2,
  CheckSquare, Settings, Palette, Users, LogOut, Menu, X, ChevronRight, Truck, Wrench, TicketCheck, UserCheck, Database, Gift, FileSearch
} from 'lucide-react';
import styles from './Layout.module.css';

const menuItems = [
  { label: 'Dashboard', path: '/dashboard', Icon: LayoutDashboard },
  { label: 'Processos', path: '/processos', Icon: FileText },
  { label: 'Processos Visuais', path: '/processos-visual', Icon: Network },
  { label: 'Arquivos', path: '/arquivos', Icon: FolderOpen },
  { label: 'Departamentos', path: '/departamentos', Icon: Building2 },
  { label: 'Minhas Execuções', path: '/execucoes', Icon: CheckSquare },
  { label: 'Minha Conta', path: '/configuracoes', Icon: Settings },
  { label: 'Frota', path: '/frota', Icon: Truck },
  { label: 'Tickets', path: '/tickets', Icon: TicketCheck },
  { label: 'Indique e Ganhe', path: '/indique-e-ganhe', Icon: Gift },
  { label: 'Leads', path: '/leads', Icon: Users },
];

const adminItems = [
  { label: 'Branding', path: '/branding', Icon: Palette },
  { label: 'Usuários', path: '/users', Icon: Users },
  { label: 'HubSoft Explorer', path: '/hubsoft/explorer', Icon: Database },
];

const toolItems = [
  { label: 'Consulta Login PPPoE', path: '/ferramentas/hubsoft-login-search', Icon: UserCheck },
  { label: 'Consulta de Fatura', path: '/ferramentas/consulta-fatura', Icon: FileSearch },
  { label: 'Técnicos HubSoft', path: '/hubsoft/tecnicos', Icon: UserCheck },
  { label: 'Integração Hotspot Google Sheet', path: '/ferramentas/hotspot-google-sheets', Icon: Wrench },
  { label: 'Criar Config do Hotspot', path: '/ferramentas/criar-config-hotspot', Icon: Wrench },
];

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

  const primary = branding?.primary_color || '#0ba52b';
  const secondary = branding?.secondary_color || '#bbf804';

  const allItems = user?.role === 'admin' ? [...menuItems, ...adminItems] : menuItems;

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div className={styles.layout}>
      <header className={styles.header} style={{ backgroundColor: primary, borderBottom: `3px solid ${secondary}` }}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <button
              className={`${styles.menuToggle} ${sidebarOpen ? styles.toggleActive : ''}`}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle menu"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <Link to="/dashboard" className={styles.logo}>
              {branding?.logo_url ? (
                <img src={branding.logo_url} alt="Logo" className={styles.logoImage} />
              ) : (
                <div className={styles.logoPlaceholder} style={{ color: primary }}>
                  {branding?.company_name?.charAt(0).toUpperCase() || 'P'}
                </div>
              )}
              <span className={styles.logoText}>{branding?.company_name || 'Processo Audit'}</span>
            </Link>
          </div>

          {user && (
            <div className={styles.headerRight}>
              <div className={styles.userInfo}>
                <span className={styles.userName}>{user.name}</span>
                <span className={styles.userRole}>{user.role}</span>
              </div>
              <div className={styles.avatar} title={user.name}>
                {initials}
              </div>
              <button onClick={handleLogout} className={styles.logoutBtn} title="Sair">
                <LogOut size={18} />
              </button>
            </div>
          )}
        </div>
      </header>

      <div className={styles.container}>
        <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
          <nav className={styles.nav}>
            <div className={styles.navSection}>
              {allItems.map(({ label, path, Icon }) => (
                <Link
                  key={path}
                  to={path}
                  className={`${styles.navItem} ${isActive(path) ? styles.active : ''}`}
                  onClick={() => setSidebarOpen(false)}
                  style={isActive(path) ? { color: primary } : {}}
                >
                  <span className={styles.navIcon} style={isActive(path) ? { color: primary } : {}}>
                    <Icon size={18} strokeWidth={isActive(path) ? 2.5 : 2} />
                  </span>
                  <span className={styles.navLabel}>{label}</span>
                  {isActive(path) && <ChevronRight size={14} className={styles.activeArrow} />}
                </Link>
              ))}
            </div>

            <div className={styles.navSectionLabel}>Ferramentas</div>
            <div className={styles.navSection}>
              {toolItems.map(({ label, path, Icon }) => (
                <Link
                  key={path}
                  to={path}
                  className={`${styles.navItem} ${isActive(path) ? styles.active : ''}`}
                  onClick={() => setSidebarOpen(false)}
                  style={isActive(path) ? { color: primary } : {}}
                >
                  <span className={styles.navIcon} style={isActive(path) ? { color: primary } : {}}>
                    <Icon size={18} strokeWidth={isActive(path) ? 2.5 : 2} />
                  </span>
                  <span className={styles.navLabel}>{label}</span>
                  {isActive(path) && <ChevronRight size={14} className={styles.activeArrow} />}
                </Link>
              ))}
            </div>
          </nav>
        </aside>

        <main className={styles.main}>
          <div className={styles.content}>
            {children}
          </div>
        </main>
      </div>

      {sidebarOpen && (
        <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
};

export default Layout;
