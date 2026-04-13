import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { roomAPI } from '../api/api';
import './Form.css';

const RoomForm = () => {
  const { projectId, roomId } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    roomTypeId: '',
    area: '',
    description: '',
    windowCount: 0,
    socketGroups: 1,
    socketsPerGroup: 1,
  });
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRoomTypes();
    if (roomId) {
      loadRoom();
    }
  }, [projectId, roomId]);

  const loadRoomTypes = async () => {
    try {
      const response = await roomAPI.getTypes();
      setRoomTypes(response.data);
    } catch (err) {
      setError('Ошибка загрузки типов комнат');
    }
  };

  const loadRoom = async () => {
    try {
      const response = await roomAPI.getById(projectId, roomId);
      setFormData({
        name: response.data.name || '',
        roomTypeId: response.data.roomTypeId || '',
        area: response.data.area || '',
        description: response.data.description || '',
        windowCount: response.data.windowCount || 0,
        socketGroups: response.data.socketGroups || 1,
        socketsPerGroup: response.data.socketsPerGroup || 1,
      });
    } catch (err) {
      setError('Ошибка загрузки комнаты');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const submitData = {
      ...formData,
      roomTypeId: Number(formData.roomTypeId),
      area: Number(formData.area),
      windowCount: Number(formData.windowCount) || 0,
      socketGroups: Number(formData.socketGroups) || 1,
      socketsPerGroup: Number(formData.socketsPerGroup) || 1,
    };

    try {
      if (roomId) {
        await roomAPI.update(projectId, roomId, submitData);
      } else {
        await roomAPI.create(projectId, submitData);
      }
      navigate(`/projects/${projectId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка сохранения комнаты');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-page fade-in">
      <h1>{roomId ? 'Редактировать комнату' : 'Добавить комнату'}</h1>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit} className="form-card">
        <div className="form-group">
          <label>Название комнаты *</label>
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
          <label>Тип комнаты *</label>
          <select
            name="roomTypeId"
            value={formData.roomTypeId}
            onChange={handleChange}
            required
          >
            <option value="">Выберите тип</option>
            {roomTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Площадь (м²) *</label>
          <input
            type="number"
            name="area"
            value={formData.area}
            onChange={handleChange}
            required
            min="0.01"
            step="0.01"
          />
        </div>
        <div className="form-group">
          <label>Пометки</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={5}
            maxLength={500}
          />
        </div>
        <div className="form-group">
          <label>Количество окон</label>
          <input
            type="number"
            name="windowCount"
            value={formData.windowCount}
            onChange={handleChange}
            min="0"
            step="1"
          />
        </div>
        <div className="form-group">
          <label>Количество розеточных групп *</label>
          <input
            type="number"
            name="socketGroups"
            value={formData.socketGroups}
            onChange={handleChange}
            min="1"
            step="1"
            required
          />
          <div className="field-hint">
            Рекомендуется: 1 группа на каждые 4-6 розеток
          </div>
        </div>
        <div className="form-group">
          <label>Количество розеток в группе *</label>
          <select
            name="socketsPerGroup"
            value={formData.socketsPerGroup}
            onChange={handleChange}
            required
          >
            <option value="1">1 розетка</option>
            <option value="2">2 розетки</option>
            <option value="3">3 розетки</option>
            <option value="4">4 розетки</option>
          </select>
          <div className="field-hint">
            В одном блоке может быть от 1 до 4 электрических точек
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/projects/${projectId}`)}
            className="btn-secondary"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
};

export default RoomForm;

