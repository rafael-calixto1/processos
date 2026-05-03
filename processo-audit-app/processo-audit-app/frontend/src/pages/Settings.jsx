import React, { useState } from 'react';
import { authAPI } from '../api/index';
import styles from './Settings.module.css';
import { FiLock, FiCheck, FiAlertCircle } from 'react-icons/fi';

const Settings = () => {
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPasswords({ ...passwords, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwords.newPassword !== passwords.confirmPassword) {
      setError('A nova senha e a confirmação não coincidem.');
      return;
    }

    if (passwords.newPassword.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      await authAPI.changePassword(passwords.currentPassword, passwords.newPassword);
      setSuccess('Senha alterada com sucesso!');
      setPasswords({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.message || 'Erro ao alterar a senha. Verifique sua senha atual.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1>Configurações da Conta</h1>
      <p className={styles.subtitle}>Gerencie sua conta e segurança</p>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <FiLock className={styles.icon} />
          <h2>Alterar Senha</h2>
        </div>
        
        {error && (
          <div className={styles.error}>
            <FiAlertCircle /> {error}
          </div>
        )}
        {success && (
          <div className={styles.success}>
            <FiCheck /> {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="currentPassword">Senha Atual</label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              value={passwords.currentPassword}
              onChange={handleChange}
              required
              placeholder="Digite sua senha atual"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="newPassword">Nova Senha</label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              value={passwords.newPassword}
              onChange={handleChange}
              required
              placeholder="Digite a nova senha"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword">Confirmar Nova Senha</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={passwords.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Repita a nova senha"
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
          >
            {loading ? 'Alterando...' : 'Atualizar Senha'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Settings;
