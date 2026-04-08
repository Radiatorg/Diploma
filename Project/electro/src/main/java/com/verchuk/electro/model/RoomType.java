package com.verchuk.electro.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Entity
@Table(name = "room_types")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoomType {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Column(length = 500)
    private String description;

    /**
     * Коэффициент мощности помещения (минимальное значение).
     * Используется для расчета общей мощности электроприборов в помещении.
     * Формула: итоговая_мощность = сумма_мощностей_приборов * коэффициент
     * Если задан диапазон (minCoefficient и maxCoefficient), используется среднее значение.
     */
    @Column(name = "min_coefficient", precision = 10, scale = 4, nullable = false, 
            columnDefinition = "DECIMAL(10,4) NOT NULL DEFAULT 1.0000")
    private BigDecimal minCoefficient;

    /**
     * Коэффициент мощности помещения (максимальное значение).
     * Если не задан (null), используется только minCoefficient.
     * Если задан, используется среднее значение: (minCoefficient + maxCoefficient) / 2
     */
    @Column(name = "max_coefficient", precision = 10, scale = 4, 
            columnDefinition = "DECIMAL(10,4) DEFAULT NULL")
    private BigDecimal maxCoefficient;

    /**
     * Вычисляет эффективный коэффициент для использования в расчетах.
     * Если задан диапазон, возвращает среднее значение.
     * Иначе возвращает минимальное значение.
     * Если minCoefficient равен null (не должно происходить после инициализации), возвращает 1.0.
     */
    public BigDecimal getEffectiveCoefficient() {
        if (minCoefficient == null) {
            return BigDecimal.valueOf(1.0);
        }
        if (maxCoefficient != null && maxCoefficient.compareTo(minCoefficient) > 0) {
            return minCoefficient.add(maxCoefficient).divide(BigDecimal.valueOf(2), 4, java.math.RoundingMode.HALF_UP);
        }
        return minCoefficient;
    }
}

