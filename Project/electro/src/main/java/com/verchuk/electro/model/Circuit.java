package com.verchuk.electro.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "circuits")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Circuit {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "breaker_rating_a")
    private Integer breakerRatingA;

    @Column(name = "rcd_rating_ma")
    private Integer rcdRatingMa;

    @Column(length = 20)
    private String phase;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "installation_scope", nullable = false, length = 20)
    private InstallationScope installationScope = InstallationScope.PLANNED;
}
