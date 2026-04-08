package com.verchuk.electro.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ManufacturerResponse {
    private Long id;
    private String name;
    private String legalName;
    private String description;
    private String logoUrl;
    private String email;
    private String websiteUrl;
    private String socialVk;
    private String socialTelegram;
    private String socialYoutube;
    private String socialInstagram;
    private Boolean active;
}
