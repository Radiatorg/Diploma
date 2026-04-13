package com.verchuk.electro.controller;

import com.verchuk.electro.dto.request.ManufacturerRequest;
import com.verchuk.electro.dto.response.ApiResponse;
import com.verchuk.electro.dto.response.ManufacturerResponse;
import com.verchuk.electro.service.ExcelDataExchangeService;
import com.verchuk.electro.service.ManufacturerService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Optional;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/admin/manufacturers")
public class AdminManufacturerController {

    @Autowired
    private ManufacturerService manufacturerService;

    @Autowired
    private ExcelDataExchangeService excelDataExchangeService;

    @GetMapping
    public ResponseEntity<List<ManufacturerResponse>> getAll(@RequestParam(required = false) String search,
                                                             @RequestParam(required = false) Boolean active,
                                                             @RequestParam(required = false) String sortBy,
                                                             @RequestParam(required = false) String sortDir,
                                                             @RequestParam(required = false) Integer page,
                                                             @RequestParam(required = false) Integer size) {
        ManufacturerService.ManufacturerQueryResult result = manufacturerService.getAllForAdmin(
                Optional.ofNullable(search),
                Optional.ofNullable(active),
                Optional.ofNullable(sortBy),
                Optional.ofNullable(sortDir),
                Optional.ofNullable(page),
                Optional.ofNullable(size)
        );
        HttpHeaders headers = new HttpHeaders();
        headers.add("X-Total-Count", String.valueOf(result.getTotalItems()));
        headers.add("Access-Control-Expose-Headers", "X-Total-Count");
        return ResponseEntity.ok()
                .headers(headers)
                .body(result.getManufacturers());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ManufacturerResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(manufacturerService.getByIdForAdmin(id));
    }

    @PostMapping
    public ResponseEntity<ManufacturerResponse> create(@Valid @RequestBody ManufacturerRequest request) {
        return ResponseEntity.ok(manufacturerService.create(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ManufacturerResponse> update(@PathVariable Long id,
                                                         @Valid @RequestBody ManufacturerRequest request) {
        return ResponseEntity.ok(manufacturerService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse> delete(@PathVariable Long id) {
        manufacturerService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Производитель удалён"));
    }

    @GetMapping(value = "/export/excel", produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    public ResponseEntity<byte[]> exportExcel() throws Exception {
        byte[] data = excelDataExchangeService.exportManufacturersExcel();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=manufacturers.xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(data);
    }

    @PostMapping(value = "/import/excel", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> importExcel(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(excelDataExchangeService.importManufacturersExcel(file));
    }
}
