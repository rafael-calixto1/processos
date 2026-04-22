import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import styles from './Auth.module.css';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, login } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('As senhas não correspondem');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      await register(email, password, name);
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
          Criar Conta
        </h1>
        <p className={styles.subtitle}>
          {branding?.company_name || 'Processo Audit'}
        </p>

        {error && (
          <div className={styles.alert}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="name">Nome Completo</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu Nome"
              required
            />
          </div>

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

          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword">Confirmar Senha</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {loading ? 'Criando conta...' : 'Criar Conta'}
          </button>
        </form>

        <p className={styles.footer}>
          Já tem conta? <Link to="/login">Faça login aqui</Link>
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

export default Register;
