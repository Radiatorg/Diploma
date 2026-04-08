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
public class WallOpeningResponse {
    private Long id;
    private BigDecimal position;
    private BigDecimal width;
    private BigDecimal height;
    private String openingType;
}

