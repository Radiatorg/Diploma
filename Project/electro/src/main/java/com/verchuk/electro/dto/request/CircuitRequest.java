package com.verchuk.electro.dto.request;

import com.verchuk.electro.model.InstallationScope;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CircuitRequest {
    @NotBlank(message = "Circuit name is required")
    @Size(max = 120, message = "Circuit name is too long")
    private String name;

    @Min(value = 1, message = "Breaker rating must be at least 1A")
    @Max(value = 125, message = "Breaker rating must be <= 125A")
    private Integer breakerRatingA;

    @Min(value = 10, message = "RCD rating must be at least 10mA")
    @Max(value = 500, message = "RCD rating must be <= 500mA")
    private Integer rcdRatingMa;

    @Size(max = 20, message = "Phase value is too long")
    private String phase;

    @NotNull(message = "Installation scope is required")
    private InstallationScope installationScope;
}
