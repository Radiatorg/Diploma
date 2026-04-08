package com.verchuk.electro.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CalculationReportResponse {
    private Long projectId;
    private String projectName;
    private BigDecimal totalPowerConsumption;
    private BigDecimal totalCurrent;
    private Integer totalAppliances;
    private List<RoomCalculationResponse> roomCalculations;
    private List<ApplianceSummaryResponse> applianceSummaries;
    private List<CableTypeTotalLengthResponse> projectCableByType;

    // Финансовые расчеты
    private BigDecimal totalEquipmentCost; // Общая стоимость оборудования
    private BigDecimal installationCost; // Стоимость монтажных работ
    private BigDecimal commissioningCost; // Стоимость пусконаладочных работ
    private BigDecimal totalProjectCost; // Общая стоимость проекта
    private BigDecimal laborHours; // Трудозатраты в часах
    
    // Детализация трудозатрат
    private BigDecimal cableWiringHours; // Время на прокладывание проводов (ч)
    private BigDecimal rcdInstallationHours; // Время на установку УЗО (ч)
    private BigDecimal meterInstallationHours; // Время на установку электросчетчика (ч)
    
    // Дополнительные расчеты
    private BigDecimal totalArea; // Общая площадь всех комнат
    private String recommendedCableCrossSection; // Рекомендуемое сечение провода (например, "2.5 мм²")
    private String recommendedMeterType; // Рекомендуемый тип счетчика
    private BigDecimal cableLength; // Общая длина кабелей (в метрах)
    private Integer recommendedBreakerCount; // Количество автоматических выключателей
    
    // Расчеты по ТКП 339-2022
    private BigDecimal calculatedLeakageCurrent; // Расчетный ток утечки (мА)
    private Integer recommendedRcdRating; // Рекомендуемый номинал УЗО (мА)
    private Integer recommendedCircuitBreakerRating; // Рекомендуемый номинал автомата защиты (А)
    private Boolean rcdRequired; // Требуется ли УЗО
    private List<String> complianceWarnings; // Предупреждения о соответствии ТКП 339-2022
    
    // Расчеты с коэффициентом спроса
    private BigDecimal installedPower; // Установленная мощность (Вт)
    private BigDecimal demandFactor; // Коэффициент спроса (Kc)
    private BigDecimal designPower; // Расчетная мощность (Вт)
    private Integer mainCircuitBreaker; // Главный автомат (А)

    // Разделение на существующее и планируемое
    private BigDecimal existingPower; // Существующая мощность (Вт)
    private BigDecimal plannedPower; // Планируемая мощность (Вт)
    private Integer existingPointsCount; // Количество существующих точек
    private Integer plannedPointsCount; // Количество планируемых точек

    // Готовность исходных данных для точного расчета
    private Boolean hasFloorPlan;
    private Integer wallsCount;
    private Integer windowsCount;
    private Integer doorsCount;
    private Integer cableRunsCount;
    private Boolean hasCableRoutes;
    private List<String> inputReadinessWarnings;

    private List<FinancialCalculationLineResponse> financialCalculationLines;
}

