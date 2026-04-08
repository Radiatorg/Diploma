import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import AdminNavPanel from '../../components/AdminNavPanel/AdminNavPanel';
import Modal from '../../components/UI/Modal';
import Pagination from '../../components/UI/Pagination';
import './Admin.css';

const Users = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ show: false, userId: null, onConfirm: null });
  const [errorModal, setErrorModal] = useState({ show: false, message: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20); // Пользователей на странице

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await adminAPI.getAllUsers();
      setUsers(response.data);
    } catch (err) {
      setError('Ошибка загрузки пользователей');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    // Проверяем, не пытается ли администратор удалить самого себя
    if (currentUser && id === currentUser.id) {
      setErrorModal({ show: true, message: 'Вы не можете удалить самого себя. Обратитесь к другому администратору.' });
      return;
    }
    
    setConfirmModal({
      show: true,
      userId: id,
      onConfirm: async () => {
        try {
          await adminAPI.deleteUser(id);
          loadUsers();
          setConfirmModal({ show: false, userId: null, onConfirm: null });
        } catch (err) {
          setConfirmModal({ show: false, userId: null, onConfirm: null });
          const errorMessage = err.response?.data?.message || 'Ошибка удаления пользователя';
          setErrorModal({ show: true, message: errorMessage });
        }
      }
    });
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const filteredUsers = users.filter(user => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.username?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.firstName?.toLowerCase().includes(query) ||
      user.lastName?.toLowerCase().includes(query) ||
      user.roles?.some(role => role.toLowerCase().includes(query)) ||
      user.id?.toString().includes(query)
    );
  });

  // Сбрасываем страницу при изменении поиска
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Вычисляем пользователей для текущей страницы
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) return <div>Загрузка...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="admin-page fade-in">
      <AdminNavPanel />
      <div className="page-header">
        <h1>Управление пользователями</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          Создать пользователя
        </button>
      </div>
      <div className="admin-search-container">
        <input
          type="text"
          placeholder="Поиск по имени, email, ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="admin-search-input"
        />
      </div>
      {showForm && (
        <UserForm
          user={editingUser}
          onClose={() => {
            setShowForm(false);
            setEditingUser(null);
          }}
          onSuccess={loadUsers}
        />
      )}
      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Имя пользователя</th>
              <th>Email</th>
              <th>Имя</th>
              <th>Фамилия</th>
              <th>Роли</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                  {searchQuery ? 'Пользователи не найдены' : 'Нет пользователей'}
                </td>
              </tr>
            ) : (
              paginatedUsers.map((user) => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td>{user.firstName || '-'}</td>
                <td>{user.lastName || '-'}</td>
                <td>{user.roles?.map(role => role === 'ADMIN' ? 'Admin' : role === 'DESIGNER' ? 'Проектировщик' : role).join(', ') || '-'}</td>
                <td className="actions-cell">
                  <button onClick={() => handleEdit(user)} className="btn-secondary">
                    Редактировать
                  </button>
                  {user.username !== 'admin' && currentUser && user.id !== currentUser.id && (
                    <button onClick={() => handleDelete(user.id)} className="btn-danger">
                      Удалить
                    </button>
                  )}
                  {(user.username === 'admin' || (currentUser && user.id === currentUser.id)) && (
                    <span style={{ color: '#666', fontSize: '0.9rem' }}>
                      {user.username === 'admin' ? 'Нельзя удалить' : 'Нельзя удалить самого себя'}
                    </span>
                  )}
                </td>
              </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {filteredUsers.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(filteredUsers.length / itemsPerPage)}
          onPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          totalItems={filteredUsers.length}
        />
      )}
      
      <Modal
        show={confirmModal.show}
        title="Подтверждение"
        type="confirm"
        onClose={() => setConfirmModal({ show: false, userId: null, onConfirm: null })}
        onConfirm={confirmModal.onConfirm}
        confirmText="Удалить"
        cancelText="Отмена"
      >
        <p>Удалить пользователя?</p>
      </Modal>
      <Modal
        show={errorModal.show}
        title="Ошибка"
        type="info"
        onClose={() => setErrorModal({ show: false, message: '' })}
        cancelText="Ок"
      >
        <p>{errorModal.message}</p>
      </Modal>
    </div>
  );
};

