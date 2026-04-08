package com.verchuk.electro.controller;

import com.verchuk.electro.dto.request.ElectricalSymbolRequest;
import com.verchuk.electro.dto.response.ApiResponse;
import com.verchuk.electro.dto.response.ElectricalSymbolResponse;
import com.verchuk.electro.service.ElectricalSymbolService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api")
public class ElectricalSymbolController {
    @Autowired
    private ElectricalSymbolService electricalSymbolService;

    @GetMapping("/electrical-symbols")
    public ResponseEntity<List<ElectricalSymbolResponse>> getAllSymbols() {
        return ResponseEntity.ok(electricalSymbolService.getAllSymbols());
    }

    @GetMapping("/electrical-symbols/type/{type}")
    public ResponseEntity<List<ElectricalSymbolResponse>> getSymbolsByType(@PathVariable String type) {
        return ResponseEntity.ok(electricalSymbolService.getSymbolsByType(type));
    }

    @GetMapping("/electrical-symbols/category/{category}")
    public ResponseEntity<List<ElectricalSymbolResponse>> getSymbolsByCategory(@PathVariable String category) {
        return ResponseEntity.ok(electricalSymbolService.getSymbolsByCategory(category));
    }

    @GetMapping("/electrical-symbols/{id}")
    public ResponseEntity<ElectricalSymbolResponse> getSymbolById(@PathVariable Long id) {
        return ResponseEntity.ok(electricalSymbolService.getSymbolById(id));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/admin/electrical-symbols")
    public ResponseEntity<ElectricalSymbolResponse> createSymbol(@Valid @RequestBody ElectricalSymbolRequest request) {
        return ResponseEntity.ok(electricalSymbolService.createSymbol(request));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/admin/electrical-symbols/{id}")
    public ResponseEntity<ElectricalSymbolResponse> updateSymbol(
            @PathVariable Long id,
            @Valid @RequestBody ElectricalSymbolRequest request) {
        return ResponseEntity.ok(electricalSymbolService.updateSymbol(id, request));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/admin/electrical-symbols/{id}")
    public ResponseEntity<ApiResponse> deleteSymbol(@PathVariable Long id) {
        electricalSymbolService.deleteSymbol(id);
        return ResponseEntity.ok(ApiResponse.success("Electrical symbol deleted successfully"));
    }
}

