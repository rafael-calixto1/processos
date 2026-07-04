import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Pencil, Trash2, X, Fuel, QrCode, ClipboardPaste, CheckCircle2, AlertCircle, Camera, Upload } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import styles from './Fleet.module.css';

const LIMIT = 15;
const FUEL_TYPES = ['Gasolina', 'Etanol', 'Diesel', 'GNV'];

const emptyForm = {
  car_id: '', fuel_date: '', fueling_kilometers: '',
  fuel_amount: '', liters_quantity: '', price_per_liter: '',
  total_cost: '', fuel_type: 'Gasolina', observation: '',
};

const FleetFueling = () => {
  const [records,      setRecords]      = useState([]);
  const [cars,         setCars]         = useState([]);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  const [showForm,     setShowForm]     = useState(false);
  const [editId,       setEditId]       = useState(null);
  const [form,         setForm]         = useState(emptyForm);
  const [saving,       setSaving]       = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);

  /* QR Code Import States */
  const [showImport,   setShowImport]   = useState(false);
  const [importMode,   setImportMode]   = useState('camera'); // 'camera', 'paste', 'file'
  const [importHtml,   setImportHtml]   = useState('');
  const [importing,    setImporting]    = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [cameraError,  setCameraError]  = useState('');
  const [scanStatus,   setScanStatus]   = useState('scanning'); // 'scanning' | 'processing' | 'error'
  
  const scannerRef = useRef(null);

  const totalPages = Math.ceil(total / LIMIT) || 1;

  useEffect(() => {
    fetch('/api/fleet/cars?limit=500')
      .then(r => r.json())
      .then(j => setCars(j.cars || []))
      .catch(() => {});
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      const res  = await fetch(`/api/fleet/fueling?${params}`);
      const json = await res.json();
      setRecords(json.fuelingHistory || []);
      setTotal(json.total || 0);
    } catch (e) {
      setError('Erro ao carregar abastecimentos: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // Handle Scanner
  useEffect(() => {
    if (!showImport || importMode !== 'camera') return;

    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      setCameraError('A câmera requer HTTPS. Acesse via https://10.100.100.130:3004 e aceite o certificado.');
      setScanStatus('error');
      return;
    }

    let scanner;
    const timer = setTimeout(() => {
      try {
        scanner = new Html5QrcodeScanner(
          "qr-reader",
          {
            fps: 15,
            qrbox: { width: 280, height: 280 },
            videoConstraints: { facingMode: { exact: "environment" } },
            rememberLastUsedCamera: false,
            showTorchButtonIfSupported: false,
          },
          false
        );
        scanner.render(
          async (decodedText) => {
            scanner.clear().catch(() => {});
            setScanStatus('processing');
            try {
              await handleImportInModal(decodedText);
            } catch (err) {
              setCameraError('Erro ao processar cupom: ' + err.message);
              setScanStatus('error');
            }
          },
          () => {}
        );
        setScanStatus('scanning');
        scannerRef.current = scanner;
      } catch (err) {
        console.error("Scanner error:", err);
        setCameraError("Não foi possível iniciar o scanner. Verifique as permissões do navegador.");
        setScanStatus('error');
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      if (scanner) scanner.clear().catch(() => {});
      scannerRef.current = null;
    };
  }, [showImport, importMode]);

  /* Auto-calculate total_cost */
  const handleFormChange = (field, value) => {
    const next = { ...form, [field]: value };
    const liters = parseFloat(field === 'liters_quantity' ? value : next.liters_quantity) || 0;
    const price  = parseFloat(field === 'price_per_liter' ? value : next.price_per_liter) || 0;
    if (liters > 0 && price > 0) {
      next.total_cost = (liters * price).toFixed(2);
    }
    setForm(next);
  };

  const openAdd = () => { setEditId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = r => {
    setEditId(r.id);
    setForm({
      car_id:              r.car_id ?? '',
      fuel_date:           r.fuel_date ? r.fuel_date.slice(0, 10) : '',
      fueling_kilometers:  r.fueling_kilometers ?? '',
      fuel_amount:         r.fuel_amount ?? '',
      liters_quantity:     r.liters_quantity ?? '',
      price_per_liter:     r.price_per_liter ?? '',
      total_cost:          r.total_cost ?? '',
      fuel_type:           r.fuel_type || 'Gasolina',
      observation:         r.observation || '',
    });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditId(null); setForm(emptyForm); };

  const handleSave = async e => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        car_id:             form.car_id !== '' ? Number(form.car_id) : undefined,
        fueling_kilometers: form.fueling_kilometers !== '' ? Number(form.fueling_kilometers) : undefined,
        fuel_amount:        form.fuel_amount !== '' ? Number(form.fuel_amount) : undefined,
        liters_quantity:    form.liters_quantity !== '' ? Number(form.liters_quantity) : undefined,
        price_per_liter:    form.price_per_liter !== '' ? Number(form.price_per_liter) : undefined,
        total_cost:         form.total_cost !== '' ? Number(form.total_cost) : undefined,
      };
      if (editId) {
        await fetch(`/api/fleet/fueling/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch('/api/fleet/fueling', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      closeForm();
      fetchRecords();
    } catch (e) {
      setError('Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/fleet/fueling/entry/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      fetchRecords();
    } catch (e) {
      setError('Erro ao excluir: ' + e.message);
    }
  };

  // Shared logic: fetch + parse + fill form. Throws on error.
  const parseAndFill = async (payload) => {
    const res = await fetch('/api/fleet/fueling/parse-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Falha ao processar cupom');
    }
    const data = await res.json();

    let mappedCarId = '';
    if (data.fleet.licensePlate) {
      const p = data.fleet.licensePlate.replace('-', '').toUpperCase();
      const car = cars.find(c => c.license_plate.replace('-', '').toUpperCase() === p);
      if (car) mappedCarId = car.id;
    }

    const fuelingDate = data.transaction.date
      ? data.transaction.date.split(' ')[0].split('/').reverse().join('-')
      : new Date().toISOString().slice(0, 10);

    const p = (data.transaction.product || '').toUpperCase();
    let fType = 'Gasolina';
    if (p.includes('ETANOL')) fType = 'Etanol';
    else if (p.includes('DIESEL')) fType = 'Diesel';
    else if (p.includes('GNV')) fType = 'GNV';

    setForm({
      ...emptyForm,
      car_id: mappedCarId,
      fuel_date: fuelingDate,
      fueling_kilometers: data.fleet.mileage || '',
      liters_quantity: data.transaction.quantity || '',
      price_per_liter: data.transaction.unitPrice || '',
      total_cost: data.transaction.totalValue || '',
      fuel_type: fType,
      observation: `Importado via QR Code. Posto: ${data.issuer.name}. Motorista: ${data.fleet.driver || 'Não informado'}`,
    });

    setImportResult({
      success: true,
      carFound: !!mappedCarId,
      plate: data.fleet.licensePlate,
      issuer: data.issuer.name,
    });

    setShowImport(false);
    setShowForm(true);
  };

  // Called from camera scan callback — errors surfaced inside modal via cameraError
  const handleImportInModal = async (url) => {
    await parseAndFill({ url });
  };

  // Called from paste/file modes — errors surfaced at top via setError
  const handleImport = async (payload) => {
    if (!payload.url && !payload.html) return;
    setImporting(true);
    setError('');
    try {
      await parseAndFill(payload);
    } catch (e) {
      console.error(e);
      setError('Erro ao processar cupom: ' + e.message);
    } finally {
      setImporting(false);
      setImportHtml('');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setError('');
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode("qr-reader-hidden");
      const decodedText = await scanner.scanFile(file, true);
      await parseAndFill({ url: decodedText });
    } catch (err) {
      console.error(err);
      setError("Não foi possível ler um QR Code nesta imagem.");
    } finally {
      setImporting(false);
    }
  };

  const getCarLabel = id => {
    const c = cars.find(x => String(x.id) === String(id));
    return c ? `${c.make} ${c.model} (${c.license_plate})` : '—';
  };

  const fmtDate = v => {
    if (!v) return '—';
    try { return new Date(v).toLocaleDateString('pt-BR'); } catch { return '—'; }
  };

  return (
    <div>
      {error && <div className={styles.errorState}>{error}</div>}

      <div className={styles.filterRow}>
        <div className={styles.fuelingSpacer} />
        <div className={styles.fuelingActionsRow}>
          <button className={styles.btnSecondary} onClick={() => { setCameraError(''); setScanStatus('scanning'); setShowImport(true); setImportMode('camera'); }}>
            <QrCode size={16} /> Ler QR Code
          </button>
          <button className={styles.btnPrimary} onClick={openAdd}>
            <Plus size={16} /> Novo Abastecimento
          </button>
        </div>
      </div>

      {/* QR Import Modal */}
      {showImport && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Importar Cupom Fiscal (NFC-e)</h3>
              <button onClick={() => setShowImport(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
                <X size={18} />
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <button
                className={importMode === 'camera' ? styles.btnPrimary : styles.btnSecondary}
                style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                onClick={() => { setCameraError(''); setImportMode('camera'); }}
              >
                <Camera size={14} style={{ marginRight: '4px' }} /> Câmera
              </button>
              <button
                className={importMode === 'file' ? styles.btnPrimary : styles.btnSecondary}
                style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                onClick={() => { setCameraError(''); setImportMode('file'); }}
              >
                <Upload size={14} style={{ marginRight: '4px' }} /> Imagem
              </button>
              <button
                className={importMode === 'paste' ? styles.btnPrimary : styles.btnSecondary}
                style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                onClick={() => { setCameraError(''); setImportMode('paste'); }}
              >
                <ClipboardPaste size={14} style={{ marginRight: '4px' }} /> Colar HTML
              </button>
            </div>

            {importMode === 'camera' && (
              <div style={{ textAlign: 'center' }}>
                {cameraError ? (
                  <div style={{ padding: '1.25rem', borderRadius: '10px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', color: '#991b1b', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    <AlertCircle size={20} style={{ marginBottom: '0.5rem' }} /><br />
                    {cameraError}
                    <br />
                    <button
                      style={{ marginTop: '0.75rem', padding: '4px 14px', borderRadius: '6px', border: '1px solid #991b1b', background: 'none', color: '#991b1b', cursor: 'pointer', fontSize: '0.8rem' }}
                      onClick={() => { setCameraError(''); setScanStatus('scanning'); setImportMode('camera'); }}
                    >
                      Tentar novamente
                    </button>
                  </div>
                ) : scanStatus === 'processing' ? (
                  <div style={{ padding: '2rem', color: 'var(--primary-color)', fontWeight: 600 }}>
                    <div className="spinner" style={{ margin: '0 auto 0.75rem' }} />
                    QR detectado! Buscando dados na Sefaz...
                  </div>
                ) : (
                  <>
                    <div id="qr-reader" style={{ width: '100%', maxWidth: '400px', margin: '0 auto', borderRadius: '12px', overflow: 'hidden', border: 'none' }}></div>
                    <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-medium)' }}>
                      Aponte a câmera para o QR Code do cupom fiscal. Centralize o código no quadro verde.
                    </p>
                  </>
                )}
              </div>
            )}

            {importMode === 'file' && (
              <div style={{ textAlign: 'center', padding: '2rem', border: '2px dashed var(--border-color)', borderRadius: '12px' }}>
                <input type="file" id="qr-file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
                <label htmlFor="qr-file" style={{ cursor: 'pointer' }}>
                  <Upload size={40} color="var(--text-light)" style={{ marginBottom: '1rem' }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>Clique para selecionar a foto do QR Code</p>
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-light)' }}>Ou tire uma foto agora</p>
                </label>
                <div id="qr-reader-hidden" style={{ display: 'none' }}></div>
              </div>
            )}

            {importMode === 'paste' && (
              <>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-medium)', marginBottom: '1rem' }}>
                  Cole o conteúdo HTML da página de consulta da Sefaz-SP abaixo.
                </p>
                <textarea
                  className={styles.textarea}
                  placeholder="Cole o HTML aqui..."
                  rows={8}
                  value={importHtml}
                  onChange={e => setImportHtml(e.target.value)}
                  style={{ marginBottom: '1.25rem', fontFamily: 'monospace', fontSize: '0.75rem' }}
                />
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button className={styles.btnPrimary} onClick={() => handleImport({ html: importHtml })} disabled={importing || !importHtml.trim()}>
                    {importing ? 'Processando...' : 'Processar e Preencher'}
                  </button>
                </div>
              </>
            )}

            {importing && (
              <div style={{ marginTop: '1rem', textAlign: 'center', color: 'var(--primary-color)', fontWeight: 600 }}>
                <div className="spinner" style={{ margin: '0 auto 0.5rem' }} />
                Buscando dados na Sefaz...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inline Form */}
      {showForm && (
        <div className={styles.formCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0 }}>{editId ? 'Editar Abastecimento' : 'Novo Abastecimento'}</h3>
            <button onClick={closeForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
              <X size={18} />
            </button>
          </div>

          {importResult && (
            <div style={{ 
              marginBottom: '1.5rem', 
              padding: '0.75rem', 
              borderRadius: '8px', 
              background: importResult.carFound ? 'rgba(11, 165, 43, 0.1)' : 'rgba(234, 179, 8, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              fontSize: '0.875rem',
              color: importResult.carFound ? 'var(--primary-color)' : '#854d0e',
              border: `1px solid ${importResult.carFound ? 'var(--primary-color)' : '#ca8a04'}33`
            }}>
              {importResult.carFound ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <div>
                <strong>Cupom lido com sucesso!</strong><br />
                Posto: {importResult.issuer} | Placa: {importResult.plate || 'Não identificada'}<br />
                {!importResult.carFound && "O veículo desta placa não foi encontrado no sistema. Por favor, selecione-o manualmente."}
              </div>
              <button onClick={() => setImportResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>
          )}

          <form onSubmit={handleSave}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Veículo *</label>
                <select className={styles.select} value={form.car_id} onChange={e => handleFormChange('car_id', e.target.value)} required>
                  <option value="">— Selecione —</option>
                  {cars.map(c => <option key={c.id} value={c.id}>{c.make} {c.model} ({c.license_plate})</option>)}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Data *</label>
                <input type="date" className={styles.input} value={form.fuel_date} onChange={e => handleFormChange('fuel_date', e.target.value)} required />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Km no Abastecimento</label>
                <input type="number" min="0" className={styles.input} value={form.fueling_kilometers} onChange={e => handleFormChange('fueling_kilometers', e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Tipo de Combustível</label>
                <select className={styles.select} value={form.fuel_type} onChange={e => handleFormChange('fuel_type', e.target.value)}>
                  {FUEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Litros</label>
                <input type="number" min="0" step="0.001" className={styles.input} value={form.liters_quantity} onChange={e => handleFormChange('liters_quantity', e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Preço por Litro (R$)</label>
                <input type="number" min="0" step="0.001" className={styles.input} value={form.price_per_liter} onChange={e => handleFormChange('price_per_liter', e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Valor Total (R$)</label>
                <input type="number" min="0" step="0.01" className={styles.input} value={form.total_cost} onChange={e => handleFormChange('total_cost', e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Valor Pago (R$)</label>
                <input type="number" min="0" step="0.01" className={styles.input} value={form.fuel_amount} onChange={e => handleFormChange('fuel_amount', e.target.value)} />
              </div>
              <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                <label className={styles.label}>Observação</label>
                <textarea className={styles.textarea} value={form.observation} onChange={e => handleFormChange('observation', e.target.value)} rows={2} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" className={styles.btnSecondary} onClick={closeForm}>Cancelar</button>
              <button type="submit" className={styles.btnPrimary} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className={styles.loadingState}><div className="spinner" /><span>Carregando...</span></div>
      ) : records.length === 0 ? (
        <div className={styles.emptyState}>
          <Fuel size={40} color="var(--border-color)" style={{ marginBottom: '0.75rem' }} />
          <p>Nenhum abastecimento registrado.</p>
          <button className={styles.btnPrimary} onClick={openAdd}><Plus size={16} /> Adicionar Abastecimento</button>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <div className={`${styles.tableScrollX} ${styles.fuelingTableDesktop}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Veículo</th>
                  <th>Tipo</th>
                  <th>Litros</th>
                  <th>R$/L</th>
                  <th>Total (R$)</th>
                  <th>Km</th>
                  <th>Data</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>
                        {getCarLabel(r.car_id)}
                      </span>
                    </td>
                    <td>
                      <span className={styles.statusBadge} style={{ background: 'var(--primary-light)', color: 'var(--primary-color)' }}>
                        {r.fuel_type || '—'}
                      </span>
                    </td>
                    <td>{r.liters_quantity != null ? parseFloat(r.liters_quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}</td>
                    <td>{r.price_per_liter != null ? `R$ ${parseFloat(r.price_per_liter).toLocaleString('pt-BR', { minimumFractionDigits: 3 })}` : '—'}</td>
                    <td style={{ fontWeight: 600 }}>
                      {r.total_cost != null ? `R$ ${parseFloat(r.total_cost).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td>{r.fueling_kilometers != null ? Number(r.fueling_kilometers).toLocaleString('pt-BR') : '—'}</td>
                    <td>{fmtDate(r.fuel_date)}</td>
                    <td>
                      <div className={styles.actionBtns}>
                        <button className="primary" onClick={() => openEdit(r)} title="Editar"><Pencil size={15} /></button>
                        <button className="danger" onClick={() => setDeleteTarget(r)} title="Excluir"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list — shows every field per abastecimento without horizontal scrolling */}
          <div className={styles.fuelingCardList}>
            {records.map(r => (
              <div key={r.id} className={styles.fuelingCard}>
                <div className={styles.fuelingCardHeader}>
                  <div className={styles.fuelingCardVehicle}>{getCarLabel(r.car_id)}</div>
                  <div className={styles.actionBtns}>
                    <button className="primary" onClick={() => openEdit(r)} title="Editar"><Pencil size={15} /></button>
                    <button className="danger" onClick={() => setDeleteTarget(r)} title="Excluir"><Trash2 size={15} /></button>
                  </div>
                </div>

                <div className={styles.fuelingCardTop}>
                  <span className={styles.statusBadge} style={{ background: 'var(--primary-light)', color: 'var(--primary-color)' }}>
                    {r.fuel_type || '—'}
                  </span>
                  <span className={styles.statusCardMuted}>{fmtDate(r.fuel_date)}</span>
                </div>

                <div className={styles.statusCardMetrics}>
                  <div className={styles.statusCardMetric}>
                    <span className={styles.statusCardLabel}>Litros</span>
                    <span className={styles.statusCardValue}>
                      {r.liters_quantity != null ? parseFloat(r.liters_quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}
                    </span>
                  </div>
                  <div className={styles.statusCardMetric}>
                    <span className={styles.statusCardLabel}>R$/L</span>
                    <span className={styles.statusCardValue}>
                      {r.price_per_liter != null ? `R$ ${parseFloat(r.price_per_liter).toLocaleString('pt-BR', { minimumFractionDigits: 3 })}` : '—'}
                    </span>
                  </div>
                  <div className={styles.statusCardMetric}>
                    <span className={styles.statusCardLabel}>Total</span>
                    <span className={styles.statusCardValue}>
                      {r.total_cost != null ? `R$ ${parseFloat(r.total_cost).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                    </span>
                  </div>
                  <div className={styles.statusCardMetric}>
                    <span className={styles.statusCardLabel}>Km</span>
                    <span className={styles.statusCardValue}>
                      {r.fueling_kilometers != null ? Number(r.fueling_kilometers).toLocaleString('pt-BR') : '—'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button className={styles.paginationBtn} disabled={page === 1} onClick={() => setPage(1)}>«</button>
              <button className={styles.paginationBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`${styles.paginationBtn} ${page === p ? styles.paginationBtnActive : ''}`}
                  >{p}</button>
                );
              })}
              <button className={styles.paginationBtn} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
              <button className={styles.paginationBtn} disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
            </div>
          )}
        </div>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 style={{ marginBottom: '0.75rem' }}>Confirmar exclusão</h3>
            <p style={{ color: 'var(--text-medium)', marginBottom: 0 }}>
              Deseja excluir este registro de abastecimento? Esta ação não pode ser desfeita.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setDeleteTarget(null)}>Cancelar</button>
              <button className={styles.btnDanger} onClick={handleDelete}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FleetFueling;
