import React, { useState, useEffect } from 'react';
import { format, subMonths } from 'date-fns';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import { DollarSign, Fuel, Wrench, Droplet } from 'lucide-react';
import styles from './Fleet.module.css';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

/*
 * Paleta dos gráficos — espelha os tokens de styles/global.css.
 * O verde da marca marca a série principal; as demais usam a rampa neutra,
 * para que categorias vizinhas não fiquem em dois verdes indistinguíveis.
 */
const BRAND        = '#0ba52b'; // --primary-color
const BRAND_SOFT   = 'rgba(11, 165, 43, 0.16)';
const BRAND_HOVER  = 'rgba(11, 165, 43, 0.28)';
const TEXT_LIGHT   = '#6b7280'; // --text-light
const TEXT_DARK    = '#1a1a1a'; // --text-dark
const GRID_COLOR   = 'rgba(0, 0, 0, 0.05)';

const CATEGORICAL = [
  BRAND,     // --primary-color
  '#9ca3af', // --text-muted
  '#6b7280', // --text-light
  '#e5e7eb', // --border-color
  '#374151', // --text-medium
  '#274518', // --accent-color
  '#bbf804', // --secondary-color
];

const FONT_FAMILY = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const defaultStart = format(subMonths(new Date(), 3), 'yyyy-MM-dd');
const defaultEnd   = format(new Date(), 'yyyy-MM-dd');

const brl = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* Barras: preenchimento suave + contorno da marca, em vez de bloco chapado */
const softBar = (label, data) => ({
  label,
  data,
  backgroundColor: BRAND_SOFT,
  hoverBackgroundColor: BRAND_HOVER,
  borderColor: BRAND,
  borderWidth: 1.5,
  borderRadius: 6,
  maxBarThickness: 72,
});

