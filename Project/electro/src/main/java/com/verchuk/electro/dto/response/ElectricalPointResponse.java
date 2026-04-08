package com.verchuk.electro.dto.response;

import com.verchuk.electro.model.InstallationScope;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ElectricalPointResponse {
    private Long id;
    private Long applianceId;
    private Long roomId;
    private String roomName;
    private ElectricalSymbolResponse electricalSymbol;
    private BigDecimal positionX;
    private BigDecimal positionY;
    private BigDecimal ratedPowerW;
    private BigDecimal heightFromFloor;
    private BigDecimal rotation;
    private Long circuitId;
    private String circuitName;
    private Long cableTypeId;
    private String cableTypeName;
    private InstallationScope installationScope;
    private String group;
    private String notes;
}

