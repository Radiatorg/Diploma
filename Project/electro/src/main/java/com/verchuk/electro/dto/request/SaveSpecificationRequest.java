package com.verchuk.electro.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SaveSpecificationRequest {
    @NotBlank(message = "Specification name is required")
    private String name;
    
    // projectId может быть передан в теле запроса или установлен из path variable
    @NotNull(message = "Project ID is required")
    private Long projectId;
}

