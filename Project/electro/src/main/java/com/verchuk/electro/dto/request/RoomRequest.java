package com.verchuk.electro.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RoomRequest {
    @NotBlank(message = "Room name is required")
    @Size(max = 100, message = "Room name must not exceed 100 characters")
    private String name;

    @NotNull(message = "Room type ID is required")
    private Long roomTypeId;

    @Positive(message = "Area must be positive")
    private BigDecimal area;

    @Size(max = 500, message = "Description must not exceed 500 characters")
    private String description;

    // Координаты для визуального отображения
    private BigDecimal positionX;
    private BigDecimal positionY;
    private BigDecimal width;
    private BigDecimal height;
    private String polygonPoints; // JSON массив точек для полигона
    
    private Integer windowCount; // Количество окон в помещении

    private Integer maxOutlets;
    private Integer maxSwitches;
    private Integer maxDoors;
    private Integer maxWindows;
    private Integer maxLights;

    @Positive(message = "Socket groups must be positive")
    private Integer socketGroups; // Количество розеточных групп (для обратной совместимости)
    
    @Positive(message = "Sockets per group must be positive")
    private Integer socketsPerGroup; // Количество розеток в каждой группе (для обратной совместимости)
    
    private String socketGroupsConfig; // JSON массив групп: [{"socketsCount": 2}, {"socketsCount": 3}, ...]
}

