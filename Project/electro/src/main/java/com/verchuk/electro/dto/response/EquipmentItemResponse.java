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
public class EquipmentItemResponse {
    private String category;
    private String name;
    private String specification; // Технические характеристики
    private Integer quantity; // Количество
    private String unit; // Единица измерения: "шт", "м", "комплект"
    private BigDecimal unitPrice; // Цена за единицу
    private BigDecimal totalPrice; // Общая стоимость (unitPrice * quantity)
    private String model; // Модель
    private String ipRating; // Степень защиты IP
    private String color; // Цвет
    private String cableBrand; // Марка кабеля
    private String cableCrossSection; // Сечение кабеля
    private BigDecimal cableLength; // Длина кабеля (в метрах)
    private String notes;
}

