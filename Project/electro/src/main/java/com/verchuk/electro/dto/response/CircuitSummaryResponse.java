package com.verchuk.electro.dto.response;

import com.verchuk.electro.model.InstallationScope;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CircuitSummaryResponse {
    private Long circuitId;
    private String circuitName;
    private InstallationScope installationScope;
    private Integer pointsCount;
    private BigDecimal cableLengthM;
    private BigDecimal cableCost;
}
