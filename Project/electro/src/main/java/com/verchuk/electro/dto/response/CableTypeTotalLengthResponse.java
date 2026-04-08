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
public class CableTypeTotalLengthResponse {
    private Long cableTypeId;
    private String cableName;
    private BigDecimal crossSectionMm2;
    private BigDecimal totalLengthM;
}
