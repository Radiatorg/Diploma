package com.verchuk.electro.dto.request;

import com.verchuk.electro.model.InstallationScope;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CableRunRequest {
    private Long circuitId;
    private Long cableTypeId;

    @NotNull(message = "Cable run length is required")
    @DecimalMin(value = "0.01", message = "Cable run length must be positive")
    private BigDecimal lengthM;

    @NotNull(message = "Installation scope is required")
    private InstallationScope installationScope;

    @Size(max = 4000, message = "Path json is too long")
    private String pathJson;

    @Size(max = 255, message = "Notes are too long")
    private String notes;
}
