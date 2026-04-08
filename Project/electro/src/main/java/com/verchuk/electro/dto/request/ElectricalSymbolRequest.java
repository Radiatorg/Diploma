package com.verchuk.electro.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ElectricalSymbolRequest {
    @NotBlank(message = "Name is required")
    private String name;

    private String svgPath;

    @NotBlank(message = "Type is required")
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

