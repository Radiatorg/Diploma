import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { roomAPI, applianceAPI, projectAPI, projectApplianceAPI, calculationAPI, specificationAPI, emailAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/UI/Modal';
import CalculationSheet from '../components/CalculationSheet/CalculationSheet';
import ElectricalSpecification from '../components/ElectricalSpecification/ElectricalSpecification';
import TKP339Recommendations from '../components/TKP339Recommendations/TKP339Recommendations';
import { 
  calculateMinOutlets, 
  validateRoomArea, 
  validateSocketGroups,
  requiresRCD,
  requiresSeparateLine,
  TKP339_NORMS
} from '../utils/tkp339Validations';
import './StepByStepCalculator.css';

const StepByStepCalculator = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Состояние шагов
  const [currentStep, setCurrentStep] = useState(1);
  const [project, setProject] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [pendingProjectId, setPendingProjectId] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailForSending, setEmailForSending] = useState('');
  const [showProjectNameModal, setShowProjectNameModal] = useState(false);
  const [projectNameInput, setProjectNameInput] = useState('');
  
  // Шаг 1: Конфигурация объекта
  const [step1Data, setStep1Data] = useState({
    projectType: 'apartment', // apartment, house, dacha
    area: ''
  });
  
  // Шаг 2: Выбор помещений
  const [roomTypes, setRoomTypes] = useState([]);
  const [selectedRooms, setSelectedRooms] = useState([]); // Массив объектов { id: string, roomTypeId: number }
  const [currentSelectedRoomType, setCurrentSelectedRoomType] = useState(null); // ID типа помещения, который сейчас выбран
  
  // Шаг 3: Настройка комнат
  const [appliances, setAppliances] = useState([]);
  const [roomsConfig, setRoomsConfig] = useState({}); // { roomId: { appliances: [{id, quantity}], socketGroups: 1, socketsPerGroup: 2, area: number, windowCount: number } }
  const [roomsAreas, setRoomsAreas] = useState({}); // { roomId: area }
  const [validationErrors, setValidationErrors] = useState({}); // { roomId: { socketGroups: string, area: string } }
  const [showAppliancesForRoom, setShowAppliancesForRoom] = useState({}); // { roomId: boolean } - показывать ли список приборов для комнаты
  const [applianceSearchQuery, setApplianceSearchQuery] = useState({}); // { roomId: string } - поисковый запрос для каждой комнаты
  const [expandedRooms, setExpandedRooms] = useState({}); // { roomId: boolean } - раскрыто ли помещение
  
  // Результаты
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (projectId) {
      loadProject();
    }
    loadRoomTypes();
    loadAppliances();
  }, [projectId]);

  useEffect(() => {
    // Показываем результаты только при первой загрузке проекта, не при изменении количества комнат
    if (projectId && project && !showResults && selectedRooms.length > 0 && currentStep === 1) {
      // Только при первой загрузке, если мы еще не показывали результаты
      setShowResults(true);
    } else if (!projectId) {
      setShowResults(false);
    }
  }, [projectId, project]);

  const loadProject = async () => {
    if (!projectId) return;
    try {
      const [projectRes, roomsRes, appliancesRes] = await Promise.all([
        projectAPI.getById(projectId),
        roomAPI.getByProject(projectId).catch(() => ({ data: [] })),
        projectApplianceAPI.getByProject(projectId).catch(() => ({ data: [] }))
      ]);
      
      const project = projectRes.data;
      setProject(project);
      
      // Загружаем существующие данные проекта
      const existingRooms = roomsRes.data || [];
      const existingAppliances = appliancesRes.data || [];
      
      // Инициализируем данные из существующего проекта
      if (existingRooms.length > 0) {
        // Заполняем step1Data из проекта
        // Сначала проверяем поле totalArea проекта
        let totalArea = project.totalArea ? parseFloat(project.totalArea).toFixed(2) : '';
        
        // Если totalArea не указана, пытаемся извлечь из названия
        if (!totalArea) {
          const projectName = project.name || '';
          const areaMatch = projectName.match(/(\d+(?:\.\d+)?)\s*м²/);
          if (areaMatch) {
            totalArea = areaMatch[1];
          }
        }
        
        // Если все еще нет, вычисляем общую площадь из площадей комнат
        if (!totalArea && existingRooms.length > 0) {
          totalArea = existingRooms.reduce((sum, room) => {
            const roomArea = parseFloat(room.area) || 0;
            return sum + roomArea;
          }, 0).toFixed(2);
        }
        
        setStep1Data({
          projectType: project.description?.includes('Квартира') ? 'apartment' :
                      project.description?.includes('Дом') ? 'house' :
                      project.description?.includes('Дача') ? 'dacha' : 'apartment',
          area: totalArea || ''
        });
        
        // Заполняем выбранные комнаты и их конфигурацию
        // Создаем массив объектов с уникальными ID для каждой комнаты
        const loadedRooms = existingRooms.map((r, index) => ({
          id: `room_${r.id}_${Date.now()}_${index}`,
          roomTypeId: r.roomTypeId
        }));
        setSelectedRooms(loadedRooms);
        
        // Создаем конфигурацию для существующих комнат
        const config = {};
        const areas = {};
        
        existingRooms.forEach((room, index) => {
          // Используем уникальный ID из loadedRooms
          const roomUniqueId = loadedRooms[index].id;
          
          // Преобразуем socketGroupsConfig из JSON или используем старые поля
          let socketGroupsConfig = [{ socketsCount: 1 }];
          if (room.socketGroupsConfig) {
            try {
              socketGroupsConfig = JSON.parse(room.socketGroupsConfig);
            } catch (e) {
              if (room.socketGroups && room.socketGroups > 0) {
                const socketsPerGroup = room.socketsPerGroup || 1;
                socketGroupsConfig = Array(room.socketGroups).fill(null).map(() => ({ socketsCount: socketsPerGroup }));
              }
            }
          } else if (room.socketGroups && room.socketGroups > 0) {
            const socketsPerGroup = room.socketsPerGroup || 1;
            socketGroupsConfig = Array(room.socketGroups).fill(null).map(() => ({ socketsCount: socketsPerGroup }));
          }
          
          config[roomUniqueId] = {
            appliances: existingAppliances
              .filter(a => a.roomId === room.id)
              .map(a => ({ id: a.applianceId, quantity: a.quantity || 1 })),
            socketGroupsConfig: socketGroupsConfig,
            windowCount: room.windowCount ?? 0,
            roomTypeId: room.roomTypeId // Сохраняем roomTypeId для удобства
          };
          areas[roomUniqueId] = room.area ? parseFloat(parseFloat(room.area).toFixed(2)) : 0;
        });
        
        setRoomsConfig(config);
        setRoomsAreas(areas);
        
        // Переходим к шагу 3 для редактирования только если есть данные
        if (loadedRooms.length > 0) {
          setCurrentStep(3);
          // НЕ показываем результаты автоматически при редактировании - пользователь сам решит
          // setShowResults(true);
        } else {
          // Если есть площадь, но нет комнат, переходим на шаг 2
          const totalArea = existingRooms.reduce((sum, room) => {
            const roomArea = parseFloat(room.area) || 0;
            return sum + roomArea;
          }, 0).toFixed(2);
          if (totalArea && parseFloat(totalArea) > 0) {
            setCurrentStep(2);
          }
          setShowResults(false);
        }
      } else if (project) {
        // Если проект существует, но нет комнат, загружаем базовые данные
        // Сначала проверяем поле totalArea проекта
        let area = project.totalArea ? parseFloat(project.totalArea).toFixed(2) : '';
        
        // Если totalArea не указана, пытаемся извлечь из названия
        if (!area) {
          const projectName = project.name || '';
          const areaMatch = projectName.match(/(\d+(?:\.\d+)?)\s*м²/);
          if (areaMatch) {
            area = areaMatch[1];
          }
        }
        
        setStep1Data({
          projectType: project.description?.includes('Квартира') ? 'apartment' :
                      project.description?.includes('Дом') ? 'house' :
                      project.description?.includes('Дача') ? 'dacha' : 'apartment',
          area: area || ''
        });
        
        // Если есть площадь, переходим на шаг 2
        if (area) {
          setCurrentStep(2);
        }
      }
    } catch (err) {
      console.error('Ошибка загрузки проекта:', err);
      setError('Проект не найден');
    }
  };

  const loadRoomTypes = async () => {
    try {
      const response = await roomAPI.getTypes();
      setRoomTypes(response.data || []);
    } catch (err) {
      console.error('Ошибка загрузки типов комнат:', err);
      setError('Не удалось загрузить типы помещений');
    }
  };

  const loadAppliances = async () => {
    try {
      const response = await applianceAPI.getAll();
      setAppliances(response.data || []);
    } catch (err) {
      console.error('Ошибка загрузки приборов:', err);
      setError('Не удалось загрузить каталог приборов');
    }
  };

  const handleStep1Next = () => {
    const area = parseFloat(step1Data.area);
    
    if (!step1Data.area || area <= 0) {
      setError('Укажите площадь объекта');
      return;
    }
    
    if (area < 20) {
      setError('Площадь объекта должна быть не менее 20 м²');
      return;
    }
    
    if (area > 1000) {
      setError('Площадь объекта не должна превышать 1000 м². Для больших объектов обратитесь к специалисту');
      return;
    }
    
    setError('');
    setCurrentStep(2);
  };

  const handleStep2Next = () => {
    if (selectedRooms.length === 0) {
      setError('Выберите хотя бы одно помещение');
      return;
    }
    setError('');
    
    // Валидация площади
    const totalArea = parseFloat(step1Data.area);
    if (isNaN(totalArea) || totalArea <= 0) {
      setError('Пожалуйста, укажите корректную площадь объекта (больше 0 м²)');
      return;
    }
    
    // Инициализируем конфигурацию для выбранных комнат
    const initialConfig = {};
    const initialAreas = {};
    
    // Сначала рассчитываем площади с коэффициентами
    const calculatedAreas = [];
    selectedRooms.forEach(room => {
      const roomType = roomTypes.find(rt => rt.id === room.roomTypeId);
      if (!roomType) {
        console.warn(`Тип помещения не найден для комнаты ${room.id}`);
        return;
      }
      
      // Распределяем площадь с учетом типа помещения
      const roomCount = selectedRooms.length;
      let baseArea = totalArea / roomCount;
      
      // Проверяем, что площадь получилась валидной
      if (isNaN(baseArea) || baseArea <= 0) {
        console.error(`Некорректная площадь для комнаты ${room.id}`);
        baseArea = 10; // Значение по умолчанию
      }
      
      // Корректируем площадь в зависимости от типа помещения
      const roomName = roomType.name.toLowerCase();
      if (roomName.includes('кухн')) {
        baseArea = baseArea * 1.2;
      } else if (roomName.includes('ванн') || roomName.includes('туалет')) {
        baseArea = baseArea * 0.5;
      } else if (roomName.includes('прихож') || roomName.includes('коридор')) {
        baseArea = baseArea * 0.6;
      }
      
      calculatedAreas.push({ roomId: room.id, area: parseFloat(Math.max(1, baseArea).toFixed(2)) });
    });
    
    // Проверяем, не превышает ли сумма общую площадь
    const totalCalculatedArea = calculatedAreas.reduce((sum, item) => sum + item.area, 0);
    if (totalCalculatedArea > totalArea) {
      // Нормализуем площади пропорционально
      const scaleFactor = totalArea / totalCalculatedArea;
      calculatedAreas.forEach(item => {
        item.area = parseFloat((item.area * scaleFactor).toFixed(2));
      });
    }
    
    // Заполняем конфигурацию и площади
    selectedRooms.forEach(room => {
      const roomType = roomTypes.find(rt => rt.id === room.roomTypeId);
      if (!roomType) return;
      
      const areaData = calculatedAreas.find(a => a.roomId === room.id);
      const finalArea = areaData ? areaData.area : parseFloat(Math.max(1, totalArea / selectedRooms.length).toFixed(2));
      
      // Рассчитываем рекомендуемое количество розеточных групп
      const minOutlets = calculateMinOutlets(roomType.name, finalArea);
      const recommendedGroups = Math.max(1, Math.ceil(minOutlets / 4));
      
      initialConfig[room.id] = {
        appliances: [], // Массив объектов {id, quantity}
        socketGroupsConfig: [{ socketsCount: 1 }], // По умолчанию 1 группа с 1 розеткой
        windowCount: 0, // По умолчанию 0 окон
        roomTypeId: room.roomTypeId // Сохраняем roomTypeId для удобства
      };
      initialAreas[room.id] = finalArea;
    });
    
    setRoomsConfig(initialConfig);
    setRoomsAreas(initialAreas);
    setCurrentStep(3);
  };

  const handleStep2Back = () => {
    setError(''); // Очищаем ошибки при возврате
    setCurrentStep(1);
  };

  const handleStep3Back = () => {
    setError(''); // Очищаем ошибки при возврате
    // Проверяем, что данные шага 2 валидны перед возвратом
    if (selectedRooms.length === 0) {
      setError('Пожалуйста, выберите хотя бы одно помещение перед возвратом');
      return;
    }
    setCurrentStep(2);
  };

  const handleOpen3DEditor = () => {
    if (!projectId) {
      setError('Сначала сохраните проект расчетом, затем откройте 3D-редактор.');
      return;
    }
    navigate(`/projects/${projectId}/floor-plan`);
  };

  const addRoom = (roomTypeId) => {
    // Более надежный способ генерации уникального ID
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    const counter = Math.floor(Math.random() * 10000);
    const uniqueId = `room_${timestamp}_${random}_${counter}`;
    setSelectedRooms(prev => [...prev, { id: uniqueId, roomTypeId }]);
  };

  const removeRoom = (roomId) => {
    setSelectedRooms(prev => prev.filter(room => room.id !== roomId));
    // Очищаем конфигурацию удаленной комнаты
    setRoomsConfig(prev => {
      const newConfig = { ...prev };
      delete newConfig[roomId];
      return newConfig;
    });
    setRoomsAreas(prev => {
      const newAreas = { ...prev };
      delete newAreas[roomId];
      return newAreas;
    });
    setShowAppliancesForRoom(prev => {
      const newShow = { ...prev };
      delete newShow[roomId];
      return newShow;
    });
    setExpandedRooms(prev => {
      const newExpanded = { ...prev };
      delete newExpanded[roomId];
      return newExpanded;
    });
  };

  const removeRoomOfType = (roomTypeId) => {
    const roomsOfType = selectedRooms.filter(r => r.roomTypeId === roomTypeId);
    if (roomsOfType.length > 0) {
      // Удаляем последнюю комнату этого типа
      const lastRoom = roomsOfType[roomsOfType.length - 1];
      removeRoom(lastRoom.id);
    }
  };

  const toggleAppliance = (roomId, applianceId) => {
    setRoomsConfig(prev => {
      const roomConfig = prev[roomId] || { appliances: [] };
      const appliances = roomConfig.appliances || [];
      
      const existingIndex = appliances.findIndex(a => a.id === applianceId);
      if (existingIndex >= 0) {
        // Удаляем прибор
        return {
          ...prev,
          [roomId]: {
            ...roomConfig,
            appliances: appliances.filter(a => a.id !== applianceId)
          }
        };
      } else {
        // Добавляем прибор с количеством 1
        return {
          ...prev,
          [roomId]: {
            ...roomConfig,
            appliances: [...appliances, { id: applianceId, quantity: 1 }]
          }
        };
      }
    });
  };

  const updateApplianceQuantity = (roomId, applianceId, quantity) => {
    setRoomsConfig(prev => {
      const roomConfig = prev[roomId] || { appliances: [] };
      const appliances = roomConfig.appliances || [];
      
      const updatedAppliances = appliances.map(a => 
        a.id === applianceId ? { ...a, quantity: Math.max(1, parseInt(quantity) || 1) } : a
      );
      
      return {
        ...prev,
        [roomId]: {
          ...roomConfig,
          appliances: updatedAppliances
        }
      };
    });
  };


  const handleCalculate = async () => {
    // Показываем модальное окно для ввода/изменения названия
    if (!projectId) {
      // При создании - предлагаем название по умолчанию
      const defaultName = `${step1Data.projectType === 'apartment' ? 'Квартира' : step1Data.projectType === 'house' ? 'Дом' : 'Дача'} ${step1Data.area} м²`;
      setProjectNameInput(defaultName);
    } else {
      // При редактировании - показываем существующее название
      setProjectNameInput(project?.name || '');
    }
    setShowProjectNameModal(true);
  };

  const saveProject = async () => {
    setSaving(true);
    setError('');
    
    try {
      // Если проект уже существует, используем его, иначе создаем новый
      let targetProjectId = projectId;
      let existingRooms = [];
      let existingAppliances = [];
      
      if (targetProjectId) {
        // Обновляем название проекта, если оно изменилось
        if (projectNameInput.trim() && projectNameInput.trim() !== project?.name) {
          await projectAPI.update(targetProjectId, { name: projectNameInput.trim() });
        }
        
        // Загружаем существующие данные проекта
        const [roomsRes, appliancesRes] = await Promise.all([
          roomAPI.getByProject(targetProjectId).catch(() => ({ data: [] })),
          projectApplianceAPI.getByProject(targetProjectId).catch(() => ({ data: [] }))
        ]);
        existingRooms = roomsRes.data || [];
        existingAppliances = appliancesRes.data || [];
      } else {
        // Создаем новый проект с введенным названием
        const projectName = projectNameInput.trim() || `${step1Data.projectType === 'apartment' ? 'Квартира' : step1Data.projectType === 'house' ? 'Дом' : 'Дача'} ${step1Data.area} м²`;
        
        // Формируем описание с иерархией сущностей только при создании
        let description = `${projectName} (${step1Data.projectType === 'apartment' ? 'Квартира' : step1Data.projectType === 'house' ? 'Дом' : 'Дача'}, ${step1Data.area} м²)\n`;
        
        // Добавляем помещения и приборы
        selectedRooms.forEach((selectedRoom, index) => {
          const roomType = roomTypes.find(rt => rt.id === selectedRoom.roomTypeId);
          if (!roomType) return;
          
          const roomArea = roomsAreas[selectedRoom.id] || 0;
          const sameTypeCount = selectedRooms.filter(r => r.roomTypeId === selectedRoom.roomTypeId).length;
          const roomNumber = selectedRooms.filter(r => r.roomTypeId === selectedRoom.roomTypeId && r.id <= selectedRoom.id).length;
          const roomTitle = sameTypeCount > 1 ? `${roomType.name} (${roomNumber})` : roomType.name;
          
          description += `\t${roomTitle} (${roomArea.toFixed(2)} м²)\n`;
          
          const roomConfig = roomsConfig[selectedRoom.id];
          const roomAppliances = roomConfig?.appliances || [];
          if (roomAppliances.length > 0) {
            roomAppliances.forEach(applianceData => {
              const appliance = appliances.find(a => a.id === applianceData.id);
              if (appliance) {
                const quantity = applianceData.quantity || 1;
                description += `\t\t- ${appliance.name}${quantity > 1 ? ` (${quantity} шт.)` : ''}\n`;
              }
            });
          }
        });
        
        const projectData = {
          name: projectName,
          description: description
        };
        const projectRes = await projectAPI.create(projectData);
        targetProjectId = projectRes.data.id;
        setProject(projectRes.data);
      }

      // Создаем или обновляем комнаты
      const createdRooms = [];
      const roomIdToRoomId = {}; // Маппинг временного roomId -> реального roomId для обновления приборов
      const existingRoomsMap = new Map(); // Маппинг для быстрого поиска существующих комнат
      
      // Создаем маппинг существующих комнат по их индексу в selectedRooms
      if (targetProjectId && existingRooms.length > 0) {
        existingRooms.forEach((room, index) => {
          if (index < selectedRooms.length) {
            const selectedRoomId = selectedRooms[index].id;
            existingRoomsMap.set(selectedRoomId, room);
          }
        });
      }
      
      for (let index = 0; index < selectedRooms.length; index++) {
        const selectedRoom = selectedRooms[index];
        const roomType = roomTypes.find(rt => rt.id === selectedRoom.roomTypeId);
        if (!roomType) continue;
        
        // Используем рассчитанную площадь из roomsAreas или вычисляем заново
        let roomArea = roomsAreas[selectedRoom.id];
        if (!roomArea) {
          const roomCount = selectedRooms.length;
          const baseArea = parseFloat(step1Data.area) / roomCount;
          const roomName = roomType.name?.toLowerCase();
          
          if (roomName?.includes('кухн')) {
            roomArea = baseArea * 1.2;
          } else if (roomName?.includes('ванн') || roomName?.includes('туалет')) {
            roomArea = baseArea * 0.5;
          } else if (roomName?.includes('прихож') || roomName?.includes('коридор')) {
            roomArea = baseArea * 0.6;
          } else {
            roomArea = baseArea;
          }
        }
        
        const roomConfig = roomsConfig[selectedRoom.id] || { windowCount: 0, socketGroupsConfig: [{ socketsCount: 1 }] };
        
        // Подсчитываем номер комнаты этого типа для имени
        const sameTypeCount = selectedRooms.filter(r => r.roomTypeId === selectedRoom.roomTypeId).length;
        const roomNumber = selectedRooms.filter(r => r.roomTypeId === selectedRoom.roomTypeId && r.id <= selectedRoom.id).length;
        const roomName = sameTypeCount > 1 ? `${roomType.name} (${roomNumber})` : roomType.name;
        
        // Проверяем, есть ли уже существующая комната для обновления
        const existingRoom = existingRoomsMap.get(selectedRoom.id);
        
        const roomData = {
          name: roomName,
          roomTypeId: selectedRoom.roomTypeId,
          area: (Math.floor(roomArea * 100) / 100).toFixed(2), // Округляем до 2 знаков после запятой вниз
          description: existingRoom?.description || '', // Сохраняем существующее описание, если комната уже есть
          windowCount: roomConfig.windowCount ?? 0,
          socketGroupsConfig: JSON.stringify(roomConfig.socketGroupsConfig || [{ socketsCount: 1 }])
        };
        
        let room;
        if (existingRoom) {
          // Обновляем существующую комнату, сохраняя её описание
          const updatedRoomRes = await roomAPI.update(targetProjectId, existingRoom.id, {
            ...roomData,
            description: existingRoom.description || '' // Явно сохраняем существующее описание
          });
          room = { ...updatedRoomRes.data, roomTypeId: selectedRoom.roomTypeId };
          roomIdToRoomId[selectedRoom.id] = existingRoom.id;
        } else {
          // Создаем новую комнату
          const roomRes = await roomAPI.create(targetProjectId, roomData);
          room = { ...roomRes.data, roomTypeId: selectedRoom.roomTypeId };
          roomIdToRoomId[selectedRoom.id] = room.id;
        }
        
        createdRooms.push(room);
      }

      // Удаляем только те комнаты, которые больше не используются
      if (targetProjectId && existingRooms.length > 0) {
        try {
          const usedRoomIds = new Set(Object.values(roomIdToRoomId));
          const roomsToDelete = existingRooms.filter(r => !usedRoomIds.has(r.id));
          
          if (roomsToDelete.length > 0) {
            // Получаем все project_appliances проекта
            const existingAppliancesRes = await projectApplianceAPI.getByProject(targetProjectId);
            const existingProjectAppliances = existingAppliancesRes.data || [];
            
            // Удаляем все project_appliances, связанные с комнатами, которые будут удалены
            const roomsToDeleteIds = new Set(roomsToDelete.map(r => r.id));
            for (const projectAppliance of existingProjectAppliances) {
              if (projectAppliance.roomId && roomsToDeleteIds.has(projectAppliance.roomId)) {
                try {
                  await projectApplianceAPI.delete(targetProjectId, projectAppliance.id);
                } catch (err) {
                  console.warn('Ошибка удаления project_appliance:', err);
                }
              }
            }
            
            // Удаляем только неиспользуемые комнаты
            for (const room of roomsToDelete) {
              try {
                await roomAPI.delete(targetProjectId, room.id);
              } catch (err) {
                console.warn('Ошибка удаления комнаты:', err);
              }
            }
          }
        } catch (err) {
          console.error('Ошибка при удалении неиспользуемых комнат:', err);
          // Продолжаем выполнение, даже если не удалось удалить старые комнаты
        }
      }

      // Обновляем приборы для каждой комнаты
      for (const selectedRoom of selectedRooms) {
        const realRoomId = roomIdToRoomId[selectedRoom.id];
        if (!realRoomId) continue;
        
        const roomConfig = roomsConfig[selectedRoom.id];
        const selectedAppliances = roomConfig?.appliances || []; // Массив {id, quantity}
        
        // Добавляем приборы для новой комнаты
        for (const selectedAppliance of selectedAppliances) {
          await projectApplianceAPI.add(targetProjectId, {
            applianceId: selectedAppliance.id,
            roomId: realRoomId,
            quantity: selectedAppliance.quantity || 1
          });
        }
      }

      // Сохраняем ID проекта для модального окна
      setPendingProjectId(targetProjectId);
      // Если у пользователя нет email, инициализируем пустым, иначе заполняем
      setEmailForSending(user?.email || '');
      
      // Если редактируем существующий проект, переключаемся на результаты
      if (projectId) {
        setShowResults(true);
        setShowEmailModal(true);
      } else {
        setShowEmailModal(true);
      }
      
      setSaving(false);
      setShowProjectNameModal(false);
      setProjectNameInput('');
    } catch (err) {
      console.error('Ошибка сохранения проекта:', err);
      setError(err.response?.data?.message || 'Не удалось сохранить проект и выполнить расчеты');
      setSaving(false);
    }
  };

  const handleProjectNameModalConfirm = async () => {
    if (!projectNameInput.trim()) {
      setError('Введите название проекта');
      return;
    }
    setShowProjectNameModal(false);
    await saveProject();
  };

  const handleProjectNameModalCancel = () => {
    setShowProjectNameModal(false);
    setProjectNameInput('');
  };

  const handleEmailModalConfirm = async () => {
    if (!pendingProjectId) return;
    
    // Проверяем наличие email
    const emailToUse = emailForSending.trim();
    if (!emailToUse) {
      setError('Укажите адрес электронной почты для отправки документов');
      return;
    }
    
    // Простая валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToUse)) {
      setError('Введите корректный адрес электронной почты');
      return;
    }
    
    setSendingEmail(true);
    try {
      // Если email изменился и его нет у пользователя, обновляем профиль
      if (!user?.email && emailToUse !== user?.email) {
        try {
          const { userAPI } = await import('../api/api');
          await userAPI.updateProfile({ email: emailToUse });
        } catch (profileErr) {
          console.warn('Не удалось обновить email в профиле:', profileErr);
        }
      }
      
      // Отправляем PDF на почту
      const { emailAPI } = await import('../api/api');
      await emailAPI.sendCalculationAndSpecification(pendingProjectId);
      
      setShowEmailModal(false);
      setEmailForSending('');
      navigate(`/projects/${pendingProjectId}/calculator`, { replace: true });
    } catch (err) {
      console.error('Ошибка отправки на почту:', err);
      setError('Не удалось отправить документы на почту, но расчеты сохранены');
      setShowEmailModal(false);
      navigate(`/projects/${pendingProjectId}/calculator`, { replace: true });
    } finally {
      setSendingEmail(false);
      setPendingProjectId(null);
    }
  };

  const handleEmailModalCancel = () => {
    setShowEmailModal(false);
    setEmailForSending('');
    if (pendingProjectId) {
      navigate(`/projects/${pendingProjectId}/calculator`, { replace: true });
    }
    setPendingProjectId(null);
  };

  // Если показываем результаты для существующего проекта
  if (projectId && project && showResults) {
    return (
      <div className="step-calculator-results fade-in">
        <div className="results-header">
          <h1>Результаты расчета</h1>
          <div className="results-actions">
            <button onClick={handleOpen3DEditor} className="btn-primary results-action-btn">
              Открыть 3D редактор
            </button>
            <button onClick={() => {
              setShowResults(false);
            }} className="btn-secondary results-action-btn">
              Изменить текущий
            </button>
            <button onClick={() => navigate(`/projects/${projectId}`)} className="btn-primary results-action-btn">
              Перейти к проекту
            </button>
          </div>
        </div>
        <div className="results-content">
          <div className="results-email-section">
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}
            <button 
              onClick={async () => {
                try {
                  setSendingEmail(true);
                  setError('');
                  setSuccess('');
                  await emailAPI.sendCalculationAndSpecification(projectId);
                  setSuccess('Расчётная ведомость и смета успешно отправлены на email');
                  setTimeout(() => setSuccess(''), 5000);
                } catch (err) {
                  console.error('Ошибка отправки на почту:', err);
                  const errorMessage = err.response?.data?.message || 'Не удалось отправить документы на почту';
                  setError(errorMessage);
                  setTimeout(() => setError(''), 5000);
                } finally {
                  setSendingEmail(false);
                }
              }}
              className="btn-primary email-send-btn"
              disabled={sendingEmail}
            >
              {sendingEmail ? 'Отправка...' : 'Отправить на email'}
            </button>
          </div>
          <CalculationSheet projectId={projectId} />
          <ElectricalSpecification projectId={projectId} />
        </div>
      </div>
    );
  }

  return (
    <div className="step-by-step-calculator fade-in">
      <div className="calculator-header">
        <h1>Калькулятор ведомости</h1>
        {project && <p className="project-name">Проект: {project.name}</p>}
        {projectId && (
          <div className="results-actions" style={{ marginTop: '12px' }}>
            <button onClick={handleOpen3DEditor} className="btn-primary results-action-btn">
              Перейти в 3D редактор
            </button>
          </div>
        )}
      </div>

      <div className="steps-indicator">
        <div 
          className={`step-indicator ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''} ${currentStep >= 1 ? 'clickable' : ''}`}
          onClick={() => {
            if (currentStep >= 1) {
              // При переходе на шаг 1 сохраняем текущие данные
              setCurrentStep(1);
              setError(''); // Очищаем ошибки при переключении
            }
          }}
          style={{ cursor: currentStep >= 1 ? 'pointer' : 'default' }}
        >
          <div className="step-number">1</div>
          <div className="step-label">Конфигурация объекта</div>
        </div>
        <div 
          className={`step-indicator ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''} ${currentStep >= 2 ? 'clickable' : ''}`}
          onClick={() => {
            if (currentStep >= 2 && step1Data.area) {
              // При переходе на шаг 2 проверяем валидность данных шага 1
              const area = parseFloat(step1Data.area);
              if (isNaN(area) || area <= 0) {
                setError('Пожалуйста, укажите корректную площадь объекта');
                setCurrentStep(1);
                return;
              }
              setCurrentStep(2);
              setError(''); // Очищаем ошибки при переключении
            }
          }}
          style={{ cursor: currentStep >= 2 && step1Data.area ? 'pointer' : 'default' }}
        >
          <div className="step-number">2</div>
          <div className="step-label">Выбор помещений</div>
        </div>
        <div 
          className={`step-indicator ${currentStep >= 3 ? 'active' : ''} ${currentStep >= 3 ? 'clickable' : ''}`}
          onClick={() => {
            if (currentStep >= 3 && selectedRooms.length > 0) {
              // При переходе на шаг 3 проверяем валидность данных
              if (selectedRooms.length === 0) {
                setError('Пожалуйста, выберите хотя бы одно помещение');
                setCurrentStep(2);
                return;
              }
              setCurrentStep(3);
              setError(''); // Очищаем ошибки при переключении
            }
          }}
          style={{ cursor: currentStep >= 3 && selectedRooms.length > 0 ? 'pointer' : 'default' }}
        >
          <div className="step-number">3</div>
          <div className="step-label">Настройка комнат</div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="step-content">
        {/* Шаг 1: Конфигурация объекта */}
        {currentStep === 1 && (
          <div className="step-panel">
            <h2>Шаг 1: Конфигурация объекта</h2>
            <div className="form-group">
              <label>Тип объекта *</label>
              <select
                value={step1Data.projectType}
                onChange={(e) => setStep1Data({ ...step1Data, projectType: e.target.value })}
              >
                <option value="apartment">Квартира</option>
                <option value="house">Дом</option>
                <option value="dacha">Дача</option>
              </select>
            </div>
            <div className="form-group">
              <label>Общая площадь (м²) *</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={step1Data.area}
                onChange={(e) => setStep1Data({ ...step1Data, area: e.target.value })}
                placeholder="Например: 65"
              />
              <div className="field-hint">
                Укажите общую площадь объекта. Минимум: 20 м², максимум: 1000 м²
              </div>
            </div>
            <div className="step-actions">
              <button onClick={handleStep1Next} className="btn-primary" disabled={loading}>
                Далее →
              </button>
            </div>
          </div>
        )}

        {/* Шаг 2: Выбор помещений */}
        {currentStep === 2 && (
          <div className="step-panel">
            <h2>Шаг 2: Выбор помещений</h2>
            <p className="step-description">Добавьте помещения, которые будут в вашем проекте. Можно добавить несколько комнат одного типа:</p>
            <div className="rooms-selection">
              {roomTypes.length === 0 ? (
                <div className="loading">Загрузка типов помещений...</div>
              ) : (
                <>
                  <div className="rooms-grid">
                    {roomTypes.map(roomType => {
                      const roomsOfThisType = selectedRooms.filter(r => r.roomTypeId === roomType.id);
                      const isSelected = currentSelectedRoomType === roomType.id;
                      const count = roomsOfThisType.length;
                      
                      return (
                        <div 
                          key={roomType.id} 
                          className={`room-type-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => setCurrentSelectedRoomType(roomType.id)}
                          style={{
                            border: isSelected ? '2px solid #4caf50' : '1px solid #ddd',
                            backgroundColor: isSelected ? '#f1f8f4' : 'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div className="card-content">
                            <div className="card-title">{roomType.name}</div>
                            {count > 0 && (
                              <div style={{ color: '#4caf50', fontWeight: 'bold', marginTop: '0.5rem' }}>
                                Выбрано: {count}
                              </div>
                            )}
                            {roomType.minCoefficient && (
                              <div className="card-coefficient">
                                Коэффициент: {roomType.maxCoefficient 
                                  ? `${roomType.minCoefficient.toFixed(2)}-${roomType.maxCoefficient.toFixed(2)}`
                                  : roomType.minCoefficient.toFixed(2)}
                              </div>
                            )}
                            {roomType.description && (
                              <div className="card-description">{roomType.description}</div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeRoomOfType(roomType.id);
                              }}
                              className="btn-danger"
                              disabled={count === 0}
                              style={{ 
                                padding: '0.5rem 1rem',
                                fontSize: '1.2rem',
                                minWidth: '40px',
                                opacity: count === 0 ? 0.5 : 1
                              }}
                            >
                              −
                            </button>
                            <span style={{ minWidth: '30px', textAlign: 'center', fontWeight: 'bold' }}>
                              {count}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                addRoom(roomType.id);
                                setCurrentSelectedRoomType(roomType.id);
                              }}
                              className="btn-primary"
                              style={{ padding: '0.5rem 1rem', fontSize: '1.2rem', minWidth: '40px' }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {selectedRooms.length > 0 && (
                    <div className="selected-rooms-list" style={{ marginTop: '2rem' }}>
                      <h3>Выбранные помещения ({selectedRooms.length}):</h3>
                      <div className="selected-rooms-grid">
                        {selectedRooms.map(room => {
                          const roomType = roomTypes.find(rt => rt.id === room.roomTypeId);
                          if (!roomType) return null;
                          // Подсчитываем количество комнат этого типа
                          const sameTypeCount = selectedRooms.filter(r => r.roomTypeId === room.roomTypeId).length;
                          const roomNumber = selectedRooms.filter(r => r.roomTypeId === room.roomTypeId && r.id <= room.id).length;
                          return (
                            <div key={room.id} className="selected-room-item">
                              <div className="selected-room-info">
                                <strong>{roomType.name}</strong>
                                {sameTypeCount > 1 && <span style={{ color: '#666', marginLeft: '0.5rem' }}>({roomNumber})</span>}
                              </div>
                              <button
                                type="button"
                                onClick={() => removeRoom(room.id)}
                                className="btn-danger"
                                style={{ padding: '0.25rem 0.75rem', fontSize: '0.9rem' }}
                              >
                                Удалить
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="step-actions">
              <button onClick={handleStep2Back} className="btn-secondary">
                ← Назад
              </button>
              <button onClick={handleStep2Next} className="btn-primary" disabled={selectedRooms.length === 0}>
                Далее →
              </button>
            </div>
          </div>
        )}

        {/* Шаг 3: Настройка комнат */}
        {currentStep === 3 && (
          <div className="step-panel">
            <h2>Шаг 3: Настройка помещений</h2>
            <p className="step-description">Для каждого выбранного помещения укажите технику и количество розеточных групп:</p>
            
            {selectedRooms.map(room => {
              const roomType = roomTypes.find(rt => rt.id === room.roomTypeId);
              if (!roomType) return null;
              
              const roomConfig = roomsConfig[room.id] || { appliances: [], socketGroupsConfig: [{ socketsCount: 1 }] };
              const roomAppliances = appliances.filter(a => 
                roomConfig.appliances?.some(app => app.id === a.id)
              );
              
              // Подсчитываем количество комнат этого типа для отображения номера
              const sameTypeCount = selectedRooms.filter(r => r.roomTypeId === room.roomTypeId).length;
              const roomNumber = selectedRooms.filter(r => r.roomTypeId === room.roomTypeId && r.id <= room.id).length;
              const roomTitle = sameTypeCount > 1 ? `${roomType.name} (${roomNumber})` : roomType.name;
              
              const isExpanded = expandedRooms[room.id] || false;
              
              return (
                <div key={room.id} className="room-config-panel">
                  <div 
                    className="room-config-header"
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', cursor: 'pointer' }}
                    onClick={() => setExpandedRooms(prev => ({ ...prev, [room.id]: !prev[room.id] }))}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      <span className="expand-icon" style={{ fontSize: '1.2rem', transition: 'transform 0.3s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                        ▶
                      </span>
                      <h3 style={{ margin: 0 }}>{roomTitle}</h3>
                      <span style={{ fontSize: '0.9rem', color: '#7f8c8d', marginLeft: '10px' }}>
                        Площадь: {roomsAreas[room.id] ? `${parseFloat(roomsAreas[room.id]).toFixed(2)} м²` : 'не указана'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRoom(room.id);
                      }}
                      className="btn-danger"
                      style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                    >
                      Удалить комнату
                    </button>
                  </div>
                  
                  {isExpanded && (
                    <div className="room-config-content">
                  <div className="form-group">
                    <label>Розеточные группы</label>
                    <div className="socket-groups-config">
                      {(roomConfig.socketGroupsConfig || [{ socketsCount: 1 }]).map((group, index) => (
                        <div key={index} className="socket-group-item">
                          <label>
                            Группа {index + 1}: Количество розеток
                            <select
                              value={group.socketsCount}
                              onChange={(e) => {
                                const newGroups = [...(roomConfig.socketGroupsConfig || [{ socketsCount: 1 }])];
                                newGroups[index] = { socketsCount: parseInt(e.target.value) };
                                setRoomsConfig(prev => ({
                                  ...prev,
                                  [room.id]: {
                                    ...(prev[room.id] || { appliances: [] }),
                                    socketGroupsConfig: newGroups
                                  }
                                }));
                              }}
                            >
                              <option value="1">1 розетка</option>
                              <option value="2">2 розетки</option>
                              <option value="3">3 розетки</option>
                              <option value="4">4 розетки</option>
                            </select>
                          </label>
                          {(roomConfig.socketGroupsConfig || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newGroups = [...(roomConfig.socketGroupsConfig || [])];
                                newGroups.splice(index, 1);
                                setRoomsConfig(prev => ({
                                  ...prev,
                                  [room.id]: {
                                    ...(prev[room.id] || { appliances: [] }),
                                    socketGroupsConfig: newGroups.length > 0 ? newGroups : [{ socketsCount: 1 }]
                                  }
                                }));
                              }}
                              className="btn-remove-group"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setRoomsConfig(prev => ({
                            ...prev,
                            [room.id]: {
                              ...(prev[room.id] || { appliances: [] }),
                              socketGroupsConfig: [...(prev[room.id]?.socketGroupsConfig || [{ socketsCount: 1 }]), { socketsCount: 1 }]
                            }
                          }));
                        }}
                        className="btn-add-group"
                      >
                        + Добавить группу
                      </button>
                    </div>
                    <div className="field-hint">
                      В комнате может быть несколько розеточных групп. В каждой группе может быть от 1 до 4 розеток.
                    </div>
                    {requiresRCD(roomType.name) && (
                      <div className="rcd-requirement">
                        <strong>Требование ТКП 339-2011:</strong> Для {roomType.name} требуется УЗО {requiresRCD(roomType.name).current}мА
                      </div>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label>Площадь помещения (м²) *</label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={roomsAreas[room.id] || ''}
                      onChange={(e) => {
                        const newArea = parseFloat(e.target.value) || 0;
                        const totalArea = parseFloat(step1Data.area) || 0;
                        const currentTotal = Object.values(roomsAreas).reduce((sum, area) => sum + (parseFloat(area) || 0), 0);
                        const otherRoomsTotal = currentTotal - (parseFloat(roomsAreas[room.id]) || 0);
                        const newTotal = otherRoomsTotal + newArea;
                        
                        if (newTotal > totalArea) {
                          setValidationErrors(prev => ({
                            ...prev,
                            [room.id]: {
                              ...prev[room.id],
                              area: `Сумма площадей всех помещений (${newTotal.toFixed(2)} м²) превышает общую площадь (${totalArea.toFixed(2)} м²)`
                            }
                          }));
                        } else {
                          setValidationErrors(prev => {
                            const newErrors = { ...prev };
                            if (newErrors[room.id]) {
                              delete newErrors[room.id].area;
                              if (Object.keys(newErrors[room.id]).length === 0) {
                                delete newErrors[room.id];
                              }
                            }
                            return newErrors;
                          });
                          setRoomsAreas(prev => ({
                            ...prev,
                            [room.id]: parseFloat(newArea.toFixed(2))
                          }));
                        }
                      }}
                    />
                    {validationErrors[room.id]?.area && (
                      <div className="validation-warning">{validationErrors[room.id].area}</div>
                    )}
                    <div className="field-hint">
                      Общая площадь всех помещений: {Object.values(roomsAreas).reduce((sum, area) => sum + (parseFloat(area) || 0), 0).toFixed(2)} / {step1Data.area} м²
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>Количество окон</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={roomConfig.windowCount ?? 0}
                      onChange={(e) => {
                        const windowCount = Math.max(0, parseInt(e.target.value) || 0);
                        setRoomsConfig(prev => ({
                          ...prev,
                          [room.id]: {
                            ...(prev[room.id] || { appliances: [], socketGroups: 1, socketsPerGroup: 2 }),
                            windowCount: windowCount
                          }
                        }));
                      }}
                    />
                  </div>
                  
                  <div className="form-group">
                    {!showAppliancesForRoom[room.id] ? (
                      <button
                        type="button"
                        onClick={() => setShowAppliancesForRoom(prev => ({ ...prev, [room.id]: true }))}
                        className="btn-primary"
                      >
                        {projectId ? 'Изменить кол-во электроприборов' : '+ Добавить электроприборы'}
                      </button>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <label>Выберите технику:</label>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAppliancesForRoom(prev => ({ ...prev, [room.id]: false }));
                              setApplianceSearchQuery(prev => {
                                const newQuery = { ...prev };
                                delete newQuery[room.id];
                                return newQuery;
                              });
                            }}
                            className="btn-secondary"
                            style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                          >
                            Скрыть список
                          </button>
                        </div>
                        <div className="appliances-search-container">
                          <input
                            type="text"
                            placeholder="Поиск приборов по названию или модели..."
                            value={applianceSearchQuery[room.id] || ''}
                            onChange={(e) => setApplianceSearchQuery(prev => ({ ...prev, [room.id]: e.target.value }))}
                            className="appliances-search-input"
                          />
                        </div>
                        <div className="appliances-selection">
                          {appliances.length === 0 ? (
                            <div className="loading">Загрузка каталога приборов...</div>
                          ) : (() => {
                            // Фильтруем приборы по поисковому запросу
                            const searchQuery = (applianceSearchQuery[room.id] || '').toLowerCase().trim();
                            const filteredAppliances = searchQuery
                              ? appliances.filter(appliance => 
                                  appliance.name.toLowerCase().includes(searchQuery) ||
                                  (appliance.model && appliance.model.toLowerCase().includes(searchQuery))
                                )
                              : appliances;
                            
                            if (filteredAppliances.length === 0 && searchQuery) {
                              return (
                                <div className="no-appliances-found">
                                  Приборы по запросу "{searchQuery}" не найдены
                                </div>
                              );
                            }
                            
                            return (
                              <div className="appliances-table-container">
                                <table className="appliances-table">
                                  <thead>
                                    <tr>
                                      <th style={{ width: '40px' }}>Выбор</th>
                                      <th>Название</th>
                                      <th>Мощность</th>
                                      <th>Модель</th>
                                      <th>Напряжение</th>
                                      <th>Ток</th>
                                      <th>Цена</th>
                                      <th>Количество</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filteredAppliances.map(appliance => {
                                      const selectedAppliance = roomConfig.appliances?.find(a => a.id === appliance.id);
                                      const isSelected = !!selectedAppliance;
                                      const quantity = selectedAppliance?.quantity || 1;
                                      
                                      return (
                                        <tr 
                                          key={appliance.id} 
                                          className={isSelected ? 'appliance-row-selected' : 'appliance-row'}
                                          onClick={() => toggleAppliance(room.id, appliance.id)}
                                          style={{ cursor: 'pointer' }}
                                        >
                                          <td>
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={() => toggleAppliance(room.id, appliance.id)}
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                          </td>
                                          <td>
                                            <div className="appliance-name-cell">
                                              <strong>{appliance.name}</strong>
                                              {requiresSeparateLine(appliance.name, appliance.powerConsumption) && (
                                                <span className="separate-line-badge" title="Требуется отдельная линия по ТКП 339-2011">
                                                  ⚡ Отдельная линия
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td>
                                            {appliance.powerConsumption 
                                              ? (appliance.powerConsumption >= 1000 
                                                  ? `${(appliance.powerConsumption / 1000).toFixed(1)} кВт`
                                                  : `${appliance.powerConsumption} Вт`)
                                              : '-'}
                                          </td>
                                          <td>{appliance.model || '-'}</td>
                                          <td>{appliance.voltage ? `${appliance.voltage} В` : '-'}</td>
                                          <td>{appliance.current ? `${appliance.current} А` : '-'}</td>
                                          <td>{appliance.price ? `${parseFloat(appliance.price).toFixed(2)} BYN` : '-'}</td>
                                          <td>
                                            {isSelected ? (
                                              <input
                                                type="number"
                                                min="1"
                                                max="99"
                                                value={quantity}
                                                onChange={(e) => updateApplianceQuantity(room.id, appliance.id, e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                style={{ width: '60px', padding: '4px', textAlign: 'center' }}
                                              />
                                            ) : (
                                              '-'
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            );
                          })()}
                        </div>
                        {roomAppliances.length > 0 && (
                          <div className="selected-appliances">
                            <strong>Выбрано: </strong>
                            {roomAppliances.map(a => {
                              const selectedAppliance = roomConfig.appliances?.find(app => app.id === a.id);
                              const quantity = selectedAppliance?.quantity || 1;
                              return `${a.name}${quantity > 1 ? ` (${quantity} шт.)` : ''}`;
                            }).join(', ')}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                    </div>
                  )}
                </div>
              );
            })}
            
            <TKP339Recommendations
              projectData={project || {}} 
              roomsConfig={roomsConfig}
              roomTypes={roomTypes}
              appliances={appliances}
              step1Data={step1Data}
              roomsAreas={roomsAreas}
            />
            
            <div className="step-actions">
              <button onClick={handleStep3Back} className="btn-secondary">
                ← Назад
              </button>
              <button 
                onClick={handleCalculate} 
                className="btn-primary" 
                disabled={saving || loading || (() => {
                  // Проверяем наличие ошибок валидации
                  if (Object.keys(validationErrors).length > 0) return true;
                  
                  // Проверяем, что сумма площадей не превышает общую площадь
                  const totalArea = parseFloat(step1Data.area) || 0;
                  const totalRoomsArea = Object.values(roomsAreas).reduce((sum, area) => sum + (parseFloat(area) || 0), 0);
                  if (totalRoomsArea > totalArea) return true;
                  
                  return false;
                })()}
              >
                {saving ? 'Сохранение...' : 'Рассчитать'}
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        show={showProjectNameModal}
        title={projectId ? "Изменить название проекта" : "Название проекта"}
        type="confirm"
        onClose={handleProjectNameModalCancel}
        onConfirm={handleProjectNameModalConfirm}
        confirmText={projectId ? "Сохранить" : "Создать проект"}
        cancelText="Отмена"
      >
        <div>
          <p style={{ marginBottom: '12px' }}>{projectId ? "Измените название проекта:" : "Введите название проекта:"}</p>
          <input
            type="text"
            value={projectNameInput}
            onChange={(e) => setProjectNameInput(e.target.value)}
            placeholder="Например: Квартира 65 м²"
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #ddd',
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleProjectNameModalConfirm();
              }
            }}
            autoFocus
          />
        </div>
      </Modal>

      <Modal
        show={showEmailModal}
        title="Отправка документов на почту"
        type="confirm"
        onClose={handleEmailModalCancel}
        onConfirm={handleEmailModalConfirm}
        confirmText={sendingEmail ? "Отправка..." : "Отправить"}
        cancelText="Пропустить"
      >
        <div>
          {user?.email ? (
            <p>Отправить PDF документы (расчёты и смету оборудования) на почту <strong>{user.email}</strong>?</p>
          ) : (
            <div>
              <p style={{ marginBottom: '12px' }}>Для отправки документов укажите адрес электронной почты:</p>
              <input
                type="email"
                value={emailForSending}
                onChange={(e) => setEmailForSending(e.target.value)}
                placeholder="example@mail.com"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
                disabled={sendingEmail}
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default StepByStepCalculator;

