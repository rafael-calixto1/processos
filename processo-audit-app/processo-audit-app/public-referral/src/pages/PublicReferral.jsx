import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { referralAPI } from '../api';
import styles from './PublicReferral.module.css';

const PublicReferral = ({ branding }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const referrerCodeFromUrl = searchParams.get('ref');
  const servicoFromUrl = searchParams.get('s') ? Number(searchParams.get('s')) : null;

  // Modes: 'landing', 'check', 'indication'
  const [mode, setMode] = useState(referrerCodeFromUrl ? 'indication' : 'landing');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  // Referrer check state
  const [cpfCheck, setCpfCheck] = useState('');
  const [referrerInfo, setReferrerInfo] = useState(null);
  const [selectedServico, setSelectedServico] = useState(servicoFromUrl);
  const [myIndications, setMyIndications] = useState([]);
  const [activeTab, setActiveTab] = useState('link'); // 'link' ou 'results'

  // Indication form state
  const [formData, setFormData] = useState({
    referrer_code: referrerCodeFromUrl || '',
    nome: '',
    cpf: '',
    telefone: '',
    email: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: 'MG'
  });

  // CEP state
  const [cep, setCep] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [cepStatus, setCepStatus] = useState(null); // null | 'ok' | 'error'

  useEffect(() => {
    if (referrerCodeFromUrl) {
      setMode('indication');
      setFormData(prev => ({ ...prev, referrer_code: referrerCodeFromUrl }));
    }
  }, [referrerCodeFromUrl]);

  const handleCepChange = async (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 8);
    const formatted = raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw;
    setCep(formatted);
    setCepStatus(null);
    if (raw.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      const data = await res.json();
      if (data.erro) { setCepStatus('error'); return; }
      setFormData(prev => ({
        ...prev,
        endereco: data.logradouro || prev.endereco,
        bairro: data.bairro || prev.bairro,
        cidade: data.localidade || prev.cidade,
        estado: data.uf || prev.estado,
      }));
      setCepStatus('ok');
    } catch {
      setCepStatus('error');
    } finally {
      setCepLoading(false);
    }
  };

  const handleCheckReferrer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await referralAPI.getReferrerInfo(cpfCheck);
      setReferrerInfo(data);
      // Auto-select the active service (or the first one if only one)
      const servicos = data.servicos ?? [];
      const activeServico = servicos.find(s => s.status_prefixo === 'servico_habilitado') ?? servicos[0];
      setSelectedServico(activeServico?.id_cliente_servico ?? null);
      const indicationsData = await referralAPI.getMyIndications(cpfCheck);
      setMyIndications(indicationsData.indicacoes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshIndications = async () => {
    if (!cpfCheck) return;
    try {
      const indicationsData = await referralAPI.getMyIndications(cpfCheck);
      setMyIndications(indicationsData.indicacoes);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegisterIndication = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await referralAPI.registerIndication({
        ...formData,
        id_cliente_servico: selectedServico ?? servicoFromUrl ?? undefined,
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const buildShareUrl = () => {
    let url = `${window.location.origin}/?ref=${referrerInfo.codigo_cliente}`;
    if (selectedServico) url += `&s=${selectedServico}`;
    return url;
  };

  const copyToClipboard = () => {
    const url = buildShareUrl();
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(() => {
        alert('Link copiado para a área de transferência!');
      });
    } else {
      const el = document.createElement('textarea');
      el.value = url;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      alert('Link copiado para a área de transferência!');
    }
  };

  const resetMode = () => {
    setMode('landing');
    setReferrerInfo(null);
    setSelectedServico(null);
    setMyIndications([]);
    setSearchParams({});
    setFormData(prev => ({ ...prev, referrer_code: '' }));
  };

  if (success) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.success}>
            <div className={styles.successIcon}>
              <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className={styles.title}>Tudo pronto!</h2>
            <p className={styles.subtitle}>
              Seu cadastro foi realizado com sucesso. Nossa equipe entrará em contato em breve para dar continuidade ao seu atendimento.
            </p>
            <button className={styles.btnSubmit} onClick={() => window.location.href = '/'}>
              Voltar ao Início
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={styles.page}
      style={{ backgroundColor: branding?.background_color }}
    >
      <div className={styles.card}>
        <div className={styles.header}>
          {branding?.logo_url ? (
            <img src={branding.logo_url.startsWith('http') ? branding.logo_url : `http://localhost:5002${branding.logo_url}`} alt="Logo" style={{ height: '60px', margin: '0 auto 16px', objectFit: 'contain' }} />
          ) : (
            <div className={styles.icon}>
              <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
            </div>
          )}
          <h1 className={styles.title}>{branding?.company_name || 'Indique e Ganhe'}</h1>
          <p className={styles.subtitle}>
            Escolha uma das opções abaixo para continuar.
          </p>
        </div>

        {mode === 'landing' && (
          <div className={styles.selectionGrid}>
            <div className={styles.selectionBtn} onClick={() => setMode('check')}>
              <div className={styles.selectionBtnIcon}>
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3>Já sou cliente</h3>
              <p>Gerar meu link ou ver meus resultados</p>
            </div>
            <div className={styles.selectionBtn} onClick={() => setMode('indication')}>
              <div className={styles.selectionBtnIcon}>
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h3>Fui indicado</h3>
              <p>Ganhar desconto e contratar um plano</p>
            </div>
          </div>
        )}

        {mode !== 'landing' && !success && (
          <button className={styles.btnBack} onClick={resetMode}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Voltar
          </button>
        )}

        {mode === 'check' && referrerInfo && (
          <div className={styles.tabButtons}>
            <button 
              className={`${styles.tabButton} ${activeTab === 'link' ? styles.tabButtonActive : ''}`}
              onClick={() => setActiveTab('link')}
              style={{ 
                color: activeTab === 'link' ? (branding?.primary_color || '#0ba52b') : '', 
                borderBottomColor: activeTab === 'link' ? (branding?.primary_color || '#0ba52b') : '' 
              }}
            >
              Meu Link
            </button>
            <button 
              className={`${styles.tabButton} ${activeTab === 'results' ? styles.tabButtonActive : ''}`}
              onClick={() => { setActiveTab('results'); refreshIndications(); }}
              style={{ 
                color: activeTab === 'results' ? (branding?.primary_color || '#0ba52b') : '', 
                borderBottomColor: activeTab === 'results' ? (branding?.primary_color || '#0ba52b') : '' 
              }}
            >
              Meus Resultados
            </button>
          </div>
        )}

        {mode === 'check' && !referrerInfo && (
          <form className={styles.form} onSubmit={handleCheckReferrer}>
            <div className={styles.formGroup}>
              <label>Seu CPF (para gerar seu link)</label>
              <input 
                type="text" 
                placeholder="000.000.000-00"
                value={cpfCheck}
                onChange={(e) => setCpfCheck(e.target.value)}
                required
              />
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <button 
              type="submit" 
              className={styles.btnSubmit} 
              disabled={loading}
              style={{ backgroundColor: branding?.primary_color || '#0ba52b' }}
            >
              {loading ? 'Consultando...' : 'Acessar meu painel'}
            </button>
          </form>
        )}

        {referrerInfo && activeTab === 'link' && (
          <div className={styles.success}>
            <h2 className={styles.title}>Olá, {referrerInfo.nome}!</h2>
            <p className={styles.subtitle}>Seu código de indicação foi gerado. Compartilhe o link abaixo com seus amigos:</p>

            {(referrerInfo.servicos ?? []).length > 1 && (
              <div className={styles.servicoSelector}>
                <label className={styles.servicoSelectorLabel}>
                  Plano que receberá o desconto da indicação:
                </label>
                <div className={styles.servicoOptions}>
                  {referrerInfo.servicos.map(s => (
                    <label
                      key={s.id_cliente_servico}
                      className={`${styles.servicoOption} ${selectedServico === s.id_cliente_servico ? styles.servicoOptionActive : ''}`}
                      style={selectedServico === s.id_cliente_servico ? { borderColor: branding?.primary_color || '#0ba52b', background: branding?.primary_light || '#ecfdf5' } : {}}
                    >
                      <input
                        type="radio"
                        name="servico_link"
                        checked={selectedServico === s.id_cliente_servico}
                        onChange={() => setSelectedServico(s.id_cliente_servico)}
                      />
                      <div className={styles.servicoOptionBody}>
                        <span className={styles.servicoOptionName}>({s.numero_plano}) {s.nome}</span>
                        <span className={styles.servicoOptionMeta}>
                          R$ {parseFloat(s.valor).toFixed(2).replace('.', ',')} · {s.status}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {(referrerInfo.servicos ?? []).length === 1 && (
              <div className={styles.servicoInfo} style={{ borderColor: branding?.primary_color || '#0ba52b', color: branding?.primary_color || '#0ba52b' }}>
                Plano: <strong>({referrerInfo.servicos[0].numero_plano}) {referrerInfo.servicos[0].nome}</strong> — R$ {parseFloat(referrerInfo.servicos[0].valor).toFixed(2).replace('.', ',')}
              </div>
            )}

            <div className={styles.shareBox}>
              <span className={styles.shareTitle}>Seu Link Exclusivo</span>
              <div className={styles.shareLink}>
                {buildShareUrl()}
              </div>
              <button className={styles.btnCopy} onClick={copyToClipboard}>
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copiar Link
              </button>
            </div>
          </div>
        )}

        {referrerInfo && activeTab === 'results' && (
          <div className={styles.results}>
            <h2 className={styles.title} style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Minhas Indicações</h2>
            <p className={styles.subtitle}>Acompanhe o status das pessoas que você indicou:</p>
            
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Status</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {myIndications.length === 0 ? (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', padding: '24px', color: '#a0aec0' }}>
                        Você ainda não possui indicações.
                      </td>
                    </tr>
                  ) : (
                    myIndications.map((ind, i) => (
                      <tr key={i}>
                        <td>{ind.nome_indicado}</td>
                        <td>
                          <span className={`${styles.badge} ${styles['status_' + ind.status]}`}>
                            {ind.status === 'ativo' ? 'Ativo' :
                             ind.status === 'cancelado' ? 'Cancelado' : 'Pendente'}
                          </span>
                        </td>
                        <td>{new Date(ind.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            <button 
              className={styles.btnSecondary} 
              onClick={refreshIndications}
              style={{ marginTop: '16px', fontSize: '0.85rem', color: branding?.primary_color, border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Atualizar Lista
            </button>
          </div>
        )}

        {mode === 'indication' && (
          <form className={styles.form} onSubmit={handleRegisterIndication}>
            <div className={styles.indicatedBy} style={{ background: branding?.primary_light || '#ecfdf5', color: branding?.primary_color || '#0ba52b' }}>
              Você está a um passo de ganhar vantagens exclusivas!
            </div>

            {!referrerCodeFromUrl && (
              <div className={styles.formGroup}>
                <label>Código do seu Amigo (ID de Indicação)</label>
                <input 
                  type="text" 
                  placeholder="Ex: 1234"
                  value={formData.referrer_code}
                  onChange={(e) => setFormData({...formData, referrer_code: e.target.value})}
                  required
                />
              </div>
            )}
            
            <div className={styles.formGroup}>
              <label>Nome Completo</label>
              <input 
                type="text" 
                value={formData.nome}
                onChange={(e) => setFormData({...formData, nome: e.target.value})}
                required
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>CPF</label>
                <input 
                  type="text" 
                  value={formData.cpf}
                  onChange={(e) => setFormData({...formData, cpf: e.target.value})}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Telefone</label>
                <input 
                  type="text" 
                  value={formData.telefone}
                  onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>
                CEP <span className={styles.optional}>(opcional)</span>
              </label>
              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  placeholder="00000-000"
                  value={cep}
                  onChange={handleCepChange}
                  maxLength={9}
                />
                {cepLoading && <span className={styles.inputSpinner} />}
                {!cepLoading && cepStatus === 'ok' && (
                  <span className={styles.inputCheck}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </div>
              {cepStatus === 'error' && (
                <span className={styles.cepError}>CEP não encontrado. Preencha o endereço manualmente.</span>
              )}
              {cepStatus === 'ok' && (
                <span className={styles.cepSuccess}>Endereço preenchido automaticamente!</span>
              )}
            </div>

            <div className={styles.formGroup}>
              <label>Logradouro</label>
              <input
                type="text"
                placeholder="Rua, Avenida, Travessa..."
                value={formData.endereco}
                onChange={(e) => setFormData({...formData, endereco: e.target.value})}
                required
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Número</label>
                <input
                  type="text"
                  placeholder="Ex: 123"
                  value={formData.numero}
                  onChange={(e) => setFormData({...formData, numero: e.target.value})}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>
                  Complemento <span className={styles.optional}>(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Apto, Bloco, Casa..."
                  value={formData.complemento}
                  onChange={(e) => setFormData({...formData, complemento: e.target.value})}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Bairro</label>
              <input
                type="text"
                value={formData.bairro}
                onChange={(e) => setFormData({...formData, bairro: e.target.value})}
                required
              />
            </div>

            <div className={styles.formRow} style={{ gridTemplateColumns: '2fr 1fr' }}>
              <div className={styles.formGroup}>
                <label>Cidade</label>
                <input
                  type="text"
                  value={formData.cidade}
                  onChange={(e) => setFormData({...formData, cidade: e.target.value})}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Estado</label>
                <input
                  type="text"
                  placeholder="MG"
                  maxLength={2}
                  value={formData.estado}
                  onChange={(e) => setFormData({...formData, estado: e.target.value.toUpperCase()})}
                  required
                />
              </div>
            </div>

            {error && <div className={styles.error}>{error}</div>}
            
            <button 
              type="submit" 
              className={styles.btnSubmit} 
              disabled={loading}
              style={{ backgroundColor: branding?.primary_color || '#0ba52b' }}
            >
              {loading ? 'Processando...' : 'Quero ganhar meu desconto'}
            </button>
          </form>
        )}
      </div>

      <div className={styles.footer} style={{ textAlign: 'center', marginTop: '24px', color: '#a0aec0', fontSize: '0.8rem' }}>
        © {new Date().getFullYear()} {branding?.company_name || 'Sua Empresa'}. Todos os direitos reservados.
      </div>
    </div>
  );
};

export default PublicReferral;
