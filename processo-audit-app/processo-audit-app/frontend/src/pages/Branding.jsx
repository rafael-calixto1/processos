import React, { useState, useEffect } from 'react';
import { brandingAPI } from '../api/index';
import { useBranding } from '../context/BrandingContext';
import styles from './Branding.module.css';

const Branding = () => {
  const [formData, setFormData] = useState({
    company_name: '',
    logo_url: '',
    primary_color: '#0ba52b',
    secondary_color: '#bbf804',
    accent_color: '#274518',
    background_color: '#ffffff',
    favicon_url: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { branding, fetchBranding } = useBranding();

  useEffect(() => {
    loadBranding();
  }, []);

  const loadBranding = async () => {
    try {
      setLoading(true);
      const data = await brandingAPI.get();
      if (data) {
        setFormData({
          company_name: data.company_name || '',
          logo_url: data.logo_url || '',
          primary_color: data.primary_color || '#0ba52b',
          secondary_color: data.secondary_color || '#bbf804',
          accent_color: data.accent_color || '#274518',
          background_color: data.background_color || '#ffffff',
          favicon_url: data.favicon_url || ''
        });
      }
    } catch (err) {
      setError('Erro ao carregar branding');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleFileUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;

    const isLogo = field === 'logo_url';
    if (isLogo) setUploadingLogo(true);
    else setUploadingFavicon(true);
    
    setError('');

    const uploadFormData = new FormData();
    uploadFormData.append('image', file);

    try {
      const { url } = await brandingAPI.uploadImage(uploadFormData);
      setFormData(prev => ({ ...prev, [field]: url }));
      setSuccess(`${isLogo ? 'Logo' : 'Favicon'} carregado com sucesso!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(`Erro ao carregar ${isLogo ? 'logo' : 'favicon'}: ` + err.message);
    } finally {
      if (isLogo) setUploadingLogo(false);
      else setUploadingFavicon(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await brandingAPI.update(formData);
      setSuccess('Branding atualizado com sucesso!');
      await fetchBranding();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Erro ao salvar branding: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className="spinner" />
        <p>Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1>Configurações de Branding</h1>
      <p className={styles.subtitle}>
        Customize a identidade visual da sua empresa
      </p>

      {error && <div className={styles.alert}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Seção de Informações Básicas */}
        <div className={styles.section}>
          <h2>Informações Básicas</h2>
          
          <div className={styles.formGroup}>
            <label htmlFor="company_name">Nome da Empresa *</label>
            <input
              id="company_name"
              type="text"
              name="company_name"
              value={formData.company_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="logo_url">Logo</label>
            <div className={styles.uploadWrapper}>
              <input
                id="logo_url"
                type="text"
                name="logo_url"
                value={formData.logo_url}
                onChange={handleChange}
                placeholder="https://exemplo.com/logo.png ou faça upload"
              />
              <label className={styles.uploadBtn}>
                {uploadingLogo ? 'Enviando...' : 'Fazer Upload'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'logo_url')}
                  disabled={uploadingLogo}
                  hidden
                />
              </label>
            </div>
            {formData.logo_url && (
              <div className={styles.preview}>
                <img src={formData.logo_url} alt="Preview do Logo" />
              </div>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="favicon_url">Favicon</label>
            <div className={styles.uploadWrapper}>
              <input
                id="favicon_url"
                type="text"
                name="favicon_url"
                value={formData.favicon_url}
                onChange={handleChange}
                placeholder="https://exemplo.com/favicon.ico ou faça upload"
              />
              <label className={styles.uploadBtn}>
                {uploadingFavicon ? 'Enviando...' : 'Fazer Upload'}
                <input
                  type="file"
                  accept=".ico,image/*"
                  onChange={(e) => handleFileUpload(e, 'favicon_url')}
                  disabled={uploadingFavicon}
                  hidden
                />
              </label>
            </div>
            {formData.favicon_url && (
              <div className={styles.preview}>
                <img src={formData.favicon_url} alt="Preview do Favicon" style={{ width: '32px', height: '32px' }} />
              </div>
            )}
          </div>
        </div>

        {/* Seção de Cores */}
        <div className={styles.section}>
          <h2>Paleta de Cores</h2>

          <div className={styles.colorGrid}>
            <div className={styles.colorGroup}>
              <label htmlFor="primary_color">Cor Primária</label>
              <div className={styles.colorInputWrapper}>
                <input
                  id="primary_color"
                  type="color"
                  name="primary_color"
                  value={formData.primary_color}
                  onChange={handleChange}
                />
                <input
                  type="text"
                  value={formData.primary_color}
                  onChange={(e) =>
                    setFormData({ ...formData, primary_color: e.target.value })
                  }
                  placeholder="#0ba52b"
                />
              </div>
              <p className={styles.colorDescription}>
                Cor principal da interface
              </p>
              <div
                className={styles.colorPreview}
                style={{ backgroundColor: formData.primary_color }}
              />
            </div>

            <div className={styles.colorGroup}>
              <label htmlFor="secondary_color">Cor Secundária</label>
              <div className={styles.colorInputWrapper}>
                <input
                  id="secondary_color"
                  type="color"
                  name="secondary_color"
                  value={formData.secondary_color}
                  onChange={handleChange}
                />
                <input
                  type="text"
                  value={formData.secondary_color}
                  onChange={(e) =>
                    setFormData({ ...formData, secondary_color: e.target.value })
                  }
                  placeholder="#bbf804"
                />
              </div>
              <p className={styles.colorDescription}>
                Cor de destaque e acentos
              </p>
              <div
                className={styles.colorPreview}
                style={{ backgroundColor: formData.secondary_color }}
              />
            </div>

            <div className={styles.colorGroup}>
              <label htmlFor="accent_color">Cor de Acento</label>
              <div className={styles.colorInputWrapper}>
                <input
                  id="accent_color"
                  type="color"
                  name="accent_color"
                  value={formData.accent_color}
                  onChange={handleChange}
                />
                <input
                  type="text"
                  value={formData.accent_color}
                  onChange={(e) =>
                    setFormData({ ...formData, accent_color: e.target.value })
                  }
                  placeholder="#274518"
                />
              </div>
              <p className={styles.colorDescription}>
                Cor de contraste escuro
              </p>
              <div
                className={styles.colorPreview}
                style={{ backgroundColor: formData.accent_color }}
              />
            </div>

            <div className={styles.colorGroup}>
              <label htmlFor="background_color">Cor de Fundo</label>
              <div className={styles.colorInputWrapper}>
                <input
                  id="background_color"
                  type="color"
                  name="background_color"
                  value={formData.background_color}
                  onChange={handleChange}
                />
                <input
                  type="text"
                  value={formData.background_color}
                  onChange={(e) =>
                    setFormData({ ...formData, background_color: e.target.value })
                  }
                  placeholder="#ffffff"
                />
              </div>
              <p className={styles.colorDescription}>
                Cor principal de fundo
              </p>
              <div
                className={styles.colorPreview}
                style={{ 
                  backgroundColor: formData.background_color,
                  border: '2px solid #ddd'
                }}
              />
            </div>
          </div>
        </div>

        {/* Preview da Interface */}
        <div className={styles.section}>
          <h2>Preview</h2>
          <div
            className={styles.previewCard}
            style={{
              backgroundColor: formData.background_color,
              '--primary': formData.primary_color,
              '--secondary': formData.secondary_color,
              '--accent': formData.accent_color
            }}
          >
            <div
              className={styles.previewHeader}
              style={{ backgroundColor: formData.primary_color }}
            >
              <span style={{ color: 'white' }}>
                {formData.company_name || 'Empresa'}
              </span>
            </div>
            <div className={styles.previewContent}>
              <button
                className={styles.previewBtn}
                style={{
                  backgroundColor: formData.primary_color,
                  color: 'white'
                }}
              >
                Botão Primário
              </button>
              <button
                className={styles.previewBtn}
                style={{
                  backgroundColor: formData.secondary_color,
                  color: formData.accent_color
                }}
              >
                Botão Secundário
              </button>
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className={styles.actions}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
          <button
            type="button"
            onClick={loadBranding}
            className="btn btn-outline"
            disabled={saving}
          >
            Descartar
          </button>
        </div>
      </form>
    </div>
  );
};

export default Branding;
