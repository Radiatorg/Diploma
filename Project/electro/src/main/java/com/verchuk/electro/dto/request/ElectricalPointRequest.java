package com.verchuk.electro.dto.request;

import com.verchuk.electro.model.InstallationScope;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ElectricalPointRequest {
    // Если не указан, будет выбран автоматически на основе ТКП 339
    private Long electricalSymbolId;

    private Long applianceId; // ID прибора из project_appliances

    private Long roomId;

    @NotNull(message = "Position X is required")
    private BigDecimal positionX;

    @NotNull(message = "Position Y is required")
    private BigDecimal positionY;

    @DecimalMin(value = "0.00", message = "Rated power must be >= 0")
    private BigDecimal ratedPowerW;

    private BigDecimal heightFromFloor;
    private BigDecimal rotation;

    private Long circuitId;
    private Long cableTypeId;

    private InstallationScope installationScope;

    @Size(max = 100, message = "Group is too long")
    private String group;

    @Size(max = 500, message = "Notes are too long")
    private String notes;
    
    // Параметры для автоматического выбора символа (если electricalSymbolId не указан)
    private String symbolType; // "outlet", "switch", "light"
    private BigDecimal powerConsumption; // Мощность в Вт (для розеток и светильников)
    private BigDecimal distanceFromBath; // Расстояние от ванны в см (для ванных комнат)
}

