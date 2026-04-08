package com.verchuk.electro.controller;

import com.verchuk.electro.dto.response.ApplianceResponse;
import com.verchuk.electro.dto.response.ManufacturerResponse;
import com.verchuk.electro.dto.response.ManufacturerSummaryResponse;
import com.verchuk.electro.service.ManufacturerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/manufacturers")
public class ManufacturerController {

    @Autowired
    private ManufacturerService manufacturerService;

    @GetMapping
    public ResponseEntity<List<ManufacturerSummaryResponse>> listActive() {
        return ResponseEntity.ok(manufacturerService.listActiveSummaries());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ManufacturerResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(manufacturerService.getPublicById(id));
    }

    @GetMapping("/{id}/appliances")
    public ResponseEntity<List<ApplianceResponse>> listAppliances(@PathVariable Long id) {
        return ResponseEntity.ok(manufacturerService.getActiveAppliancesByManufacturer(id));
    }
}
