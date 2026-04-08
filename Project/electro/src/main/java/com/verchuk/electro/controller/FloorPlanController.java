package com.verchuk.electro.controller;

import com.verchuk.electro.dto.request.FloorPlanRequest;
import com.verchuk.electro.dto.response.ApiResponse;
import com.verchuk.electro.dto.response.FloorPlanResponse;
import com.verchuk.electro.service.FloorPlanService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/designer/projects/{projectId}/floor-plan")
public class FloorPlanController {
    @Autowired
    private FloorPlanService floorPlanService;

    @GetMapping
    public ResponseEntity<FloorPlanResponse> getFloorPlan(@PathVariable Long projectId) {
        return ResponseEntity.ok(floorPlanService.getFloorPlan(projectId));
    }

    @PostMapping
    public ResponseEntity<FloorPlanResponse> createOrUpdateFloorPlan(
            @PathVariable Long projectId,
            @Valid @RequestBody FloorPlanRequest request) {
        return ResponseEntity.ok(floorPlanService.createOrUpdateFloorPlan(projectId, request));
    }

    @PutMapping
    public ResponseEntity<FloorPlanResponse> updateFloorPlan(
            @PathVariable Long projectId,
            @Valid @RequestBody FloorPlanRequest request) {
        return ResponseEntity.ok(floorPlanService.createOrUpdateFloorPlan(projectId, request));
    }

    @DeleteMapping
    public ResponseEntity<ApiResponse> deleteFloorPlan(@PathVariable Long projectId) {
        floorPlanService.deleteFloorPlan(projectId);
        return ResponseEntity.ok(ApiResponse.success("Floor plan deleted successfully"));
    }
}

