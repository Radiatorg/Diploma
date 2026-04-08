import React, { useState, useEffect } from 'react';
import { specificationAPI, pdfExportAPI } from '../../api/api';
import './ElectricalSpecification.css';

const ElectricalSpecification = ({ projectId }) => {
  const [equipmentItems, setEquipmentItems] = useState([]);
  const [totalEquipmentCost, setTotalEquipmentCost] = useState(0);
  const [recommendations, setRecommendations] = useState('');
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Используем API endpoint для спецификации
      const specRes = await specificationAPI.getSpecification(projectId);
      const spec = specRes.data;

      // Преобразуем данные из ответа API
      setEquipmentItems(spec.equipmentItems || []);
      setTotalEquipmentCost(spec.totalEquipmentCost || 0);
      setRecommendations(spec.recommendations || '');
      setProjectName(spec.projectName || '');

      setError('');
    } catch (err) {
      setError('Ошибка загрузки данных сметы оборудования');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Группируем оборудование по категориям
  const groupedByCategory = () => {
    const groups = {};
    
    equipmentItems.forEach(item => {
      const category = item.category || 'Другое';
      if (!groups[category]) {
        groups[category] = {
          items: [],
          totalQuantity: 0,
          totalCost: 0
        };
      }
      groups[category].items.push(item);
      groups[category].totalQuantity += item.quantity || 0;
      groups[category].totalCost += parseFloat(item.totalPrice || 0);
    });
    
    return groups;
  };

  const formatPrice = (price) => {
    if (!price) return '0.00';
    return parseFloat(price).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  if (loading) {
    return <div className="loading">Загрузка сметы оборудования...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  const groups = groupedByCategory();
  const totalCount = equipmentItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

  return (
    <div className="electrical-specification">
      <div className="spec-header">
        <div className="spec-header-top">
          <h3>Смета электротехнического оборудования</h3>
          <button
            onClick={async () => {
              try {
                const response = await pdfExportAPI.exportSpecification(projectId);
                const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `smeta_oborudovaniya_${projectId}.pdf`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
              } catch (err) {
                console.error('Ошибка экспорта PDF:', err);
                alert('Ошибка экспорта сметы оборудования в PDF');
              }
            }}
            className="btn-primary"
            title="Скачать смету оборудования в PDF"
          >
            📄 Скачать PDF
          </button>
        </div>
        {projectName && <div className="project-name">Проект: {projectName}</div>}
        <div className="spec-summary">
          <div className="summary-item">
            <span className="label">Всего позиций:</span>
            <span className="value">{equipmentItems.length}</span>
          </div>
          <div className="summary-item">
            <span className="label">Общее количество:</span>
            <span className="value">{totalCount} {equipmentItems[0]?.unit || 'шт'}</span>
          </div>
          <div className="summary-item">
            <span className="label">Общая стоимость оборудования:</span>
            <span className="value">{formatPrice(totalEquipmentCost)} BYN</span>
          </div>
        </div>
      </div>

      <div className="spec-warning">
        <strong>Внимание!</strong> Представленные расчёты являются примерными и ориентировочными. Реальные расчёты могут различаться в зависимости от конкретных условий монтажа, выбранных материалов и особенностей объекта. Программа не несёт ответственности за расхождения между предварительными и итоговыми расчётами.
      </div>

      {equipmentItems.length === 0 ? (
        <div className="empty-state">
          <p>В проекте пока нет размещенного оборудования</p>
          <p className="hint">Добавьте в расчёт</p>
        </div>
      ) : (
        <div className="spec-content">
          {Object.entries(groups).map(([category, groupData]) => (
            <div key={category} className="spec-group">
              <div className="group-header">
                <h4>{category}</h4>
                <div className="group-stats">
                  <span>Количество: {groupData.totalQuantity} {equipmentItems.find(i => i.category === category)?.unit || 'шт'}</span>
                  <span>Стоимость: {formatPrice(groupData.totalCost)} BYN</span>
                </div>
              </div>

              <div className="spec-table-container">
                <table className="spec-table">
                  <thead>
                    <tr>
                      <th>Наименование</th>
                      <th>Технические характеристики</th>
                      <th>Модель</th>
                      <th>IP</th>
                      <th>Цвет</th>
                      <th>Количество</th>
                      <th>Цена за ед.</th>
                      <th>Стоимость</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupData.items.map((item, index) => (
                      <tr key={index}>
                        <td className="item-name">{item.name}</td>
                        <td className="item-spec">
                          {item.specification}
                          {item.cableBrand && item.cableCrossSection && (
                            <div className="cable-info">
                              Кабель: {item.cableBrand} {item.cableCrossSection}
                              {item.cableLength && ` (${item.cableLength.toFixed(1)} м)`}
                            </div>
                          )}
                          {item.notes && <div className="item-notes">{item.notes}</div>}
                        </td>
                        <td>{item.model || '-'}</td>
                        <td>{item.ipRating || '-'}</td>
                        <td>{item.color || '-'}</td>
                        <td className="text-center">{item.quantity} {item.unit || 'шт'}</td>
                        <td className="text-right">{formatPrice(item.unitPrice)} BYN</td>
                        <td className="text-right">{formatPrice(item.totalPrice)} BYN</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="5" className="text-right"><strong>Итого по категории:</strong></td>
                      <td className="text-center"><strong>{groupData.totalQuantity}</strong></td>
                      <td colSpan="2" className="text-right"><strong>{formatPrice(groupData.totalCost)} BYN</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {recommendations && (
        <div className="recommendations">
          <h4>Рекомендации:</h4>
          <pre className="recommendations-text">{recommendations}</pre>
        </div>
      )}

      <div className="spec-total">
        <div className="total-row">
          <span className="total-label">Итого стоимость оборудования:</span>
          <span className="total-value">{formatPrice(totalEquipmentCost)} BYN</span>
        </div>
      </div>

      <div className="spec-actions">
        <button
          onClick={loadData}
          className="btn-primary"
        >
          Обновить расчеты
        </button>
      </div>
    </div>
  );
};

export default ElectricalSpecification;
