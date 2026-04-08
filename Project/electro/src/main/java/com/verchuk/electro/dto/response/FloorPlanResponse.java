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
public class FloorPlanResponse {
    private Long id;
    private Long projectId;
    private BigDecimal width;
    private BigDecimal height;
    private BigDecimal scale;
    private List<WallResponse> walls;
    private List<ElectricalPointResponse> electricalPoints;
}

