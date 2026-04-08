import React, { useRef, useEffect, useState, useCallback } from 'react';
import { roomAPI, wallAPI } from '../../api/api';
import Modal from '../UI/Modal';
import './RoomLayoutEditor.css';

const RoomLayoutEditor = ({ projectId, room, onClose }) => {
  const canvasRef = useRef(null);
  const [internalWalls, setInternalWalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTool, setActiveTool] = useState('select'); // 'select', 'drawWall', 'addDoor'
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [currentMousePos, setCurrentMousePos] = useState({ x: 0, y: 0 });
  const [selectedWall, setSelectedWall] = useState(null);
  const [zoom, setZoom] = useState(1.0);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [confirmModal, setConfirmModal] = useState({ show: false, wallId: null, onConfirm: null });

  useEffect(() => {
    if (room && projectId) {
      loadWalls();
    }
  }, [room, projectId]);

  const loadWalls = async () => {
    try {
      setLoading(true);
      const response = await roomAPI.getWalls(projectId, room.id);
      setInternalWalls(response.data || []);
      setError('');
    } catch (err) {
      setError('Ошибка загрузки внутренних стен');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Преобразование координат
  const toCanvasCoords = useCallback((planX, planY) => {
    return {
      x: (planX - room.positionX) * zoom + viewOffset.x,
      y: (planY - room.positionY) * zoom + viewOffset.y
    };
  }, [room, zoom, viewOffset]);

  const toPlanCoords = useCallback((canvasX, canvasY) => {
    return {
      x: (canvasX - viewOffset.x) / zoom + room.positionX,
      y: (canvasY - viewOffset.y) / zoom + room.positionY
    };
  }, [room, zoom, viewOffset]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !room) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Рисуем границы комнаты
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, room.width * zoom, room.height * zoom);

    // Рисуем внутренние стены
    internalWalls.forEach(wall => {
      const start = toCanvasCoords(wall.startX, wall.startY);
      const end = toCanvasCoords(wall.endX, wall.endY);
      
      ctx.strokeStyle = wall.id === selectedWall?.id ? '#3498db' : '#666';
      ctx.lineWidth = (wall.thickness || 10) * zoom;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      // Рисуем проемы (двери, окна)
      if (wall.openings && wall.openings.length > 0) {
        wall.openings.forEach(opening => {
          const wallLength = Math.sqrt(
            Math.pow(wall.endX - wall.startX, 2) + 
            Math.pow(wall.endY - wall.startY, 2)
          );
          const t = opening.position / wallLength;
          const openingX = wall.startX + (wall.endX - wall.startX) * t;
          const openingY = wall.startY + (wall.endY - wall.startY) * t;
          const openingPos = toCanvasCoords(openingX, openingY);
          
          ctx.strokeStyle = opening.openingType === 'door' ? '#8b4513' : '#87ceeb';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(openingPos.x, openingPos.y, opening.width * zoom / 2, 0, Math.PI * 2);
          ctx.stroke();
        });
      }
    });

    // Рисуем текущую рисуемую стену
    if (isDrawing && activeTool === 'drawWall') {
      const start = toCanvasCoords(dragStart.x, dragStart.y);
      const end = toCanvasCoords(currentMousePos.x, currentMousePos.y);
      ctx.strokeStyle = 'rgba(74, 144, 226, 0.7)';
      ctx.lineWidth = 10 * zoom;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
  }, [internalWalls, isDrawing, dragStart, currentMousePos, room, zoom, viewOffset, activeTool, selectedWall, toCanvasCoords]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !room) return;
    canvas.width = room.width * zoom + 100;
    canvas.height = room.height * zoom + 100;
    draw();
  }, [draw, room, zoom]);

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const planPos = toPlanCoords(x, y);

    if (activeTool === 'drawWall') {
      setIsDrawing(true);
      setDragStart(planPos);
      setCurrentMousePos(planPos);
    } else if (activeTool === 'select') {
      // Проверяем клик по стене
      let clickedWall = null;
      let minDist = Infinity;
      internalWalls.forEach(wall => {
        const A = { x: wall.startX, y: wall.startY };
        const B = { x: wall.endX, y: wall.endY };
        const P = planPos;
        const AB = { x: B.x - A.x, y: B.y - A.y };
        const AP = { x: P.x - A.x, y: P.y - A.y };
        const lenABSq = AB.x * AB.x + AB.y * AB.y;
        if (lenABSq === 0) return;
        const t = Math.max(0, Math.min(1, (AP.x * AB.x + AP.y * AB.y) / lenABSq));
        const projection = { x: A.x + t * AB.x, y: A.y + t * AB.y };
        const dist = Math.sqrt((P.x - projection.x) ** 2 + (P.y - projection.y) ** 2);
        if (dist < 20 && dist < minDist) {
          minDist = dist;
          clickedWall = wall;
        }
      });
      setSelectedWall(clickedWall);
    }
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const planPos = toPlanCoords(x, y);
    setCurrentMousePos(planPos);
  };

  const handleMouseUp = async () => {
    if (isDrawing && activeTool === 'drawWall') {
      const minX = Math.min(dragStart.x, currentMousePos.x);
      const minY = Math.min(dragStart.y, currentMousePos.y);
      const maxX = Math.max(dragStart.x, currentMousePos.x);
      const maxY = Math.max(dragStart.y, currentMousePos.y);
      const width = maxX - minX;
      const height = maxY - minY;

      // Проверяем, что стена находится внутри комнаты
      if (minX >= room.positionX && minY >= room.positionY &&
          maxX <= room.positionX + room.width && maxY <= room.positionY + room.height) {
        try {
          await wallAPI.create(projectId, {
            startX: dragStart.x,
            startY: dragStart.y,
            endX: currentMousePos.x,
            endY: currentMousePos.y,
            thickness: 10,
            wallType: 'partition',
            roomId: room.id
          });
          await loadWalls();
        } catch (err) {
          setError('Ошибка создания перегородки');
        }
      } else {
        setError('Перегородка должна находиться внутри помещения');
      }
      setIsDrawing(false);
    }
  };

  const handleDeleteWall = async (wallId) => {
    setConfirmModal({
      show: true,
      wallId,
      onConfirm: async () => {
        try {
          await wallAPI.delete(projectId, wallId);
          await loadWalls();
          setSelectedWall(null);
          setConfirmModal({ show: false, wallId: null, onConfirm: null });
        } catch (err) {
          setError('Ошибка удаления перегородки');
          setConfirmModal({ show: false, wallId: null, onConfirm: null });
        }
      }
    });
  };

  const handleAddDoor = async () => {
    if (!selectedWall) {
      setError('Выберите стену для добавления двери');
      return;
    }
    const doorWidth = prompt('Ширина двери (см):', '90');
    if (!doorWidth || isNaN(doorWidth)) return;
    
    const wallLength = Math.sqrt(
      Math.pow(selectedWall.endX - selectedWall.startX, 2) + 
      Math.pow(selectedWall.endY - selectedWall.startY, 2)
    );
    const doorPosition = prompt(`Позиция двери от начала стены (0-${wallLength.toFixed(0)} см):`, (wallLength / 2).toFixed(0));
    if (!doorPosition || isNaN(doorPosition)) return;

    try {
      // Получаем текущие проемы стены
      const currentOpenings = selectedWall.openings || [];
      
      // Добавляем новый проем
      const newOpening = {
        position: parseFloat(doorPosition),
        width: parseFloat(doorWidth),
        height: 210, // стандартная высота двери
        openingType: 'door'
      };
      
      // Обновляем стену с новым проемом
      await wallAPI.update(projectId, selectedWall.id, {
        startX: selectedWall.startX,
        startY: selectedWall.startY,
        endX: selectedWall.endX,
        endY: selectedWall.endY,
        thickness: selectedWall.thickness || 10,
        wallType: selectedWall.wallType || 'partition',
        roomId: selectedWall.roomId,
        openings: [...currentOpenings, newOpening]
      });
      
      await loadWalls();
      setError('');
    } catch (err) {
      setError('Ошибка добавления двери: ' + (err.response?.data?.message || err.message));
    }
  };

  if (!room) return null;

  return (
    <div className="room-layout-editor">
      <div className="layout-editor-header">
        <h4>Планировка помещения: {room.name}</h4>
        <p className="hint">Добавьте внутренние стены, перегородки и двери</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="layout-toolbar">
        <button 
          className={activeTool === 'select' ? 'active' : ''} 
          onClick={() => setActiveTool('select')}
        >
          Выбрать
        </button>
        <button 
          className={activeTool === 'drawWall' ? 'active' : ''} 
          onClick={() => setActiveTool('drawWall')}
        >
          Нарисовать стену
        </button>
        {selectedWall && (
          <button onClick={handleAddDoor} className="btn-add-door">
            Добавить дверь
          </button>
        )}
        {selectedWall && (
          <button onClick={() => handleDeleteWall(selectedWall.id)} className="btn-delete">
            Удалить
          </button>
        )}
        <div className="zoom-controls">
          <button onClick={() => setZoom(z => Math.min(z * 1.2, 3))}>+</button>
          <span>{(zoom * 100).toFixed(0)}%</span>
          <button onClick={() => setZoom(z => Math.max(z / 1.2, 0.5))}>-</button>
        </div>
      </div>

      <div className="layout-canvas-container">
        <canvas
          ref={canvasRef}
          className="room-layout-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        />
      </div>

      <div className="walls-list">
        <h5>Перегородки ({internalWalls.length})</h5>
        {loading ? (
          <div className="loading">Загрузка...</div>
        ) : internalWalls.length === 0 ? (
          <div className="empty-state">
            <p>Нет внутренних стен</p>
          </div>
        ) : (
          <div className="walls-items">
            {internalWalls.map((wall) => (
              <div 
                key={wall.id} 
                className={`wall-item ${wall.id === selectedWall?.id ? 'selected' : ''}`}
                onClick={() => setSelectedWall(wall)}
              >
                <div className="wall-info">
                  <div className="wall-coords">
                    ({parseFloat(wall.startX).toFixed(0)}, {parseFloat(wall.startY).toFixed(0)}) → 
                    ({parseFloat(wall.endX).toFixed(0)}, {parseFloat(wall.endY).toFixed(0)})
                  </div>
                  <div className="wall-details">
                    Толщина: {wall.thickness || 10} см | 
                    Проемов: {wall.openings?.length || 0}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Modal
        show={confirmModal.show}
        title="Подтверждение"
        type="confirm"
        onClose={() => setConfirmModal({ show: false, wallId: null, onConfirm: null })}
        onConfirm={confirmModal.onConfirm}
        confirmText="Удалить"
        cancelText="Отмена"
      >
        <p>Удалить эту перегородку?</p>
      </Modal>
    </div>
  );
};

export default RoomLayoutEditor;
