package com.verchuk.electro.model;

import jakarta.persistence.*;
import lombok.*;
import com.fasterxml.jackson.annotation.JsonIgnore;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "appliances")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString(exclude = "categories")
@EqualsAndHashCode(exclude = "categories")
public class Appliance {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 500)
    private String description;

    @Column(name = "power_consumption", precision = 10, scale = 2, nullable = false)
    private BigDecimal powerConsumption;

    @Column(name = "voltage", precision = 5, scale = 2)
    private BigDecimal voltage;

    @Column(name = "current", precision = 10, scale = 2)
    private BigDecimal current;

    @Column(name = "category", length = 50)
    @Deprecated
    private String category;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(name = "width", precision = 10, scale = 2)
    private BigDecimal width;

    @Column(name = "height", precision = 10, scale = 2)
    private BigDecimal height;

    @Column(nullable = false)
    @Builder.Default
    private Boolean active = true;

    @Column(name = "price", precision = 10, scale = 2)
    private BigDecimal price;

    @Column(name = "model", length = 100)
    private String model; // модель оборудования

    @Column(name = "ip_rating", length = 10)
    private String ipRating;

    @Column(name = "color", length = 50)
    private String color; // цвет оборудования

    @Column(name = "cable_brand", length = 100)
    private String cableBrand; // марка кабеля/провода (например, "ВВГ", "NYM")

    @Column(name = "cable_cross_section", length = 20)
    private String cableCrossSection; // сечение кабеля (например, "2.5 мм²", "1.5 мм²")

    /** Изготовитель (производитель) оборудования */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "manufacturer_id")
    private Manufacturer manufacturer;

    @ManyToMany(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinTable(
        name = "appliance_categories",
        joinColumns = @JoinColumn(name = "appliance_id"),
        inverseJoinColumns = @JoinColumn(name = "category_id")
    )
    @Builder.Default
    @JsonIgnore
    private Set<Category> categories = new HashSet<>();
}

