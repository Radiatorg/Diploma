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
public class SpecificationResponse {
    private Long projectId;
    private String projectName;
    private List<EquipmentItemResponse> equipmentItems;
    private List<CircuitSummaryResponse> circuitSummaries;
    private BigDecimal totalEquipmentCost; // Общая стоимость оборудования
    private BigDecimal existingEquipmentCost; // Существующее оборудование
    private BigDecimal plannedEquipmentCost; // Планируемое оборудование
    private Integer existingItemsCount;
    private Integer plannedItemsCount;
    private String recommendations;
}

