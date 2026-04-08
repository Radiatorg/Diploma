package com.verchuk.electro.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlacementRuleResponse {
    private Long id;
    private String type;
    private String description;
    private BigDecimal minDistanceFromFloor;
    private BigDecimal maxDistanceFromFloor;
    private BigDecimal recommendedHeight;
    private BigDecimal minDistanceFromDoor;
    private BigDecimal minDistanceBetween;
    private Boolean active;
}

