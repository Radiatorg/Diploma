import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../api/api';
import AdminNavPanel from '../../components/AdminNavPanel/AdminNavPanel';
import Pagination from '../../components/UI/Pagination';
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
  const [sortBy, setSortBy] = useState('id');
  const [sortDir, setSortDir] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  const loadProjects = useCallback(async () => {
    if (isFirstLoad) {
      setLoading(true);
    }
    try {
      const response = await adminAPI.getAllProjects({
        search: searchQuery.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        designerId: selectedUserId ? Number(selectedUserId) : undefined,
        sortBy,
        sortDir,
        page: currentPage - 1,
        size: itemsPerPage
      });
      setProjects(response.data);
      const totalCountHeader = response.headers?.['x-total-count'];
      setTotalItems(totalCountHeader ? Number(totalCountHeader) : response.data.length);
      setError('');
    } catch (err) {
      setError('Ошибка загрузки расчётов');
    } finally {
      if (isFirstLoad) {
        setLoading(false);
        setIsFirstLoad(false);
      }
    }
  }, [searchQuery, dateFrom, dateTo, selectedUserId, sortBy, sortDir, currentPage, itemsPerPage, isFirstLoad]);

  const loadUsers = async () => {
    try {
      const response = await adminAPI.getAllUsers({
        sortBy: 'username',
        sortDir: 'asc',
        page: 0,
        size: 1000
      });
      setUsers(response.data || []);
    } catch (err) {
      console.error('Ошибка загрузки пользователей:', err);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, dateFrom, dateTo, selectedUserId, sortBy, sortDir]);

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortBy(field);
    setSortDir('asc');
  };

  const getSortIndicator = (field) => {
    if (sortBy !== field) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  if (loading) return <div className="loading-container">Загрузка...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="admin-page">
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
        <div className="appliances-filter-group">
          <label className="appliances-filter-label">Дата создания:</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="admin-search-input appliances-filter-select"
          />
          <span className="appliances-filter-separator">-</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="admin-search-input appliances-filter-select"
          />
        </div>
        <div className="appliances-filter-group">
          <label className="appliances-filter-label">Пользователь:</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="admin-search-input appliances-filter-select"
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
        <div className="appliances-filter-group">
          <label className="appliances-filter-label">Сортировка:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="admin-search-input appliances-filter-select"
          >
            <option value="id">ID</option>
            <option value="name">Название</option>
            <option value="designerUsername">Автор</option>
            <option value="description">Описание</option>
            <option value="roomsCount">Комнат</option>
            <option value="appliancesCount">Приборов</option>
            <option value="createdAt">Дата создания</option>
          </select>
          <select
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value)}
            className="admin-search-input appliances-filter-select"
          >
            <option value="asc">По возрастанию</option>
            <option value="desc">По убыванию</option>
          </select>
        </div>
      </div>
      {projects.length === 0 ? (
        <div className="empty-state">
          <p>{searchQuery ? 'Расчёты не найдены' : 'Нет расчётов в системе'}</p>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('id')}>ID{getSortIndicator('id')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>Название расчёта{getSortIndicator('name')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('designerUsername')}>Автор{getSortIndicator('designerUsername')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('description')}>Описание{getSortIndicator('description')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('roomsCount')}>Комнат{getSortIndicator('roomsCount')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('appliancesCount')}>Приборов{getSortIndicator('appliancesCount')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('createdAt')}>Дата создания{getSortIndicator('createdAt')}</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
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
      {totalItems > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(totalItems / itemsPerPage)}
          onPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          totalItems={totalItems}
        />
      )}
    </div>
  );
};

export default AdminProjects;

