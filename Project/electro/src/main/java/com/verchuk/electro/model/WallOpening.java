package com.verchuk.electro.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Entity
@Table(name = "wall_openings")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WallOpening {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "wall_id", nullable = false)
    private Wall wall;

    @Column(name = "position", precision = 10, scale = 2, nullable = false)
    private BigDecimal position; // позиция от начала стены в см

    @Column(name = "width", precision = 10, scale = 2, nullable = false)
    private BigDecimal width; // ширина проема в см

    @Column(name = "height", precision = 10, scale = 2)
    private BigDecimal height; // высота проема в см

    @Column(name = "opening_type", length = 50)
    private String openingType; // "door", "window", "arch"
}

