import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FloorPlanCanvas from '../components/FloorPlanCanvas/FloorPlanCanvas';
import Modal from '../components/UI/Modal';
import ProjectEquipmentList from '../components/ProjectEquipmentList/ProjectEquipmentList';
import RoomPropertiesPanel from '../components/RoomPropertiesPanel/RoomPropertiesPanel';
import RoomEditor from '../components/RoomEditor/RoomEditor';
import CalculationSheet from '../components/CalculationSheet/CalculationSheet';
import { 
  floorPlanAPI, 
  wallAPI, 
  electricalPointAPI, 
  roomAPI,
  projectApplianceAPI,
} from '../api/api';
import './FloorPlanEditor.css';

const FloorPlanEditor = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  // Данные
  const [floorPlan, setFloorPlan] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [walls, setWalls] = useState([]);
  const [electricalPoints, setElectricalPoints] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  
  // Состояние UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTool, setActiveTool] = useState('select');
  const [showSymbolsLibrary, setShowSymbolsLibrary] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [originalState, setOriginalState] = useState(null);

  // Кастомные модалки
  const [modalConfig, setModalConfig] = useState({ show: false, title: '', type: '', message: '', onConfirm: null });
  const [roomFormData, setRoomFormData] = useState({ name: '', roomTypeId: '', positionX: 0, positionY: 0, width: 0, height: 0 });
  const [autoRoomCount, setAutoRoomCount] = useState(1);
  const [selectedObject, setSelectedObject] = useState(null); // {type: 'room'|'wall'|'point', id: number}
  const [projectAppliances, setProjectAppliances] = useState([]);
  const [placingUnplacedRoom, setPlacingUnplacedRoom] = useState(null); // ID комнаты, которую размещаем
  const [pendingRoomCoordinates, setPendingRoomCoordinates] = useState(null); // Координаты для размещения
  const [unplacedRooms, setUnplacedRooms] = useState([]); // Список нерасположенных комнат
  const [showRoomProperties, setShowRoomProperties] = useState(false); // Показать панель свойств комнаты
  const [editingRoomId, setEditingRoomId] = useState(null); // ID комнаты в режиме редактирования

  const loadData = useCallback(async () => {
    try {
      let floorPlanData = null;
      try {
        const fpRes = await floorPlanAPI.get(projectId);
        floorPlanData = fpRes.data;
      } catch (e) {
        if (e.response && e.response.status === 404) {
          const defaultPlan = { width: 1000, height: 800, scale: 1.0 };
          const newFpRes = await floorPlanAPI.createOrUpdate(projectId, defaultPlan);
          floorPlanData = newFpRes.data;
        } else throw e;
      }

      const [roomsRes, wallsRes, pointsRes, roomTypesRes, appliancesRes, symbolsRes] = await Promise.all([
        roomAPI.getByProject(projectId),
        wallAPI.getByProject(projectId).catch(() => ({ data: [] })),
        electricalPointAPI.getByProject(projectId).catch(() => ({ data: [] })),
        roomAPI.getTypes().catch(() => ({ data: [] })),
        projectApplianceAPI.getByProject(projectId).catch(() => ({ data: [] })),
      ]);

      const loadedRooms = roomsRes.data || [];
      setFloorPlan(floorPlanData);
      setRooms(loadedRooms);
      setWalls(wallsRes.data || []);
      setElectricalPoints(pointsRes.data || []);
      setRoomTypes(roomTypesRes.data || []);
      setProjectAppliances(appliancesRes.data || []);
      
      // Обновляем список нерасположенных комнат
      const unplaced = loadedRooms.filter(r => !r.positionX || !r.positionY || !r.width || !r.height);
      setUnplacedRooms(unplaced);
      
      setOriginalState({
        rooms: JSON.parse(JSON.stringify(loadedRooms)),
        walls: JSON.parse(JSON.stringify(wallsRes.data)),
        electricalPoints: JSON.parse(JSON.stringify(pointsRes.data))
      });
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Ошибка загрузки:', err);
      setModalConfig({ 
        show: true, 
        title: 'Ошибка загрузки', 
        type: 'error', 
        message: `Не удалось загрузить данные редактора: ${err.message || 'Неизвестная ошибка'}` 
      });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Обновление данных при возврате на вкладку редактора
  useEffect(() => {
    const handleFocus = () => {
      loadData();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadData]);

  // --- ЛОГИКА КОМНАТ ---

  // Обработчик открытия панели свойств комнаты
  const handleRoomPropertiesOpen = useCallback(() => {
    if (selectedObject && selectedObject.type === 'room') {
      setShowRoomProperties(true);
    }
  }, [selectedObject]);

  // Обработчик закрытия панели свойств
  const handleRoomPropertiesClose = useCallback(() => {
    setShowRoomProperties(false);
  }, []);

  const handleRoomUpdate = async (roomId, updates) => {
    // Если roomId === null, значит нужно выбрать комнату для размещения
    if (roomId === null && updates.positionX !== undefined && updates.positionY !== undefined && 
        updates.width !== undefined && updates.height !== undefined) {
      const unplacedRooms = rooms.filter(r => !r.positionX || !r.positionY || !r.width || !r.height);
      if (unplacedRooms.length > 0) {
        setPendingRoomCoordinates(updates);
        setModalConfig({
          show: true,
          title: 'Выберите помещение для размещения',
          type: 'selectUnplacedRoom',
          message: 'Выберите помещение из списка для размещения на плане:',
          unplacedRooms: unplacedRooms
        });
        return;
      } else {
        setModalConfig({ 
          show: true, 
          title: 'Нет нерасположенных помещений', 
          type: 'info', 
          message: 'Все помещения уже размещены на плане. Добавьте новое помещение в проекте.' 
        });
        return;
      }
    }

    // Если обновляются только координаты (перемещение комнаты)
    if (roomId && updates.positionX !== undefined && updates.positionY !== undefined && 
        updates.width === undefined && updates.height === undefined) {
      try {
        const room = rooms.find(r => r.id === roomId);
        if (!room) return;
        
        await roomAPI.update(projectId, roomId, {
          positionX: updates.positionX,
          positionY: updates.positionY
        });
        
        await loadData();
        setHasUnsavedChanges(true);
      } catch (err) {
        console.error('Ошибка перемещения комнаты:', err);
      }
      return;
    }
    
    // В общем плане мы только выбираем комнату, не редактируем её напрямую
    // Редактирование происходит через панель свойств комнаты
    if (roomId && !showRoomProperties) {
      // Проверяем, является ли комната нерасположенной
      const room = rooms.find(r => r.id === roomId);
      if (room && (!room.positionX || !room.positionY || !room.width || !room.height)) {
        // Нерасположенная комната - показываем инструкцию
        setModalConfig({
          show: true,
          title: 'Нерасположенное помещение',
          type: 'unplacedRooms',
          unplacedRooms: [room]
        });
        return;
      }
      
      // Если комната выбрана, открываем панель свойств для редактирования
      if (selectedObject && selectedObject.type === 'room' && selectedObject.id === roomId) {
        setShowRoomProperties(true);
      }
      return;
    }

    // Если размещаем нерасположенную комнату
    if (placingUnplacedRoom && updates.positionX !== undefined && updates.positionY !== undefined && 
        updates.width !== undefined && updates.height !== undefined) {
      
      // Проверяем на ошибку размера
      if (updates._error) {
        setModalConfig({ 
          show: true, 
          title: 'Ошибка размещения', 
          type: 'error', 
          message: updates._error 
        });
        return;
      }
      
      // Проверяем минимальный размер
      if (updates.width < 40 || updates.height < 40) {
        setModalConfig({ 
          show: true, 
          title: 'Ошибка размещения', 
          type: 'error', 
          message: 'Размер комнаты слишком мал. Минимальный размер: 40x40 см. Пожалуйста, нарисуйте больший прямоугольник.' 
        });
        return;
      }
      
      try {
        const room = rooms.find(r => r.id === placingUnplacedRoom);
        if (!room) {
          setPlacingUnplacedRoom(null);
          setModalConfig({ 
            show: true, 
            title: 'Ошибка', 
            type: 'error', 
            message: 'Комната не найдена' 
          });
          return;
        }

        // Получаем roomTypeId - бэкенд возвращает его напрямую в RoomResponse
        let roomTypeId = null;
        if (room.roomTypeId !== undefined && room.roomTypeId !== null) {
          roomTypeId = typeof room.roomTypeId === 'string' ? parseInt(room.roomTypeId) : room.roomTypeId;
        } else if (room.roomType?.id !== undefined && room.roomType?.id !== null) {
          // Fallback: если roomTypeId нет, пробуем получить из вложенного объекта
          roomTypeId = typeof room.roomType.id === 'string' ? parseInt(room.roomType.id) : room.roomType.id;
        } else if (roomTypes && roomTypes.length > 0) {
          // Fallback: используем первый доступный тип комнаты
          roomTypeId = typeof roomTypes[0].id === 'string' ? parseInt(roomTypes[0].id) : roomTypes[0].id;
        }

        if (!roomTypeId || roomTypeId === 0) {
          setModalConfig({ 
            show: true, 
            title: 'Ошибка', 
            type: 'error', 
            message: 'Не удалось определить тип помещения. Пожалуйста, убедитесь, что типы помещений созданы в системе.' 
          });
          setPlacingUnplacedRoom(null);
          return;
        }

        const updatedData = {
          name: room.name,
          roomTypeId: roomTypeId,
          area: (updates.width * updates.height) / 10000,
          ...updates
        };

        await roomAPI.update(projectId, placingUnplacedRoom, updatedData);

        // Создаем стены для комнаты
        const x = updates.positionX;
        const y = updates.positionY;
        const w = updates.width;
        const h = updates.height;

        // Проверяем существующие стены перед созданием новых
        const tolerance = 5;
        const wallsToCreate = [];
        const potentialWalls = [
          { startX: x, startY: y, endX: x + w, endY: y },
          { startX: x + w, startY: y, endX: x + w, endY: y + h },
          { startX: x + w, startY: y + h, endX: x, endY: y + h },
          { startX: x, startY: y + h, endX: x, endY: y }
        ];

        potentialWalls.forEach(potentialWall => {
          // Проверяем, существует ли уже стена на этих координатах
          const exists = walls.some(existingWall => {
            if (existingWall.wallType !== 'external') return false;
            const exStartX = parseFloat(existingWall.startX);
            const exStartY = parseFloat(existingWall.startY);
            const exEndX = parseFloat(existingWall.endX);
            const exEndY = parseFloat(existingWall.endY);
            
            // Проверяем совпадение координат (с учетом возможного обратного направления)
            const matchesForward = Math.abs(exStartX - potentialWall.startX) < tolerance &&
                                  Math.abs(exStartY - potentialWall.startY) < tolerance &&
                                  Math.abs(exEndX - potentialWall.endX) < tolerance &&
                                  Math.abs(exEndY - potentialWall.endY) < tolerance;
            const matchesReverse = Math.abs(exStartX - potentialWall.endX) < tolerance &&
                                   Math.abs(exStartY - potentialWall.endY) < tolerance &&
                                   Math.abs(exEndX - potentialWall.startX) < tolerance &&
                                   Math.abs(exEndY - potentialWall.startY) < tolerance;
            
            return matchesForward || matchesReverse;
          });
          
          if (!exists) {
            wallsToCreate.push({
              ...potentialWall,
              wallType: 'external'
            });
          }
        });

        if (wallsToCreate.length > 0) {
          await wallAPI.saveBatch(projectId, wallsToCreate);
        }
        
        setPlacingUnplacedRoom(null);
        setPendingRoomCoordinates(null);
        await loadData();
        setHasUnsavedChanges(true);
        setModalConfig({ 
          show: true, 
          title: 'Успех', 
          type: 'info', 
          message: `Помещение "${room.name}" успешно размещено на плане!` 
        });
      } catch (err) {
        console.error('Ошибка размещения комнаты:', err);
        setModalConfig({ show: true, title: 'Ошибка', type: 'error', message: 'Не удалось разместить комнату' });
        setPlacingUnplacedRoom(null);
      }
      return;
    }

    if (roomId === null) {
      // Создание новой комнаты или выбор существующей нерасположенной
      const unplacedRooms = rooms.filter(r => !r.positionX || !r.positionY || !r.width || !r.height);
      
      // Если создаем комнату через стены
      if (updates.walls && Array.isArray(updates.walls) && updates.walls.length >= 4) {
        // Проверяем наличие типов комнат
        if (!roomTypes || roomTypes.length === 0) {
          setModalConfig({ show: true, title: 'Ошибка', type: 'error', message: 'Не найдено типов помещений. Пожалуйста, создайте хотя бы один тип помещения в системе.' });
          return;
        }
        
        const firstRoomTypeId = typeof roomTypes[0].id === 'string' 
          ? parseInt(roomTypes[0].id) 
          : roomTypes[0].id;
          
        setRoomFormData({
          name: `Помещение ${rooms.length + 1}`,
          roomTypeId: firstRoomTypeId,
          positionX: updates.positionX,
          positionY: updates.positionY,
          width: updates.width,
          height: updates.height,
          walls: updates.walls // Сохраняем стены для создания
        });
        setModalConfig({ show: true, title: 'Настройка нового помещения', type: 'roomForm' });
        return;
      }
      
      if (unplacedRooms.length > 0 && updates.positionX !== undefined) {
        // Есть нерасположенные комнаты и мы рисуем на плане - предлагаем выбрать
        setPendingRoomCoordinates(updates);
        setModalConfig({ 
          show: true, 
          title: 'Выберите помещение для размещения', 
          type: 'selectUnplacedRoom',
          unplacedRooms: unplacedRooms
        });
        return;
      }

      // Создание новой комнаты
      // Проверяем наличие типов комнат
      if (!roomTypes || roomTypes.length === 0) {
        setModalConfig({ show: true, title: 'Ошибка', type: 'error', message: 'Не найдено типов помещений. Пожалуйста, создайте хотя бы один тип помещения в системе.' });
        return;
      }
      
      const firstRoomTypeId = typeof roomTypes[0].id === 'string' 
        ? parseInt(roomTypes[0].id) 
        : roomTypes[0].id;
        
      setRoomFormData({
        name: `Помещение ${rooms.length + 1}`,
        roomTypeId: firstRoomTypeId,
        ...updates
      });
      setModalConfig({ show: true, title: 'Настройка нового помещения', type: 'roomForm' });
    } else {
      // Обновление существующей комнаты
      try {
        const room = rooms.find(r => r.id === roomId);
        if (!room) return;
        
        const currentRoomTypeId = room.roomType?.id || (roomTypes && roomTypes.length > 0 ? roomTypes[0].id : null);
        if (!currentRoomTypeId) {
          console.error('Не найден тип комнаты для обновления');
          return;
        }
        
        const roomTypeId = typeof currentRoomTypeId === 'string' 
          ? parseInt(currentRoomTypeId) 
          : currentRoomTypeId;
        
        // Проверяем, изменились ли размеры или позиция комнаты
        const sizeChanged = (updates.width !== undefined && updates.width !== room.width) ||
                           (updates.height !== undefined && updates.height !== room.height);
        const positionChanged = (updates.positionX !== undefined && updates.positionX !== room.positionX) ||
                               (updates.positionY !== undefined && updates.positionY !== room.positionY);
        
        const updatedData = {
          name: room.name,
          roomTypeId: roomTypeId,
          area: ((updates.width || room.width) * (updates.height || room.height)) / 10000,
          ...updates
        };
        
        await roomAPI.update(projectId, roomId, updatedData);
        
        // Если изменились размеры, обновляем внешние стены
        if (sizeChanged) {
          const finalX = room.positionX; // Координаты не меняются через свойства
          const finalY = room.positionY;
          const finalWidth = updates.width !== undefined ? updates.width : room.width;
          const finalHeight = updates.height !== undefined ? updates.height : room.height;
          
          // Находим внешние стены комнаты
          const tolerance = 10;
          const oldRoomBounds = {
            left: room.positionX,
            right: room.positionX + room.width,
            top: room.positionY,
            bottom: room.positionY + room.height
          };
          
          const roomExternalWalls = walls.filter(w => {
            if (w.wallType !== 'external') return false;
            // Проверяем, является ли стена границей старой комнаты
            return (Math.abs(w.startY - oldRoomBounds.top) < tolerance && Math.abs(w.endY - oldRoomBounds.top) < tolerance) ||
                   (Math.abs(w.startY - oldRoomBounds.bottom) < tolerance && Math.abs(w.endY - oldRoomBounds.bottom) < tolerance) ||
                   (Math.abs(w.startX - oldRoomBounds.left) < tolerance && Math.abs(w.endX - oldRoomBounds.left) < tolerance) ||
                   (Math.abs(w.startX - oldRoomBounds.right) < tolerance && Math.abs(w.endX - oldRoomBounds.right) < tolerance);
          });
          
          // Обновляем каждую внешнюю стену
          for (const wall of roomExternalWalls) {
            let newStartX, newStartY, newEndX, newEndY;
            
            // Определяем, на какой границе находится стена, и обновляем её координаты
            if (Math.abs(wall.startY - oldRoomBounds.top) < tolerance && Math.abs(wall.endY - oldRoomBounds.top) < tolerance) {
              // Верхняя стена
              newStartX = finalX;
              newStartY = finalY;
              newEndX = finalX + finalWidth;
              newEndY = finalY;
            } else if (Math.abs(wall.startY - oldRoomBounds.bottom) < tolerance && Math.abs(wall.endY - oldRoomBounds.bottom) < tolerance) {
              // Нижняя стена
              newStartX = finalX + finalWidth;
              newStartY = finalY + finalHeight;
              newEndX = finalX;
              newEndY = finalY + finalHeight;
            } else if (Math.abs(wall.startX - oldRoomBounds.left) < tolerance && Math.abs(wall.endX - oldRoomBounds.left) < tolerance) {
              // Левая стена
              newStartX = finalX;
              newStartY = finalY + finalHeight;
              newEndX = finalX;
              newEndY = finalY;
            } else if (Math.abs(wall.startX - oldRoomBounds.right) < tolerance && Math.abs(wall.endX - oldRoomBounds.right) < tolerance) {
              // Правая стена
              newStartX = finalX + finalWidth;
              newStartY = finalY;
              newEndX = finalX + finalWidth;
              newEndY = finalY + finalHeight;
            } else {
              continue; // Пропускаем стены, которые не являются границами
            }
            
            try {
              await wallAPI.update(projectId, wall.id, {
                startX: newStartX,
                startY: newStartY,
                endX: newEndX,
                endY: newEndY,
                thickness: wall.thickness || 20,
                wallType: 'external',
                roomId: null,
                openings: wall.openings || []
              });
            } catch (err) {
              console.error('Ошибка обновления стены:', err);
            }
          }
          
          // Перезагружаем стены после обновления
          try {
            const wallsRes = await wallAPI.getByProject(projectId);
            setWalls(wallsRes.data || []);
          } catch (err) {
            console.error('Ошибка перезагрузки стен:', err);
          }
        }
        
        await loadData();
        setHasUnsavedChanges(true);
        // Закрываем панель свойств после успешного обновления
        setShowRoomProperties(false);
      } catch (err) {
        console.error('Ошибка обновления комнаты:', err);
        setModalConfig({ 
          show: true, 
          title: 'Ошибка', 
          type: 'error', 
          message: err.response?.data?.message || 'Не удалось обновить помещение' 
        });
      }
    }
  };

  const confirmRoomCreation = async () => {
    try {
      // Проверяем наличие типа комнаты
      if (!roomFormData.roomTypeId || roomFormData.roomTypeId === '') {
        setModalConfig({ show: true, title: 'Ошибка', type: 'error', message: 'Необходимо выбрать тип помещения. Пожалуйста, убедитесь, что типы помещений созданы в системе.' });
        return;
      }

      setSaving(true);
      // Преобразуем roomTypeId в число, если это строка
      const roomTypeId = typeof roomFormData.roomTypeId === 'string' 
        ? parseInt(roomFormData.roomTypeId) 
        : roomFormData.roomTypeId;

      // 1. Создаем комнату
      const roomRes = await roomAPI.create(projectId, {
        ...roomFormData,
        roomTypeId: roomTypeId,
        area: (roomFormData.width * roomFormData.height) / 10000
      });
      
      // 2. Генерируем стены (замкнутый контур)
      let wallsToCreate = [];
      
      if (roomFormData.walls && Array.isArray(roomFormData.walls) && roomFormData.walls.length >= 4) {
        // Используем стены, переданные из редактора (создание через 4 стены)
        wallsToCreate = roomFormData.walls.map(wall => ({
          startX: wall.startX,
          startY: wall.startY,
          endX: wall.endX,
          endY: wall.endY,
          wallType: 'internal',
          thickness: 20
        }));
      } else {
        // Генерируем 4 стены для прямоугольной комнаты
        const x = roomFormData.positionX;
        const y = roomFormData.positionY;
        const w = roomFormData.width;
        const h = roomFormData.height;

        wallsToCreate = [
          { startX: x, startY: y, endX: x + w, endY: y, wallType: 'internal', thickness: 20 },
          { startX: x + w, startY: y, endX: x + w, endY: y + h, wallType: 'internal', thickness: 20 },
          { startX: x + w, startY: y + h, endX: x, endY: y + h, wallType: 'internal', thickness: 20 },
          { startX: x, startY: y + h, endX: x, endY: y, wallType: 'internal', thickness: 20 }
        ];
      }

      await wallAPI.saveBatch(projectId, wallsToCreate);
      
      await loadData();
      setModalConfig({ ...modalConfig, show: false });
      setHasUnsavedChanges(true);
    } catch (err) {
      setModalConfig({ ...modalConfig, show: true, type: 'error', message: 'Не удалось создать комнату' });
    } finally {
      setSaving(false);
    }
  };

  // --- АВТОФОРМИРОВАНИЕ КОМНАТ ---

  const handleAutoCreateRooms = async () => {
    if (autoRoomCount < 1 || autoRoomCount > 20) {
      setModalConfig({ show: true, title: 'Ошибка', type: 'error', message: 'Количество комнат должно быть от 1 до 20' });
      return;
    }

    // Проверяем наличие типов комнат
    if (!roomTypes || roomTypes.length === 0) {
      setModalConfig({ show: true, title: 'Ошибка', type: 'error', message: 'Не найдено типов помещений. Пожалуйста, создайте хотя бы один тип помещения в системе перед созданием комнат.' });
      return;
    }

    try {
      setSaving(true);
      const defaultRoomWidth = 300; // см
      const defaultRoomHeight = 300; // см
      const spacing = 50; // см между комнатами
      const startX = 100;
      const startY = 100;
      
      const roomsPerRow = Math.ceil(Math.sqrt(autoRoomCount));
      const createdRooms = [];
      
      // Получаем ID первого типа комнаты
      const firstRoomTypeId = typeof roomTypes[0].id === 'string' 
        ? parseInt(roomTypes[0].id) 
        : roomTypes[0].id;

      for (let i = 0; i < autoRoomCount; i++) {
        const row = Math.floor(i / roomsPerRow);
        const col = i % roomsPerRow;
        
        const x = startX + col * (defaultRoomWidth + spacing);
        const y = startY + row * (defaultRoomHeight + spacing);
        
        const roomData = {
          name: `Помещение ${rooms.length + i + 1}`,
          roomTypeId: firstRoomTypeId,
          positionX: x,
          positionY: y,
          width: defaultRoomWidth,
          height: defaultRoomHeight,
          area: (defaultRoomWidth * defaultRoomHeight) / 10000
        };

        const roomRes = await roomAPI.create(projectId, roomData);
        createdRooms.push(roomRes.data);

        // Создаем стены для комнаты
        const wallsToCreate = [
          { startX: x, startY: y, endX: x + defaultRoomWidth, endY: y, wallType: 'internal' },
          { startX: x + defaultRoomWidth, startY: y, endX: x + defaultRoomWidth, endY: y + defaultRoomHeight, wallType: 'internal' },
          { startX: x + defaultRoomWidth, startY: y + defaultRoomHeight, endX: x, endY: y + defaultRoomHeight, wallType: 'internal' },
          { startX: x, startY: y + defaultRoomHeight, endX: x, endY: y, wallType: 'internal' }
        ];

        await wallAPI.saveBatch(projectId, wallsToCreate);
      }

      await loadData();
      setModalConfig({ show: false });
      setTimeout(() => {
        setModalConfig({ show: true, title: 'Успех', type: 'info', message: `Создано ${autoRoomCount} комнат` });
      }, 100);
      setHasUnsavedChanges(true);
    } catch (err) {
      console.error('Ошибка автосоздания комнат:', err);
      setModalConfig({ show: true, title: 'Ошибка', type: 'error', message: 'Не удалось создать комнаты' });
    } finally {
      setSaving(false);
    }
  };

  // --- УДАЛЕНИЕ ОБЪЕКТОВ ---

  const handleDeleteObject = async () => {
    if (!selectedObject) return;

    try {
      setSaving(true);
      // Закрываем модальное окно сразу
      setModalConfig({ show: false });
      
      if (selectedObject.type === 'room') {
        // Вместо удаления помечаем комнату как неразмещенную
        const room = rooms.find(r => r.id === selectedObject.id);
        if (!room) return;
        
        // Получаем roomTypeId
        let roomTypeId = null;
        if (room.roomTypeId !== undefined && room.roomTypeId !== null) {
          roomTypeId = typeof room.roomTypeId === 'string' ? parseInt(room.roomTypeId) : room.roomTypeId;
        } else if (room.roomType?.id !== undefined && room.roomType?.id !== null) {
          roomTypeId = typeof room.roomType.id === 'string' ? parseInt(room.roomType.id) : room.roomType.id;
        } else if (roomTypes && roomTypes.length > 0) {
          roomTypeId = typeof roomTypes[0].id === 'string' ? parseInt(roomTypes[0].id) : roomTypes[0].id;
        }
        
        if (!roomTypeId) {
          setModalConfig({ show: true, title: 'Ошибка', type: 'error', message: 'Не удалось определить тип помещения' });
          setSaving(false);
          return;
        }
        
        // Обновляем комнату, очищая координаты (помечаем как неразмещенную)
        await roomAPI.update(projectId, selectedObject.id, {
          name: room.name,
          roomTypeId: roomTypeId,
          area: room.area || null,
          description: room.description || null,
          positionX: null,
          positionY: null,
          width: null,
          height: null,
          polygonPoints: null
        });
        
        // Удаляем связанные стены (внешние стены комнаты)
        const roomWalls = walls.filter(w => {
          if (!room.positionX || !room.positionY || !room.width || !room.height) return false;
          // Удаляем только внешние стены (wallType === 'external')
          if (w.wallType !== 'external') return false;
          const tolerance = 10;
          const roomBounds = {
            left: room.positionX,
            right: room.positionX + room.width,
            top: room.positionY,
            bottom: room.positionY + room.height
          };
          // Проверяем, является ли стена границей комнаты
          const isOnBoundary = 
            (Math.abs(w.startY - roomBounds.top) < tolerance && Math.abs(w.endY - roomBounds.top) < tolerance) ||
            (Math.abs(w.startY - roomBounds.bottom) < tolerance && Math.abs(w.endY - roomBounds.bottom) < tolerance) ||
            (Math.abs(w.startX - roomBounds.left) < tolerance && Math.abs(w.endX - roomBounds.left) < tolerance) ||
            (Math.abs(w.startX - roomBounds.right) < tolerance && Math.abs(w.endX - roomBounds.right) < tolerance);
          return isOnBoundary;
        });
        for (const wall of roomWalls) {
          await wallAPI.delete(projectId, wall.id);
        }
        
        // Удаляем все электрические точки, которые находятся внутри комнаты
        const roomPoints = electricalPoints.filter(point => {
          if (!room.positionX || !room.positionY || !room.width || !room.height) return false;
          return point.positionX >= room.positionX &&
                 point.positionX <= room.positionX + room.width &&
                 point.positionY >= room.positionY &&
                 point.positionY <= room.positionY + room.height;
        });
        for (const point of roomPoints) {
          await electricalPointAPI.delete(projectId, point.id);
        }
      } else if (selectedObject.type === 'wall') {
        // Стены удаляем полностью
        await wallAPI.delete(projectId, selectedObject.id);
      } else if (selectedObject.type === 'point') {
        // Электрические точки удаляем полностью
        await electricalPointAPI.delete(projectId, selectedObject.id);
      }
      
      setSelectedObject(null);
      await loadData();
      setHasUnsavedChanges(true);
      setModalConfig({ 
        show: true, 
        title: 'Успех', 
        type: 'info', 
        message: selectedObject.type === 'room' 
          ? 'Помещение удалено с плана и помечено как неразмещенное. Вы можете разместить его снова позже.' 
          : 'Объект удален' 
      });
    } catch (err) {
      console.error('Ошибка удаления:', err);
      setModalConfig({ show: true, title: 'Ошибка', type: 'error', message: 'Не удалось удалить объект' });
    } finally {
      setSaving(false);
    }
  };

  // --- ОБРАБОТЧИКИ СОБЫТИЙ ---

  const handleWallCreate = async (wallData) => {
    try {
      const res = await wallAPI.create(projectId, wallData);
      setWalls([...walls, res.data]);
      setHasUnsavedChanges(true);
    } catch (err) { console.error(err); }
  };

  const handleElectricalPointCreate = async (pointData) => {
    // Эта функция больше не используется в главном редакторе
    // Размещение оборудования происходит только в редакторе комнат
    console.warn('handleElectricalPointCreate вызвана, но размещение оборудования должно происходить в редакторе комнат');
  };

  const handleElectricalPointUpdate = async (pointId, updates) => {
    try {
      await electricalPointAPI.update(projectId, pointId, updates);
      setHasUnsavedChanges(true);
      await loadData();
    } catch (err) {
      console.error('Ошибка обновления электрической точки:', err);
    }
  };

  const handleWallUpdate = async (wallId, updates) => {
    try {
      await wallAPI.update(projectId, wallId, updates);
      setHasUnsavedChanges(true);
      await loadData();
    } catch (err) {
      console.error('Ошибка обновления стены:', err);
    }
  };

  // Обработка клавиатуры для удаления
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Проверяем, что фокус не на input/textarea/select элементах
      const target = e.target;
      const isInputElement = target.tagName === 'INPUT' || 
                             target.tagName === 'TEXTAREA' || 
                             target.tagName === 'SELECT' ||
                             target.isContentEditable ||
                             target.closest('.room-properties-panel'); // Исключаем панель свойств
      
      if ((e.key === 'Delete' || e.key === 'Backspace') && 
          selectedObject && 
          !modalConfig.show && 
          !isInputElement &&
          !showRoomProperties) { // Не удаляем, если открыта панель свойств
        e.preventDefault();
        setModalConfig({
          show: true,
          title: 'Удаление',
          type: 'confirm',
          message: `Вы уверены, что хотите удалить этот объект?`,
          onConfirm: handleDeleteObject
        });
      }
      
      // ESC закрывает панель свойств
      if (e.key === 'Escape' && showRoomProperties) {
        setShowRoomProperties(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObject, modalConfig.show, showRoomProperties]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await loadData();
      setModalConfig({ show: true, title: 'Успех', type: 'info', message: 'Проект успешно сохранен!' });
    } catch (err) {
      setModalConfig({ show: true, title: 'Ошибка', type: 'info', message: 'Ошибка при сохранении' });
    } finally { setSaving(false); }
  };

  const handleExitClick = () => {
    if (hasUnsavedChanges) {
      setModalConfig({
        show: true,
        title: 'Выход',
        type: 'confirm',
        message: 'У вас есть несохраненные изменения. Выйти без сохранения?',
        onConfirm: () => navigate(`/projects/${projectId}`)
      });
    } else {
      navigate(`/projects/${projectId}`);
    }
  };

  if (loading) return <div className="floor-plan-editor-loading">Загрузка редактора...</div>;

  return (
    <div className="floor-plan-editor">
      {/* Кастомные модалки */}
      <Modal 
        show={modalConfig.show} 
        title={modalConfig.title} 
        onClose={() => {
          if (modalConfig.type === 'selectUnplacedRoom') {
            setPendingRoomCoordinates(null);
          }
          setModalConfig({ ...modalConfig, show: false });
        }}
        onConfirm={
          modalConfig.type === 'roomForm' 
            ? confirmRoomCreation 
            : modalConfig.type === 'unplacedRooms' ? () => setModalConfig({ ...modalConfig, show: false })
            : modalConfig.type === 'selectUnplacedRoom' ? () => {
                setPendingRoomCoordinates(null);
                setModalConfig({ ...modalConfig, show: false });
              }
            : modalConfig.onConfirm
        }
        confirmText={
          modalConfig.type === 'roomForm' ? "Создать" : 
          modalConfig.type === 'unplacedRooms' ? "Закрыть" :
          modalConfig.type === 'selectUnplacedRoom' ? "Отмена" :
          "Ок"
        }
      >
        {modalConfig.type === 'roomForm' ? (
          <div className="custom-modal-form">
            <div className="form-group">
              <label>Название помещения</label>
              <input 
                type="text" 
                value={roomFormData.name} 
                onChange={e => setRoomFormData({...roomFormData, name: e.target.value})} 
              />
            </div>
            <div className="form-group">
              <label>Тип</label>
              <select 
                value={roomFormData.roomTypeId} 
                onChange={e => setRoomFormData({...roomFormData, roomTypeId: e.target.value})}
              >
                {roomTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
        ) : modalConfig.type === 'autoRooms' ? (
          <div className="custom-modal-form">
            <div className="form-group">
              <label>Количество комнат (1-20)</label>
              <input 
                type="number" 
                min="1" 
                max="20" 
                value={autoRoomCount} 
                onChange={e => setAutoRoomCount(parseInt(e.target.value) || 1)} 
              />
              <p style={{fontSize: '12px', color: '#666', marginTop: '5px'}}>
                Комнаты будут созданы в виде сетки с автоматическим размещением
              </p>
            </div>
          </div>
        ) : modalConfig.type === 'unplacedRooms' ? (
          <div className="unplaced-rooms-list">
            <p style={{marginBottom: '15px', fontWeight: 'bold', color: '#2c3e50'}}>
              Инструкция по размещению:
            </p>
            <ol style={{marginBottom: '15px', paddingLeft: '20px', lineHeight: '1.8'}}>
              <li>Нажмите кнопку <strong>"Разместить комнату"</strong> в панели инструментов</li>
              <li>На плане: зажмите левую кнопку мыши и перетащите, чтобы нарисовать прямоугольник</li>
              <li>Вы увидите полупрозрачный прямоугольник с размерами во время рисования</li>
              <li>Отпустите кнопку мыши, чтобы завершить рисование</li>
              <li>После этого откроется окно со списком нерасположенных помещений</li>
              <li>Выберите помещение из списка для размещения в нарисованной области</li>
              <li>Минимальный размер: 40x40 см</li>
            </ol>
            <div className="unplaced-rooms-grid">
              {modalConfig.unplacedRooms?.map(room => (
                <div 
                  key={room.id} 
                  className="unplaced-room-item"
                  style={{ cursor: 'default', pointerEvents: 'none' }}
                >
                  <div className="room-name">{room.name}</div>
                  <div className="room-type">{room.roomTypeName || 'Тип не указан'}</div>
                  {room.area && <div className="room-area">Площадь: {parseFloat(room.area).toFixed(2)} м²</div>}
                </div>
              ))}
            </div>
          </div>
        ) : modalConfig.type === 'selectUnplacedRoom' ? (
          <div className="unplaced-rooms-list">
            <p style={{marginBottom: '15px'}}>
              Выберите помещение для размещения на плане по указанным координатам.
            </p>
            <div className="unplaced-rooms-grid">
              {modalConfig.unplacedRooms?.map(room => (
                <div 
                  key={room.id} 
                  className="unplaced-room-item"
                  style={{ cursor: 'pointer' }}
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (!pendingRoomCoordinates) {
                      console.error('Нет координат для размещения');
                      return;
                    }
                    
                    try {
                      setSaving(true);
                      const roomData = modalConfig.unplacedRooms.find(r => r.id === room.id);
                      if (!roomData) {
                        setSaving(false);
                        return;
                      }

                      // Получаем roomTypeId - бэкенд возвращает его напрямую в RoomResponse
                      let roomTypeId = null;
                      if (roomData.roomTypeId !== undefined && roomData.roomTypeId !== null) {
                        roomTypeId = typeof roomData.roomTypeId === 'string' 
                          ? parseInt(roomData.roomTypeId) 
                          : roomData.roomTypeId;
                      } else if (roomData.roomType?.id !== undefined && roomData.roomType?.id !== null) {
                        // Fallback: если roomTypeId нет, пробуем получить из вложенного объекта
                        roomTypeId = typeof roomData.roomType.id === 'string' 
                          ? parseInt(roomData.roomType.id) 
                          : roomData.roomType.id;
                      } else if (roomTypes && roomTypes.length > 0) {
                        // Fallback: используем первый доступный тип комнаты
                        roomTypeId = typeof roomTypes[0].id === 'string' 
                          ? parseInt(roomTypes[0].id) 
                          : roomTypes[0].id;
                      }

                      if (!roomTypeId || roomTypeId === 0) {
                        setModalConfig({ 
                          show: true, 
                          title: 'Ошибка', 
                          type: 'error', 
                          message: 'Не удалось определить тип помещения. Пожалуйста, убедитесь, что типы помещений созданы в системе.' 
                        });
                        setSaving(false);
                        return;
                      }

                      const updatedData = {
                        name: roomData.name,
                        roomTypeId: roomTypeId,
                        area: (pendingRoomCoordinates.width * pendingRoomCoordinates.height) / 10000,
                        ...pendingRoomCoordinates
                      };

                      await roomAPI.update(projectId, roomData.id, updatedData);

                      // Создаем внешние стены для комнаты
                      const x = pendingRoomCoordinates.positionX;
                      const y = pendingRoomCoordinates.positionY;
                      const w = pendingRoomCoordinates.width;
                      const h = pendingRoomCoordinates.height;

                      // Проверяем существующие стены перед созданием новых
                      const tolerance = 5;
                      const wallsToCreate = [];
                      const potentialWalls = [
                        { startX: x, startY: y, endX: x + w, endY: y },
                        { startX: x + w, startY: y, endX: x + w, endY: y + h },
                        { startX: x + w, startY: y + h, endX: x, endY: y + h },
                        { startX: x, startY: y + h, endX: x, endY: y }
                      ];

                      potentialWalls.forEach(potentialWall => {
                        // Проверяем, существует ли уже стена на этих координатах
                        const exists = walls.some(existingWall => {
                          if (existingWall.wallType !== 'external') return false;
                          const exStartX = parseFloat(existingWall.startX);
                          const exStartY = parseFloat(existingWall.startY);
                          const exEndX = parseFloat(existingWall.endX);
                          const exEndY = parseFloat(existingWall.endY);
                          
                          // Проверяем совпадение координат (с учетом возможного обратного направления)
                          const matchesForward = Math.abs(exStartX - potentialWall.startX) < tolerance &&
                                                Math.abs(exStartY - potentialWall.startY) < tolerance &&
                                                Math.abs(exEndX - potentialWall.endX) < tolerance &&
                                                Math.abs(exEndY - potentialWall.endY) < tolerance;
                          const matchesReverse = Math.abs(exStartX - potentialWall.endX) < tolerance &&
                                                 Math.abs(exStartY - potentialWall.endY) < tolerance &&
                                                 Math.abs(exEndX - potentialWall.startX) < tolerance &&
                                                 Math.abs(exEndY - potentialWall.startY) < tolerance;
                          
                          return matchesForward || matchesReverse;
                        });
                        
                        if (!exists) {
                          wallsToCreate.push({
                            ...potentialWall,
                            wallType: 'external'
                          });
                        }
                      });

                      if (wallsToCreate.length > 0) {
                        await wallAPI.saveBatch(projectId, wallsToCreate);
                      }
                      
                      setPendingRoomCoordinates(null);
                      
                      // Обновляем данные и список нерасположенных комнат
                      await loadData();
                      
                      setHasUnsavedChanges(true);
                      setModalConfig({ show: false });
                    } catch (err) {
                      console.error('Ошибка размещения комнаты:', err);
                      setModalConfig({ show: true, title: 'Ошибка', type: 'error', message: 'Не удалось разместить комнату' });
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  <div className="room-name">{room.name}</div>
                  <div className="room-type">{room.roomTypeName || 'Тип не указан'}</div>
                  {room.area && <div className="room-area">Площадь: {parseFloat(room.area).toFixed(2)} м²</div>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <p style={{whiteSpace: 'pre-line', margin: 0}}>{modalConfig.message}</p>
          </div>
        )}
      </Modal>

      <div className="floor-plan-editor-header">
        <h2>Редактор: {projectId}</h2>
        <div className="editor-controls">
          <button
            onClick={() => navigate(`/projects/${projectId}/floor-plan/3d`)}
            className="btn-primary"
            title="Открыть полноэкранный 3D редактор"
          >
            Открыть 3D
          </button>
          {unplacedRooms.length > 0 && (
            <button 
              onClick={() => {
                setModalConfig({ 
                  show: true, 
                  title: 'Нерасположенные помещения', 
                  type: 'unplacedRooms',
                  unplacedRooms: unplacedRooms
                });
              }} 
              className="btn-secondary"
            >
              Нерасположенные ({unplacedRooms.length})
            </button>
          )}
          {selectedObject && (
            <button 
              onClick={() => {
                const message = selectedObject.type === 'room' 
                  ? 'Вы уверены, что хотите удалить это помещение с плана? Помещение будет помечено как неразмещенное и останется в проекте.'
                  : `Вы уверены, что хотите удалить этот объект?`;
                setModalConfig({
                  show: true,
                  title: selectedObject.type === 'room' ? 'Удаление с плана' : 'Удаление',
                  type: 'confirm',
                  message: message,
                  onConfirm: handleDeleteObject
                });
              }} 
              className="btn-secondary"
            >
              {selectedObject && selectedObject.type === 'room' ? 'Удалить с плана' : 'Удалить выбранное'}
            </button>
          )}
          {hasUnsavedChanges && <span className="unsaved-indicator">Есть изменения</span>}
          <button onClick={handleSave} className="btn-primary" disabled={saving}>Сохранить</button>
          <button onClick={handleExitClick} className="btn-secondary">Выйти</button>
        </div>
      </div>

      <div className="floor-plan-editor-content">
        <div className="floor-plan-editor-main">
          <FloorPlanCanvas
            projectId={projectId}
            width={floorPlan?.width}
            height={floorPlan?.height}
            scale={floorPlan?.scale}
            rooms={rooms}
            walls={walls}
            electricalPoints={electricalPoints}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            onWallCreate={handleWallCreate}
            onWallUpdate={handleWallUpdate}
            onElectricalPointUpdate={handleElectricalPointUpdate}
            onRoomUpdate={handleRoomUpdate}
            selectedObject={selectedObject}
            setSelectedObject={setSelectedObject}
            onDeleteObject={handleDeleteObject}
            showSymbolsLibrary={showSymbolsLibrary}
            placingUnplacedRoom={placingUnplacedRoom}
            onRoomDoubleClick={(roomId) => {
              // Проверяем, что комната размещена на плане
              const room = rooms.find(r => r.id === roomId);
              if (room && room.positionX != null && room.positionY != null && 
                  room.width != null && room.height != null) {
                setEditingRoomId(roomId);
              }
            }}
          />
        </div>

        {showSymbolsLibrary && (
          <div className={`floor-plan-editor-sidebar ${!sidebarExpanded ? 'collapsed' : ''}`}>
            {sidebarExpanded ? (
              <>
                <div className="sidebar-header">
                  <button onClick={() => setSidebarExpanded(false)} title="Свернуть">◄</button>
                </div>
                <div className="sidebar-scroll-content">
                  <ProjectEquipmentList
                    projectId={projectId}
                    electricalPoints={electricalPoints}
                    projectAppliances={projectAppliances}
                    rooms={rooms}
                  />
                </div>
              </>
            ) : (
              <div className="sidebar-collapsed-header">
                <button onClick={() => setSidebarExpanded(true)} title="Развернуть">►</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Панель свойств комнаты */}
      {showRoomProperties && selectedObject && selectedObject.type === 'room' && (
        <RoomPropertiesPanel
          projectId={projectId}
          room={rooms.find(r => r.id === selectedObject.id)}
          roomTypes={roomTypes}
          onUpdate={handleRoomUpdate}
          onClose={handleRoomPropertiesClose}
        />
      )}

      {/* Полноэкранный редактор комнаты */}
      {editingRoomId && (
        <RoomEditor
          projectId={projectId}
          roomId={editingRoomId}
          onClose={() => {
            setEditingRoomId(null);
            loadData(); // Обновляем данные после закрытия редактора
          }}
          onRoomUpdate={() => {
            loadData(); // Обновляем данные после изменения комнаты
          }}
        />
      )}
    </div>
  );
};

export default FloorPlanEditor;