package com.verchuk.electro.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectRequest {
    @NotBlank(message = "Project name is required")
    @Size(max = 100, message = "Project name must not exceed 100 characters")
    private String name;

    @Size(max = 1000, message = "Description must not exceed 1000 characters")
    private String description;

    private String groundingSystem; // TN-S, TN-C-S, TN-C

    private Integer inputVoltage; // 230 или 400

    private Integer inputPhaseCount; // 1 или 3

    private java.math.BigDecimal penConductorSection; // Сечение PEN-проводника в мм²

    private java.math.BigDecimal totalArea; // Общая площадь проекта в м²
}

