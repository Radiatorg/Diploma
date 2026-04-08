package com.verchuk.electro.controller;

import com.verchuk.electro.dto.request.CircuitRequest;
import com.verchuk.electro.dto.response.ApiResponse;
import com.verchuk.electro.dto.response.CircuitResponse;
import com.verchuk.electro.service.CircuitService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/designer/projects/{projectId}/circuits")
public class CircuitController {
    @Autowired
    private CircuitService circuitService;

    @GetMapping
    public ResponseEntity<List<CircuitResponse>> getCircuits(@PathVariable Long projectId) {
        return ResponseEntity.ok(circuitService.getCircuits(projectId));
    }

    @PostMapping
    public ResponseEntity<CircuitResponse> createCircuit(
            @PathVariable Long projectId,
            @Valid @RequestBody CircuitRequest request) {
        return ResponseEntity.ok(circuitService.createCircuit(projectId, request));
    }

    @PutMapping("/{circuitId}")
    public ResponseEntity<CircuitResponse> updateCircuit(
            @PathVariable Long projectId,
            @PathVariable Long circuitId,
            @Valid @RequestBody CircuitRequest request) {
        return ResponseEntity.ok(circuitService.updateCircuit(projectId, circuitId, request));
    }

    @DeleteMapping("/{circuitId}")
    public ResponseEntity<ApiResponse> deleteCircuit(
            @PathVariable Long projectId,
            @PathVariable Long circuitId) {
        circuitService.deleteCircuit(projectId, circuitId);
        return ResponseEntity.ok(ApiResponse.success("Circuit deleted successfully"));
    }
}
