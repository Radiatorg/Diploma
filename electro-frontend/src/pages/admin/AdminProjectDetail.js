import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminAPI } from '../../api/api';
import '../ProjectDetail.css';

const AdminProjectDetail = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [calculation, setCalculation] = useState(null);
  const [specification, setSpecification] = useState(null);
  const [loadingCalculation, setLoadingCalculation] = useState(false);
  const [loadingSpecification, setLoadingSpecification] = useState(false);
  // Для администратора оставляем только вкладки с расчетной ведомостью и сметой
  const [activeTab, setActiveTab] = useState('calculation');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCalculation = async () => {
    setLoadingCalculation(true);
    try {
      const response = await adminAPI.getProjectCalculation(id);
      setCalculation(response.data);
    } catch (err) {
      console.error('Ошибка загрузки расчетной ведомости:', err);
      setError('Ошибка загрузки расчетной ведомости');
    } finally {
      setLoadingCalculation(false);
    }
  };

  const loadSpecification = async () => {
    setLoadingSpecification(true);
    try {
      const response = await adminAPI.getProjectSpecification(id);
      setSpecification(response.data);
    } catch (err) {
      console.error('Ошибка загрузки сметы оборудования:', err);
      setError('Ошибка загрузки сметы оборудования');
    } finally {
      setLoadingSpecification(false);
    }
  };

  const loadData = async () => {
    try {
      const projectRes = await adminAPI.getProjectById(id);
      const project = projectRes.data;
      setProject(project);
      
      // Загружаем расчетную ведомость сразу после загрузки проекта, если активна вкладка calculation
      if (activeTab === 'calculation') {
        loadCalculation();
      }
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
      setError('Ошибка загрузки проекта. Возможно, у вас нет доступа к этому проекту.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);


  if (loading) return <div>Загрузка...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!project) return <div>Проект не найден</div>;

  return (
    <div className="project-detail">
      <div className="project-header">
        <div>
          <h1>{project.name}</h1>
          {project.designerUsername && (
            <p style={{ color: '#666', marginTop: '0.5rem' }}>
              Проектировщик: <strong>{project.designerUsername}</strong>
            </p>
          )}
        </div>
        <div className="project-header-actions">
          <Link to="/admin/projects" className="btn-secondary">
            ← Назад к списку проектов
          </Link>
        </div>
      </div>
      {project.description && <p className="project-description">{project.description}</p>}

      <div className="tabs">
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
      </div>

      <div className="tab-content">
        {activeTab === 'calculation' && (
          <div>
            {loadingCalculation ? (
              <div>Загрузка...</div>
            ) : calculation ? (
              <div className="calculation-report">
                <div className="report-header">
                  <h2>Расчетная ведомость проекта</h2>
                </div>

                {/* Основные метрики */}
                <div className="report-section">
                  <h3>Основные показатели</h3>
                  <div className="report-stats">
                    <div className="stat-card">
                      <span className="stat-label">Общая мощность</span>
                      <span className="stat-value">{calculation.totalPowerConsumption ? `${(parseFloat(calculation.totalPowerConsumption) / 1000).toFixed(2)} кВт` : '-'}</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">Расчетный ток</span>
                      <span className="stat-value">{calculation.totalCurrent ? `${parseFloat(calculation.totalCurrent).toFixed(2)} А` : '-'}</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">Общая площадь</span>
                      <span className="stat-value">{calculation.totalArea ? `${parseFloat(calculation.totalArea).toFixed(2)} м²` : '-'}</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">Количество приборов</span>
                      <span className="stat-value">{calculation.totalAppliances || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Рекомендации по оборудованию */}
                <div className="report-section">
                  <h3>Рекомендации по оборудованию</h3>
                  <div className="recommendations-grid">
                    <div className="recommendation-item">
                      <strong>Сечение провода:</strong> {calculation.recommendedCableCrossSection || 'Не рассчитано'}
                    </div>
                    <div className="recommendation-item">
                      <strong>Тип счетчика:</strong> {calculation.recommendedMeterType || 'Не рассчитано'}
                    </div>
                    <div className="recommendation-item">
                      <strong>Длина кабеля:</strong> {calculation.cableLength ? `${parseFloat(calculation.cableLength).toFixed(2)} м` : '-'}
                    </div>
                    <div className="recommendation-item">
                      <strong>Автоматические выключатели:</strong> {calculation.recommendedBreakerCount || 0} шт.
                    </div>
                  </div>
                </div>

                {/* Расчет по комнатам */}
                {calculation.roomCalculations && calculation.roomCalculations.length > 0 && (
                  <div className="report-section">
                    <h3>Расчет по комнатам</h3>
                    <table className="report-table">
                      <thead>
                        <tr>
                          <th>Комната</th>
                          <th>Площадь (м²)</th>
                          <th>Мощность (кВт)</th>
                          <th>Коэффициент</th>
                          <th>Количество приборов</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calculation.roomCalculations.map((room, idx) => (
                          <tr key={idx}>
                            <td><strong>{room.roomName}</strong></td>
                            <td>{room.area ? parseFloat(room.area).toFixed(2) : '-'}</td>
                            <td>{room.totalPower ? (parseFloat(room.totalPower) / 1000).toFixed(2) : '-'}</td>
                            <td>{room.coefficient ? parseFloat(room.coefficient).toFixed(2) : '-'}</td>
                            <td>{room.applianceCount || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Сводка по приборам */}
                {calculation.applianceSummaries && calculation.applianceSummaries.length > 0 && (
                  <div className="report-section">
                    <h3>Сводка по приборам</h3>
                    <table className="report-table">
                      <thead>
                        <tr>
                          <th>Прибор</th>
                          <th>Количество</th>
                          <th>Общая мощность (кВт)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calculation.applianceSummaries.map((appliance, idx) => (
                          <tr key={idx}>
                            <td><strong>{appliance.applianceName}</strong></td>
                            <td>{appliance.totalQuantity || 0}</td>
                            <td>{appliance.totalPower ? (parseFloat(appliance.totalPower) / 1000).toFixed(2) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Финансовые расчеты */}
                <div className="report-section">
                  <h3>Финансовые расчеты</h3>
                  <div className="financial-grid">
                    <div className="financial-item">
                      <span className="financial-label">Стоимость оборудования:</span>
                      <span className="financial-value">{calculation.totalEquipmentCost ? `${parseFloat(calculation.totalEquipmentCost).toFixed(2)} BYN` : '-'}</span>
                    </div>
                    <div className="financial-item">
                      <span className="financial-label">Монтажные работы ({calculation.laborHours?.toFixed(1) || '0.0'} ч × 15 BYN/ч):</span>
                      <span className="financial-value">{calculation.installationCost ? `${parseFloat(calculation.installationCost).toFixed(2)} BYN` : '-'}</span>
                      {(calculation.cableWiringHours > 0 || calculation.rcdInstallationHours > 0 || calculation.meterInstallationHours > 0) && (
                        <div style={{ fontSize: '0.85em', color: '#666', marginTop: '5px' }}>
                          {calculation.cableWiringHours > 0 && <div>• Прокладывание проводов: {calculation.cableWiringHours.toFixed(2)} ч</div>}
                          {calculation.rcdInstallationHours > 0 && <div>• Установка УЗО: {calculation.rcdInstallationHours.toFixed(2)} ч</div>}
                          {calculation.meterInstallationHours > 0 && <div>• Установка электросчетчика: {calculation.meterInstallationHours.toFixed(2)} ч</div>}
                        </div>
                      )}
                    </div>
                    <div className="financial-item">
                      <span className="financial-label">Пусконаладочные работы:</span>
                      <span className="financial-value">{calculation.commissioningCost ? `${parseFloat(calculation.commissioningCost).toFixed(2)} BYN` : '-'}</span>
                    </div>
                    <div className="financial-item total">
                      <span className="financial-label">Общая стоимость проекта:</span>
                      <span className="financial-value">{calculation.totalProjectCost ? `${parseFloat(calculation.totalProjectCost).toFixed(2)} BYN` : '-'}</span>
                    </div>
                    <div className="financial-item">
                      <span className="financial-label">Трудозатраты:</span>
                      <span className="financial-value">{calculation.laborHours ? `${parseFloat(calculation.laborHours).toFixed(2)} ч.` : '-'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div>Нет данных для отображения</div>
            )}
          </div>
        )}

        {activeTab === 'specification' && (
          <div>
            {loadingSpecification ? (
              <div>Загрузка...</div>
            ) : specification ? (
              <div className="specification-report">
                <h2>Смета электротехнического оборудования</h2>
                
                {/* Общие метрики */}
                <div className="report-section">
                  <h3>Общие показатели</h3>
                  <div className="report-stats">
                    <div className="stat-card">
                      <span className="stat-label">Общая стоимость</span>
                      <span className="stat-value">{specification.totalEquipmentCost ? `${parseFloat(specification.totalEquipmentCost).toFixed(2)} BYN` : '-'}</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">Позиций в смете</span>
                      <span className="stat-value">{specification.equipmentItems?.length || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Смета по категориям */}
                {specification.equipmentItems && specification.equipmentItems.length > 0 ? (
                  (() => {
                    const groupedByCategory = specification.equipmentItems.reduce((acc, item) => {
                      const category = item.category || 'Прочее';
                      if (!acc[category]) {
                        acc[category] = [];
                      }
                      acc[category].push(item);
                      return acc;
                    }, {});

                    return Object.entries(groupedByCategory).map(([category, items]) => (
                      <div key={category} className="report-section">
                        <h3>{category}</h3>
                        <table className="report-table">
                          <thead>
                            <tr>
                              <th>Наименование</th>
                              <th>Модель</th>
                              <th>Характеристики</th>
                              <th>Количество</th>
                              <th>Ед. изм.</th>
                              <th>Цена за ед.</th>
                              <th>Сумма</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item, idx) => (
                              <tr key={idx}>
                                <td><strong>{item.name}</strong></td>
                                <td>{item.model || '-'}</td>
                                <td>{item.specification || '-'}</td>
                                <td>{item.quantity}</td>
                                <td>{item.unit}</td>
                                <td>{item.unitPrice ? `${parseFloat(item.unitPrice).toFixed(2)} BYN` : '-'}</td>
                                <td><strong>{item.totalPrice ? `${parseFloat(item.totalPrice).toFixed(2)} BYN` : '-'}</strong></td>
                              </tr>
                            ))}
                            <tr className="category-total">
                              <td colSpan="6"><strong>Итого по категории:</strong></td>
                              <td><strong>{items.reduce((sum, item) => sum + (parseFloat(item.totalPrice || 0)), 0).toFixed(2)} BYN</strong></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ));
                  })()
                ) : (
                  <p>Нет оборудования в смете</p>
                )}

                {/* Рекомендации */}
                {specification.recommendations && (
                  <div className="report-section">
                    <h3>Рекомендации</h3>
                    <div className="recommendations-box">
                      {specification.recommendations.split('\n').map((rec, idx) => (
                        <p key={idx}>{rec}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>Нет данных для отображения</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminProjectDetail;

