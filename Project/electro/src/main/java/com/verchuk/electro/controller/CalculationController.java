package com.verchuk.electro.controller;

import com.verchuk.electro.dto.response.CalculationReportResponse;
import com.verchuk.electro.service.CalculationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/designer/projects/{projectId}/calculations")
public class CalculationController {
    @Autowired
    private CalculationService calculationService;

    @GetMapping
    public ResponseEntity<CalculationReportResponse> getCalculationReport(@PathVariable Long projectId) {
        return ResponseEntity.ok(calculationService.getCalculationReport(projectId));
    }
}

