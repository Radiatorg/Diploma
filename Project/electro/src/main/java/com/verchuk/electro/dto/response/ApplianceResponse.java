package com.verchuk.electro.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApplianceResponse {
    private Long id;
    private String name;
    private String description;
    private BigDecimal powerConsumption;
    private BigDecimal voltage;
    private BigDecimal current;
    @Deprecated // Оставляем для обратной совместимости
    private String category;
    private List<CategoryResponse> categories; // Новое поле для множественных категорий
    private String imageUrl;
    private BigDecimal width; // ширина прибора в см
    private BigDecimal height; // высота прибора в см
    private BigDecimal price; // цена единицы оборудования
    private String model; // модель оборудования
    private String ipRating; // степень защиты IP
    private String color; // цвет оборудования
    private String cableBrand; // марка кабеля/провода
    private String cableCrossSection; // сечение кабеля
    private Boolean active;
    /** Изготовитель (производитель) */
    private ManufacturerSummaryResponse manufacturer;
}

