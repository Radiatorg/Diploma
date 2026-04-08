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
public class CableTypeResponse {
    private Long id;
    private String name;
    private String material;
    private BigDecimal crossSectionMm2;
    private String manufacturer;
    private BigDecimal pricePerMeter;
    private Boolean active;
}
