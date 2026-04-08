import React, { useRef, useEffect, useState, useCallback } from 'react';
import { roomAPI, wallAPI, electricalPointAPI, projectApplianceAPI, electricalSymbolAPI, applianceAPI } from '../../api/api';
import ProjectAppliancesList from '../ProjectAppliancesList/ProjectAppliancesList';
import Modal from '../UI/Modal';
import { 
  validateProhibitedRoomsForSockets, 
  validateDistanceToGasPipe,
  validateHeightForChildrenInstitutions 
} from '../../utils/tkp339Validations';
import './RoomLayoutEditor.css';

// Загружаем изображения для розеток и ламп
const socketImage = new Image();
socketImage.src = `${process.env.PUBLIC_URL || ''}/socket32.png`;

const lightbulbImage = new Image();
lightbulbImage.src = `${process.env.PUBLIC_URL || ''}/lightbulb32.png`;

// Обработчики загрузки изображений будут установлены в useEffect

const RoomLayoutEditorWithAppliances = ({ projectId, room, onClose }) => {
  const canvasRef = useRef(null);
  const [internalWalls, setInternalWalls] = useState([]);
  const [externalWalls, setExternalWalls] = useState([]); // Внешние стены комнаты
  const [electricalPoints, setElectricalPoints] = useState([]);
  const [projectAppliances, setProjectAppliances] = useState([]);
  const [electricalSymbols, setElectricalSymbols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTool, setActiveTool] = useState('select'); // 'select', 'drawWall', 'drawExternalWall', 'outlet', 'light', 'appliance'
  // Убрали переключение режимов - внешние стены всегда доступны
  const [selectedExternalWall, setSelectedExternalWall] = useState(null);
  const [draggingWallEnd, setDraggingWallEnd] = useState(null); // Для поворота стен
  const [wallNodes, setWallNodes] = useState([]); // Узлы на стенах для разделения: [{wallId, position, x, y}]
  const [draggingNode, setDraggingNode] = useState(null); // Перетаскиваемый узел
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [currentMousePos, setCurrentMousePos] = useState({ x: 0, y: 0 });
  const [selectedWall, setSelectedWall] = useState(null);
  const [selectedAppliance, setSelectedAppliance] = useState(null);
  const [applianceDetails, setApplianceDetails] = useState({}); // Для хранения данных о приборах (width, height)
  const [quickPlaceMode, setQuickPlaceMode] = useState(null); // 'outlet' | 'light' | null
  const [hoveredPoint, setHoveredPoint] = useState(null); // Для tooltip
  const [zoom, setZoom] = useState(1.0);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [showPowerDialog, setShowPowerDialog] = useState(false);
  const [powerInputValue, setPowerInputValue] = useState('60');
  const [pendingLightPlacement, setPendingLightPlacement] = useState(null); // { planPos, symbolId }
  const [imagesReady, setImagesReady] = useState(false);
  const [placingPoint, setPlacingPoint] = useState(false); // Индикатор размещения точки

  useEffect(() => {
    if (room && projectId) {
      loadData();
    }
  }, [room, projectId]);

  // Отслеживаем загрузку изображений
  useEffect(() => {
    const checkImages = () => {
      if (socketImage.complete && lightbulbImage.complete && 
          socketImage.naturalWidth > 0 && lightbulbImage.naturalWidth > 0) {
        setImagesReady(true);
      }
    };
    
    socketImage.onload = checkImages;
    lightbulbImage.onload = checkImages;
    checkImages(); // Проверяем сразу, если уже загружены
  }, []);

  // Вспомогательная функция для обновления или создания внешней стены
  const updateOrCreateExternalWall = async (wall, updates) => {
    // Проверяем, является ли ID временным (начинается с "temp-")
    if (typeof wall.id === 'string' && wall.id.startsWith('temp-')) {
      // Создаем новую стену в базе данных
      const newWall = await wallAPI.create(projectId, {
        startX: updates.startX ?? wall.startX,
        startY: updates.startY ?? wall.startY,
        endX: updates.endX ?? wall.endX,
        endY: updates.endY ?? wall.endY,
        thickness: updates.thickness ?? wall.thickness ?? 20,
        wallType: updates.wallType ?? wall.wallType ?? 'external',
        roomId: updates.roomId ?? wall.roomId ?? null,
        openings: updates.openings ?? wall.openings ?? []
      });
      return newWall;
    } else if (typeof wall.id === 'number' || (typeof wall.id === 'string' && !isNaN(wall.id))) {
      // Обновляем существующую стену (только если ID числовой)
      await wallAPI.update(projectId, wall.id, updates);
      return null;
    } else {
      // Если ID невалидный, создаем новую стену
      const newWall = await wallAPI.create(projectId, {
        startX: updates.startX ?? wall.startX,
        startY: updates.startY ?? wall.startY,
        endX: updates.endX ?? wall.endX,
        endY: updates.endY ?? wall.endY,
        thickness: updates.thickness ?? wall.thickness ?? 20,
        wallType: updates.wallType ?? wall.wallType ?? 'external',
        roomId: updates.roomId ?? wall.roomId ?? null,
        openings: updates.openings ?? wall.openings ?? []
      });
      return newWall;
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [wallsRes, allWallsRes, pointsRes, appliancesRes, symbolsRes, roomsRes] = await Promise.all([
        roomAPI.getWalls(projectId, room.id).catch(() => ({ data: [] })),
        wallAPI.getByProject(projectId).catch(() => ({ data: [] })),
        electricalPointAPI.getByProject(projectId).catch(() => ({ data: [] })),
        projectApplianceAPI.getByProject(projectId).catch(() => ({ data: [] })),
        electricalSymbolAPI.getAll().catch(() => ({ data: [] })),
        roomAPI.getByProject(projectId).catch(() => ({ data: [] }))
      ]);
      
      // Внутренние стены: убираем контур комнаты (wallType === 'internal'),
      // оставляем только реальные перегородки (partition и т.п.)
      const roomInternalWalls = (wallsRes.data || []).filter(
        w => w.wallType !== 'internal'
      );
      setInternalWalls(roomInternalWalls);
      
      // Находим внешние стены комнаты (стены, которые являются границами комнаты)
      const allWalls = allWallsRes.data || [];
      const tolerance = 10; // Допуск в см для определения внешних стен
      const roomBounds = {
        left: room.positionX,
        right: room.positionX + room.width,
        top: room.positionY,
        bottom: room.positionY + room.height
      };
      
      // Находим внешние стены комнаты.
      // Логика упрощена: берём все внешние стены, bounding-box которых пересекается
      // с прямоугольником комнаты (с небольшим допуском). Это позволяет
      // не терять стены после поворота или разделения.
      const externalWallsList = allWalls.filter(wall => {
        // Пропускаем стены, явно привязанные к этой комнате как внутренние
        if (wall.roomId === room.id) return false;

        // Только внешние стены
        if (wall.wallType !== 'external') return false;

        const wallStartX = parseFloat(wall.startX);
        const wallStartY = parseFloat(wall.startY);
        const wallEndX = parseFloat(wall.endX);
        const wallEndY = parseFloat(wall.endY);

        const wallMinX = Math.min(wallStartX, wallEndX);
        const wallMaxX = Math.max(wallStartX, wallEndX);
        const wallMinY = Math.min(wallStartY, wallEndY);
        const wallMaxY = Math.max(wallStartY, wallEndY);

        const expand = 20; // небольшой допуск вокруг комнаты
        const roomMinX = roomBounds.left - expand;
        const roomMaxX = roomBounds.right + expand;
        const roomMinY = roomBounds.top - expand;
        const roomMaxY = roomBounds.bottom + expand;

        // Пересечение bounding-box стены и комнаты
        const intersects =
          wallMaxX >= roomMinX &&
          wallMinX <= roomMaxX &&
          wallMaxY >= roomMinY &&
          wallMinY <= roomMaxY;

        return intersects;
      });
      
      // Убираем дубликаты по ID и координатам
      const uniqueWalls = [];
      const seenIds = new Set();
      const seenCoords = new Set();
      
      externalWallsList.forEach(wall => {
        // Проверяем по ID
        if (wall.id && seenIds.has(wall.id)) return;
        
        // Проверяем по координатам (для случаев, когда одна стена может быть связана с несколькими комнатами)
        const wallKey = `${Math.round(parseFloat(wall.startX))}-${Math.round(parseFloat(wall.startY))}-${Math.round(parseFloat(wall.endX))}-${Math.round(parseFloat(wall.endY))}`;
        if (seenCoords.has(wallKey)) return;
        
        if (wall.id) seenIds.add(wall.id);
        seenCoords.add(wallKey);
        uniqueWalls.push(wall);
      });
      
      setExternalWalls(uniqueWalls);
      // Фильтруем точки, которые находятся в этой комнате
      const roomPoints = (pointsRes.data || []).filter(point =>
        point.positionX >= room.positionX &&
        point.positionX <= room.positionX + room.width &&
        point.positionY >= room.positionY &&
        point.positionY <= room.positionY + room.height
      );
      setElectricalPoints(roomPoints);
      const appliances = appliancesRes.data || [];
      setProjectAppliances(appliances);
      
      // Загружаем детали приборов (width, height) для всех приборов в проекте и размещенных точек
      const allApplianceIds = new Set();
      appliances.forEach(a => {
        if (a.applianceId) allApplianceIds.add(a.applianceId);
      });
      // Добавляем applianceId из размещенных точек
      roomPoints.forEach(point => {
        if (point.applianceId) allApplianceIds.add(point.applianceId);
      });
      
      const detailsPromises = Array.from(allApplianceIds).map(async (id) => {
        try {
          const detailRes = await applianceAPI.getById(id);
          return { id, details: detailRes.data };
        } catch (err) {
          console.error(`Ошибка загрузки деталей прибора ${id}:`, err);
          return null;
        }
      });
      const detailsResults = await Promise.all(detailsPromises);
      const detailsMap = {};
      detailsResults.forEach(result => {
        if (result) {
          detailsMap[result.id] = result.details;
        }
      });
      setApplianceDetails(detailsMap);
      
      const symbols = symbolsRes.data || [];
      setElectricalSymbols(symbols);
      
      // Проверяем наличие символов и показываем предупреждение, если их нет
      if (symbols.length === 0) {
        setError('Не найдено доступных электрических символов. Пожалуйста, перезапустите бэкенд для автоматического создания базовых символов.');
      } else {
        setError('');
      }
    } catch (err) {
      setError('Ошибка загрузки данных');
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

  // Функция поиска ближайшей стены к точке
  const findNearestWall = useCallback((planX, planY, maxDistance = 20) => {
    let nearest = null;
    let minDistance = maxDistance;

    // В качестве «стен» используем реальные внешние и внутренние стены,
    // а не старый прямоугольный контур комнаты — так точки реагируют
    // на разделённые/повёрнутые стены.
    const allWalls = [...externalWalls, ...internalWalls];

    allWalls.forEach(wall => {
      const A = { x: wall.startX, y: wall.startY };
      const B = { x: wall.endX, y: wall.endY };
      const P = { x: planX, y: planY };

      const AB = { x: B.x - A.x, y: B.y - A.y };
      const AP = { x: P.x - A.x, y: P.y - A.y };
      const lenABSq = AB.x * AB.x + AB.y * AB.y;

      if (lenABSq === 0) return;

      const t = Math.max(0, Math.min(1, (AP.x * AB.x + AP.y * AB.y) / lenABSq));
      const projection = { x: A.x + t * AB.x, y: A.y + t * AB.y };
      const dist = Math.sqrt((P.x - projection.x) ** 2 + (P.y - projection.y) ** 2);

      if (dist < minDistance) {
        minDistance = dist;
        // Вычисляем угол поворота для розетки (перпендикулярно стене)
        let angle = Math.atan2(AB.y, AB.x) * (180 / Math.PI);
        angle += 90; // Поворачиваем на 90 градусов
        nearest = { x: projection.x, y: projection.y, rotation: angle, distance: dist };
      }
    });

    return nearest;
  }, [room, internalWalls]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !room) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Рисуем границы комнаты
    const scaledWidth = room.width * zoom;
    const scaledHeight = room.height * zoom;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.strokeRect(viewOffset.x, viewOffset.y, scaledWidth, scaledHeight);
    
    // Заливка комнаты для лучшей видимости
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(viewOffset.x, viewOffset.y, scaledWidth, scaledHeight);

    // Рисуем внешние стены (всегда видимы)
    externalWalls.forEach(wall => {
        const start = toCanvasCoords(wall.startX, wall.startY);
        const end = toCanvasCoords(wall.endX, wall.endY);
        
        // Делаем внешние стены более аккуратными и тоньше
        ctx.strokeStyle = wall.id === selectedExternalWall?.id ? '#e74c3c' : '#8b4513';
        const baseThickness = wall.thickness || 12;
        ctx.lineWidth = baseThickness * zoom;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        
        // Рисуем маркеры для всех внешних стен (чтобы их было легче кликать)
        const markerSize = 10 * zoom;
        if (wall.id === selectedExternalWall?.id) {
          ctx.fillStyle = '#e74c3c';
        } else {
          ctx.fillStyle = '#8b4513';
        }
        ctx.beginPath();
        ctx.arc(start.x, start.y, markerSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(end.x, end.y, markerSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Обводка маркеров для лучшей видимости
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(start.x, start.y, markerSize, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(end.x, end.y, markerSize, 0, Math.PI * 2);
        ctx.stroke();
        
        // Рисуем узлы на стене (точки для разделения)
        const wallNodesOnThisWall = wallNodes.filter(node => node.wallId === wall.id);
        wallNodesOnThisWall.forEach(node => {
          const nodePos = toCanvasCoords(node.x, node.y);
          ctx.fillStyle = draggingNode?.nodeId === node.nodeId ? '#f39c12' : '#27ae60';
          const nodeSize = 10 * zoom;
          ctx.beginPath();
          ctx.arc(nodePos.x, nodePos.y, nodeSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        });
        
        // Рисуем проемы (двери) на внешних стенах
        if (wall.openings && wall.openings.length > 0) {
          wall.openings.forEach(opening => {
            if (opening.openingType === 'door') {
              const wallLength = Math.sqrt(
                Math.pow(wall.endX - wall.startX, 2) + 
                Math.pow(wall.endY - wall.startY, 2)
              );
              const t = opening.position / wallLength;
              const doorX = wall.startX + (wall.endX - wall.startX) * t;
              const doorY = wall.startY + (wall.endY - wall.startY) * t;
              const doorPos = toCanvasCoords(doorX, doorY);
              
              ctx.strokeStyle = '#8b4513';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(doorPos.x, doorPos.y, opening.width * zoom / 2, 0, Math.PI * 2);
              ctx.stroke();
            }
          });
        }
    });

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

    // Рисуем электрические точки
    electricalPoints.forEach(point => {
      const pos = toCanvasCoords(point.positionX, point.positionY);
      const symbol = point.electricalSymbol;
      const isHovered = hoveredPoint?.id === point.id;
      
      ctx.save();
      ctx.translate(pos.x, pos.y);
      if (point.rotation) ctx.rotate((point.rotation * Math.PI) / 180);
      
      // Если это прибор с размерами, рисуем прямоугольник
      if (point.applianceId && applianceDetails[point.applianceId]) {
        const appliance = applianceDetails[point.applianceId];
        const width = (appliance.width ? parseFloat(appliance.width) : 40) * zoom;
        const height = (appliance.height ? parseFloat(appliance.height) : 40) * zoom;
        
        ctx.fillStyle = isHovered ? '#3498db' : '#95a5a6';
        ctx.fillRect(-width/2, -height/2, width, height);
        ctx.strokeStyle = isHovered ? '#2980b9' : '#7f8c8d';
        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.strokeRect(-width/2, -height/2, width, height);
        
        // Сохраняем текущий поворот и сбрасываем его для текста
        const currentRotation = point.rotation || 0;
        if (currentRotation !== 0) {
          ctx.rotate(-(currentRotation * Math.PI) / 180); // Сбрасываем поворот
        }
        
        // Восстанавливаем поворот, если был
        if (currentRotation !== 0) {
          ctx.rotate((currentRotation * Math.PI) / 180);
        }
        
        ctx.restore();
        
        // Отображаем название и вольтаж над прибором (после restore, чтобы текст не поворачивался)
        const applianceName = appliance.name || point.notes || 'Прибор';
        const applianceVoltage = appliance.voltage ? `${parseFloat(appliance.voltage).toFixed(0)}В` : '';
        
        ctx.save();
        ctx.translate(pos.x, pos.y - height/2 - 5 * zoom);
        ctx.rotate(0); // Сбрасываем поворот для текста
        
        // Название прибора
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.font = `bold ${11 * zoom}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const nameMetrics = ctx.measureText(applianceName);
        const namePadding = 4;
        const nameHeight = 16 * zoom;
        ctx.fillRect(
          -nameMetrics.width / 2 - namePadding,
          -nameHeight - (applianceVoltage ? 18 * zoom : 0),
          nameMetrics.width + namePadding * 2,
          nameHeight
        );
        ctx.fillStyle = '#fff';
        ctx.fillText(applianceName, 0, -(applianceVoltage ? 18 * zoom : 0));
        
        // Вольтаж под названием
        if (applianceVoltage) {
          ctx.font = `${10 * zoom}px Arial`;
          ctx.textBaseline = 'top';
          const voltageMetrics = ctx.measureText(applianceVoltage);
          const voltagePadding = 4;
          const voltageHeight = 14 * zoom;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
          ctx.fillRect(
            -voltageMetrics.width / 2 - voltagePadding,
            -(applianceVoltage ? 18 * zoom : 0) + 2,
            voltageMetrics.width + voltagePadding * 2,
            voltageHeight
          );
          ctx.fillStyle = '#fff';
          ctx.fillText(applianceVoltage, 0, -(applianceVoltage ? 18 * zoom : 0) + 2);
        }
        
        ctx.restore();
      } else {
        // Извлекаем характеристики из notes или связанного прибора
        let characteristicText = '';
        if (point.notes) {
          // Ищем вольтаж или амперы в notes (например, "220V", "16A", "Мощность: 60W")
          const voltageMatch = point.notes.match(/(\d+)\s*[ВV]/i);
          const amperageMatch = point.notes.match(/(\d+)\s*[АA]/i);
          const powerMatch = point.notes.match(/мощность[:\s]+(\d+)\s*[ВтW]/i);
          if (voltageMatch) {
            characteristicText = `${voltageMatch[1]}В`;
          } else if (amperageMatch) {
            characteristicText = `${amperageMatch[1]}А`;
          } else if (powerMatch) {
            characteristicText = `${powerMatch[1]}Вт`;
          }
        }
        
        // Для розеток, ламп и других символов
        const baseSize = symbol?.type === 'outlet' || symbol?.type === 'light' ? 16 : 12;
        const size = baseSize * zoom;
        const imgSize = 32 * zoom;
        
        if (symbol?.type === 'outlet') {
          // Рисуем изображение розетки
          if (socketImage.complete && socketImage.naturalWidth > 0) {
            ctx.drawImage(socketImage, -imgSize/2, -imgSize/2, imgSize, imgSize);
          } else {
            // Fallback на цветной круг, если изображение не загружено
            ctx.fillStyle = isHovered ? '#c0392b' : '#e74c3c';
            ctx.beginPath();
            ctx.arc(0, 0, size/2, 0, Math.PI*2);
            ctx.fill();
            if (isHovered) {
              ctx.strokeStyle = '#a93226';
              ctx.lineWidth = 2;
              ctx.stroke();
            }
          }
          ctx.restore();
          // Отображаем характеристики над розеткой (после restore, чтобы текст не поворачивался)
          if (characteristicText) {
            ctx.save();
            ctx.translate(pos.x, pos.y - imgSize/2 - 15 * zoom);
            ctx.rotate(0); // Сбрасываем поворот для текста
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(-20 * zoom, -8 * zoom, 40 * zoom, 16 * zoom);
            ctx.fillStyle = '#fff';
            ctx.font = `${10 * zoom}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(characteristicText, 0, 0);
            ctx.restore();
          }
        } else if (symbol?.type === 'light') {
          // Рисуем изображение лампочки
          if (lightbulbImage.complete && lightbulbImage.naturalWidth > 0) {
            ctx.drawImage(lightbulbImage, -imgSize/2, -imgSize/2, imgSize, imgSize);
          } else {
            // Fallback на цветной круг, если изображение не загружено
            ctx.fillStyle = isHovered ? '#d4ac0d' : '#f1c40f';
            ctx.beginPath();
            ctx.arc(0, 0, size/2, 0, Math.PI*2);
            ctx.fill();
            if (isHovered) {
              ctx.strokeStyle = '#b7950b';
              ctx.lineWidth = 2;
              ctx.stroke();
            }
          }
          ctx.restore();
          // Отображаем характеристики над лампочкой (после restore, чтобы текст не поворачивался)
          if (characteristicText) {
            ctx.save();
            ctx.translate(pos.x, pos.y - imgSize/2 - 15 * zoom);
            ctx.rotate(0); // Сбрасываем поворот для текста
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(-20 * zoom, -8 * zoom, 40 * zoom, 16 * zoom);
            ctx.fillStyle = '#fff';
            ctx.font = `${10 * zoom}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(characteristicText, 0, 0);
            ctx.restore();
          }
        } else if (symbol?.type === 'switch') {
          ctx.fillStyle = isHovered ? '#2980b9' : '#3498db';
          ctx.fillRect(-size/2, -size/2, size, size);
        } else {
          ctx.fillStyle = isHovered ? '#2980b9' : '#3498db';
          ctx.beginPath();
          ctx.arc(0, 0, size/2, 0, Math.PI*2);
          ctx.fill();
        }
      }
      ctx.restore();
    });

    // Рисуем текущую рисуемую стену
    if (isDrawing && activeTool === 'drawWall') {
      const start = toCanvasCoords(dragStart.x, dragStart.y);
      // Преобразуем координаты canvas в координаты плана для конца стены
      const endPlanPos = toPlanCoords(currentMousePos.x, currentMousePos.y);
      const end = toCanvasCoords(endPlanPos.x, endPlanPos.y);
      ctx.strokeStyle = 'rgba(74, 144, 226, 0.7)';
      ctx.lineWidth = 10 * zoom;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
    
    // Preview для перетаскивания узла
    if (isDrawing && draggingNode) {
      const nodePos = toCanvasCoords(currentMousePos.x, currentMousePos.y);
      const wall = externalWalls.find(w => w.id === draggingNode.wallId);
      if (wall) {
        // Рисуем линию от начала стены до узла
        const start = toCanvasCoords(wall.startX, wall.startY);
        ctx.strokeStyle = 'rgba(39, 174, 96, 0.7)';
        ctx.lineWidth = 3 * zoom;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(nodePos.x, nodePos.y);
        ctx.stroke();
        
        // Рисуем линию от узла до конца стены
        const end = toCanvasCoords(wall.endX, wall.endY);
        ctx.beginPath();
        ctx.moveTo(nodePos.x, nodePos.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Рисуем узел
        ctx.fillStyle = '#f39c12';
        const nodeSize = 12 * zoom;
        ctx.beginPath();
        ctx.arc(nodePos.x, nodePos.y, nodeSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Preview для размещения розеток/ламп/приборов
    if ((activeTool === 'outlet' || activeTool === 'light' || activeTool === 'appliance' || quickPlaceMode) && !isDrawing) {
      const planPos = toPlanCoords(currentMousePos.x, currentMousePos.y);
      
      // Проверяем, что курсор внутри комнаты
      if (planPos.x >= room.positionX && planPos.x <= room.positionX + room.width &&
          planPos.y >= room.positionY && planPos.y <= room.positionY + room.height) {
        
        ctx.save();
        ctx.translate(currentMousePos.x, currentMousePos.y);
        ctx.globalAlpha = 0.5;
        
        // Если это прибор, показываем прямоугольник с размерами
        if (activeTool === 'appliance' && selectedAppliance && applianceDetails[selectedAppliance.applianceId]) {
          const appliance = applianceDetails[selectedAppliance.applianceId];
          const width = (appliance.width ? parseFloat(appliance.width) : 40) * zoom;
          const height = (appliance.height ? parseFloat(appliance.height) : 40) * zoom;
          
          ctx.fillStyle = '#95a5a6';
          ctx.fillRect(-width/2, -height/2, width, height);
          ctx.strokeStyle = '#7f8c8d';
          ctx.lineWidth = 2;
          ctx.strokeRect(-width/2, -height/2, width, height);
        } else {
          // Для розеток - показываем preview на ближайшей стене
          if (quickPlaceMode === 'outlet' || activeTool === 'outlet') {
            const nearestWall = findNearestWall(planPos.x, planPos.y, 20);
            if (nearestWall) {
              // Показываем preview на стене с правильной позицией
              ctx.restore();
              const wallPos = toCanvasCoords(nearestWall.x, nearestWall.y);
              ctx.save();
              ctx.translate(wallPos.x, wallPos.y);
              if (nearestWall.rotation) ctx.rotate((nearestWall.rotation * Math.PI) / 180);
              
              const baseSize = 8;
              const size = baseSize * zoom;
              ctx.fillStyle = '#e74c3c';
              ctx.globalAlpha = 0.5;
              ctx.beginPath();
              ctx.arc(0, 0, size/2, 0, Math.PI*2);
              ctx.fill();
            } else {
              // Если нет ближайшей стены, не показываем preview
              ctx.restore();
              return;
            }
          } else {
            // Для ламп и других - уменьшенный размер
            const baseSize = (quickPlaceMode === 'light' || activeTool === 'light') ? 8 : 12;
            const size = baseSize * zoom;
            
            if (quickPlaceMode === 'light' || activeTool === 'light') {
              ctx.fillStyle = '#f1c40f';
            } else {
              ctx.fillStyle = '#3498db';
            }
            
            ctx.beginPath();
            ctx.arc(0, 0, size/2, 0, Math.PI*2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    }
    
    // Рисуем tooltip
    if (hoveredPoint) {
      const planPos = toPlanCoords(tooltipPos.x, tooltipPos.y);
      const canvasPos = toCanvasCoords(planPos.x, planPos.y);
      
      let tooltipText = '';
      if (hoveredPoint.applianceId && applianceDetails[hoveredPoint.applianceId]) {
        const appliance = applianceDetails[hoveredPoint.applianceId];
        tooltipText = appliance.name || 'Прибор';
        const categories = appliance.categories || [];
        if (categories.length > 0) {
          tooltipText += ' - ' + categories.map(c => c.name).join(', ');
        } else if (appliance.category) {
          tooltipText += ' - ' + appliance.category;
        }
      } else if (hoveredPoint.electricalSymbol) {
        tooltipText = hoveredPoint.electricalSymbol.name || 
                     (hoveredPoint.electricalSymbol.type === 'outlet' ? 'Розетка' :
                      hoveredPoint.electricalSymbol.type === 'light' ? 'Лампа' :
                      hoveredPoint.electricalSymbol.type === 'switch' ? 'Выключатель' : 'Электрическая точка');
        if (hoveredPoint.notes) {
          tooltipText += ` (${hoveredPoint.notes})`;
        }
      } else {
        tooltipText = hoveredPoint.notes || 'Электрическая точка';
      }
      
      ctx.save();
      ctx.font = '14px Arial';
      const textWidth = ctx.measureText(tooltipText).width;
      const padding = 8;
      
      // Фон tooltip
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(canvasPos.x + 15, canvasPos.y - 25, textWidth + padding * 2, 28);
      
      // Текст tooltip
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(tooltipText, canvasPos.x + 15 + padding, canvasPos.y - 11);
      ctx.restore();
    }
    }, [internalWalls, externalWalls, electricalPoints, isDrawing, dragStart, currentMousePos, room, zoom, viewOffset, activeTool, selectedWall, selectedExternalWall, wallNodes, draggingNode, toCanvasCoords, toPlanCoords, quickPlaceMode, selectedAppliance, canvasRef, applianceDetails, hoveredPoint, tooltipPos, imagesReady]);

  // Определение размеров контейнера и масштабирование canvas
  useEffect(() => {
    const container = canvasRef.current?.parentElement;
    const canvas = canvasRef.current;
    if (!container || !canvas || !room) return;
    
    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const containerWidth = rect.width;
      const containerHeight = rect.height;
      
      // Устанавливаем размер canvas равным размеру контейнера
      canvas.width = containerWidth;
      canvas.height = containerHeight;
      
      // Рассчитываем масштаб так, чтобы комната вписывалась в контейнер с отступами
      const padding = 40;
      const availableWidth = containerWidth - padding * 2;
      const availableHeight = containerHeight - padding * 2;
      
      const scaleX = availableWidth / room.width;
      const scaleY = availableHeight / room.height;
      const autoZoom = Math.min(scaleX, scaleY, 3); // Ограничиваем максимальный zoom
      
      // Если zoom еще не был установлен пользователем, устанавливаем автоматический
      const currentZoom = zoom === 1.0 ? autoZoom : zoom;
      
      // Вычисляем смещение для центрирования комнаты при текущем zoom
      const scaledWidth = room.width * currentZoom;
      const scaledHeight = room.height * currentZoom;
      const offsetX = (containerWidth - scaledWidth) / 2;
      const offsetY = (containerHeight - scaledHeight) / 2;
      
      setViewOffset({ x: Math.max(0, offsetX), y: Math.max(0, offsetY) });
      
      if (zoom === 1.0) {
        setZoom(autoZoom);
      }
      
      setContainerSize({ width: containerWidth, height: containerHeight });
    };
    
    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [room]);
  
  // Обновление offset при изменении zoom
  useEffect(() => {
    const container = canvasRef.current?.parentElement;
    if (!container || !room) return;
    
    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;
    
    const scaledWidth = room.width * zoom;
    const scaledHeight = room.height * zoom;
    const offsetX = (containerWidth - scaledWidth) / 2;
    const offsetY = (containerHeight - scaledHeight) / 2;
    
    setViewOffset({ x: Math.max(0, offsetX), y: Math.max(0, offsetY) });
  }, [zoom, room, containerSize]);
  
  useEffect(() => {
    draw();
  }, [draw]);

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const planPos = toPlanCoords(x, y);

    // Для внешних стен разрешаем клики на границе комнаты (с допуском)
    const tolerance = 30; // Допуск в см для клика по внешним стенам
    const isInsideRoom = planPos.x >= room.positionX - tolerance && 
                        planPos.x <= room.positionX + room.width + tolerance &&
                        planPos.y >= room.positionY - tolerance && 
                        planPos.y <= room.positionY + room.height + tolerance;
    
    // Для инструментов размещения (розетки, лампы, приборы) проверяем строго внутри комнаты
    if ((activeTool === 'outlet' || activeTool === 'light' || activeTool === 'appliance' || quickPlaceMode) &&
        (planPos.x < room.positionX || planPos.x > room.positionX + room.width ||
         planPos.y < room.positionY || planPos.y > room.positionY + room.height)) {
      return;
    }
    
    // Для других инструментов разрешаем клики вблизи комнаты (для внешних стен)
    if (!isInsideRoom && activeTool !== 'select') {
      return;
    }

    if (activeTool === 'drawWall') {
      setIsDrawing(true);
      setDragStart(planPos); // Сохраняем координаты плана для начала стены
      setCurrentMousePos({ x, y }); // Сохраняем координаты canvas для preview
    } else if (activeTool === 'select') {
      // Проверяем клик по узлам на внешних стенах
      let clickedNode = null;
      let minNodeDist = Infinity;
      wallNodes.forEach((node, index) => {
        const nodePos = { x: node.x, y: node.y };
        const dist = Math.sqrt((planPos.x - nodePos.x) ** 2 + (planPos.y - nodePos.y) ** 2);
        if (dist < 15 && dist < minNodeDist) {
          minNodeDist = dist;
          clickedNode = { ...node, nodeId: index };
        }
      });
      
      if (clickedNode) {
        // Начинаем перетаскивание узла
        setDraggingNode(clickedNode);
        setIsDrawing(true);
        setDragStart(planPos);
        return;
      }
      
      // Проверяем клик по стенам (сначала внешние, потом внутренние)
      let clickedExternalWall = null;
      let clickedInternalWall = null;
      let minExternalDist = Infinity;
      let minInternalDist = Infinity;
      let clickedEnd = null; // 'start' или 'end'
      let clickedPosition = null; // Позиция на стене для добавления узла
      
      // Проверяем внешние стены
      externalWalls.forEach(wall => {
        const A = { x: wall.startX, y: wall.startY };
        const B = { x: wall.endX, y: wall.endY };
        const P = planPos;
        
        // Проверяем клик по маркерам (увеличиваем допуск для лучшего выбора)
        const markerTolerance = 20 / zoom; // Учитываем масштаб
        const distToStart = Math.sqrt((P.x - A.x) ** 2 + (P.y - A.y) ** 2);
        const distToEnd = Math.sqrt((P.x - B.x) ** 2 + (P.y - B.y) ** 2);
        
        if (distToStart < markerTolerance) {
          if (distToStart < minExternalDist) {
            minExternalDist = distToStart;
            clickedExternalWall = wall;
            clickedEnd = 'start';
          }
        } else if (distToEnd < markerTolerance) {
          if (distToEnd < minExternalDist) {
            minExternalDist = distToEnd;
            clickedExternalWall = wall;
            clickedEnd = 'end';
          }
        } else {
          // Проверяем клик по самой стене
          const AB = { x: B.x - A.x, y: B.y - A.y };
          const AP = { x: P.x - A.x, y: P.y - A.y };
          const lenABSq = AB.x * AB.x + AB.y * AB.y;
          if (lenABSq === 0) return;
          const t = Math.max(0, Math.min(1, (AP.x * AB.x + AP.y * AB.y) / lenABSq));
          const projection = { x: A.x + t * AB.x, y: A.y + t * AB.y };
          const dist = Math.sqrt((P.x - projection.x) ** 2 + (P.y - projection.y) ** 2);
          // Увеличиваем допуск для внешних стен (они толще и важнее для редактирования)
          const wallThickness = wall.thickness || 20;
          const clickTolerance = Math.max(40 / zoom, wallThickness / 2 + 20 / zoom); // Учитываем масштаб
          if (dist < clickTolerance && dist < minExternalDist) {
            minExternalDist = dist;
            clickedExternalWall = wall;
            clickedEnd = null;
            clickedPosition = { t, x: projection.x, y: projection.y };
          }
        }
      });
      
      // Проверяем внутренние стены
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
        if (dist < 20 && dist < minInternalDist) {
          minInternalDist = dist;
          clickedInternalWall = wall;
        }
      });
      
      // Приоритет: внешние стены имеют приоритет, если клик близко к обеим
      if (clickedExternalWall && (minExternalDist < minInternalDist || !clickedInternalWall)) {
        setSelectedExternalWall(clickedExternalWall);
        setSelectedWall(null);
        if (clickedEnd) {
          // Начинаем поворот внешней стены
          setDraggingWallEnd({ wallId: clickedExternalWall.id, end: clickedEnd });
          setIsDrawing(true);
          setDragStart(planPos);
        } else if (clickedPosition && e.ctrlKey) {
          // Ctrl+клик на внешней стене - добавляем узел для разделения
          const wallLength = Math.sqrt(
            Math.pow(clickedExternalWall.endX - clickedExternalWall.startX, 2) + 
            Math.pow(clickedExternalWall.endY - clickedExternalWall.startY, 2)
          );
          const newNode = {
            wallId: clickedExternalWall.id,
            position: clickedPosition.t * wallLength,
            x: clickedPosition.x,
            y: clickedPosition.y
          };
          setWallNodes([...wallNodes, newNode]);
        }
      } else if (clickedInternalWall) {
        setSelectedWall(clickedInternalWall);
        setSelectedExternalWall(null);
      } else {
        setSelectedWall(null);
        setSelectedExternalWall(null);
      }
    } else if (activeTool === 'outlet' || activeTool === 'light' || activeTool === 'appliance' || quickPlaceMode) {
      // Размещение электрической точки
      handlePlaceElectricalPoint(planPos);
      return; // Не продолжаем обработку клика
    }
  };

  const handlePlaceElectricalPoint = async (planPos) => {
    try {
      // ВАЛИДАЦИЯ: базовые границы комнаты (прямоугольник)
      const roomLeft = room.positionX;
      const roomTop = room.positionY;
      const roomRight = room.positionX + room.width;
      const roomBottom = room.positionY + room.height;
      
      let validationError = null;
      let objectWidth = 0;
      let objectHeight = 0;
      let finalPlanPos = planPos;
      let rotation = 0;
      
      // Для розеток - проверяем, что они размещаются только на стенах
      if (quickPlaceMode === 'outlet' || activeTool === 'outlet') {
        const nearestWall = findNearestWall(planPos.x, planPos.y, 20);
        if (!nearestWall) {
          validationError = 'Розетка может быть размещена только на стенах комнаты. Приблизьтесь к стене.';
          setError(validationError);
          return;
        } else {
          finalPlanPos = { x: nearestWall.x, y: nearestWall.y };
          rotation = nearestWall.rotation || 0;
        }

        // Валидация запрещенных помещений для розеток
        if (room.roomType && room.roomType.name) {
          const prohibitedValidation = validateProhibitedRoomsForSockets(room.roomType.name, 'outlet');
          if (!prohibitedValidation.valid) {
            validationError = prohibitedValidation.errors.join(' ');
            setError(validationError);
            return;
          }
        }
      }

      // Валидация для выключателей
      if (activeTool === 'switch' && room.roomType && room.roomType.name) {
        const prohibitedValidation = validateProhibitedRoomsForSockets(room.roomType.name, 'switch');
        if (!prohibitedValidation.valid) {
          validationError = prohibitedValidation.errors.join(' ');
          setError(validationError);
          return;
        }
      }
      
      // Для приборов проверяем, что весь прибор помещается в комнате.
      // Используем расширенные границы, чтобы учитывать «деформированную» форму
      // комнаты из внешних стен.
      if (activeTool === 'appliance' && selectedAppliance && applianceDetails[selectedAppliance.applianceId || selectedAppliance.id]) {
        const appliance = applianceDetails[selectedAppliance.applianceId || selectedAppliance.id];
        objectWidth = appliance.width ? parseFloat(appliance.width) : 40;
        objectHeight = appliance.height ? parseFloat(appliance.height) : 40;
        
        const objectLeft = finalPlanPos.x - objectWidth / 2;
        const objectTop = finalPlanPos.y - objectHeight / 2;
        const objectRight = finalPlanPos.x + objectWidth / 2;
        const objectBottom = finalPlanPos.y + objectHeight / 2;

        // Расширяем прямоугольные границы за счёт внешних стен
        let extLeft = roomLeft;
        let extRight = roomRight;
        let extTop = roomTop;
        let extBottom = roomBottom;

        if (externalWalls && externalWalls.length > 0) {
          externalWalls.forEach(w => {
            const sx = parseFloat(w.startX);
            const sy = parseFloat(w.startY);
            const ex = parseFloat(w.endX);
            const ey = parseFloat(w.endY);
            extLeft = Math.min(extLeft, sx, ex);
            extRight = Math.max(extRight, sx, ex);
            extTop = Math.min(extTop, sy, ey);
            extBottom = Math.max(extBottom, sy, ey);
          });
        }

        if (objectLeft < extLeft || objectRight > extRight || 
            objectTop < extTop || objectBottom > extBottom) {
          validationError = `Прибор не может быть размещен за стенами комнаты. Размеры прибора: ${objectWidth}×${objectHeight} см`;
        }
      } else if (quickPlaceMode !== 'outlet' && activeTool !== 'outlet') {
        // Для ламп проверяем только центр точки (розетки уже проверили выше)
        if (finalPlanPos.x < roomLeft || finalPlanPos.x > roomRight || 
            finalPlanPos.y < roomTop || finalPlanPos.y > roomBottom) {
          validationError = 'Объект не может быть размещен за стенами комнаты';
        }
      }
      
      if (validationError) {
        setError(validationError);
        return;
      }
      
      let electricalSymbolId = null;
      let applianceId = null;
      let notes = '';
      let symbolType = null;
      let powerConsumption = null;

      if (quickPlaceMode === 'outlet' || activeTool === 'outlet') {
        // Автоматический выбор розетки на бэкенде на основе требований ТКП 339
        symbolType = 'outlet';
        powerConsumption = 2200; // Стандартная мощность для розетки
        notes = 'Мощность: 2200W';
      } else if (quickPlaceMode === 'light' || activeTool === 'light') {
        // Для светильников открываем диалог для ввода мощности
        // Автоматический выбор будет на бэкенде
        symbolType = 'light';
        setPendingLightPlacement({ planPos: finalPlanPos, symbolType: 'light', rotation });
        setPowerInputValue('60');
        setShowPowerDialog(true);
        return; // Прерываем выполнение, продолжение после подтверждения диалога
      } else if (activeTool === 'appliance' && selectedAppliance) {
        applianceId = selectedAppliance.applianceId || selectedAppliance.id;
        // Для приборов используем первый доступный символ (они рисуются как прямоугольники)
        if (electricalSymbols.length > 0) {
          electricalSymbolId = electricalSymbols[0].id;
        }
      }

      // Для приборов сохраняем название в notes
      let finalNotes = notes;
      if (applianceId && selectedAppliance && applianceDetails[selectedAppliance.applianceId || applianceId]) {
        const appliance = applianceDetails[selectedAppliance.applianceId || applianceId];
        finalNotes = appliance.name || selectedAppliance.applianceName || notes;
      }

      setPlacingPoint(true); // Показываем индикатор
      setError(''); // Очищаем предыдущие ошибки
      
      const pointData = {
        // Если symbolType указан, бэкенд автоматически выберет символ
        electricalSymbolId: electricalSymbolId || undefined, // undefined для автоматического выбора
        symbolType: symbolType, // Для автоматического выбора на бэкенде
        powerConsumption: powerConsumption, // Для автоматического выбора на бэкенде
        roomId: room?.id || null, // Для определения типа помещения
        applianceId: applianceId,
        positionX: finalPlanPos.x,
        positionY: finalPlanPos.y,
        rotation: rotation,
        heightFromFloor: (quickPlaceMode === 'outlet' || activeTool === 'outlet') ? 90 : 
                        (applianceId ? 0 : 90), // Для приборов высота не важна
        notes: finalNotes
      };

      await electricalPointAPI.create(projectId, pointData);
      await loadData();
      setError('');
    } catch (err) {
      // Улучшенное сообщение об ошибке
      const errorMessage = err.response?.data?.message || err.message || 'Неизвестная ошибка';
      let userFriendlyMessage = 'Ошибка размещения';
      
      if (errorMessage.includes('Symbol type is required') || errorMessage.includes('Тип символа обязателен')) {
        userFriendlyMessage = 'Не указан тип символа. Попробуйте еще раз.';
      } else if (errorMessage.includes('ElectricalSymbol') || errorMessage.includes('не найдено подходящих символов')) {
        userFriendlyMessage = 'Не найдено подходящего символа в базе данных. Обратитесь к администратору.';
      } else if (errorMessage.includes('Room') || errorMessage.includes('Помещение')) {
        userFriendlyMessage = 'Помещение не найдено. Обновите страницу.';
      } else {
        userFriendlyMessage = `Ошибка: ${errorMessage}`;
      }
      
      setError(userFriendlyMessage);
      console.error('Ошибка размещения:', err);
    } finally {
      setPlacingPoint(false); // Скрываем индикатор
    }
  };

  // Обработка подтверждения мощности лампы
  const handlePowerDialogConfirm = async () => {
    const power = parseFloat(powerInputValue);
    
    // Улучшенная валидация мощности
    if (isNaN(power) || power <= 0) {
      setError('Мощность должна быть положительным числом');
      return;
    }
    
    if (power > 10000) {
      setError('Мощность не может превышать 10000 Вт (10 кВт). Проверьте введенное значение.');
      return;
    }
    
    if (power < 1) {
      setError('Мощность должна быть не менее 1 Вт');
      return;
    }

    if (!pendingLightPlacement) {
      setShowPowerDialog(false);
      return;
    }

    try {
      setError(''); // Очищаем предыдущие ошибки
      // Автоматический выбор символа на бэкенде на основе требований ТКП 339
      const pointData = {
        // Не указываем electricalSymbolId - бэкенд выберет автоматически
        symbolType: pendingLightPlacement.symbolType || 'light',
        powerConsumption: power,
        roomId: room?.id || null, // Для определения типа помещения
        positionX: pendingLightPlacement.planPos.x,
        positionY: pendingLightPlacement.planPos.y,
        rotation: pendingLightPlacement.rotation || 0,
        heightFromFloor: 250,
        notes: `Мощность: ${power}W`
      };

      await electricalPointAPI.create(projectId, pointData);
      await loadData();
      setError('');
      setShowPowerDialog(false);
      setPendingLightPlacement(null);
    } catch (err) {
      // Улучшенное сообщение об ошибке
      const errorMessage = err.response?.data?.message || err.message || 'Неизвестная ошибка';
      let userFriendlyMessage = 'Ошибка размещения светильника';
      
      if (errorMessage.includes('Symbol type is required') || errorMessage.includes('Тип символа обязателен')) {
        userFriendlyMessage = 'Не указан тип символа. Попробуйте еще раз.';
      } else if (errorMessage.includes('ElectricalSymbol') || errorMessage.includes('не найдено подходящих символов')) {
        userFriendlyMessage = 'Не найдено подходящего светильника в базе данных. Обратитесь к администратору.';
      } else if (errorMessage.includes('Room') || errorMessage.includes('Помещение')) {
        userFriendlyMessage = 'Помещение не найдено. Обновите страницу.';
      } else {
        userFriendlyMessage = `Ошибка: ${errorMessage}`;
      }
      
      setError(userFriendlyMessage);
      console.error('Ошибка размещения:', err);
    }
  };

  const handlePowerDialogCancel = () => {
    setShowPowerDialog(false);
    setPendingLightPlacement(null);
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const planPos = toPlanCoords(x, y);
    // Сохраняем как координаты canvas для preview
    setCurrentMousePos({ x, y });
    
    // Проверяем наведение на электрические точки для tooltip
    if (activeTool === 'select') {
      let foundPoint = null;
      const threshold = 20 / zoom; // Радиус проверки в координатах плана
      
      electricalPoints.forEach(point => {
        const dx = Math.abs(planPos.x - point.positionX);
        const dy = Math.abs(planPos.y - point.positionY);
        
        if (point.applianceId && applianceDetails[point.applianceId]) {
          // Для приборов - проверяем прямоугольник
          const appliance = applianceDetails[point.applianceId];
          const width = appliance.width ? parseFloat(appliance.width) : 40;
          const height = appliance.height ? parseFloat(appliance.height) : 40;
          if (dx <= width/2 && dy <= height/2) {
            foundPoint = point;
          }
        } else {
          // Для точек - проверяем радиус
          if (dx <= threshold && dy <= threshold) {
            foundPoint = point;
          }
        }
      });
      
      setHoveredPoint(foundPoint);
      setTooltipPos({ x, y });
    } else {
      setHoveredPoint(null);
    }
  };

  const handleMouseUp = async () => {
    if (isDrawing && activeTool === 'drawWall') {
      // Преобразуем координаты canvas в координаты плана
      const endPlanPos = toPlanCoords(currentMousePos.x, currentMousePos.y);
      
      const minX = Math.min(dragStart.x, endPlanPos.x);
      const minY = Math.min(dragStart.y, endPlanPos.y);
      const maxX = Math.max(dragStart.x, endPlanPos.x);
      const maxY = Math.max(dragStart.y, endPlanPos.y);
      const width = maxX - minX;
      const height = maxY - minY;

      // Проверяем, что стена находится внутри комнаты
      if (minX >= room.positionX && minY >= room.positionY &&
          maxX <= room.positionX + room.width && maxY <= room.positionY + room.height) {
        try {
          await wallAPI.create(projectId, {
            startX: dragStart.x,
            startY: dragStart.y,
            endX: endPlanPos.x,
            endY: endPlanPos.y,
            thickness: 10,
            wallType: 'partition',
            roomId: room.id
          });
          await loadData();
        } catch (err) {
          setError('Ошибка создания перегородки');
        }
      } else {
        setError('Перегородка должна находиться внутри комнаты');
      }
      setIsDrawing(false);
    } else if (isDrawing && draggingWallEnd) {
      // Поворот внешней стены
      const endPlanPos = toPlanCoords(currentMousePos.x, currentMousePos.y);
      const wall = externalWalls.find(w => w.id === draggingWallEnd.wallId);
      
      if (wall) {
        try {
          const updates = {
            startX: draggingWallEnd.end === 'start' ? endPlanPos.x : wall.startX,
            startY: draggingWallEnd.end === 'start' ? endPlanPos.y : wall.startY,
            endX: draggingWallEnd.end === 'end' ? endPlanPos.x : wall.endX,
            endY: draggingWallEnd.end === 'end' ? endPlanPos.y : wall.endY,
            thickness: wall.thickness || 20,
            wallType: wall.wallType || 'external',
            roomId: wall.roomId,
            openings: wall.openings || []
          };
          
          await updateOrCreateExternalWall(wall, updates);
          await loadData();
        } catch (err) {
          setError('Ошибка поворота стены');
        }
      }
      setDraggingWallEnd(null);
      setIsDrawing(false);
    } else if (isDrawing && draggingNode) {
      // Перетаскивание узла - разделяем стену на две части
      const endPlanPos = toPlanCoords(currentMousePos.x, currentMousePos.y);
      const wall = externalWalls.find(w => w.id === draggingNode.wallId);
      
      if (wall) {
        try {
          // Создаем две новые стены вместо одной
          const wallLength = Math.sqrt(
            Math.pow(wall.endX - wall.startX, 2) + 
            Math.pow(wall.endY - wall.startY, 2)
          );
          
          // Первая стена: от начала до узла
          await updateOrCreateExternalWall(wall, {
            startX: wall.startX,
            startY: wall.startY,
            endX: endPlanPos.x,
            endY: endPlanPos.y,
            thickness: wall.thickness || 20,
            wallType: wall.wallType || 'external',
            roomId: wall.roomId,
            openings: wall.openings || []
          });
          
          // Вторая стена: от узла до конца
          await wallAPI.create(projectId, {
            startX: endPlanPos.x,
            startY: endPlanPos.y,
            endX: wall.endX,
            endY: wall.endY,
            thickness: wall.thickness || 20,
            wallType: wall.wallType || 'external',
            roomId: null,
            openings: []
          });
          
          // Удаляем узел, так как стена уже разделена
          setWallNodes(wallNodes.filter((node, idx) => idx !== draggingNode.nodeId));
          
          await loadData();
        } catch (err) {
          setError('Ошибка разделения стены: ' + (err.response?.data?.message || err.message));
        }
      }
      setDraggingNode(null);
      setIsDrawing(false);
    }
  };

  const [confirmModal, setConfirmModal] = useState({ show: false, type: '', id: null, onConfirm: null });

  const handleDeleteWall = async (wallId) => {
    setConfirmModal({
      show: true,
      type: 'wall',
      id: wallId,
      onConfirm: async () => {
        try {
          await wallAPI.delete(projectId, wallId);
          await loadData();
          setSelectedWall(null);
          setConfirmModal({ show: false, type: '', id: null, onConfirm: null });
        } catch (err) {
          setError('Ошибка удаления перегородки');
          setConfirmModal({ show: false, type: '', id: null, onConfirm: null });
        }
      }
    });
  };

  const handleDeletePoint = async (pointId) => {
    setConfirmModal({
      show: true,
      type: 'point',
      id: pointId,
      onConfirm: async () => {
        try {
          await electricalPointAPI.delete(projectId, pointId);
          await loadData();
          setConfirmModal({ show: false, type: '', id: null, onConfirm: null });
        } catch (err) {
          setError('Ошибка удаления точки');
          setConfirmModal({ show: false, type: '', id: null, onConfirm: null });
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
      const currentOpenings = selectedWall.openings || [];
      const newOpening = {
        position: parseFloat(doorPosition),
        width: parseFloat(doorWidth),
        height: 210,
        openingType: 'door'
      };
      
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
      
      await loadData();
      setError('');
    } catch (err) {
      setError('Ошибка добавления двери: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleAddDoorToExternalWall = async () => {
    if (!selectedExternalWall) {
      setError('Выберите внешнюю стену для добавления двери');
      return;
    }
    const doorWidth = prompt('Ширина двери (см):', '90');
    if (!doorWidth || isNaN(doorWidth)) return;
    
    const wallLength = Math.sqrt(
      Math.pow(selectedExternalWall.endX - selectedExternalWall.startX, 2) + 
      Math.pow(selectedExternalWall.endY - selectedExternalWall.startY, 2)
    );
    const doorPosition = prompt(`Позиция двери от начала стены (0-${wallLength.toFixed(0)} см):`, (wallLength / 2).toFixed(0));
    if (!doorPosition || isNaN(doorPosition)) return;

    try {
      const currentOpenings = selectedExternalWall.openings || [];
      const newOpening = {
        position: parseFloat(doorPosition),
        width: parseFloat(doorWidth),
        height: 210,
        openingType: 'door'
      };
      
      // Убеждаемся, что обновляем существующую стену, а не создаем новую
      if (typeof selectedExternalWall.id === 'number' || (typeof selectedExternalWall.id === 'string' && !selectedExternalWall.id.startsWith('temp-') && !isNaN(selectedExternalWall.id))) {
        // Обновляем существующую стену
        await wallAPI.update(projectId, selectedExternalWall.id, {
          startX: selectedExternalWall.startX,
          startY: selectedExternalWall.startY,
          endX: selectedExternalWall.endX,
          endY: selectedExternalWall.endY,
          thickness: selectedExternalWall.thickness || 20,
          wallType: selectedExternalWall.wallType || 'external',
          roomId: selectedExternalWall.roomId,
          openings: [...currentOpenings, newOpening]
        });
      } else {
        // Если стена временная, создаем новую
        await wallAPI.create(projectId, {
          startX: selectedExternalWall.startX,
          startY: selectedExternalWall.startY,
          endX: selectedExternalWall.endX,
          endY: selectedExternalWall.endY,
          thickness: selectedExternalWall.thickness || 20,
          wallType: 'external',
          roomId: null,
          openings: [...currentOpenings, newOpening]
        });
      }
      
      // Перезагружаем данные после обновления
      await loadData();
      setSelectedExternalWall(null);
      setError('');
    } catch (err) {
      setError('Ошибка добавления двери: ' + (err.response?.data?.message || err.message));
      console.error('Ошибка добавления двери:', err);
    }
  };

  if (!room) return null;

  return (
    <div className="room-layout-editor">
      <div className="layout-editor-header">
        <h4>Планировка и электроприборы: {room.name}</h4>
        <p className="hint">Добавьте стены, перегородки, двери, розетки, освещение и приборы</p>
      </div>

      {error && <div className="error-message">{error}</div>}
      
      {placingPoint && (
        <div className="placing-indicator" style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '20px 30px',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '16px',
          color: '#2c3e50'
        }}>
          <div className="loading-spinner-small" style={{
            width: '20px',
            height: '20px',
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <span>Размещение точки...</span>
        </div>
      )}

      <div className="layout-toolbar">
        <button 
          className={activeTool === 'select' ? 'active' : ''} 
          onClick={() => {
            setActiveTool('select');
            setQuickPlaceMode(null);
            setSelectedAppliance(null);
          }}
        >
          Выбрать
        </button>
        <button 
          className={activeTool === 'drawWall' ? 'active' : ''} 
          onClick={() => {
            setActiveTool('drawWall');
            setQuickPlaceMode(null);
            setSelectedAppliance(null);
          }}
        >
          Нарисовать внутреннюю стену
        </button>
        {selectedExternalWall && (
          <>
            <button 
              onClick={() => {
                // Добавляем узел на середине выбранной стены
                const wall = selectedExternalWall;
                const midX = (wall.startX + wall.endX) / 2;
                const midY = (wall.startY + wall.endY) / 2;
                const wallLength = Math.sqrt(
                  Math.pow(wall.endX - wall.startX, 2) + 
                  Math.pow(wall.endY - wall.startY, 2)
                );
                const newNode = {
                  wallId: wall.id,
                  position: wallLength / 2,
                  x: midX,
                  y: midY
                };
                setWallNodes([...wallNodes, newNode]);
              }}
              className="btn-secondary"
              title="Добавить узел на стене (или Ctrl+клик на стене)"
            >
              Разделить внешнюю стену
            </button>
            <button onClick={handleAddDoorToExternalWall} className="btn-add-door">
              Добавить дверь на внешнюю стену
            </button>
          </>
        )}
        {wallNodes.length > 0 && (
          <button 
            onClick={() => {
              setConfirmModal({
                show: true,
                type: 'nodes',
                id: null,
                onConfirm: () => {
                  setWallNodes([]);
                  setConfirmModal({ show: false, type: '', id: null, onConfirm: null });
                }
              });
            }}
            className="btn-secondary"
          >
            Удалить все узлы
          </button>
        )}
        <button
          className={(quickPlaceMode === 'outlet' || activeTool === 'outlet') ? 'active' : ''}
          onClick={() => {
            setQuickPlaceMode('outlet');
            setActiveTool('outlet');
            setSelectedAppliance(null);
          }}
          title="Разместить розетку (2200W)"
        >
          🔌 Розетка
        </button>
        <button
          className={(quickPlaceMode === 'light' || activeTool === 'light') ? 'active' : ''}
          onClick={() => {
            setQuickPlaceMode('light');
            setActiveTool('light');
            setSelectedAppliance(null);
          }}
          title="Разместить лампу"
        >
          💡 Лампа
        </button>
        {selectedWall && (
          <>
            <button onClick={handleAddDoor} className="btn-add-door">
              Добавить дверь на внутреннюю стену
            </button>
            <button onClick={() => handleDeleteWall(selectedWall.id)} className="btn-delete">
              Удалить внутреннюю стену
            </button>
          </>
        )}
        <div className="zoom-controls">
          <button onClick={() => {
            const container = canvasRef.current?.parentElement;
            if (container && room) {
              const rect = container.getBoundingClientRect();
              const padding = 40;
              const availableWidth = rect.width - padding * 2;
              const availableHeight = rect.height - padding * 2;
              const scaleX = availableWidth / room.width;
              const scaleY = availableHeight / room.height;
              const maxZoom = Math.min(scaleX, scaleY, 3);
              setZoom(z => Math.min(z * 1.2, maxZoom));
            }
          }}>+</button>
          <span>{(zoom * 100).toFixed(0)}%</span>
          <button onClick={() => setZoom(z => Math.max(z / 1.2, 0.1))}>-</button>
        </div>
      </div>

      <div className="layout-content-wrapper">
        <div className="layout-canvas-container">
          <canvas
            ref={canvasRef}
            className="room-layout-canvas"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          />
        </div>

        <div className="layout-sidebar" style={{ width: '300px', overflowY: 'auto' }}>
          <div style={{ marginBottom: '20px' }}>
            <h5>Приборы проекта</h5>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '8px', padding: '10px', background: '#fff' }}>
              {projectAppliances.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#666', textAlign: 'center', padding: '10px' }}>Нет приборов в проекте</p>
              ) : (
                <ProjectAppliancesList
                  appliances={projectAppliances}
                  rooms={[room]}
                  onApplianceSelect={(appliance) => {
                    setSelectedAppliance(appliance);
                    setActiveTool('appliance');
                    setQuickPlaceMode(null);
                  }}
                />
              )}
            </div>
            {selectedAppliance && (
              <div style={{ marginTop: '10px', padding: '8px', background: '#e3f2fd', borderRadius: '8px', fontSize: '12px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                  Выбран: {selectedAppliance.applianceName || selectedAppliance.name}
                </div>
                <div style={{ fontSize: '11px', color: '#666', marginBottom: '5px' }}>
                  Кликните на плане для размещения
                </div>
                <button 
                  onClick={() => {
                    setSelectedAppliance(null);
                    setActiveTool('select');
                  }}
                  style={{ marginTop: '5px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                >
                  Сбросить выбор
                </button>
              </div>
            )}
          </div>

          <div>
            <h5>Перегородки ({internalWalls.length + externalWalls.length})</h5>
            {loading ? (
              <div className="loading">Загрузка...</div>
            ) : (internalWalls.length === 0 && externalWalls.length === 0) ? (
              <div className="empty-state">
                <p>Нет стен</p>
              </div>
            ) : (
              <div className="walls-items">
                {/* Внешние стены */}
                {externalWalls.map((wall) => (
                  <div 
                    key={`external-${wall.id}`} 
                    className={`wall-item external-wall ${wall.id === selectedExternalWall?.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedExternalWall(wall);
                      setSelectedWall(null);
                    }}
                  >
                    <div className="wall-info">
                      <div className="wall-coords">
                        <span style={{ color: '#8b4513', fontWeight: 'bold' }}>Внешняя: </span>
                        ({parseFloat(wall.startX).toFixed(0)}, {parseFloat(wall.startY).toFixed(0)}) → 
                        ({parseFloat(wall.endX).toFixed(0)}, {parseFloat(wall.endY).toFixed(0)})
                      </div>
                      <div className="wall-details">
                        Толщина: {wall.thickness || 20} см | 
                        Проемов: {wall.openings?.length || 0}
                      </div>
                    </div>
                  </div>
                ))}
                {/* Внутренние стены */}
                {internalWalls.map((wall) => (
                  <div 
                    key={wall.id} 
                    className={`wall-item ${wall.id === selectedWall?.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedWall(wall);
                      setSelectedExternalWall(null);
                    }}
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

          <div style={{ marginTop: '20px' }}>
            <h5>Оборудование ({electricalPoints.length})</h5>
            {electricalPoints.length === 0 ? (
              <div className="empty-state">
                <p>Нет размещенных точек</p>
              </div>
            ) : (
              <div className="points-list">
                {electricalPoints.map((point) => {
                  // Для приборов показываем название прибора, для остальных - тип символа
                  let displayName = '';
                  let displaySubtitle = '';
                  
                  if (point.applianceId && applianceDetails[point.applianceId]) {
                    const appliance = applianceDetails[point.applianceId];
                    displayName = appliance.name || 'Прибор';
                    // Получаем категории
                    const categories = appliance.categories || [];
                    if (categories.length > 0) {
                      displaySubtitle = categories.map(c => c.name).join(', ');
                    } else if (appliance.category) {
                      displaySubtitle = appliance.category;
                    }
                  } else {
                    // Для розеток, ламп и т.д.
                    const symbolName = point.electricalSymbol?.name || '';
                    if (point.electricalSymbol?.type === 'outlet') {
                      displayName = '🔌 ' + (symbolName || 'Розетка');
                    } else if (point.electricalSymbol?.type === 'light') {
                      displayName = '💡 ' + (symbolName || 'Лампа');
                    } else {
                      displayName = '⚡ ' + (symbolName || 'Точка');
                    }
                    if (point.notes) {
                      displaySubtitle = point.notes;
                    }
                  }
                  
                  return (
                    <div key={point.id} className="point-item">
                      <div className="point-info">
                        <div style={{ fontWeight: '500' }}>{displayName}</div>
                        {displaySubtitle && (
                          <div style={{ fontSize: '11px', color: '#666' }}>{displaySubtitle}</div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeletePoint(point.id)}
                        className="btn-delete-small"
                        style={{ padding: '2px 8px', fontSize: '12px' }}
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
      </div>

      {/* Диалоговое окно для ввода мощности лампы */}
      <Modal
        show={showPowerDialog}
        title="Укажите мощность лампы"
        onClose={handlePowerDialogCancel}
        onConfirm={handlePowerDialogConfirm}
        confirmText="Разместить"
        cancelText="Отмена"
        type="form"
      >
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#2c3e50' }}>
            Мощность (Вт):
          </label>
          <input
            type="number"
            value={powerInputValue}
            onChange={(e) => setPowerInputValue(e.target.value)}
            min="1"
            step="1"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
            autoFocus
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handlePowerDialogConfirm();
              }
            }}
          />
          <small style={{ display: 'block', marginTop: '5px', color: '#666', fontSize: '12px' }}>
            Укажите потребляемую мощность лампы в ваттах
          </small>
        </div>
      </Modal>
      <Modal
        show={confirmModal.show}
        title="Подтверждение"
        type="confirm"
        onClose={() => setConfirmModal({ show: false, type: '', id: null, onConfirm: null })}
        onConfirm={confirmModal.onConfirm}
        confirmText="Удалить"
        cancelText="Отмена"
      >
        <p>{confirmModal.type === 'wall' ? 'Удалить эту перегородку?' : 
            confirmModal.type === 'point' ? 'Удалить эту точку?' : 
            'Удалить все узлы на стенах?'}
        </p>
      </Modal>
    </div>
  );
};

export default RoomLayoutEditorWithAppliances;

