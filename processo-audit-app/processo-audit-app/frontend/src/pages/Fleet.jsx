import React from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { LayoutDashboard, Activity, Car, Users, Fuel, Wrench, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import styles from './Fleet.module.css';
import FleetDashboard     from './FleetDashboard';
import FleetVehicleStatus from './FleetVehicleStatus';
import FleetCars          from './FleetCars';
import FleetDrivers       from './FleetDrivers';
import FleetFueling       from './FleetFueling';
import FleetMaintenance   from './FleetMaintenance';
import FleetAuditoria     from './FleetAuditoria';

// `slug` é o pedaço da URL: /frota/<slug> (o painel fica em /frota)
const TABS = [
  { id: 'dashboard',   slug: '',              label: 'Painel',        Icon: LayoutDashboard },
  { id: 'status',      slug: 'status',        label: 'Status',        Icon: Activity        },
  { id: 'cars',        slug: 'veiculos',      label: 'Veículos',      Icon: Car             },
  { id: 'drivers',     slug: 'motoristas',    label: 'Motoristas',    Icon: Users           },
  { id: 'fueling',     slug: 'abastecimento', label: 'Abastecimento', Icon: Fuel            },
  { id: 'maintenance', slug: 'manutencao',    label: 'Manutenção',    Icon: Wrench          },
  { id: 'auditoria',   slug: 'auditoria',     label: 'Auditoria',     Icon: ShieldCheck, roles: ['admin', 'manager'] },
];

const Fleet = () => {
  const { aba = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const tabs = TABS.filter(t => !t.roles || t.roles.includes(user?.role));
  const current = tabs.find(t => t.slug === aba);
  if (!current) return <Navigate to="/frota" replace />;
  const activeTab = current.id;

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':   return <FleetDashboard />;
      case 'status':      return <FleetVehicleStatus />;
      case 'cars':        return <FleetCars />;
      case 'drivers':     return <FleetDrivers />;
      case 'fueling':     return <FleetFueling />;
      case 'maintenance': return <FleetMaintenance />;
      case 'auditoria':   return <FleetAuditoria />;
      default:            return <FleetDashboard />;
    }
  };

  return (
    <div className={styles.fleet}>
      {/* Page header — only shown for non-dashboard tabs that don't render their own */}
      {activeTab !== 'dashboard' && activeTab !== 'status' && (
        <div className={styles.pageHeader}>
          <div>
            <h1>{current.label}</h1>
          </div>
        </div>
      )}

      {/* Main Tab Bar */}
      <div className={styles.tabBar}>
        {tabs.map(({ id, slug, label, Icon }) => (
          <button
            key={id}
            onClick={() => navigate(slug ? `/frota/${slug}` : '/frota')}
            className={`${styles.tab} ${activeTab === id ? styles.tabActive : ''}`}
          >
            <Icon size={18} strokeWidth={activeTab === id ? 2.5 : 2} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div key={activeTab}>
        {renderContent()}
      </div>
    </div>
  );
};

export default Fleet;
