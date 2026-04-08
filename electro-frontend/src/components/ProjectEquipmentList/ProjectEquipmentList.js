import React, { useState } from 'react';
import { electricalPointAPI, projectApplianceAPI, applianceAPI } from '../../api/api';
import './ProjectEquipmentList.css';

const ProjectEquipmentList = ({ projectId, electricalPoints, projectAppliances, rooms }) => {
  const [expandedSections, setExpandedSections] = useState({
    appliances: false,
    sockets: false,
    lights: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Группируем оборудование по типам
  const equipment = {
    appliances: [], // Приборы из projectAppliances
    sockets: [], // Розетки
    lights: [] // Лампы
  };

  // Обрабатываем электрические точки
  electricalPoints.forEach(point => {
    const symbol = point.electricalSymbol;
    const room = rooms.find(r => 
      point.positionX >= r.positionX &&
      point.positionX <= r.positionX + r.width &&
      point.positionY >= r.positionY &&
      point.positionY <= r.positionY + r.height
    );
    
    if (point.applianceId) {
      // Это прибор из каталога
      const appliance = projectAppliances.find(a => a.applianceId === point.applianceId || a.id === point.applianceId);
      if (appliance) {
        equipment.appliances.push({
          ...point,
          room: room?.name || 'Неизвестно',
          applianceName: appliance.applianceName || appliance.name
        });
      }
    } else if (symbol?.type === 'outlet') {
      // Это розетка
      equipment.sockets.push({
        ...point,
        room: room?.name || 'Неизвестно',
        power: point.notes?.match(/Мощность:\s*(\d+)W/i)?.[1] || '2200'
      });
    } else if (symbol?.type === 'light') {
      // Это лампа
      equipment.lights.push({
        ...point,
        room: room?.name || 'Неизвестно',
        power: point.notes?.match(/Мощность:\s*(\d+)W/i)?.[1] || '60'
      });
    }
  });

  const getRoomName = (roomName) => {
    return roomName || 'Неизвестно';
  };

  return (
    <div className="project-equipment-list">
      <div className="equipment-section">
        <h4 
          className="equipment-section-header"
          onClick={() => toggleSection('appliances')}
        >
          <span className="toggle-icon">{expandedSections.appliances ? '▼' : '▶'}</span>
          Приборы ({equipment.appliances.length})
        </h4>
        {expandedSections.appliances && (
          <>
            {equipment.appliances.length === 0 ? (
              <div className="equipment-empty">
                <p>Нет размещенных приборов</p>
              </div>
            ) : (
              <div className="equipment-items">
                {equipment.appliances.map((item, idx) => (
                  <div key={`appliance-${item.id}-${idx}`} className="equipment-item">
                    <div className="equipment-info">
                      <div className="equipment-name">{item.applianceName}</div>
                      <div className="equipment-details">
                        <span>Комната: {getRoomName(item.room)}</span>
                        {item.notes && <span>{item.notes}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="equipment-section">
        <h4 
          className="equipment-section-header"
          onClick={() => toggleSection('sockets')}
        >
          <span className="toggle-icon">{expandedSections.sockets ? '▼' : '▶'}</span>
          Розетки ({equipment.sockets.length})
        </h4>
        {expandedSections.sockets && (
          <>
            {equipment.sockets.length === 0 ? (
              <div className="equipment-empty">
                <p>Нет размещенных розеток</p>
              </div>
            ) : (
              <div className="equipment-items">
                {equipment.sockets.map((item, idx) => (
                  <div key={`socket-${item.id}-${idx}`} className="equipment-item">
                    <div className="equipment-info">
                      <div className="equipment-name">Розетка</div>
                      <div className="equipment-details">
                        <span>Комната: {getRoomName(item.room)}</span>
                        <span>Мощность: {item.power}W</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="equipment-section">
        <h4 
          className="equipment-section-header"
          onClick={() => toggleSection('lights')}
        >
          <span className="toggle-icon">{expandedSections.lights ? '▼' : '▶'}</span>
          Лампы ({equipment.lights.length})
        </h4>
        {expandedSections.lights && (
          <>
            {equipment.lights.length === 0 ? (
              <div className="equipment-empty">
                <p>Нет размещенных ламп</p>
              </div>
            ) : (
              <div className="equipment-items">
                {equipment.lights.map((item, idx) => (
                  <div key={`light-${item.id}-${idx}`} className="equipment-item">
                    <div className="equipment-info">
                      <div className="equipment-name">Лампа</div>
                      <div className="equipment-details">
                        <span>Комната: {getRoomName(item.room)}</span>
                        <span>Мощность: {item.power}W</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {equipment.appliances.length === 0 && equipment.sockets.length === 0 && equipment.lights.length === 0 && (
        <div className="equipment-empty-total">
          <p>В проекте пока нет размещенного оборудования</p>
          <p className="hint">Разместите оборудование в редакторе помещений</p>
        </div>
      )}
    </div>
  );
};

export default ProjectEquipmentList;

