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
public class CableRunResponse {
    private Long id;
    private Long projectId;
    private Long circuitId;
    private String circuitName;
    private Long cableTypeId;
    private String cableTypeName;
    private BigDecimal lengthM;
    private InstallationScope installationScope;
    private String pathJson;
    private String notes;
}
