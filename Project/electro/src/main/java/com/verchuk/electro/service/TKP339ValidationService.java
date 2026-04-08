package com.verchuk.electro.service;

import com.verchuk.electro.model.Project;
import com.verchuk.electro.model.Room;
import com.verchuk.electro.model.RoomType;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * Сервис для валидации требований ТКП 339-2022
 */
@Service
public class TKP339ValidationService {

    /**
     * Валидация системы заземления (п. 8.2.1)
     * Для жилых зданий не допускается TN-C внутри здания
     */
    public ValidationResult validateGroundingSystem(String groundingSystem, String projectType) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (groundingSystem == null || groundingSystem.isEmpty()) {
            return new ValidationResult(true, errors, warnings);
        }

        if (projectType != null && (projectType.contains("apartment") || projectType.contains("house") || projectType.contains("dacha"))) {
            if ("TN-C".equals(groundingSystem)) {
                errors.add("ТКП 339-2022 п. 8.2.1: Система заземления TN-C не допускается внутри жилого здания. Разрешены только TN-S или TN-C-S.");
            }
        }

        return new ValidationResult(errors.isEmpty(), errors, warnings);
    }

    /**
     * Валидация напряжения сети (п. 8.2.1)
     * Для жилых зданий стандартное напряжение: 230В (однофазное) или 400В (трехфазное)
     */
    public ValidationResult validateInputVoltage(Integer inputVoltage, Integer inputPhaseCount) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (inputVoltage == null || inputPhaseCount == null) {
            return new ValidationResult(true, errors, warnings);
        }

        if (inputPhaseCount == 1 && inputVoltage != 230) {
            errors.add("ТКП 339-2022 п. 8.2.1: Для однофазной сети должно быть указано напряжение 230 В.");
        }

        if (inputPhaseCount == 3 && inputVoltage != 400) {
            errors.add("ТКП 339-2022 п. 8.2.1: Для трехфазной сети должно быть указано напряжение 400 В.");
        }

        return new ValidationResult(errors.isEmpty(), errors, warnings);
    }

    /**
     * Валидация сечения PEN-проводника на вводе (п. 8.4.14)
     * Для трехфазного ввода: минимум 10 мм² (медь) или 16 мм² (алюминий)
     */
    public ValidationResult validatePENConductorSection(BigDecimal penSection, Integer inputPhaseCount, String conductorMaterial) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (penSection == null || inputPhaseCount == null || inputPhaseCount != 3) {
            return new ValidationResult(true, errors, warnings);
        }

        if ("медь".equalsIgnoreCase(conductorMaterial) || "copper".equalsIgnoreCase(conductorMaterial) || conductorMaterial == null) {
            if (penSection.compareTo(BigDecimal.valueOf(10)) < 0) {
                errors.add("ТКП 339-2022 п. 8.4.14: Сечение PEN-проводника для трехфазного ввода должно быть не менее 10 мм² (медь).");
            }
        } else if ("алюминий".equalsIgnoreCase(conductorMaterial) || "aluminum".equalsIgnoreCase(conductorMaterial)) {
            if (penSection.compareTo(BigDecimal.valueOf(16)) < 0) {
                errors.add("ТКП 339-2022 п. 8.4.14: Сечение PEN-проводника для трехфазного ввода должно быть не менее 16 мм² (алюминий).");
            }
        }

        return new ValidationResult(errors.isEmpty(), errors, warnings);
    }

    /**
     * Валидация материала жил для внутренней проводки (п. 8.4.4)
     * Если сечение < 16 мм², материал должен быть только медь
     */
    public ValidationResult validateConductorMaterial(BigDecimal section, String material, String circuitType) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (section == null || material == null) {
            return new ValidationResult(true, errors, warnings);
        }

        boolean isAluminum = "алюминий".equalsIgnoreCase(material) || "aluminum".equalsIgnoreCase(material);
        boolean isGroupCircuit = "outlet".equals(circuitType) || "light".equals(circuitType);

        if (isGroupCircuit && isAluminum && section.compareTo(BigDecimal.valueOf(16)) < 0) {
            errors.add("ТКП 339-2022 п. 8.4.4: Для групповых сетей внутри жилых помещений при сечении менее 16 мм² материал жил должен быть только медь. Алюминий допускается только для сечений 16 мм² и выше.");
        }

        return new ValidationResult(errors.isEmpty(), errors, warnings);
    }

    /**
     * Расчет сечения заземляющего проводника PE (п. 8.4.14)
     */
    public BigDecimal calculatePESection(BigDecimal phaseSection) {
        if (phaseSection == null) {
            return BigDecimal.valueOf(2.5); // Минимум по умолчанию
        }

        if (phaseSection.compareTo(BigDecimal.valueOf(16)) <= 0) {
            return phaseSection; // PE = S
        } else if (phaseSection.compareTo(BigDecimal.valueOf(35)) <= 0) {
            return BigDecimal.valueOf(16); // PE = 16 мм²
        } else {
            return phaseSection.divide(BigDecimal.valueOf(2), 2, RoundingMode.UP); // PE >= S/2
        }
    }

    /**
     * Валидация запрещенных помещений для розеток и выключателей (п. 8.5.10, 8.5.6)
     */
    public ValidationResult validateProhibitedRoomsForSockets(String roomTypeName, String pointType) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (roomTypeName == null || pointType == null) {
            return new ValidationResult(true, errors, warnings);
        }

        String roomNameLower = roomTypeName.toLowerCase();
        boolean isProhibited = roomNameLower.contains("саун") || 
                              roomNameLower.contains("парилк") ||
                              roomNameLower.contains("моечн") ||
                              (roomNameLower.contains("стиральн") && roomNameLower.contains("прачечн"));

        if (isProhibited && ("outlet".equals(pointType) || "switch".equals(pointType))) {
            errors.add("ТКП 339-2022 п. 8.5.10, 8.5.6: Запрещено размещать выключатели и розетки внутри саун (парилок), моечных помещений бань, стиральных помещений прачечных.");
        }

        return new ValidationResult(errors.isEmpty(), errors, warnings);
    }

    /**
     * Валидация расстояния до газопровода (п. 8.5.7)
     * Минимум 0.5 м от розетки/выключателя/щитка до газовой трубы
     */
    public ValidationResult validateDistanceToGasPipe(BigDecimal distance) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (distance == null) {
            return new ValidationResult(true, errors, warnings);
        }

        if (distance.compareTo(BigDecimal.valueOf(0.5)) < 0) {
            errors.add("ТКП 339-2022 п. 8.5.7: Расстояние от розетки/выключателя/щитка до газовой трубы должно быть не менее 0,5 м.");
        }

        return new ValidationResult(errors.isEmpty(), errors, warnings);
    }

    /**
     * Валидация высоты установки в детских учреждениях (п. 8.5.9)
     * Минимум 1.8 м от пола
     */
    public ValidationResult validateHeightForChildrenInstitutions(String projectType, BigDecimal height) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (projectType == null || height == null) {
            return new ValidationResult(true, errors, warnings);
        }

        boolean isChildrenInstitution = projectType != null && 
                                       (projectType.contains("детск") || 
                                        projectType.contains("школ") ||
                                        projectType.contains("kindergarten") ||
                                        projectType.contains("school"));

        if (isChildrenInstitution && height.compareTo(BigDecimal.valueOf(1.8)) < 0) {
            errors.add("ТКП 339-2022 п. 8.5.9: Высота установки розеток и выключателей в детских учреждениях должна быть не менее 1,8 м от пола.");
        }

        return new ValidationResult(errors.isEmpty(), errors, warnings);
    }

    /**
     * Валидация электропроводки на чердаках (п. 8.4.10)
     */
    public ValidationResult validateAtticWiring(String roomTypeName, String wiringType, String conductorMaterial) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (roomTypeName == null || wiringType == null) {
            return new ValidationResult(true, errors, warnings);
        }

        String roomNameLower = roomTypeName.toLowerCase();
        boolean isAttic = roomNameLower.contains("чердак") || roomNameLower.contains("attic");

        if (isAttic && "open".equalsIgnoreCase(wiringType)) {
            boolean isAluminum = "алюминий".equalsIgnoreCase(conductorMaterial) || "aluminum".equalsIgnoreCase(conductorMaterial);
            if (isAluminum) {
                warnings.add("ТКП 339-2022 п. 8.4.10: Проводка на чердаках должна быть в металлических трубах или защитных оболочках. Кабель с алюминиевой жилой допускается только в стальных трубах или скрыто в несгораемых стенах.");
            } else {
                warnings.add("ТКП 339-2022 п. 8.4.10: Для открытой проводки на чердаках рекомендуется использование металлических труб или защитных оболочек.");
            }
        }

        return new ValidationResult(true, errors, warnings);
    }

    /**
     * Валидация номинала УЗО относительно автомата (п. 8.7.8)
     * In_УЗО >= In_автомата
     */
    public ValidationResult validateRCDRatingAgainstBreaker(Integer rcdRating, Integer breakerRating) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (rcdRating == null || breakerRating == null) {
            return new ValidationResult(true, errors, warnings);
        }

        if (rcdRating < breakerRating) {
            errors.add("ТКП 339-2022 п. 8.7.8: Номинальный ток УЗО (" + rcdRating + " А) должен быть больше или равен номинальному току вышестоящего автомата (" + breakerRating + " А).");
        } else if (rcdRating.equals(breakerRating)) {
            warnings.add("ТКП 339-2022 п. 8.7.8: Рекомендуется выбирать номинал УЗО на ступень выше номинала автомата для обеспечения селективности.");
        }

        return new ValidationResult(errors.isEmpty(), errors, warnings);
    }

    /**
     * Валидация запрета УЗО в системах TN-C (п. 4.3.5.5)
     */
    public ValidationResult validateRCDInTNCSystem(String groundingSystem, boolean hasRCD) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (groundingSystem == null || !hasRCD) {
            return new ValidationResult(true, errors, warnings);
        }

        if ("TN-C".equals(groundingSystem) && hasRCD) {
            errors.add("ТКП 339-2022 п. 4.3.5.5: Применение УЗО запрещено в системах TN-C (приведет к ложным срабатываниям или отказу защиты).");
        }

        return new ValidationResult(errors.isEmpty(), errors, warnings);
    }

    /**
     * Валидация тока утечки для предотвращения ложных срабатываний (п. 8.7.14)
     * I_leak <= 0.33 * I_Δn
     */
    public ValidationResult validateLeakageCurrent(BigDecimal calculatedLeakage, Integer rcdRating) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (calculatedLeakage == null || rcdRating == null) {
            return new ValidationResult(true, errors, warnings);
        }

        BigDecimal maxAllowedLeakage = BigDecimal.valueOf(rcdRating).multiply(BigDecimal.valueOf(0.33));
        if (calculatedLeakage.compareTo(maxAllowedLeakage) > 0) {
            errors.add(String.format("ТКП 339-2022 п. 8.7.14: Суммарный расчетный ток утечки (%.2f мА) превышает 1/3 от номинального отключающего тока УЗО (%.2f мА). Возможны ложные срабатывания.", 
                    calculatedLeakage.doubleValue(), maxAllowedLeakage.doubleValue()));
        }

        return new ValidationResult(errors.isEmpty(), errors, warnings);
    }

    /**
     * Валидация класса точности счетчика (п. 8.6.2)
     * Для жилых домов класс точности должен быть не ниже 1.0
     */
    public ValidationResult validateMeterAccuracyClass(String projectType, Double accuracyClass) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (accuracyClass == null) {
            return new ValidationResult(true, errors, warnings);
        }

        if (accuracyClass > 1.0) {
            errors.add("ТКП 339-2022 п. 8.6.2: Для жилых домов класс точности счетчика активной энергии должен быть не ниже 1.0 (для электронных). Индукционные с классом 2.0 допускаются только для объектов до 3,5 кВт или временных.");
        }

        return new ValidationResult(errors.isEmpty(), errors, warnings);
    }

    /**
     * Результат валидации
     */
    public static class ValidationResult {
        private final boolean valid;
        private final List<String> errors;
        private final List<String> warnings;

        public ValidationResult(boolean valid, List<String> errors, List<String> warnings) {
            this.valid = valid;
            this.errors = errors;
            this.warnings = warnings;
        }

        public boolean isValid() {
            return valid;
        }

        public List<String> getErrors() {
            return errors;
        }

        public List<String> getWarnings() {
            return warnings;
        }
    }
}

