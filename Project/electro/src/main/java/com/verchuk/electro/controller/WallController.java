package com.verchuk.electro.controller;

import com.verchuk.electro.dto.request.WallRequest;
import com.verchuk.electro.dto.response.ApiResponse;
import com.verchuk.electro.dto.response.WallResponse;
import com.verchuk.electro.service.WallService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/designer/projects/{projectId}/walls")
public class WallController {
    @Autowired
    private WallService wallService;

    @GetMapping
    public ResponseEntity<List<WallResponse>> getWalls(@PathVariable Long projectId) {
        var floorPlan = wallService.getFloorPlanForProject(projectId);
        return ResponseEntity.ok(wallService.getWallsByFloorPlan(floorPlan.getId()));
    }

    @PostMapping
    public ResponseEntity<WallResponse> createWall(
            @PathVariable Long projectId,
            @Valid @RequestBody WallRequest request) {
        return ResponseEntity.ok(wallService.createWall(projectId, request));
    }

    @PostMapping("/batch")
    public ResponseEntity<List<WallResponse>> saveWalls(
            @PathVariable Long projectId,
            @Valid @RequestBody List<WallRequest> requests) {
        return ResponseEntity.ok(wallService.saveWalls(projectId, requests));
    }

    @PutMapping("/{wallId}")
    public ResponseEntity<WallResponse> updateWall(
            @PathVariable Long projectId,
            @PathVariable Long wallId,
            @Valid @RequestBody WallRequest request) {
        return ResponseEntity.ok(wallService.updateWall(projectId, wallId, request));
    }

    @DeleteMapping("/{wallId}")
    public ResponseEntity<ApiResponse> deleteWall(
            @PathVariable Long projectId,
            @PathVariable Long wallId) {
        wallService.deleteWall(projectId, wallId);
        return ResponseEntity.ok(ApiResponse.success("Wall deleted successfully"));
    }
}

