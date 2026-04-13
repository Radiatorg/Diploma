package com.verchuk.electro.controller;

import com.verchuk.electro.dto.request.ApplianceRequest;
import com.verchuk.electro.dto.response.ApiResponse;
import com.verchuk.electro.dto.response.ApplianceResponse;
import com.verchuk.electro.service.ApplianceService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/appliances")
public class ApplianceController {
    @Autowired
    private ApplianceService applianceService;

    @GetMapping
    public ResponseEntity<List<ApplianceResponse>> getAllActiveAppliances(@RequestParam(required = false) String search,
                                                                          @RequestParam(required = false) String category,
                                                                          @RequestParam(required = false) String sortBy,
                                                                          @RequestParam(required = false) String sortDir,
                                                                          @RequestParam(required = false) BigDecimal priceFrom,
                                                                          @RequestParam(required = false) BigDecimal priceTo,
                                                                          @RequestParam(required = false) Integer page,
                                                                          @RequestParam(required = false) Integer size) {
        ApplianceService.ApplianceQueryResult result = applianceService.getAllActiveAppliances(
                Optional.ofNullable(search),
                Optional.ofNullable(category),
                Optional.ofNullable(sortBy),
                Optional.ofNullable(sortDir),
                Optional.ofNullable(priceFrom),
                Optional.ofNullable(priceTo),
                Optional.ofNullable(page),
                Optional.ofNullable(size)
        );
        HttpHeaders headers = new HttpHeaders();
        headers.add("X-Total-Count", String.valueOf(result.getTotalItems()));
        headers.add("Access-Control-Expose-Headers", "X-Total-Count");
        return ResponseEntity.ok()
                .headers(headers)
                .body(result.getAppliances());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApplianceResponse> getApplianceById(@PathVariable Long id) {
        return ResponseEntity.ok(applianceService.getApplianceById(id));
    }
}

