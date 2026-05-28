import React, { useState, useEffect } from 'react';
import { authAPI, departmentAPI } from '../api/index';
import DepartmentSelector from '../components/DepartmentSelector';
import styles from './Users.module.css';
import { FiPlus, FiTrash2, FiEdit2, FiCheck, FiX, FiUserPlus, FiLock } from 'react-icons/fi';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Search and Pagination
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  
  // State for new user form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'viewer',
    department_ids: []
  });

  // State for editing
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({
    name: '',
    role: '',
    password: '',
    department_ids: []
  });

  useEffect(() => {
    loadData();
  }, [currentPage]);

  // Debounced search effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (currentPage === 1) {
        loadData();
      } else {
        setCurrentPage(1); // This will trigger the other useEffect
      }
    }, 700);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersResponse, deptsData] = await Promise.all([
        authAPI.listUsers(search, currentPage),
        departmentAPI.list()
      ]);
      setUsers(usersResponse.users);
      setTotalPages(usersResponse.pages);
      setTotalUsers(usersResponse.total);
      setDepartments(deptsData);
    } catch (err) {
      setError('Erro ao carregar dados: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await authAPI.createUser(newUser);
      setSuccess('Usuário criado com sucesso!');
      setNewUser({ name: '', email: '', password: '', role: 'viewer', department_ids: [] });
      setShowAddForm(false);
      loadData();
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
      loadData();
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
      loadData();
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
      password: '',
      department_ids: user.department_ids || []
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

      <div className={styles.filters}>
        <div className={styles.searchContainer}>
          <input 
            type="text" 
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <div className={styles.stats}>
          Total: <strong>{totalUsers}</strong> usuários
        </div>
      </div>

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
            
            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label>Departamentos com Acesso</label>
              <DepartmentSelector 
                selectedIds={newUser.department_ids}
                allDepartments={departments}
                onChange={(ids) => setNewUser({ ...newUser, department_ids: ids })}
                placeholder="Selecione os departamentos permitidos..."
              />
              <p className={styles.helpText}>Administradores sempre têm acesso a todos os departamentos.</p>
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
              <th>Departamentos</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td data-label="Nome">
                  {editingId === user.id ? (
                    <div className={styles.editStack}>
                      <input 
                        type="text" 
                        value={editData.name}
                        onChange={(e) => setEditData({...editData, name: e.target.value})}
                        className={styles.editInput}
                        placeholder="Nome"
                      />
                      <input 
                        type="password" 
                        value={editData.password}
                        onChange={(e) => setEditData({...editData, password: e.target.value})}
                        className={styles.editInput}
                        placeholder="Nova senha (deixe vazio p/ manter)"
                      />
                    </div>
                  ) : (
                    <div className={styles.userNameCell}>
                      {user.name}
                      <span className={styles.creationDate}>Desde {new Date(user.created_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </td>
                <td data-label="Email">{user.email}</td>
                <td data-label="Papel">
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
                <td data-label="Departamentos">
                  {editingId === user.id ? (
                    <div className={styles.deptEditWrapper}>
                      <DepartmentSelector 
                        selectedIds={editData.department_ids}
                        allDepartments={departments}
                        onChange={(ids) => setEditData({ ...editData, department_ids: ids })}
                      />
                    </div>
                  ) : (
                    <div className={styles.deptBadges}>
                      {user.role === 'admin' ? (
                        <span className={styles.allAccessBadge}>Todos</span>
                      ) : (
                        <>
                          {(user.department_ids || []).slice(0, 2).map(id => {
                            const dept = departments.find(d => d.id === id);
                            return dept ? <span key={id} className={styles.deptBadge}>{dept.name}</span> : null;
                          })}
                          {(user.department_ids || []).length > 2 && (
                            <span className={styles.moreBadge}>
                              +{(user.department_ids || []).length - 2} mais
                            </span>
                          )}
                          {(user.department_ids || []).length === 0 && (
                            <span className={styles.noAccess}>Nenhum</span>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </td>
                <td data-label="Ações">
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

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
            className={styles.pageBtn}
          >
            Anterior
          </button>
          
          <div className={styles.pageInfo}>
            Página <strong>{currentPage}</strong> de {totalPages}
          </div>

          <button 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => prev + 1)}
            className={styles.pageBtn}
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
};

export default Users;
