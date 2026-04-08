import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../api/api';
import AdminNavPanel from '../../components/AdminNavPanel/AdminNavPanel';
import './Admin.css';

const AdminProjects = () => {
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');

  useEffect(() => {
    loadProjects();
    loadUsers();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await adminAPI.getAllProjects();
      setProjects(response.data);
    } catch (err) {
      setError('Ошибка загрузки расчётов');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await adminAPI.getAllUsers();
      setUsers(response.data || []);
    } catch (err) {
      console.error('Ошибка загрузки пользователей:', err);
    }
  };


  const filteredProjects = projects.filter(project => {
    // Фильтр по поиску
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const createdAt = project.createdAt ? new Date(project.createdAt).toLocaleDateString('ru-RU') : '';
      const matchesSearch = 
        project.name?.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query) ||
        project.designerUsername?.toLowerCase().includes(query) ||
        project.designer?.username?.toLowerCase().includes(query) ||
        project.id?.toString().includes(query) ||
        createdAt.includes(query);
      if (!matchesSearch) return false;
    }

    // Фильтр по дате
    if (dateFrom || dateTo) {
      const projectDate = project.createdAt ? new Date(project.createdAt) : null;
      if (!projectDate) return false;
      if (dateFrom && projectDate < new Date(dateFrom)) return false;
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (projectDate > toDate) return false;
      }
    }

    // Фильтр по пользователю
    if (selectedUserId) {
      const projectDesignerId = project.designerId || project.designer?.id;
      if (projectDesignerId !== parseInt(selectedUserId)) return false;
    }

    return true;
  });

  if (loading) return <div className="loading-container">Загрузка...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="admin-page fade-in">
      <AdminNavPanel />
      <div className="page-header">
        <h1>Все расчёты</h1>
        <p className="page-subtitle">Просмотр всех расчётов пользователей системы</p>
      </div>
      <div className="appliances-filters-row admin-projects-filters-row">
        <input
          type="text"
          placeholder="Поиск по названию, описанию, автору, ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="admin-search-input admin-projects-search-input"
        />
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: '500' }}>Дата создания:</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
          />
          <span>-</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: '500' }}>Пользователь:</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            style={{
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              minWidth: '200px',
              fontSize: '0.9rem',
            }}
          >
            <option value="">Все пользователи</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.username}{' '}
                {user.firstName || user.lastName
                  ? `(${user.firstName || ''} ${user.lastName || ''})`.trim()
                  : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
      {filteredProjects.length === 0 ? (
        <div className="empty-state">
          <p>{searchQuery ? 'Расчёты не найдены' : 'Нет расчётов в системе'}</p>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Название расчёта</th>
                <th>Автор</th>
                <th>Описание</th>
                <th>Комнат</th>
                <th>Приборов</th>
                <th>Дата создания</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => (
                <tr key={project.id}>
                  <td>{project.id}</td>
                  <td><strong>{project.name}</strong></td>
                  <td>{project.designerUsername || project.designer?.username || '-'}</td>
                  <td className="description-cell">{project.description || '-'}</td>
                  <td>{project.rooms?.length || 0}</td>
                  <td>{project.appliances?.length || project.projectAppliances?.length || 0}</td>
                  <td>{project.createdAt ? new Date(project.createdAt).toLocaleDateString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  }) : '-'}</td>
                  <td>
                    <Link to={`/admin/projects/${project.id}`} className="btn-secondary">
                      Просмотр
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminProjects;

