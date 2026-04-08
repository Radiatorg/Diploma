import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { roomAPI } from '../api/api';
import './RoomNotes.css';

const RoomNotes = () => {
  const { projectId, roomId } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadRoom();
  }, [projectId, roomId]);

  const loadRoom = async () => {
    try {
      setLoading(true);
      const res = await roomAPI.getById(projectId, roomId);
      setRoom(res.data);
      setNotes(res.data.description || '');
    } catch (err) {
      console.error('Ошибка загрузки помещения:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaved(false);
      await roomAPI.update(projectId, roomId, {
        name: room.name,
        roomTypeId: room.roomTypeId,
        area: room.area,
        description: notes,
        windowCount: room.windowCount,
        socketGroups: room.socketGroups,
        socketsPerGroup: room.socketsPerGroup,
        socketGroupsConfig: room.socketGroupsConfig
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Ошибка сохранения пометок:', err);
      alert('Ошибка сохранения пометок');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="room-notes-container"><div className="loading">Загрузка...</div></div>;
  }

  return (
    <div className="room-notes-container">
      <div className="room-notes-header">
        <div className="header-left">
          <Link to={`/projects/${projectId}`} className="back-link">
            ← Назад к проекту
          </Link>
          <h1>Пометки: {room?.name || 'Помещение'}</h1>
        </div>
        <div className="header-actions">
          <button
            onClick={handleSave}
            className="btn-save"
            disabled={saving}
          >
            {saving ? 'Сохранение...' : saved ? '✓ Сохранено' : 'Сохранить'}
          </button>
        </div>
      </div>
      <div className="room-notes-content">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Введите ваши пометки здесь..."
          className="notes-textarea"
        />
      </div>
    </div>
  );
};

export default RoomNotes;









