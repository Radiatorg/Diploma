import React, { useState, useEffect } from 'react';
import { electricalSymbolAPI, adminAPI } from '../../api/api';
import AdminNavPanel from '../../components/AdminNavPanel/AdminNavPanel';
import Modal from '../../components/UI/Modal';
import './AdminElectricalSymbols.css';

const AdminElectricalSymbols = () => {
  const [symbols, setSymbols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSymbol, setEditingSymbol] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ show: false, message: '', onConfirm: null });
  const [errorModal, setErrorModal] = useState({ show: false, message: '' });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadSymbols();
  }, []);

  const loadSymbols = async () => {
    try {
      setLoading(true);
      const response = await electricalSymbolAPI.getAll();
      setSymbols(response.data);
      setError('');
    } catch (err) {
      setError('Ошибка загрузки символов');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setConfirmModal({
      show: true,
      message: 'Удалить символ?',
      onConfirm: async () => {
        try {
          await adminAPI.deleteElectricalSymbol(id);
          loadSymbols();
          setConfirmModal({ show: false, message: '', onConfirm: null });
        } catch (err) {
          setConfirmModal({ show: false, message: '', onConfirm: null });
          setErrorModal({ show: true, message: 'Ошибка удаления символа' });
        }
      }
    });
  };

  const handleEdit = (symbol) => {
    setEditingSymbol(symbol);
    setShowForm(true);
  };

  const filteredSymbols = symbols.filter(symbol => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      symbol.name?.toLowerCase().includes(query) ||
      symbol.type?.toLowerCase().includes(query) ||
      symbol.category?.toLowerCase().includes(query) ||
      symbol.model?.toLowerCase().includes(query) ||
      symbol.ipRating?.toLowerCase().includes(query) ||
      symbol.color?.toLowerCase().includes(query) ||
      symbol.price?.toString().includes(query) ||
      symbol.id?.toString().includes(query)
    );
  });

  if (loading) return <div className="loading">Загрузка...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="admin-page electrical-symbols-page fade-in">
      <AdminNavPanel />
      <div className="page-header">
        <h1>Управление электрическими символами</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          Создать символ
        </button>
      </div>
      <div className="admin-search-container">
        <input
          type="text"
          placeholder="Поиск по названию, типу, категории, модели..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="admin-search-input"
        />
      </div>
      {showForm && (
        <SymbolForm
          symbol={editingSymbol}
          onClose={() => {
            setShowForm(false);
            setEditingSymbol(null);
          }}
          onSuccess={() => {
            loadSymbols();
            setShowForm(false);
            setEditingSymbol(null);
          }}
        />
      )}
      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Название</th>
              <th>Тип</th>
              <th>Категория</th>
              <th>Цена (BYN)</th>
              <th>Модель</th>
              <th>IP</th>
              <th>Цвет</th>
              <th>Активен</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredSymbols.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                  {searchQuery ? 'Символы не найдены' : 'Нет символов'}
                </td>
              </tr>
            ) : (
              filteredSymbols.map((symbol) => (
              <tr key={symbol.id}>
                <td>{symbol.id}</td>
                <td>{symbol.name}</td>
                <td>{symbol.type}</td>
                <td>{symbol.category || '-'}</td>
                <td className="text-right">{symbol.price ? parseFloat(symbol.price).toFixed(2) : '-'}</td>
                <td>{symbol.model || '-'}</td>
                <td>{symbol.ipRating || '-'}</td>
                <td>{symbol.color || '-'}</td>
                <td>{symbol.active ? 'Да' : 'Нет'}</td>
                <td className="actions-cell">
                  <button onClick={() => handleEdit(symbol)} className="btn-secondary">
                    Редактировать
                  </button>
                  <button onClick={() => handleDelete(symbol.id)} className="btn-danger">
                    Удалить
                  </button>
                </td>
              </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Modal
        show={confirmModal.show}
        title="Подтверждение"
        type="confirm"
        onClose={() => setConfirmModal({ show: false, message: '', onConfirm: null })}
        onConfirm={confirmModal.onConfirm}
        confirmText="Да"
        cancelText="Отмена"
      >
        <p>{confirmModal.message}</p>
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

const SymbolForm = ({ symbol, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    type: 'outlet',
    category: 'power',
    defaultWidth: 20.0,
    defaultHeight: 20.0,
    price: '',
    model: '',
    ipRating: '',
    color: '',
    active: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (symbol) {
      setFormData({
        name: symbol.name || '',
        type: symbol.type || 'outlet',
        category: symbol.category || 'power',
        defaultWidth: symbol.defaultWidth || 20.0,
        defaultHeight: symbol.defaultHeight || 20.0,
        price: symbol.price || '',
        model: symbol.model || '',
        ipRating: symbol.ipRating || '',
        color: symbol.color || '',
        active: symbol.active !== undefined ? symbol.active : true
      });
    }
  }, [symbol]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) || 0 : value)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const submitData = {
      name: formData.name,
      svgPath: null, // Поле удалено из интерфейса
      type: formData.type,
      category: formData.category || null,
      defaultWidth: formData.defaultWidth,
      defaultHeight: formData.defaultHeight,
      price: formData.price ? parseFloat(formData.price) : null,
      model: formData.model || null,
      ipRating: formData.ipRating || null,
      color: formData.color || null,
      active: formData.active
    };

    try {
      if (symbol) {
        await adminAPI.updateElectricalSymbol(symbol.id, submitData);
      } else {
        await adminAPI.createElectricalSymbol(submitData);
      }
      onSuccess();
    } catch (err) {
      setError('Ошибка сохранения символа: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={true} title={symbol ? 'Редактировать символ' : 'Создать символ'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && <div className="error-message">{error}</div>}
        
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
          <label>Тип *</label>
          <select name="type" value={formData.type} onChange={handleChange} required>
            <option value="outlet">Розетка (outlet)</option>
            <option value="light">Лампа (light)</option>
            <option value="switch">Выключатель (switch)</option>
            <option value="panel">Распределительная панель (panel)</option>
            <option value="junction_box">Распределительная коробка (junction_box)</option>
          </select>
        </div>

        <div className="form-group">
          <label>Категория</label>
          <select name="category" value={formData.category} onChange={handleChange}>
            <option value="power">Питание (power)</option>
            <option value="lighting">Освещение (lighting)</option>
            <option value="control">Управление (control)</option>
            <option value="distribution">Распределение (distribution)</option>
          </select>
        </div>


        <div className="form-row">
          <div className="form-group">
            <label>Ширина по умолчанию</label>
            <input
              type="number"
              name="defaultWidth"
              value={formData.defaultWidth}
              onChange={handleChange}
              min="1"
              step="0.1"
            />
          </div>
          <div className="form-group">
            <label>Высота по умолчанию</label>
            <input
              type="number"
              name="defaultHeight"
              value={formData.defaultHeight}
              onChange={handleChange}
              min="1"
              step="0.1"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Цена (BYN)</label>
          <input
            type="number"
            name="price"
            value={formData.price}
            onChange={handleChange}
            min="0"
            step="0.01"
            placeholder="Например: 250.00"
          />
        </div>

        <div className="form-group">
          <label>Модель</label>
          <input
            type="text"
            name="model"
            value={formData.model}
            onChange={handleChange}
            maxLength={100}
            placeholder="Например: Legrand Valena"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Степень защиты IP</label>
            <input
              type="text"
              name="ipRating"
              value={formData.ipRating}
              onChange={handleChange}
              maxLength={10}
              placeholder="Например: IP54"
            />
          </div>
          <div className="form-group">
            <label>Цвет</label>
            <input
              type="text"
              name="color"
              value={formData.color}
              onChange={handleChange}
              maxLength={50}
              placeholder="Например: Белый"
            />
          </div>
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              name="active"
              checked={formData.active}
              onChange={handleChange}
            />
            Активен
          </label>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn-secondary">
            Отмена
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AdminElectricalSymbols;







