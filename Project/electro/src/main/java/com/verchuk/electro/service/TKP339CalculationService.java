package com.verchuk.electro.service;

import com.verchuk.electro.model.Appliance;
import com.verchuk.electro.model.ProjectAppliance;
import com.verchuk.electro.model.Room;
import com.verchuk.electro.model.RoomType;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * Сервис для расчета электрических параметров согласно ТКП 339-2022
 */
@Service
public class TKP339CalculationService {
    
    @Autowired
    private TKP339ValidationService validationService;
    
    // Константы из ТКП 339-2022
    private static final BigDecimal MIN_CABLE_SECTION_COPPER = BigDecimal.valueOf(1.5); // мм²
    private static final BigDecimal VOLTAGE = BigDecimal.valueOf(230); // В
    private static final BigDecimal LEAKAGE_CURRENT_PER_AMP = BigDecimal.valueOf(0.4); // мА на 1 А тока нагрузки
    private static final BigDecimal LEAKAGE_CURRENT_PER_METER = BigDecimal.valueOf(0.01); // мА на 1 м длины провода
    private static final BigDecimal HEATING_POWER_THRESHOLD = BigDecimal.valueOf(5000); // Вт (5 кВт)
    
    // Стандартные сечения медного кабеля (мм²)
    private static final double[] STANDARD_SECTIONS = {1.5, 2.5, 4.0, 6.0, 10.0, 16.0};
    // Максимальные токи для стандартных сечений (А) - для скрытой проводки, медь
    private static final double[] MAX_CURRENTS = {18.0, 25.0, 32.0, 40.0, 50.0, 70.0};
    
    // Стандартные номиналы УЗО (мА)
    private static final int[] STANDARD_RCD_RATINGS = {10, 30, 100, 300};
    
    /**
     * Результат расчета по ТКП 339-2022
     */
    public static class TKP339CalculationResult {
        private BigDecimal totalCurrent; // А
        private BigDecimal calculatedLeakageCurrent; // мА
        private Integer recommendedRcdRating; // мА
        private String recommendedCableSection; // мм²
        private Integer recommendedCircuitBreakerRating; // А
        private boolean rcdRequired;
        private List<String> warnings;
        private BigDecimal estimatedCableLength; // м
        
        public TKP339CalculationResult() {
            this.warnings = new ArrayList<>();
        }
        
        // Getters and Setters
        public BigDecimal getTotalCurrent() { return totalCurrent; }
        public void setTotalCurrent(BigDecimal totalCurrent) { this.totalCurrent = totalCurrent; }
        
        public BigDecimal getCalculatedLeakageCurrent() { return calculatedLeakageCurrent; }
        public void setCalculatedLeakageCurrent(BigDecimal calculatedLeakageCurrent) { 
            this.calculatedLeakageCurrent = calculatedLeakageCurrent; 
        }
        
        public Integer getRecommendedRcdRating() { return recommendedRcdRating; }
        public void setRecommendedRcdRating(Integer recommendedRcdRating) { 
            this.recommendedRcdRating = recommendedRcdRating; 
        }
        
        public String getRecommendedCableSection() { return recommendedCableSection; }
        public void setRecommendedCableSection(String recommendedCableSection) { 
            this.recommendedCableSection = recommendedCableSection; 
        }
        
        public Integer getRecommendedCircuitBreakerRating() { return recommendedCircuitBreakerRating; }
        public void setRecommendedCircuitBreakerRating(Integer recommendedCircuitBreakerRating) { 
            this.recommendedCircuitBreakerRating = recommendedCircuitBreakerRating; 
        }
        
        public boolean isRcdRequired() { return rcdRequired; }
        public void setRcdRequired(boolean rcdRequired) { this.rcdRequired = rcdRequired; }
        
        public List<String> getWarnings() { return warnings; }
        public void setWarnings(List<String> warnings) { this.warnings = warnings; }
        
        public BigDecimal getEstimatedCableLength() { return estimatedCableLength; }
        public void setEstimatedCableLength(BigDecimal estimatedCableLength) { 
            this.estimatedCableLength = estimatedCableLength; 
        }
    }
    
