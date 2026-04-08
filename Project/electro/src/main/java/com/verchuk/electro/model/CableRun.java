package com.verchuk.electro.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Entity
@Table(name = "cable_runs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CableRun {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "circuit_id")
    private Circuit circuit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cable_type_id")
    private CableType cableType;

    @Column(name = "length_m", nullable = false, precision = 10, scale = 2)
    private BigDecimal lengthM;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "installation_scope", nullable = false, length = 20)
    private InstallationScope installationScope = InstallationScope.PLANNED;

    @Column(name = "path_json", length = 4000)
    private String pathJson;

    @Column(length = 255)
    private String notes;
}
