package com.verchuk.electro.controller;

import com.verchuk.electro.dto.request.CableTypeRequest;
import com.verchuk.electro.dto.response.ApiResponse;
import com.verchuk.electro.dto.response.CableTypeResponse;
import com.verchuk.electro.service.CableTypeService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/admin/cable-types")
public class AdminCableTypeController {
    @Autowired
    private CableTypeService cableTypeService;

    @GetMapping
    public ResponseEntity<List<CableTypeResponse>> getAllCableTypes() {
        return ResponseEntity.ok(cableTypeService.getAllCableTypes());
    }

    @PostMapping
    public ResponseEntity<CableTypeResponse> createCableType(@Valid @RequestBody CableTypeRequest request) {
        return ResponseEntity.ok(cableTypeService.createCableType(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CableTypeResponse> updateCableType(
            @PathVariable Long id,
            @Valid @RequestBody CableTypeRequest request) {
        return ResponseEntity.ok(cableTypeService.updateCableType(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse> deleteCableType(@PathVariable Long id) {
        cableTypeService.deleteCableType(id);
        return ResponseEntity.ok(ApiResponse.success("Cable type deleted successfully"));
    }
}
