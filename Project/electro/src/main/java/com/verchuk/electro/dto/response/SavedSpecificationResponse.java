package com.verchuk.electro.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SavedSpecificationResponse {
    private Long id;
    private Long projectId;
    private String name;
    private BigDecimal totalCost;
    private BigDecimal totalPower;
    private BigDecimal totalCurrent;
    private String cableSection;
    private Integer rcdRating;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Полные данные для просмотра и сравнения
    private SpecificationResponse specification; // Полная смета со всеми позициями
    private CalculationReportResponse calculation; // Полная расчетная ведомость со всеми данными
    private ProjectSnapshotResponse projectSnapshot; // Снимок 3D-сцены (комнаты, стены, точки, трассы)
}

