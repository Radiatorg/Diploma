package com.verchuk.electro.dto.response;

import com.verchuk.electro.model.InstallationScope;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CircuitResponse {
    private Long id;
    private Long projectId;
    private String name;
    private Integer breakerRatingA;
    private Integer rcdRatingMa;
    private String phase;
    private InstallationScope installationScope;
}
