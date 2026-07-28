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
import { Coins, Wrench, RotateCcw } from 'lucide-react';
import { barDataset, makeBarOptions, brl } from './fleetCharts';
import styles from './Fleet.module.css';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const ResponsiveGridLayout = WidthProvider(Responsive);

// v2: os KPIs saíram da grade — layouts salvos com as chaves antigas são descartados
const STORAGE_KEY = 'maintenance_dashboard_layout_v2';

const defaultStart = format(subMonths(new Date(), 6), 'yyyy-MM-dd');
const defaultEnd   = format(new Date(), 'yyyy-MM-dd');

/*
 * Só os gráficos ficam na grade arrastável. Os KPIs saíram dela: como itens de
 * grade a largura vinha das colunas (w:3 = 25% da tela) e a altura das linhas,
 * o que os deixava largos e vazios. Agora são cartões compactos de largura fixa.
 */
const defaultLayouts = {
  lg: [
    { i: 'chart-count', x: 0, y: 0, w: 6, h: 7 },
    { i: 'chart-cost',  x: 6, y: 0, w: 6, h: 7 },
  ],
};

const MaintenanceDashboard = () => {
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate,   setEndDate]   = useState(defaultEnd);
  const [data,      setData]      = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

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

  const resetLayout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setLayouts(defaultLayouts);
  };

  const totalCost = data.reduce((acc, curr) => acc + parseFloat(curr.custo_total || 0), 0);
  const totalCount = data.reduce((acc, curr) => acc + parseInt(curr.total_manutencoes || 0), 0);

  const labels = data.map(d => d.tipo_manutencao);

  const countChartData = {
    labels,
    datasets: [barDataset('Qtd. Manutenções', data.map(d => parseInt(d.total_manutencoes || 0)))],
  };

  const costChartData = {
    labels,
    datasets: [barDataset('Custo Total (R$)', data.map(d => parseFloat(d.custo_total || 0)))],
  };

  const countOptions = makeBarOptions({
    formatValue: v => `${v.toLocaleString('pt-BR')} manutenção(ões)`,
    integerOnly: true,
  });
  const costOptions = makeBarOptions({ formatValue: v => `R$ ${brl(v)}` });

  return (
    <div className={styles.dashboardContainer}>
      {/* Toolbar unificada: período à esquerda, ações à direita */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <label htmlFor="maint-start">De</label>
          <input
            id="maint-start"
            type="date"
            className={styles.dateInput}
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
          <label htmlFor="maint-end">Até</label>
          <input
            id="maint-end"
            type="date"
            className={styles.dateInput}
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </div>
        <button className={styles.btnSecondary} onClick={resetLayout}>
          <RotateCcw size={15} strokeWidth={2} /> Resetar Layout
        </button>
      </div>

      {error && <div className={styles.errorState}>{error}</div>}

      {loading ? (
        <div className={styles.loadingState}><div className="spinner" /></div>
      ) : (
        <>
        {/* KPIs compactos, fora da grade arrastável */}
        <div className={styles.kpiRow}>
          <div className={styles.kpiCard}>
            <Coins className={styles.kpiWatermark} strokeWidth={1.5} aria-hidden="true" />
            <span className={styles.kpiLabel}>Custo Total de Manutenção</span>
            <span className={styles.kpiValue}>R$ {brl(totalCost)}</span>
            <span className={styles.kpiHint}>no período selecionado</span>
          </div>

          <div className={styles.kpiCard}>
            <Wrench className={styles.kpiWatermark} strokeWidth={1.5} aria-hidden="true" />
            <span className={styles.kpiLabel}>Total de Manutenções</span>
            <span className={styles.kpiValue}>{totalCount.toLocaleString('pt-BR')}</span>
            <span className={styles.kpiHint}>{data.length} tipo(s) registrado(s)</span>
          </div>
        </div>

        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={30}
          onLayoutChange={onLayoutChange}
          draggableHandle=".widget-header"
        >
          <div key="chart-count" className={styles.widgetCard}>
            <div className={`widget-header ${styles.widgetHeader}`}>Manutenções por Tipo (Qtd)</div>
            <div className={styles.widgetBody}>
              {data.length === 0
                ? <div className={styles.emptyState}><p>Sem dados</p></div>
                : <Bar data={countChartData} options={countOptions} />}
            </div>
          </div>

          <div key="chart-cost" className={styles.widgetCard}>
            <div className={`widget-header ${styles.widgetHeader}`}>Custos por Tipo (R$)</div>
            <div className={styles.widgetBody}>
              {data.length === 0
                ? <div className={styles.emptyState}><p>Sem dados</p></div>
                : <Bar data={costChartData} options={costOptions} />}
            </div>
          </div>
        </ResponsiveGridLayout>
        </>
      )}
    </div>
  );
};

export default MaintenanceDashboard;