const UserForm = ({ user, onClose, onSuccess }) => {
  const { user: currentUser, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    roles: [],
  });
  const [isAdmin, setIsAdmin] = useState(false); // Переключатель для роли администратора
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Проверяем, является ли редактируемый пользователь текущим администратором
  const isCurrentUser = user && currentUser && user.id === currentUser.id;
  const isCurrentUserAdmin = isCurrentUser && currentUser.roles && currentUser.roles.includes('ADMIN');

  useEffect(() => {
    if (user) {
      const hasAdminRole = user.roles && user.roles.includes('ADMIN');
      setIsAdmin(hasAdminRole);
      setFormData({
        username: user.username || '',
        email: user.email || '',
        password: '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        roles: user.roles ? [...user.roles] : [],
      });
    } else {
      // При создании нового пользователя по умолчанию - проектировщик
      setIsAdmin(false);
      setFormData({
        username: '',
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        roles: ['DESIGNER'],
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleAdminToggle = (checked) => {
    setIsAdmin(checked);
    // Если переключатель включен - роль ADMIN, иначе - DESIGNER
    if (checked) {
      setFormData({
        ...formData,
        roles: ['ADMIN'],
      });
    } else {
      setFormData({
        ...formData,
        roles: ['DESIGNER'],
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Валидация пароля
    if (user && formData.password && formData.password.length < 6) {
      setError('Пароль должен состоять из минимум 6 символов');
      setLoading(false);
      return;
    }
    if (!user && (!formData.password || formData.password.length < 6)) {
      setError('Пароль должен состоять из минимум 6 символов');
      setLoading(false);
      return;
    }

    try {
      const submitData = {
        username: formData.username,
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
      };

      if (user) {
        if (formData.password) {
          submitData.password = formData.password;
        }
        const response = await adminAPI.updateUser(user.id, submitData, formData.roles);
        if (formData.password) {
          alert('Пароль успешно изменен');
        }
        
        // Если обновляется текущий пользователь, обновляем данные в контексте
        if (isCurrentUser && response?.data) {
          const userData = response.data;
          // Преобразуем roles в массив, если это Set
          const rolesArray = userData.roles 
            ? (Array.isArray(userData.roles) ? userData.roles : Array.from(userData.roles))
            : formData.roles;
          
          // Проверяем, изменилась ли роль
          const currentRoles = currentUser.roles || [];
          const newRoles = rolesArray || [];
          const rolesChanged = JSON.stringify([...currentRoles].sort()) !== JSON.stringify([...newRoles].sort());
          
          // Обновляем данные пользователя в контексте
          updateUser({
            ...currentUser, // Сохраняем все существующие поля
            id: userData.id,
            username: userData.username,
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            roles: rolesArray,
            photoUrl: userData.photoUrl,
            phoneNumber: userData.phoneNumber,
            birthDate: userData.birthDate,
            enabled: userData.enabled
          });
          
          // Если роль изменилась, перезагружаем страницу для обновления интерфейса
          if (rolesChanged) {
            setTimeout(() => {
              window.location.reload();
            }, 500);
          }
        }
      } else {
        submitData.password = formData.password;
        await adminAPI.createUser(submitData, formData.roles);
      }
      onSuccess();
      onClose();
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Ошибка сохранения пользователя';
      // Обработка ошибок валидации пароля
      if (errorMessage.includes('Password') || errorMessage.includes('пароль') || errorMessage.includes('password')) {
        if (errorMessage.includes('6') || errorMessage.includes('100')) {
          setError('Пароль должен состоять из минимум 6 символов и максимум 100 символов');
        } else {
          setError(errorMessage);
        }
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{user ? 'Редактировать пользователя' : 'Создать пользователя'}</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Имя пользователя *</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              disabled={!!user}
            />
          </div>
          <div className="form-group">
            <label>Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>{user ? 'Новый пароль (оставьте пустым, чтобы не менять)' : 'Пароль *'}</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required={!user}
            />
          </div>
          <div className="form-group">
            <label>Имя</label>
            <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Фамилия</label>
            <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Роль пользователя</label>
            {user && user.username === 'admin' ? (
              <div style={{ padding: '10px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px' }}>
                <strong>Администратор</strong>
                <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', color: '#856404' }}>
                  Роль пользователя admin нельзя изменить. Этот пользователь всегда должен иметь роль администратора.
                </p>
              </div>
            ) : isCurrentUserAdmin ? (
              <div style={{ padding: '10px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px' }}>
                <strong>Администратор</strong>
                <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', color: '#856404' }}>
                  Вы не можете изменить свою собственную роль. Обратитесь к другому администратору.
                </p>
              </div>
            ) : (
              <>
                <div className="role-toggle-container">
                  <span className={`role-label ${!isAdmin ? 'active' : ''}`}>Проектировщик</span>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={isAdmin}
                      onChange={(e) => handleAdminToggle(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <span className={`role-label ${isAdmin ? 'active' : ''}`}>Администратор</span>
                </div>
                <div className="role-description">
                  {isAdmin ? (
                    <span className="role-desc-text">Пользователь имеет полный доступ к администрированию системы</span>
                  ) : (
                    <span className="role-desc-text">Пользователь может создавать и редактировать проекты</span>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Users;

