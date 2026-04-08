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
public class ManufacturerStatisticsResponse {
    private Long manufacturerId;
    private String manufacturerName;
    private Long usageCount;
    private BigDecimal totalPowerConsumption;
    private Integer projectsCount;
}
