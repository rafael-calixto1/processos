import React, { useState, useEffect } from 'react';
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
import { AlertTriangle, CheckCircle } from 'lucide-react';
import styles from './Fleet.module.css';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const defaultStart = format(subMonths(new Date(), 3), 'yyyy-MM-dd');
const defaultEnd   = format(new Date(), 'yyyy-MM-dd');

const FleetVehicleStatus = () => {
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate,   setEndDate]   = useState(defaultEnd);
  const [data,      setData]      = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => { fetchData(); }, [startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/fleet/vehicle-status?startDate=${startDate}&endDate=${endDate}`);
      const json = await res.json();
      setData(Array.isArray(json) ? json : []);
    } catch (e) {
      setError('Erro ao carregar status dos veículos: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y.toLocaleString('pt-BR')}` } },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 } } },
      x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 30 } },
    },
  };

  const labels = data.map(r => `${r.marca_carro || ''} ${r.modelo_carro || ''} (${r.placa_carro || ''})`);

  const maintenanceChartData = {
    labels,
    datasets: [{
      label: 'Manutenções',
      data: data.map(r => parseInt(r.total_manutencoes || 0)),
      backgroundColor: '#0ba52b',
      borderRadius: 6,
    }],
  };

  const fuelChartData = {
    labels,
    datasets: [{
      label: 'Litros',
      data: data.map(r => parseFloat(r.total_combustivel || 0)),
      backgroundColor: '#22c55e',
      borderRadius: 6,
    }],
  };

  const fmt = (v, decimals = 0) => {
    if (v === null || v === undefined || v === '') return '—';
    const n = parseFloat(v);
    if (isNaN(n)) return '—';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const fmtDate = v => {
    if (!v) return '—';
    try { return new Date(v).toLocaleDateString('pt-BR'); } catch { return '—'; }
  };

  return (
    <div className={styles.fleet}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Status dos Veículos</h1>
          <p>Visão consolidada por veículo</p>
        </div>
        <div className={styles.filterRow} style={{ marginBottom: 0 }}>
          <label>De</label>
          <input
            type="date" value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className={styles.input} style={{ width: 'auto' }}
          />
          <label>Até</label>
          <input
            type="date" value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className={styles.input} style={{ width: 'auto' }}
          />
        </div>
      </div>

      {error && <div className={styles.errorState}>{error}</div>}

      {loading ? (
        <div className={styles.loadingState}>
          <div className="spinner" />
          <span>Carregando...</span>
        </div>
      ) : (
        <>
          {/* Charts */}
          <div className={styles.chartsGrid} style={{ marginBottom: '1.5rem' }}>
            <div className={styles.chartCard}>
              <h3>Manutenções por Veículo</h3>
              {data.length === 0 ? (
                <div className={styles.emptyState}><p>Sem dados</p></div>
              ) : (
                <div style={{ height: '350px' }}>
                  <Bar data={maintenanceChartData} options={barOptions} />
                </div>
              )}
            </div>
            <div className={styles.chartCard}>
              <h3>Consumo de Combustível por Veículo (Litros)</h3>
              {data.length === 0 ? (
                <div className={styles.emptyState}><p>Sem dados</p></div>
              ) : (
                <div style={{ height: '350px' }}>
                  <Bar data={fuelChartData} options={barOptions} />
                </div>
              )}
            </div>
          </div>

          {/* Detail Table */}
          {data.length === 0 ? (
            <div className={styles.emptyState}><p>Nenhum dado encontrado para o período selecionado.</p></div>
          ) : (
            <>
              <div className={`${styles.tableContainer} ${styles.statusTableDesktop}`}>
                <div className={styles.tableScrollX}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Veículo</th>
                        <th>Motorista</th>
                        <th>Km Atual</th>
                        <th>Combustível (L)</th>
                        <th>Custo Comb.</th>
                        <th>Média km/L</th>
                        <th>Óleo</th>
                        <th>Pneu</th>
                        <th>Manutenções</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((r, i) => (
                        <tr key={r.carro_id || i}>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>
                              {r.marca_carro} {r.modelo_carro}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{r.placa_carro}</div>
                          </td>
                          <td>{r.nome_motorista || '—'}</td>
                          <td>{fmt(r.quilometragem_atual)} km</td>
                          <td>{fmt(r.total_combustivel, 2)} L</td>
                          <td>R$ {fmt(r.custo_total_combustivel, 2)}</td>
                          <td>{fmt(r.media_consumo_km_por_litro, 2)}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              {r.oleo_atrasado ? (
                                <AlertTriangle size={14} color="var(--error)" />
                              ) : (
                                <CheckCircle size={14} color="var(--success)" />
                              )}
                              <span style={{ fontSize: '0.8rem' }}>
                                {r.total_trocas_oleo || 0} troca(s)
                                {r.ultima_troca_oleo_data ? ` · ${fmtDate(r.ultima_troca_oleo_data)}` : ''}
                              </span>
                            </div>
                            {r.data_proxima_troca_oleo && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                                Próx: {fmtDate(r.data_proxima_troca_oleo)}
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              {r.pneu_atrasado ? (
                                <AlertTriangle size={14} color="var(--error)" />
                              ) : (
                                <CheckCircle size={14} color="var(--success)" />
                              )}
                              <span style={{ fontSize: '0.8rem' }}>
                                {r.total_trocas_pneu || 0} troca(s)
                                {r.ultima_troca_pneu_data ? ` · ${fmtDate(r.ultima_troca_pneu_data)}` : ''}
                              </span>
                            </div>
                            {r.data_proxima_troca_pneu && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                                Próx: {fmtDate(r.data_proxima_troca_pneu)}
                              </div>
                            )}
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{r.total_manutencoes || 0}</span>
                            {r.custo_total_manutencao > 0 && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--primary-color)', fontWeight: 600 }}>
                                R$ {fmt(r.custo_total_manutencao, 2)}
                              </div>
                            )}
                            {r.ultima_manutencao_data && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                                Últ: {fmtDate(r.ultima_manutencao_data)}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile card list — shows every field per vehicle without horizontal scrolling */}
              <div className={styles.statusCardList}>
                {data.map((r, i) => (
                  <div key={r.carro_id || i} className={styles.statusCard}>
                    <div className={styles.statusCardHeader}>
                      <div>
                        <div className={styles.statusCardVehicle}>{r.marca_carro} {r.modelo_carro}</div>
                        <div className={styles.statusCardPlate}>{r.placa_carro}</div>
                      </div>
                      <div className={styles.statusCardDriver}>{r.nome_motorista || '—'}</div>
                    </div>

                    <div className={styles.statusCardMetrics}>
                      <div className={styles.statusCardMetric}>
                        <span className={styles.statusCardLabel}>Km Atual</span>
                        <span className={styles.statusCardValue}>{fmt(r.quilometragem_atual)} km</span>
                      </div>
                      <div className={styles.statusCardMetric}>
                        <span className={styles.statusCardLabel}>Combustível</span>
                        <span className={styles.statusCardValue}>{fmt(r.total_combustivel, 2)} L</span>
                      </div>
                      <div className={styles.statusCardMetric}>
                        <span className={styles.statusCardLabel}>Custo Comb.</span>
                        <span className={styles.statusCardValue}>R$ {fmt(r.custo_total_combustivel, 2)}</span>
                      </div>
                      <div className={styles.statusCardMetric}>
                        <span className={styles.statusCardLabel}>Média km/L</span>
                        <span className={styles.statusCardValue}>{fmt(r.media_consumo_km_por_litro, 2)}</span>
                      </div>
                    </div>

                    <div className={styles.statusCardRow}>
                      <span className={styles.statusCardLabel}>Óleo</span>
                      <div className={styles.statusCardInline}>
                        {r.oleo_atrasado
                          ? <AlertTriangle size={14} color="var(--error)" />
                          : <CheckCircle size={14} color="var(--success)" />}
                        <span>
                          {r.total_trocas_oleo || 0} troca(s)
                          {r.ultima_troca_oleo_data ? ` · ${fmtDate(r.ultima_troca_oleo_data)}` : ''}
                        </span>
                      </div>
                      {r.data_proxima_troca_oleo && (
                        <span className={styles.statusCardMuted}>Próx: {fmtDate(r.data_proxima_troca_oleo)}</span>
                      )}
                    </div>

                    <div className={styles.statusCardRow}>
                      <span className={styles.statusCardLabel}>Pneu</span>
                      <div className={styles.statusCardInline}>
                        {r.pneu_atrasado
                          ? <AlertTriangle size={14} color="var(--error)" />
                          : <CheckCircle size={14} color="var(--success)" />}
                        <span>
                          {r.total_trocas_pneu || 0} troca(s)
                          {r.ultima_troca_pneu_data ? ` · ${fmtDate(r.ultima_troca_pneu_data)}` : ''}
                        </span>
                      </div>
                      {r.data_proxima_troca_pneu && (
                        <span className={styles.statusCardMuted}>Próx: {fmtDate(r.data_proxima_troca_pneu)}</span>
                      )}
                    </div>

                    <div className={styles.statusCardRow}>
                      <span className={styles.statusCardLabel}>Manutenções</span>
                      <div className={styles.statusCardInline}>
                        <span style={{ fontWeight: 600 }}>{r.total_manutencoes || 0}</span>
                        {r.custo_total_manutencao > 0 && (
                          <span style={{ color: 'var(--primary-color)', fontWeight: 600 }}>
                            R$ {fmt(r.custo_total_manutencao, 2)}
                          </span>
                        )}
                      </div>
                      {r.ultima_manutencao_data && (
                        <span className={styles.statusCardMuted}>Últ: {fmtDate(r.ultima_manutencao_data)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default FleetVehicleStatus;
