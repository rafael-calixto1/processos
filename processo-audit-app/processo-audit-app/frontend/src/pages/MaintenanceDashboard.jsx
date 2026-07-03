import React, { useState, useEffect, useCallback } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import { format, subMonths } from 'date-fns';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import styles from './Fleet.module.css';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const ResponsiveGridLayout = WidthProvider(Responsive);

const STORAGE_KEY = 'maintenance_dashboard_layout';

const defaultStart = format(subMonths(new Date(), 6), 'yyyy-MM-dd');
const defaultEnd   = format(new Date(), 'yyyy-MM-dd');

const MaintenanceDashboard = () => {
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate,   setEndDate]   = useState(defaultEnd);
  const [data,      setData]      = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  // Initial layout
  const defaultLayouts = {
    lg: [
      { i: 'summary-cost',  x: 0, y: 0, w: 3, h: 2 },
      { i: 'summary-count', x: 3, y: 0, w: 3, h: 2 },
      { i: 'chart-count',   x: 0, y: 2, w: 6, h: 6 },
      { i: 'chart-cost',    x: 6, y: 2, w: 6, h: 6 },
    ]
  };

  const [layouts, setLayouts] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : defaultLayouts;
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/fleet/fueling/statistics/maintenance-by-type?startDate=${startDate}&endDate=${endDate}`);
      const json = await res.json();
      setData(Array.isArray(json) ? json : []);
    } catch (e) {
      setError('Erro ao carregar dados do dashboard: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onLayoutChange = (currentLayout, allLayouts) => {
    setLayouts(allLayouts);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allLayouts));
  };

  const totalCost = data.reduce((acc, curr) => acc + parseFloat(curr.custo_total || 0), 0);
  const totalCount = data.reduce((acc, curr) => acc + parseInt(curr.total_manutencoes || 0), 0);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
      x: { grid: { display: false } },
    },
  };

  const countChartData = {
    labels: data.map(d => d.tipo_manutencao),
    datasets: [{
      label: 'Qtd. Manutenções',
      data: data.map(d => d.total_manutencoes),
      backgroundColor: 'rgba(11, 165, 43, 0.7)',
      borderRadius: 6,
    }]
  };

  const costChartData = {
    labels: data.map(d => d.tipo_manutencao),
    datasets: [{
      label: 'Custo Total (R$)',
      data: data.map(d => d.custo_total),
      backgroundColor: 'rgba(37, 99, 235, 0.7)',
      borderRadius: 6,
    }]
  };

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.filterRow} style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label>De</label>
          <input type="date" className={styles.input} value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: 'auto' }} />
          <label>Até</label>
          <input type="date" className={styles.input} value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: 'auto' }} />
        </div>
        <div style={{ flex: 1 }} />
        <button className={styles.btnSecondary} onClick={() => { localStorage.removeItem(STORAGE_KEY); setLayouts(defaultLayouts); }}>
          Resetar Layout
        </button>
      </div>

      {error && <div className={styles.errorState}>{error}</div>}

      {loading ? (
        <div className={styles.loadingState}><div className="spinner" /></div>
      ) : (
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={30}
          onLayoutChange={onLayoutChange}
          draggableHandle=".widget-header"
        >
          <div key="summary-cost" className={styles.widgetCard}>
            <div className="widget-header" style={{ cursor: 'move', padding: '10px', borderBottom: '1px solid #eee', fontSize: '0.8rem', fontWeight: 600, color: '#666' }}>
              Custo Total de Manutenção
            </div>
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                R$ {totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div key="summary-count" className={styles.widgetCard}>
            <div className="widget-header" style={{ cursor: 'move', padding: '10px', borderBottom: '1px solid #eee', fontSize: '0.8rem', fontWeight: 600, color: '#666' }}>
              Total de Manutenções
            </div>
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-dark)' }}>
                {totalCount}
              </div>
            </div>
          </div>

          <div key="chart-count" className={styles.widgetCard}>
            <div className="widget-header" style={{ cursor: 'move', padding: '10px', borderBottom: '1px solid #eee', fontSize: '0.8rem', fontWeight: 600, color: '#666' }}>
              Manutenções por Tipo (Qtd)
            </div>
            <div style={{ padding: '15px', height: 'calc(100% - 40px)' }}>
              <Bar data={countChartData} options={chartOptions} />
            </div>
          </div>

          <div key="chart-cost" className={styles.widgetCard}>
            <div className="widget-header" style={{ cursor: 'move', padding: '10px', borderBottom: '1px solid #eee', fontSize: '0.8rem', fontWeight: 600, color: '#666' }}>
              Custos por Tipo (R$)
            </div>
            <div style={{ padding: '15px', height: 'calc(100% - 40px)' }}>
              <Bar data={costChartData} options={chartOptions} />
            </div>
          </div>
        </ResponsiveGridLayout>
      )}
    </div>
  );
};

export default MaintenanceDashboard;
