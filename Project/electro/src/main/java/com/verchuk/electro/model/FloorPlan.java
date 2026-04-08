package com.verchuk.electro.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Entity
@Table(name = "floor_plans")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FloorPlan {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false, unique = true)
    private Project project;

    @Column(nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal width = BigDecimal.valueOf(1000); // в см

    @Column(nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal height = BigDecimal.valueOf(800); // в см

    @Column(nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal scale = BigDecimal.valueOf(1.0); // масштаб (1 см = N пикселей)

    @OneToMany(mappedBy = "floorPlan", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Wall> walls;

    @OneToMany(mappedBy = "floorPlan", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ElectricalPoint> electricalPoints;
}

