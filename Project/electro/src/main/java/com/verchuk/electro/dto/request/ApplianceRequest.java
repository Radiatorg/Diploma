package com.verchuk.electro.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ApplianceRequest {
    @NotBlank(message = "Appliance name is required")
    @Size(max = 100, message = "Appliance name must not exceed 100 characters")
    private String name;

    @Size(max = 500, message = "Description must not exceed 500 characters")
    private String description;

    @NotNull(message = "Power consumption is required")
    @Positive(message = "Power consumption must be positive")
    private BigDecimal powerConsumption;

    @Positive(message = "Voltage must be positive")
    private BigDecimal voltage;

    @Positive(message = "Current must be positive")
    private BigDecimal current;

    @Size(max = 50, message = "Category must not exceed 50 characters")
    @Deprecated // Оставляем для обратной совместимости
    private String category;

    private List<Long> categoryIds; // Новое поле для множественных категорий
    
    private List<String> newCategoryNames; // Новые категории для создания

    @Size(max = 500, message = "Image URL must not exceed 500 characters")
    private String imageUrl;

    @Positive(message = "Width must be positive")
    private BigDecimal width; // ширина прибора в см

    @Positive(message = "Height must be positive")
    private BigDecimal height; // высота прибора в см

    @Positive(message = "Price must be positive")
    private BigDecimal price; // цена единицы оборудования в рублях

    @Size(max = 100, message = "Model must not exceed 100 characters")
    private String model; // модель оборудования

    @Size(max = 10, message = "IP rating must not exceed 10 characters")
    private String ipRating; // степень защиты IP (например, "IP54", "IP65")

    @Size(max = 50, message = "Color must not exceed 50 characters")
    private String color; // цвет оборудования

    @Size(max = 100, message = "Cable brand must not exceed 100 characters")
    private String cableBrand; // марка кабеля/провода (например, "ВВГ", "NYM")

    @Size(max = 20, message = "Cable cross section must not exceed 20 characters")
    private String cableCrossSection; // сечение кабеля (например, "2.5 мм²", "1.5 мм²")

    /** ID производителя (изготовителя); необязательно */
    private Long manufacturerId;
}

