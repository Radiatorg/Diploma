package com.verchuk.electro.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Сохраненная спецификация для сравнения
 */
@Entity
@Table(name = "saved_specifications")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SavedSpecification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(nullable = false, length = 200)
    private String name; // Название сохраненной спецификации

    @Column(name = "specification_data", columnDefinition = "TEXT")
    private String specificationData; // JSON данные спецификации

    @Column(name = "calculation_data", columnDefinition = "TEXT")
    private String calculationData; // JSON данные расчетной ведомости

    @Column(name = "project_snapshot_data", columnDefinition = "TEXT")
    private String projectSnapshotData; // JSON snapshot всего проекта (комнаты, приборы, точки, стены)

    @Column(name = "total_cost", precision = 10, scale = 2)
    private java.math.BigDecimal totalCost;

    @Column(name = "total_power", precision = 10, scale = 2)
    private java.math.BigDecimal totalPower;

    @Column(name = "total_current", precision = 10, scale = 2)
    private java.math.BigDecimal totalCurrent;

    @Column(name = "cable_section", length = 50)
    private String cableSection;

    @Column(name = "rcd_rating")
    private Integer rcdRating;

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

