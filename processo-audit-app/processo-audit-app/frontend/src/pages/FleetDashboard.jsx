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
import styles from './Fleet.module.css';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const GREEN_PALETTE = [
  '#0ba52b', '#22c55e', '#4ade80', '#86efac', '#bbf7d0',
  '#16a34a', '#15803d', '#059669', '#10b981', '#34d399',
];

const defaultStart = format(subMonths(new Date(), 3), 'yyyy-MM-dd');
const defaultEnd   = format(new Date(), 'yyyy-MM-dd');

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

  /* ── Chart data ── */
  const pieVehicleData = {
    labels: costByVehicle.map(r => `${r.detalhesDoCarro || r.veiculo || 'Veículo'}`),
    datasets: [{
      data: costByVehicle.map(r => parseFloat(r.custo_total || 0)),
      backgroundColor: GREEN_PALETTE,
      borderWidth: 2,
      borderColor: '#fff',
    }],
  };

  const barFuelByTypeData = {
    labels: fuelByType.map(r => r.tipo_combustivel),
    datasets: [{
      label: 'Litros',
      data: fuelByType.map(r => parseFloat(r.total_litros || 0)),
      backgroundColor: '#0ba52b',
      borderRadius: 6,
    }],
  };

  const barFuelCostData = {
    labels: fuelCostByType.map(r => r.tipo_combustivel),
    datasets: [{
      label: 'Custo (R$)',
      data: fuelCostByType.map(r => parseFloat(r.custo_total || 0)),
      backgroundColor: '#22c55e',
      borderRadius: 6,
    }],
  };

  const barMaintenanceData = {
    labels: maintenanceByType.map(r => r.tipo_manutencao),
    datasets: [{
      label: 'Total',
      data: maintenanceByType.map(r => parseInt(r.total_manutencoes || 0)),
      backgroundColor: '#16a34a',
      borderRadius: 6,
    }],
  };

  const barFuelingDateData = {
    labels: fuelingByDate.map(r => r.periodo || r.data_inicio || ''),
    datasets: [{
      label: 'Abastecimentos',
      data: fuelingByDate.map(r => parseInt(r.total_abastecimentos || 0)),
      backgroundColor: '#4ade80',
      borderRadius: 6,
    }],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => {
            const val = ctx.parsed.y;
            return ` ${val.toLocaleString('pt-BR')}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: { font: { size: 11 } },
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
    },
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 14, font: { size: 11 }, padding: 10 },
      },
      tooltip: {
        callbacks: {
          label: ctx => {
            const val = ctx.parsed;
            return ` R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
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
          <label>De</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className={styles.input}
            style={{ width: 'auto' }}
          />
          <label>Até</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className={styles.input}
            style={{ width: 'auto' }}
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
            <div className={styles.summaryCard}>
              <div className={styles.summaryValue}>
                R$ {totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className={styles.summaryLabel}>Custo Total</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryValue}>
                {totalLiters.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} L
              </div>
              <div className={styles.summaryLabel}>Total de Litros</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryValue}>{costByVehicle.length}</div>
              <div className={styles.summaryLabel}>Veículos com Dados</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryValue}>
                {maintenanceByType.reduce((s, r) => s + parseInt(r.total_manutencoes || 0), 0)}
              </div>
              <div className={styles.summaryLabel}>Total de Manutenções</div>
            </div>
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
                  <Bar data={barFuelByTypeData} options={barOptions} />
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
                  <Bar data={barFuelCostData} options={barOptions} />
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
                  <Bar data={barMaintenanceData} options={barOptions} />
                </div>
              )}
            </div>

            {/* Bar: Fueling by Date */}
            <div className={styles.chartCard}>
              <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span>Abastecimentos ao Longo do Tempo</span>
                <select
                  value={groupBy}
                  onChange={e => setGroupBy(e.target.value)}
                  className={styles.select}
                  style={{ width: 'auto', fontSize: '0.8125rem', padding: '0.3rem 2rem 0.3rem 0.6rem' }}
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
                  <Bar data={barFuelingDateData} options={barOptions} />
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
