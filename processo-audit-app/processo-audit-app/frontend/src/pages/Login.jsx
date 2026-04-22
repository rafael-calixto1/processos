import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import styles from './Auth.module.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className={styles.container}
      style={{ backgroundColor: branding?.background_color || '#ffffff' }}
    >
      <div className={styles.card}>
        {branding?.logo_url && (
          <img src={branding.logo_url} alt="Logo" className={styles.logo} />
        )}
        
        <h1 className={styles.title}>
          {branding?.company_name || 'Processo Audit'}
        </h1>
        <p className={styles.subtitle}>Sistema de Gerenciamento de Processos</p>

        {error && (
          <div className={styles.alert}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={styles.submitBtn}
            style={{ backgroundColor: branding?.primary_color || '#0ba52b' }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className={styles.footer}>
          Não tem conta? <Link to="/register">Registre-se aqui</Link>
        </p>
      </div>

      <div className={styles.background}>
        <div 
          className={styles.blob1}
          style={{ backgroundColor: branding?.primary_color || '#0ba52b' }}
        />
        <div 
          className={styles.blob2}
          style={{ backgroundColor: branding?.secondary_color || '#bbf804' }}
        />
        <div 
          className={styles.blob3}
          style={{ backgroundColor: branding?.accent_color || '#274518' }}
        />
      </div>
    </div>
  );
};

export default Login;
