import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import {
  LayoutDashboard, FileText, Network, FolderOpen, Building2,
  CheckSquare, Settings, Palette, Users, LogOut, Menu, X, ChevronRight, Truck, Wrench, TicketCheck, UserCheck, Database, Gift, FileSearch,
} from 'lucide-react';
import { estoqueMenu, osItems } from './menuItems';
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

const ROLE_LABELS = { admin: 'Administrador', estoque: 'Estoque', tecnico: 'Técnico', manager: 'Gestor', viewer: 'Visualizador' };

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

  const isTecnico = user?.role === 'tecnico';
  // Técnico de campo só vê o que é dele (OS, posse, devolução)
  const allItems = isTecnico ? [] : user?.role === 'admin' ? [...menuItems, ...adminItems] : menuItems;
  const osMenu = osItems
    .filter((i) => i.roles.includes(user?.role))
    .map((i) => ({ ...i, label: i.labelByRole?.[user?.role] || i.label }));
  const stockItems = estoqueMenu.roles.includes(user?.role) ? [estoqueMenu] : [];
  // Estoque fica ativo em qualquer subpágina /estoque/*
  const isActiveItem = (path) => (path === '/estoque' ? location.pathname.startsWith('/estoque') : isActive(path));

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <button
              className={`${styles.menuToggle} ${sidebarOpen ? styles.toggleActive : ''}`}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle menu"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <Link to="/dashboard" className={styles.logo} title={branding?.company_name || 'Conexão Web'}>
              <img src="/logo-cw-full.png" alt={branding?.company_name || 'Conexão Web'} className={styles.logoImage} />
              <span className={styles.logoText}>Processos</span>
            </Link>
          </div>

          {user && (
            <div className={styles.headerRight}>
              <div className={styles.userInfo}>
                <span className={styles.userName}>{user.name}</span>
                <span className={styles.userRole}>{ROLE_LABELS[user.role] || user.role}</span>
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
                >
                  <span className={styles.navIcon}>
                    <Icon size={18} strokeWidth={isActive(path) ? 2.5 : 2} />
                  </span>
                  <span className={styles.navLabel}>{label}</span>
                  {isActive(path) && <ChevronRight size={14} className={styles.activeArrow} />}
                </Link>
              ))}
            </div>

            {[['Estoque', stockItems], ['OS', osMenu]].map(([title, list]) => list.length > 0 && (
              <React.Fragment key={title}>
                <div className={styles.navSectionLabel}>{title}</div>
                <div className={styles.navSection}>
                  {list.map(({ label, path, Icon }) => (
                    <Link
                      key={path}
                      to={path}
                      className={`${styles.navItem} ${isActiveItem(path) ? styles.active : ''}`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className={styles.navIcon}>
                        <Icon size={18} strokeWidth={isActiveItem(path) ? 2.5 : 2} />
                      </span>
                      <span className={styles.navLabel}>{label}</span>
                      {isActiveItem(path) && <ChevronRight size={14} className={styles.activeArrow} />}
                    </Link>
                  ))}
                </div>
              </React.Fragment>
            ))}

            {!isTecnico && (
            <>
            <div className={styles.navSectionLabel}>Ferramentas</div>
            <div className={styles.navSection}>
              {toolItems.map(({ label, path, Icon }) => (
                <Link
                  key={path}
                  to={path}
                  className={`${styles.navItem} ${isActive(path) ? styles.active : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className={styles.navIcon}>
                    <Icon size={18} strokeWidth={isActive(path) ? 2.5 : 2} />
                  </span>
                  <span className={styles.navLabel}>{label}</span>
                  {isActive(path) && <ChevronRight size={14} className={styles.activeArrow} />}
                </Link>
              ))}
            </div>
            </>
            )}
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
