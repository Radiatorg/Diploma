import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { projectAPI, roomAPI } from '../api/api';
import { validateGroundingSystem, validateInputVoltage } from '../utils/tkp339Validations';
import './Form.css';

const ProjectForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    groundingSystem: '',
    inputVoltage: 230,
    inputPhaseCount: 1,
    penConductorSection: null,
    totalArea: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    if (id) {
      loadProject();
    }
  }, [id]);

  const loadProject = async () => {
    try {
      const response = await projectAPI.getById(id);
      setFormData({
        name: response.data.name || '',
        description: response.data.description || '',
        groundingSystem: response.data.groundingSystem || '',
        inputVoltage: response.data.inputVoltage || 230,
        inputPhaseCount: response.data.inputPhaseCount || 1,
        penConductorSection: response.data.penConductorSection || null,
        totalArea: response.data.totalArea || '',
      });
      
      // Загружаем комнаты расчёта для валидации
      try {
        const roomsResponse = await roomAPI.getByProject(id);
        setRooms(roomsResponse.data || []);
      } catch (err) {
        console.error('Ошибка загрузки комнат:', err);
        setRooms([]);
      }
    } catch (err) {
      setError('Ошибка загрузки расчёта');
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
    setValidationErrors({});

    // Валидация площади
    const area = parseFloat(formData.totalArea);
    
    if (!formData.totalArea || isNaN(area) || area <= 0) {
      setValidationErrors({ totalArea: 'Укажите площадь объекта' });
      setLoading(false);
      return;
    }
    
    // При создании расчёта: валидация как в калькуляторе
    if (!id) {
      if (area < 20) {
        setValidationErrors({ totalArea: 'Площадь объекта должна быть не менее 20 м²' });
        setLoading(false);
        return;
      }
      
      if (area > 1000) {
        setValidationErrors({ totalArea: 'Площадь объекта не должна превышать 1000 м². Для больших объектов обратитесь к специалисту' });
        setLoading(false);
        return;
      }
    } else {
      // При редактировании: проверка, что общая площадь не меньше суммы площадей комнат
      const totalRoomsArea = rooms.reduce((sum, room) => {
        return sum + (parseFloat(room.area) || 0);
      }, 0);
      
      if (area < totalRoomsArea) {
        setValidationErrors({
          totalArea: `Общая площадь расчёта (${area.toFixed(2)} м²) не может быть меньше суммы площадей всех помещений (${totalRoomsArea.toFixed(2)} м²). Увеличьте общую площадь или уменьшите площади помещений.`
        });
        setLoading(false);
        return;
      }
    }

    // Валидация системы заземления
    const groundingValidation = validateGroundingSystem(formData.groundingSystem, formData.description);
    if (!groundingValidation.valid) {
      setValidationErrors({ ...validationErrors, groundingSystem: groundingValidation.errors });
      setLoading(false);
      return;
    }

    // Валидация напряжения
    const voltageValidation = validateInputVoltage(formData.inputVoltage, formData.inputPhaseCount);
    if (!voltageValidation.valid) {
      setValidationErrors({ ...validationErrors, inputVoltage: voltageValidation.errors });
      setLoading(false);
      return;
    }

    try {
      if (id) {
        await projectAPI.update(id, formData);
        navigate(`/projects/${id}`);
      } else {
        const response = await projectAPI.create(formData);
        navigate(`/projects/${response.data.id}`);
      }
    } catch (err) {
      // Если это 401, перехватчик в api.js уже делает редирект, не нужно показывать ошибку
      if (err.response && err.response.status === 401) {
        return; 
      }
      setError(err.response?.data?.message || 'Ошибка сохранения расчёта');
    } finally {
      // Если компонент размонтировался (из-за редиректа), это предотвратит ошибку обновления стейта
      if (window.location.pathname.includes('/projects')) {
          setLoading(false);
      }
    }
  };

  return (
    <div className="form-page form-page--wide fade-in">
      <h1>{id ? 'Редактировать расчёт' : 'Создать расчёт'}</h1>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit} className="form-card form-card--wide">
        <div className="form-group">
          <label>Название расчёта *</label>
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
          <label>Описание</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={5}
            maxLength={1000}
          />
        </div>
        <div className="form-group">
          <label>Общая площадь (м²) *</label>
          <input
            type="number"
            name="totalArea"
            value={formData.totalArea}
            onChange={handleChange}
            min={id ? "0.01" : "20"}
            max="1000"
            step="0.01"
            placeholder={id ? "Например: 65" : "Минимум: 20 м², максимум: 1000 м²"}
            required
          />
          {validationErrors.totalArea && (
            <div className="error-message">{validationErrors.totalArea}</div>
          )}
          {!id && !validationErrors.totalArea && (
            <div className="field-hint" style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
              Укажите общую площадь объекта. Минимум: 20 м², максимум: 1000 м²
            </div>
          )}
          {id && !validationErrors.totalArea && rooms.length > 0 && (
            <div className="field-hint" style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
              Общая площадь не должна быть меньше суммы площадей всех помещений ({rooms.reduce((sum, room) => sum + (parseFloat(room.area) || 0), 0).toFixed(2)} м²)
            </div>
          )}
        </div>
        <div className="form-group">
          <label>Система заземления</label>
          <select
            name="groundingSystem"
            value={formData.groundingSystem}
            onChange={handleChange}
          >
            <option value="">Не указано</option>
            <option value="TN-S">TN-S</option>
            <option value="TN-C-S">TN-C-S</option>
            <option value="TN-C">TN-C</option>
          </select>
          {validationErrors.groundingSystem && (
            <div className="error-message">{validationErrors.groundingSystem.join(', ')}</div>
          )}
        </div>
        <div className="form-group">
          <label>Количество фаз</label>
          <select
            name="inputPhaseCount"
            value={formData.inputPhaseCount}
            onChange={(e) => {
              const phaseCount = parseInt(e.target.value);
              setFormData({
                ...formData,
                inputPhaseCount: phaseCount,
                inputVoltage: phaseCount === 1 ? 230 : 400,
              });
            }}
          >
            <option value={1}>1 (однофазная)</option>
            <option value={3}>3 (трехфазная)</option>
          </select>
        </div>
        <div className="form-group">
          <label>Напряжение сети (В)</label>
          <input
            type="number"
            name="inputVoltage"
            value={formData.inputVoltage}
            onChange={handleChange}
            min="230"
            max="400"
            step="1"
          />
          {validationErrors.inputVoltage && (
            <div className="error-message">{validationErrors.inputVoltage.join(', ')}</div>
          )}
        </div>
        {formData.inputPhaseCount === 3 && (
          <div className="form-group">
            <label>Сечение PEN-проводника (мм²)</label>
            <input
              type="number"
              name="penConductorSection"
              value={formData.penConductorSection || ''}
              onChange={handleChange}
              min="10"
              step="0.1"
              placeholder="10 (медь) или 16 (алюминий)"
            />
          </div>
        )}
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button type="button" onClick={() => navigate(id ? `/projects/${id}` : '/projects')} className="btn-secondary">
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProjectForm;

