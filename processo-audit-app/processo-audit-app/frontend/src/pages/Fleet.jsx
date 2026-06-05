import React, { useState } from 'react';
import { Truck, Gauge, Car, Users, Fuel, ClipboardList } from 'lucide-react';
import styles from './Fleet.module.css';
import FleetDashboard     from './FleetDashboard';
import FleetVehicleStatus from './FleetVehicleStatus';
import FleetCars          from './FleetCars';
import FleetDrivers       from './FleetDrivers';
import FleetFueling       from './FleetFueling';
import FleetMaintenance   from './FleetMaintenance';

const TABS = [
  { id: 'dashboard',    label: 'Painel',           Icon: Gauge          },
  { id: 'status',       label: 'Status',            Icon: Truck          },
  { id: 'cars',         label: 'Veículos',          Icon: Car            },
  { id: 'drivers',      label: 'Motoristas',        Icon: Users          },
  { id: 'fueling',      label: 'Abastecimento',     Icon: Fuel           },
  { id: 'maintenance',  label: 'Manutenção',        Icon: ClipboardList  },
];

const Fleet = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':   return <FleetDashboard />;
      case 'status':      return <FleetVehicleStatus />;
      case 'cars':        return <FleetCars />;
      case 'drivers':     return <FleetDrivers />;
      case 'fueling':     return <FleetFueling />;
      case 'maintenance': return <FleetMaintenance />;
      default:            return <FleetDashboard />;
    }
  };

  const current = TABS.find(t => t.id === activeTab);

  return (
    <div className={styles.fleet}>
      {/* Page header — only shown for non-dashboard tabs that don't render their own */}
      {activeTab !== 'dashboard' && activeTab !== 'status' && (
        <div className={styles.pageHeader}>
          <div>
            <h1>{current?.label}</h1>
          </div>
        </div>
      )}

      {/* Main Tab Bar */}
      <div className={styles.tabBar}>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`${styles.tab} ${activeTab === id ? styles.tabActive : ''}`}
          >
            <Icon size={15} strokeWidth={2} />
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
