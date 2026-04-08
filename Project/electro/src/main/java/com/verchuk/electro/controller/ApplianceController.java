package com.verchuk.electro.controller;

import com.verchuk.electro.dto.request.ApplianceRequest;
import com.verchuk.electro.dto.response.ApiResponse;
import com.verchuk.electro.dto.response.ApplianceResponse;
import com.verchuk.electro.service.ApplianceService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/appliances")
public class ApplianceController {
    @Autowired
    private ApplianceService applianceService;

    @GetMapping
    public ResponseEntity<List<ApplianceResponse>> getAllActiveAppliances() {
        return ResponseEntity.ok(applianceService.getAllActiveAppliances());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApplianceResponse> getApplianceById(@PathVariable Long id) {
        return ResponseEntity.ok(applianceService.getApplianceById(id));
    }
}

