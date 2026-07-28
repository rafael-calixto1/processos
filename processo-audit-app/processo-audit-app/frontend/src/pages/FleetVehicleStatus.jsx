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
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { barDataset, makeBarOptions, brl } from './fleetCharts';
import styles from './Fleet.module.css';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const defaultStart = format(subMonths(new Date(), 3), 'yyyy-MM-dd');
const defaultEnd   = format(new Date(), 'yyyy-MM-dd');

const fmt = (v, decimals = 0) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const fmtDate = (v) => {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('pt-BR'); } catch { return '—'; }
};

/* Pills de revisão — verde quando em dia, âmbar quando atrasado */
const ServicePill = ({ atrasado, total, ultima }) => (
  <span className={`${styles.servicePill} ${atrasado ? styles.servicePillLate : styles.servicePillOk}`}>
    {atrasado ? <AlertTriangle size={12} strokeWidth={2.5} /> : <CheckCircle2 size={12} strokeWidth={2.5} />}
    {total || 0} troca(s)
    {ultima ? ` · ${fmtDate(ultima)}` : ''}
  </span>
);

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

  /*
   * O eixo X usa só a placa — o nome completo do veículo estouraria o rótulo.
   * O nome vai para o título do tooltip.
   */
  const plates = data.map(r => r.placa_carro || '—');
  const fullNames = data.map(r =>
    `${r.marca_carro || ''} ${r.modelo_carro || ''} (${r.placa_carro || '—'})`.trim()
  );
  const vehicleTitle = (items) => fullNames[items[0]?.dataIndex] ?? '';

  const maintenanceChartData = {
    labels: plates,
    datasets: [barDataset('Manutenções', data.map(r => parseInt(r.total_manutencoes || 0)))],
  };

  const fuelChartData = {
    labels: plates,
    datasets: [barDataset('Litros', data.map(r => parseFloat(r.total_combustivel || 0)))],
  };

  const xTicks = { maxRotation: 45, minRotation: 0, autoSkip: false };

  const maintenanceOptions = makeBarOptions({
    formatValue: v => `${v.toLocaleString('pt-BR')} manutenção(ões)`,
    integerOnly: true,
    titleCallback: vehicleTitle,
    xTicks,
  });

  const fuelOptions = makeBarOptions({
    formatValue: v => `${brl(v)} L`,
    titleCallback: vehicleTitle,
    xTicks,
  });

  return (
    <div className={styles.fleet}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Status dos Veículos</h1>
          <p>Visão consolidada por veículo</p>
        </div>
        <div className={styles.filterRow} style={{ marginBottom: 0 }}>
          <label htmlFor="status-start">De</label>
          <input
            id="status-start"
            type="date" value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className={styles.dateInput}
          />
          <label htmlFor="status-end">Até</label>
          <input
            id="status-end"
            type="date" value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className={styles.dateInput}
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
                  <Bar data={maintenanceChartData} options={maintenanceOptions} />
                </div>
              )}
            </div>
            <div className={styles.chartCard}>
              <h3>Consumo de Combustível por Veículo (Litros)</h3>
              {data.length === 0 ? (
                <div className={styles.emptyState}><p>Sem dados</p></div>
              ) : (
                <div style={{ height: '350px' }}>
                  <Bar data={fuelChartData} options={fuelOptions} />
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
                        <th className={styles.numCol}>Km Atual</th>
                        <th className={styles.numCol}>Combustível (L)</th>
                        <th className={styles.numCol}>Custo Comb.</th>
                        <th className={styles.numCol}>Média km/L</th>
                        <th>Óleo</th>
                        <th>Pneu</th>
                        <th className={styles.numCol}>Manutenções</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((r, i) => (
                        <tr key={r.carro_id || i}>
                          <td>
                            <div className={styles.vehicleName}>{r.marca_carro} {r.modelo_carro}</div>
                            <div className={styles.vehiclePlate}>{r.placa_carro}</div>
                          </td>
                          <td>{r.nome_motorista || '—'}</td>
                          <td className={styles.numCol}>{fmt(r.quilometragem_atual)} km</td>
                          <td className={styles.numCol}>{fmt(r.total_combustivel, 2)} L</td>
                          <td className={styles.numCol}>R$ {fmt(r.custo_total_combustivel, 2)}</td>
                          <td className={styles.numCol}>{fmt(r.media_consumo_km_por_litro, 2)}</td>
                          <td>
                            <ServicePill
                              atrasado={r.oleo_atrasado}
                              total={r.total_trocas_oleo}
                              ultima={r.ultima_troca_oleo_data}
                            />
                            {r.data_proxima_troca_oleo && (
                              <div className={styles.cellSub}>Próx: {fmtDate(r.data_proxima_troca_oleo)}</div>
                            )}
                          </td>
                          <td>
                            <ServicePill
                              atrasado={r.pneu_atrasado}
                              total={r.total_trocas_pneu}
                              ultima={r.ultima_troca_pneu_data}
                            />
                            {r.data_proxima_troca_pneu && (
                              <div className={styles.cellSub}>Próx: {fmtDate(r.data_proxima_troca_pneu)}</div>
                            )}
                          </td>
                          <td className={styles.numCol}>
                            <span className={styles.numStrong}>{r.total_manutencoes || 0}</span>
                            {r.custo_total_manutencao > 0 && (
                              <div className={styles.cellSubMoney}>
                                R$ {fmt(r.custo_total_manutencao, 2)}
                              </div>
                            )}
                            {r.ultima_manutencao_data && (
                              <div className={styles.cellSub}>Últ: {fmtDate(r.ultima_manutencao_data)}</div>
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
                      <ServicePill
                        atrasado={r.oleo_atrasado}
                        total={r.total_trocas_oleo}
                        ultima={r.ultima_troca_oleo_data}
                      />
                      {r.data_proxima_troca_oleo && (
                        <span className={styles.statusCardMuted}>Próx: {fmtDate(r.data_proxima_troca_oleo)}</span>
                      )}
                    </div>

                    <div className={styles.statusCardRow}>
                      <span className={styles.statusCardLabel}>Pneu</span>
                      <ServicePill
                        atrasado={r.pneu_atrasado}
                        total={r.total_trocas_pneu}
                        ultima={r.ultima_troca_pneu_data}
                      />
                      {r.data_proxima_troca_pneu && (
                        <span className={styles.statusCardMuted}>Próx: {fmtDate(r.data_proxima_troca_pneu)}</span>
                      )}
                    </div>

                    <div className={styles.statusCardRow}>
                      <span className={styles.statusCardLabel}>Manutenções</span>
                      <div className={styles.statusCardInline}>
                        <span className={styles.numStrong}>{r.total_manutencoes || 0}</span>
                        {r.custo_total_manutencao > 0 && (
                          <span className={styles.cellSubMoney}>
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
