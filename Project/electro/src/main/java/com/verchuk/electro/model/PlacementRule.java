package com.verchuk.electro.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Entity
@Table(name = "placement_rules")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlacementRule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String type; // "outlet", "switch", "light"

    @Column(length = 1000)
    private String description;

    @Column(name = "min_distance_from_floor", precision = 5, scale = 2)
    private BigDecimal minDistanceFromFloor; // минимальное расстояние от пола в см

    @Column(name = "max_distance_from_floor", precision = 5, scale = 2)
    private BigDecimal maxDistanceFromFloor; // максимальное расстояние от пола в см

    @Column(name = "recommended_height", precision = 5, scale = 2)
    private BigDecimal recommendedHeight; // рекомендуемая высота в см

    @Column(name = "min_distance_from_door", precision = 5, scale = 2)
    private BigDecimal minDistanceFromDoor; // минимальное расстояние от двери в см

    @Column(name = "min_distance_between", precision = 5, scale = 2)
    private BigDecimal minDistanceBetween; // минимальное расстояние между элементами в см

    @Column(nullable = false)
    @Builder.Default
    private Boolean active = true;
}

