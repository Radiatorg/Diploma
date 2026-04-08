package com.verchuk.electro.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FloorPlanRequest {
    @NotNull(message = "Width is required")
    @DecimalMin(value = "100.0", message = "Width must be at least 100 cm")
    private BigDecimal width;

    @NotNull(message = "Height is required")
    @DecimalMin(value = "100.0", message = "Height must be at least 100 cm")
    private BigDecimal height;

    @DecimalMin(value = "0.1", message = "Scale must be positive")
    private BigDecimal scale;
}

