import React, { useState, useEffect, useRef } from 'react';
import { projectApplianceAPI, electricalPointAPI, electricalSymbolAPI } from '../../api/api';
import './RoomAppliancesManager.css';

const RoomAppliancesManager = ({ projectId, room, onClose }) => {
  const [projectAppliances, setProjectAppliances] = useState([]);
  const [roomAppliances, setRoomAppliances] = useState([]);
  const [electricalSymbols, setElectricalSymbols] = useState([]);
  const [draggedAppliance, setDraggedAppliance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canvasRef = useRef(null);

  useEffect(() => {
    loadAppliances();
  }, [projectId, room]);

  const loadAppliances = async () => {
    try {
      setLoading(true);

      // Загружаем все приборы проекта и символы
      const [appliancesRes, symbolsRes] = await Promise.all([
        projectApplianceAPI.getByProject(projectId),
        electricalSymbolAPI.getAll().catch(() => ({ data: [] }))
      ]);
      setProjectAppliances(appliancesRes.data || []);
      setElectricalSymbols(symbolsRes.data || []);

      // Загружаем электрические точки комнаты
      const pointsRes = await electricalPointAPI.getByProject(projectId);
      const roomPoints = pointsRes.data.filter(point =>
        point.positionX >= room.positionX &&
        point.positionX <= room.positionX + room.width &&
        point.positionY >= room.positionY &&
        point.positionY <= room.positionY + room.height
      );

      // Группируем приборы по позициям
      const applianceMap = {};
      roomPoints.forEach(point => {
        // Проверяем applianceId напрямую в точке или через electricalSymbol
        const applianceId = point.applianceId || (point.electricalSymbol && point.electricalSymbol.applianceId);
        if (applianceId) {
          const key = `${point.positionX}-${point.positionY}`;
          if (!applianceMap[key]) {
            applianceMap[key] = {
              appliance: appliancesRes.data.find(a => a.id === applianceId),
              points: []
            };
          }
          applianceMap[key].points.push(point);
        }
      });

      setRoomAppliances(Object.values(applianceMap));
      setError('');
    } catch (err) {
      setError('Ошибка загрузки приборов');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (appliance) => {
    setDraggedAppliance(appliance);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    if (!draggedAppliance) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Преобразуем координаты canvas в координаты плана (в сантиметрах)
    // Масштаб: canvas показывает комнату, где 1px = примерно 1см при масштабе 1:1
    const scale = 1; // 1px = 1см
    const roomX = room.positionX + (x * scale);
    const roomY = room.positionY + (y * scale);

    // Проверяем, что точка находится внутри комнаты
    if (roomX < room.positionX || roomX > room.positionX + room.width ||
        roomY < room.positionY || roomY > room.positionY + room.height) {
      setError('Прибор должен быть размещен внутри помещения');
      setDraggedAppliance(null);
      return;
    }

    try {
      // Определяем правильный electricalSymbolId
      let electricalSymbolId = draggedAppliance.electricalSymbolId;
      
      // Если у прибора нет символа, выбираем подходящий по типу
      if (!electricalSymbolId && electricalSymbols.length > 0) {
        const applianceName = (draggedAppliance.applianceName || draggedAppliance.name || '').toLowerCase();
        
        // Ищем символ по типу прибора
        let symbol = null;
        if (applianceName.includes('свет') || applianceName.includes('ламп') || applianceName.includes('люстр')) {
          symbol = electricalSymbols.find(s => s.type === 'light') || electricalSymbols[0];
        } else if (applianceName.includes('выключ') || applianceName.includes('switch')) {
          symbol = electricalSymbols.find(s => s.type === 'switch') || electricalSymbols[0];
        } else if (applianceName.includes('щит') || applianceName.includes('панел') || applianceName.includes('panel')) {
          symbol = electricalSymbols.find(s => s.type === 'panel') || electricalSymbols[0];
        } else if (applianceName.includes('коробк') || applianceName.includes('junction')) {
          symbol = electricalSymbols.find(s => s.type === 'junction_box') || electricalSymbols[0];
        } else {
          // По умолчанию используем розетку или первый доступный символ
          symbol = electricalSymbols.find(s => s.type === 'outlet') || electricalSymbols[0];
        }
        
        electricalSymbolId = symbol ? symbol.id : null;
      }
      
      // Если все еще нет символа, используем первый доступный
      if (!electricalSymbolId && electricalSymbols.length > 0) {
        electricalSymbolId = electricalSymbols[0].id;
      }
      
      if (!electricalSymbolId) {
        setError('Не найдено доступных электрических символов. Пожалуйста, создайте символы в системе.');
        setDraggedAppliance(null);
        return;
      }

      // Создаем электрическую точку для прибора
      const pointData = {
        electricalSymbolId: electricalSymbolId,
        applianceId: draggedAppliance.id, // ID прибора проекта
        positionX: roomX,
        positionY: roomY,
        rotation: 0,
        heightFromFloor: 90
      };

      await electricalPointAPI.create(projectId, pointData);
      await loadAppliances(); // Перезагружаем данные
      setDraggedAppliance(null);
      setError(''); // Очищаем ошибки при успехе
    } catch (err) {
      setError('Ошибка размещения прибора: ' + (err.response?.data?.message || err.message));
      console.error(err);
      setDraggedAppliance(null);
    }
  };

  const removeAppliance = async (applianceKey) => {
    try {
      const appliance = roomAppliances.find(a => `${a.points[0].positionX}-${a.points[0].positionY}` === applianceKey);
      if (appliance) {
        // Удаляем все точки этого прибора
        for (const point of appliance.points) {
          await electricalPointAPI.delete(projectId, point.id);
        }
        await loadAppliances();
      }
    } catch (err) {
      setError('Ошибка удаления прибора');
      console.error(err);
    }
  };

  const drawRoom = () => {
    const canvas = canvasRef.current;
    if (!canvas || !room) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Рисуем границы комнаты (масштаб: 1px = 1см)
    const scale = 1;
    const canvasWidth = room.width * scale;
    const canvasHeight = room.height * scale;
    
    // Устанавливаем размер canvas
    canvas.width = Math.max(canvasWidth, 400);
    canvas.height = Math.max(canvasHeight, 300);
    
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvasWidth, canvasHeight);

    // Рисуем размещенные приборы
    roomAppliances.forEach(appliance => {
      if (appliance.points.length > 0) {
        const point = appliance.points[0];
        const x = (point.positionX - room.positionX) * scale;
        const y = (point.positionY - room.positionY) * scale;

        // Рисуем символ прибора
        ctx.fillStyle = '#3498db';
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();

        // Подпись
        ctx.fillStyle = '#000';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        const applianceName = appliance.appliance?.applianceName || appliance.appliance?.name || 'Прибор';
        ctx.fillText(applianceName, x, y - 15);
      }
    });
  };

  useEffect(() => {
    drawRoom();
  }, [roomAppliances, room]);

  if (loading) {
    return <div className="loading">Загрузка приборов...</div>;
  }

  return (
    <div className="room-appliances-manager">
      <div className="manager-header">
        <h4>Электроприборы помещения: {room.name}</h4>
        <p className="hint">Перетащите приборы из списка в комнату для размещения</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="appliances-content">
        <div className="appliances-list">
          <h5>Доступные приборы</h5>
          <div className="appliances-grid">
            {projectAppliances.map((appliance) => (
              <div
                key={appliance.id}
                className="appliance-item"
                draggable
                onDragStart={() => handleDragStart(appliance)}
              >
                <div className="appliance-icon">🔌</div>
                <div className="appliance-name">{appliance.applianceName || appliance.name || 'Прибор'}</div>
                <div className="appliance-power">{appliance.powerConsumption || 0}W</div>
              </div>
            ))}
          </div>
        </div>

        <div className="room-canvas-container">
          <h5>Комната (перетащите приборы сюда)</h5>
          <div
            className="room-canvas-wrapper"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <canvas
              ref={canvasRef}
              className="room-appliances-canvas"
              style={{ border: '1px solid #ccc', cursor: 'crosshair' }}
            />
          </div>
        </div>
      </div>

      <div className="placed-appliances">
        <h5>Размещенные приборы ({roomAppliances.length})</h5>
        {roomAppliances.length === 0 ? (
          <div className="empty-state">Нет размещенных приборов</div>
        ) : (
          <div className="placed-appliances-list">
            {roomAppliances.map((appliance, index) => {
              const key = `${appliance.points[0].positionX}-${appliance.points[0].positionY}`;
              return (
                <div key={index} className="placed-appliance-item">
                  <div className="appliance-info">
                    <span className="appliance-name">
                      {appliance.appliance?.applianceName || appliance.appliance?.name || 'Прибор'}
                    </span>
                    <span className="appliance-position">
                      ({appliance.points[0].positionX.toFixed(0)}, {appliance.points[0].positionY.toFixed(0)})
                    </span>
                  </div>
                  <button
                    onClick={() => removeAppliance(key)}
                    className="remove-btn"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomAppliancesManager;
