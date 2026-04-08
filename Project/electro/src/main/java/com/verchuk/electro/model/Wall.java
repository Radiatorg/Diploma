package com.verchuk.electro.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Entity
@Table(name = "walls")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Wall {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "floor_plan_id", nullable = false)
    private FloorPlan floorPlan;

    @Column(name = "start_x", nullable = false, precision = 10, scale = 2)
    private BigDecimal startX;

    @Column(name = "start_y", nullable = false, precision = 10, scale = 2)
    private BigDecimal startY;

    @Column(name = "end_x", nullable = false, precision = 10, scale = 2)
    private BigDecimal endX;

    @Column(name = "end_y", nullable = false, precision = 10, scale = 2)
    private BigDecimal endY;

    @Column(name = "thickness", precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal thickness = BigDecimal.valueOf(20); // толщина стены в см

    @Column(name = "wall_type", length = 50)
    private String wallType; // "external", "internal", "load_bearing", "partition"

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id")
    private Room room; // Для внутренних стен и перегородок внутри комнаты

    @OneToMany(mappedBy = "wall", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<WallOpening> openings;
}

