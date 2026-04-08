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
public class RoomResponse {
    private Long id;
    private String name;
    private BigDecimal area;
    private Long roomTypeId;
    private String roomTypeName;
    private String description;
    private BigDecimal positionX;
    private BigDecimal positionY;
    private BigDecimal width;
    private BigDecimal height;
    private String polygonPoints;
    private Integer windowCount; // Количество окон в помещении
    private Integer socketGroups; // Количество розеточных групп (для обратной совместимости)
    private Integer socketsPerGroup; // Количество розеток в каждой группе (для обратной совместимости)
    private String socketGroupsConfig; // JSON массив групп: [{"socketsCount": 2}, {"socketsCount": 3}, ...]
}

