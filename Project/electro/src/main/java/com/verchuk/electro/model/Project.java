package com.verchuk.electro.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "projects")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Project {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 1000)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "designer_id", nullable = false)
    private User designer;

    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Room> rooms;

    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ProjectAppliance> projectAppliances;

    @Column(name = "grounding_system", length = 20)
    private String groundingSystem; // TN-S, TN-C-S, TN-C

    @Column(name = "input_voltage")
    private Integer inputVoltage; // 230 (однофазное) или 400 (трехфазное)

    @Column(name = "input_phase_count")
    private Integer inputPhaseCount; // 1 или 3

    @Column(name = "pen_conductor_section", precision = 5, scale = 2)
    private java.math.BigDecimal penConductorSection; // Сечение PEN-проводника в мм²

    @Column(name = "total_area", precision = 10, scale = 2)
    private java.math.BigDecimal totalArea; // Общая площадь проекта в м²

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

