package com.verchuk.electro.controller;

import com.verchuk.electro.dto.request.SaveSpecificationRequest;
import com.verchuk.electro.dto.response.ApiResponse;
import com.verchuk.electro.dto.response.SavedSpecificationResponse;
import com.verchuk.electro.service.SavedSpecificationService;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/designer/projects/{projectId}/saved-specifications")
public class SavedSpecificationController {
    @Autowired
    private SavedSpecificationService savedSpecificationService;
    
    @Autowired
    private Validator validator;

    @PostMapping
    public ResponseEntity<?> saveSpecification(
            @PathVariable Long projectId,
            @RequestBody SaveSpecificationRequest request) {
        try {
            // Устанавливаем projectId из path variable (приоритет над телом запроса)
            request.setProjectId(projectId);
            
            // Валидируем запрос
            if (request.getName() == null || request.getName().trim().isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Specification name is required"));
            }
            
            if (request.getProjectId() == null) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Project ID is required"));
            }
            
            return ResponseEntity.ok(savedSpecificationService.saveSpecification(request));
        } catch (com.verchuk.electro.exception.ResourceNotFoundException e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to save specification: " + e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<List<SavedSpecificationResponse>> getSavedSpecifications(
            @PathVariable Long projectId) {
        return ResponseEntity.ok(savedSpecificationService.getSavedSpecifications(projectId));
    }

    @GetMapping("/{specificationId}")
    public ResponseEntity<SavedSpecificationResponse> getSavedSpecification(
            @PathVariable Long projectId,
            @PathVariable Long specificationId,
            @RequestParam(required = false, defaultValue = "false") String full) {
        boolean includeFullData = "true".equalsIgnoreCase(full);
        return ResponseEntity.ok(savedSpecificationService.getSavedSpecification(projectId, specificationId, includeFullData));
    }

    @DeleteMapping("/{specificationId}")
    public ResponseEntity<ApiResponse> deleteSavedSpecification(
            @PathVariable Long projectId,
            @PathVariable Long specificationId) {
        savedSpecificationService.deleteSavedSpecification(projectId, specificationId);
        return ResponseEntity.ok(ApiResponse.success("Saved specification deleted successfully"));
    }

    @PostMapping("/{specificationId}/restore")
    public ResponseEntity<ApiResponse> restoreFromSnapshot(
            @PathVariable Long projectId,
            @PathVariable Long specificationId) {
        try {
            savedSpecificationService.restoreFromSnapshot(projectId, specificationId);
            return ResponseEntity.ok(ApiResponse.success("Scene restored from snapshot successfully"));
        } catch (com.verchuk.electro.exception.ResourceNotFoundException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body(ApiResponse.error("Failed to restore: " + e.getMessage()));
        }
    }
}

