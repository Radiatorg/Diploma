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
public class RoomCalculationResponse {
    private Long roomId;
    private String roomName;
    private BigDecimal totalPower;
    private BigDecimal area;
    private BigDecimal coefficient;
    private Integer applianceCount;
    private BigDecimal totalCableLengthM;
    private List<RoomCableTypeLengthResponse> cableByType;
    private String cableLengthSourceNote;
}

