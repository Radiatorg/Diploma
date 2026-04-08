package com.verchuk.electro.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Entity
@Table(name = "rooms")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Room {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "area", precision = 10, scale = 2)
    private BigDecimal area;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_type_id", nullable = false)
    private RoomType roomType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(length = 500)
    private String description;

    // Координаты для визуального отображения (полигон или прямоугольник)
    @Column(name = "position_x", precision = 10, scale = 2)
    private BigDecimal positionX; // X координата верхнего левого угла в см

    @Column(name = "position_y", precision = 10, scale = 2)
    private BigDecimal positionY; // Y координата верхнего левого угла в см

    @Column(name = "width", precision = 10, scale = 2)
    private BigDecimal width; // ширина в см

    @Column(name = "height", precision = 10, scale = 2)
    private BigDecimal height; // высота в см

    @Column(name = "polygon_points", length = 2000)
    private String polygonPoints; // JSON массив точек для полигона: [{"x": 100, "y": 200}, ...]

    @Column(name = "window_count")
    private Integer windowCount; // Количество окон в помещении

    @Column(name = "socket_groups")
    private Integer socketGroups; // Количество розеточных групп (для обратной совместимости)
    
    @Column(name = "sockets_per_group")
    private Integer socketsPerGroup; // Количество розеток в каждой группе (для обратной совместимости)
    
    @Column(name = "socket_groups_config", length = 2000)
    private String socketGroupsConfig; // JSON массив групп: [{"socketsCount": 2}, {"socketsCount": 3}, ...]

    @OneToMany(mappedBy = "room", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ElectricalPoint> electricalPoints;
}

