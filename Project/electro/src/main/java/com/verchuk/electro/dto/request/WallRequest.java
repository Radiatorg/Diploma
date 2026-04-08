package com.verchuk.electro.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class WallRequest {
    @NotNull(message = "Start X is required")
    private BigDecimal startX;

    @NotNull(message = "Start Y is required")
    private BigDecimal startY;

    @NotNull(message = "End X is required")
    private BigDecimal endX;

    @NotNull(message = "End Y is required")
    private BigDecimal endY;

    private BigDecimal thickness;
    private String wallType;
    private Long roomId; // Для внутренних стен и перегородок внутри комнаты
    private List<WallOpeningRequest> openings;
}

