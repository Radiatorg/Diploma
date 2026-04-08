package com.verchuk.electro.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "manufacturers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Manufacturer {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    private Long id;

    @Column(nullable = false, length = 150, unique = true)
    private String name;

    @Column(name = "legal_name", length = 200)
    private String legalName;

    @Column(length = 4000)
    private String description;

    @Column(name = "logo_url", length = 500)
    private String logoUrl;

    @Column(length = 255)
    private String email;

    @Column(name = "website_url", length = 500)
    private String websiteUrl;

    @Column(name = "social_vk", length = 500)
    private String socialVk;

    @Column(name = "social_telegram", length = 500)
    private String socialTelegram;

    @Column(name = "social_youtube", length = 500)
    private String socialYoutube;

    @Column(name = "social_instagram", length = 500)
    private String socialInstagram;

    @Column(nullable = false)
    @Builder.Default
    private Boolean active = true;
}
