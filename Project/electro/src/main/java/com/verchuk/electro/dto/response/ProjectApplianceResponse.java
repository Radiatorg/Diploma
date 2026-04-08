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
public class ProjectApplianceResponse {
    private Long id;
    private Long applianceId;
    private String applianceName;
    private Long roomId;
    private String roomName;
    private Integer quantity;
    private BigDecimal totalPower;
}

