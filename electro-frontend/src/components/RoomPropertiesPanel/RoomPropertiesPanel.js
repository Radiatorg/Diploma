import React, { useState, useEffect } from 'react';
import './RoomPropertiesPanel.css';

const RoomPropertiesPanel = ({ room, roomTypes, onUpdate, onClose, projectId }) => {
  const [formData, setFormData] = useState({
    name: '',
    roomTypeId: '',
    area: '',
    description: '',
    positionX: '',
    positionY: '',
    width: '',
    height: ''
  });

  useEffect(() => {
    if (room) {
      setFormData({
        name: room.name || '',
        roomTypeId: room.roomTypeId || '',
        area: room.area ? parseFloat(room.area).toFixed(2) : '',
        description: room.description || '',
        positionX: room.positionX ? parseFloat(room.positionX).toFixed(0) : '',
        positionY: room.positionY ? parseFloat(room.positionY).toFixed(0) : '',
        width: room.width ? parseFloat(room.width).toFixed(0) : '',
        height: room.height ? parseFloat(room.height).toFixed(0) : ''
      });
    }
  }, [room]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newFormData = {
      ...formData,
      [name]: value
    };
    
    // Автоматически пересчитываем площадь при изменении ширины или высоты
    if (name === 'width' || name === 'height') {
      const width = name === 'width' ? parseFloat(value) : parseFloat(newFormData.width);
      const height = name === 'height' ? parseFloat(value) : parseFloat(newFormData.height);
      if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
        // Площадь в м² = (ширина * высота) / 10000 (перевод из см² в м²)
        const area = (width * height) / 10000;
        newFormData.area = area.toFixed(2);
      }
    }
    
    setFormData(newFormData);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onUpdate && room) {
      const width = formData.width ? parseFloat(formData.width) : room.width;
      const height = formData.height ? parseFloat(formData.height) : room.height;
      
      // Автоматически пересчитываем площадь на основе ширины и высоты
      const calculatedArea = width && height && width > 0 && height > 0 
        ? (width * height) / 10000 
        : (formData.area ? parseFloat(formData.area) : room.area);
      
      const updates = {
        name: formData.name,
        roomTypeId: formData.roomTypeId ? parseInt(formData.roomTypeId) : room.roomTypeId,
        area: calculatedArea,
        description: formData.description,
        positionX: room.positionX,
        positionY: room.positionY,
        width: width,
        height: height
      };
      onUpdate(room.id, updates);
    }
  };

  if (!room) return null;

  return (
    <div className="room-properties-panel">
      <div className="panel-header">
        <h3>Свойства помещения</h3>
        <button onClick={onClose} className="close-btn">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="panel-form">
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
          <label>Тип помещения *</label>
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
            readOnly
            style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
            title="Площадь рассчитывается автоматически на основе ширины и высоты"
          />
          <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px' }}>
            Рассчитывается автоматически: (ширина × высота) / 10000
          </small>
        </div>
        <div className="form-group">
          <label>Описание</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            maxLength={500}
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Ширина (см)</label>
            <input
              type="number"
              name="width"
              value={formData.width}
              onChange={handleChange}
              min="40"
              step="1"
            />
          </div>
          <div className="form-group">
            <label>Высота (см)</label>
            <input
              type="number"
              name="height"
              value={formData.height}
              onChange={handleChange}
              min="40"
              step="1"
            />
          </div>
        </div>
        <div className="panel-actions">
          <button type="submit" className="btn-primary">
            Сохранить
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">
            Закрыть
          </button>
        </div>
      </form>
    </div>
  );
};

export default RoomPropertiesPanel;

