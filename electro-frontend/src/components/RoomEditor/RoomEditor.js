import React, { useState, useEffect } from 'react';
import RoomPropertiesPanel from '../RoomPropertiesPanel/RoomPropertiesPanel';
import RoomLayoutEditorWithAppliances from '../RoomLayoutEditor/RoomLayoutEditorWithAppliances';
import { roomAPI } from '../../api/api';
import './RoomEditor.css';

const RoomEditor = ({ projectId, roomId, onClose, onRoomUpdate }) => {
  const [room, setRoom] = useState(null);
  const [roomTypes, setRoomTypes] = useState([]);
  const [activeTab, setActiveTab] = useState('properties'); // 'properties' | 'layout'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRoomData();
  }, [projectId, roomId]);

  const loadRoomData = async () => {
    try {
      setLoading(true);
      setError(''); // Очищаем предыдущие ошибки
      const [roomRes, typesRes] = await Promise.all([
        roomAPI.getById(projectId, roomId),
        roomAPI.getTypes().catch((err) => {
          console.warn('Не удалось загрузить типы помещений:', err);
          return { data: [] }; // Продолжаем работу даже если типы не загрузились
        })
      ]);
      setRoom(roomRes.data);
      setRoomTypes(typesRes.data || []);
    } catch (err) {
      // Улучшенное сообщение об ошибке
      const errorMessage = err.response?.data?.message || err.message;
      if (err.response?.status === 404) {
        setError('Помещение не найдено. Возможно, оно было удалено.');
      } else if (err.response?.status === 403) {
        setError('У вас нет доступа к этому помещению.');
      } else {
        setError(`Ошибка загрузки данных помещения: ${errorMessage || 'Неизвестная ошибка'}`);
      }
      console.error('Ошибка загрузки данных комнаты:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoomUpdate = async (updatedRoomId, updates) => {
    try {
      await roomAPI.update(projectId, updatedRoomId, updates);
      await loadRoomData(); // Перезагружаем данные
      if (onRoomUpdate) {
        onRoomUpdate();
      }
    } catch (err) {
      console.error('Ошибка обновления комнаты:', err);
      setError('Не удалось обновить комнату');
    }
  };

  if (loading) {
    return (
      <div className="room-editor-loading">
        <div className="loading-spinner">Загрузка...</div>
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="room-editor-error">
        <div className="error-message">{error}</div>
        <button onClick={onClose} className="btn-secondary">Закрыть</button>
      </div>
    );
  }

  if (!room) {
    return null;
  }

  return (
    <div className="room-editor">
      <div className="room-editor-header">
        <div className="header-left">
          <h2>Редактирование помещения: {room.name}</h2>
        </div>
        <div className="header-right">
          <button onClick={onClose} className="btn-close-editor">
            ✕ Закрыть
          </button>
        </div>
      </div>

      {error && (
        <div className="room-editor-error-banner">
          {error}
        </div>
      )}

      <div className="room-editor-tabs">
        <button
          className={activeTab === 'properties' ? 'active' : ''}
          onClick={() => setActiveTab('properties')}
        >
          Свойства
        </button>
        <button
          className={activeTab === 'layout' ? 'active' : ''}
          onClick={() => setActiveTab('layout')}
        >
          Планировка и электроприборы
        </button>
      </div>

      <div className="room-editor-content">
        {activeTab === 'properties' && (
          <RoomPropertiesPanel
            projectId={projectId}
            room={room}
            roomTypes={roomTypes}
            onUpdate={handleRoomUpdate}
            onClose={onClose}
          />
        )}
        {activeTab === 'layout' && (
          <RoomLayoutEditorWithAppliances
            projectId={projectId}
            room={room}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
};

export default RoomEditor;

