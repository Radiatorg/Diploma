package com.verchuk.electro.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WallResponse {
    private Long id;
    private BigDecimal startX;
    private BigDecimal startY;
    private BigDecimal endX;
    private BigDecimal endY;
    private BigDecimal thickness;
    private String wallType;
    private Long roomId; // Для внутренних стен и перегородок внутри комнаты
    private List<WallOpeningResponse> openings;
}

