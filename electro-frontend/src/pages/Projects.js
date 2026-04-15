import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { projectAPI } from '../api/api';
import Modal from '../components/UI/Modal';
import Pagination from '../components/UI/Pagination';
import './Projects.css';

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [allProjects, setAllProjects] = useState([]); // Все расчёты для пагинации
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12); // Расчётов на странице
  const [confirmModal, setConfirmModal] = useState({ show: false, projectId: null, projectName: '', onConfirm: null });
  const [errorModal, setErrorModal] = useState({ show: false, message: '' });
  const [viewMode, setViewMode] = useState('cards'); // 'cards' или 'table'
  const [searchQuery, setSearchQuery] = useState('');
  const [projectTypeFilter, setProjectTypeFilter] = useState('all'); // 'all', 'apartment', 'house', 'dacha'
  const [sortBy, setSortBy] = useState('date-desc'); // 'date-desc', 'date-asc', 'name-asc', 'name-desc'

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await projectAPI.getAll();
      setAllProjects(response.data || []);
      setError('');
    } catch (err) {
      setError('Ошибка загрузки расчётов');
      setAllProjects([]);
    } finally {
      setLoading(false);
    }
  };

  // Фильтрация и сортировка расчётов
  const filteredAndSortedProjects = useMemo(() => {
    let filtered = [...allProjects];

    // Поиск по названию и описанию
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(project => 
        project.name?.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query)
      );
    }

    // Фильтр по типу объекта (из описания)
    if (projectTypeFilter !== 'all') {
      filtered = filtered.filter(project => {
        const desc = project.description?.toLowerCase() || '';
        if (projectTypeFilter === 'apartment') {
          return desc.includes('квартира');
        } else if (projectTypeFilter === 'house') {
          return desc.includes('дом') && !desc.includes('дача');
        } else if (projectTypeFilter === 'dacha') {
          return desc.includes('дача');
        }
        return true;
      });
    }

    // Сортировка
    filtered.sort((a, b) => {
      if (sortBy === 'date-desc') {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      } else if (sortBy === 'date-asc') {
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      } else if (sortBy === 'name-asc') {
        return (a.name || '').localeCompare(b.name || '', 'ru');
      } else if (sortBy === 'name-desc') {
        return (b.name || '').localeCompare(a.name || '', 'ru');
      }
      return 0;
    });

    return filtered;
  }, [allProjects, searchQuery, projectTypeFilter, sortBy]);

  // Пагинация
  useEffect(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setProjects(filteredAndSortedProjects.slice(startIndex, endIndex));
  }, [filteredAndSortedProjects, currentPage, itemsPerPage]);

  const handleDelete = async (id, name) => {
    setConfirmModal({
      show: true,
      projectId: id,
      projectName: name,
      onConfirm: async () => {
        try {
          await projectAPI.delete(id);
          loadProjects();
          setConfirmModal({ show: false, projectId: null, projectName: '', onConfirm: null });
        } catch (err) {
          setConfirmModal({ show: false, projectId: null, projectName: '', onConfirm: null });
          setErrorModal({ show: true, message: 'Ошибка удаления расчёта' });
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="projects-page fade-in">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Загрузка расчётов...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="projects-page fade-in">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className={`projects-page fade-in ${viewMode === 'table' ? 'table-view' : ''}`}>
      <div className="projects-header">
        <div className="header-content">
          <h1>Мои расчёты</h1>
          <p className="header-subtitle">Управляйте своими расчётами электросети</p>
        </div>
        <div className="header-actions">
          <div className="view-mode-toggle">
            <button
              className={`view-mode-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
              title="Вид карточек"
            >
              <span className="btn-icon">⊞</span>
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Вид таблицы"
            >
              <span className="btn-icon">☰</span>
            </button>
          </div>
          <Link to="/calculator" className="btn-create-project-calculator">
            <span className="btn-icon">🧮</span>
            Создать через калькулятор
          </Link>
        <Link to="/projects/new" className="btn-create-project">
          <span className="btn-icon">+</span>
          Создать расчёт
        </Link>
        </div>
      </div>

      {allProjects.length === 0 ? (
        <div className="empty-projects">
          <div className="empty-icon"></div>
          <h2>У вас пока нет расчётов</h2>
          <p>Создайте первый расчёт электросети, чтобы начать работу</p>
          <Link to="/projects/new" className="btn-primary">
            Создать первый расчёт
          </Link>
        </div>
      ) : (
        <>
          <div className="projects-filters">
            <div className="search-box">
              <input
                type="text"
                placeholder="Поиск по названию или описанию..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="search-input"
              />
            </div>
            <div className="filters-row">
              <div className="filter-group">
                <label>Тип объекта:</label>
                <select
                  value={projectTypeFilter}
                  onChange={(e) => {
                    setProjectTypeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="filter-select"
                >
                  <option value="all">Все типы</option>
                  <option value="apartment">Квартира</option>
                  <option value="house">Дом</option>
                  <option value="dacha">Дача</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Сортировка:</label>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="filter-select"
                >
                  <option value="date-desc">По дате (новые сначала)</option>
                  <option value="date-asc">По дате (старые сначала)</option>
                  <option value="name-asc">По названию (А-Я)</option>
                  <option value="name-desc">По названию (Я-А)</option>
                </select>
              </div>
            </div>
          </div>
          {viewMode === 'cards' ? (
            <div className="projects-grid">
              {projects.map((project) => (
                <div key={project.id} className="project-card">
                  <div className="project-card-header">
                    <div className="project-icon"></div>
                    <div className="project-title-section">
                      <h3>{project.name}</h3>
                      {project.description && (
                        <p className="project-description">{project.description}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="project-stats">
                    <div className="stat-item">
                      <div className="stat-content">
                        <span className="stat-value">{project.rooms?.length || 0}</span>
                        <span className="stat-label">Комнат</span>
                      </div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-content">
                        <span className="stat-value">{project.appliances?.length || 0}</span>
                        <span className="stat-label">Приборов</span>
                      </div>
                    </div>
                  </div>

                  <div className="project-actions">
                    <Link 
                      to={`/projects/${project.id}`} 
                      className="btn-secondary"
                      title="Просмотр расчёта"
                    >
                      Просмотр
                    </Link>
                    <Link 
                      to={`/projects/${project.id}/calculator`} 
                      className="btn-calculator"
                      title="Калькулятор ведомости"
                    >
                      Калькулятор
                    </Link>
                    <button 
                      onClick={() => handleDelete(project.id, project.name)} 
                      className="btn-danger"
                      title="Удалить расчёт"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="projects-table-container">
              <table className="projects-table">
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Описание</th>
                    <th>Комнат</th>
                    <th>Приборов</th>
                    <th>Дата создания</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id}>
                      <td><strong>{project.name}</strong></td>
                      <td className="description-cell">{project.description || '-'}</td>
                      <td>{project.rooms?.length || 0}</td>
                      <td>{project.appliances?.length || 0}</td>
                      <td>
                        {project.createdAt 
                          ? new Date(project.createdAt).toLocaleDateString('ru-RU', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })
                          : '-'}
                      </td>
                      <td>
                        <div className="table-actions">
                          <Link 
                            to={`/projects/${project.id}`} 
                            className="btn-secondary"
                            title="Просмотр расчёта"
                          >
                            Просмотр
                          </Link>
                          <Link 
                            to={`/projects/${project.id}/calculator`} 
                            className="btn-calculator"
                            title="Калькулятор ведомости"
                          >
                            Калькулятор
                          </Link>
                          <button 
                            onClick={() => handleDelete(project.id, project.name)} 
                            className="btn-danger"
                            title="Удалить расчёт"
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(filteredAndSortedProjects.length / itemsPerPage)}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={filteredAndSortedProjects.length}
          />
        </>
      )}
      <Modal
        show={confirmModal.show}
        title="Подтверждение"
        type="confirm"
        onClose={() => setConfirmModal({ show: false, projectId: null, projectName: '', onConfirm: null })}
        onConfirm={confirmModal.onConfirm}
        confirmText="Удалить"
        cancelText="Отмена"
      >
        <p>Вы уверены, что хотите удалить расчёт «{confirmModal.projectName}»?</p>
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

export default Projects;