    /**
     * Расчет параметров для помещения с приборами
     */
    public TKP339CalculationResult calculateForRoom(
            Room room, 
            List<ProjectAppliance> appliances,
            BigDecimal additionalPowerFromPoints) {
        
        TKP339CalculationResult result = new TKP339CalculationResult();
        
        BigDecimal totalPower = appliances.stream()
                .map(pa -> pa.getTotalPower() != null ? pa.getTotalPower() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .add(additionalPowerFromPoints != null ? additionalPowerFromPoints : BigDecimal.ZERO);
        
        // Применяем коэффициент помещения
        if (room.getRoomType() != null) {
            BigDecimal coefficient = room.getRoomType().getEffectiveCoefficient();
            totalPower = totalPower.multiply(coefficient);
        }
        
        // 2. Расчет тока (I = P / U)
        BigDecimal totalCurrent = totalPower.divide(VOLTAGE, 2, RoundingMode.UP);
        result.setTotalCurrent(totalCurrent);
        
        // 3. Оценка длины кабеля (эвристика)
        BigDecimal estimatedCableLength = estimateCableLength(room, appliances.size());
        result.setEstimatedCableLength(estimatedCableLength);
        
        // 4. Расчет тока утечки по формуле ТКП 339-2022 (п. 8.7.14)
        // I_leak = 0.4 мА/А * I_total + 0.01 мА/м * L_cable
        BigDecimal leakageFromCurrent = totalCurrent.multiply(LEAKAGE_CURRENT_PER_AMP);
        BigDecimal leakageFromLength = estimatedCableLength.multiply(LEAKAGE_CURRENT_PER_METER);
        BigDecimal calculatedLeakage = leakageFromCurrent.add(leakageFromLength);
        result.setCalculatedLeakageCurrent(calculatedLeakage);
        
        // 5. Подбор УЗО (номинал должен быть >= 3 * I_leak)
        Integer rcdRating = selectRcdRating(calculatedLeakage);
        result.setRecommendedRcdRating(rcdRating);
        
        // 6. Проверка обязательности УЗО
        boolean rcdRequired = checkRcdRequirement(room, appliances);
        result.setRcdRequired(rcdRequired);
        
        // 7. Подбор сечения кабеля
        String cableSection = selectCableSection(totalCurrent);
        result.setRecommendedCableSection(cableSection);
        
        // 8. Подбор автомата защиты
        Integer breakerRating = selectCircuitBreakerRating(totalCurrent, cableSection);
        result.setRecommendedCircuitBreakerRating(breakerRating);
        
        // 9. Проверка требований и предупреждения
        List<String> warnings = checkTKP339Requirements(room, appliances, totalPower, totalCurrent);
        result.setWarnings(warnings);
        
        return result;
    }
    
    /**
     * Оценка длины кабеля на основе площади помещения и количества приборов
     * Формула: Lкабеля = (Периметр_комнаты + Количество_розеток × 3 + Расстояние_до_щита) × 1.1
     * Где:
     * - Периметр_комнаты - периметр помещения (м)
     * - Количество_розеток × 3 - запас на вертикальные участки (м)
     * - Расстояние_до_щита = 10 м (среднее значение)
     * - × 1.1 - запас 10%
     */
    private BigDecimal estimateCableLength(Room room, int applianceCount) {
        if (room.getArea() == null) {
            return BigDecimal.valueOf(20); // Минимальная оценка
        }
        
        // Предполагаем квадратное помещение для расчета периметра
        double area = room.getArea().doubleValue();
        double sideLength = Math.sqrt(area);
        double perimeter = sideLength * 4; // Периметр в метрах
        
        // Количество розеток/приборов × 3 (запас на вертикальные участки)
        double outletsLength = applianceCount * 3.0;
        
        // Расстояние до щита (среднее значение 10 м)
        double distanceToPanel = 10.0;
        
        // Итоговая длина с запасом 10%
        double totalLength = (perimeter + outletsLength + distanceToPanel) * 1.1;
        
        return BigDecimal.valueOf(totalLength).setScale(2, RoundingMode.HALF_UP);
    }
    
    /**
     * Подбор номинала УЗО (должен быть >= 3 * I_leak)
     */
    private Integer selectRcdRating(BigDecimal calculatedLeakage) {
        BigDecimal minRequired = calculatedLeakage.multiply(BigDecimal.valueOf(3));
        double minRequiredValue = minRequired.doubleValue();
        
        for (int rating : STANDARD_RCD_RATINGS) {
            if (rating >= minRequiredValue) {
                return rating;
            }
        }
        
        // Если не подошел ни один стандартный, возвращаем максимальный
        return STANDARD_RCD_RATINGS[STANDARD_RCD_RATINGS.length - 1];
    }
    
    /**
     * Проверка обязательности УЗО согласно ТКП 339-2022 (п. 8.7.4)
     */
    private boolean checkRcdRequirement(Room room, List<ProjectAppliance> appliances) {
        // УЗО обязательно для ванных и душевых
        if (room.getRoomType() != null) {
            String roomTypeName = room.getRoomType().getName().toLowerCase();
            if (roomTypeName.contains("ванн") || roomTypeName.contains("душ")) {
                return true;
            }
        }
        
        // УЗО обязательно для розеточных групп (всегда)
        // УЗО обязательно для стиральных машин, электроплит, водонагревателей
        for (ProjectAppliance pa : appliances) {
            Appliance appliance = pa.getAppliance();
            if (appliance != null) {
                String applianceName = appliance.getName().toLowerCase();
                if (applianceName.contains("стирал") || 
                    applianceName.contains("плит") || 
                    applianceName.contains("электроплит") ||
                    applianceName.contains("водонагревател") ||
                    applianceName.contains("бойлер")) {
                    return true;
                }
            }
        }
        
        return true; // По умолчанию УЗО требуется для всех розеточных групп
    }
    
    /**
     * Подбор сечения кабеля на основе тока и типа цепи
     * Согласно ТКП 339-2022:
     * - Освещение: минимум 1.5 мм² (защита 10А)
     * - Розетки: минимум 2.5 мм² (защита 16А)
     * - Электроплиты (>3.5кВт): 6 мм²
     * Всегда 3 жилы (L, N, PE), только медь
     */
    private String selectCableSection(BigDecimal totalCurrent) {
        return selectCableSectionByCircuitType(totalCurrent, null, null);
    }
    
    /**
     * Подбор сечения кабеля с учетом типа цепи
     * @param totalCurrent расчетный ток
     * @param circuitType тип цепи: "light" (освещение), "outlet" (розетки), "stove" (плита)
     * @param totalPower общая мощность для определения типа цепи
     */
    public String selectCableSectionByCircuitType(BigDecimal totalCurrent, String circuitType, BigDecimal totalPower) {
        double currentValue = totalCurrent.doubleValue();
        
        // Определяем тип цепи, если не указан явно
        if (circuitType == null && totalPower != null) {
            double powerValue = totalPower.doubleValue();
            if (powerValue >= 3500) {
                circuitType = "stove"; // Электроплита
            }
        }
        
        // Правила по ТКП 339-2022:
        // 1. Освещение: минимум 1.5 мм² (защита 10А)
        if ("light".equals(circuitType)) {
            if (currentValue <= 0) {
                return "3x1.5 мм²"; // 3 жилы, медь
            }
            // Для освещения обычно достаточно 1.5 мм²
            // Правило: Iкабеля ≥ Iрасч × 1.25
            double requiredCableCurrent = currentValue * 1.25;
            for (int i = 0; i < STANDARD_SECTIONS.length; i++) {
                if (requiredCableCurrent <= MAX_CURRENTS[i] && STANDARD_SECTIONS[i] >= 1.5) {
                    return String.format("3x%.1f мм²", STANDARD_SECTIONS[i]);
                }
            }
            return "3x1.5 мм²";
        }
        
        // 2. Розетки: минимум 2.5 мм² (защита 16А)
        if ("outlet".equals(circuitType) || circuitType == null) {
            if (currentValue <= 0) {
                return "3x2.5 мм²"; // Стандарт для розеток
            }
            // Для розеток минимум 2.5 мм²
            // Правило: Iкабеля ≥ Iрасч × 1.25
            double requiredCableCurrent = currentValue * 1.25;
            for (int i = 0; i < STANDARD_SECTIONS.length; i++) {
                if (STANDARD_SECTIONS[i] >= 2.5 && requiredCableCurrent <= MAX_CURRENTS[i]) {
                    return String.format("3x%.1f мм²", STANDARD_SECTIONS[i]);
                }
            }
            return "3x2.5 мм²";
        }
        
        // 3. Электроплиты: 6 мм² (или 5x4 для трехфазных)
        if ("stove".equals(circuitType)) {
            if (currentValue <= 0) {
                return "3x6 мм²";
            }
            // Для плит минимум 6 мм²
            // Правило: Iкабеля ≥ Iрасч × 1.25
            double requiredCableCurrent = currentValue * 1.25;
            for (int i = 0; i < STANDARD_SECTIONS.length; i++) {
                if (STANDARD_SECTIONS[i] >= 6.0 && requiredCableCurrent <= MAX_CURRENTS[i]) {
                    return String.format("3x%.1f мм²", STANDARD_SECTIONS[i]);
                }
            }
            return "3x6 мм²";
        }
        
        // По умолчанию: минимум 1.5 мм²
        if (currentValue <= 0) {
            return "3x1.5 мм²";
        }
        
        // Подбираем сечение по таблице допустимых токов
        // Правило: Iкабеля ≥ Iрасч × 1.25
        double requiredCableCurrent = currentValue * 1.25;
        for (int i = 0; i < STANDARD_SECTIONS.length; i++) {
            if (requiredCableCurrent <= MAX_CURRENTS[i]) {
                return String.format("3x%.1f мм²", STANDARD_SECTIONS[i]);
            }
        }
        
        return String.format("3x%.1f мм²", STANDARD_SECTIONS[STANDARD_SECTIONS.length - 1]);
    }
    
    /**
     * Подбор номинала автомата защиты согласно ТКП 339-2022
     * Правила:
     * - Освещение: 10А (кабель 1.5 мм²)
     * - Розетки: 16А (кабель 2.5 мм²), запрещено 25А на бытовые розетки
     * - Электроплиты: 32А или выше (кабель 6 мм²)
     * Стандартные значения: 10А, 16А, 20А, 25А, 32А, 40А, 50А
     */
    private Integer selectCircuitBreakerRating(BigDecimal totalCurrent, String cableSection) {
        return selectCircuitBreakerRatingByCircuitType(totalCurrent, cableSection, null);
    }
    
    /**
     * Подбор номинала автомата с учетом типа цепи
     */
    public Integer selectCircuitBreakerRatingByCircuitType(BigDecimal totalCurrent, String cableSection, String circuitType) {
        double currentValue = totalCurrent.doubleValue();
        
        // Стандартные номиналы автоматов
        int[] standardRatings = {10, 16, 20, 25, 32, 40, 50};
        
        // Правила по типу цепи
        if ("light".equals(circuitType)) {
            // Освещение: стандарт 10А
            if (currentValue <= 10) {
                return 10;
            }
            // Если ток больше, подбираем ближайший больший, но не более допустимого для кабеля
            double maxCableCurrent = getMaxCurrentForSection(cableSection);
            for (int rating : standardRatings) {
                if (rating >= currentValue * 1.25 && rating <= maxCableCurrent) {
                    return rating;
                }
            }
            return 10; // Минимум для освещения
        }
        
        if ("outlet".equals(circuitType)) {
            // Розетки: стандарт 16А, запрещено 25А на бытовые розетки
            if (currentValue <= 16) {
                return 16;
            }
            // Если ток больше 16А, но не превышает 20А, можно использовать 20А
            // Но не 25А для бытовых розеток (они рассчитаны на 16А)
            double maxCableCurrent = getMaxCurrentForSection(cableSection);
            if (currentValue <= 20 && 20 <= maxCableCurrent) {
                return 20;
            }
            // Если требуется больше, это уже не бытовая розетка
            for (int rating : standardRatings) {
                if (rating >= currentValue * 1.25 && rating <= maxCableCurrent && rating != 25) {
                    return rating;
                }
            }
            return 16; // Стандарт для розеток
        }
        
        if ("stove".equals(circuitType)) {
            // Электроплиты: минимум 32А
            double maxCableCurrent = getMaxCurrentForSection(cableSection);
            for (int rating : standardRatings) {
                if (rating >= Math.max(currentValue * 1.25, 32) && rating <= maxCableCurrent) {
                    return rating;
                }
            }
            return 32; // Минимум для плит
        }
        
        // Общая логика для остальных случаев
        double maxCableCurrent = getMaxCurrentForSection(cableSection);
        
        for (int rating : standardRatings) {
            if (rating >= currentValue * 1.25 && rating <= maxCableCurrent) {
                return rating;
            }
        }
        
        // Если не подошел, возвращаем ближайший больший
        for (int rating : standardRatings) {
            if (rating >= currentValue) {
                return rating;
            }
        }
        
        return 50; // Максимальный стандартный номинал
    }
    
    /**
     * Получить максимальный ток для сечения кабеля
     * Поддерживает форматы: "2.5 мм²", "3x2.5 мм²"
     */
    private double getMaxCurrentForSection(String cableSection) {
        // Извлекаем сечение из строки (может быть "2.5 мм²" или "3x2.5 мм²")
        String sectionStr = cableSection.replace(" мм²", "").replaceAll(".*x", "");
        try {
            double section = Double.parseDouble(sectionStr);
            for (int i = 0; i < STANDARD_SECTIONS.length; i++) {
                if (Math.abs(STANDARD_SECTIONS[i] - section) < 0.1) {
                    return MAX_CURRENTS[i];
                }
            }
        } catch (NumberFormatException e) {
            // Игнорируем
        }
        return MAX_CURRENTS[0]; // По умолчанию
    }
    
    /**
     * Проверка требований ТКП 339-2022 и формирование предупреждений
     */
    private List<String> checkTKP339Requirements(
            Room room, 
            List<ProjectAppliance> appliances, 
            BigDecimal totalPower,
            BigDecimal totalCurrent) {
        
        List<String> warnings = new ArrayList<>();
        
        // Проверка 1: Мощность электроотопления и водоснабжения > 5 кВт (п. 8.6.4)
        BigDecimal heatingPower = BigDecimal.ZERO;
        for (ProjectAppliance pa : appliances) {
            Appliance appliance = pa.getAppliance();
            if (appliance != null) {
                String applianceName = appliance.getName().toLowerCase();
                if (applianceName.contains("нагревател") || 
                    applianceName.contains("бойлер") ||
                    applianceName.contains("отоплен") ||
                    applianceName.contains("теплый пол")) {
                    BigDecimal power = pa.getTotalPower() != null ? pa.getTotalPower() : BigDecimal.ZERO;
                    heatingPower = heatingPower.add(power);
                }
            }
        }
        
        if (heatingPower.compareTo(HEATING_POWER_THRESHOLD) > 0) {
            warnings.add(String.format(
                "ТКП 339-2022 п. 8.6.4: Суммарная мощность электроотопления и водоснабжения (%.2f кВт) превышает 5 кВт. Требуется отдельный расчетный учет или отдельная линия.",
                heatingPower.divide(BigDecimal.valueOf(1000), 2, RoundingMode.HALF_UP).doubleValue()
            ));
        }
        
        // Проверка 2: Ванная комната - требования к розеткам (п. 8.5.5-8.5.6)
        if (room.getRoomType() != null) {
            String roomTypeName = room.getRoomType().getName().toLowerCase();
            if (roomTypeName.contains("ванн") || roomTypeName.contains("душ")) {
                warnings.add("ТКП 339-2022 п. 8.5.5-8.5.6: В ванных комнатах (зоны 0, 1, 2) установка розеток запрещена. В зоне 3 (дальше 60 см от края ванны/душа) допускается установка розеток с защитой IP44 и выше и обязательным УЗО 30мА (предпочтительно 10мА).");
            }
        }
        
        // Проверка 3: Минимальное сечение 1.5 мм²
        if (totalCurrent.doubleValue() > 0 && totalCurrent.doubleValue() < 10) {
            warnings.add("ТКП 339-2022 п. 8.4.4: Минимальное сечение медного кабеля для силовых и осветительных цепей - 1.5 мм².");
        }
        
        // Проверка 4: Рекомендация по УЗО для влажных помещений
        if (room.getRoomType() != null) {
            String roomTypeName = room.getRoomType().getName().toLowerCase();
            if (roomTypeName.contains("ванн") || roomTypeName.contains("душ")) {
                warnings.add("ТКП 339-2022 п. 8.7.4: Для ванных и душевых рекомендуется УЗО с током срабатывания не более 30 мА (предпочтительно 10 мА).");
            }
        }
        
        return warnings;
    }
}

