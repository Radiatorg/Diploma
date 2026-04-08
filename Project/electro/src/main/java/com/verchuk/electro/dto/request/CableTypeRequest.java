package com.verchuk.electro.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CableTypeRequest {
    @NotBlank(message = "Cable type name is required")
    @Size(max = 120, message = "Cable type name is too long")
    private String name;

    @NotBlank(message = "Cable material is required")
    @Size(max = 40, message = "Material is too long")
    private String material;

    @NotNull(message = "Cable cross section is required")
    @DecimalMin(value = "0.01", message = "Cable cross section must be positive")
    private BigDecimal crossSectionMm2;

    @Size(max = 120, message = "Manufacturer is too long")
    private String manufacturer;

    @DecimalMin(value = "0.00", message = "Price per meter must be >= 0")
    private BigDecimal pricePerMeter;

    private Boolean active;
}
