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
public class RoomTypeResponse {
    private Long id;
    private String name;
    private String description;
    
    /**
     * Минимальный коэффициент мощности помещения
     */
    private BigDecimal minCoefficient;
    
    /**
     * Максимальный коэффициент мощности помещения (опционально)
     */
    private BigDecimal maxCoefficient;
    
    /**
     * Эффективный коэффициент для использования в расчетах
     * (среднее значение, если задан диапазон, иначе минимальное)
     */
    private BigDecimal effectiveCoefficient;
}

