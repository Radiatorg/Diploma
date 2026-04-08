import React, { useState } from 'react';
import Modal from '../UI/Modal';
import './FloorPlanCanvas.css';

// Упрощенный компонент без Canvas - только список данных
const FloorPlanCanvas = ({
  projectId,
  rooms = [],
  walls = [],
  electricalPoints = [],
  activeTool,
  setActiveTool,
  onWallCreate,
  onElectricalPointCreate,
  onRoomUpdate,
  onWallUpdate,
  onElectricalPointUpdate,
  showGrid = true,
  gridSize = 20,
  snapToGrid = true,
  showSymbolsLibrary,
  selectedObject,
  setSelectedObject,
  onDeleteObject,
  placingUnplacedRoom,
  onRoomDoubleClick
}) => {
  const [alertModal, setAlertModal] = useState({ show: false, message: '' });

  const handleRoomClick = (room) => {
    if (setSelectedObject) {
      setSelectedObject({ type: 'room', id: room.id });
    }
    if (onRoomDoubleClick && room.positionX != null && room.positionY != null) {
      onRoomDoubleClick(room.id);
    }
  };

  const handleWallClick = (wall) => {
    if (setSelectedObject) {
      setSelectedObject({ type: 'wall', id: wall.id });
    }
  };

  const handlePointClick = (point) => {
    if (setSelectedObject) {
      setSelectedObject({ type: 'point', id: point.id });
    }
  };

  return (
    <div className="floor-plan-canvas-container">
      <div className="canvas-toolbar">
        <button 
          className={activeTool === 'select' ? 'active' : ''} 
          onClick={() => setActiveTool && setActiveTool('select')}
        >
          Выделение
        </button>
        <button 
          className={activeTool === 'room' ? 'active' : ''} 
          onClick={() => setActiveTool && setActiveTool('room')}
        >
          Разместить комнату
        </button>
        {activeTool === 'room' && (
          <span style={{marginLeft: '10px', fontSize: '12px', color: '#666'}}>
            Выберите комнату из списка для размещения
          </span>
        )}
      </div>

      <div className="floor-plan-data-list">
        <div className="data-section">
          <h3>Помещения ({rooms.length})</h3>
          <div className="rooms-list">
            {rooms.map(room => (
              <div 
                key={room.id}
                className={`room-item ${selectedObject?.type === 'room' && selectedObject?.id === room.id ? 'selected' : ''}`}
                onClick={() => handleRoomClick(room)}
              >
                <div className="room-name">{room.name || `Помещение ${room.id}`}</div>
                {room.positionX != null && room.positionY != null && (
                  <div className="room-position">
                    Позиция: {room.positionX}см × {room.positionY}см
                    {room.width && room.height && `, Размер: ${room.width}см × ${room.height}см`}
                  </div>
                )}
                {(!room.positionX || !room.positionY) && (
                  <div className="room-unplaced">Не размещено на плане</div>
                )}
              </div>
            ))}
            {rooms.length === 0 && (
              <div className="empty-message">Нет помещений</div>
            )}
          </div>
        </div>

        <div className="data-section">
          <h3>Стены ({walls.length})</h3>
          <div className="walls-list">
            {walls.map(wall => (
              <div 
                key={wall.id}
                className={`wall-item ${selectedObject?.type === 'wall' && selectedObject?.id === wall.id ? 'selected' : ''}`}
                onClick={() => handleWallClick(wall)}
              >
                <div className="wall-info">
                  {wall.wallType === 'external' ? 'Внешняя' : 'Внутренняя'} стена
                </div>
                <div className="wall-coords">
                  ({wall.startX}, {wall.startY}) → ({wall.endX}, {wall.endY})
                </div>
              </div>
            ))}
            {walls.length === 0 && (
              <div className="empty-message">Нет стен</div>
            )}
          </div>
        </div>

        <div className="data-section">
          <h3>Электрические точки ({electricalPoints.length})</h3>
          <div className="points-list">
            {electricalPoints.map(point => (
              <div 
                key={point.id}
                className={`point-item ${selectedObject?.type === 'point' && selectedObject?.id === point.id ? 'selected' : ''}`}
                onClick={() => handlePointClick(point)}
              >
                <div className="point-symbol">
                  {point.electricalSymbol?.name || 'Точка'}
                </div>
                <div className="point-position">
                  Позиция: {point.positionX}см × {point.positionY}см
                </div>
              </div>
            ))}
            {electricalPoints.length === 0 && (
              <div className="empty-message">Нет электрических точек</div>
            )}
          </div>
        </div>
      </div>

      <Modal
        show={alertModal.show}
        title="Информация"
        type="info"
        onClose={() => setAlertModal({ show: false, message: '' })}
        cancelText="Ок"
      >
        <p>{alertModal.message}</p>
      </Modal>
    </div>
  );
};

export default FloorPlanCanvas;
