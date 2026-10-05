import React, { useState } from 'react';
import { authAPI } from '../api/index';
import styles from './Settings.module.css';
import { FiLock, FiCheck, FiAlertCircle, FiEye, FiEyeOff } from 'react-icons/fi';

/* ── Campo de senha com botão de exibir/ocultar ── */
const PasswordField = ({ id, label, value, onChange, placeholder, hint, autoComplete }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.formGroup}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.inputWrap}>
        <input
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          className={styles.toggleBtn}
          onClick={() => setVisible(v => !v)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
          title={visible ? 'Ocultar senha' : 'Mostrar senha'}
        >
          {visible ? <FiEyeOff /> : <FiEye />}
        </button>
      </div>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
};

/* ── Seção: Segurança ── */
const SecuritySection = () => {
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

  const isComplete = Object.values(passwords).every(v => v.trim() !== '');

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
    <>
      {error && (
        <div className={styles.error} role="alert">
          <FiAlertCircle /> {error}
        </div>
      )}
      {success && (
        <div className={styles.success} role="status">
          <FiCheck /> {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        <PasswordField
          id="currentPassword"
          label="Senha Atual"
          value={passwords.currentPassword}
          onChange={handleChange}
          placeholder="Digite sua senha atual"
          autoComplete="current-password"
        />

        <PasswordField
          id="newPassword"
          label="Nova Senha"
          value={passwords.newPassword}
          onChange={handleChange}
          placeholder="Digite a nova senha"
          hint="Use pelo menos 6 caracteres."
          autoComplete="new-password"
        />

        <PasswordField
          id="confirmPassword"
          label="Confirmar Nova Senha"
          value={passwords.confirmPassword}
          onChange={handleChange}
          placeholder="Repita a nova senha"
          autoComplete="new-password"
        />

        <div className={styles.formActions}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !isComplete}
          >
            {loading
              ? <><span className={styles.btnSpinner} aria-hidden="true" /> Alterando...</>
              : 'Atualizar Senha'}
          </button>
        </div>
      </form>
    </>
  );
};

/* Novos grupos (Perfil, Notificações…) entram aqui como mais um item. */
const SETTINGS_SECTIONS = [
  {
    id: 'security',
    title: 'Alterar Senha',
    description: 'Mantenha sua conta protegida atualizando sua senha periodicamente.',
    Icon: FiLock,
    Component: SecuritySection,
  },
];

const Settings = () => (
  <div className={styles.container}>
    <div className={styles.pageHeader}>
      <h1>Configurações da Conta</h1>
      <p className={styles.subtitle}>Gerencie sua conta e segurança</p>
    </div>

    <div className={styles.sections}>
      {SETTINGS_SECTIONS.map(({ id, title, description, Icon, Component }) => (
        <section key={id} className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}><Icon /></span>
            <div className={styles.sectionHeading}>
              <h2>{title}</h2>
              {description && <p className={styles.sectionDesc}>{description}</p>}
            </div>
          </div>
          <Component />
        </section>
      ))}
    </div>
  </div>
);

export default Settings;
