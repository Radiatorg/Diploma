package com.verchuk.electro.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjectResponse {
    private Long id;
    private String name;
    private String description;
    private Long designerId;
    private String designerUsername;
    private List<RoomResponse> rooms;
    private List<ProjectApplianceResponse> appliances;
    private String groundingSystem;
    private Integer inputVoltage;
    private Integer inputPhaseCount;
    private java.math.BigDecimal penConductorSection;
    private java.math.BigDecimal totalArea;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

