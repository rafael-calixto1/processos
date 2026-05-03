import React, { useState, useEffect } from 'react';
import { authAPI } from '../api/index';
import styles from './Users.module.css';
import { FiPlus, FiTrash2, FiEdit2, FiCheck, FiX, FiUserPlus } from 'react-icons/fi';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // State for new user form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'viewer'
  });

  // State for editing
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({
    name: '',
    role: '',
    password: ''
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await authAPI.listUsers();
      setUsers(data);
    } catch (err) {
      setError('Erro ao carregar usuários: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await authAPI.createUser(newUser);
      setSuccess('Usuário criado com sucesso!');
      setNewUser({ name: '', email: '', password: '', role: 'viewer' });
      setShowAddForm(false);
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Erro ao criar usuário: ' + err.message);
    }
  };

  const handleUpdateUser = async (id) => {
    try {
      await authAPI.updateUser(id, editData);
      setSuccess('Usuário atualizado com sucesso!');
      setEditingId(null);
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Erro ao atualizar usuário: ' + err.message);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este usuário?')) return;
    try {
      await authAPI.deleteUser(id);
      setSuccess('Usuário excluído!');
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Erro ao excluir usuário: ' + err.message);
    }
  };

  const startEditing = (user) => {
    setEditingId(user.id);
    setEditData({
      name: user.name,
      role: user.role,
      password: ''
    });
  };

  if (loading && users.length === 0) {
    return <div className="spinner-container"><div className="spinner" /></div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>Gerenciamento de Usuários</h1>
          <p>Adicione e gerencie os membros da equipe e seus níveis de acesso.</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? <><FiX /> Cancelar</> : <><FiUserPlus /> Novo Usuário</>}
        </button>
      </header>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      {showAddForm && (
        <div className={styles.addFormCard}>
          <h3>Cadastrar Novo Usuário</h3>
          <form onSubmit={handleCreateUser} className={styles.form}>
            <div className={styles.formGroup}>
              <label>Nome Completo</label>
              <input 
                type="text" 
                value={newUser.name}
                onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Email</label>
              <input 
                type="email" 
                value={newUser.email}
                onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Senha Provisória</label>
              <input 
                type="password" 
                value={newUser.password}
                onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Papel / Acesso</label>
              <select 
                value={newUser.role}
                onChange={(e) => setNewUser({...newUser, role: e.target.value})}
              >
                <option value="viewer">Visualizador</option>
                <option value="manager">Gestor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className={styles.formActions}>
              <button type="submit" className="btn btn-primary">Salvar Usuário</button>
            </div>
          </form>
        </div>
      )}

      <div className={styles.usersGrid}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Email</th>
              <th>Papel</th>
              <th>Criado em</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>
                  {editingId === user.id ? (
                    <input 
                      type="text" 
                      value={editData.name}
                      onChange={(e) => setEditData({...editData, name: e.target.value})}
                      className={styles.editInput}
                    />
                  ) : user.name}
                </td>
                <td>{user.email}</td>
                <td>
                  {editingId === user.id ? (
                    <select 
                      value={editData.role}
                      onChange={(e) => setEditData({...editData, role: e.target.value})}
                      className={styles.editInput}
                    >
                      <option value="viewer">Visualizador</option>
                      <option value="manager">Gestor</option>
                      <option value="admin">Administrador</option>
                    </select>
                  ) : (
                    <span className={`${styles.roleBadge} ${styles[user.role]}`}>
                      {user.role}
                    </span>
                  )}
                </td>
                <td>{new Date(user.created_at).toLocaleDateString()}</td>
                <td>
                  <div className={styles.actions}>
                    {editingId === user.id ? (
                      <>
                        <button 
                          onClick={() => handleUpdateUser(user.id)}
                          className={styles.saveBtn}
                          title="Salvar"
                        >
                          <FiCheck />
                        </button>
                        <button 
                          onClick={() => setEditingId(null)}
                          className={styles.cancelBtn}
                          title="Cancelar"
                        >
                          <FiX />
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={() => startEditing(user)}
                          className={styles.editBtn}
                          title="Editar"
                        >
                          <FiEdit2 />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(user.id)}
                          className={styles.deleteBtn}
                          title="Excluir"
                        >
                          <FiTrash2 />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Users;
