import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../../api/api';
import AdminNavPanel from '../../components/AdminNavPanel/AdminNavPanel';
import Modal from '../../components/UI/Modal';
import Pagination from '../../components/UI/Pagination';
import './Admin.css';

const RoomTypes = () => {
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRoomType, setEditingRoomType] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ show: false, roomTypeId: null, onConfirm: null });
  const [errorModal, setErrorModal] = useState({ show: false, message: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [sortBy, setSortBy] = useState('id');
  const [sortDir, setSortDir] = useState('asc');
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  const loadRoomTypes = useCallback(async () => {
    if (isFirstLoad) {
      setLoading(true);
    }
    try {
      const response = await adminAPI.getAllRoomTypes({
        search: searchQuery.trim() || undefined,
        sortBy,
        sortDir,
        page: currentPage - 1,
        size: itemsPerPage
      });
      setRoomTypes(response.data);
      const totalCountHeader = response.headers?.['x-total-count'];
      setTotalItems(totalCountHeader ? Number(totalCountHeader) : response.data.length);
      setError('');
    } catch (err) {
      setError('Ошибка загрузки типов комнат');
    } finally {
      if (isFirstLoad) {
        setLoading(false);
        setIsFirstLoad(false);
      }
    }
  }, [currentPage, itemsPerPage, searchQuery, sortBy, sortDir, isFirstLoad]);

  useEffect(() => {
    loadRoomTypes();
  }, [loadRoomTypes]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, sortDir]);

  const handleDelete = async (id) => {
    setConfirmModal({
      show: true,
      roomTypeId: id,
      onConfirm: async () => {
        try {
          await adminAPI.deleteRoomType(id);
          loadRoomTypes();
          setConfirmModal({ show: false, roomTypeId: null, onConfirm: null });
        } catch (err) {
          setConfirmModal({ show: false, roomTypeId: null, onConfirm: null });
          setErrorModal({ show: true, message: 'Ошибка удаления типа комнаты' });
        }
      }
    });
  };

  const handleEdit = (roomType) => {
    setEditingRoomType(roomType);
    setShowForm(true);
  };

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

  if (loading) return <div>Загрузка...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="admin-page">
      <AdminNavPanel />
      <div className="page-header">
        <h1>Управление типами помещений</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          Создать тип
        </button>
      </div>
      <div className="admin-search-container">
        <input
          type="text"
          placeholder="Поиск по названию, описанию, коэффициентам..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="admin-search-input"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="admin-search-input"
          style={{ maxWidth: '260px' }}
        >
          <option value="id">Сортировка: ID</option>
          <option value="name">Сортировка: Название</option>
          <option value="description">Сортировка: Описание</option>
          <option value="minCoefficient">Сортировка: Мин. коэффициент</option>
          <option value="maxCoefficient">Сортировка: Макс. коэффициент</option>
          <option value="effectiveCoefficient">Сортировка: Эффективный</option>
        </select>
        <select
          value={sortDir}
          onChange={(e) => setSortDir(e.target.value)}
          className="admin-search-input"
          style={{ maxWidth: '220px' }}
        >
          <option value="asc">По возрастанию</option>
          <option value="desc">По убыванию</option>
        </select>
      </div>
      {showForm && (
        <RoomTypeForm
          roomType={editingRoomType}
          onClose={() => {
            setShowForm(false);
            setEditingRoomType(null);
          }}
          onSuccess={loadRoomTypes}
        />
      )}
      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('id')}>ID{getSortIndicator('id')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>Название{getSortIndicator('name')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('minCoefficient')}>Коэффициент (мин){getSortIndicator('minCoefficient')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('maxCoefficient')}>Коэффициент (макс){getSortIndicator('maxCoefficient')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('effectiveCoefficient')}>Эффективный{getSortIndicator('effectiveCoefficient')}</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {roomTypes.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                  {searchQuery ? 'Типы помещений не найдены' : 'Нет типов помещений'}
                </td>
              </tr>
            ) : (
              roomTypes.map((roomType) => (
                <tr key={roomType.id}>
                  <td>{roomType.id}</td>
                  <td>{roomType.name}</td>
                  <td>{roomType.minCoefficient ? parseFloat(roomType.minCoefficient).toFixed(4) : '-'}</td>
                  <td>{roomType.maxCoefficient ? parseFloat(roomType.maxCoefficient).toFixed(4) : '-'}</td>
                  <td>
                    <strong>
                      {roomType.effectiveCoefficient 
                        ? parseFloat(roomType.effectiveCoefficient).toFixed(4)
                        : roomType.minCoefficient 
                          ? parseFloat(roomType.minCoefficient).toFixed(4)
                          : '-'}
                    </strong>
                  </td>
                  <td className="actions-cell">
                    <button onClick={() => handleEdit(roomType)} className="btn-secondary">
                      Редактировать
                    </button>
                    <button onClick={() => handleDelete(roomType.id)} className="btn-danger">
                      Удалить
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalItems > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(totalItems / itemsPerPage)}
          onPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          totalItems={totalItems}
        />
      )}
      <Modal
        show={confirmModal.show}
        title="Подтверждение"
        type="confirm"
        onClose={() => setConfirmModal({ show: false, roomTypeId: null, onConfirm: null })}
        onConfirm={confirmModal.onConfirm}
        confirmText="Удалить"
        cancelText="Отмена"
      >
        <p>Удалить тип комнаты?</p>
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

const RoomTypeForm = ({ roomType, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    minCoefficient: '',
    maxCoefficient: '',
    useRange: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (roomType) {
      const hasRange = roomType.maxCoefficient != null && roomType.maxCoefficient !== roomType.minCoefficient;
      setFormData({
        name: roomType.name || '',
        description: roomType.description || '',
        minCoefficient: roomType.minCoefficient?.toString() || '',
        maxCoefficient: roomType.maxCoefficient?.toString() || '',
        useRange: hasRange,
      });
    }
  }, [roomType]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ 
      ...formData, 
      [name]: type === 'checkbox' ? checked : value 
    });
    
    // Если сняли галочку диапазона, очищаем максимальное значение
    if (name === 'useRange' && !checked) {
      setFormData(prev => ({ ...prev, maxCoefficient: '' }));
    }
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Название обязательно для заполнения');
      return false;
    }

    const minCoeff = parseFloat(formData.minCoefficient);
    if (isNaN(minCoeff) || minCoeff <= 0) {
      setError('Минимальный коэффициент должен быть больше 0');
      return false;
    }

    if (formData.useRange) {
      const maxCoeff = parseFloat(formData.maxCoefficient);
      if (isNaN(maxCoeff) || maxCoeff <= 0) {
        setError('Максимальный коэффициент должен быть больше 0');
        return false;
      }
      if (maxCoeff <= minCoeff) {
        setError('Максимальный коэффициент должен быть больше минимального');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    const submitData = {
      name: formData.name.trim(),
      description: formData.description?.trim() || null,
      minCoefficient: parseFloat(formData.minCoefficient),
      maxCoefficient: formData.useRange && formData.maxCoefficient 
        ? parseFloat(formData.maxCoefficient) 
        : null,
    };

    try {
      if (roomType) {
        await adminAPI.updateRoomType(roomType.id, submitData);
      } else {
        await adminAPI.createRoomType(submitData);
      }
      onSuccess();
      onClose();
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Ошибка сохранения типа помещения';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{roomType ? 'Редактировать тип комнаты' : 'Создать тип комнаты'}</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Название *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              maxLength={100}
            />
          </div>
          <div className="form-group">
            <label>Минимальный коэффициент мощности *</label>
            <input
              type="number"
              name="minCoefficient"
              value={formData.minCoefficient}
              onChange={handleChange}
              min="0.0001"
              step="0.0001"
              required
              placeholder="Например: 1.0"
            />
            <small className="form-hint">
              Коэффициент используется для расчета общей мощности электроприборов в помещении.
              Значение должно быть больше 0.
            </small>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                name="useRange"
                checked={formData.useRange}
                onChange={handleChange}
              />
              {' '}Задать диапазон коэффициента (вилка)
            </label>
          </div>

          {formData.useRange && (
            <div className="form-group">
              <label>Максимальный коэффициент мощности *</label>
              <input
                type="number"
                name="maxCoefficient"
                value={formData.maxCoefficient}
                onChange={handleChange}
                min={formData.minCoefficient || "0.0001"}
                step="0.0001"
                required={formData.useRange}
                placeholder="Например: 1.5"
              />
              <small className="form-hint">
                Если задан диапазон, в расчетах будет использоваться среднее значение: 
                (мин + макс) / 2 = {formData.minCoefficient && formData.maxCoefficient 
                  ? ((parseFloat(formData.minCoefficient) + parseFloat(formData.maxCoefficient)) / 2).toFixed(4)
                  : '-'}
              </small>
            </div>
          )}

          {!formData.useRange && formData.minCoefficient && (
            <div className="form-group">
              <small className="form-hint">
                Используемый коэффициент: <strong>{formData.minCoefficient}</strong>
              </small>
            </div>
          )}

          <div className="form-group">
            <label>Описание</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              maxLength={500}
              rows={3}
              placeholder="Опциональное описание типа помещения"
            />
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

export default RoomTypes;

