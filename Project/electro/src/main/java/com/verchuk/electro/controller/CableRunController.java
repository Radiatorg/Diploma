package com.verchuk.electro.controller;

import com.verchuk.electro.dto.request.CableRunRequest;
import com.verchuk.electro.dto.response.ApiResponse;
import com.verchuk.electro.dto.response.CableRunResponse;
import com.verchuk.electro.service.CableRunService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/designer/projects/{projectId}/cable-runs")
public class CableRunController {
    @Autowired
    private CableRunService cableRunService;

    @GetMapping
    public ResponseEntity<List<CableRunResponse>> getCableRuns(@PathVariable Long projectId) {
        return ResponseEntity.ok(cableRunService.getCableRuns(projectId));
    }

    @PostMapping
    public ResponseEntity<CableRunResponse> createCableRun(
            @PathVariable Long projectId,
            @Valid @RequestBody CableRunRequest request) {
        return ResponseEntity.ok(cableRunService.createCableRun(projectId, request));
    }

    @PutMapping("/{cableRunId}")
    public ResponseEntity<CableRunResponse> updateCableRun(
            @PathVariable Long projectId,
            @PathVariable Long cableRunId,
            @Valid @RequestBody CableRunRequest request) {
        return ResponseEntity.ok(cableRunService.updateCableRun(projectId, cableRunId, request));
    }

    @DeleteMapping("/{cableRunId}")
    public ResponseEntity<ApiResponse> deleteCableRun(
            @PathVariable Long projectId,
            @PathVariable Long cableRunId) {
        cableRunService.deleteCableRun(projectId, cableRunId);
        return ResponseEntity.ok(ApiResponse.success("Cable run deleted successfully"));
    }
}
