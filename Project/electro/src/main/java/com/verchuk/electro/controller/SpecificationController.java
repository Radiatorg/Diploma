package com.verchuk.electro.controller;

import com.verchuk.electro.dto.response.SpecificationResponse;
import com.verchuk.electro.service.SpecificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/designer/projects/{projectId}/specifications")
public class SpecificationController {
    @Autowired
    private SpecificationService specificationService;

    @GetMapping
    public ResponseEntity<SpecificationResponse> getSpecification(@PathVariable Long projectId) {
        return ResponseEntity.ok(specificationService.getSpecification(projectId));
    }
}