const FleetDashboard = () => {
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate,   setEndDate]   = useState(defaultEnd);
  const [groupBy,   setGroupBy]   = useState('month');

  const [costByVehicle,     setCostByVehicle]     = useState([]);
  const [fuelByType,        setFuelByType]        = useState([]);
  const [fuelCostByType,    setFuelCostByType]    = useState([]);
  const [maintenanceByType, setMaintenanceByType] = useState([]);
  const [fuelingByDate,     setFuelingByDate]     = useState([]);

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    fetchAll();
  }, [startDate, endDate, groupBy]);

  const fetchAll = async () => {
    setLoading(true);
    setError('');
    try {
      const qs = `startDate=${startDate}&endDate=${endDate}`;
      const [v, ft, fct, mt, fd] = await Promise.all([
        fetch(`/api/fleet/fueling/statistics?${qs}`).then(r => r.json()),
        fetch(`/api/fleet/fueling/statistics/fuel-by-type?${qs}`).then(r => r.json()),
        fetch(`/api/fleet/fueling/statistics/fuel-cost-by-type?${qs}`).then(r => r.json()),
        fetch(`/api/fleet/fueling/statistics/maintenance-by-type?${qs}`).then(r => r.json()),
        fetch(`/api/fleet/fueling/statistics/fueling-by-date?${qs}&groupBy=${groupBy}`).then(r => r.json()),
      ]);
      setCostByVehicle(Array.isArray(v)   ? v   : []);
      setFuelByType(Array.isArray(ft)  ? ft  : []);
      setFuelCostByType(Array.isArray(fct) ? fct : []);
      setMaintenanceByType(Array.isArray(mt)  ? mt  : []);
      setFuelingByDate(Array.isArray(fd)  ? fd  : []);
    } catch (e) {
      setError('Erro ao carregar dados: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ── Derived totals ── */
  const totalCost = costByVehicle.reduce((s, r) => s + parseFloat(r.custo_total || 0), 0);
  const totalLiters = fuelByType.reduce((s, r) => s + parseFloat(r.total_litros || 0), 0);
  const totalMaintenanceCost = maintenanceByType.reduce((s, r) => s + parseFloat(r.custo_total || 0), 0);

  const summary = [
    { label: 'Custo Total Geral',    value: `R$ ${brl(totalCost + totalMaintenanceCost)}`, Icon: DollarSign },
    { label: 'Custo de Combustível', value: `R$ ${brl(totalCost)}`,                        Icon: Fuel       },
    { label: 'Custo de Manutenção',  value: `R$ ${brl(totalMaintenanceCost)}`,             Icon: Wrench     },
    { label: 'Total de Litros',      value: `${brl(totalLiters)} L`,                       Icon: Droplet    },
  ];

  /* ── Chart data ── */
  const pieVehicleData = {
    labels: costByVehicle.map(r => `${r.detalhesDoCarro || r.veiculo || 'Veículo'}`),
    datasets: [{
      data: costByVehicle.map(r => parseFloat(r.custo_total || 0)),
      backgroundColor: CATEGORICAL,
      borderWidth: 2,
      borderColor: '#fff',
      hoverOffset: 6,
    }],
  };

  const barFuelByTypeData    = { labels: fuelByType.map(r => r.tipo_combustivel),           datasets: [softBar('Litros',         fuelByType.map(r => parseFloat(r.total_litros || 0)))] };
  const barFuelCostData      = { labels: fuelCostByType.map(r => r.tipo_combustivel),       datasets: [softBar('Custo (R$)',     fuelCostByType.map(r => parseFloat(r.custo_total || 0)))] };
  const barMaintenanceData   = { labels: maintenanceByType.map(r => r.tipo_manutencao),     datasets: [softBar('Total',          maintenanceByType.map(r => parseInt(r.total_manutencoes || 0)))] };
  const barFuelingDateData   = { labels: fuelingByDate.map(r => r.periodo || r.data_inicio || ''), datasets: [softBar('Abastecimentos', fuelingByDate.map(r => parseInt(r.total_abastecimentos || 0)))] };

  const tooltipStyle = {
    backgroundColor: TEXT_DARK,
    titleFont: { family: FONT_FAMILY, size: 12, weight: '600' },
    bodyFont:  { family: FONT_FAMILY, size: 12 },
    padding: 10,
    cornerRadius: 8,
    displayColors: false,
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
  };

  const axisTicks = {
    font: { family: FONT_FAMILY, size: 11 },
    color: TEXT_LIGHT,
    padding: 6,
  };

  const baseBarOptions = (formatValue, integerOnly = false) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { ...tooltipStyle, callbacks: { label: ctx => ` ${formatValue(ctx.parsed.y)}` } },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: GRID_COLOR },
        border: { display: false },
        // Contagens não têm meia unidade — evita eixos com 0,1 / 0,2 …
        ticks: { ...axisTicks, precision: integerOnly ? 0 : undefined, stepSize: integerOnly ? 1 : undefined },
      },
      x: {
        grid: { display: false },
        border: { color: 'rgba(0,0,0,0.08)' },
        ticks: axisTicks,
      },
    },
  });

  const litersOptions = baseBarOptions(v => `${brl(v)} L`);
  const moneyOptions  = baseBarOptions(v => `R$ ${brl(v)}`);
  const countOptions  = baseBarOptions(v => v.toLocaleString('pt-BR'), true);

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          pointStyle: 'circle',
          font: { family: FONT_FAMILY, size: 11 },
          color: TEXT_LIGHT,
          padding: 14,
        },
      },
      tooltip: {
        ...tooltipStyle,
        callbacks: {
          label: (ctx) => {
            const total = ctx.dataset.data.reduce((s, n) => s + n, 0);
            const pct = total ? ((ctx.parsed / total) * 100).toFixed(1) : '0';
            return ` R$ ${brl(ctx.parsed)} (${pct}%)`;
          },
        },
      },
    },
  };

  return (
    <div className={styles.fleet}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Painel da Frota</h1>
          <p>Visão geral de custos e consumo</p>
        </div>
        <div className={styles.filterRow} style={{ marginBottom: 0 }}>
          <label htmlFor="fleet-start">De</label>
          <input
            id="fleet-start"
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className={styles.dateInput}
          />
          <label htmlFor="fleet-end">Até</label>
          <input
            id="fleet-end"
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className={styles.dateInput}
          />
        </div>
      </div>

      {error && <div className={styles.errorState}>{error}</div>}

      {loading ? (
        <div className={styles.loadingState}>
          <div className="spinner" />
          <span>Carregando dados...</span>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className={styles.summaryCards}>
            {summary.map(({ label, value, Icon }) => (
              <div key={label} className={styles.summaryCard}>
                <span className={styles.summaryIcon}>
                  <Icon size={20} strokeWidth={2} />
                </span>
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{value}</div>
                  <div className={styles.summaryLabel}>{label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className={styles.chartsGrid}>
            {/* Pie: Cost by Vehicle */}
            <div className={styles.chartCard}>
              <h3>Custo por Veículo (R$)</h3>
              {costByVehicle.length === 0 ? (
                <div className={styles.emptyState}><p>Sem dados</p></div>
              ) : (
                <div style={{ height: '350px' }}>
                  <Pie data={pieVehicleData} options={pieOptions} />
                </div>
              )}
            </div>

            {/* Bar: Fuel by Type */}
            <div className={styles.chartCard}>
              <h3>Combustível por Tipo (Litros)</h3>
              {fuelByType.length === 0 ? (
                <div className={styles.emptyState}><p>Sem dados</p></div>
              ) : (
                <div style={{ height: '350px' }}>
                  <Bar data={barFuelByTypeData} options={litersOptions} />
                </div>
              )}
            </div>

            {/* Bar: Fuel Cost by Type */}
            <div className={styles.chartCard}>
              <h3>Custo de Combustível por Tipo (R$)</h3>
              {fuelCostByType.length === 0 ? (
                <div className={styles.emptyState}><p>Sem dados</p></div>
              ) : (
                <div style={{ height: '350px' }}>
                  <Bar data={barFuelCostData} options={moneyOptions} />
                </div>
              )}
            </div>

            {/* Bar: Maintenance by Type */}
            <div className={styles.chartCard}>
              <h3>Manutenções por Tipo</h3>
              {maintenanceByType.length === 0 ? (
                <div className={styles.emptyState}><p>Sem dados</p></div>
              ) : (
                <div style={{ height: '350px' }}>
                  <Bar data={barMaintenanceData} options={countOptions} />
                </div>
              )}
            </div>

            {/* Bar: Fueling by Date */}
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitleRow}>
                <span>Abastecimentos ao Longo do Tempo</span>
                <select
                  value={groupBy}
                  onChange={e => setGroupBy(e.target.value)}
                  className={styles.chartSelect}
                >
                  <option value="day">Dia</option>
                  <option value="week">Semana</option>
                  <option value="month">Mês</option>
                </select>
              </h3>
              {fuelingByDate.length === 0 ? (
                <div className={styles.emptyState}><p>Sem dados</p></div>
              ) : (
                <div style={{ height: '350px' }}>
                  <Bar data={barFuelingDateData} options={countOptions} />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FleetDashboard;
