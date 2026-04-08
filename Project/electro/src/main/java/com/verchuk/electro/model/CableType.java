package com.verchuk.electro.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Entity
@Table(name = "cable_types")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CableType {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, length = 40)
    private String material; // Cu, Al

    @Column(name = "cross_section_mm2", nullable = false, precision = 8, scale = 2)
    private BigDecimal crossSectionMm2;

    @Column(length = 120)
    private String manufacturer;

    @Column(name = "price_per_meter", precision = 12, scale = 2)
    private BigDecimal pricePerMeter;

    @Builder.Default
    @Column(nullable = false)
    private Boolean active = true;
}
