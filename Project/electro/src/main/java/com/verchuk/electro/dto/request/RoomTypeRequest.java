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
public class RoomTypeRequest {
    @NotBlank(message = "Room type name is required")
    @Size(max = 100, message = "Room type name must not exceed 100 characters")
    private String name;

    @Size(max = 500, message = "Description must not exceed 500 characters")
    private String description;

    /**
     * Минимальный коэффициент мощности помещения.
     * Обязательное поле. Должно быть больше 0.
     */
    @NotNull(message = "Minimum coefficient is required")
    @DecimalMin(value = "0.0001", message = "Minimum coefficient must be greater than 0")
    private BigDecimal minCoefficient;

    /**
     * Максимальный коэффициент мощности помещения (опционально).
     * Если задан, должен быть больше или равен minCoefficient.
     * Если не задан, используется только minCoefficient.
     */
    @DecimalMin(value = "0.0001", message = "Maximum coefficient must be greater than 0")
    private BigDecimal maxCoefficient;
}

