import React from 'react';
import './ProjectAppliancesList.css';

const ProjectAppliancesList = ({ appliances, rooms, onApplianceSelect }) => {
  const getRoomName = (roomId) => {
    if (!roomId) return 'Не привязано';
    const room = rooms.find(r => r.id === roomId);
    return room ? room.name : 'Неизвестно';
  };

  // Функция удалена, иконки больше не используются

  if (appliances.length === 0) {
    return (
      <div className="appliances-list-empty">
        <p>В проекте пока нет приборов</p>
        <p className="hint">Добавьте приборы на странице проекта</p>
      </div>
    );
  }

  return (
    <div className="project-appliances-list">
      <div className="appliances-list-header">
        <p className="hint">Приборы, добавленные в проект</p>
      </div>
      <div className="appliances-list">
        {appliances.map((appliance) => (
          <div
            key={appliance.id}
            className="appliance-card"
            onClick={() => onApplianceSelect && onApplianceSelect(appliance)}
            title={`${appliance.applianceName || appliance.name} - ${appliance.quantity} шт.`}
          >
            <div className="appliance-image-container">
              <div className="appliance-image-placeholder">
              </div>
            </div>
            <div className="appliance-content">
              <h3>{appliance.applianceName || appliance.name || 'Неизвестный прибор'}</h3>
              <div className="appliance-specs">
                <div className="spec-item">
                  <span className="spec-label">Количество:</span>
                  <span className="spec-value">{appliance.quantity || 1} шт.</span>
                </div>
                {appliance.totalPower && (
                  <div className="spec-item">
                    <span className="spec-label">Мощность:</span>
                    <span className="spec-value">
                      {parseFloat(appliance.totalPower) >= 1000 
                        ? `${(parseFloat(appliance.totalPower) / 1000).toFixed(2)} кВт`
                        : `${parseFloat(appliance.totalPower).toFixed(0)} Вт`}
                    </span>
                  </div>
                )}
                <div className="spec-item">
                  <span className="spec-label">Комната:</span>
                  <span className="spec-value">{getRoomName(appliance.roomId)}</span>
                </div>
              </div>
              <div className="view-details">
                <span>Нажмите для просмотра →</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectAppliancesList;


