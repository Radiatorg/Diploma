import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectAPI, roomAPI, projectApplianceAPI, calculationAPI, specificationAPI, applianceAPI } from '../api/api';
import Modal from '../components/UI/Modal';
import CalculationSheet from '../components/CalculationSheet/CalculationSheet';
import ElectricalSpecification from '../components/ElectricalSpecification/ElectricalSpecification';
import SpecificationComparison from '../components/SpecificationComparison/SpecificationComparison';
import './ProjectDetail.css';

const ProjectDetail = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [appliances, setAppliances] = useState([]);
  const [allAppliances, setAllAppliances] = useState([]); // Все приборы из каталога
  const [calculation, setCalculation] = useState(null);
  const [specification, setSpecification] = useState(null);
  const [activeTab, setActiveTab] = useState('rooms');
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState({ show: false, type: '', id: null, onConfirm: null });
  const [errorModal, setErrorModal] = useState({ show: false, message: '' });
  const [roomPropertiesModal, setRoomPropertiesModal] = useState({ 
    show: false, 
    room: null,
    socketGroups: [{ socketsCount: 2 }], // Массив групп: [{ socketsCount: 2 }, { socketsCount: 3 }, ...]
    isEditing: false
  });
  const [roomTypes, setRoomTypes] = useState([]);
  const [roomEditData, setRoomEditData] = useState({
    roomTypeId: null,
    area: '',
    windowCount: 0,
    socketGroups: [{ socketsCount: 2 }],
    selectedAppliances: []
  });

  const loadData = useCallback(async () => {
    try {
      const [projectRes, roomsRes, appliancesRes, allAppliancesRes, roomTypesRes] = await Promise.all([
        projectAPI.getById(id),
        roomAPI.getByProject(id),
        projectApplianceAPI.getByProject(id),
        applianceAPI.getAll().catch(() => ({ data: [] })),
        roomAPI.getTypes().catch(() => ({ data: [] })),
      ]);
      setProject(projectRes.data);
      setRooms(roomsRes.data);
      setAppliances(appliancesRes.data);
      setAllAppliances(allAppliancesRes.data || []);
      setRoomTypes(roomTypesRes.data || []);
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    if (imageUrl.startsWith('/api/files/')) {
      return `http://localhost:8080${imageUrl}`;
    }
    if (!imageUrl.startsWith('/')) {
      return `http://localhost:8080/api/files/${imageUrl}`;
    }
    return `http://localhost:8080${imageUrl}`;
  };

  const getApplianceDetails = (applianceId) => {
    return allAppliances.find(a => a.id === applianceId);
  };

  const loadCalculation = async () => {
    try {
      const response = await calculationAPI.getReport(id);
      setCalculation(response.data);
    } catch (err) {
      setErrorModal({ show: true, message: 'Ошибка загрузки расчетной ведомости' });
    }
  };

  const loadSpecification = async () => {
    try {
      const response = await specificationAPI.getSpecification(id);
      setSpecification(response.data);
    } catch (err) {
      setErrorModal({ show: true, message: 'Ошибка загрузки сметы оборудования' });
    }
  };

  const handleDeleteRoom = async (roomId) => {
    setConfirmModal({
      show: true,
      type: 'room',
      id: roomId,
      onConfirm: async () => {
        try {
          await roomAPI.delete(id, roomId);
          loadData();
          setConfirmModal({ show: false, type: '', id: null, onConfirm: null });
        } catch (err) {
          setConfirmModal({ show: false, type: '', id: null, onConfirm: null });
          setErrorModal({ show: true, message: 'Ошибка удаления комнаты' });
        }
      }
    });
  };

  const handleDeleteAppliance = async (applianceId) => {
    setConfirmModal({
      show: true,
      type: 'appliance',
      id: applianceId,
      onConfirm: async () => {
        try {
          await projectApplianceAPI.delete(id, applianceId);
          loadData();
          setConfirmModal({ show: false, type: '', id: null, onConfirm: null });
        } catch (err) {
          setConfirmModal({ show: false, type: '', id: null, onConfirm: null });
          setErrorModal({ show: true, message: 'Ошибка удаления прибора' });
        }
      }
    });
  };

  const handleOpenRoomProperties = (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    // Преобразуем socketGroupsConfig (JSON) или socketGroups/socketsPerGroup в массив групп
    let socketGroupsArray = [];
    
    if (room.socketGroupsConfig) {
      try {
        socketGroupsArray = JSON.parse(room.socketGroupsConfig);
      } catch (e) {
        console.error('Ошибка парсинга socketGroupsConfig:', e);
        if (room.socketGroups && room.socketGroups > 0) {
          const socketsPerGroup = room.socketsPerGroup || 2;
          socketGroupsArray = Array(room.socketGroups).fill(null).map(() => ({ socketsCount: socketsPerGroup }));
        } else {
          socketGroupsArray = [{ socketsCount: 2 }];
        }
      }
    } else if (room.socketGroups && room.socketGroups > 0) {
      const socketsPerGroup = room.socketsPerGroup || 2;
      socketGroupsArray = Array(room.socketGroups).fill(null).map(() => ({ socketsCount: socketsPerGroup }));
    } else {
      socketGroupsArray = [{ socketsCount: 2 }];
    }

    // Получаем приборы этой комнаты
    const roomAppliances = appliances.filter(a => a.roomId === room.id).map(a => a.applianceId);

    setRoomPropertiesModal({
      show: true,
      room: room,
      socketGroups: socketGroupsArray,
      isEditing: false
    });

    setRoomEditData({
      roomTypeId: room.roomTypeId,
      windowCount: room.windowCount || 0,
      socketGroups: socketGroupsArray,
      selectedAppliances: roomAppliances
    });
  };

  const handleStartEditRoom = () => {
    setRoomPropertiesModal(prev => ({ ...prev, isEditing: true }));
  };

  const handleCancelEditRoom = () => {
    const room = roomPropertiesModal.room;
    if (!room) return;

    // Восстанавливаем исходные данные
    let socketGroupsArray = [];
    if (room.socketGroupsConfig) {
      try {
        socketGroupsArray = JSON.parse(room.socketGroupsConfig);
      } catch (e) {
        if (room.socketGroups && room.socketGroups > 0) {
          const socketsPerGroup = room.socketsPerGroup || 2;
          socketGroupsArray = Array(room.socketGroups).fill(null).map(() => ({ socketsCount: socketsPerGroup }));
        } else {
          socketGroupsArray = [{ socketsCount: 2 }];
        }
      }
    } else if (room.socketGroups && room.socketGroups > 0) {
      const socketsPerGroup = room.socketsPerGroup || 2;
      socketGroupsArray = Array(room.socketGroups).fill(null).map(() => ({ socketsCount: socketsPerGroup }));
    } else {
      socketGroupsArray = [{ socketsCount: 2 }];
    }

    const roomAppliances = appliances.filter(a => a.roomId === room.id).map(a => a.applianceId);

    setRoomEditData({
      roomTypeId: room.roomTypeId,
      area: room.area ? parseFloat(room.area).toFixed(2) : '',
      windowCount: room.windowCount || 0,
      socketGroups: socketGroupsArray,
      selectedAppliances: roomAppliances
    });

    setRoomPropertiesModal(prev => ({ ...prev, isEditing: false }));
  };

  const handleAddSocketGroup = () => {
    if (roomPropertiesModal.isEditing) {
      setRoomEditData(prev => ({
        ...prev,
        socketGroups: [...prev.socketGroups, { socketsCount: 2 }]
      }));
    } else {
      setRoomPropertiesModal(prev => ({
        ...prev,
        socketGroups: [...prev.socketGroups, { socketsCount: 2 }]
      }));
    }
  };

  const handleRemoveSocketGroup = (index) => {
    if (roomPropertiesModal.isEditing) {
      if (roomEditData.socketGroups.length <= 1) return;
      setRoomEditData(prev => ({
        ...prev,
        socketGroups: prev.socketGroups.filter((_, i) => i !== index)
      }));
    } else {
      if (roomPropertiesModal.socketGroups.length <= 1) return;
      setRoomPropertiesModal(prev => ({
        ...prev,
        socketGroups: prev.socketGroups.filter((_, i) => i !== index)
      }));
    }
  };

  const handleUpdateSocketGroup = (index, socketsCount) => {
    if (roomPropertiesModal.isEditing) {
      setRoomEditData(prev => ({
        ...prev,
        socketGroups: prev.socketGroups.map((group, i) => 
          i === index ? { socketsCount: parseInt(socketsCount) || 2 } : group
        )
      }));
    } else {
      setRoomPropertiesModal(prev => ({
        ...prev,
        socketGroups: prev.socketGroups.map((group, i) => 
          i === index ? { socketsCount: parseInt(socketsCount) || 2 } : group
        )
      }));
    }
  };

  const handleToggleAppliance = (applianceId) => {
    setRoomEditData(prev => {
      const isSelected = prev.selectedAppliances.includes(applianceId);
      return {
        ...prev,
        selectedAppliances: isSelected
          ? prev.selectedAppliances.filter(id => id !== applianceId)
          : [...prev.selectedAppliances, applianceId]
      };
    });
  };

  const handleSaveRoomProperties = async () => {
    try {
      const { room } = roomPropertiesModal;
      if (!room) return;

      const socketGroups = roomPropertiesModal.isEditing ? roomEditData.socketGroups : roomPropertiesModal.socketGroups;
      const socketGroupsConfig = JSON.stringify(socketGroups);
      const totalGroups = socketGroups.length;
      const avgSocketsPerGroup = Math.round(
        socketGroups.reduce((sum, g) => sum + g.socketsCount, 0) / socketGroups.length
      );

      // Валидация площади
      const newArea = roomPropertiesModal.isEditing ? parseFloat(roomEditData.area) : parseFloat(room.area);
      if (isNaN(newArea) || newArea <= 0) {
        setErrorModal({ show: true, message: 'Площадь должна быть положительным числом' });
        return;
      }

      // Валидация: сумма площадей всех помещений не должна превышать общую площадь проекта
      const projectTotalArea = project?.totalArea ? parseFloat(project.totalArea) : null;

      if (projectTotalArea) {
        // Вычисляем сумму площадей всех помещений (кроме текущего редактируемого)
        const otherRoomsArea = rooms
          .filter(r => r.id !== room.id)
          .reduce((sum, r) => sum + (parseFloat(r.area) || 0), 0);
        
        const totalArea = otherRoomsArea + newArea;
        
        if (totalArea > projectTotalArea) {
          setErrorModal({ 
            show: true, 
            message: `Сумма площадей всех помещений (${totalArea.toFixed(2)} м²) превышает общую площадь проекта (${projectTotalArea.toFixed(2)} м²). Уменьшите площадь помещений или увеличьте общую площадь проекта.` 
          });
          return;
        }
      } else if (project && !projectTotalArea) {
        // Если общая площадь проекта не указана, предупреждаем пользователя
        setErrorModal({ 
          show: true, 
          message: 'Не указана общая площадь проекта. Укажите общую площадь в настройках проекта перед изменением площадей помещений.' 
        });
        return;
      }

      // Обновляем комнату
      await roomAPI.update(id, room.id, {
        name: room.name,
        roomTypeId: roomPropertiesModal.isEditing ? roomEditData.roomTypeId : room.roomTypeId,
        area: newArea.toFixed(2),
        description: room.description,
        windowCount: roomPropertiesModal.isEditing ? roomEditData.windowCount : room.windowCount,
        socketGroups: totalGroups,
        socketsPerGroup: avgSocketsPerGroup,
        socketGroupsConfig: socketGroupsConfig
      });

      // Обновляем приборы комнаты, если редактируем
      if (roomPropertiesModal.isEditing) {
        const currentRoomAppliances = appliances.filter(a => a.roomId === room.id);
        const currentApplianceIds = currentRoomAppliances.map(a => a.applianceId);
        const selectedApplianceIds = roomEditData.selectedAppliances;

        // Удаляем приборы, которые больше не выбраны
        const appliancesToDelete = currentRoomAppliances.filter(a => !selectedApplianceIds.includes(a.applianceId));
        for (const appliance of appliancesToDelete) {
          await projectApplianceAPI.delete(id, appliance.id);
        }

        // Добавляем новые приборы
        const appliancesToAdd = selectedApplianceIds.filter(id => !currentApplianceIds.includes(id));
        for (const applianceId of appliancesToAdd) {
          await projectApplianceAPI.add(id, {
            applianceId: applianceId,
            roomId: room.id,
            quantity: 1
          });
        }
      }
      
      loadData();
      setRoomPropertiesModal({ show: false, room: null, socketGroups: [{ socketsCount: 2 }], isEditing: false });
      setRoomEditData({ roomTypeId: null, windowCount: 0, socketGroups: [{ socketsCount: 2 }], selectedAppliances: [] });
    } catch (err) {
      setErrorModal({ show: true, message: 'Ошибка сохранения свойств помещения' });
    }
  };


  if (loading) {
    return (
      <div className="project-detail">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Загрузка проекта...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="project-detail">
        <div className="error-message">Проект не найден</div>
        <Link to="/projects" className="btn-primary">Вернуться к проектам</Link>
      </div>
    );
  }

  return (
    <div className="project-detail">
      <div className="project-header">
        <div className="header-content">
          <Link to="/projects" className="back-btn">
            <span className="back-icon">←</span>
            <span>Назад к проектам</span>
          </Link>
          <div className="project-title-section">
            <span className="project-label">Проект:</span>
            <h1>{project.name}</h1>
          </div>
          {project.description && (
            <p className="project-description">{project.description}</p>
          )}
          {project.totalArea && (
            <p className="project-area">Общая площадь: <strong>{parseFloat(project.totalArea).toFixed(2)} м²</strong></p>
          )}
        </div>
        <div className="project-header-actions">
          <Link to={`/projects/${id}/floor-plan`} className="btn-primary">
            3D редактор проекта
          </Link>
          <Link to={`/projects/${id}/calculator`} className="btn-primary">
            Калькулятор электропроводки
          </Link>
          <Link to={`/projects/${id}/edit`} className="btn-secondary">
            Редактировать
          </Link>
        </div>
      </div>

      <div className="tabs">
        <button
          className={activeTab === 'rooms' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('rooms')}
        >
          Комнаты ({rooms.length})
        </button>
        <button
          className={activeTab === 'appliances' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('appliances')}
        >
          Электроприборы ({appliances.reduce((sum, a) => sum + (a.quantity || 1), 0)})
        </button>
        <button
          className={activeTab === 'calculation' ? 'tab active' : 'tab'}
          onClick={() => {
            setActiveTab('calculation');
            if (!calculation) loadCalculation();
          }}
        >
          Расчетная ведомость
        </button>
        <button
          className={activeTab === 'specification' ? 'tab active' : 'tab'}
          onClick={() => {
            setActiveTab('specification');
            if (!specification) loadSpecification();
          }}
        >
          Смета оборудования
        </button>
        <button
          className={activeTab === 'comparison' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('comparison')}
        >
          История смет
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'rooms' && (
          <div className="tab-panel">
            <div className="panel-header">
              <div>
                <h2>Помещения проекта</h2>
                <p className="panel-hint">Добавляйте помещения и приборы, затем обновляйте расчёты в соответствующих вкладках</p>
              </div>
              <Link to={`/projects/${id}/rooms/new`} className="btn-primary">
                <span>+</span> Добавить комнату
              </Link>
            </div>
            {rooms.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"></div>
                <h3>Нет комнат в проекте</h3>
                <p>Добавьте первое помещение, чтобы начать работу</p>
                <Link to={`/projects/${id}/rooms/new`} className="btn-primary">
                  Добавить комнату
                </Link>
              </div>
            ) : (
              <div className="rooms-table-container">
                <table className="rooms-table">
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th>Тип помещения</th>
                      <th>Площадь (м²)</th>
                      <th>Пометки</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map((room) => (
                      <tr key={room.id}>
                        <td><strong>{room.name}</strong></td>
                        <td><span className="room-type-badge">{room.roomTypeName}</span></td>
                        <td>{room.area ? parseFloat(room.area).toFixed(2) : '0.00'}</td>
                        <td className="description-cell">
                          {room.description ? (
                            <Link 
                              to={`/projects/${id}/rooms/${room.id}/notes`}
                              className="notes-link"
                              title="Открыть пометки"
                            >
                              {room.description.length > 50 ? `${room.description.substring(0, 50)}...` : room.description}
                            </Link>
                          ) : (
                            <Link 
                              to={`/projects/${id}/rooms/${room.id}/notes`}
                              className="notes-link empty"
                              title="Добавить пометки"
                            >
                              Добавить пометки
                            </Link>
                          )}
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              onClick={() => handleOpenRoomProperties(room.id)}
                              className="btn-primary"
                              title="Свойства помещения"
                            >
                              Свойства
                            </button>
                            <button onClick={() => handleDeleteRoom(room.id)} className="btn-danger">
                              Удалить
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'appliances' && (
          <div className="tab-panel">
            <div className="panel-header">
              <div>
                <h2>Электроприборы проекта</h2>
                <p className="panel-hint">
                  Выберите приборы для каждого помещения, затем обновите расчёты. 
                  Общее количество оборудования: <strong>{appliances.reduce((sum, a) => sum + (a.quantity || 1), 0)} шт.</strong>
                </p>
              </div>
              <Link to={`/projects/${id}/appliances/new`} className="btn-primary">
                <span>+</span> Добавить прибор
              </Link>
            </div>
            {appliances.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"></div>
                <h3>Нет приборов в проекте</h3>
                <p>Добавьте электроприборы для расчета мощности</p>
                <Link to={`/projects/${id}/appliances/new`} className="btn-primary">
                  Добавить прибор
                </Link>
              </div>
            ) : (
              <div className="appliances-catalog-grid">
                {appliances.map((projectAppliance) => {
                  const applianceDetails = getApplianceDetails(projectAppliance.applianceId);
                  const imageUrl = getImageUrl(applianceDetails?.imageUrl);
                  
                  return (
                    <div key={projectAppliance.id} className="appliance-catalog-card">
                      <div className="appliance-image-container">
                        {imageUrl ? (
                          <img 
                            src={imageUrl} 
                            alt={projectAppliance.applianceName} 
                            className="appliance-image"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              const placeholder = e.target.parentElement.querySelector('.appliance-image-placeholder');
                              if (placeholder) {
                                placeholder.style.display = 'flex';
                              }
                            }}
                          />
                        ) : (
                          <div className="appliance-image-placeholder">
                            <span>⚡</span>
                          </div>
                        )}
                        <div className="appliance-image-placeholder" style={{ display: 'none' }}>
                          <span>⚡</span>
                        </div>
                      </div>
                      <div className="appliance-content">
                        <div className="appliance-content-main">
                        <h3>{projectAppliance.applianceName}</h3>
                        <div className="appliance-specs">
                          <div className="spec-item">
                            <span className="spec-label">Количество:</span>
                            <span className="spec-value">{projectAppliance.quantity} шт.</span>
                          </div>
                          {projectAppliance.roomName && (
                            <div className="spec-item">
                              <span className="spec-label">Комната:</span>
                              <span className="spec-value">{projectAppliance.roomName}</span>
                            </div>
                          )}
                          {projectAppliance.totalPower && (
                            <div className="spec-item">
                              <span className="spec-label">Мощность:</span>
                              <span className="spec-value">
                                {projectAppliance.totalPower >= 1000 
                                  ? `${(projectAppliance.totalPower / 1000).toFixed(2)} кВт`
                                  : `${parseFloat(projectAppliance.totalPower).toFixed(2)} Вт`}
                              </span>
                            </div>
                          )}
                          {applianceDetails?.powerConsumption && (
                            <div className="spec-item">
                              <span className="spec-label">Мощность (ед.):</span>
                              <span className="spec-value">
                                {applianceDetails.powerConsumption >= 1000 
                                  ? `${(applianceDetails.powerConsumption / 1000).toFixed(2)} кВт`
                                  : `${applianceDetails.powerConsumption} Вт`}
                              </span>
                            </div>
                          )}
                          </div>
                        </div>
                        <div className="card-actions">
                          <Link
                            to={`/projects/${id}/appliances/${projectAppliance.id}/edit`}
                            className="btn-secondary"
                          >
                            Редактировать
                          </Link>
                          <button
                            onClick={() => handleDeleteAppliance(projectAppliance.id)}
                            className="btn-danger"
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'calculation' && (
          <div className="tab-panel">
            {/* Используем общий компонент расчетной ведомости,
                который опирается на те же данные, что и админская версия */}
            <CalculationSheet projectId={id} />
          </div>
        )}

        {activeTab === 'specification' && (
          <div className="tab-panel">
            {/* Используем общий компонент спецификации, чтобы структура
                и данные совпадали с административной версией */}
            <ElectricalSpecification projectId={id} />
          </div>
        )}

        {activeTab === 'comparison' && (
          <div className="tab-panel">
            <SpecificationComparison projectId={id} />
          </div>
        )}
      </div>
      <Modal
        show={confirmModal.show}
        title="Подтверждение"
        type="confirm"
        onClose={() => setConfirmModal({ show: false, type: '', id: null, onConfirm: null })}
        onConfirm={confirmModal.onConfirm}
        confirmText="Удалить"
        cancelText="Отмена"
      >
        <p>{confirmModal.type === 'room' ? 'Удалить комнату?' : 'Удалить прибор из проекта?'}</p>
      </Modal>
      <Modal
        show={errorModal.show}
        title="Ошибка"
        type="info"
        onClose={() => setErrorModal({ show: false, message: '' })}
        cancelText="Ок"
        zIndex={3000}
      >
        <p>{errorModal.message}</p>
      </Modal>
      <Modal
        show={roomPropertiesModal.show}
        title={`${roomPropertiesModal.isEditing ? 'Редактирование' : 'Свойства'} помещения: ${roomPropertiesModal.room?.name || ''}`}
        onClose={() => {
          setRoomPropertiesModal({ show: false, room: null, socketGroups: [{ socketsCount: 2 }], isEditing: false });
          setRoomEditData({ roomTypeId: null, windowCount: 0, socketGroups: [{ socketsCount: 2 }], selectedAppliances: [] });
        }}
        onConfirm={handleSaveRoomProperties}
        confirmText={roomPropertiesModal.isEditing ? "Сохранить" : "Ок"}
        cancelText={roomPropertiesModal.isEditing ? "Отмена" : "Закрыть"}
        onCancel={roomPropertiesModal.isEditing ? handleCancelEditRoom : undefined}
      >
        {roomPropertiesModal.room && (
          <div className="room-properties-form">
            <div className="property-section">
              <div className="section-header">
                <h4>Основная информация</h4>
                {!roomPropertiesModal.isEditing && (
                  <button
                    type="button"
                    onClick={handleStartEditRoom}
                    className="btn-secondary"
                    title="Изменить"
                  >
                    Изменить
                  </button>
                )}
              </div>
              <div className="property-item">
                <span className="property-label">Название:</span>
                <span className="property-value">{roomPropertiesModal.room.name}</span>
              </div>
              <div className="property-item">
                <span className="property-label">Тип помещения:</span>
                {roomPropertiesModal.isEditing ? (
                  <select
                    value={roomEditData.roomTypeId || ''}
                    onChange={(e) => setRoomEditData(prev => ({ ...prev, roomTypeId: parseInt(e.target.value) }))}
                    className="property-input"
                  >
                    <option value="">Выберите тип</option>
                    {roomTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                ) : (
                  <span className="property-value">{roomPropertiesModal.room.roomTypeName}</span>
                )}
              </div>
              <div className="property-item">
                <span className="property-label">Площадь:</span>
                {roomPropertiesModal.isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-end', minWidth: '200px' }}>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={roomEditData.area}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                          setRoomEditData(prev => ({ ...prev, area: value }));
                        }
                      }}
                      className="property-input"
                      style={{ width: '150px', alignSelf: 'flex-end' }}
                    />
                    {(() => {
                      const totalUsedArea = rooms
                        .filter(r => r.id !== roomPropertiesModal.room.id)
                        .reduce((sum, r) => sum + (parseFloat(r.area) || 0), 0);
                      const currentArea = parseFloat(roomEditData.area) || 0;
                      const totalArea = totalUsedArea + currentArea;
                      
                      // Получаем общую площадь проекта из поля totalArea
                      const projectTotalArea = project?.totalArea ? parseFloat(project.totalArea) : null;
                      
                      const exceedsLimit = projectTotalArea && totalArea > projectTotalArea;
                      
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%', alignItems: 'flex-end' }}>
                          <small style={{ 
                            color: exceedsLimit ? '#e74c3c' : '#666', 
                            fontSize: '0.85rem',
                            fontWeight: exceedsLimit ? '600' : 'normal',
                            textAlign: 'right',
                            whiteSpace: 'nowrap',
                            display: 'block',
                            width: '100%'
                          }}>
                            Задействовано: {totalArea.toFixed(2)} м² из {projectTotalArea ? projectTotalArea.toFixed(2) : '?'} м²
                            {exceedsLimit && ' (превышение!)'}
                          </small>
                          {exceedsLimit && (
                            <small style={{ 
                              color: '#e74c3c', 
                              fontSize: '0.8rem',
                              fontWeight: '600',
                              textAlign: 'right',
                              display: 'block',
                              width: '100%'
                            }}>
                              Сумма площадей превышает общую площадь проекта. Уменьшите площадь помещения.
                            </small>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <span className="property-value">{roomPropertiesModal.room.area ? parseFloat(roomPropertiesModal.room.area).toFixed(2) : '0.00'} м²</span>
                )}
              </div>
              <div className="property-item">
                <span className="property-label">Количество окон:</span>
                {roomPropertiesModal.isEditing ? (
                  <input
                    type="number"
                    min="0"
                    value={roomEditData.windowCount}
                    onChange={(e) => setRoomEditData(prev => ({ ...prev, windowCount: parseInt(e.target.value) || 0 }))}
                    className="property-input"
                  />
                ) : (
                  <span className="property-value">{roomPropertiesModal.room.windowCount || 0}</span>
                )}
              </div>
            </div>

            {roomPropertiesModal.isEditing && (
              <div className="property-section">
                <h4>Электроприборы</h4>
                <p className="field-hint">Выберите приборы для этого помещения</p>
                <div className="appliances-selector">
                  {allAppliances.map(appliance => (
                    <label key={appliance.id} className="appliance-checkbox">
                      <input
                        type="checkbox"
                        checked={roomEditData.selectedAppliances.includes(appliance.id)}
                        onChange={() => handleToggleAppliance(appliance.id)}
                      />
                      <span>{appliance.name} ({appliance.powerConsumption} Вт)</span>
                    </label>
                  ))}
                  {allAppliances.length === 0 && (
                    <p className="no-appliances">Нет доступных приборов</p>
                  )}
                </div>
              </div>
            )}

            <div className="property-section">
              <div className="section-header">
                <h4>Розеточные группы</h4>
                <button
                  type="button"
                  onClick={handleAddSocketGroup}
                  className="btn-add-group"
                  title="Добавить группу"
                >
                  + Добавить группу
                </button>
              </div>
              <p className="field-hint">
                В комнате может быть несколько розеточных групп. В каждой группе может быть от 2 до 4 розеток.
              </p>
              <div className="socket-groups-list">
                {(roomPropertiesModal.isEditing ? roomEditData.socketGroups : roomPropertiesModal.socketGroups).map((group, index) => (
                  <div key={index} className="socket-group-item">
                    <div className="group-header">
                      <span className="group-number">Группа {index + 1}</span>
                      {(roomPropertiesModal.isEditing ? roomEditData.socketGroups : roomPropertiesModal.socketGroups).length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSocketGroup(index)}
                          className="btn-remove-group"
                          title="Удалить группу"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <label>
                      Количество розеток в группе:
                      <select
                        value={group.socketsCount}
                        onChange={(e) => handleUpdateSocketGroup(index, e.target.value)}
                      >
                        <option value="2">2 розетки</option>
                        <option value="3">3 розетки</option>
                        <option value="4">4 розетки</option>
                      </select>
                    </label>
                  </div>
                ))}
              </div>
              <div className="total-sockets-info">
                <strong>Всего розеток: </strong>
                {(roomPropertiesModal.isEditing ? roomEditData.socketGroups : roomPropertiesModal.socketGroups).reduce((sum, g) => sum + g.socketsCount, 0)}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ProjectDetail;
