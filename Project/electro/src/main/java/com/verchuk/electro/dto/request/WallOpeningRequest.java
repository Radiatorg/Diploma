package com.verchuk.electro.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class WallOpeningRequest {
    @NotNull(message = "Position is required")
    private BigDecimal position;

    @NotNull(message = "Width is required")
    private BigDecimal width;

    private BigDecimal height;
    private String openingType;
}

