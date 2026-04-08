import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { projectApplianceAPI, applianceAPI, roomAPI } from '../api/api';
import './Form.css';

const ProjectApplianceForm = () => {
  const { projectId, projectApplianceId } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    applianceId: '',
    roomId: '',
    quantity: 1,
  });
  const [appliances, setAppliances] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
    if (projectApplianceId) {
      loadProjectAppliance();
    }
  }, [projectId, projectApplianceId]);

  const loadData = async () => {
    try {
      const [appliancesRes, roomsRes] = await Promise.all([
        applianceAPI.getAll(),
        roomAPI.getByProject(projectId),
      ]);
      setAppliances(appliancesRes.data);
      setRooms(roomsRes.data);
    } catch (err) {
      setError('Ошибка загрузки данных');
    }
  };

  const loadProjectAppliance = async () => {
    try {
      const response = await projectApplianceAPI.getByProject(projectId);
      const appliance = response.data.find((a) => a.id === Number(projectApplianceId));
      if (appliance) {
        setFormData({
          applianceId: appliance.applianceId || '',
          roomId: appliance.roomId || '',
          quantity: appliance.quantity || 1,
        });
      }
    } catch (err) {
      setError('Ошибка загрузки прибора');
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
      applianceId: Number(formData.applianceId),
      roomId: formData.roomId ? Number(formData.roomId) : null,
      quantity: Number(formData.quantity),
    };

    try {
      if (projectApplianceId) {
        await projectApplianceAPI.update(projectId, projectApplianceId, submitData);
      } else {
        await projectApplianceAPI.add(projectId, submitData);
      }
      navigate(`/projects/${projectId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка сохранения прибора');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-page fade-in">
      <h1>{projectApplianceId ? 'Редактировать прибор' : 'Добавить прибор в расчёт'}</h1>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit} className="form-card">
        <div className="form-group">
          <label>Электроприбор *</label>
          <select
            name="applianceId"
            value={formData.applianceId}
            onChange={handleChange}
            required
          >
            <option value="">Выберите прибор</option>
            {appliances.map((appliance) => (
              <option key={appliance.id} value={appliance.id}>
                {appliance.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Комната (необязательно)</label>
          <select name="roomId" value={formData.roomId} onChange={handleChange}>
            <option value="">Не привязано к комнате</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Количество *</label>
          <input
            type="number"
            name="quantity"
            value={formData.quantity}
            onChange={handleChange}
            required
            min="1"
          />
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

export default ProjectApplianceForm;

