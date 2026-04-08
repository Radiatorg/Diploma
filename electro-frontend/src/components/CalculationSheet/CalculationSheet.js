import React, { useState, useEffect, useCallback } from 'react';
import { calculationAPI, pdfExportAPI } from '../../api/api';
import './CalculationSheet.css';

const CalculationSheet = ({ projectId }) => {
  const [reportData, setReportData] = useState({
    projectName: '',
    totalPowerConsumption: 0,
    totalCurrent: 0,
    totalAppliances: 0,
    roomCalculations: [],
    applianceSummaries: [],
    totalEquipmentCost: 0,
    installationCost: 0,
    commissioningCost: 0,
    totalProjectCost: 0,
    laborHours: 0,
    recommendedCableCrossSection: '',
    recommendedMeterType: '',
    cableLength: 0,
    recommendedBreakerCount: 0,
    calculatedLeakageCurrent: 0,
    recommendedRcdRating: null,
    recommendedCircuitBreakerRating: null,
    rcdRequired: false,
    complianceWarnings: [],
    inputReadinessWarnings: [],
    cableWiringHours: 0,
    rcdInstallationHours: 0,
    meterInstallationHours: 0,
    projectCableByType: [],
    financialCalculationLines: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Используем API endpoint для расчетной ведомости
      const reportRes = await calculationAPI.getReport(projectId);
      const report = reportRes.data;

      // Преобразуем данные из ответа API
      setReportData({
        projectName: report.projectName || '',
        totalPowerConsumption: report.totalPowerConsumption || 0,
        totalCurrent: report.totalCurrent || 0,
        totalAppliances: report.totalAppliances || 0,
        roomCalculations: report.roomCalculations || [],
        applianceSummaries: report.applianceSummaries || [],
        totalEquipmentCost: report.totalEquipmentCost || 0,
        installationCost: report.installationCost || 0,
        commissioningCost: report.commissioningCost || 0,
        totalProjectCost: report.totalProjectCost || 0,
        laborHours: report.laborHours || 0,
        cableWiringHours: report.cableWiringHours ?? 0,
        rcdInstallationHours: report.rcdInstallationHours ?? 0,
        meterInstallationHours: report.meterInstallationHours ?? 0,
        projectCableByType: report.projectCableByType || [],
        financialCalculationLines: report.financialCalculationLines || [],
        recommendedCableCrossSection: report.recommendedCableCrossSection || '',
        recommendedMeterType: report.recommendedMeterType || '',
        cableLength: report.cableLength || 0,
        recommendedBreakerCount: report.recommendedBreakerCount || 0,
        calculatedLeakageCurrent: report.calculatedLeakageCurrent || 0,
        recommendedRcdRating: report.recommendedRcdRating || null,
        recommendedCircuitBreakerRating: report.recommendedCircuitBreakerRating || null,
        rcdRequired: report.rcdRequired || false,
        complianceWarnings: report.complianceWarnings || [],
        inputReadinessWarnings: report.inputReadinessWarnings || []
      });

      setError('');
    } catch (err) {
      setError('Ошибка загрузки расчетной ведомости');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleFocus = () => {
      loadData();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadData]);

  const formatPrice = (price) => {
    if (!price) return '0.00';
    return parseFloat(price).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };


  if (loading) {
    return <div className="loading">Загрузка расчетной ведомости...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="calculation-sheet">
      <div className="sheet-header">
        <div className="sheet-header-top">
          <h3>Расчетная ведомость проекта электросети</h3>
          <button
            onClick={async () => {
              try {
                const response = await pdfExportAPI.exportCalculation(projectId);
                const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `calculation_${projectId}.pdf`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
              } catch (err) {
                console.error('Ошибка экспорта PDF:', err);
                alert('Ошибка экспорта расчетной ведомости в PDF');
              }
            }}
            className="btn-primary"
            title="Скачать расчетную ведомость в PDF"
          >
            📄 Скачать PDF
          </button>
        </div>
        {reportData.projectName && <div className="project-name">Проект: {reportData.projectName}</div>}
        <div className="sheet-date">
          Дата: {new Date().toLocaleDateString('ru-RU')}
        </div>
      </div>

      <div className="sheet-overview">
        <div className="overview-grid">
          <div className="overview-item">
            <div className="overview-label">Общее количество оборудования</div>
            <div className="overview-value">{reportData.totalAppliances} шт.</div>
          </div>
          <div className="overview-item">
            <div className="overview-label">Общая установленная мощность</div>
            <div className="overview-value">{(reportData.totalPowerConsumption / 1000).toFixed(2)} кВт</div>
          </div>
          <div className="overview-item">
            <div className="overview-label">Расчетный ток</div>
            <div className="overview-value">{reportData.totalCurrent.toFixed(1)} А</div>
          </div>
          <div className="overview-item">
            <div className="overview-label">Трудозатраты</div>
            <div className="overview-value">{reportData.laborHours.toFixed(1)} ч</div>
          </div>
        </div>
      </div>

      <div className="calculation-warning">
        <strong>Внимание!</strong> Представленные расчёты являются примерными и ориентировочными. Реальные расчёты могут различаться в зависимости от конкретных условий монтажа, выбранных материалов и особенностей объекта. Программа не несёт ответственности за расхождения между предварительными и итоговыми расчётами.
      </div>

      {reportData.inputReadinessWarnings && reportData.inputReadinessWarnings.length > 0 && (
        <div className="compliance-warnings">
          <h4>Что нужно заполнить для более точного расчёта:</h4>
          <ul className="warnings-list">
            {reportData.inputReadinessWarnings.map((warning, index) => (
              <li key={index} className="warning-item">{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Технические параметры по ТКП 339-2022 */}
      <div className="technical-specifications">
        <h4>Технические параметры (ТКП 339-2022):</h4>
        <div className="spec-grid">
          <div className="spec-item">
            <div className="spec-label">Рекомендуемое сечение кабеля</div>
            <div className="spec-value">{reportData.recommendedCableCrossSection || 'Не рассчитано'}</div>
          </div>
          {reportData.recommendedCircuitBreakerRating && (
            <div className="spec-item">
              <div className="spec-label">Номинал автомата защиты</div>
              <div className="spec-value">{reportData.recommendedCircuitBreakerRating} А</div>
            </div>
          )}
          {reportData.recommendedRcdRating && (
            <div className="spec-item">
              <div className="spec-label">Номинал УЗО</div>
              <div className="spec-value">{reportData.recommendedRcdRating} мА</div>
              {reportData.rcdRequired && (
                <div className="spec-note">Обязательно по ТКП 339-2022</div>
              )}
            </div>
          )}
          {reportData.calculatedLeakageCurrent > 0 && (
            <div className="spec-item">
              <div className="spec-label">Расчетный ток утечки</div>
              <div className="spec-value">{reportData.calculatedLeakageCurrent.toFixed(2)} мА</div>
            </div>
          )}
          {reportData.cableLength > 0 && (
            <div className="spec-item">
              <div className="spec-label">Оценочная длина кабеля</div>
              <div className="spec-value">{reportData.cableLength.toFixed(2)} м</div>
            </div>
          )}
          {reportData.recommendedMeterType && (
            <div className="spec-item">
              <div className="spec-label">Рекомендуемый счетчик</div>
              <div className="spec-value">{reportData.recommendedMeterType}</div>
            </div>
          )}
        </div>
      </div>

      {/* Предупреждения о соответствии ТКП 339-2022 */}
      {reportData.complianceWarnings && reportData.complianceWarnings.length > 0 && (
        <div className="compliance-warnings">
          <h4>Предупреждения и требования ТКП 339-2022:</h4>
          <ul className="warnings-list">
            {reportData.complianceWarnings.map((warning, index) => (
              <li key={index} className="warning-item">{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {reportData.projectCableByType && reportData.projectCableByType.length > 0 && (
        <div className="room-calculations">
          <h4>Кабель по проекту (по трассам):</h4>
          <table className="calculation-table">
            <thead>
              <tr>
                <th>Тип кабеля</th>
                <th>Сечение, мм²</th>
                <th>Длина, м</th>
              </tr>
            </thead>
            <tbody>
              {reportData.projectCableByType.map((row) => (
                <tr key={row.cableTypeId ?? row.cableName}>
                  <td>{row.cableName}</td>
                  <td className="text-center">
                    {row.crossSectionMm2 != null ? parseFloat(row.crossSectionMm2).toString() : '—'}
                  </td>
                  <td className="text-right">{row.totalLengthM != null ? parseFloat(row.totalLengthM).toFixed(2) : '0.00'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reportData.roomCalculations && reportData.roomCalculations.length > 0 && (
        <div className="room-calculations">
          <h4>Расчеты по помещениям:</h4>
          <table className="calculation-table">
            <thead>
              <tr>
                <th>Помещение</th>
                <th>Оборудование</th>
                <th>Мощность (Вт)</th>
                <th>Кабель, м</th>
                <th>По маркам и сечениям</th>
              </tr>
            </thead>
            <tbody>
              {reportData.roomCalculations.map((room) => (
                <React.Fragment key={room.roomId}>
                  <tr>
                    <td>{room.roomName}</td>
                    <td className="text-center">{room.applianceCount} шт.</td>
                    <td className="text-right">{parseFloat(room.totalPower || 0).toFixed(2)}</td>
                    <td className="text-right">
                      {room.totalCableLengthM != null ? parseFloat(room.totalCableLengthM).toFixed(2) : '0.00'}
                    </td>
                    <td style={{ fontSize: '0.9em', color: '#444' }}>
                      {room.cableByType && room.cableByType.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: '1.1em' }}>
                          {room.cableByType.map((c, i) => (
                            <li key={i}>
                              {c.cableName}
                              {c.crossSectionMm2 != null && ` (${parseFloat(c.crossSectionMm2)} мм²)`}
                              : {c.lengthM != null ? parseFloat(c.lengthM).toFixed(2) : '0.00'} м
                            </li>
                          ))}
                        </ul>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                  {room.cableLengthSourceNote && (
                    <tr>
                      <td colSpan={5} style={{ fontSize: '0.85em', color: '#666', paddingTop: 0 }}>
                        {room.cableLengthSourceNote}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="financial-calculations">
        <h4>Финансовые расчёты (что откуда складывается):</h4>
        <table className="calculation-table">
          <thead>
            <tr>
              <th>Статья</th>
              <th>Расчёт</th>
              <th>Сумма / часы</th>
            </tr>
          </thead>
          <tbody>
            {reportData.financialCalculationLines && reportData.financialCalculationLines.length > 0 ? (
              reportData.financialCalculationLines.map((line, idx) => (
                <tr
                  key={idx}
                  className={line.title && line.title.includes('Общая стоимость') ? 'total-row' : ''}
                  style={{ background: line.indent > 0 ? 'rgba(0,0,0,0.02)' : undefined }}
                >
                  <td style={{ paddingLeft: `${8 + (line.indent || 0) * 16}px` }}>{line.title}</td>
                  <td style={{ fontSize: '0.88em', color: '#555' }}>{line.calculationNote || '—'}</td>
                  <td className="text-right">
                    {line.amountByn != null && <span>{formatPrice(line.amountByn)} BYN</span>}
                    {line.amountHours != null && (
                      <span>
                        {line.amountByn != null ? <br /> : null}
                        {parseFloat(line.amountHours).toFixed(2)} ч
                      </span>
                    )}
                    {line.amountByn == null && line.amountHours == null && '—'}
                  </td>
                </tr>
              ))
            ) : (
              <>
                <tr>
                  <td>Оборудование</td>
                  <td>—</td>
                  <td className="text-right">{formatPrice(reportData.totalEquipmentCost)} BYN</td>
                </tr>
                <tr>
                  <td>Монтаж</td>
                  <td>{reportData.laborHours?.toFixed(1) || '0.0'} ч × 15 BYN/ч</td>
                  <td className="text-right">{formatPrice(reportData.installationCost)} BYN</td>
                </tr>
                <tr>
                  <td>ПНР</td>
                  <td>15% от оборудования</td>
                  <td className="text-right">{formatPrice(reportData.commissioningCost)} BYN</td>
                </tr>
                <tr className="total-row">
                  <td colSpan={2}><strong>Общая стоимость проекта</strong></td>
                  <td className="text-right"><strong>{formatPrice(reportData.totalProjectCost)} BYN</strong></td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Сводка по приборам */}
      {reportData.applianceSummaries && reportData.applianceSummaries.length > 0 && (
        <div className="appliance-summaries">
          <h4>Сводка по приборам:</h4>
          <table className="calculation-table">
            <thead>
              <tr>
                <th>Прибор</th>
                <th>Количество</th>
                <th>Общая мощность (Вт)</th>
              </tr>
            </thead>
            <tbody>
              {reportData.applianceSummaries.map((appliance) => (
                <tr key={appliance.applianceId}>
                  <td>{appliance.applianceName}</td>
                  <td className="text-center">{appliance.totalQuantity} шт.</td>
                  <td className="text-right">{parseFloat(appliance.totalPower).toFixed(2)} Вт</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="sheet-footer">
        <div className="recommendations">
          <h4>Общие рекомендации:</h4>
          <ul>
            <li>Минимальное сечение медного кабеля: 1.5 мм² (ТКП 339-2022 п. 8.4.4)</li>
            <li>УЗО обязательно для розеточных групп, ванных комнат, стиральных машин, электроплит (ТКП 339-2022 п. 8.7.4)</li>
            <li>Номинал УЗО должен быть не менее 3× расчетного тока утечки</li>
            <li>Для влажных помещений рекомендуется УЗО 10-30 мА</li>
            {reportData.recommendedCableCrossSection && (
              <li>Рекомендуемое сечение кабеля для данного проекта: {reportData.recommendedCableCrossSection}</li>
            )}
          </ul>
        </div>

        <div className="sheet-actions">
          <button onClick={loadData} className="btn-primary">
            Обновить расчеты
          </button>
        </div>
      </div>
    </div>
  );
};


export default CalculationSheet;
