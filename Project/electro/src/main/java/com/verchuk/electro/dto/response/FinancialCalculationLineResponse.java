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
public class FinancialCalculationLineResponse {
    private String title;
    private String calculationNote;
    private BigDecimal amountByn;
    private BigDecimal amountHours;
    private int indent;
}
