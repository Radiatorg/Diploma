package com.verchuk.electro.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ElectricalSymbolResponse {
    private Long id;
    private String name;
    private String svgPath;
    private String type;
    private String category;
    private Double defaultWidth;
    private Double defaultHeight;
    private BigDecimal price;
    private String model;
    private String ipRating;
    private String color;
    private Boolean active;
}

