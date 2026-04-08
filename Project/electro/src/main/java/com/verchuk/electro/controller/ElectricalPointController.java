package com.verchuk.electro.controller;

import com.verchuk.electro.dto.request.ElectricalPointRequest;
import com.verchuk.electro.dto.response.ApiResponse;
import com.verchuk.electro.dto.response.ElectricalPointResponse;
import com.verchuk.electro.service.ElectricalPointService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/designer/projects/{projectId}/electrical-points")
public class ElectricalPointController {
    @Autowired
    private ElectricalPointService electricalPointService;

    @GetMapping
    public ResponseEntity<List<ElectricalPointResponse>> getElectricalPoints(@PathVariable Long projectId) {
        var floorPlan = electricalPointService.getFloorPlanForProject(projectId);
        return ResponseEntity.ok(electricalPointService.getElectricalPointsByFloorPlan(floorPlan.getId()));
    }

    @PostMapping
    public ResponseEntity<ElectricalPointResponse> createElectricalPoint(
            @PathVariable Long projectId,
            @Valid @RequestBody ElectricalPointRequest request) {
        return ResponseEntity.ok(electricalPointService.createElectricalPoint(projectId, request));
    }

    @PostMapping("/batch")
    public ResponseEntity<List<ElectricalPointResponse>> saveElectricalPoints(
            @PathVariable Long projectId,
            @Valid @RequestBody List<ElectricalPointRequest> requests) {
        return ResponseEntity.ok(electricalPointService.saveElectricalPoints(projectId, requests));
    }

    @PutMapping("/{pointId}")
    public ResponseEntity<ElectricalPointResponse> updateElectricalPoint(
            @PathVariable Long projectId,
            @PathVariable Long pointId,
            @Valid @RequestBody ElectricalPointRequest request) {
        return ResponseEntity.ok(electricalPointService.updateElectricalPoint(projectId, pointId, request));
    }

    @DeleteMapping("/{pointId}")
    public ResponseEntity<ApiResponse> deleteElectricalPoint(
            @PathVariable Long projectId,
            @PathVariable Long pointId) {
        electricalPointService.deleteElectricalPoint(projectId, pointId);
        return ResponseEntity.ok(ApiResponse.success("Electrical point deleted successfully"));
    }
}

