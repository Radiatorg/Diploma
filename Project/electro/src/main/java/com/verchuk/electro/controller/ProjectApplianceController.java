package com.verchuk.electro.controller;

import com.verchuk.electro.dto.request.ProjectApplianceRequest;
import com.verchuk.electro.dto.response.ApiResponse;
import com.verchuk.electro.dto.response.ProjectApplianceResponse;
import com.verchuk.electro.service.ProjectApplianceService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/designer/projects/{projectId}/appliances")
public class ProjectApplianceController {
    @Autowired
    private ProjectApplianceService projectApplianceService;

    @GetMapping
    public ResponseEntity<List<ProjectApplianceResponse>> getProjectAppliances(@PathVariable Long projectId) {
        return ResponseEntity.ok(projectApplianceService.getProjectAppliances(projectId));
    }

    @PostMapping
    public ResponseEntity<ProjectApplianceResponse> addProjectAppliance(@PathVariable Long projectId,
                                                                          @Valid @RequestBody ProjectApplianceRequest request) {
        return ResponseEntity.ok(projectApplianceService.addProjectAppliance(projectId, request));
    }

    @PutMapping("/{projectApplianceId}")
    public ResponseEntity<ProjectApplianceResponse> updateProjectAppliance(@PathVariable Long projectId,
                                                                           @PathVariable Long projectApplianceId,
                                                                           @Valid @RequestBody ProjectApplianceRequest request) {
        return ResponseEntity.ok(projectApplianceService.updateProjectAppliance(projectId, projectApplianceId, request));
    }

    @DeleteMapping("/{projectApplianceId}")
    public ResponseEntity<ApiResponse> deleteProjectAppliance(@PathVariable Long projectId,
                                                              @PathVariable Long projectApplianceId) {
        projectApplianceService.deleteProjectAppliance(projectId, projectApplianceId);
        return ResponseEntity.ok(ApiResponse.success("Project appliance deleted successfully"));
    }
}

