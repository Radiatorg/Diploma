import React, { useState, useEffect, useCallback } from 'react';
import { savedSpecificationAPI, specificationAPI, calculationAPI } from '../../api/api';
import Modal from '../UI/Modal';
import './SpecificationComparison.css';

// Компонент для отображения сохраненной сметы
const SavedSpecificationDisplay = ({ specification }) => {
  if (!specification) return null;

  const formatPrice = (price) => {
    if (!price) return '0.00';
    return parseFloat(price).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const groupedByCategory = () => {
    const groups = {};
    const items = specification.equipmentItems || [];
    
    items.forEach(item => {
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

  const groups = groupedByCategory();
  const items = specification.equipmentItems || [];
  const totalCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  if (items.length === 0) {
    return <p className="empty-message">Нет данных об оборудовании</p>;
  }

  return (
    <div className="saved-spec-display">
      <div className="saved-spec-summary">
        <div className="summary-item">
          <span className="label">Всего позиций:</span>
          <span className="value">{items.length}</span>
        </div>
        <div className="summary-item">
          <span className="label">Общее количество:</span>
          <span className="value">{totalCount} {items[0]?.unit || 'шт'}</span>
        </div>
        <div className="summary-item">
          <span className="label">Общая стоимость:</span>
          <span className="value">{formatPrice(specification.totalEquipmentCost)} BYN</span>
        </div>
      </div>

      {Object.entries(groups).map(([category, groupData]) => (
        <div key={category} className="saved-spec-group">
          <div className="group-header">
            <h6>{category}</h6>
            <div className="group-stats">
              <span>Количество: {groupData.totalQuantity} {items.find(i => i.category === category)?.unit || 'шт'}</span>
              <span>Стоимость: {formatPrice(groupData.totalCost)} BYN</span>
            </div>
          </div>

          <div className="saved-spec-table-container">
            <table className="saved-spec-table">
              <thead>
                <tr>
                  <th>Наименование</th>
                  <th>Характеристики</th>
                  <th>Модель</th>
                  <th>IP</th>
                  <th>Цвет</th>
                  <th>Кол-во</th>
                  <th>Цена за ед.</th>
                  <th>Стоимость</th>
                </tr>
              </thead>
              <tbody>
                {groupData.items.map((item, index) => (
                  <tr key={index}>
                    <td className="item-name">{item.name}</td>
                    <td className="item-spec">{item.specification}</td>
                    <td>{item.model || '-'}</td>
                    <td>{item.ipRating || '-'}</td>
                    <td>{item.color || '-'}</td>
                    <td>{item.quantity || 0} {item.unit || 'шт'}</td>
                    <td>{formatPrice(item.unitPrice)} BYN</td>
                    <td className="item-price">{formatPrice(item.totalPrice)} BYN</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {specification.recommendations && (
        <div className="saved-spec-recommendations">
          <h6>Рекомендации:</h6>
          <p>{specification.recommendations}</p>
        </div>
      )}
    </div>
  );
};

// Компонент для отображения сохраненных расчетов
const SavedCalculationDisplay = ({ calculation }) => {
  if (!calculation) return null;

  const formatPrice = (price) => {
    if (!price) return '0.00';
    return parseFloat(price).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  return (
    <div className="saved-calc-display">
      <div className="saved-calc-overview">
        <div className="overview-item">
          <div className="overview-label">Общее количество оборудования</div>
          <div className="overview-value">{calculation.totalAppliances || 0} шт.</div>
        </div>
        <div className="overview-item">
          <div className="overview-label">Общая установленная мощность</div>
          <div className="overview-value">{(calculation.totalPowerConsumption / 1000).toFixed(2)} кВт</div>
        </div>
        <div className="overview-item">
          <div className="overview-label">Расчетный ток</div>
          <div className="overview-value">{calculation.totalCurrent?.toFixed(1) || '0.0'} А</div>
        </div>
        <div className="overview-item">
          <div className="overview-label">Трудозатраты</div>
          <div className="overview-value">{calculation.laborHours?.toFixed(1) || '0.0'} ч</div>
        </div>
      </div>

      {/* Технические параметры по ТКП 339-2022 */}
      <div className="saved-calc-technical">
        <h6>Технические параметры (ТКП 339-2022):</h6>
        <div className="technical-grid">
          <div className="technical-item">
            <div className="technical-label">Рекомендуемое сечение кабеля</div>
            <div className="technical-value">{calculation.recommendedCableCrossSection || 'Не рассчитано'}</div>
          </div>
          {calculation.recommendedCircuitBreakerRating && (
            <div className="technical-item">
              <div className="technical-label">Номинал автомата защиты</div>
              <div className="technical-value">{calculation.recommendedCircuitBreakerRating} А</div>
            </div>
          )}
          {calculation.recommendedRcdRating && (
            <div className="technical-item">
              <div className="technical-label">Номинал УЗО</div>
              <div className="technical-value">{calculation.recommendedRcdRating} мА</div>
              {calculation.rcdRequired && (
                <div className="technical-note">Обязательно по ТКП 339-2022</div>
              )}
            </div>
          )}
          {calculation.calculatedLeakageCurrent > 0 && (
            <div className="technical-item">
              <div className="technical-label">Расчетный ток утечки</div>
              <div className="technical-value">{calculation.calculatedLeakageCurrent.toFixed(2)} мА</div>
            </div>
          )}
          {calculation.cableLength > 0 && (
            <div className="technical-item">
              <div className="technical-label">Оценочная длина кабеля</div>
              <div className="technical-value">{calculation.cableLength.toFixed(2)} м</div>
            </div>
          )}
          {calculation.recommendedMeterType && (
            <div className="technical-item">
              <div className="technical-label">Рекомендуемый счетчик</div>
              <div className="technical-value">{calculation.recommendedMeterType}</div>
            </div>
          )}
        </div>
      </div>

      {/* Предупреждения о соответствии ТКП 339-2022 */}
      {calculation.complianceWarnings && calculation.complianceWarnings.length > 0 && (
        <div className="saved-calc-warnings">
          <h6>Предупреждения и требования ТКП 339-2022:</h6>
          <ul className="warnings-list">
            {calculation.complianceWarnings.map((warning, index) => (
              <li key={index} className="warning-item">{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Расчеты по помещениям */}
      {calculation.roomCalculations && calculation.roomCalculations.length > 0 && (
        <div className="saved-calc-rooms">
          <h6>Расчеты по помещениям:</h6>
          <table className="saved-calc-table">
            <thead>
              <tr>
                <th>Помещение</th>
                <th>Площадь (м²)</th>
                <th>Мощность (Вт)</th>
                <th>Коэффициент</th>
                <th>Количество приборов</th>
              </tr>
            </thead>
            <tbody>
              {calculation.roomCalculations.map((room, idx) => (
                <tr key={idx}>
                  <td><strong>{room.roomName}</strong></td>
                  <td>{room.area ? parseFloat(room.area).toFixed(2) : '-'}</td>
                  <td>{room.totalPower ? parseFloat(room.totalPower).toFixed(2) : '-'}</td>
                  <td>{room.coefficient ? parseFloat(room.coefficient).toFixed(2) : '-'}</td>
                  <td>{room.applianceCount || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Финансовые расчеты */}
      <div className="saved-calc-financial">
        <h6>Финансовые расчеты:</h6>
        <table className="saved-calc-table">
          <thead>
            <tr>
              <th>Статья расходов</th>
              <th>Сумма</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Стоимость оборудования</td>
              <td className="text-right">{formatPrice(calculation.totalEquipmentCost)} BYN</td>
            </tr>
            <tr>
              <td>
                <div>Стоимость монтажных работ ({calculation.laborHours?.toFixed(1) || '0.0'} ч × 15 BYN/ч)</div>
                {calculation.cableWiringHours && calculation.cableWiringHours > 0 && (
                  <div style={{ fontSize: '0.85em', color: '#666', marginTop: '4px' }}>
                    • Прокладывание проводов: {calculation.cableWiringHours.toFixed(2)} ч
                  </div>
                )}
                {calculation.rcdInstallationHours && calculation.rcdInstallationHours > 0 && (
                  <div style={{ fontSize: '0.85em', color: '#666', marginTop: '2px' }}>
                    • Установка УЗО: {calculation.rcdInstallationHours.toFixed(2)} ч
                  </div>
                )}
                {calculation.meterInstallationHours && calculation.meterInstallationHours > 0 && (
                  <div style={{ fontSize: '0.85em', color: '#666', marginTop: '2px' }}>
                    • Установка электросчетчика: {calculation.meterInstallationHours.toFixed(2)} ч
                  </div>
                )}
              </td>
              <td className="text-right">{formatPrice(calculation.installationCost)} BYN</td>
            </tr>
            <tr>
              <td>Стоимость пусконаладочных работ (15% от стоимости оборудования)</td>
              <td className="text-right">{formatPrice(calculation.commissioningCost)} BYN</td>
            </tr>
            <tr className="total-row">
              <td><strong>Общая стоимость проекта</strong></td>
              <td className="text-right"><strong>{formatPrice(calculation.totalProjectCost)} BYN</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SpecificationComparison = ({ projectId }) => {
  const [savedSpecs, setSavedSpecs] = useState([]);
  const [selectedSpecs, setSelectedSpecs] = useState([]);
  const [expandedSpecs, setExpandedSpecs] = useState([]);
  const [fullSpecData, setFullSpecData] = useState({}); // Хранит полные данные для каждой раскрытой сметы
  const [comparisonData, setComparisonData] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [deleteModal, setDeleteModal] = useState({ show: false, specId: null, specName: '', onConfirm: null });
  const [loading, setLoading] = useState(false);
  const [loadingFullData, setLoadingFullData] = useState({});
  const [error, setError] = useState('');

  const loadSavedSpecs = useCallback(async () => {
    try {
      const response = await savedSpecificationAPI.getAll(projectId);
      setSavedSpecs(response.data || []);
    } catch (err) {
      console.error('Ошибка загрузки сохраненных смет:', err);
    }
  }, [projectId]);

  // Загружаем сохраненные сметы при монтировании компонента
  useEffect(() => {
    if (projectId) {
      loadSavedSpecs();
    }
  }, [projectId, loadSavedSpecs]);

  const handleSaveCurrent = async () => {
    if (!saveName.trim()) {
      setError('Введите название сметы');
      return;
    }

    try {
      setLoading(true);
      await savedSpecificationAPI.save(projectId, { 
        name: saveName.trim()
      });
      setShowSaveModal(false);
      setSaveName('');
      setError('');
      loadSavedSpecs();
    } catch (err) {
      setError('Ошибка сохранения сметы');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (selectedSpecs.length < 1) {
      setError('Выберите минимум 1 сохраненную версию для сравнения с текущей');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Загружаем полные данные сохраненных спецификаций
      const specsData = await Promise.all(
        selectedSpecs.map(async (specId) => {
          try {
            const specResponse = await savedSpecificationAPI.getById(projectId, specId);
            const spec = specResponse.data;
            return {
              id: spec.id,
              name: spec.name,
              totalCost: spec.totalCost,
              totalPower: spec.totalPower,
              totalCurrent: spec.totalCurrent,
              cableSection: spec.cableSection,
              rcdRating: spec.rcdRating,
              createdAt: spec.createdAt
            };
          } catch (err) {
            console.error(`Ошибка загрузки спецификации ${specId}:`, err);
            const spec = savedSpecs.find(s => s.id === specId);
            return spec;
          }
        })
      );

      // Добавляем текущую спецификацию для сравнения
      const [, currentCalc] = await Promise.all([
        specificationAPI.getSpecification(projectId),
        calculationAPI.getReport(projectId)
      ]);

      const currentData = {
        id: 'current',
        name: 'Текущая смета',
        totalCost: currentCalc.data.totalProjectCost,
        totalPower: currentCalc.data.totalPowerConsumption,
        totalCurrent: currentCalc.data.totalCurrent,
        cableSection: currentCalc.data.recommendedCableCrossSection,
        rcdRating: currentCalc.data.recommendedRcdRating,
        createdAt: new Date()
      };

      setComparisonData([currentData, ...specsData]);
    } catch (err) {
      setError('Ошибка загрузки данных для сравнения');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (specId, specName) => {
    setDeleteModal({
      show: true,
      specId: specId,
      specName: specName,
      onConfirm: async () => {
    try {
      await savedSpecificationAPI.delete(projectId, specId);
      loadSavedSpecs();
      setSelectedSpecs(selectedSpecs.filter(id => id !== specId));
          setDeleteModal({ show: false, specId: null, specName: '', onConfirm: null });
    } catch (err) {
          setError('Ошибка удаления сметы');
          setDeleteModal({ show: false, specId: null, specName: '', onConfirm: null });
      console.error(err);
    }
      }
    });
  };

  const toggleSpecSelection = (specId) => {
    setSelectedSpecs(prev => 
      prev.includes(specId) 
        ? prev.filter(id => id !== specId)
        : [...prev, specId]
    );
  };

  const toggleSpecExpansion = async (specId) => {
    const isCurrentlyExpanded = expandedSpecs.includes(specId);
    
    if (isCurrentlyExpanded) {
      // Закрываем карточку
      setExpandedSpecs(prev => prev.filter(id => id !== specId));
      // Удаляем загруженные данные для экономии памяти
      setFullSpecData(prev => {
        const newData = { ...prev };
        delete newData[specId];
        return newData;
      });
    } else {
      // Открываем карточку и загружаем полные данные
      setExpandedSpecs(prev => [...prev, specId]);
      
      // Проверяем, не загружены ли уже данные
      if (!fullSpecData[specId]) {
        setLoadingFullData(prev => ({ ...prev, [specId]: true }));
        try {
          console.log('Загрузка полных данных для сметы:', specId, 'с параметром full=true');
          const response = await savedSpecificationAPI.getById(projectId, specId, true); // full=true
          console.log('Получены данные:', response.data);
          console.log('Спецификация:', response.data.specification);
          console.log('Расчеты:', response.data.calculation);
          
          if (response.data) {
            setFullSpecData(prev => ({
              ...prev,
              [specId]: response.data
            }));
          } else {
            console.warn('Данные не получены в ответе');
            setError('Данные не получены');
          }
        } catch (err) {
          console.error('Ошибка загрузки полных данных сметы:', err);
          console.error('Детали ошибки:', err.response?.data || err.message);
          setError('Ошибка загрузки полных данных сметы: ' + (err.response?.data?.message || err.message));
        } finally {
          setLoadingFullData(prev => {
            const newData = { ...prev };
            delete newData[specId];
            return newData;
          });
        }
      }
    }
  };

  const formatPrice = (price) => {
    if (!price) return '0.00';
    return parseFloat(price).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  return (
    <div className="specification-comparison">
      <div className="comparison-header">
        <h3>История смет оборудования</h3>
        <div className="comparison-actions">
          <button 
            onClick={() => setShowSaveModal(true)} 
            className="btn-primary"
          >
            Сохранить текущую версию проекта
          </button>
          <button 
            onClick={handleCompare} 
            className="btn-primary"
            disabled={selectedSpecs.length < 1 || loading}
          >
            Сравнить с текущей версией
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="saved-specs-list">
        <h4>Сохраненные версии проекта:</h4>
        {savedSpecs.length === 0 ? (
          <p className="empty-message">Нет сохраненных версий проекта. Сохраните текущую версию для сравнения.</p>
        ) : (
          <div className="specs-grid">
            {savedSpecs.map(spec => {
              const isExpanded = expandedSpecs.includes(spec.id);
              return (
              <div 
                key={spec.id} 
                  className={`spec-card ${selectedSpecs.includes(spec.id) ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}`}
              >
                  <div className="spec-card-content">
                    <div className="spec-card-main-info">
                      <div className="spec-field">
                  <input
                    type="checkbox"
                    checked={selectedSpecs.includes(spec.id)}
                    onChange={() => toggleSpecSelection(spec.id)}
                    onClick={(e) => e.stopPropagation()}
                          className="spec-checkbox"
                  />
                      </div>
                      <div className="spec-field">
                        <span className="field-label">Название версии:</span>
                        <span className="field-value">{spec.name}</span>
                      </div>
                      <div className="spec-field">
                        <span className="field-label">Стоимость:</span>
                        <span className="field-value spec-cost">{formatPrice(spec.totalCost)} BYN</span>
                      </div>
                      <div className="spec-field">
                        <span className="field-label">Дата сохранения:</span>
                        <span className="field-value">{new Date(spec.createdAt).toLocaleDateString('ru-RU')}</span>
                      </div>
                      <div className="spec-field spec-field-actions">
                  <button
                          className="btn-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                            handleDelete(spec.id, spec.name);
                    }}
                    title="Удалить"
                  >
                          Удалить
                  </button>
                </div>
                    </div>
                    <button
                      className="spec-expand-button"
                      onClick={() => toggleSpecExpansion(spec.id)}
                    >
                      <span className="expand-icon">{isExpanded ? '▲' : '▼'}</span>
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="spec-card-details">
                      {loadingFullData[spec.id] ? (
                        <div className="loading-full-data">
                          <div className="loading-spinner-small"></div>
                          <p>Загрузка полных данных...</p>
                        </div>
                      ) : fullSpecData[spec.id] ? (
                        <div className="full-spec-content">
                          {fullSpecData[spec.id].specification ? (
                            <div className="saved-spec-section">
                              <h5>Смета оборудования</h5>
                              <SavedSpecificationDisplay specification={fullSpecData[spec.id].specification} />
                            </div>
                          ) : (
                            <div className="saved-spec-section">
                              <p className="empty-message">Данные сметы оборудования не найдены</p>
                            </div>
                          )}
                          {fullSpecData[spec.id].calculation ? (
                            <div className="saved-spec-section">
                              <h5>Расчетная ведомость</h5>
                              <SavedCalculationDisplay calculation={fullSpecData[spec.id].calculation} />
                            </div>
                          ) : (
                            <div className="saved-spec-section">
                              <p className="empty-message">Данные расчетной ведомости не найдены</p>
                            </div>
                          )}
                          {!fullSpecData[spec.id].specification && !fullSpecData[spec.id].calculation && (
                            <div className="saved-spec-section">
                              <p className="empty-message">Полные данные для этой сметы не сохранены</p>
                            </div>
                          )}
                        </div>
                      ) : (
                  <div className="spec-stat">
                    <span className="stat-label">Мощность:</span>
                    <span className="stat-value">{(spec.totalPower / 1000).toFixed(2)} кВт</span>
                  </div>
                      )}
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {comparisonData.length > 0 && (
        <div className="comparison-table-container">
          <div className="comparison-header-section">
            <h4>Сравнение версий проекта</h4>
          </div>
          <div className="comparison-table-wrapper">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Параметр</th>
                  {comparisonData.map(spec => (
                    <th key={spec.id}>
                      {spec.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Общая стоимость</strong></td>
                  {comparisonData.map(spec => (
                    <td key={spec.id}>
                      {formatPrice(spec.totalCost)} BYN
                    </td>
                  ))}
                </tr>
                <tr>
                  <td><strong>Общая мощность</strong></td>
                  {comparisonData.map(spec => (
                    <td key={spec.id}>
                      {(spec.totalPower / 1000).toFixed(2)} кВт
                    </td>
                  ))}
                </tr>
                <tr>
                  <td><strong>Расчетный ток</strong></td>
                  {comparisonData.map(spec => (
                    <td key={spec.id}>
                      {spec.totalCurrent?.toFixed(1)} А
                    </td>
                  ))}
                </tr>
                <tr>
                  <td><strong>Сечение кабеля</strong></td>
                  {comparisonData.map(spec => (
                    <td key={spec.id}>
                      {spec.cableSection || '-'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td><strong>Номинал УЗО</strong></td>
                  {comparisonData.map(spec => (
                    <td key={spec.id}>
                      {spec.rcdRating ? `${spec.rcdRating} мА` : '-'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td><strong>Дата сохранения</strong></td>
                  {comparisonData.map(spec => (
                    <td key={spec.id}>
                      {spec.createdAt ? new Date(spec.createdAt).toLocaleString('ru-RU') : 'Текущая'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="comparison-actions-footer">
            <button 
              onClick={() => {
                setComparisonData([]);
              }} 
              className="btn-secondary"
            >
              Закрыть сравнение
            </button>
          </div>
        </div>
      )}

      <Modal
        show={showSaveModal}
        title="Сохранить версию проекта"
        onClose={() => {
          setShowSaveModal(false);
          setSaveName('');
          setError('');
        }}
        onConfirm={handleSaveCurrent}
        confirmText="Сохранить"
        cancelText="Отмена"
      >
        <div className="save-spec-form">
          <label>
            Название версии:
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Например: Вариант 1 - Эконом, Вариант 2 - Премиум"
              maxLength={200}
              autoFocus
            />
          </label>
          <p className="save-hint">
            Будет сохранена текущая смета оборудования и расчётная ведомость проекта
          </p>
          {error && <div className="error-message">{error}</div>}
        </div>
      </Modal>

      <Modal
        show={deleteModal.show}
        title="Удаление сметы"
        type="confirm"
        onClose={() => setDeleteModal({ show: false, specId: null, specName: '', onConfirm: null })}
        onConfirm={deleteModal.onConfirm}
        confirmText="Удалить"
        cancelText="Отмена"
      >
        <p>Вы уверены, что хотите удалить смету <strong>"{deleteModal.specName}"</strong>?</p>
        <p>Это действие нельзя отменить.</p>
      </Modal>
    </div>
  );
};

export default SpecificationComparison;

